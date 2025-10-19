// src/services/reminderService.js
const nodemailer = require('nodemailer');
const { fetchAllDeadlines } = require('../utils/deadlineScraper');
const UserPreference = require('../models/userPreferenceModel');
const UserPins = require('../models/UserPins'); // <-- NEW

// --- mailer ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// --- helpers ---
const toYMD = (d) => {
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
};

const MONTHS = {
  january:0, jan:0, february:1, feb:1, march:2, mar:2, april:3, apr:3, may:4,
  june:5, jun:5, july:6, jul:6, august:7, aug:7, september:8, sep:8, sept:8,
  october:9, oct:9, november:10, nov:10, december:11, dec:11
};

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse many formats -> YYYY-MM-DD (first day for ranges)
function toISODateSafe(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) { const d = new Date(+m[3], +m[1]-1, +m[2]); return isNaN(d) ? null : toYMD(d); }

  m = s.match(/^([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const key = m[1].toLowerCase().replace(/\.$/, '');
    const mi = MONTHS[key];
    if (mi != null) { const d = new Date(+m[3], mi, +m[2]); return isNaN(d) ? null : toYMD(d); }
  }

  // Range like "Sep 24–30, 2025" or "Aug 23–Sep 23, 2025" → first day
  m = s.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)?\s*(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const mon1 = m[1].toLowerCase().replace(/\.$/, '');
    const mi1  = MONTHS[mon1];
    if (mi1 != null) { const d = new Date(+m[5], mi1, +m[2]); return isNaN(d) ? null : toYMD(d); }
  }

  const dflt = new Date(s);
  return isNaN(dflt) ? null : toYMD(dflt);
}

function inNextNDays(iso, n) {
  if (!iso) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(`${iso}T00:00:00`);
  const end = new Date(today); end.setDate(end.getDate() + n);
  return d >= today && d < end;
}

function formatListHTML(list) {
  return list.map(d => {
    const when = new Date(`${d.iso}T00:00:00`);
    const nice = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `<li style="margin:6px 0"><strong>${d.event}</strong> <em style="color:#666">(${d.category || 'other'})</em><br/><span>${nice}</span></li>`;
  }).join('');
}

// ---- NEW: load user's pins and make a Set of stable keys ----
async function getUserPinKeySet(email) {
  const doc = await UserPins.findOne({ email }).lean();
  const set = new Set();
  (doc?.pins || []).forEach(p => {
    const iso = toISODateSafe(p.date);
    if (!iso) return;
    const key = `${normalizeTitle(p.event)}|${iso}`;
    set.add(key);
  });
  return set;
}

// --- core: build digest for one user (FILTERED BY PINS) ---
async function buildDigest(email, leadDays) {
  const pinSet = await getUserPinKeySet(email);
  // If user has no pins, we send nothing:
  if (!pinSet.size) return [];

  const deadlines = await fetchAllDeadlines();
  const items = (deadlines || [])
    .map(d => {
      const event = d.event || d.title || 'Untitled';
      const iso = toISODateSafe(d.date || d.dateText || d.text || event);
      return {
        event,
        category: d.category || 'other',
        iso,
        _key: `${normalizeTitle(event)}|${iso}`,
      };
    })
    .filter(x => !!x.iso)
    // keep only pinned
    .filter(x => pinSet.has(x._key))
    // and only those within lead window
    .filter(x => inNextNDays(x.iso, leadDays))
    .sort((a,b) => a.iso.localeCompare(b.iso));

  return items;
}

// --- public api ---
async function previewForUser(email) {
  const pref = await UserPreference.findOne({ email }).lean();
  const lead = Number(pref?.lead_time_days ?? 3);
  const items = await buildDigest(email, lead);
  return { email, lead_time_days: lead, count: items.length, items };
}

async function sendForUser(email, overrideLeadDays) {
  const pref = await UserPreference.findOne({ email }).lean();
  const lead = Number(overrideLeadDays ?? pref?.lead_time_days ?? 3);
  const items = await buildDigest(email, lead);

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">
      <h2 style="margin:0 0 8px">Your upcoming pinned deadlines</h2>
      <p>Here are your <strong>pinned</strong> deadlines due in the next <strong>${lead}</strong> day(s):</p>
      <ul style="padding-left:18px">${items.length ? formatListHTML(items) : '<li>No pinned items found in this window.</li>'}</ul>
      <p style="margin-top:16px;color:#666">— Sparely</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Sparely: ${items.length} pinned deadline(s) in next ${lead} day(s)`,
    html
  });

  return { ok: true, email, lead_time_days: lead, count: items.length };
}

module.exports = { previewForUser, sendForUser };
