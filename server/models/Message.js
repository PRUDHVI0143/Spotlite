const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true },
  sharedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
