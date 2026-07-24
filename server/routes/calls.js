const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const CallSignal = require('../models/CallSignal');
const CallHistory = require('../models/CallHistory');
const { getIO } = require('../socket');

// 1. Send Call Signal (Offer, Answer, ICE, End, Reject)
router.post('/signal', authenticateToken, async (req, res) => {
  try {
    const { recipientId, type, offer, answer, candidate, callType, callerInfo } = req.body;
    if (!recipientId || !type) {
      return res.status(400).json({ error: 'recipientId and type required.' });
    }

    const senderId = req.user.id || req.user._id;

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

    // Real-time Socket.io broadcast
    try {
      const io = getIO();
      if (io) {
        const socketEvents = {
          offer: 'incoming-call',
          answer: 'call-answered',
          ice: 'ice-candidate',
          end: 'call-ended',
          reject: 'call-rejected'
        };
        const event = socketEvents[type];
        if (event) {
          const payload = { callerId: senderId, senderId, offer, answer, candidate, callType, callerInfo };
          io.to(`user:${recipientId}`).emit(event, payload);
        }
      }
    } catch (e) { /* Socket unavailable - REST queue handles it */ }

    // Record call history for offer (new call)
    if (type === 'offer') {
      await CallHistory.create({ caller: senderId, callee: recipientId, callType: callType || 'video', status: 'ongoing' });
    }
    // Record status changes
    if (type === 'end' || type === 'reject') {
      const status = type === 'reject' ? 'rejected' : 'completed';
      const hist = await CallHistory.findOne({
        $or: [
          { caller: senderId, callee: recipientId },
          { caller: recipientId, callee: senderId }
        ],
        status: 'ongoing'
      }).sort({ startedAt: -1 });

      if (hist) {
        hist.status = status;
        hist.endedAt = new Date();
        hist.duration = Math.round((hist.endedAt - hist.startedAt) / 1000);
        await hist.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Call signal error:', err);
    res.status(500).json({ error: 'Signal failed.' });
  }
});

// 2. Poll pending signals (Serverless REST fallback)
router.get('/signals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const signals = await CallSignal.find({ recipient: userId }).sort({ createdAt: 1 });
    if (signals.length > 0) {
      await CallSignal.deleteMany({ _id: { $in: signals.map(s => s._id) } });
    }
    res.json(signals.map(s => ({
      senderId: s.sender.toString(),
      recipientId: s.recipient.toString(),
      type: s.type,
      offer: s.offer,
      answer: s.answer,
      candidate: s.candidate,
      callType: s.callType,
      callerInfo: s.callerInfo
    })));
  } catch (err) {
    res.status(500).json({ error: 'Poll failed.' });
  }
});

// 3. Get call history between two users
router.get('/history/:peerId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const peerId = req.params.peerId;
    const history = await CallHistory.find({
      $or: [
        { caller: userId, callee: peerId },
        { caller: peerId, callee: userId }
      ],
      status: { $ne: 'ongoing' }
    })
      .sort({ startedAt: -1 })
      .limit(50)
      .populate('caller callee', 'username avatar');

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get call history.' });
  }
});

module.exports = router;
