const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_spotlite_key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spotlite_db';

// Middleware
// Increase limit to handle Base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB (serverless-safe cached connection)
let isConnected = false;

async function seedAdmin() {
  try {
    const adminUsername = 'admin';
    const adminEmail = 'admin@spotlite.com';
    const adminPassword = 'prudhvi';

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const existingAdmin = await User.findOne({ username: adminUsername });
    if (!existingAdmin) {
      const adminUser = new User({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        bio: 'Spotlite Administrator',
        isAdmin: true,
        isVerified: true
      });
      await adminUser.save();
      console.log('Default administrator account created successfully.');
    } else {
      // Ensure the admin account has isAdmin set to true and update the password
      existingAdmin.password = hashedPassword;
      existingAdmin.isAdmin = true;
      existingAdmin.isVerified = true;
      await existingAdmin.save();
      console.log('Administrator account credentials updated successfully.');
    }
  } catch (err) {
    console.error('Failed to seed admin account:', err.message);
  }
}

async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 20000,
    });
    isConnected = true;
    console.log('Connected to MongoDB successfully.');
    await seedAdmin();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
}

// Middleware to ensure DB is connected on every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed.' });
  }
});

// --- MODELS ---

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' }, // base64 or url
  bio: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  githubUrl: { type: String, default: '' },
  techStack: [{ type: String }],
  spotlightMode: { type: Boolean, default: false },
  badge: { type: String, default: '' },
  refreshToken: { type: String, default: '' },
  bioLink: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String, default: '' },
  verificationCodeExpires: { type: Date },
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  profileTheme: { type: String, default: 'gold' }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// Post Schema
const PostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: { type: String, required: true }, // base64 image data
  caption: { type: String, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  shares: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  mood: { type: String, default: '' }, // Happy, Travel, Study, Fitness, Coding
  isPinned: { type: Boolean, default: false },
  hashtags: [{ type: String }]
}, { timestamps: true });

const Post = mongoose.model('Post', PostSchema);

// Message Schema
const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  sharedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // 'like', 'comment', 'follow', 'mention', 'message', 'qa'
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  text: { type: String, default: '' },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

const Notification = mongoose.model('Notification', NotificationSchema);

// Anonymous Q&A Schema
const QuestionSchema = new mongoose.Schema({
  profileOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  answer: { type: String, default: '' },
  isAnswered: { type: Boolean, default: false }
}, { timestamps: true });

const Question = mongoose.model('Question', QuestionSchema);

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// Rate limiting map & middleware
const authLimiterMap = new Map();
const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const limitWindow = 15 * 60 * 1000; // 15 mins
  const maxRequests = 100; // max 100 attempts in 15 mins

  if (!authLimiterMap.has(ip)) {
    authLimiterMap.set(ip, []);
  }

  const timestamps = authLimiterMap.get(ip).filter(t => now - t < limitWindow);
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  timestamps.push(now);
  authLimiterMap.set(ip, timestamps);
  next();
};

