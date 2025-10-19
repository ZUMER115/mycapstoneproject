// server/routes/timeline.js
const express = require('express');
const router = express.Router();

// If you already have functions/models that return these, import them:
const Deadlines = require('../models/Deadlines'); // or your scraper store
const Events    = require('../models/Event');     // personal events model

// ---- date helpers (date-only semantics) ----
function toYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toISODateSafe(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    return isNaN(d) ? null : toYMD(d);
  }
  m = s.match(/^([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const MONTHS = {january:0,jan:0,february:1,feb:1,march:2,mar:2,april:3,apr:3,may:4,
      june:5,jun:5,july:6,jul:6,august:7,aug:7,september:8,sep:8,sept:8,october:9,oct:9,
      november:10,nov:10,december:11,dec:11};
    const mi = MONTHS[m[1].toLowerCase().replace(/\.$/, '')];
    if (mi == null) return null;
    const d = new Date(Number(m[3]), mi, Number(m[2]));
    return isNaN(d) ? null : toYMD(d);
  }
  m = s.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)?\s*(\d{1,2}),\s*(\d{4})$/);
  if (m) return toISODateSafe(`${m[1]} ${m[2]}, ${m[5]}`);

  const dflt = new Date(s);
  return isNaN(dflt) ? null : toYMD(dflt);
}

function buildTimeline(scraped = [], personal = []) {
  const out = [];

  // scraped
  for (const it of scraped) {
    const iso = toISODateSafe(it.date || it.dateText || it.text || it.event);
    if (!iso) continue;
    const title = it.event || it.title || 'Untitled';
    const cat = (it.category || 'other').toLowerCase();
    out.push({
      key: `scr|${iso}|${title.toLowerCase().slice(0, 80)}`,
      source: 'scraped',
      title,
      category: cat,
      dateISO: iso
    });
  }

  // personal
  for (const e of personal) {
    const iso = toYMD(new Date(e.start)); // treat personal as all-day when projecting
    out.push({
      key: `me|${e._id}`,
      source: 'personal',
      title: e.title || 'Untitled',
      category: (e.category || 'personal').toLowerCase(),
      dateISO: iso
    });
  }

  out.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.title.localeCompare(b.title));

  const scrapedOnly = out.filter(x => x.source === 'scraped');
  const byCategory = {};
  for (const x of out) (byCategory[x.category] ||= []).push(x);

  return { all: out, scraped: scrapedOnly, byCategory };
}

router.get('/api/timeline', async (req, res) => {
  try {
    const email = String(req.query.email || '');
    const [scraped, personal] = await Promise.all([
      Deadlines.find({}),                         // adjust to your storage
      email ? Events.find({ email }) : Promise.resolve([])
    ]);
    const timeline = buildTimeline(scraped, personal);
    res.json(timeline);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to build timeline' });
  }
});

module.exports = router;
