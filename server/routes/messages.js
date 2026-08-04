const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { authenticateToken } = require('../middleware/auth');
const { sendDirectMessage, sendNotification } = require('../socket');

// 1. Get Chat Conversations List (handles both /conversations and /conversations/list)
const Group = require('../models/Group');

// 1. Get Chat Conversations List (1-to-1 & Group Chats)
const conversationsHandler = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Direct 1-to-1 messages
    const directMessages = await Message.find({
      isGroup: false,
      $or: [{ sender: currentUserId }, { receiver: currentUserId }]
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar');

    const conversationMap = new Map();

    directMessages.forEach(msg => {
      const otherUser = msg.sender && msg.sender._id.toString() === currentUserId ? msg.receiver : msg.sender;
      if (otherUser && !conversationMap.has(otherUser._id.toString())) {
        conversationMap.set(otherUser._id.toString(), {
          isGroup: false,
          user: otherUser,
          lastMessage: msg.text || (msg.fileUrl ? 'Sent attachment' : (msg.audioUrl ? 'Voice message 🎙️' : '')),
          updatedAt: msg.createdAt,
          isRead: msg.sender && msg.sender._id.toString() === currentUserId ? true : msg.isRead
        });
      }
    });

    const directList = Array.from(conversationMap.values());

    // Fetch user groups
    const groups = await Group.find({ members: currentUserId })
      .sort({ updatedAt: -1 })
      .populate('members', 'username avatar')
      .populate('creator', 'username avatar');

    const groupList = groups.map(g => ({
      isGroup: true,
      group: g,
      user: {
        _id: g._id,
        id: g._id,
        username: g.name,
        avatar: g.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${g.name}`,
        isGroup: true
      },
      lastMessage: g.lastMessage || 'Group created 👥',
      updatedAt: g.updatedAt,
      isRead: true
    }));

    // Combine and sort by newest updatedAt
    const allConvs = [...groupList, ...directList].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json(allConvs);
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations.' });
  }
};

router.get('/conversations', authenticateToken, conversationsHandler);
router.get('/conversations/list', authenticateToken, conversationsHandler);

// 2. Create Group Chat
router.post('/groups/create', authenticateToken, async (req, res) => {
  try {
    const { name, groupName, receiverIds, memberIds } = req.body;
    const currentUserId = req.user.id;
    const finalName = (name || groupName || 'Group Chat').trim();

    const rawMembers = Array.isArray(memberIds) && memberIds.length > 0 ? memberIds : (Array.isArray(receiverIds) ? receiverIds : []);
    const memberSet = new Set([currentUserId, ...rawMembers]);
    const members = Array.from(memberSet);

    if (members.length === 0) {
      return res.status(400).json({ error: 'Please select at least 1 member for your group.' });
    }

    const newGroup = new Group({
      name: finalName,
      creator: currentUserId,
      members,
      lastMessage: `Group chat created: ${finalName} 👥`,
      updatedAt: new Date()
    });

    await newGroup.save();

    // Create initial system message in group
    const initialMessage = new Message({
      sender: currentUserId,
      group: newGroup._id,
      isGroup: true,
      text: `Group chat created: "${finalName}" 👥`,
      messageType: 'text'
    });
    await initialMessage.save();

    const populatedGroup = await Group.findById(newGroup._id).populate('members', 'username avatar');

    // Notify members via socket
    members.forEach(memberId => {
      if (String(memberId) !== String(currentUserId)) {
        const notif = new Notification({
          recipient: memberId,
          sender: currentUserId,
          type: 'message',
          text: `added you to group "${finalName}" 👥`
        });
        notif.save().then(savedNotif => {
          Notification.findById(savedNotif._id).populate('sender', 'username avatar').then(popNotif => {
            sendNotification(memberId, popNotif);
          });
        });
      }
    });

    res.status(201).json(populatedGroup);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group.' });
  }
});

// 3. Get Group Chat Messages
router.get('/group/:groupId', authenticateToken, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const currentUserId = req.user.id;

    const group = await Group.findById(groupId).populate('members', 'username avatar');
    if (!group) return res.status(404).json({ error: 'Group not found.' });

    const isMember = group.members.some(m => String(m._id || m) === String(currentUserId));
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this group.' });

    const messages = await Message.find({ group: groupId, isGroup: true })
      .sort({ createdAt: 1 })
      .populate('sender', 'username avatar')
      .populate('sharedPostId');

    res.json({ group, messages });
  } catch (err) {
    console.error('Fetch group messages error:', err);
    res.status(500).json({ error: 'Failed to fetch group messages.' });
  }
});

// 4. Get Direct Messages with a specific user
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user.id;

    const messages = await Message.find({
      isGroup: false,
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

// 5. Send Direct or Group Message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { groupId, receiverId, receiverIds, text, sharedPostId, fileUrl, fileName, fileType, messageType, audioUrl, groupName } = req.body;
    const currentUserId = req.user.id;

    // Handle Group Messaging if groupId is provided
    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found.' });

      const msgText = text || (fileUrl ? 'Sent attachment' : (audioUrl ? 'Voice message 🎙️' : ''));
      if (!msgText && !sharedPostId) {
        return res.status(400).json({ error: 'Message content is required.' });
      }

      const newMessage = new Message({
        sender: currentUserId,
        group: groupId,
        isGroup: true,
        text: msgText,
        audioUrl: audioUrl || '',
        fileUrl: fileUrl || '',
        fileName: fileName || '',
        fileType: fileType || '',
        messageType: messageType || (fileUrl ? 'file' : (audioUrl ? 'audio' : 'text')),
        sharedPostId: sharedPostId || null
      });

      await newMessage.save();

      group.lastMessage = msgText;
      group.lastMessageSender = currentUserId;
      group.updatedAt = new Date();
      await group.save();

      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'username avatar')
        .populate('sharedPostId');

      // Broadcast to all group members via Socket
      group.members.forEach(mId => {
        sendDirectMessage(String(mId), populatedMessage);
      });

      return res.status(201).json(populatedMessage);
    }

    // Handle Group Creation legacy / fallback
    if (groupName || (Array.isArray(receiverIds) && receiverIds.length > 1)) {
      const finalMembers = new Set([currentUserId, ...(receiverIds || []), ...(receiverId ? [receiverId] : [])]);
      const membersArray = Array.from(finalMembers);

      const newGroup = new Group({
        name: groupName || 'Group Chat',
        creator: currentUserId,
        members: membersArray,
        lastMessage: text || `Group created: ${groupName || 'Group Chat'} 👥`,
        updatedAt: new Date()
      });
      await newGroup.save();

      const initialMessage = new Message({
        sender: currentUserId,
        group: newGroup._id,
        isGroup: true,
        text: text || `Group created: ${groupName || 'Group Chat'} 👥`,
        messageType: 'text'
      });
      await initialMessage.save();

      const populatedMessage = await Message.findById(initialMessage._id)
        .populate('sender', 'username avatar');

      membersArray.forEach(mId => {
        sendDirectMessage(String(mId), populatedMessage);
      });

      return res.status(201).json(populatedMessage);
    }

    // Single Direct Message (1-to-1)
    const targetId = receiverId || (Array.isArray(receiverIds) && receiverIds[0]);
    if (!targetId) return res.status(400).json({ error: 'Recipient ID is required.' });

    const messageContent = text || '';
    const newMessage = new Message({
      sender: currentUserId,
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
      sender: currentUserId,
      type: 'message',
      text: `sent you a message: "${messageContent.substring(0, 30)}"`
    });
    await notif.save();

    Notification.findById(notif._id).populate('sender', 'username avatar').then(popNotif => {
      sendNotification(targetId, popNotif);
    });

    res.status(201).json(populatedMessage);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;
