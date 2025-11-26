// src/routes/auth.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

// REGISTER
router.post('/register', authController.register);

// LOGIN
router.post('/login', authController.login);

// VERIFY EMAIL (GET /api/auth/verify?token=...)
router.get('/verify', authController.verifyEmail);

// UPDATE EMAIL (PUT /api/auth/email)
router.put('/email', authMiddleware, authController.updateEmail);

// CHANGE PASSWORD (POST /api/auth/change-password)
router.post(
  '/change-password',
  authMiddleware,
  authController.changePassword
);

module.exports = router;
