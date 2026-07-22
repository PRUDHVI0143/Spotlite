const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_spotlite_key';

// Helper to generate access and refresh tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user._id, username: user.username, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

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
<body style="margin: 0; padding: 0; background-color: #08090d; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e0e0e0;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background: #0f111a; border-radius: 20px; overflow: hidden; border: 1px solid rgba(255, 215, 0, 0.2); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);">
    <tr>
      <td align="center" style="padding: 40px 20px 30px 20px; background: linear-gradient(135deg, #161927 0%, #0a0b12 100%); border-bottom: 2px solid #ffd700;">
        <div style="font-size: 34px; font-weight: 900; letter-spacing: 2px; color: #ffffff;">
          <span style="color: #ffd700;">SPOT</span>LITE
        </div>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #8f93a8; text-transform: uppercase; letter-spacing: 3px; font-weight: 700;">Showcase • Connect • Elevate</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 45px 35px 35px 35px;">
        <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 24px; font-weight: 800; text-align: center;">
          Welcome to Spotlite, <span style="color: #ffd700;">${username}</span>! 🚀
        </h2>
        <p style="margin: 0 0 30px 0; color: #9da2b8; font-size: 15px; line-height: 1.6; text-align: center;">
          Enter the 6-digit verification code below to activate your account.
        </p>
        <div style="background: linear-gradient(145deg, #161824, #0d0e17); border: 1px solid #282b3d; border-radius: 16px; padding: 30px 20px; margin: 30px 0; text-align: center;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>${digitHTML}</tr>
          </table>
          <div style="margin-top: 22px; font-size: 13px; color: #ff6b6b; font-weight: 600;">
            ⏱ Code expires in <strong>15 minutes</strong>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Helper to send verification email via Nodemailer / SMTP if configured
async function sendVerificationEmail(username, email, code) {
  console.log(`\n======================================================`);
  console.log(`[MAIL VERIFICATION] To: ${username} (${email})`);
  console.log(`[MAIL VERIFICATION] Code: ${code}`);
  console.log(`======================================================\n`);

  const htmlContent = buildCustomEmailHTML(username, code);
  const textContent = `Hello ${username},\n\nYour Spotlite verification code is: ${code}\n\nThis code expires in 15 minutes.`;

  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || '';
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';

  if (smtpUser && smtpPass) {
    try {
      const nodemailer = require('nodemailer');
      const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
      
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Spotlite Support" <${smtpUser}>`,
        to: email,
        subject: `✨ ${code} is your Spotlite verification code`,
        text: textContent,
        html: htmlContent
      });

      console.log(`[SMTP SUCCESS] Verification email sent successfully to ${email}`);
      return { success: true };
    } catch (err) {
      console.error(`[SMTP ERROR] Failed to send email to ${email}:`, err.message);
    }
  }

  return { success: false, reason: 'SMTP credentials not configured' };
}

// 1. Register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ 
      $or: [{ username: cleanUsername }, { email: cleanEmail }] 
    });

    if (existingUser) {
      if (!existingUser.isVerified) {
        await User.deleteOne({ _id: existingUser._id });
      } else {
        return res.status(400).json({ error: 'Username or email already in use.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const defaultAvatar = `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${cleanUsername}`;
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

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

    // Send verification email via SMTP if configured
    await sendVerificationEmail(cleanUsername, cleanEmail, verificationCode);

    res.status(201).json({
      message: 'Account registered successfully. Verification code generated.',
      email: user.email,
      requiresVerification: true,
      verificationCode: verificationCode,
      devCode: verificationCode
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

const verifyHandler = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    const cleanIdentifier = String(email).trim().toLowerCase();
    const cleanInputCode = String(code).trim();

    const user = await User.findOne({ 
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }] 
    });

    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    if (user.isVerified) {
      const { accessToken, refreshToken } = generateTokens(user);
      user.refreshToken = refreshToken;
      await user.save();
      return res.json({ message: 'Account is already verified.', token: accessToken, refreshToken, user });
    }

    const storedCode = String(user.verificationCode || '').trim();

    console.log(`[VERIFY DEBUG] User: ${user.username} (${user.email}) | StoredCode: "${storedCode}" | InputCode: "${cleanInputCode}"`);

    if (!storedCode || storedCode !== cleanInputCode) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    if (user.verificationCodeExpires && user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    user.isVerified = true;
    user.verificationCode = '';
    user.verificationCodeExpires = null;
    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      message: 'Account verified successfully.',
      token: accessToken,
      refreshToken,
      user
    });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Failed to verify code.' });
  }
};

router.post('/verify', authLimiter, verifyHandler);
router.post('/verify-email', authLimiter, verifyHandler);

// 3. Resend Verification Code
router.post('/resend-code', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const cleanIdentifier = String(email).trim().toLowerCase();
    const user = await User.findOne({ 
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }] 
    });

    if (!user) return res.status(404).json({ error: 'User account not found.' });

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.username, user.email, verificationCode);

    res.json({ 
      message: 'Verification code resent successfully.', 
      verificationCode, 
      devCode: verificationCode 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resend code.' });
  }
});

// 4. Cancel Registration
router.post('/cancel-registration', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user && !user.isVerified) {
      await User.deleteOne({ _id: user._id });
    }
    res.json({ message: 'Registration cancelled.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel registration.' });
  }
});

// 5. Login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanUsername }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been banned.' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// 6. Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required.' });
    }

    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Invalid or expired refresh token.' });

      const user = await User.findById(decoded.id);
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(403).json({ error: 'Invalid refresh token.' });
      }

      const tokens = generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();

      res.json({ token: tokens.accessToken, refreshToken: tokens.refreshToken });
    });
  } catch (err) {
    res.status(500).json({ error: 'Refresh failed.' });
  }
});

// 7. Get Current User Me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshToken');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch current user.' });
  }
});

module.exports = router;
