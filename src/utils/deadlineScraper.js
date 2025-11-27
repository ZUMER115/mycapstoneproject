// src/utils/deadlineScraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const dayjs = require('dayjs');

const BOTHELL_BASE = 'https://www.uwb.edu/academic-calendar';
const SEATTLE_BASE = 'https://www.washington.edu/students/reg';
const TACOMA_BASE = 'https://www.tacoma.uw.edu/registrar/academic-calendar';

/* ========= STATIC list (Bothell, keeps previous year/known pages alive) ========= */
const STATIC_URLS_BOTHELL = [
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/application-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/dates-of-instruction-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/grade-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/registration-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/tuition-fee-assessment-deadlines-2024-2025',
  'https://www.uwb.edu/academic-calendar/2024-2025-calendars/u-pass-activation-dates-payment-due-dates-2024-2025'
];

/* ========= UW Seattle static URLs (one page per AY) ========= */
const STATIC_URLS_SEATTLE = [
  `${SEATTLE_BASE}/2526cal.html`,   // 2025–2026
];

/* ========= UW Tacoma static URLs (single consolidated page) ========= */
const STATIC_URLS_TACOMA = [
  TACOMA_BASE,                      // 2025–26 + 2024–25 on same page
];

/* ========= Bothell slugs for auto-discovery ========= */
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
 * - "October 2–8, 2025"
 * - "Oct 31–Nov 3, 2025"
 * - "Dec 13, 2025–Jan 4, 2026"
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

  // 3) "Month D–Month D, YYYY" (cross-month, same year)
  m = s.match(/^([A-Za-z]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z]+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const [, M1, d1, _M2, _d2, Y] = m;
    return dayjs(`${M1} ${d1}, ${Y}`);
  }

  // 4) "Month D, YYYY–Month D, YYYY" (cross-year or explicit years)
  m = s.match(/^([A-Za-z]+)\s(\d{1,2}),\s*(\d{4})\s*[-–]\s*([A-Za-z]+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const [, M1, d1, Y1] = m;
    return dayjs(`${M1} ${d1}, ${Y1}`);
  }

  // 5) "M/D–M/D/YYYY" or "M/D–D/YYYY"
  m = s.match(/^(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/?(\d{1,2})?,\s*(\d{4})$/);
  if (m) {
    const [, M1, d1, _M2orD, _Dmaybe, Y] = m;
    return dayjs(`${M1}/${d1}/${Y}`);
  }

  return null;
}

/**
 * Some cells have multiple lines:
 * "Winter Break\nDec 13, 2025–Jan 4, 2026"
 * Try to pull the line that parses as a date.
 */
function extractDateFromCell(raw) {
  if (!raw) return '';
  const cleaned = String(raw).replace(/\u00a0/g, ' ').trim();
  const parts = cleaned.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const parsed = parseDateSmart(part);
    if (parsed && parsed.isValid()) return part;
  }
  // fallback: try whole text
  return cleaned;
}

