const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getIO } = require('../socket');

// In-memory call signaling queue for serverless fallback
const callSignalsMap = new Map();

// Helper to push signal to queue
function pushSignal(recipientId, signalData) {
  const strId = String(recipientId);
  if (!callSignalsMap.has(strId)) {
    callSignalsMap.set(strId, []);
  }
  const queue = callSignalsMap.get(strId);
  queue.push({
    ...signalData,
    timestamp: Date.now()
  });
  // Keep queue size manageable
  if (queue.length > 50) queue.shift();
}

// 1. Send Call Signal (Offer, Answer, ICE candidate, End, Reject)
router.post('/signal', authenticateToken, (req, res) => {
  try {
    const { recipientId, type, offer, answer, candidate, callType, callerInfo } = req.body;
    if (!recipientId || !type) {
      return res.status(400).json({ error: 'recipientId and signal type are required.' });
    }

    const senderId = req.user.id;
    const signalData = {
      senderId,
      recipientId,
      type,
      offer,
      answer,
      candidate,
      callType,
      callerInfo,
      createdAt: new Date()
    };

    // Store signal in fallback queue
    pushSignal(recipientId, signalData);

    // Also attempt Socket.io broadcast if available
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
      // Socket not active or serverless, REST queue handles it
    }

    res.json({ success: true, message: 'Signal queued successfully.' });
  } catch (err) {
    console.error('Call signal error:', err);
    res.status(500).json({ error: 'Failed to send signal.' });
  }
});

// 2. Poll Call Signals (For Serverless Fallback)
router.get('/signals', authenticateToken, (req, res) => {
  try {
    const userId = String(req.user.id);
    const queue = callSignalsMap.get(userId) || [];
    
    // Filter out signals older than 2 minutes
    const now = Date.now();
    const activeSignals = queue.filter(s => (now - s.timestamp) < 120000);

    // Clear queue after retrieval
    callSignalsMap.set(userId, []);

    res.json(activeSignals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to poll call signals.' });
  }
});

module.exports = router;
