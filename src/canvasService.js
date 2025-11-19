// canvasService.js
const ical = require('node-ical');
const { query } = require('./config/db'); // uses your existing pg helper

// Try to pull things like [CSS 497 A] out of the summary
function extractCourseCodeFromSummary(summary = '') {
  // Example: "Weekly Update - Week 4 [CSS 497 A]"
  const match = summary.match(/\[([A-Z]{2,4}\s*\d+[A-Z]?(?:\s*[A-Z])?)\]/);
  return match ? match[1].trim() : null;
}

function parseCanvasIcs(icsText) {
  const data = ical.sync.parseICS(icsText);
  const events = [];

  for (const key in data) {
    const item = data[key];
    if (!item || item.type !== 'VEVENT') continue;

    const startDate = item.start;
    const summary = item.summary || '';

    events.push({
      uid: item.uid,
      title: summary,
      description: item.description || '',
      url: item.url || '',
      startDate, // JS Date
      courseCode: extractCourseCodeFromSummary(summary),
    });
  }

  return events;
}

async function saveCanvasEventsToDb(userId, events) {
  let importedCount = 0;

  for (const ev of events) {
    if (!ev.startDate) continue;

    const dateOnly = ev.startDate.toISOString().slice(0, 10); // "YYYY-MM-DD"

    try {
      await query(
        `
        INSERT INTO canvas_events
          (user_id, uid, title, description, start_date, url, course_code)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, uid) DO UPDATE
        SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          start_date = EXCLUDED.start_date,
          url = EXCLUDED.url,
          course_code = EXCLUDED.course_code,
          updated_at = NOW()
        `,
        [
          userId,
          ev.uid,
          ev.title,
          ev.description,
          dateOnly,
          ev.url,
          ev.courseCode,
        ]
      );
      importedCount += 1;
    } catch (err) {
      console.error('Error upserting canvas_event for', ev.uid, err.message || err);
      // skip this one, continue with the rest
    }
  }

  return importedCount;
}

module.exports = {
  parseCanvasIcs,
  saveCanvasEventsToDb,
};
