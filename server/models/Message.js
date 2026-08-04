const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true },
  isGroup: { type: Boolean, default: false },
  text: { type: String, default: '' },
  audioUrl: { type: String, default: '' },
  fileUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileType: { type: String, default: '' },
  messageType: { type: String, default: 'text' }, // 'text', 'audio', 'image', 'video', 'file', 'post'
  sharedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
