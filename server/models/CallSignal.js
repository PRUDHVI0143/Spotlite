const mongoose = require('mongoose');

const callSignalSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['offer', 'answer', 'ice', 'end', 'reject'],
    required: true
  },
  offer: { type: Object },
  answer: { type: Object },
  candidate: { type: Object },
  callType: { type: String, default: 'video' },
  callerInfo: {
    username: { type: String },
    avatar: { type: String }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Auto delete after 5 minutes
  }
});

module.exports = mongoose.model('CallSignal', callSignalSchema);
