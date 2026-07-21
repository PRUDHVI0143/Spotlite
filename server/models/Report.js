const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.models.Report || mongoose.model('Report', ReportSchema);
