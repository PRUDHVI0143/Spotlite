const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../socket');

// 1. Get All Users
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const users = await User.find()
      .select('username avatar bio isVerified followers')
      .limit(30);
    res.json(users);
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
      .select('username avatar bio isVerified followers')
      .limit(10);

    res.json(users);
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

    res.json({
      user,
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
    const { bio, avatar, coverPhoto, website, github, linkedin, accentColor, themeMode } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (coverPhoto !== undefined) user.coverPhoto = coverPhoto;
    if (website !== undefined) user.website = website;
    if (github !== undefined) user.github = github;
    if (linkedin !== undefined) user.linkedin = linkedin;
    if (accentColor !== undefined) user.accentColor = accentColor;
    if (themeMode !== undefined) user.themeMode = themeMode;

    await user.save();
    const updatedUser = await User.findById(user._id).select('-password -refreshToken');

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
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
