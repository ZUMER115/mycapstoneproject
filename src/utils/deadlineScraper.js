// src/utils/deadlineScraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');

const BASE = 'https://www.uwb.edu/academic-calendar';

/* ========= STATIC list (keeps previous year/known pages alive) ========= */
const STATIC_URLS = [
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/application-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/dates-of-instruction-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/grade-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/registration-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/tuition-fee-assessment-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/u-pass-activation-dates-payment-due-dates-2024-2025'
];

/* ========= Slugs we’ll try to auto-discover for current/next years ========= */
const SLUGS = [
  'application-deadlines',
  'dates-of-instruction',
  'grade-deadlines',
  'registration-deadlines',
  'tuition-fee-assessment-deadlines',
  'u-pass-activation-dates-payment-due-dates'
];

/* ---------------- date helpers (robust to ranges) ---------------- */
const MONTHS = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May',
  Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September',
  Oct: 'October', Nov: 'November', Dec: 'December'
};




// Normalize common abbrevs (e.g., "Sept." -> "September")
function normalizeMonths(s) {
  return String(s || '').replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\.?/g,
    m => MONTHS[m.replace('.', '')] || m
  );
}

/**
 * Parse many formats and return a dayjs (first day if range).
 * Examples:
 * - "October 2, 2025"
 * - "October 2–8, 2025"  (en dash)
 * - "Oct 31–Nov 3, 2025"
 * - "10/02/2025"
 * Returns: dayjs or null
 */
function parseDateSmart(raw) {
  if (!raw) return null;
  const s = normalizeMonths(String(raw).trim());

  // If the cell is things like "TBA", "No classes", etc., skip
  if (/^(tba|tbd|none|no class|no classes)$/i.test(s)) return null;

  // 1) Simple YYYY-MM-DD / Month D, YYYY / M/D/YYYY
  const simple = dayjs(s);
  if (simple.isValid()) return simple;

  // 2) "Month D–D, YYYY"  (same month)
  let m = s.match(/^([A-Za-z]+)\s(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const [, M, d1, _d2, Y] = m;
    return dayjs(`${M} ${d1}, ${Y}`);
  }

  // 3) "Month D–Month D, YYYY" (cross-month)
  m = s.match(/^([A-Za-z]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z]+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const [, M1, d1, _M2, _d2, Y] = m;
    return dayjs(`${M1} ${d1}, ${Y}`);
  }

  // 4) "M/D–M/D/YYYY" or "M/D–D/YYYY" (rare)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/?(\d{1,2})?,\s*(\d{4})$/);
  if (m) {
    const [, M1, d1, _M2orD, _Dmaybe, Y] = m;
    return dayjs(`${M1}/${d1}/${Y}`);
  }

  return null;
}

/* ---------------- categorization ---------------- */
function categorize(eventText, headingText) {
  const combined = `${eventText} ${headingText}`.toLowerCase();

  if (/(registration|register|enroll)/.test(combined)) return 'registration';
  if (/(add|drop|withdrawal|change.*course)/.test(combined)) return 'add/drop';
  if (/(financial aid|payment|tuition|fee|u[-\s]?pass|upass)/.test(combined)) return 'financial-aid';
  if (/(grades? due|grades? available|gpa|s\/ns|pass\/fail|incomplete|final grades|first day of instruction|last day of instruction|start of instruction|classes begin|classes start|classes end|end of term)/.test(combined)) {
    return 'academic';
  }
  return 'other';
}

function categoryFromSlug(slug) {
  if (!slug) return 'other';
  if (slug.includes('application-deadlines')) return 'registration';
  if (slug.includes('registration-deadlines')) return 'registration';
  if (slug.includes('grade-deadlines')) return 'academic';
  if (slug.includes('dates-of-instruction')) return 'academic';
  if (slug.includes('tuition-fee-assessment')) return 'financial-aid';
  if (slug.includes('u-pass')) return 'financial-aid';
  return 'other';
}

/* ---------------- year helpers ---------------- */
function currentAY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0..11
  return (m >= 6) ? [y, y + 1] : [y - 1, y];
}
function candidatesFor(slug, y1, y2) {
  return [
    `${BASE}/${slug}-${y1}-${y2}`,                               // flat/new
    `${BASE}/${y1}-${y2}-calendars/${slug}-${y1}-${y2}`          // folder/old
  ];
}
function buildDiscoveredUrls() {
  const [c1, c2] = currentAY();
  const years = [
    [c1, c2],           // current AY
    [c2, c2 + 1],       // next AY
    [c2 + 1, c2 + 2],   // next+1 AY (future)
  ];
  const urls = new Set();
  for (const [y1, y2] of years) {
    for (const slug of SLUGS) {
      candidatesFor(slug, y1, y2).forEach(u => urls.add(u));
    }
  }
  return Array.from(urls);
}
function slugFromUrl(url) {
  const tail = url.split('/').pop() || '';
  return tail.replace(/-\d{4}-\d{4}$/, '');
}

