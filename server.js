const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const User = require('./server/models/User');
const Story = require('./server/models/Story');
const { initSocket } = require('./server/socket');
const { apiLimiter } = require('./server/middleware/rateLimiter');
const { authenticateToken, verifyAdmin } = require('./server/middleware/auth');

// Import modular routes
const authRoutes = require('./server/routes/auth');
const postRoutes = require('./server/routes/posts');
const userRoutes = require('./server/routes/users');
const messageRoutes = require('./server/routes/messages');
const notificationRoutes = require('./server/routes/notifications');
const adminRoutes = require('./server/routes/admin');
const callRoutes = require('./server/routes/calls');
const newRoute = require(path.join(__dirname, 'server', 'routes', 'New_route.js'));

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotlite_db';

// Trust reverse proxy for Vercel / serverless deployments
app.set('trust proxy', 1);

// Initialize WebSockets
initSocket(server);

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Database Connection & Seeding
let isConnected = false;

async function seedInitialPosts(adminId) {
  try {
    const Post = require('./server/models/Post');
    const count = await Post.countDocuments();
    if (count === 0 && adminId) {
      const samplePosts = [
        {
          author: adminId,
          caption: "Welcome to Spotlite! 🌟 Built with Node.js, Express, MongoDB & WebSockets. Share your moments with live photo filters & real-time messaging!",
          image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=80",
          category: "Tech & Code",
          mood: "Coding",
          hashtags: ["#spotlite", "#mern", "#coding", "#tech"],
          likes: [adminId],
          comments: [
            { user: adminId, username: "admin", text: "Welcome everyone! Feel free to create your own posts. ✨", createdAt: new Date() }
          ]
        },
        {
          author: adminId,
          caption: "Exploring majestic mountain trails at sunrise. Nothing beats morning crisp air! 🏔️✨",
          image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1080&q=80",
          category: "Travel",
          mood: "Travel",
          hashtags: ["#travel", "#explore", "#nature", "#vibes"],
          likes: [adminId],
          comments: []
        },
        {
          author: adminId,
          caption: "Fresh artisanal sourdough & avocado toast breakfast spread. Good food, good mood! 🥑🍞☕",
          image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1080&q=80",
          category: "Food",
          mood: "Food",
          hashtags: ["#foodie", "#breakfast", "#delicious"],
          likes: [adminId],
          comments: []
        }
      ];
      await Post.insertMany(samplePosts);
      console.log('Initial sample posts seeded successfully.');
    }
  } catch (err) {
    console.error('Failed to seed sample posts:', err.message);
  }
}

async function seedAdmin() {
  try {
    const adminUsername = 'admin';
    const adminEmail = 'admin@spotlite.com';
    const adminPassword = 'prudhvi';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    let adminUser = await User.findOne({ username: adminUsername });

    if (!adminUser) {
      adminUser = new User({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        bio: 'Spotlite Administrator',
        isAdmin: true,
        isVerified: true
      });
      await adminUser.save();
      console.log('Default administrator account created successfully.');
    } else {
      adminUser.password = hashedPassword;
      adminUser.isAdmin = true;
      adminUser.isVerified = true;
      await adminUser.save();
    }

    await seedInitialPosts(adminUser._id);
  } catch (err) {
    console.error('Failed to seed admin account:', err.message);
  }
}

async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return true;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 20000,
    });
    isConnected = true;
    console.log('Connected to MongoDB successfully.');
    await seedAdmin();
    return true;
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return false;
  }
}

// Global DB Middleware for API requests
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    const ok = await connectDB();
    if (!ok && mongoose.connection.readyState !== 1) {
      return res.status(500).json({ error: 'Database connection failed.' });
    }
  }
  next();
});

// Apply General Rate Limiter to API routes
app.use('/api', apiLimiter);

// Mount Modular API Routers
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/new-route', newRoute);

// Stories Endpoints
app.post('/api/stories', authenticateToken, async (req, res) => {
  try {
    const { image, caption } = req.body;
    if (!image) return res.status(400).json({ error: 'Image is required for story.' });
    const story = new Story({ author: req.user.id, image, caption: caption || '' });
    await story.save();
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create story.' });
  }
});

app.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const stories = await Story.find({ expiresAt: { $gt: now } })
      .populate('author', 'username avatar isVerified')
      .populate('viewers', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50); // Prevent unbounded query growth
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stories.' });
  }
});

// Story View Tracking — POST /api/stories/:id/view
app.post('/api/stories/:id/view', authenticateToken, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found or expired.' });

    const userId = req.user.id;
    if (!story.viewers.includes(userId)) {
      story.viewers.push(userId);
      await story.save();
    }

    res.json({ viewersCount: story.viewers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record story view.' });
  }
});

// AI Generator Helper Endpoint
app.post('/api/ai/generate-caption', (req, res) => {
  const { mood, category } = req.body;
  const moodCaptions = {
    'Happy': "Living life with pure joy & good vibes! 😊✨ #happy #lifestyle #spotlite",
    'Travel': "Wanderlust adventures & unforgettable views! ✈️🌍 #travel #explore #vibes",
    'Coding': "Building the future line by line. 💻🔥 #dev #coding #mern #tech",
    'Fitness': "Pushing limits & grinding every single day! 💪🏋️ #fitness #health #workout",
    'Food': "Good food, good mood, good memories! 🍔🍕 #foodie #delicious #spotlite"
  };
  const caption = moodCaptions[mood] || `Capturing moments under ${category || 'General'}. ✨ #spotlite #lifestyle`;
  res.json({ caption });
});

app.post('/api/ai/suggest-hashtags', (req, res) => {
  const suggestions = ['#spotlite', '#trending', '#viral', '#vibes', '#lifestyle', '#developer', '#tech', '#mern'];
  res.json({ hashtags: suggestions });
});

// Clean Routes & SPA Fallback
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/messages', (req, res) => res.sendFile(path.join(__dirname, 'public', 'messages.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/call', (req, res) => res.sendFile(path.join(__dirname, 'public', 'call.html')));
app.get('/call-demo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'call.html')));


app.use((req, res) => {
  if (req.originalUrl.startsWith('/api') || req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Spotlite modular server + WebSockets running on: http://localhost:${PORT}`);
  });
}

module.exports = app;
