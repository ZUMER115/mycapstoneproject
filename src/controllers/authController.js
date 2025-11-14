// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ---- ENV helpers ----
// Fallback to your Render URL if BASE_URL is not set
const BACKEND_BASE = (process.env.BASE_URL || 'https://mycapstoneproject-kd1i.onrender.com').replace(/\/+$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function buildVerificationLink(token) {
  return `${BACKEND_BASE}/api/auth/verify?token=${token}`;
}

// ---- Nodemailer transport (Gmail app password) ----
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // upgrade via STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((err, success) => {
  if (err) {
    console.error('[mail] Transport verification FAILED:', err);
  } else {
    console.log('[mail] Transport is ready to send emails');
  }
});

async function sendVerificationEmail(email, token) {
  const verifyURL = buildVerificationLink(token);
  console.log('[auth] Sending verification email to', email, '->', verifyURL);

  await transporter.sendMail({
    from: `"Sparely" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your Sparely account',
    html: `
      <p>Hi,</p>
      <p>Thanks for signing up for <strong>Sparely</strong>! Please verify your email address by clicking the button below:</p>
      <p>
        <a href="${verifyURL}"
           style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">
          Verify my email
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p><a href="${verifyURL}">${verifyURL}</a></p>
    `
  });
}

/**
 * POST /api/auth/register
 * Body: { email, password }
 */
exports.register = async (req, res) => {
  let { email, password } = req.body || {};

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    email = String(email).trim().toLowerCase();

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // 1) Check if user already exists
    const existingRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    const existing = existingRes.rows[0];

    if (existing) {
      // a) Already verified → tell them to log in
      if (existing.is_verified) {
        return res
          .status(400)
          .json({ message: 'Email already registered. Please log in.' });
      }

      // b) Exists but NOT verified → (re)send verification email
      const token = existing.verification_token || uuidv4();

      if (!existing.verification_token) {
        await query(
          'UPDATE users SET verification_token = $1, updated_at = NOW() WHERE id = $2',
          [token, existing.id]
        );
      }

      try {
        await sendVerificationEmail(email, token);
        return res.status(200).json({
          message: 'Email already registered but not verified. A verification email has been sent.'
        });
      } catch (mailErr) {
        console.error('[auth] Resend verification email error:', mailErr);
        return res.status(500).json({
          message: 'Could not send verification email. Please try again later.'
        });
      }
    }

    // 2) New user: hash password + create verification token
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    await query(
      `INSERT INTO users (email, password_hash, verification_token)
       VALUES ($1, $2, $3)`,
      [email, hashedPassword, verificationToken]
    );

    // 3) Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (mailErr) {
      console.error('[auth] Initial verification email error:', mailErr);
      // You *could* delete the user row here if you want strict behavior.
      return res.status(500).json({
        message: 'Could not send verification email. Please try again later.'
      });
    }

    return res
      .status(201)
      .json({ message: 'User registered. Check your email to verify your account.' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Something went wrong during registration' });
  }
};

/**
 * GET /api/auth/verify?token=...
 */
exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing verification token');
  }

  try {
    const result = await query(
      `UPDATE users
         SET is_verified = TRUE,
             verification_token = NULL,
             updated_at = NOW()
       WHERE verification_token = $1
       RETURNING id, email`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).send('Invalid or expired verification link.');
    }

    return res.send('Email successfully verified! You may now log in.');
  } catch (err) {
    console.error('Verify email error:', err);
    return res.status(500).send('Error verifying email');
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
exports.login = async (req, res) => {
  let { email, password } = req.body || {};

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    email = String(email).trim().toLowerCase();

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      return res.status(401).json({ message: 'Please verify your email before logging in' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
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