// Custom HTML Email Template Generator for Spotlite
function buildCustomEmailHTML(username, code) {
  const digits = (code || '000000').toString().split('');
  const digitHTML = digits.map(d => `
    <td align="center" style="padding: 0 4px;">
      <div style="width: 44px; height: 56px; line-height: 56px; font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 30px; font-weight: 900; color: #ffffff; background: linear-gradient(180deg, #222536 0%, #151724 100%); border: 1.5px solid #ffd700; border-radius: 12px; box-shadow: 0 4px 14px rgba(255, 215, 0, 0.2); text-shadow: 0 0 12px rgba(255, 215, 0, 0.6);">
        ${d}
      </div>
    </td>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotlite Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08090d; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e0e0e0; -webkit-font-smoothing: antialiased;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background: #0f111a; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255, 215, 0, 0.2); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);">
    
    <!-- HEADER BRANDING -->
    <tr>
      <td align="center" style="padding: 40px 20px 30px 20px; background: linear-gradient(135deg, #161927 0%, #0a0b12 100%); border-bottom: 2px solid #ffd700;">
        <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%); border-radius: 16px; font-size: 28px; box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); margin-bottom: 12px;">
          ✨
        </div>
        <div style="font-size: 34px; font-weight: 900; letter-spacing: 2px; color: #ffffff; text-shadow: 0 0 15px rgba(255, 215, 0, 0.3);">
          <span style="color: #ffd700;">SPOT</span>LITE
        </div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #8f93a8; text-transform: uppercase; letter-spacing: 3px; font-weight: 700;">Showcase • Connect • Elevate</p>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td style="padding: 45px 35px 35px 35px;">
        <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 24px; font-weight: 800; text-align: center; letter-spacing: -0.5px;">
          Welcome to Spotlite, <span style="color: #ffd700;">${username}</span>! 🚀
        </h2>
        
        <p style="margin: 0 0 30px 0; color: #9da2b8; font-size: 15px; line-height: 1.6; text-align: center;">
          We're thrilled to have you! Enter the 6-digit verification code below to activate your account and start sharing your talent with the world.
        </p>

        <!-- DIGIT CARDS CONTAINER -->
        <div style="background: linear-gradient(145deg, #161824, #0d0e17); border: 1px solid #282b3d; border-radius: 16px; padding: 30px 20px; margin: 30px 0; text-align: center; box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5);">
          <div style="font-size: 12px; font-weight: 700; color: #ffd700; text-transform: uppercase; letter-spacing: 2.5px; margin-bottom: 20px;">
            Security Verification Code
          </div>
          
          <!-- DIGITS TABLE -->
          <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              ${digitHTML}
            </tr>
          </table>

          <div style="margin-top: 22px; font-size: 13px; color: #ff6b6b; font-weight: 600;">
            ⏱ Code expires in <strong>15 minutes</strong>
          </div>
        </div>

        <!-- SECURITY NOTICE CARD -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
          <tr>
            <td style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 12px; padding: 18px 20px; border-left: 4px solid #00f2fe;">
              <p style="margin: 0; font-size: 13px; color: #b4b9cc; line-height: 1.5;">
                <strong style="color: #00f2fe;">🛡 Security Warning:</strong> Never share this code with anyone. Spotlite support staff will never ask for your verification code or login password.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td align="center" style="padding: 30px 25px; background-color: #090a10; border-top: 1px solid #1a1c29; font-size: 12px; color: #64687d;">
        <p style="margin: 0 0 10px 0; color: #8e92a6; font-weight: 600; font-size: 13px;">Spotlite Platform • Connect & Showcase</p>
        <p style="margin: 0 0 15px 0; line-height: 1.5;">If you did not request a verification code from Spotlite, please ignore this email.</p>
        <p style="margin: 0; font-size: 11px; color: #494c5e;">&copy; ${new Date().getFullYear()} Spotlite Inc. All rights reserved.</p>
      </td>
    </tr>

  </table>
</body>
</html>
  `;
}


// Helper to send verification email via nodemailer/SMTP or EmailJS or fallback to Console logging
async function sendVerificationEmail(username, email, code) {
  console.log(`\n======================================================`);
  console.log(`[MAIL VERIFICATION] To: ${username} (${email})`);
  console.log(`[MAIL VERIFICATION] Code: ${code}`);
  console.log(`======================================================\n`);

  const htmlContent = buildCustomEmailHTML(username, code);
  const textContent = `Hello ${username},\n\nYour Spotlite verification code is: ${code}\n\nThis code will expire in 15 minutes.`;

  // 1. Try Nodemailer / SMTP first if configured
  const smtpUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
  const smtpPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim().replace(/\s+/g, '') : '';
  const smtpHost = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : 'smtp.gmail.com';

  if (smtpUser !== '' && smtpPass !== '') {
    try {
      const nodemailer = require('nodemailer');
      
      let transportConfig;
      if (smtpHost === 'smtp.gmail.com' || smtpUser.endsWith('@gmail.com')) {
        transportConfig = {
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, // SSL
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: false
          }
        };
      } else {
        const port = parseInt(process.env.SMTP_PORT) || 465;
        transportConfig = {
          host: smtpHost,
          port: port,
          secure: port === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: false
          }
        };
      }

      const transporter = nodemailer.createTransport(transportConfig);
      const fromAddress = process.env.SMTP_FROM || `"Spotlite Support" <${smtpUser}>`;

      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject: `✨ ${code} is your Spotlite verification code`,
        text: textContent,
        html: htmlContent
      });

      console.log(`[SMTP SUCCESS] Custom verification email sent successfully to ${email}`);
      return { success: true, provider: 'SMTP' };
    } catch (err) {
      console.error(`[SMTP ERROR] Failed to send email via SMTP to ${email}:`, err.message);
      var lastSmtpError = err.message;
    }
  }

  // 2. Try EmailJS second if configured with valid non-dummy keys
  const emailJsService = process.env.EMAILJS_SERVICE_ID ? process.env.EMAILJS_SERVICE_ID.trim() : '';
  const emailJsTemplate = process.env.EMAILJS_TEMPLATE_ID ? process.env.EMAILJS_TEMPLATE_ID.trim() : '';
  const emailJsPublic = process.env.EMAILJS_PUBLIC_KEY ? process.env.EMAILJS_PUBLIC_KEY.trim() : '';

  if (emailJsService !== '' && emailJsTemplate !== '' && emailJsPublic !== '' && !emailJsService.includes('service_2q05aqi')) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: emailJsService,
          template_id: emailJsTemplate,
          user_id: emailJsPublic,
          accessToken: process.env.EMAILJS_PRIVATE_KEY || undefined,
          template_params: {
            to_name: username,
            email: email,
            reply_to: 'support@spotlite.com',
            passcode: code,
            time: '15 minutes',
            message: `Hello ${username}, your Spotlite verification code is: ${code}.`
          }
        })
      });

      if (response.ok) {
        console.log(`[EMAILJS SUCCESS] Verification email sent to ${email} successfully via EmailJS.`);
        return { success: true, provider: 'EmailJS' };
      } else {
        const text = await response.text();
        console.error('[EMAILJS ERROR] EmailJS send failed:', text);
      }
    } catch (err) {
      console.error('[EMAILJS ERROR] Failed to send verification email via EmailJS:', err.message);
    }
  }

  // 3. Fallback notice if SMTP / EmailJS is not configured
  console.warn(`\n[MAIL NOTICE] Real email dispatch was skipped because SMTP_USER / SMTP_PASS are empty in .env.`);
  console.warn(`To receive REAL emails to your inbox:`);
  console.warn(`  1. Open .env file`);
  console.warn(`  2. Set SMTP_USER=your_gmail@gmail.com`);
  console.warn(`  3. Set SMTP_PASS=your_16_char_google_app_password`);
  console.warn(`  4. Restart server!\n`);

  return { success: false, reason: (typeof lastSmtpError !== 'undefined' && lastSmtpError) ? lastSmtpError : 'SMTP credentials not set in .env' };
}


