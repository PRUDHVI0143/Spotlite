const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow', 'mention', 'message'],
    required: true
  },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  text: { type: String, default: '' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
