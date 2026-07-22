const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const User = require('./server/models/User');
const { initSocket } = require('./server/socket');
const { apiLimiter } = require('./server/middleware/rateLimiter');

// Import modular routes
const authRoutes = require('./server/routes/auth');
const postRoutes = require('./server/routes/posts');
const userRoutes = require('./server/routes/users');
const messageRoutes = require('./server/routes/messages');
const notificationRoutes = require('./server/routes/notifications');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotlite_db';

// Initialize WebSockets
initSocket(server);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// Database Connection & Admin Seeding
let isConnected = false;

async function seedAdmin() {
  try {
    const adminUsername = 'admin';
    const adminEmail = 'admin@spotlite.com';
    const adminPassword = 'prudhvi';

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const existingAdmin = await User.findOne({ username: adminUsername });

    if (!existingAdmin) {
      const adminUser = new User({
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
      existingAdmin.password = hashedPassword;
      existingAdmin.isAdmin = true;
      existingAdmin.isVerified = true;
      await existingAdmin.save();
    }
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

// Clean Routes & SPA Fallback
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/messages', (req, res) => res.sendFile(path.join(__dirname, 'public', 'messages.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));

app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
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