// Helper to generate access and refresh tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user._id, username: user.username, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

// 1. Register
app.post('/api/auth/register', rateLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ username: cleanUsername }, { email: cleanEmail }] 
    });

    if (existingUser) {
      if (!existingUser.isVerified) {
        // Delete the unverified user to release the username/email
        await User.deleteOne({ _id: existingUser._id });
      } else {
        return res.status(400).json({ error: 'Username or email already in use.' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const defaultAvatar = `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${cleanUsername}`;

    // Generate a 6-digit random code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const user = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      avatar: defaultAvatar,
      isVerified: false,
      verificationCode,
      verificationCodeExpires
    });

    await user.save();

    // Send verification email
    const mailResult = await sendVerificationEmail(cleanUsername, cleanEmail, verificationCode);

    res.status(201).json({
      message: 'Verification code sent to your email.',
      email: cleanEmail,
      devCode: (mailResult && mailResult.success) ? undefined : verificationCode
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// 2. Login
app.post('/api/auth/login', rateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });

    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    if (!user.isVerified) {
      // Re-generate code for unverified login attempt
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.verificationCode = newCode;
      user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      // Send code
      const mailResult = await sendVerificationEmail(user.username, user.email, newCode);

      return res.status(400).json({
        error: 'Your email address is not verified. A new verification code has been sent to your email.',
        emailUnverified: true,
        email: user.email,
        devCode: (mailResult && mailResult.success) ? undefined : newCode
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        isAdmin: user.isAdmin,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        githubUrl: user.githubUrl,
        techStack: user.techStack,
        spotlightMode: user.spotlightMode,
        badge: user.badge,
        bioLink: user.bioLink,
        profileTheme: user.profileTheme
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// 2a. Verify Email
app.post('/api/auth/verify-email', rateLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ error: 'User with this email address does not exist.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'This account is already verified. Please log in.' });
    }

    // Verify code and expiry
    if (!user.verificationCode || user.verificationCode !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (new Date() > user.verificationCodeExpires) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Mark as verified
    user.isVerified = true;
    user.verificationCode = '';
    user.verificationCodeExpires = undefined;

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        isAdmin: user.isAdmin,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        githubUrl: user.githubUrl,
        techStack: user.techStack,
        spotlightMode: user.spotlightMode,
        badge: user.badge,
        bioLink: user.bioLink,
        profileTheme: user.profileTheme
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

// 2b. Resend Verification Code
app.post('/api/auth/resend-code', rateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({ error: 'User with this email address does not exist.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'This account is already verified. Please log in.' });
    }

    // Generate new code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = newCode;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Send email
    const mailResult = await sendVerificationEmail(user.username, cleanEmail, newCode);

    res.json({ 
      message: 'A new verification code has been sent to your email.',
      devCode: (mailResult && mailResult.success) ? undefined : newCode
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    res.status(500).json({ error: 'Internal server error during resending.' });
  }
});

// 2c. Cancel Registration
app.post('/api/auth/cancel-registration', rateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user && !user.isVerified) {
      await User.deleteOne({ _id: user._id });
      console.log(`Cancelled registration and deleted unverified user: ${cleanEmail}`);
    }

    res.json({ message: 'Registration cancelled.' });
  } catch (error) {
    console.error('Cancel registration error:', error);
    res.status(500).json({ error: 'Internal server error during cancellation.' });
  }
});

// 2c-2. Test Custom Email
app.post('/api/auth/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Target email address is required.' });
    }

    const testCode = Math.floor(100000 + Math.random() * 900000).toString();
    const result = await sendVerificationEmail('TestUser', email.trim().toLowerCase(), testCode);

    if (result && result.success) {
      return res.json({
        message: `Custom HTML email sent successfully to ${email} via ${result.provider}!`,
        provider: result.provider,
        codeSent: testCode
      });
    } else {
      return res.status(400).json({
        error: 'Email delivery failed.',
        reason: result ? result.reason : 'SMTP or EmailJS not configured properly.',
        instructions: 'Please configure SMTP_USER and SMTP_PASS (Gmail App Password) in your .env file.'
      });
    }
  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ error: err.message });
  }
});


