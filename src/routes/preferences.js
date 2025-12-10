const express = require('express');
const UserPreference = require('../models/userPreferenceModel');
const router = express.Router();

/**
 * GET /api/preferences/:email
 * Return preferences for a given user or sensible defaults if not set yet.
 */
router.get('/preferences/:email', async (req, res) => {
  const { email } = req.params;
  if (!email) return res.status(400).json({ message: 'email required' });
  const pref = await UserPreference.findOne({ email }).lean();
  if (!pref) {
    return res.json({
      email,
      lead_time_days: 3,
      bio: '',
      notes: '',
      theme: 'light',
      campus_preference: 'uwb',
      notifications_enabled: true,
    });
  }
  res.json(pref);
});

/**
 * POST /api/preferences
 * Upsert preferences.
 * body: { email, lead_time_days?, bio?, notes?, theme? }
 */
// src/routes/preferences.js
router.post('/preferences', async (req, res) => {
  const {
    email,
    lead_time_days,
    bio,
    notes,
    theme,
    campus_preference,
    notifications_enabled,       // 👈 NEW
  } = req.body || {};
  if (!email) return res.status(400).json({ message: 'email required' });

  const update = {};
  if (lead_time_days !== undefined) update.lead_time_days = Number(lead_time_days);
  if (bio !== undefined) update.bio = String(bio);
  if (notes !== undefined) update.notes = String(notes);
  if (theme !== undefined) update.theme = theme === 'dark' ? 'dark' : 'light';

  // campus preference
  if (campus_preference !== undefined) {
    const c = String(campus_preference);
    const allowed = ['uwb', 'uws', 'uwt', 'all'];
    update.campus_preference = allowed.includes(c) ? c : 'uwb';
  }

  // 🔹 notifications toggle
  if (notifications_enabled !== undefined) {
    // anything explicitly false is OFF; everything else is ON
    update.notifications_enabled = notifications_enabled === false ? false : true;
  }

  const pref = await UserPreference.findOneAndUpdate(
    { email },
    { $set: update, $setOnInsert: { email } },
    { new: true, upsert: true }
  ).lean();

  res.json(pref);
});


module.exports = router;
