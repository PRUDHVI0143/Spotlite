const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  coverPhoto: { type: String, default: '' },
  bio: { type: String, default: '', maxLength: 150 },
  website: { type: String, default: '' },
  github: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  pinnedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  spotlightMode: { type: Boolean, default: false },
  isPrivate: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
