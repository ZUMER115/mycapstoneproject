// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ---- ENV helpers ----
const BACKEND_BASE = (process.env.BASE_URL || '').replace(/\/+$/, '');      // https://mycapstoneproject-kd1i.onrender.com
const FRONTEND_BASE = (process.env.FRONTEND_URL || '').replace(/\/+$/, ''); // optional, for later
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function buildVerificationLink(token) {
  // Right now we point directly to the backend verify route.
  // Later, if you add a fancy frontend page, you can redirect there instead.
  return `${BACKEND_BASE}/api/auth/verify?token=${token}`;
}

// ---- Nodemailer transport (Gmail app password) ----
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * POST /api/auth/register
 * Body: { email, password }
 *
 * 1) Normalize + validate input
 * 2) Check for existing user
 * 3) Store user with hashed password + verification_token
 * 4) Send verification email
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
    const existing = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // 2) Hash password + generate verification token
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    // 3) Insert into Postgres
    await query(
      `INSERT INTO users (email, password_hash, verification_token)
       VALUES ($1, $2, $3)`,
      [email, hashedPassword, verificationToken]
    );

    // 4) Send verification email
    const verifyURL = buildVerificationLink(verificationToken);

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
 *
 * Marks user as verified and clears the one-time token.
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

    // For now, simple success text.
    // Later you can redirect to FRONTEND_URL + '?verified=1'
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
