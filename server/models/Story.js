const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  image: { type: String, required: true },
  caption: { type: String, default: '' },
  viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    index: { expires: 0 } // TTL index for automatic deletion after 24 hours
  }
}, { timestamps: true });

module.exports = mongoose.models.Story || mongoose.model('Story', StorySchema);
