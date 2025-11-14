// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ---- ENV helpers ----
const BACKEND_BASE = (process.env.BASE_URL || '').replace(/\/+$/, '');
const FRONTEND_BASE = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// ---- Nodemailer transport (Gmail app password) ----
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// (optional but nice) test transport at startup
transporter.verify((err, success) => {
  if (err) {
    console.error('[mail] Transport verification FAILED:', err.message);
  } else {
    console.log('[mail] Transport is ready to send emails');
  }
});

function buildVerificationLink(token) {
  return `${BACKEND_BASE}/api/auth/verify?token=${token}`;
}

/**
 * POST /api/auth/register
 * Body: { email, password }
 */
exports.register = async (req, res) => {
  let { email, password } = req.body || {};
  console.log('[register] incoming body:', req.body);

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
    const existingUser = existing.rows[0];

    if (existingUser) {
      // Case A: user exists and is already verified
      if (existingUser.is_verified) {
        console.log('[register] email already registered & verified:', email);
        return res.status(400).json({ message: 'Email already registered.' });
      }

      // Case B: user exists but is NOT verified -> re-send verification
      console.log('[register] user exists but not verified, resending email:', email);

      // ensure they have a token; if not, create one and store it
      let token = existingUser.verification_token;
      if (!token) {
        token = uuidv4();
        await query(
          `UPDATE users
             SET verification_token = $1, updated_at = NOW()
           WHERE id = $2`,
          [token, existingUser.id]
        );
      }

      const verifyURL = buildVerificationLink(token);

      try {
        await transporter.sendMail({
          from: `"Sparely" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Verify your Sparely account (reminder)',
          html: `
            <p>Hi,</p>
            <p>You already started registering for <strong>Sparely</strong>.</p>
            <p>Please verify your email by clicking the button below:</p>
            <p>
              <a href="${verifyURL}"
                style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">
                Verify my email
              </a>
            </p>
            <p>Or copy this link:</p>
            <p><a href="${verifyURL}">${verifyURL}</a></p>
          `
        });

        console.log('[register] reminder verification email sent to:', email);
        return res.status(200).json({
          message: 'Verification email already sent. Please check your inbox.'
        });
      } catch (mailErr) {
        console.error('[mail] error resending verification to', email, mailErr);
        return res.status(500).json({
          message: 'Could not send verification email, please try again later.',
          mailError: mailErr.message
        });
      }
    }

    // 2) New user -> create + send first verification email
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = uuidv4();

    await query(
      `INSERT INTO users (email, password_hash, verification_token)
       VALUES ($1, $2, $3)`,
      [email, hashedPassword, verificationToken]
    );

    const verifyURL = buildVerificationLink(verificationToken);

    try {
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

      console.log('[register] verification email sent to:', email);
      return res.status(201).json({
        message: 'User registered. Check your email to verify your account.'
      });
    } catch (mailErr) {
      console.error('[mail] error sending verification to', email, mailErr);
      return res.status(500).json({
        message: 'Could not send verification email, please try again later.',
        mailError: mailErr.message
      });
    }
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
