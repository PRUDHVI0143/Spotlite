const mongoose = require('mongoose');

const callHistorySchema = new mongoose.Schema({
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  callType: { type: String, enum: ['audio', 'video'], default: 'video' },
  status: { type: String, enum: ['completed', 'missed', 'rejected', 'ongoing'], default: 'ongoing' },
  duration: { type: Number, default: 0 }, // duration in seconds
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

module.exports = mongoose.model('CallHistory', callHistorySchema);
