// src/routes/deadlines.js (CommonJS)
const express = require('express');
const { createEvents } = require('ics');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { fetchAllDeadlines, getOrPopulateDeadlines } = require('../utils/deadlineScraper');

const router = express.Router();

// JWT secret (same you use in auth)
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

// Put these small helpers near the top of the file (below other helpers is fine)
function extractSessions(s) {
  const t = String(s).toLowerCase();
  const out = new Set();
  if (/(full[-\s]?term|full term|session\s*full|full)/i.test(t)) out.add('Full');
  if (/(a[-\s]?term|session\s*a|\bA\b)/i.test(s)) out.add('A');
  if (/(b[-\s]?term|session\s*b|\bB\b)/i.test(s)) out.add('B');
  return out;
}

function normalizeBaseTitle(title) {
  // remove the session labels from the end or anywhere in the line and collapse spaces
  return String(title)
    .replace(/\b(Summer)?\s*(Full[-\s]?term|Full term|A[-\s]?term|B[-\s]?term|Session\s*A|Session\s*B)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—]\s*$/,'')
    .trim();
}

function preferCategory(a, b) {
  // keep the more specific category if one is 'other'
  if (a === 'other' && b !== 'other') return b;
  if (b === 'other' && a !== 'other') return a;
  return a; // tie -> keep original
}

/* ---------- date parsing helpers ---------- */
const MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];
function monthIndex(m) {
  if (!m) return null;
  const clean = m.toLowerCase().replace(/\.$/, ''); // handle "Sept."
  const idx = MONTHS.findIndex(n => n === clean);
  return idx >= 0 ? idx : null;
}

// Parse strings like "October 2-8, 2024", "August 23-September 23, 2025", "January 6, 2025"
function parseRange(text) {
  if (!text) return null;
  const yMatch = text.match(/(\d{4})(?!.*\d{4})/);
  const cleaned = yMatch ? text.slice(0, yMatch.index + 4) : text;
  const t = cleaned.replace(/\s+/g, ' ').trim();

  let m = t.match(/^([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M, d, y] = m; const mi = monthIndex(M);
    if (mi != null) { const s = new Date(+y, mi, +d); const e = new Date(+y, mi, +d + 1); return { start: s, end: e }; }
  }
  m = t.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M, d1, d2, y] = m; const mi = monthIndex(M);
    if (mi != null) { const s = new Date(+y, mi, +d1); const e = new Date(+y, mi, +d2 + 1); return { start: s, end: e }; }
  }
  m = t.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M1, d1, M2, d2, y] = m; const mi1 = monthIndex(M1), mi2 = monthIndex(M2);
    if (mi1 != null && mi2 != null) { const s = new Date(+y, mi1, +d1); const e = new Date(+y, mi2, +d2 + 1); return { start: s, end: e }; }
  }
  const tryDate = new Date(t);
  if (!isNaN(tryDate.getTime())) { const e = new Date(tryDate); e.setDate(e.getDate() + 1); return { start: tryDate, end: e }; }
  return null;
}

// add near the top of routes/deadlines.js
router.get('/deadlines/ping', (_req, res) => {
  res.json({ ok: true, router: 'deadlines' });
});

/* ---------- helper: get userId from Authorization header (optional) ---------- */
function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // adjust this if your JWT uses a different property name
    return decoded.id || decoded.userId || null;
  } catch (e) {
    return null;
  }
}

