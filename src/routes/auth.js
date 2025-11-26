// src/routes/auth.js
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  updateEmail,
  changePassword
} = require('../controllers/authController');

const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// Regular routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyEmail);

// Protected profile actions
router.put('/email', authMiddleware, updateEmail);

// 🔧 CHANGE THIS LINE
// router.put('/password', authMiddleware, changePassword);
router.post('/change-password', authMiddleware, changePassword);

/* ---------- DEMO LOGIN (temporary) ---------- */
router.post('/demo-login', async (_req, res) => {
  try {
    const demoEmail = 'demo@sparely.app';
    const demoPass = 'demo123';

    const existing = await query('SELECT * FROM users WHERE email=$1', [demoEmail]);

    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(demoPass, 10);
      await query(
        'INSERT INTO users (email, password_hash, is_verified) VALUES ($1, $2, TRUE)',
        [demoEmail, hash]
      );
      console.log('✅ Demo user created in Postgres');
    }

    res.json({
      email: demoEmail,
      password: demoPass,
      message: 'Demo account ready. You can log in using these credentials.'
    });
  } catch (err) {
    console.error('❌ Demo login setup error:', err.message);
    res.status(500).json({ message: 'Demo setup failed', error: err.message });
  }
});

module.exports = router;
