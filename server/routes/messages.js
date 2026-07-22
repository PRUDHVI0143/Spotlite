const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendDirectMessage, sendNotification } = require('../socket');

// 1. Get Chat Conversations List
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Find distinct chat contacts
    const messages = await Message.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }]
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar');

    const conversationMap = new Map();

    messages.forEach(msg => {
      const otherUser = msg.sender._id.toString() === currentUserId ? msg.receiver : msg.sender;
      if (otherUser && !conversationMap.has(otherUser._id.toString())) {
        conversationMap.set(otherUser._id.toString(), {
          user: otherUser,
          lastMessage: msg.text,
          updatedAt: msg.createdAt,
          isRead: msg.sender._id.toString() === currentUserId ? true : msg.isRead
        });
      }
    });

    res.json(Array.from(conversationMap.values()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
});

// 2. Get Direct Messages with a specific user
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: targetUserId },
        { sender: targetUserId, receiver: currentUserId }
      ]
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .populate('sharedPostId');

    // Mark received messages as read
    await Message.updateMany(
      { sender: targetUserId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// 3. Send Direct Message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { receiverId, text, sharedPostId, fileUrl, fileName, fileType, messageType, audioUrl } = req.body;

    if (!receiverId || (!text && !sharedPostId && !fileUrl && !audioUrl)) {
      return res.status(400).json({ error: 'Recipient and message content are required.' });
    }

    const newMessage = new Message({
      sender: req.user.id,
      receiver: receiverId,
      text: text || '',
      audioUrl: audioUrl || '',
      fileUrl: fileUrl || '',
      fileName: fileName || '',
      fileType: fileType || '',
      messageType: messageType || (fileUrl ? 'file' : (audioUrl ? 'audio' : 'text')),
      sharedPostId: sharedPostId || null
    });

    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar')
      .populate('sharedPostId');

    // Real-time dispatch via Socket.io
    sendDirectMessage(receiverId, populatedMessage);

    // Create notification if needed
    const notif = new Notification({
      recipient: receiverId,
      sender: req.user.id,
      type: 'message',
      text: `sent you a message: "${(text || 'shared a post').substring(0, 30)}"`
    });
    await notif.save();

    const populatedNotif = await Notification.findById(notif._id).populate('sender', 'username avatar');
    sendNotification(receiverId, populatedNotif);

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;