/* ---------------- core scrape ---------------- */
async function scrapePage(url, out) {
  try {
    const { data, status } = await axios.get(url, { timeout: 20000, validateStatus: s => s < 500 });
    if (status === 404 || !data || typeof data !== 'string') return;

    const $ = cheerio.load(data);
    const tables = $('table');
    if (!tables.length) return;

    const slug = slugFromUrl(url);
    const slugDefault = categoryFromSlug(slug);

    tables.each((_, table) => {
      // nearest heading as context
      let tableHeading = '';
      const prev = $(table).prevAll('h1, h2, h3, h4, p').first();
      if (prev.length) tableHeading = prev.text().trim();

      let lastEvent = '';

      $(table).find('tbody tr').each((__, row) => {
        const $row = $(row);
        const ths = $row.find('th');
        const tds = $row.find('td');

        // Schema A: <th>title</th> + one/more <td>date> cells
        if (ths.length && tds.length) {
          lastEvent = ths.first().text().trim() || lastEvent;
          tds.each((i2, cell) => {
            const rawDate = $(cell).text().trim();
            const parsed = parseDateSmart(rawDate);
            if (!parsed?.isValid()) return;
            const title = lastEvent;
            if (!title) return;

            let category = categorize(title, tableHeading);
            if (category === 'other') category = slugDefault;

            out.push({
              event: title,
              date: rawDate,
              dateObj: parsed.toDate(),
              category
            });
          });
          return;
        }

        // Schema B: 2 columns -> [date][title]
        if (!ths.length && tds.length >= 2) {
          const rawDate = $(tds.get(0)).text().trim();
          const title   = $(tds.get(1)).text().trim();
          const parsed  = parseDateSmart(rawDate);
          if (!parsed?.isValid() || !title) return;

          let category = categorize(title, tableHeading);
          if (category === 'other') category = slugDefault;

          out.push({
            event: title,
            date: rawDate,
            dateObj: parsed.toDate(),
            category
          });
        }
      });
    });
  } catch (err) {
    if (err.response && err.response.status === 404) return; // not yet published
    console.warn(`[scrape] ${url} -> ${err.message}`);
  }
}

/* ---------------- public API ---------------- */
async function fetchAllDeadlines() {
  const deadlines = [];

  // 1) Always scrape your static “known-good” pages (persists old content)
  for (const url of STATIC_URLS) {
    // eslint-disable-next-line no-await-in-loop
    await scrapePage(url, deadlines);
  }

  // 2) Also try discovered pages for current/next years (auto future)
  const discovered = buildDiscoveredUrls();
  for (const url of discovered) {
    // skip if already in static list
    if (STATIC_URLS.includes(url)) continue;
    // eslint-disable-next-line no-await-in-loop
    await scrapePage(url, deadlines);
  }

  // 3) Sort and return lean objects
  deadlines.sort((a, b) => a.dateObj - b.dateObj);
  return deadlines.map(({ event, date, category }) => ({ event, date, category }));
}
const Deadline = require('../models/Deadlines.js');

/**
 * Returns cached deadlines if they exist; otherwise scrapes and caches new ones.
 */
async function getOrPopulateDeadlines() {
  const existing = await Deadline.find({});
  if (existing.length > 0) {
    console.log(`📦 Using ${existing.length} cached deadlines`);
    return existing;
  }

  console.log('⚙️ No deadlines in DB — scraping fresh data...');
  const scraped = await fetchAllDeadlines();
  if (scraped?.length) {
    await Deadline.insertMany(scraped);
    console.log(`✅ Inserted ${scraped.length} deadlines into MongoDB`);
  }
  return scraped;
}

module.exports = { fetchAllDeadlines, getOrPopulateDeadlines };
