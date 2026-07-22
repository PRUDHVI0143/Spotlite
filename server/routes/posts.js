const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../socket');

// 1. Get Feed Posts (with optional pagination)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit) || 20;

    const currentUser = await User.findById(req.user.id);
    const followingIds = currentUser && currentUser.following.length > 0
      ? [...currentUser.following, req.user.id]
      : [];

    const query = followingIds.length > 0 ? { author: { $in: followingIds } } : {};

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

// 2. Get All/Explore Posts
router.get('/explore', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const category = req.query.category;

    const query = category && category !== 'All' ? { category } : {};

    const posts = await Post.find(query)
      .populate('author', 'username avatar bio isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch explore posts.' });
  }
});

// 3. Create New Post
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

// 4. Like / Unlike Post
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

      // Create & push notification if not liking own post
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

// 5. Add Comment
router.post('/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const user = await User.findById(req.user.id);
    const newComment = {
      user: req.user.id,
      username: user.username,
      text: text.trim(),
      createdAt: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    // Create notification if commenting on another user's post
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

// 6. Delete Post
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

module.exports = router;
