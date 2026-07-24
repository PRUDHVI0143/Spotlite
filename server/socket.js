const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_spotlite_key';
let io = null;

// Map of userId -> Set of socketIds
const userSocketsMap = new Map();

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id || socket.user._id;

    if (userId) {
      if (!userSocketsMap.has(userId)) {
        userSocketsMap.set(userId, new Set());
      }
      userSocketsMap.get(userId).add(socket.id);
      
      // Join a private room for this user
      socket.join(`user:${userId}`);

      // Broadcast user online status
      io.emit('user_status', { userId, status: 'online' });
    }

    // Typing indicators
    socket.on('typing_start', ({ recipientId }) => {
      io.to(`user:${recipientId}`).emit('user_typing', { senderId: userId, typing: true });
    });

    socket.on('typing_stop', ({ recipientId }) => {
      io.to(`user:${recipientId}`).emit('user_typing', { senderId: userId, typing: false });
    });

    // WebRTC Real-Time Calling Signaling
    socket.on('call-user', ({ recipientId, offer, callType, callerInfo }) => {
      io.to(`user:${recipientId}`).emit('incoming-call', {
        callerId: userId,
        offer,
        callType,
        callerInfo
      });
    });

    socket.on('make-answer', ({ targetId, answer }) => {
      io.to(`user:${targetId}`).emit('call-answered', {
        answer,
        answererId: userId
      });
    });

    socket.on('ice-candidate', ({ targetId, candidate }) => {
      io.to(`user:${targetId}`).emit('ice-candidate', {
        candidate,
        senderId: userId
      });
    });

    socket.on('end-call', ({ targetId }) => {
      io.to(`user:${targetId}`).emit('call-ended', { senderId: userId });
    });

    socket.on('reject-call', ({ targetId }) => {
      io.to(`user:${targetId}`).emit('call-rejected', { senderId: userId });
    });

    socket.on('disconnect', () => {
      if (userId && userSocketsMap.has(userId)) {
        const userSockets = userSocketsMap.get(userId);
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketsMap.delete(userId);
          io.emit('user_status', { userId, status: 'offline' });
        }
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
}

// Helper to send real-time notification to a specific user
function sendNotification(recipientId, notificationData) {
  if (io) {
    io.to(`user:${recipientId}`).emit('new_notification', notificationData);
  }
}

// Helper to send direct message to a recipient
function sendDirectMessage(recipientId, messageData) {
  if (io) {
    io.to(`user:${recipientId}`).emit('new_message', messageData);
  }
}

module.exports = {
  initSocket,
  getIO,
  sendNotification,
  sendDirectMessage
};