/* ---------------- categorization ---------------- */
function categorize(eventText, headingText) {
  const combined = `${eventText} ${headingText}`.toLowerCase();

  if (/(registration|register|enroll)/.test(combined)) return 'registration';
  if (/(add|drop|withdrawal|change.*course)/.test(combined)) return 'add/drop';
  if (/(financial aid|payment|tuition|fee|u[-\s]?pass|upass)/.test(combined))
    return 'financial-aid';

  // Academic / instruction / exams / breaks / grades
  if (
    /(grades? due|grades? available|gpa|s\/ns|pass\/fail|incomplete|final grades|first day of instruction|last day of instruction|start of instruction|classes begin|classes start|classes end|end of term|instruction begins|final examination|final exam|commencement|quarter break)/.test(
      combined
    )
  ) {
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

/* ---------------- year helpers (Bothell) ---------------- */
function currentAY() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0..11
  return m >= 6 ? [y, y + 1] : [y - 1, y];
}
function candidatesFor(slug, y1, y2) {
  return [
    `${BOTHELL_BASE}/${slug}-${y1}-${y2}`,                               // flat/new
    `${BOTHELL_BASE}/${y1}-${y2}-calendars/${slug}-${y1}-${y2}`          // folder/old
  ];
}
function buildDiscoveredUrlsBothell() {
  const [c1, c2] = currentAY();
  const years = [
    [c1, c2],
    [c2, c2 + 1],
    [c2 + 1, c2 + 2],
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
/**
 * campus: 'uwb' | 'uws' | 'uwt'
 * opts: { skipHolidaysTable?: boolean }
 */
async function scrapePage(url, out, campus, opts = {}) {
  const { skipHolidaysTable = false } = opts;

  try {
    const { data, status } = await axios.get(url, {
      timeout: 20000,
      validateStatus: s => s < 500
    });
    if (status === 404 || !data || typeof data !== 'string') return;

    const $ = cheerio.load(data);
    const tables = $('table');
    if (!tables.length) return;

    const slug = slugFromUrl(url);
    const slugDefault = categoryFromSlug(slug);

    tables.each((_, table) => {
      // nearest heading as context
      let tableHeading = '';
      const prev = $(table).prevAll('h1, h2, h3, h4, p, strong').first();
      if (prev.length) tableHeading = prev.text().trim();
      const headingLower = tableHeading.toLowerCase();

      // Skip *holiday* / *religious accommodations* tables when requested
      if (
        skipHolidaysTable &&
        (headingLower.includes('holiday') || headingLower.includes('religious'))
      ) {
        return;
      }

      // Collect column headers (for Schema C)
      const headerCells = [];
      $(table)
        .find('thead th')
        .each((i, th) => {
          headerCells.push($(th).text().trim());
        });

      let lastEvent = '';

      $(table).find('tbody tr').each((__, row) => {
        const $row = $(row);
        const ths = $row.find('th');
        const tds = $row.find('td');

        // Schema A: <th>title</th> + one/more <td>date> cells
        if (ths.length && tds.length) {
          lastEvent = ths.first().text().trim() || lastEvent;
          tds.each((i2, cell) => {
            const rawDateText = $(cell).text().trim();
            const rawDate = extractDateFromCell(rawDateText);
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
              category,
              campus,
            });
          });
          return;
        }

        // Schema B: [date][title] (Bothell)
        // Schema C: [title][date1][date2]...[dateN] (Seattle/Tacoma)
        if (!ths.length && tds.length >= 2) {
          const firstTextRaw = $(tds.get(0)).text().trim();
          const secondTextRaw = $(tds.get(1)).text().trim();

          const firstDateCandidate = extractDateFromCell(firstTextRaw);
          const secondDateCandidate = extractDateFromCell(secondTextRaw);
          const firstIsDate = !!parseDateSmart(firstDateCandidate);
          const secondIsDate = !!parseDateSmart(secondDateCandidate);

          // ---- Schema B: [date][title]
          if (firstIsDate && !secondIsDate) {
            const rawDate = firstDateCandidate;
            const title = secondTextRaw;
            const parsed = parseDateSmart(rawDate);
            if (!parsed?.isValid() || !title) return;

            let category = categorize(title, tableHeading);
            if (category === 'other') category = slugDefault;

            out.push({
              event: title,
              date: rawDate,
              dateObj: parsed.toDate(),
              category,
              campus,
            });
            return;
          }

          // ---- Schema C: [title][date1][date2]...[dateN]
          const baseTitle = firstTextRaw;
          if (!baseTitle) return;

          let hasAnyDate = false;
          tds.slice(1).each((idx, cell) => {
            const rawText = $(cell).text().trim();
            const rawDate = extractDateFromCell(rawText);
            const parsed = parseDateSmart(rawDate);
            if (!parsed?.isValid()) return;

            hasAnyDate = true;

            const headerLabel = headerCells[idx + 1] || ''; // col0 is "CALENDAR EVENT / ITEM"
            const finalTitle = headerLabel
              ? `${baseTitle} (${headerLabel})`
              : baseTitle;

            let category = categorize(finalTitle, tableHeading);
            if (category === 'other') category = slugDefault;

            out.push({
              event: finalTitle,
              date: rawDate,
              dateObj: parsed.toDate(),
              category,
              campus,
            });
          });

          if (hasAnyDate) return;
        }
      });
    });
  } catch (err) {
    if (err.response && err.response.status === 404) return; // not yet published
    console.warn(`[scrape] ${url} -> ${err.message}`);
  }
}

/* ---------------- public API ---------------- */

// we expect to support all three campuses
const EXPECTED_CAMPUSES = new Set(['uwb', 'uws', 'uwt']);

async function fetchAllDeadlines() {
  const deadlines = [];

  // 1) Bothell: static “known-good” pages
  for (const url of STATIC_URLS_BOTHELL) {
    // eslint-disable-next-line no-await-in-loop
    await scrapePage(url, deadlines, 'uwb');
  }

  // 2) Bothell: discovered pages for current/next years
  const discoveredBothell = buildDiscoveredUrlsBothell();
  for (const url of discoveredBothell) {
    if (STATIC_URLS_BOTHELL.includes(url)) continue;
    // eslint-disable-next-line no-await-in-loop
    await scrapePage(url, deadlines, 'uwb');
  }

  // 3) Seattle: single AY page(s), skipping the Holiday table
  for (const url of STATIC_URLS_SEATTLE) {
    // eslint-disable-next-line no-await-in-loop
    await scrapePage(url, deadlines, 'uws', { skipHolidaysTable: true });
  }

  // 4) Tacoma: single consolidated page (skip holidays & religious accommodations)
  for (const url of STATIC_URLS_TACOMA) {
    // eslint-disable-next-line no-await-in-loop
    await scrapePage(url, deadlines, 'uwt', { skipHolidaysTable: true });
  }

  // 4.5) Fallback: if Tacoma produced nothing, mirror Seattle as Tacoma
  const hasTacoma = deadlines.some((d) => d.campus === 'uwt');
  if (!hasTacoma) {
    const seattleForTacoma = deadlines
      .filter((d) => d.campus === 'uws')
      .map((d) => ({ ...d, campus: 'uwt' }));
    deadlines.push(...seattleForTacoma);
  }

  // 5) Sort and return lean objects
  deadlines.sort((a, b) => a.dateObj - b.dateObj);
  return deadlines.map(({ event, date, category, campus }) => ({
    event,
    date,
    category,
    campus,
  }));
}

const Deadline = require('../models/Deadlines.js');

/**
 * Returns cached deadlines if they exist and include all campuses;
 * otherwise scrapes and caches new ones.
 */
async function getOrPopulateDeadlines() {

  if (process.env.FORCE_DEADLINE_REFRESH === 'true') {
  console.log('🔁 FORCE_DEADLINE_REFRESH enabled — clearing deadlines and rescraping...');
  await Deadline.deleteMany({});
}
  const existing = await Deadline.find({}).lean();

  const hasRequiredFields =
    existing.length > 0 &&
    existing.every(
      (d) =>
        typeof d.date === 'string' &&
        d.date &&
        typeof d.category === 'string' &&
        d.category &&
        typeof d.campus === 'string' &&
        d.campus
    );

  const campuses = new Set(existing.map((d) => d.campus).filter(Boolean));
  const hasAllCampuses =
    existing.length > 0 &&
    [...EXPECTED_CAMPUSES].every((c) => campuses.has(c));

  if (hasRequiredFields && hasAllCampuses) {
    console.log(
      `📦 Using ${existing.length} cached deadlines (all campuses present)`
    );
    return existing;
  }

  // Either DB is empty OR we’re missing fields / campuses → rebuild from scraper
  if (existing.length > 0) {
    console.log(
      '⚠️ Deadlines cache incomplete (missing fields or campuses) — clearing and rescraping...'
    );
    await Deadline.deleteMany({});
  } else {
    console.log('⚙️ No deadlines in DB — scraping fresh data...');
  }

  const scraped = await fetchAllDeadlines();
  if (scraped?.length) {
    await Deadline.insertMany(scraped);
    console.log(`✅ Inserted ${scraped.length} deadlines into MongoDB`);
  }
  return scraped;
}

module.exports = { fetchAllDeadlines, getOrPopulateDeadlines };
