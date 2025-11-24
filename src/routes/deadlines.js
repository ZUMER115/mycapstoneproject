// src/routes/deadlines.js (CommonJS)
const express = require('express');
const { createEvents } = require('ics');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { fetchAllDeadlines, getOrPopulateDeadlines } = require('../utils/deadlineScraper');
const UserPreference = require('../models/userPreferenceModel');

const router = express.Router();

// JWT secret (same you use in auth)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/* ---------- helpers ---------- */
function extractSessions(s) {
  const t = String(s).toLowerCase();
  const out = new Set();
  if (/(full[-\s]?term|full term|session\s*full|full)/i.test(t)) out.add('Full');
  if (/(a[-\s]?term|session\s*a|\bA\b)/i.test(s)) out.add('A');
  if (/(b[-\s]?term|session\s*b|\bB\b)/i.test(s)) out.add('B');
  return out;
}

function normalizeBaseTitle(title) {
  return String(title)
    .replace(/\b(Summer)?\s*(Full[-\s]?term|Full term|A[-\s]?term|B[-\s]?term|Session\s*A|Session\s*B)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—]\s*$/,'')
    .trim();
}

function preferCategory(a, b) {
  if (a === 'other' && b !== 'other') return b;
  if (b === 'other' && a !== 'other') return a;
  return a;
}

/* ---------- date parsing helpers ---------- */
const MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];
function monthIndex(m) {
  if (!m) return null;
  const clean = m.toLowerCase().replace(/\.$/, '');
  const idx = MONTHS.findIndex(n => n === clean);
  return idx >= 0 ? idx : null;
}
function parseRange(text) {
  if (!text) return null;
  const yMatch = text.match(/(\d{4})(?!.*\d{4})/);
  const cleaned = yMatch ? text.slice(0, yMatch.index + 4) : text;
  const t = cleaned.replace(/\s+/g, ' ').trim();

  let m = t.match(/^([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M, d, y] = m; const mi = monthIndex(M);
    if (mi != null) {
      const s = new Date(+y, mi, +d); 
      const e = new Date(+y, mi, +d + 1); 
      return { start: s, end: e };
    }
  }

  m = t.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M, d1, d2, y] = m; const mi = monthIndex(M);
    if (mi != null) {
      const s = new Date(+y, mi, +d1); 
      const e = new Date(+y, mi, +d2 + 1); 
      return { start: s, end: e };
    }
  }

  m = t.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M1, d1, M2, d2, y] = m;
    const mi1 = monthIndex(M1), mi2 = monthIndex(M2);
    if (mi1 != null && mi2 != null) {
      const s = new Date(+y, mi1, +d1); 
      const e = new Date(+y, mi2, +d2 + 1); 
      return { start: s, end: e };
    }
  }

  const tryDate = new Date(t);
  if (!isNaN(tryDate.getTime())) {
    const e = new Date(tryDate); 
    e.setDate(e.getDate() + 1);
    return { start: tryDate, end: e };
  }
  return null;
}

router.get('/deadlines/ping', (_req, res) => {
  res.json({ ok: true, router: 'deadlines' });
});

/* ---------- JWT helpers ---------- */
function getUserIdFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id || decoded.userId || null;
  } catch {
    return null;
  }
}

/* ---------- campus preference helper ---------- */
async function getCampusPreferenceFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return 'both';

  const token = authHeader.slice(7).trim();
  if (!token) return 'both';

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded?.email || decoded?.user?.email;
    if (!email) return 'both';

    const pref = await UserPreference.findOne({ email }).lean();
    if (!pref) return 'both';

    return pref.campus_preference || 'both';
  } catch {
    return 'both';
  }
}

/* ============================================================
     MAIN DEADLINES ENDPOINT — NOW WITH CAMPUS FILTERING
   ============================================================ */
router.get('/deadlines', async (req, res) => {
  try {
    const deadlines = await getOrPopulateDeadlines();

    // 🔥 get the campus preference for the current user
    const campusPref = await getCampusPreferenceFromRequest(req);

    // 1) drop blanks
    let cleaned = (deadlines || []).filter(d =>
      d?.event && String(d.event).trim() &&
      d?.category && String(d.category).trim()
    );

    // 🔥 1.5) campus filter BEFORE deduping
    cleaned = cleaned.filter(d => {
      if (!d.campus) return true;          // personal/Moodle/Canvas events
      if (campusPref === 'both') return true;
      return d.campus === campusPref;
    });

    // 2) dedupe
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
        const cat = preferCategory(prev.category, d.category);
        const merged = new Set(prev._sessions);
        sessions.forEach(s => merged.add(s));
        map.set(key, { ...prev, category: cat, _sessions: merged });
      }
    }

    // 3) annotate sessions & include campus
    const deduped = Array.from(map.values()).map(x => {
      const sessions = Array.from(x._sessions || []);
      const tag = sessions.length ? ` (${sessions.join('/')})` : '';
      const rawDate = x.date || x.dateText || x.text || x.event;

      return {
        event: x.event + tag,
        date: rawDate,
        category: x.category || 'other',
        source: 'uw',
        campus: x.campus || 'uwb',
      };
    });

    // 4) Canvas events
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
        const dateIso = r.start_date instanceof Date
          ? r.start_date.toISOString().slice(0, 10)
          : String(r.start_date);

        return {
          event: r.title,
          date: dateIso.slice(0, 10),
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

/* ---------- ICS routes remain unchanged ---------- */
// (kept exactly the same as your version…)

module.exports = router;
