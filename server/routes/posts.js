const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../socket');

// In-memory trending hashtag cache (5-minute TTL)
let trendingCache = { data: null, expiresAt: 0 };

// Hashtag sanitizer — strips HTML tags and limits length to prevent XSS
function sanitizeHashtag(tag) {
  if (typeof tag !== 'string') return '';
  return tag.replace(/<[^>]*>/g, '').replace(/['"`;]/g, '').trim().substring(0, 50).toLowerCase();
}

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
      .sort({ createdAt: -1 })
      .lean(); // Performance: lean() skips Mongoose document hydration for read-only data

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

// 2. Get Explore Posts (sorted by engagement: likes + comments desc)
router.get('/explore', async (req, res) => {
  try {
    const category = req.query.category;
    const query = category && category.toLowerCase() !== 'all' ? { category } : {};

    const posts = await Post.find(query)
      .populate('author', 'username avatar bio isVerified')
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    // Sort by engagement score (likes + comments) in-memory for explore
    posts.sort((a, b) => {
      const scoreA = (a.likes ? a.likes.length : 0) + (a.comments ? a.comments.length : 0);
      const scoreB = (b.likes ? b.likes.length : 0) + (b.comments ? b.comments.length : 0);
      return scoreB - scoreA;
    });

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

// 4. Get Trending Hashtags (5-minute in-memory cache)
router.get('/trending-tags', authenticateToken, async (req, res) => {
  try {
    const now = Date.now();
    if (trendingCache.data && trendingCache.expiresAt > now) {
      return res.json(trendingCache.data);
    }

    const posts = await Post.find({ hashtags: { $exists: true, $ne: [] } })
      .select('hashtags')
      .lean();
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

    // Cache for 5 minutes
    trendingCache = { data: trending, expiresAt: now + 5 * 60 * 1000 };
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

// 5b. Get Posts by Username (for profile grid)
router.get('/user/:username', authenticateToken, async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const category = req.query.category;
    let query = { author: user._id };
    if (category && category.toLowerCase() !== 'all') {
      query.category = category;
    }

    const posts = await Post.find(query)
      .populate('author', 'username avatar bio isVerified')
      .populate('comments.user', 'username avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user posts.' });
  }
});

// 6. Get Single Post by ID (handles both /single/:id and /:id)
const getSinglePostHandler = async (req, res) => {
  try {
    // Increment viewsCount atomically (fire-and-forget — doesn't block response)
    Post.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } }).catch(() => {});

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
      hashtags: Array.isArray(hashtags) ? hashtags.map(sanitizeHashtag).filter(Boolean) : [],
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

    const updatedPost = await Post.findById(post._id).populate('comments.user', 'username avatar');
    res.status(201).json(updatedPost ? updatedPost.comments : post.comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// 12. Delete Comment
router.delete('/:id/comment/:commentId', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    // Check authorization: comment owner, post author, or admin
    const isCommentOwner = comment.user && comment.user.toString() === req.user.id;
    const isPostAuthor = post.author.toString() === req.user.id;
    if (!isCommentOwner && !isPostAuthor && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment.' });
    }

    comment.deleteOne();
    await post.save();

    const updatedPost = await Post.findById(post._id).populate('comments.user', 'username avatar');
    res.json(updatedPost ? updatedPost.comments : post.comments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

// 13. Delete Post
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

// 13. Edit Post (caption, mood, category, hashtags, location — not image)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    if (post.author.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to edit this post.' });
    }

    const { caption, mood, category, location, hashtags } = req.body;
    if (caption !== undefined) post.caption = caption;
    if (mood !== undefined) post.mood = mood;
    if (category !== undefined) post.category = category;
    if (location !== undefined) post.location = location;
    if (Array.isArray(hashtags)) post.hashtags = hashtags.map(sanitizeHashtag).filter(Boolean);

    await post.save();
    const updatedPost = await Post.findById(post._id)
      .populate('author', 'username avatar bio isVerified');
    res.json(updatedPost);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit post.' });
  }
});

// 14. Search Posts (caption + hashtags, case-insensitive)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const posts = await Post.find({
      $or: [
        { caption: { $regex: q, $options: 'i' } },
        { hashtags: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } }
      ]
    })
      .populate('author', 'username avatar isVerified')
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Post search failed.' });
  }
});

// 15. Repost / Quote Post
router.post('/:id/repost', authenticateToken, async (req, res) => {
  try {
    const originalPost = await Post.findById(req.params.id);
    if (!originalPost) return res.status(404).json({ error: 'Original post not found.' });

    const { repostComment } = req.body;

    const repost = new Post({
      author: req.user.id,
      image: originalPost.image,
      caption: originalPost.caption,
      mood: originalPost.mood,
      category: originalPost.category,
      location: originalPost.location,
      filter: originalPost.filter,
      hashtags: originalPost.hashtags,
      repostOf: originalPost._id,
      repostComment: repostComment || ''
    });

    await repost.save();

    // Track the share on the original post
    if (!originalPost.shares.includes(req.user.id)) {
      originalPost.shares.push(req.user.id);
      await originalPost.save();
    }

    const populatedRepost = await Post.findById(repost._id)
      .populate('author', 'username avatar bio isVerified')
      .populate('repostOf', 'image caption author');

    res.status(201).json(populatedRepost);
  } catch (err) {
    res.status(500).json({ error: 'Failed to repost.' });
  }
});

// 16. Vote on a Poll (exclusive — one vote per user across all options)
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const { optionIndex } = req.body;
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({ error: 'optionIndex is required.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    if (!post.poll || !post.poll.options || post.poll.options.length === 0) {
      return res.status(400).json({ error: 'This post does not have a poll.' });
    }
    if (optionIndex < 0 || optionIndex >= post.poll.options.length) {
      return res.status(400).json({ error: 'Invalid option index.' });
    }

    const userId = req.user.id;

    // Remove any previous votes by this user across all options (exclusive voting)
    post.poll.options.forEach(option => {
      const idx = option.votes.findIndex(v => v.toString() === userId);
      if (idx !== -1) option.votes.splice(idx, 1);
    });

    // Add vote to selected option
    post.poll.options[optionIndex].votes.push(userId);
    await post.save();

    const voteSummary = post.poll.options.map((opt, i) => ({
      index: i,
      text: opt.text,
      votes: opt.votes.length,
      votedByMe: opt.votes.some(v => v.toString() === userId)
    }));

    res.json({ poll: { question: post.poll.question, options: voteSummary } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record vote.' });
  }
});

// Get Post by ID (Catch-all for /:id — must remain LAST)
router.get('/:id', authenticateToken, getSinglePostHandler);

module.exports = router;