// 2d. Refresh Token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired refresh token.' });

      const user = await User.findById(decoded.id);
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(403).json({ error: 'Invalid refresh token.' });
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
      user.refreshToken = newRefreshToken;
      await user.save();

      res.json({
        token: accessToken,
        refreshToken: newRefreshToken
      });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error during token refresh.' });
  }
});

// 3. Get Current User Details
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      isAdmin: user.isAdmin,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      following: user.following,
      githubUrl: user.githubUrl,
      techStack: user.techStack,
      spotlightMode: user.spotlightMode,
      badge: user.badge,
      bioLink: user.bioLink,
      profileTheme: user.profileTheme
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user profile.' });
  }
});

// 4. Update Profile
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { bio, avatar, username, githubUrl, techStack, spotlightMode, badge, bioLink, profileTheme } = req.body;
    const updateData = {};

    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (githubUrl !== undefined) updateData.githubUrl = githubUrl;
    if (techStack !== undefined) updateData.techStack = techStack;
    if (spotlightMode !== undefined) updateData.spotlightMode = spotlightMode;
    if (badge !== undefined) updateData.badge = badge;
    if (bioLink !== undefined) updateData.bioLink = bioLink;
    if (profileTheme !== undefined) updateData.profileTheme = profileTheme;

    if (username) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername !== req.user.username) {
        const usernameExists = await User.findOne({ username: cleanUsername });
        if (usernameExists) {
          return res.status(400).json({ error: 'Username is already taken.' });
        }
        updateData.username = cleanUsername;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    );

    res.json({
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      bio: updatedUser.bio,
      followersCount: updatedUser.followers.length,
      followingCount: updatedUser.following.length,
      githubUrl: updatedUser.githubUrl,
      techStack: updatedUser.techStack,
      spotlightMode: updatedUser.spotlightMode,
      badge: updatedUser.badge,
      bioLink: updatedUser.bioLink,
      profileTheme: updatedUser.profileTheme
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Error updating profile.' });
  }
});

