const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_spotlite_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotlite_db';

// Middleware
// Increase limit to handle Base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB (serverless-safe cached connection)
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('Connected to MongoDB successfully.');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
}

// Middleware to ensure DB is connected on every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed.' });
  }
});

// --- MODELS ---

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' }, // base64 or url
  bio: { type: String, default: '' },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Post Schema
const PostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: { type: String, required: true }, // base64 image data
  caption: { type: String, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Post = mongoose.model('Post', PostSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true }
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// 1. Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username: cleanUsername }, { email: cleanEmail }] 
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already in use.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const defaultAvatar = `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${cleanUsername}`;

    const user = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      avatar: defaultAvatar
    });

    await user.save();

    // Generate Token
    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        followersCount: 0,
        followingCount: 0
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });

    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        followersCount: user.followers.length,
        followingCount: user.following.length
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// 3. Get Current User Details
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      following: user.following
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile.' });
  }
});

// 4. Update Profile
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { bio, avatar, username } = req.body;
    const updateData = {};

    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername !== req.user.username) {
        const usernameExists = await User.findOne({ username: cleanUsername });
        if (usernameExists) {
          return res.status(400).json({ error: 'Username is already taken.' });
        }
        updateData.username = cleanUsername;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    );

    res.json({
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      bio: updatedUser.bio,
      followersCount: updatedUser.followers.length,
      followingCount: updatedUser.following.length
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Error updating profile.' });
  }
});

// 5. Get User Profile by Username (Public/Private Feed access)
app.get('/api/users/profile/:username', async (req, res) => {
  try {
    const cleanUsername = req.params.username.toLowerCase();
    const user = await User.findOne({ username: cleanUsername });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followers: user.followers,
      following: user.following
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching profile.' });
  }
});

// 6. Follow/Unfollow User
app.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.following.pull(targetUserId);
      targetUser.followers.pull(currentUserId);
    } else {
      // Follow
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);
    }

    await currentUser.save();
    await targetUser.save();

    res.json({
      following: !isFollowing,
      followersCount: targetUser.followers.length,
      followingCount: targetUser.following.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Error handling follow action.' });
  }
});

// 7. Get All Users (for suggestions)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    // Suggest users that are not the current user and not followed by current user
    const currentUser = await User.findById(currentUserId);
    const suggestions = await User.find({
      _id: { $ne: currentUserId, $nin: currentUser.following }
    })
    .select('username avatar bio')
    .limit(5);

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching suggestions.' });
  }
});

// 7b. Get ALL Users for share/search (no follow filter, no limit)
app.get('/api/users/all', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const allUsers = await User.find({ _id: { $ne: currentUserId } })
      .select('username avatar bio _id')
      .sort({ username: 1 });
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users.' });
  }
});


// 8. Create Post
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { image, caption } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required.' });
    }

    const post = new Post({
      author: req.user.id,
      image,
      caption: caption || ''
    });

    await post.save();
    
    // Populate author info before returning
    const populatedPost = await post.populate('author', 'username avatar');

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: 'Error creating post.' });
  }
});

// 9. Get Feed Posts (for the current user's feed)
app.get('/api/posts', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
        return res.status(404).json({ error: 'User not found.' });
    }

    // Create a list of user IDs to fetch posts from: the user themselves and the people they follow.
    const userIds = [...currentUser.following, currentUser._id];

    const posts = await Post.find({ author: { $in: userIds } })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50); // Add a limit to avoid sending too much data

    res.json(posts);
  } catch (error) {
    console.error('Fetch feed posts error:', error);
    res.status(500).json({ error: 'Error fetching posts.' });
  }
});

// 10. Get Posts of Specific User
app.get('/api/posts/user/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const posts = await Post.find({ author: user._id })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user posts.' });
  }
});

// NEW ENDPOINT: Get a single post by ID
app.get('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('comments.user', 'username avatar'); // Also populate comment authors

    if (!post) return res.status(404).json({ error: 'Post not found.' });

    res.json(post);
  } catch (error) {
    console.error(`Fetch post ${req.params.id} error:`, error);
    res.status(500).json({ error: 'Error fetching post.' });
  }
});


// 11. Like/Unlike Post
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const userId = req.user.id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    res.json({ liked: !isLiked, likesCount: post.likes.length });
  } catch (error) {
    res.status(500).json({ error: 'Error liking post.' });
  }
});

// NEW ENDPOINT: Share Post (tracks share count)
app.post('/api/posts/:id/share', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    // Track which users shared to prevent one user from bumping the count multiple times.
    const userId = req.user.id;
    if (!post.shares.includes(userId)) {
      post.shares.push(userId);
      await post.save();
    }

    res.json({ sharesCount: post.shares.length });
  } catch (error) {
    res.status(500).json({ error: 'Error sharing post.' });
  }
});

// 12. Add Comment to Post
app.post('/api/posts/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = {
      user: req.user.id,
      username: req.user.username,
      text: text.trim(),
      createdAt: new Date()
    };

    post.comments.push(comment);
    await post.save();

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Error adding comment.' });
  }
});

// 13. Search Users by Username
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim() === '') {
      return res.json([]);
    }
    const users = await User.find({
      username: { $regex: query.trim(), $options: 'i' },
      _id: { $ne: req.user.id }
    }).select('username avatar bio').limit(10);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Search failed.' });
  }
});

// 14. Send Direct Message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    if (!receiverId || !text || text.trim() === '') {
      return res.status(400).json({ error: 'Receiver and text are required.' });
    }
    const message = new Message({
      sender: req.user.id,
      receiver: receiverId,
      text: text.trim()
    });
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// 15. Get Message History with a User
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const currentUserId = req.user.id;
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get messages.' });
  }
});

// 16. Get Active Conversations List (Optimized with Aggregation)
app.get('/api/messages/conversations/list', authenticateToken, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.id);

    const conversations = await Message.aggregate([
      // Match messages sent or received by the current user
      { $match: { $or: [{ sender: currentUserId }, { receiver: currentUserId }] } },
      // Sort by creation time to get the latest message first
      { $sort: { createdAt: -1 } },
      // Group by conversation partner
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", currentUserId] },
              then: "$receiver",
              else: "$sender"
            }
          },
          lastMessage: { $first: "$text" },
          lastMessageTime: { $first: "$createdAt" }
        }
      },
      // Sort conversations by the last message time
      { $sort: { lastMessageTime: -1 } },
      // Lookup user details for the conversation partner
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      // Deconstruct the user array
      { $unwind: '$user' },
      // Project the final fields
      {
        $project: {
          _id: 0,
          user: { _id: '$user._id', username: '$user.username', avatar: '$user.avatar', bio: '$user.bio' },
          lastMessage: 1,
          lastMessageTime: 1
        }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Fetch conversations list error:', error);
    res.status(500).json({ error: 'Failed to load conversations.' });
  }
});

// 17. Change Password
app.put('/api/users/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Incorrect old password.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// Front-end SPA support - Serve HTML files dynamically or fallback
app.use((req, res) => {
  // If request is for an API route that wasn't matched, send JSON 404
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Spotlite server running on: http://localhost:${PORT}`);
  });
}

module.exports = app;
