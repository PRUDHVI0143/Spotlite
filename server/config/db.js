const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotlite_db';
  try {
    const db = await mongoose.connect(mongoURI);
    isConnected = db.connections[0].readyState === 1;
    console.log('MongoDB Connected successfully.');
  } catch (err) {
    console.error('MongoDB Connection error:', err);
  }
}

module.exports = connectDB;
