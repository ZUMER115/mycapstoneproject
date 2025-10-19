const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Adjust if your pool is elsewhere

router.post('/update-email', async (req, res) => {
  const { oldEmail, newEmail } = req.body;
  try {
    const result = await pool.query('UPDATE users SET email = $1 WHERE email = $2 RETURNING *', [newEmail, oldEmail]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'Email updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

const bcrypt = require('bcrypt');

router.post('/change-password', async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  try {
    const userRes = await pool.query('SELECT password FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(oldPassword, userRes.rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Incorrect old password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashed, email]);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

const { sendVerificationEmail } = require('../utils/mailer'); // Adjust path if needed
const crypto = require('crypto');

router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const result = await pool.query(
      'UPDATE users SET verification_token = $1 WHERE email = $2 RETURNING *',
      [token, email]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    await sendVerificationEmail(email, token);
    res.json({ success: true, message: 'Verification email resent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not resend verification email' });
  }
});


router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
