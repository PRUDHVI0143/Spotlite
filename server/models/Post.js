const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  image: { type: String, required: true },
  caption: { type: String, default: '', maxLength: 2200 },
  mood: { type: String, default: '' },
  category: { type: String, default: 'General', index: true },
  location: { type: String, default: '' },
  filter: { type: String, default: 'none' },
  hashtags: [{ type: String, index: true }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  repostOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  repostComment: { type: String, default: '' },
  poll: {
    question: { type: String, default: '' },
    options: [{
      text: { type: String, required: true },
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }]
  },
  viewsCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

PostSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Post || mongoose.model('Post', PostSchema);