// 5. Get User Profile by Username (Public/Private Feed access)
app.get('/api/users/profile/:username', async (req, res) => {
  try {
    const cleanUsername = req.params.username.toLowerCase();
    const user = await User.findOne({ username: cleanUsername })
      .populate('followers', 'username avatar bio')
      .populate('following', 'username avatar bio');
      
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followers: user.followers,
      following: user.following,
      githubUrl: user.githubUrl,
      techStack: user.techStack,
      spotlightMode: user.spotlightMode,
      badge: user.badge,
      bioLink: user.bioLink,
      profileTheme: user.profileTheme
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching profile.' });
  }
});

// 6. Follow/Unfollow User
app.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ error: 'You cannot follow yourself.' });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentUser.following.pull(targetUserId);
      targetUser.followers.pull(currentUserId);
    } else {
      // Follow
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);

      // Create notification
      const notif = new Notification({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'follow',
        text: 'started following you'
      });
      await notif.save();
    }

    await currentUser.save();
    await targetUser.save();

    res.json({
      following: !isFollowing,
      followersCount: targetUser.followers.length,
      followingCount: targetUser.following.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Error handling follow action.' });
  }
});

// 7. Get All Users (for suggestions)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUser = await User.findById(currentUserId);
    const suggestions = await User.find({
      _id: { $ne: currentUserId, $nin: currentUser.following }
    })
    .select('username avatar bio')
    .limit(5);

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching suggestions.' });
  }
});

// 7b. Get ALL Users for share/search (no follow filter, no limit)
app.get('/api/users/all', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const allUsers = await User.find({ _id: { $ne: currentUserId } })
      .select('username avatar bio _id')
      .sort({ username: 1 });
    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching users.' });
  }
});

// 8. Create Post
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { image, caption, mood } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required.' });
    }

    const currentUser = await User.findById(req.user.id);
    if (currentUser.spotlightMode) {
      const startOfToday = new Date();
      startOfToday.setHours(0,0,0,0);
      const postsToday = await Post.countDocuments({
        author: req.user.id,
        createdAt: { $gte: startOfToday }
      });
      if (postsToday >= 1) {
        return res.status(400).json({ error: 'Spotlight Mode is active. You can only share 1 post per day!' });
      }
    }

    // Parse hashtags
    const hashtags = [];
    if (caption) {
      const foundTags = caption.match(/#(\w+)/g);
      if (foundTags) {
        foundTags.forEach(t => {
          const tag = t.replace('#', '').toLowerCase();
          if (!hashtags.includes(tag)) hashtags.push(tag);
        });
      }
    }

    const post = new Post({
      author: req.user.id,
      image,
      caption: caption || '',
      mood: mood || '',
      hashtags
    });

    await post.save();
    
    // Create notifications for mentions
    if (caption) {
      const mentions = caption.match(/@(\w+)/g);
      if (mentions) {
        for (let mention of mentions) {
          const mentionedUsername = mention.replace('@', '').toLowerCase();
          const mentionedUser = await User.findOne({ username: mentionedUsername });
          if (mentionedUser && mentionedUser._id.toString() !== req.user.id) {
            const notif = new Notification({
              recipient: mentionedUser._id,
              sender: req.user.id,
              type: 'mention',
              post: post._id,
              text: 'mentioned you in a post'
            });
            await notif.save();
          }
        }
      }
    }

    const populatedPost = await post.populate('author', 'username avatar');
    res.status(201).json(populatedPost);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: 'Error creating post.' });
  }
});

