// server.js (or routes/deadlines.js)
import express from 'express';
import ics from 'ics'; // npm i ics
import { getAllDeadlines } from './yourData'; // replace with your data access

const router = express.Router();

router.get('/api/deadlines/ics', async (req, res) => {
  const deadlines = await getAllDeadlines(); // [{ event, date, category }, ...]
  // helper: parse your "Month D-D, YYYY" strings into JS dates
  const parsed = deadlines.map(d => toRange(d.date)); // { start: Date, end: Date }

  const events = deadlines.map((d, i) => {
    const r = parsed[i];
    if (!r) return null;
    // ICS wants Y,M,D for all-day; end is **exclusive**, so add 1 day already in parse
    const start = [r.start.getFullYear(), r.start.getMonth()+1, r.start.getDate()];
    const end   = [r.end.getFullYear(),   r.end.getMonth()+1,   r.end.getDate()];
    return {
      title: d.event,
      start,
      end,
      allDay: true,
      description: `Category: ${d.category || 'other'}\nFrom Sparely`,
      uid: `sparely-${i}@yourdomain`,
      calName: 'Sparely Deadlines'
    };
  }).filter(Boolean);

  ics.createEvents(events, (err, icsText) => {
    if (err) return res.status(500).send('Failed to build ICS');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="sparely-deadlines.ics"');
    res.send(icsText);
  });
});

export default router;