/* ---------- existing JSON endpoint + Canvas merge ---------- */
router.get('/deadlines', async (req, res) => {
  try {
    const deadlines = await getOrPopulateDeadlines();

    // 1) drop blanks just in case (title/category guards)
    const cleaned = (deadlines || []).filter(d =>
      d?.event && String(d.event).trim() &&
      d?.category && String(d.category).trim()
    );

    // 2) dedupe by (date, baseTitle) while merging sessions & preferring specific categories
    const map = new Map();
    for (const d of cleaned) {
      const dateKey = String(d.dateObj ? d.dateObj.format?.('YYYY-MM-DD') : d.date).trim();
      const base = normalizeBaseTitle(d.event);
      const key = `${dateKey}::${base.toLowerCase()}`;

      const sessions = extractSessions(d.event);
      const prev = map.get(key);

      if (!prev) {
        map.set(key, { ...d, event: base, _sessions: new Set(sessions) });
      } else {
        // prefer non-'other' category if available
        const cat = preferCategory(prev.category, d.category);
        // merge sessions
        const merged = new Set(prev._sessions);
        sessions.forEach(s => merged.add(s));
        map.set(key, { ...prev, category: cat, _sessions: merged });
      }
    }

    // 3) annotate the title with merged sessions to make it clear
    const deduped = Array.from(map.values()).map(x => {
      const sessions = Array.from(x._sessions || []);
      const tag = sessions.length ? ` (${sessions.join('/')})` : '';

      // Grab the original date string from whichever field it lives on
      const rawDate = x.date || x.dateText || x.text || x.event;

      return {
        event: x.event + tag,
        date: rawDate,                 // raw string; frontend will parse it
        category: x.category || 'other',
        source: 'uw',                  // 👈 mark as UW/Bothell deadline
      };
    });

    // 4) Optionally pull Canvas events for logged-in user
    const userId = getUserIdFromRequest(req);
    let canvasEvents = [];

    if (userId) {
      const { rows } = await query(
        `
        SELECT id, title, start_date, course_code, url
        FROM canvas_events
        WHERE user_id = $1
        ORDER BY start_date ASC
        `,
        [userId]
      );

      canvasEvents = rows.map((r) => {
        // start_date is a DATE; convert to ISO string or leave as Date
        const dateIso = r.start_date instanceof Date
          ? r.start_date.toISOString().slice(0, 10)
          : String(r.start_date);

        return {
          event: r.title,
          date: dateIso, // "YYYY-MM-DD"
          category: r.course_code ? `Canvas (${r.course_code})` : 'Canvas',
          source: 'canvas',
          url: r.url || null,
        };
      });
    }

    const combined = [...deduped, ...canvasEvents];

    res.json(combined);
  } catch (err) {
    console.error('Error fetching deadlines:', err);
    res.status(500).json({ message: 'Failed to retrieve deadlines' });
  }
});


/* ---------- ICS sanity test ---------- */
// /api/deadlines/ics-test
router.get('/deadlines/ics-test', (req, res) => {
  const { createEvents } = require('ics');

  const { error, value } = createEvents([
    {
      title: 'Sparely Test Event',
      // 3-part arrays (Y,M,D) => all-day
      start: [2025, 8, 15],
      end:   [2025, 8, 16], // end is exclusive
    }
  ]);

  if (error) return res.status(500).send(error.message || String(error));
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sparely-test.ics"');
  res.send(value);
});


/* ---------- real ICS export ---------- */
router.get('/deadlines/ics', async (req, res) => {
  try {
    const { createEvents } = require('ics');
    const { getOrPopulateDeadlines } = require('../utils/deadlineScraper');

    const deadlines = await getOrPopulateDeadlines();

    const events = [];
    let skipped = 0;

    (deadlines || []).forEach((d, i) => {
      const title = d.event || d.title || String(d.date || 'Event');
      const cat = d.category || 'other';

      const range = parseRange(d.date || d.dateText || d.text || title);
      if (!range) { skipped++; return; }

      const start = [range.start.getFullYear(), range.start.getMonth()+1, range.start.getDate()];
      const end   = [range.end.getFullYear(),   range.end.getMonth()+1,   range.end.getDate()];
      if (start.some(Number.isNaN) || end.some(Number.isNaN)) { skipped++; return; }

      events.push({
        title,
        start,          // 3-part arrays => all-day
        end,            // end is exclusive
        description: `Category: ${cat}\nFrom Sparely`,
        uid: `sparely-${i}@sparely.local`,
        calName: 'Sparely Deadlines',
      });
    });

    console.log(`[ICS] total=${deadlines?.length || 0}, valid=${events.length}, skipped=${skipped}`);

    const { error, value } = createEvents(events);
    if (error) return res.status(500).send(error.message || String(error));

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sparely-deadlines.ics"');
    res.send(value);
  } catch (e) {
    console.error('[ICS] route exception:', e);
    res.status(500).send(e.message || String(e));
  }
});


module.exports = router;
