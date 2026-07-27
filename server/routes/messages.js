const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendDirectMessage, sendNotification } = require('../socket');

// 1. Get Chat Conversations List (handles both /conversations and /conversations/list)
const conversationsHandler = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const messages = await Message.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }]
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar');

    const conversationMap = new Map();

    messages.forEach(msg => {
      const otherUser = msg.sender && msg.sender._id.toString() === currentUserId ? msg.receiver : msg.sender;
      if (otherUser && !conversationMap.has(otherUser._id.toString())) {
        conversationMap.set(otherUser._id.toString(), {
          user: otherUser,
          lastMessage: msg.text,
          updatedAt: msg.createdAt,
          isRead: msg.sender && msg.sender._id.toString() === currentUserId ? true : msg.isRead
        });
      }
    });

    res.json(Array.from(conversationMap.values()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
};

router.get('/conversations', authenticateToken, conversationsHandler);
router.get('/conversations/list', authenticateToken, conversationsHandler);

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

    await Message.updateMany(
      { sender: targetUserId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// 3. Send Direct / Group Message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { receiverId, receiverIds, text, sharedPostId, fileUrl, fileName, fileType, messageType, audioUrl, groupName } = req.body;

    const targetReceivers = Array.isArray(receiverIds) && receiverIds.length > 0 ? receiverIds : (receiverId ? [receiverId] : []);

    if (targetReceivers.length === 0 || (!text && !sharedPostId && !fileUrl && !audioUrl && !groupName)) {
      return res.status(400).json({ error: 'Recipient(s) and message content are required.' });
    }

    const createdMessages = [];
    const messageContent = text || (groupName ? `Created group chat: ${groupName} 👥` : '');

    for (const targetId of targetReceivers) {
      const newMessage = new Message({
        sender: req.user.id,
        receiver: targetId,
        text: messageContent,
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

      sendDirectMessage(targetId, populatedMessage);

      const notif = new Notification({
        recipient: targetId,
        sender: req.user.id,
        type: 'message',
        text: `sent you a message: "${messageContent.substring(0, 30)}"`
      });
      await notif.save();

      const populatedNotif = await Notification.findById(notif._id).populate('sender', 'username avatar');
      sendNotification(targetId, populatedNotif);

      createdMessages.push(populatedMessage);
    }

    res.status(201).json(createdMessages.length === 1 ? createdMessages[0] : { message: 'Group message sent', messages: createdMessages });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;
