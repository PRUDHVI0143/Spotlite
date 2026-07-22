const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../socket');

// 1. Get Feed Posts (with optional pagination or category filter)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;

    const currentUser = await User.findById(req.user.id);
    const followingIds = currentUser && currentUser.following.length > 0
      ? [...currentUser.following, req.user.id]
      : [];

    let query = {};
    if (followingIds.length > 0) {
      query.author = { $in: followingIds };
    }
    if (category && category.toLowerCase() !== 'all') {
      query.category = category;
    }

    let postsQuery = Post.find(query)
      .populate('author', 'username avatar bio isVerified')
      .populate('comments.user', 'username avatar')
      .sort({ createdAt: -1 });

    if (page) {
      const skip = (page - 1) * limit;
      const posts = await postsQuery.skip(skip).limit(limit);
      const total = await Post.countDocuments(query);
      return res.json({
        posts,
        page,
        totalPages: Math.ceil(total / limit),
        totalPosts: total
      });
    }

    const posts = await postsQuery.limit(limit);
    res.json(posts);
  } catch (err) {
    console.error('Fetch feed posts error:', err);
    res.status(500).json({ error: 'Failed to fetch posts.' });
  }
});

// 2. Get Explore Posts
router.get('/explore', async (req, res) => {
  try {
    const category = req.query.category;
    const query = category && category.toLowerCase() !== 'all' ? { category } : {};

    const posts = await Post.find(query)
      .populate('author', 'username avatar bio isVerified')
      .sort({ createdAt: -1 })
      .limit(60);

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch explore posts.' });
  }
});

// 3. Get Saved Posts for User
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'savedPosts',
      populate: { path: 'author', select: 'username avatar isVerified' }
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user.savedPosts || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved posts.' });
  }
});

// 4. Get Trending Hashtags
router.get('/trending-tags', authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ hashtags: { $exists: true, $ne: [] } }).select('hashtags');
    const tagCounts = {};
    posts.forEach(post => {
      if (Array.isArray(post.hashtags)) {
        post.hashtags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const trending = Object.keys(tagCounts)
      .map(tag => ({ tag, count: tagCounts[tag] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json(trending);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending tags.' });
  }
});

// 5. Get Posts by Hashtag
router.get('/hashtag/:hashtag', authenticateToken, async (req, res) => {
  try {
    const tag = req.params.hashtag.toLowerCase().trim();
    const posts = await Post.find({ hashtags: tag })
      .populate('author', 'username avatar isVerified')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hashtag posts.' });
  }
});

// 6. Get Single Post by ID (handles both /single/:id and /:id)
const getSinglePostHandler = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar bio isVerified')
      .populate('comments.user', 'username avatar');

    if (!post) return res.status(404).json({ error: 'Post not found.' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post.' });
  }
};

router.get('/single/:id', authenticateToken, getSinglePostHandler);

// 7. Create New Post
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { image, caption, mood, category, location, filter, hashtags, poll } = req.body;

    if (!image && (!poll || !poll.question)) {
      return res.status(400).json({ error: 'Image or poll question is required.' });
    }

    const newPost = new Post({
      author: req.user.id,
      image: image || '',
      caption: caption || '',
      mood: mood || '',
      category: category || 'General',
      location: location || '',
      filter: filter || 'none',
      hashtags: hashtags || [],
      poll: poll || undefined
    });

    await newPost.save();
    const populatedPost = await Post.findById(newPost._id).populate('author', 'username avatar bio isVerified');

    res.status(201).json(populatedPost);
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

// 8. Like / Unlike Post
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const userId = req.user.id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);

      if (post.author.toString() !== userId) {
        const notif = new Notification({
          recipient: post.author,
          sender: userId,
          type: 'like',
          post: post._id,
          text: 'liked your post'
        });
        await notif.save();
        
        const populatedNotif = await Notification.findById(notif._id).populate('sender', 'username avatar');
        sendNotification(post.author.toString(), populatedNotif);
      }
    }

    await post.save();
    res.json({ likesCount: post.likes.length, isLiked: !isLiked });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update like status.' });
  }
});

// 9. Save / Unsave Post
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const postId = req.params.id;
    const isSaved = user.savedPosts.includes(postId);

    if (isSaved) {
      user.savedPosts.pull(postId);
    } else {
      user.savedPosts.push(postId);
    }

    await user.save();
    res.json({ isSaved: !isSaved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save post.' });
  }
});

// 10. Pin / Unpin Post
router.post('/:id/pin', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to pin this post.' });
    }

    post.isPinned = !post.isPinned;
    await post.save();

    res.json({ isPinned: post.isPinned });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin post.' });
  }
});

// 11. Add Comment
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const user = await User.findById(req.user.id);
    const username = (user && user.username) ? user.username : 'spotlite_user';

    const newComment = {
      user: req.user.id,
      username: username,
      text: text.trim(),
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    if (post.author.toString() !== req.user.id) {
      const notif = new Notification({
        recipient: post.author,
        sender: req.user.id,
        type: 'comment',
        post: post._id,
        text: `commented: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`
      });
      await notif.save();

      const populatedNotif = await Notification.findById(notif._id).populate('sender', 'username avatar');
      sendNotification(post.author.toString(), populatedNotif);
    }

    res.status(201).json(post.comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// 12. Delete Post
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    if (post.author.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this post.' });
    }

    await Post.deleteOne({ _id: post._id });
    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// 13. Get Post by ID (Catch-all for /:id)
router.get('/:id', authenticateToken, getSinglePostHandler);

module.exports = router;
