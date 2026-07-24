const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const CallSignal = require('../models/CallSignal');
const { getIO } = require('../socket');

// 1. Send Call Signal (Offer, Answer, ICE candidate, End, Reject)
router.post('/signal', authenticateToken, async (req, res) => {
  try {
    const { recipientId, type, offer, answer, candidate, callType, callerInfo } = req.body;
    if (!recipientId || !type) {
      return res.status(400).json({ error: 'recipientId and signal type are required.' });
    }

    const senderId = req.user.id || req.user._id;

    // Persist signal in MongoDB for multi-instance Serverless compatibility
    const newSignal = new CallSignal({
      sender: senderId,
      recipient: recipientId,
      type,
      offer,
      answer,
      candidate,
      callType: callType || 'video',
      callerInfo: callerInfo || {}
    });

    await newSignal.save();

    // Also attempt real-time Socket.io broadcast if active
    try {
      const io = getIO();
      if (io) {
        if (type === 'offer') {
          io.to(`user:${recipientId}`).emit('incoming-call', { callerId: senderId, offer, callType, callerInfo });
        } else if (type === 'answer') {
          io.to(`user:${recipientId}`).emit('call-answered', { answer, answererId: senderId });
        } else if (type === 'ice') {
          io.to(`user:${recipientId}`).emit('ice-candidate', { candidate, senderId });
        } else if (type === 'end') {
          io.to(`user:${recipientId}`).emit('call-ended', { senderId });
        } else if (type === 'reject') {
          io.to(`user:${recipientId}`).emit('call-rejected', { senderId });
        }
      }
    } catch (e) {
      // Socket not active or serverless, MongoDB queue handles it
    }

    res.json({ success: true, message: 'Signal stored in database successfully.' });
  } catch (err) {
    console.error('Call signal database error:', err);
    res.status(500).json({ error: 'Failed to send call signal.' });
  }
});

// 2. Poll Pending Call Signals from MongoDB (Serverless Compatible)
router.get('/signals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    // Fetch pending signals for current user
    const pendingSignals = await CallSignal.find({ recipient: userId }).sort({ createdAt: 1 });

    if (pendingSignals.length > 0) {
      // Delete fetched signals so they are only processed once
      const idsToDelete = pendingSignals.map(s => s._id);
      await CallSignal.deleteMany({ _id: { $in: idsToDelete } });
    }

    // Format output
    const formatted = pendingSignals.map(s => ({
      senderId: s.sender.toString(),
      recipientId: s.recipient.toString(),
      type: s.type,
      offer: s.offer,
      answer: s.answer,
      candidate: s.candidate,
      callType: s.callType,
      callerInfo: s.callerInfo
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Poll signals error:', err);
    res.status(500).json({ error: 'Failed to fetch call signals.' });
  }
});

module.exports = router;
