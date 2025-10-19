// server/routes/pins.js
const router = require('express').Router();
const Pin = require('../models/Pin');

/**
 * GET /api/pins?email=...
 * Returns the user's pins in chronological order.
 */
router.get('/', async (req, res) => {
  try {
    const email = String(req.query.email || '').toLowerCase();
    if (!email) return res.status(400).json({ message: 'email required' });

    const pins = await Pin.find({ email }).sort({ dateISO: 1, event: 1 }).lean();
    return res.json({ pins });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to fetch pins' });
  }
});

/**
 * POST /api/pins/toggle
 * Body: { email, key, event?, category?, dateISO?, source? }
 * If the pin exists => unpin (remove).
 * If it does not exist => add it (requires event/category/dateISO/source to be useful).
 * Responds with the *sorted* pins.
 */
router.post('/toggle', async (req, res) => {
  try {
    const { email, key, event, category, dateISO, source } = req.body || {};
    if (!email || !key) return res.status(400).json({ message: 'email and key required' });

    const e = String(email).toLowerCase();
    const found = await Pin.findOne({ email: e, key });

    if (found) {
      await Pin.deleteOne({ email: e, key });
    } else {
      await Pin.create({
        email: e,
        key,
        event:    event || '',
        category: String(category || 'other').toLowerCase(),
        dateISO, // expect YYYY-MM-DD
        source:   source || (String(key).startsWith('me|') ? 'personal' : 'scraped')
      });
    }

    const pins = await Pin.find({ email: e }).sort({ dateISO: 1, event: 1 }).lean();
    res.json({ pins });
  } catch (e) {
    console.error(e);
    // If unique index throws, still return current list
    if (e.code === 11000) {
      const email = String(req.body.email || '').toLowerCase();
      const pins = await Pin.find({ email }).sort({ dateISO: 1, event: 1 }).lean();
      return res.json({ pins });
    }
    res.status(500).json({ message: 'Failed to toggle pin' });
  }
});

/**
 * (Optional) POST /api/pins/set
 * Replace all pins for an email (bulk set).
 */
router.post('/set', async (req, res) => {
  try {
    const { email, pins } = req.body || {};
    if (!email || !Array.isArray(pins)) return res.status(400).json({ message: 'email and pins[] required' });
    const e = String(email).toLowerCase();

    await Pin.deleteMany({ email: e });
    if (pins.length) {
      const docs = pins.map(p => ({
        email: e,
        key: p.key,
        event: p.event || '',
        category: String(p.category || 'other').toLowerCase(),
        dateISO: p.dateISO || p.date,
        source: p.source || (String(p.key).startsWith('me|') ? 'personal' : 'scraped')
      }));
      await Pin.insertMany(docs, { ordered: false }).catch(() => {});
    }

    const out = await Pin.find({ email: e }).sort({ dateISO: 1, event: 1 }).lean();
    res.json({ pins: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to set pins' });
  }
});

module.exports = router;