// 9. Get Feed Posts (for the current user's feed)
app.get('/api/posts', authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
        return res.status(404).json({ error: 'User not found.' });
    }

    // Create a list of user IDs to fetch posts from: the user themselves and the people they follow.
    const userIds = [...currentUser.following, currentUser._id];

    const posts = await Post.find({ author: { $in: userIds } })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50); // Add a limit to avoid sending too much data

    res.json(posts);
  } catch (error) {
    console.error('Fetch feed posts error:', error);
    res.status(500).json({ error: 'Error fetching posts.' });
  }
});

// 10. Get Posts of Specific User
app.get('/api/posts/user/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const posts = await Post.find({ author: user._id })
      .populate('author', 'username avatar')
      .sort({ isPinned: -1, createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user posts.' });
  }
});

// NEW ENDPOINT: Get Saved Posts
app.get('/api/posts/saved', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const posts = await Post.find({ _id: { $in: user.savedPosts } })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch saved posts.' });
  }
});

// NEW ENDPOINT: Get a single post by ID
app.get('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('comments.user', 'username avatar'); // Also populate comment authors

    if (!post) return res.status(404).json({ error: 'Post not found.' });

    res.json(post);
  } catch (error) {
    console.error(`Fetch post ${req.params.id} error:`, error);
    res.status(500).json({ error: 'Error fetching post.' });
  }
});


// 11. Like/Unlike Post
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const userId = req.user.id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
      // Notify post author
      if (post.author.toString() !== userId) {
        const notif = new Notification({
          recipient: post.author,
          sender: userId,
          type: 'like',
          post: post._id,
          text: 'liked your post'
        });
        await notif.save();
      }
    }

    await post.save();
    res.json({ liked: !isLiked, likesCount: post.likes.length });
  } catch (error) {
    res.status(500).json({ error: 'Error liking post.' });
  }
});

// NEW ENDPOINT: Share Post (tracks share count)
app.post('/api/posts/:id/share', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    // Track which users shared to prevent one user from bumping the count multiple times.
    const userId = req.user.id;
    if (!post.shares.includes(userId)) {
      post.shares.push(userId);
      await post.save();
    }

    res.json({ sharesCount: post.shares.length });
  } catch (error) {
    res.status(500).json({ error: 'Error sharing post.' });
  }
});

// NEW ENDPOINT: Save/Bookmark Post
app.post('/api/posts/:id/save', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isSaved = user.savedPosts.includes(post._id);
    if (isSaved) {
      user.savedPosts.pull(post._id);
    } else {
      user.savedPosts.push(post._id);
    }
    await user.save();

    res.json({ saved: !isSaved });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save post.' });
  }
});
// 12. Add Comment to Post
app.post('/api/posts/:id/comment', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = {
      user: req.user.id,
      username: req.user.username,
      text: text.trim(),
      createdAt: new Date()
    };

    post.comments.push(comment);
    await post.save();

    // Notify post author
    if (post.author.toString() !== req.user.id) {
      const notif = new Notification({
        recipient: post.author,
        sender: req.user.id,
        type: 'comment',
        post: post._id,
        text: `commented: "${text.trim().substring(0, 30)}${text.trim().length > 30 ? '...' : ''}"`
      });
      await notif.save();
    }

    // Parse mentions
    const mentions = text.match(/@(\w+)/g);
    if (mentions) {
      for (let mention of mentions) {
        const mentionedUsername = mention.replace('@', '').toLowerCase();
        const mentionedUser = await User.findOne({ username: mentionedUsername });
        if (mentionedUser && mentionedUser._id.toString() !== req.user.id) {
          const notif = new Notification({
            recipient: mentionedUser._id,
            sender: req.user.id,
            type: 'mention',
            post: post._id,
            text: 'mentioned you in a comment'
          });
          await notif.save();
        }
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Error adding comment.' });
  }
});

