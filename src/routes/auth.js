// src/routes/auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  updateEmail,
  changePassword,
  forgotPassword,   // ✅ matches authController exports
  resetPassword     // ✅ matches authController exports
} = require('../controllers/authController');

const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

// Regular routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyEmail);

// Forgot password flow (2-step: send code, then reset with email+code)
router.post('/forgot-password', forgotPassword);  // step 1: send code
router.post('/reset-password', resetPassword);    // step 2: code + new password

// Protected profile actions
router.put('/email', authMiddleware, updateEmail);

// Change password when already logged in
router.post('/change-password', authMiddleware, changePassword);

/* ---------- DEMO LOGIN (temporary) ---------- */

router.post('/demo-login', (req, res) => {
  const token = jwt.sign(
    {
      id: `demo-${Date.now()}`,
      email: 'demo@sparely.app',
      isDemo: true
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({ token });
});

module.exports = router;
