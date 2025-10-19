// src/routes/events.js
const express = require('express');
const router = express.Router();
const UserEvent = require('../models/userEventModel');

// CREATE
router.post('/events', async (req, res) => {
  try {
    const { email, title, start, end, category = 'personal', notes = '' } = req.body;

    if (!email)   return res.status(400).json({ message: 'Missing email' });
    if (!title)   return res.status(400).json({ message: 'Missing title' });
    if (!start)   return res.status(400).json({ message: 'Missing start date (YYYY-MM-DD)' });

    const s = new Date(start);
    if (Number.isNaN(s.getTime())) {
      return res.status(400).json({ message: `Invalid start date: ${start}` });
    }

    let e;
    if (end) {
      e = new Date(end);
      if (Number.isNaN(e.getTime())) {
        return res.status(400).json({ message: `Invalid end date: ${end}` });
      }
    } else {
      e = new Date(s);
      e.setDate(e.getDate() + 1);
    }

    const doc = await UserEvent.create({ email, title, start: s, end: e, category, notes });
    return res.status(201).json(doc);
  } catch (err) {
    console.error('POST /api/events failed:', err);
    return res.status(500).json({ message: 'Server error creating event', details: String(err?.message || err) });
  }
});

// READ
router.get('/events', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Missing email query param' });
    const items = await UserEvent.find({ email }).sort({ start: 1 }).lean();
    res.json(items);
  } catch (err) {
    console.error('GET /api/events failed:', err);
    res.status(500).json({ message: 'Server error reading events', details: String(err?.message || err) });
  }
});

// DELETE
router.delete('/events/:id', async (req, res) => {
  try {
    await UserEvent.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/events failed:', err);
    res.status(500).json({ message: 'Server error deleting event', details: String(err?.message || err) });
  }
});

module.exports = router;