// 13. Search Users by Username
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim() === '') {
      return res.json([]);
    }
    const users = await User.find({
      username: { $regex: query.trim(), $options: 'i' },
      _id: { $ne: req.user.id }
    }).select('username avatar bio').limit(10);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Search failed.' });
  }
});

// 14. Send Direct Message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { receiverId, text, sharedPostId } = req.body;
    if (!receiverId || (!text && !sharedPostId)) {
      return res.status(400).json({ error: 'Receiver and message content are required.' });
    }
    const message = new Message({
      sender: req.user.id,
      receiver: receiverId,
      text: text ? text.trim() : '📸 Shared a post',
      sharedPostId: sharedPostId || undefined
    });
    await message.save();

    // Create notification
    const notif = new Notification({
      recipient: receiverId,
      sender: req.user.id,
      type: 'message',
      text: text ? `sent you a message: "${text.trim().substring(0, 30)}${text.trim().length > 30 ? '...' : ''}"` : 'shared a post with you'
    });
    await notif.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// 15. Get Message History with a User
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const currentUserId = req.user.id;
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId }
      ]
    })
    .populate({
      path: 'sharedPostId',
      populate: { path: 'author', select: 'username avatar' }
    })
    .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get messages.' });
  }
});

// 16. Get Active Conversations List (Optimized with Aggregation)
app.get('/api/messages/conversations/list', authenticateToken, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.id);

    const conversations = await Message.aggregate([
      // Match messages sent or received by the current user
      { $match: { $or: [{ sender: currentUserId }, { receiver: currentUserId }] } },
      // Sort by creation time to get the latest message first
      { $sort: { createdAt: -1 } },
      // Group by conversation partner
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$sender", currentUserId] },
              then: "$receiver",
              else: "$sender"
            }
          },
          lastMessage: { $first: "$text" },
          lastMessageTime: { $first: "$createdAt" }
        }
      },
      // Sort conversations by the last message time
      { $sort: { lastMessageTime: -1 } },
      // Lookup user details for the conversation partner
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      // Deconstruct the user array
      { $unwind: '$user' },
      // Project the final fields
      {
        $project: {
          _id: 0,
          user: { _id: '$user._id', username: '$user.username', avatar: '$user.avatar', bio: '$user.bio' },
          lastMessage: 1,
          lastMessageTime: 1
        }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Fetch conversations list error:', error);
    res.status(500).json({ error: 'Failed to load conversations.' });
  }
});

// 17. Change Password
app.put('/api/users/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Incorrect old password.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// 18. Delete Post
app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    // Verify ownership or admin access
    if (post.author.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this post.' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// 19. Edit Post Caption
app.put('/api/posts/:id', authenticateToken, async (req, res) => {
  try {
    const { caption } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    // Verify ownership
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to edit this post.' });
    }

    post.caption = caption || '';
    await post.save();
    
    const populatedPost = await post.populate('author', 'username avatar');
    res.json(populatedPost);
  } catch (error) {
    res.status(500).json({ error: 'Failed to edit post.' });
  }
});

// 20. Delete Comment
app.delete('/api/posts/:postId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    // Authorized if user is the comment author, post owner, or admin
    if (comment.user.toString() !== req.user.id && post.author.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment.' });
    }

    post.comments.pull(req.params.commentId);
    await post.save();

    res.json({ message: 'Comment deleted successfully.', commentsCount: post.comments.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

// 22. Delete User Account (Admin Only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the main admin account.' });
    }
    
    // Delete all posts by this user
    await Post.deleteMany({ author: req.params.id });
    
    // Remove user account
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User account and all associated posts deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user account.' });
  }
});

