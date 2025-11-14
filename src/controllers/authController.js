// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const { Resend } = require('resend');
require('dotenv').config();

// ---- Initialize Resend ----
const resend = new Resend(process.env.RESEND_API_KEY);

// ---- ENV Values ----
const BACKEND_BASE = (process.env.BASE_URL || '').replace(/\/+$/, '');
const FRONTEND_BASE = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const FROM_EMAIL = process.env.FROM_EMAIL;

// Build email verify URL
function buildVerificationLink(token) {
  return `${BACKEND_BASE}/api/auth/verify?token=${token}`;
}

// 🚀 Send a verification email using Resend
async function sendVerificationEmail(toEmail, token, isReminder = false) {
  const verifyURL = buildVerificationLink(token);

  const subject = isReminder
    ? 'Verify your Sparely account (reminder)'
    : 'Verify your Sparely account';

  const html = `
    <p>Hi,</p>
    <p>${isReminder
      ? 'You already started registering for <strong>Sparely</strong>.'
      : 'Thanks for signing up for <strong>Sparely</strong>!'
    }</p>
    <p>Please verify your email by clicking the button below:</p>
    <p>
      <a href="${verifyURL}"
         style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">
        Verify my email
      </a>
    </p>
    <p>Or copy and paste this link:</p>
    <p><a href="${verifyURL}">${verifyURL}</a></p>
  `;

  console.log(`[mail] Sending verification email → ${toEmail}`);

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject,
    html
  });

  if (result.error) {
    console.error('[mail] Resend error:', result.error);
    throw new Error(result.error.message);
  }

  console.log('[mail] Email sent successfully:', result.data?.id);
}

/**
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  let { email, password } = req.body || {};
  console.log('[register] incoming:', req.body);

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    email = String(email).trim().toLowerCase();
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // --- Check if user already exists ---
    const existing = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = existing.rows[0];

    if (user) {
      if (user.is_verified) {
        return res.status(400).json({ message: 'Email already registered.' });
      }

      // User exists but NOT verified → resend verification email
      console.log('[register] User not verified. Resending email.');

      let token = user.verification_token;
      if (!token) {
        token = uuidv4();
        await query(
          `UPDATE users SET verification_token=$1, updated_at=NOW() WHERE id=$2`,
          [token, user.id]
        );
      }

      await sendVerificationEmail(email, token, true);

      return res.status(200).json({
        message: 'Verification email re-sent. Please check your inbox.'
      });
    }

    // --- Create new user ---
    const hashed = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    await query(
      `INSERT INTO users (email, password_hash, verification_token)
       VALUES ($1, $2, $3)`,
      [email, hashed, verificationToken]
    );

    await sendVerificationEmail(email, verificationToken, false);

    return res.status(201).json({
      message: 'User registered! Check your email to verify your account.'
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      message: 'Could not send verification email',
      error: err.message
    });
  }
};

/**
 * GET /api/auth/verify?token=...
 */
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) return res.status(400).send('Missing verification token');

  try {
    const result = await query(
      `UPDATE users
         SET is_verified=TRUE,
             verification_token=NULL,
             updated_at=NOW()
       WHERE verification_token=$1
       RETURNING id, email`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).send('Invalid or expired verification link.');
    }

    return res.send('Email successfully verified! You may now log in.');
  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).send('Error verifying email');
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  let { email, password } = req.body || {};

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    email = email.trim().toLowerCase();

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.is_verified) {
      return res.status(401).json({ message: 'Please verify your email before logging in' });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Login error' });
  }
};
