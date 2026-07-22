const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { authenticateToken, verifyAdmin } = require('../middleware/auth');

// Protect all admin endpoints with JWT authentication and Admin check
router.use(authenticateToken, verifyAdmin);

// 1. Get All Accounts & Admin Dashboard Metrics
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('username email avatar isVerified isAdmin isBanned createdAt bio')
      .sort({ createdAt: -1 });

    const totalUsers = users.length;
    const verifiedCount = users.filter(u => u.isVerified).length;
    const bannedCount = users.filter(u => u.isBanned).length;
    const adminCount = users.filter(u => u.isAdmin).length;

    res.json({
      users,
      stats: {
        totalUsers,
        verifiedCount,
        bannedCount,
        adminCount
      }
    });
  } catch (err) {
    console.error('Fetch admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch admin users list.' });
  }
});

// 2. Toggle User Verification Badge Status
router.put('/users/:id/verify', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    user.isVerified = !user.isVerified;
    await user.save();

    res.json({
      message: `User ${user.username} verification updated.`,
      isVerified: user.isVerified
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user verification.' });
  }
});

// 3. Toggle User Ban / Unban Status
router.put('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot ban your own administrator account.' });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({
      message: `User ${user.username} is now ${user.isBanned ? 'banned' : 'unbanned'}.`,
      isBanned: user.isBanned
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user ban status.' });
  }
});

// 4. Toggle Admin Role Privileges
router.put('/users/:id/role', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot revoke your own administrator role.' });
    }

    user.isAdmin = !user.isAdmin;
    await user.save();

    res.json({
      message: `User ${user.username} role updated.`,
      isAdmin: user.isAdmin
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user admin role.' });
  }
});

// 5. Delete Account & Cleanup Data
router.delete('/users/:id', async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    }

    // Cascade delete user posts, messages, and notifications
    await Post.deleteMany({ author: targetUserId });
    await Message.deleteMany({ $or: [{ sender: targetUserId }, { receiver: targetUserId }] });
    await Notification.deleteMany({ $or: [{ recipient: targetUserId }, { sender: targetUserId }] });
    await User.deleteOne({ _id: targetUserId });

    res.json({ message: `Account @${user.username} and associated content deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user account.' });
  }
});

module.exports = router;
