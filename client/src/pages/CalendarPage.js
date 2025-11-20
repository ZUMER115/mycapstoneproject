// src/pages/CalendarPage.js
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useMemo, useRef, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/* ===== helpers ===== */
// Render event text so it always clips with an ellipsis inside the box
function renderEventContent(arg) {
  const span = document.createElement('span');
  span.className = 'fc-evt-wrap';
  span.textContent = arg.event.title || '';
  return { domNodes: [span] };
}

// minimal helpers for pin keys
const toYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

function toISODateSafe(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\w+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const map = {
      january: 0,
      jan: 0,
      february: 1,
      feb: 1,
      march: 2,
      mar: 2,
      april: 3,
      apr: 3,
      may: 4,
      june: 5,
      jun: 5,
      july: 6,
      jul: 6,
      august: 7,
      aug: 7,
      september: 8,
      sep: 8,
      sept: 8,
      october: 9,
      oct: 9,
      november: 10,
      nov: 10,
      december: 11,
      dec: 11
    };
    const mi = map[m[1].toLowerCase()];
    if (mi == null) return null;
    const d = new Date(+m[3], mi, +m[2]);
    return isNaN(d) ? null : toYMD(d);
  }

  m = s.match(
    /^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)?\s*(\d{1,2}),\s*(\d{4})$/
  );
  if (m) return toISODateSafe(`${m[1]} ${m[2]}, ${m[5]}`);

  const d = new Date(s);
  return isNaN(d) ? null : toYMD(d);
}

const keyForScraped = (item) => {
  const iso =
    toISODateSafe(item.date || item.dateText || item.text || item.event) || '';
  const title = (item.event || item.title || '').toLowerCase().slice(0, 80);
  return `scr|${iso}|${title}`;
};

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
];

const monthIdx = (m) => {
  if (!m) return null;
  const clean = m.toLowerCase().replace(/\.$/, '');
  const idx = MONTHS.findIndex((n) => n === clean);
  return idx >= 0 ? idx : null;
};

function gcalLink({ title, start, end, tz = 'America/Los_Angeles', details = '' }) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const dates = `${ymd(start)}/${ymd(end)}`; // all-day format, end exclusive
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details,
    ctz: tz
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const isoDate = (d) => {
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
};

// Parse many formats -> start/end (end exclusive)
function parseDateRange(text) {
  if (!text) return null;
  const yMatch = text.match(/(\d{4})(?!.*\d{4})/);
  const cleaned = yMatch ? text.slice(0, yMatch.index + 4) : text;
  const t = cleaned.replace(/\s+/g, ' ').trim();

  // "Oct 2, 2024"
  let m = t.match(/^([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M, d, y] = m;
    const mi = monthIdx(M);
    if (mi != null) {
      const s = new Date(+y, mi, +d);
      const e = new Date(+y, mi, +d + 1);
      return { start: s, end: e };
    }
  }

  // "Oct 2–8, 2024"
  m = t.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M, d1, d2, y] = m;
    const mi = monthIdx(M);
    if (mi != null) {
      const s = new Date(+y, mi, +d1);
      const e = new Date(+y, mi, +d2 + 1);
      return { start: s, end: e };
    }
  }

  // "Oct 31–Nov 3, 2024"
  m = t.match(
    /^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/i
  );
  if (m) {
    const [, M1, d1, M2, d2, y] = m;
    const mi1 = monthIdx(M1);
    const mi2 = monthIdx(M2);
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

const fmtLong = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric'
});

function displayRange(start, endExclusive) {
  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1); // inclusive
  if (start.toDateString() === end.toDateString()) return fmtLong.format(start);

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    const m = fmtLong.format(start).split(' ')[0];
    return `${m} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${fmtLong.format(start)} – ${fmtLong.format(end)}`;
}

