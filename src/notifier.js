// src/routes/notify.js
const express = require('express');
const router = express.Router();
const { previewForUser, sendForUser } = require('../services/reminderService');

// Quick preview (no email sent)
router.get('/notify/preview', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'email required' });
    const out = await previewForUser(email);
    res.json(out);
  } catch (e) {
    console.error('preview error:', e);
    res.status(500).json({ message: 'preview failed', error: String(e?.message || e) });
  }
});

// Send the digest email now
router.post('/notify/send', async (req, res) => {
  try {
    const { email, overrideLeadDays } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    const out = await sendForUser(email, overrideLeadDays);
    res.json(out);
  } catch (e) {
    console.error('send error:', e);
    res.status(500).json({ message: 'send failed', error: String(e?.message || e) });
  }
});

module.exports = router;
