const rateLimit = require('express-rate-limit');

// Strict rate limiter for authentication routes (login, signup, verification)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// General API rate limiter for write operations
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.'
  }
});

module.exports = {
  authLimiter,
  apiLimiter
};
