// src/routes/notify.js
const express = require('express');
const router = express.Router();
const { previewForUser, sendForUser } = require('../services/reminderService');

// Quick sanity check
router.get('/notify/health', (_req, res) => res.json({ ok: true }));

// Preview (no email sent). Example: GET /api/notify/preview?email=a@b.com
router.get('/notify/preview', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'email required' });
    const result = await previewForUser(email);
    res.json(result);
  } catch (e) {
    console.error('[notify/preview] error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send (actually emails). Example: POST /api/notify/send { "email":"a@b.com", "leadDays": 7 }
router.post('/notify/send', async (req, res) => {
  try {
    const { email, leadDays } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    const result = await sendForUser(email, leadDays);
    res.json(result);
  } catch (e) {
    console.error('[notify/send] error:', e);
    res.status(500).json({ message: e?.message || 'Server error' });
  }
});

// Test helper: forces a send using the user’s saved lead_time_days (or override)
// Example: POST /api/notify/test { "email":"a@b.com" }
router.post('/notify/test', async (req, res) => {
  try {
    const { email, leadDays } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email required' });
    const result = await sendForUser(email, leadDays); // if leadDays omitted, uses DB pref
    res.json(result);
  } catch (e) {
    console.error('[notify/test] error:', e);
    res.status(500).json({ message: e?.message || 'Server error' });
  }
});

module.exports = router;