/* ===== page ===== */
export default function CalendarPage() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dayGridMonth');
  const [selected, setSelected] = useState(null);
  const calendarRef = useRef(null);

  // track when we should re-read localStorage pins
  const [pinsStamp, setPinsStamp] = useState(0);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'pinnedKeys') setPinsStamp((s) => s + 1);
    };
    const onVisible = () => setPinsStamp((s) => s + 1);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // user + personal
  const [email, setEmail] = useState('');
  const [userEvents, setUserEvents] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    endDate: '',
    category: 'personal',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  // who am I
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const d = jwtDecode(token);
        if (d?.email) setEmail(d.email);
      } catch {}
    }
  }, []);

  // scraped deadlines + Canvas (user-specific via JWT)
  useEffect(() => {
    const token = localStorage.getItem('token') || '';
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${API}/api/deadlines`, { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDeadlines(Array.isArray(data) ? data : []))
      .catch(() => setDeadlines([]))
      .finally(() => setLoading(false));
  }, []);

  // personal + Canvas (.ics) events (both live in /api/events; Canvas ones should have category 'canvas')
  useEffect(() => {
    if (!email) return;
    fetch(`${API}/api/events?email=${encodeURIComponent(email)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setUserEvents(Array.isArray(list) ? list : []))
      .catch(() => setUserEvents([]));
  }, [email]);

  // ALWAYS re-read pins when pinsStamp changes (and when deadlines change)
  const pinnedSet = useMemo(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('pinnedKeys') || '[]'));
    } catch {
      return new Set();
    }
  }, [deadlines, pinsStamp]);

  // build scraped + canvas-from-deadlines events; RANGE -> create events on start & last day only
  const { events: scrapedEvents, lookup } = useMemo(() => {
    const lookupMap = new Map();
    const out = [];

    (deadlines || []).forEach((item, idx) => {
      const title = item.event || item.title || String(item.date || 'Event');
      const category = item.category || 'other';
      const source = item.source || 'uw'; // 'uw' or 'canvas'
      const parsed = parseDateRange(
        item.date || item.dateText || item.text || title
      );
      if (!parsed) return;

      const pinned = pinnedSet.has(keyForScraped(item));
      const displayDate = displayRange(parsed.start, parsed.end);
      const isCanvas = source === 'canvas';

      const base = {
        title,
        category,
        dateText: displayDate,
        _start: parsed.start,
        _end: parsed.end,
        pinned,
        source,
        url: item.url || null
      };

      const lastInclusive = new Date(parsed.end);
      lastInclusive.setDate(lastInclusive.getDate() - 1);

      const pushEv = (d, suffix) => {
        const idPrefix = isCanvas ? 'canvas' : 'scr';
        const id = `${idPrefix}-${idx}-${suffix}`;
        lookupMap.set(id, base);
        out.push({
          id,
          title,
          start: isoDate(d),
          end: isoDate(
            new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
          ),
          allDay: true,
          // Canvas deadlines from /api/deadlines get the purple styling
          ...(isCanvas
            ? {
                backgroundColor: '#8b5cf6',
                borderColor: '#7c3aed',
                textColor: '#ffffff'
              }
            : {}),
          extendedProps: {
            source: isCanvas ? 'canvas' : 'scraped',
            pinned,
            category,
            url: item.url || null
          }
        });
      };

      if (parsed.start.toDateString() === lastInclusive.toDateString()) {
        pushEv(parsed.start, 'single');
      } else {
        pushEv(parsed.start, 'start');
        pushEv(lastInclusive, 'end');
      }
    });

    return { events: out, lookup: lookupMap };
  }, [deadlines, pinnedSet]);

  // personal + Canvas events from /api/events
  const personalEvents = useMemo(() => {
    return (userEvents || []).map((u, i) => {
      const id = `me-${u._id || i}`;
      const start = new Date(u.start);
      const end = new Date(u.end);

      const cat = (u.category || 'personal').toLowerCase();
      const isCanvas = cat === 'canvas';

      // Purple for Canvas (.ics), green for regular personal
      const bg = isCanvas ? '#8b5cf6' : '#4caf50';
      const border = isCanvas ? '#7c3aed' : '#4caf50';

      return {
        id,
        title: u.title,
        start: isoDate(start),
        end: isoDate(end),
        allDay: true,
        backgroundColor: bg,
        borderColor: border,
        textColor: '#ffffff',
        extendedProps: {
          source: isCanvas ? 'canvas' : 'personal',
          mongoId: u._id || null,
          category: cat,
          notes: u.notes || '',
          url: u.url || null
        }
      };
    });
  }, [userEvents]);

  // everything (UW deadlines + personal + Canvas)
  const events = useMemo(
    () => [...scrapedEvents, ...personalEvents],
    [scrapedEvents, personalEvents]
  );

  // keep external "view" state in sync
  useEffect(() => {
    const api = calendarRef.current?.getApi?.();
    if (api && view) api.changeView(view);
  }, [view]);

  // allow Esc to close event detail dialog
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (loading) {
    return (
      <div
        style={{
          padding: '1rem',
          minHeight: '100vh',
          background: 'var(--page-bg)',
          color: 'var(--text-color)'
        }}
      >
        Loading calendar…
      </div>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!email) return alert('Please log in first.');
    if (!form.title.trim() || !form.date)
      return alert('Title and start date are required.');

    const startDate = new Date(form.date + 'T00:00:00');
    const endDate = form.endDate
      ? new Date(form.endDate + 'T00:00:00')
      : new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate() + 1
        );

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          title: form.title.trim(),
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          category: form.category,
          notes: form.notes
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
      if (!res.ok) {
        alert(`Failed to save: ${data?.message || text || res.status}`);
        return;
      }

      const next = await fetch(
        `${API}/api/events?email=${encodeURIComponent(email)}`
      ).then((x) => x.json());
      setUserEvents(Array.isArray(next) ? next : []);

      setAddOpen(false);
      setForm({
        title: '',
        date: '',
        endDate: '',
        category: 'personal',
        notes: ''
      });
      alert('Saved!');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        boxSizing: 'border-box',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        background: 'var(--page-bg)',
        color: 'var(--text-color)'
      }}
    >
      {/* Top controls */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          padding: '0.5rem',
          border: '1px solid rgba(148,163,184,0.4)',
          borderRadius: 8,
          background: 'var(--widget-bg)',
          position: 'sticky',
          top: 8,
          zIndex: 5
        }}
      >
        <label htmlFor="view" style={{ fontWeight: 600 }}>
          View:
        </label>
        <select
          id="view"
          value={view}
          onChange={(e) => setView(e.target.value)}
          style={{ padding: '0.4rem' }}
        >
          <option value="dayGridMonth">Month</option>
          <option value="timeGridWeek">Week</option>
          <option value="timeGridDay">Day</option>
          <option value="listWeek">List</option>
        </select>

        <a
          href={`${API}/api/deadlines/ics`}
          style={{
            marginLeft: 'auto',
            padding: '0.5rem 0.75rem',
            border: '1px solid #ccc',
            borderRadius: 6,
            textDecoration: 'none'
          }}
        >
          Download .ics
        </a>

        <button
          onClick={() => setAddOpen(true)}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #6a6a6a',
            background: '#fff',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          + Add Event
        </button>
      </div>

      {/* Full Calendar */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: 'var(--widget-bg)',
          border: '1px solid rgba(148,163,184,0.4)',
          borderRadius: 8,
          padding: '0.5rem'
        }}
      >
        <style>{`
          /* ---------- DARK THEME FOR FULLCALENDAR ---------- */
          [data-theme="dark"] .fc {
            --fc-border-color: rgba(148,163,184,0.35);
            --fc-bg-main: #111827;
            --fc-bg-header: #020617;
            --fc-text-main: #e5e7eb;
            --fc-text-sub: #9ca3af;
          }

          [data-theme="dark"] .fc,
          [data-theme="dark"] .fc .fc-view-harness,
          [data-theme="dark"] .fc .fc-scrollgrid {
            background-color: var(--widget-bg);
            color: var(--fc-text-main);
          }

          [data-theme="dark"] .fc .fc-col-header-cell {
            background-color: var(--fc-bg-header);
          }
          [data-theme="dark"] .fc .fc-col-header-cell-cushion,
          [data-theme="dark"] .fc .fc-toolbar-title {
            color: var(--fc-text-main);
          }

          [data-theme="dark"] .fc .fc-daygrid-day,
          [data-theme="dark"] .fc .fc-daygrid-day-frame {
            background-color: var(--fc-bg-main);
          }
          [data-theme="dark"] .fc .fc-daygrid-day-number {
            color: var(--fc-text-main);
          }

          [data-theme="dark"] .fc .fc-day-today {
            background-color: rgba(250, 204, 21, 0.08);
          }

          [data-theme="dark"] .fc .fc-button-primary {
            background-color: #1f2937;
            border-color: #4b5563;
            color: var(--fc-text-main);
          }
          [data-theme="dark"] .fc .fc-button-primary:hover {
            background-color: #374151;
          }

          .fc .fc-toolbar-title { font-size: 1.4rem; }
          .fc .fc-col-header-cell-cushion {
            font-size: 1rem;
            font-weight: 700;
            padding: 6px 0;
          }
          .fc .fc-daygrid-day-number {
            font-size: 1rem;
            font-weight: 700;
          }

          /* Zoom-out tweak: slightly shorter rows */
          .fc .fc-daygrid-day,
          .fc .fc-daygrid-day-frame {
            min-height: 100px; /* was 130px */
          }

          .fc .fc-daygrid-event-harness { margin-bottom: 8px; }
          .fc .fc-daygrid-day-events { margin-top: 4px; }

          .fc .fc-daygrid-event {
            padding: 0;
            border-radius: 8px;
            overflow: hidden;
            box-sizing: border-box;
          }

          .fc-evt-wrap {
            display: block;
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
            font-size: 15px;
            font-weight: 600;
            line-height: 1.28;
            padding: 6px 10px;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }

          .fc .fc-list-event-title,
          .fc .fc-timegrid-event .fc-event-title {
            font-size: 16px;
            font-weight: 600;
          }
        `}</style>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          height="100%"
          expandRows={true}
          firstDay={0}
          fixedWeekCount={false}
          /* Zoom-out: slightly higher aspect ratio (smaller rows) */
          aspectRatio={1.4}
          eventDisplay="block"
          eventContent={renderEventContent}
          eventDidMount={(arg) =>
            arg.el.setAttribute('title', arg.event.title || '')
          }
          showNonCurrentDates
          nowIndicator
          events={events}
          eventClick={(info) => {
            const src = info.event.extendedProps?.source;
            if (src === 'personal' || src === 'canvas') {
              const { category, notes, mongoId, url } =
                info.event.extendedProps || {};
              const start = new Date(info.event.start);
              const end = new Date(info.event.end);
              setSelected({
                kind: src, // 'personal' or 'canvas'
                mongoId: mongoId || null,
                title: info.event.title,
                category: category || src,
                dateText: displayRange(start, end),
                _start: start,
                _end: end,
                notes: notes || '',
                url: url || null
              });
            } else {
              const details = lookup.get(info.event.id);
              if (details) setSelected({ kind: 'scraped', ...details });
            }
          }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
        />
      </div>

      {/* Event details modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <style>{`
            .event-card {
              width: min(820px, 96vw);
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 1.75rem 2rem 1.25rem;
              box-shadow: 0 28px 70px rgba(0,0,0,.22), 0 10px 24px rgba(0,0,0,.12);
            }
            .event-title {
              margin: 0 0 .75rem 0;
              font-size: 28px;
              font-weight: 600;
              line-height: 1.25;
              color: #0f172a;
            }
            .event-line {
              margin: .2rem 0;
              font-size: 18px;
              line-height: 1.6;
              color: #111827;
            }
            .event-label {
              color: #6b7280;
              margin-right: .4rem;
            }
            .event-actions {
              margin-top: 1.25rem;
              display: flex;
              justify-content: flex-end;
              gap: .6rem;
              flex-wrap: wrap;
            }
            .btn-lg {
              height: 48px;
              padding: 0 16px;
              border-radius: 10px;
              font-size: 15px;
              font-weight: 700;
              cursor: pointer;
              border: 1px solid #cbd5e1;
              background: #ffffff;
            }
            .btn-primary {
              border-color: #4f46e5;
              background: #4f46e5;
              color: #ffffff;
            }
            .btn-danger {
              border-color: #fecaca;
              background: #fef2f2;
              color: #b91c1c;
            }
          `}</style>

          <div
            onClick={(e) => e.stopPropagation()}
            className="event-card"
            role="dialog"
            aria-modal="true"
            aria-label="Event details"
          >
            <h2 className="event-title">{selected.title}</h2>

            <div className="event-line">
              <span className="event-label">Category:</span>
              <span style={{ textTransform: 'capitalize' }}>
                {selected.category}
              </span>
            </div>

            <div className="event-line">
              <span className="event-label">Date:</span>
              <span>{selected.dateText}</span>
            </div>

            {selected.notes ? (
              <div className="event-line" style={{ marginTop: '.6rem' }}>
                <span className="event-label">Notes:</span>
                <span>{selected.notes}</span>
              </div>
            ) : null}

            <div className="event-actions">
              {selected.kind === 'personal' && selected.mongoId ? (
                <button
                  className="btn-lg btn-danger"
                  onClick={async () => {
                    if (!window.confirm('Delete this personal event?')) return;
                    try {
                      await fetch(`${API}/api/events/${selected.mongoId}`, {
                        method: 'DELETE'
                      });
                      const next = await fetch(
                        `${API}/api/events?email=${encodeURIComponent(email)}`
                      ).then((x) => x.json());
                      setUserEvents(Array.isArray(next) ? next : []);
                      setSelected(null);
                    } catch {
                      alert('Failed to delete.');
                    }
                  }}
                >
                  Delete
                </button>
              ) : null}

              <a
                href={gcalLink({
                  title: selected.title,
                  start: selected._start,
                  end: selected._end,
                  details: `Category: ${selected.category}${
                    selected.notes ? `\nNotes: ${selected.notes}` : ''
                  }`
                })}
                target="_blank"
                rel="noreferrer"
                className="btn-lg"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                Add to Google
              </a>

              <button
                className="btn-lg btn-primary"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {addOpen && (
        <div
          onClick={() => setAddOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
            style={{
              background: '#fff',
              padding: '1rem',
              borderRadius: 8,
              width: 'min(520px, 92vw)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{ marginTop: 0 }}>Add Personal Event</h3>

            <label style={{ display: 'block', marginTop: 8 }}>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                required
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </label>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 8
              }}
            >
              <label>
                Start (YYYY-MM-DD)
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  required
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
              <label>
                End (optional)
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 8
              }}
            >
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                  style={{ width: '100%', padding: 8, marginTop: 4 }}
                >
                  <option value="personal">Personal</option>
                  <option value="registration">Registration</option>
                  <option value="add/drop">Add/Drop</option>
                  <option value="financial-aid">Financial Aid</option>
                  <option value="canvas">Canvas</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'block', marginTop: 8 }}>
              Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </label>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 12
              }}
            >
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ccc',
                  background: '#f7f7f7',
                  borderRadius: 4
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  background: '#4caf50',
                  color: '#fff',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                {saving ? 'Saving…' : 'Save Event'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
