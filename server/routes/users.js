const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../socket');

// Save or update 24-hour status note
router.post('/note', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.note = {
      text: (text || '').trim().substring(0, 60),
      updatedAt: new Date()
    };
    await user.save();

    res.json({ success: true, note: user.note });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note.' });
  }
});

// Helper: Filter note if older than 24 hours
function getActiveNote(note) {
  if (!note || !note.text || !note.updatedAt) return null;
  const now = new Date();
  const noteDate = new Date(note.updatedAt);
  const diffHours = (now - noteDate) / (1000 * 60 * 60);
  return diffHours < 24 ? note : null;
}

// 1. Get All Users
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100); // max 100 per page
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('username avatar bio isVerified followers note')
      .skip(skip)
      .limit(limit)
      .lean();

    const processed = users.map(u => {
      u.note = getActiveNote(u.note);
      return u;
    });

    const total = await User.countDocuments();
    res.json({ users: processed, page, totalPages: Math.ceil(total / limit), total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// 2. Search Users
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } }
      ]
    })
      .select('username avatar bio isVerified followers note')
      .limit(10);

    const processed = users.map(u => {
      const uObj = u.toObject();
      uObj.note = getActiveNote(uObj.note);
      return uObj;
    });

    res.json(processed);
  } catch (err) {
    res.status(500).json({ error: 'Search failed.' });
  }
});

// 3. User Analytics Dashboard
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const userPosts = await Post.find({ author: userId });
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let topPost = null;
    let maxEngagement = -1;

    userPosts.forEach(post => {
      const likesCount = post.likes ? post.likes.length : 0;
      const commentsCount = post.comments ? post.comments.length : 0;
      const sharesCount = post.shares ? post.shares.length : 0;
      
      totalLikes += likesCount;
      totalComments += commentsCount;
      totalShares += sharesCount;

      const engagement = likesCount + commentsCount;
      if (engagement > maxEngagement) {
        maxEngagement = engagement;
        topPost = post;
      }
    });

    res.json({
      username: user.username,
      isVerified: user.isVerified || false,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      totalPosts: userPosts.length,
      totalLikes,
      totalComments,
      totalShares,
      engagementRate: userPosts.length > 0 ? ((totalLikes + totalComments) / userPosts.length).toFixed(1) : '0.0',
      topPost: topPost ? { _id: topPost._id, image: topPost.image, likesCount: topPost.likes ? topPost.likes.length : 0 } : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate analytics.' });
  }
});

// 4. Change Password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// 5. Get User Profile by Username
router.get('/profile/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username })
      .select('-password -refreshToken')
      .populate('followers', 'username avatar')
      .populate('following', 'username avatar');

    if (!user) return res.status(404).json({ error: 'User profile not found.' });

    const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 });

    const userObj = user.toObject();
    userObj.note = getActiveNote(userObj.note);

    res.json({
      user: userObj,
      posts,
      postsCount: posts.length,
      followersCount: user.followers.length,
      followingCount: user.following.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// 6. Update Current User Profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { bio, avatar, coverPhoto, website, github, linkedin, portfolioUrl, resumeUrl, accentColor, themeMode } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (coverPhoto !== undefined) user.coverPhoto = coverPhoto;
    if (website !== undefined) user.website = website;
    if (github !== undefined) user.github = github;
    if (linkedin !== undefined) user.linkedin = linkedin;
    if (portfolioUrl !== undefined) user.portfolioUrl = portfolioUrl;
    if (resumeUrl !== undefined) user.resumeUrl = resumeUrl;
    if (accentColor !== undefined) user.accentColor = accentColor;
    if (themeMode !== undefined) user.themeMode = themeMode;

    await user.save();
    const updatedUser = await User.findById(user._id).select('-password -refreshToken');

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// 6b. Add Featured Project to Developer Portfolio
router.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { title, description, link, techStack } = req.body;
    if (!title) return res.status(400).json({ error: 'Project title is required.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.featuredProjects.push({
      title,
      description: description || '',
      link: link || '',
      techStack: Array.isArray(techStack) ? techStack : (techStack ? techStack.split(',').map(s => s.trim()) : [])
    });

    await user.save();
    res.status(201).json(user.featuredProjects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add project.' });
  }
});

// 7. Follow / Unfollow User (handles both /:targetUserId/follow and /follow/:targetUserId)
const followHandler = async (req, res) => {
  try {
    const targetUserId = req.params.targetUserId || req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isFollowing = targetUser.followers.includes(currentUserId);

    if (isFollowing) {
      targetUser.followers.pull(currentUserId);
      currentUser.following.pull(targetUserId);
    } else {
      targetUser.followers.push(currentUserId);
      currentUser.following.push(targetUserId);

      const notif = new Notification({
        recipient: targetUser._id,
        sender: currentUserId,
        type: 'follow',
        text: 'started following you'
      });
      await notif.save();

      const populatedNotif = await Notification.findById(notif._id).populate('sender', 'username avatar');
      sendNotification(targetUser._id.toString(), populatedNotif);
    }

    await targetUser.save();
    await currentUser.save();

    res.json({
      isFollowing: !isFollowing,
      followersCount: targetUser.followers.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update follow status.' });
  }
};

router.post('/follow/:targetUserId', authenticateToken, followHandler);
router.post('/:id/follow', authenticateToken, followHandler);

module.exports = router;