// 21. Edit Comment
app.put('/api/posts/:postId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Comment text is required.' });
    }

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    // Only comment author can edit comment
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to edit this comment.' });
    }

    comment.text = text.trim();
    await post.save();

    res.json({ message: 'Comment updated successfully.', comment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to edit comment.' });
  }
});

// --- NEW ENDPOINTS ---

// A. Get notifications for the logged-in user
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'username avatar')
      .populate('post', '_id image')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// B. Get unread notifications count
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.id, isRead: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread notifications count.' });
  }
});

// C. Mark notifications as read
app.post('/api/notifications/mark-read', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, isRead: false }, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
});

// D. Send anonymous question to user
app.post('/api/qa/ask/:userId', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    const question = new Question({
      profileOwner: req.params.userId,
      text: text.trim()
    });
    await question.save();

    // Notify the profile owner (use themselves as sender placeholder)
    const notif = new Notification({
      recipient: req.params.userId,
      sender: req.params.userId, 
      type: 'qa',
      text: 'received an anonymous question'
    });
    await notif.save();

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: 'Failed to ask question.' });
  }
});

// E. Get questions for a user
app.get('/api/qa/:userId', async (req, res) => {
  try {
    let isOwner = false;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.id === req.params.userId) {
          isOwner = true;
        }
      } catch (e) {}
    }

    let query = { profileOwner: req.params.userId };
    if (!isOwner) {
      query.isAnswered = true;
    }

    const questions = await Question.find(query).sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve questions.' });
  }
});

// F. Answer a question (Profile owner only)
app.post('/api/qa/answer/:questionId', authenticateToken, async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer || answer.trim() === '') {
      return res.status(400).json({ error: 'Answer is required.' });
    }

    const question = await Question.findById(req.params.questionId);
    if (!question) return res.status(404).json({ error: 'Question not found.' });

    if (question.profileOwner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to answer this question.' });
    }

    question.answer = answer.trim();
    question.isAnswered = true;
    await question.save();

    res.json(question);
  } catch (error) {
    res.status(500).json({ error: 'Failed to answer question.' });
  }
});

// G. Pin/Unpin Post (Post owner only)
app.post('/api/posts/:id/pin', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to pin this post.' });
    }

    if (!post.isPinned) {
      const pinnedCount = await Post.countDocuments({ author: req.user.id, isPinned: true });
      if (pinnedCount >= 3) {
        return res.status(400).json({ error: 'You can only pin up to 3 posts.' });
      }
    }

    post.isPinned = !post.isPinned;
    await post.save();

    res.json({ isPinned: post.isPinned });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pin post.' });
  }
});

// H. Get posts by hashtag
app.get('/api/posts/hashtag/:hashtag', authenticateToken, async (req, res) => {
  try {
    const tag = req.params.hashtag.toLowerCase().trim();
    const posts = await Post.find({ hashtags: tag })
      .populate('author', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts for hashtag.' });
  }
});

// I. Get trending hashtags
app.get('/api/posts/trending-tags', authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ hashtags: { $exists: true, $ne: [] } }).select('hashtags');
    const tagCounts = {};
    posts.forEach(post => {
      post.hashtags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const trending = Object.keys(tagCounts)
      .map(tag => ({ tag, count: tagCounts[tag] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json(trending);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending tags.' });
  }
});

// Front-end SPA support - Serve HTML files dynamically or fallback
app.use((req, res) => {
  // If request is for an API route that wasn't matched, send JSON 404
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Spotlite server running on: http://localhost:${PORT}`);
  });
}

module.exports = app;
