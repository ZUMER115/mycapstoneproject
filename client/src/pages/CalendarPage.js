// src/pages/CalendarPage.js
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { jwtDecode } from 'jwt-decode';
import { useEffect, useMemo, useRef, useState } from 'react';

/* ===== helpers ===== */
// Render event text so it always clips with an ellipsis inside the box
function renderEventContent(arg) {
  const span = document.createElement('span');
  span.className = 'fc-evt-wrap';
  span.textContent = arg.event.title || '';
  return { domNodes: [span] };
}


const MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];
const monthIdx = (m) => {
  if (!m) return null;
  const clean = m.toLowerCase().replace(/\.$/, '');
  const idx = MONTHS.findIndex(n => n === clean);
  return idx >= 0 ? idx : null;
};

function gcalLink({ title, start, end, tz = 'America/Los_Angeles', details = '' }) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
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

  m = t.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/i);
  if (m) {
    const [, M1, d1, M2, d2, y] = m;
    const mi1 = monthIdx(M1), mi2 = monthIdx(M2);
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

const fmtLong = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
function displayRange(start, endExclusive) {
  const end = new Date(endExclusive);
  end.setDate(end.getDate() - 1); // inclusive
  if (start.toDateString() === end.toDateString()) return fmtLong.format(start);

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
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
    const onStorage = (e) => { if (e.key === 'pinnedDeadlines') setPinsStamp(s => s + 1); };
    const onVisible = () => setPinsStamp(s => s + 1);
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
  const [form, setForm] = useState({ title:'', date:'', endDate:'', category:'personal', notes:'' });
  const [saving, setSaving] = useState(false);

  // who am I
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try { const d = jwtDecode(token); if (d?.email) setEmail(d.email); } catch {}
    }
  }, []);

  // scraped deadlines
  useEffect(() => {
    fetch('http://localhost:5000/api/deadlines')
      .then(res => res.ok ? res.json() : [])
      .then(data => setDeadlines(Array.isArray(data) ? data : []))
      .catch(() => setDeadlines([]))
      .finally(() => setLoading(false));
  }, []);

  // personal events
  useEffect(() => {
    if (!email) return;
    fetch(`http://localhost:5000/api/events?email=${encodeURIComponent(email)}`)
      .then(r => r.ok ? r.json() : [])
      .then(list => setUserEvents(Array.isArray(list) ? list : []))
      .catch(() => setUserEvents([]));
  }, [email]);

  // ALWAYS re-read pins when pinsStamp changes (and when deadlines change)
  const pinnedSet = useMemo(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pinnedDeadlines') || '[]')); }
    catch { return new Set(); }
  }, [deadlines, pinsStamp]);

  // build scraped events; RANGE -> create events on start & last day only
  const { events: scrapedEvents, lookup } = useMemo(() => {
    const lookupMap = new Map();
    const out = [];

    (deadlines || []).forEach((item, idx) => {
      const title = item.event || item.title || String(item.date || 'Event');
      const category = item.category || 'other';
      const parsed = parseDateRange(item.date || item.dateText || item.text || title);
      if (!parsed) return;

      const pinned = pinnedSet.has(idx);

      const displayDate = displayRange(parsed.start, parsed.end);
      const base = { title, category, dateText: displayDate, _start: parsed.start, _end: parsed.end, pinned };

      const lastInclusive = new Date(parsed.end);
      lastInclusive.setDate(lastInclusive.getDate() - 1);

      const pushEv = (d, suffix) => {
        const id = `scr-${idx}-${suffix}`;
        lookupMap.set(id, base);
        out.push({
          id,
          title,
          start: isoDate(d),
          end: isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)),
          allDay: true,
          extendedProps: { source: 'scraped', pinned }
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

  // personal events
  const personalEvents = useMemo(() => {
    return (userEvents || []).map((u, i) => {
      const id = `me-${u._id || i}`;
      const start = new Date(u.start);
      const end = new Date(u.end);
      return {
        id,
        title: u.title,
        start: isoDate(start),
        end: isoDate(end),
        allDay: true,
        backgroundColor: '#4caf50',
        borderColor: '#4caf50',
        textColor: '#fff',
        extendedProps: {
          source: 'personal',
          mongoId: u._id || null,
          category: u.category || 'personal',
          notes: u.notes || ''
        }
      };
    });
  }, [userEvents]);

  const events = useMemo(() => [...scrapedEvents, ...personalEvents], [scrapedEvents, personalEvents]);

  useEffect(() => {
    const api = calendarRef.current?.getApi?.();
    if (api && view) api.changeView(view);
  }, [view]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => (e.key === 'Escape') && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (loading) return <div style={{ padding: '1rem' }}>Loading calendar…</div>;

  async function onSubmit(e) {
    e.preventDefault();
    if (!email) return alert('Please log in first.');
    if (!form.title.trim() || !form.date) return alert('Title and start date are required.');

    const startDate = new Date(form.date + 'T00:00:00');
    const endDate = form.endDate
      ? new Date(form.endDate + 'T00:00:00')
      : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);

    setSaving(true);
    try {
      const res = await fetch('http://localhost:5000/api/events', {
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
      let data; try { data = JSON.parse(text); } catch { data = { message: text }; }
      if (!res.ok) {
        alert(`Failed to save: ${data?.message || text || res.status}`);
        return;
      }

      const next = await fetch(`http://localhost:5000/api/events?email=${encodeURIComponent(email)}`).then(x => x.json());
      setUserEvents(Array.isArray(next) ? next : []);

      setAddOpen(false);
      setForm({ title:'', date:'', endDate:'', category:'personal', notes:'' });
      alert('Saved!');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ height: '100vh', boxSizing: 'border-box', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Top controls */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          padding: '0.5rem',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#fff',
          position: 'sticky',
          top: 8,
          zIndex: 5
        }}
      >
        <label htmlFor="view" style={{ fontWeight: 600 }}>View:</label>
        <select id="view" value={view} onChange={(e) => setView(e.target.value)} style={{ padding: '0.4rem' }}>
          <option value="dayGridMonth">Month</option>
          <option value="timeGridWeek">Week</option>
          <option value="timeGridDay">Day</option>
          <option value="listWeek">List</option>
        </select>


        <a
          href="http://localhost:5000/api/deadlines/ics"
          style={{ marginLeft: 'auto', padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 6, textDecoration: 'none' }}
        >
          Download .ics
        </a>

        <button
          onClick={() => setAddOpen(true)}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid #6a6a6a', background:'#fff', borderRadius:6, cursor:'pointer' }}
        >
          + Add Event
        </button>
      </div>

      {/* Full Calendar */}
      <div style={{ flex: 1, minHeight: 0, background:'#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.5rem' }}>
<style>{`
  /* Header + day numbers (unchanged, keep if you like) */
  .fc .fc-toolbar-title { font-size: 1.4rem; }
  .fc .fc-col-header-cell-cushion { font-size: 1rem; font-weight: 700; padding: 6px 0; }
  .fc .fc-daygrid-day-number { font-size: 1rem; font-weight: 700; }

  /* Give month cells comfy height so multi-line pills fit */
  .fc .fc-daygrid-day, .fc .fc-daygrid-day-frame { min-height: 160px; }

  /* --- SPACING BETWEEN EVENTS --- */
  /* Add vertical gap between stacked events */
  .fc .fc-daygrid-event-harness { margin-bottom: 8px; }    /* <-- increase/decrease to taste */
  /* Small top inset so the first event isn't glued to the top border */
  .fc .fc-daygrid-day-events { margin-top: 4px; }

  /* Event pill container */
  .fc .fc-daygrid-event {
    padding: 0;                 /* inner span handles padding */
    border-radius: 8px;
    overflow: hidden;
    box-sizing: border-box;
  }

  /* Title inside each event (used by eventContent render) */
  .fc-evt-wrap{
    display: block;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    hyphens: auto;

    font-size: 18.5px;          /* bigger text */
    font-weight: 600;           /* less bold than 700; use 500 if you want even lighter */
    line-height: 1.28;
    padding: 6px 10px;          /* a little more breathing room */
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  /* Optional: make list/week views look consistent */
  .fc .fc-list-event-title, .fc .fc-timegrid-event .fc-event-title {
    font-size: 16px; font-weight: 600;
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
            /* NEW: give the month view more vertical space */
  aspectRatio={0.85}                 // lower = taller rows

  /* NEW: render content that clips nicely */
  eventDisplay="block"
  eventContent={renderEventContent}

    /* Optional: show native tooltip with full title on hover */
  eventDidMount={(arg) => arg.el.setAttribute('title', arg.event.title || '')}
  
          showNonCurrentDates
          nowIndicator
          events={events}
          eventClick={(info) => {
            if (info.event.extendedProps?.source === 'personal') {
              const { category, notes, mongoId } = info.event.extendedProps || {};
              const start = new Date(info.event.start);
              const end = new Date(info.event.end);
              setSelected({
                kind: 'personal',
                mongoId: mongoId || null,
                title: info.event.title,
                category: category || 'personal',
                dateText: displayRange(start, end),
                _start: start,
                _end: end,
                notes: notes || ''
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
{selected && (
  <div
    onClick={() => setSelected(null)}
    style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
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
        font-size: 28px;           /* smaller than before */
        font-weight: 600;          /* not super bold */
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
      {/* Title (full name) */}
      <h2 className="event-title">{selected.title}</h2>

      {/* Category (plain text, its own line) */}
      <div className="event-line">
        <span className="event-label">Category:</span>
        <span style={{ textTransform: 'capitalize' }}>{selected.category}</span>
      </div>

      {/* Date (plain text, its own line) */}
      <div className="event-line">
        <span className="event-label">Date:</span>
        <span>{selected.dateText}</span>
      </div>

      {/* Optional Notes */}
      {selected.notes ? (
        <div className="event-line" style={{ marginTop: '.6rem' }}>
          <span className="event-label">Notes:</span>
          <span>{selected.notes}</span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="event-actions">
        {selected.kind === 'personal' && selected.mongoId ? (
          <button
            className="btn-lg btn-danger"
            onClick={async () => {
              if (!window.confirm('Delete this personal event?')) return;
              try {
                await fetch(`http://localhost:5000/api/events/${selected.mongoId}`, { method: 'DELETE' });
                const next = await fetch(`http://localhost:5000/api/events?email=${encodeURIComponent(email)}`).then(x => x.json());
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
            details: `Category: ${selected.category}${selected.notes ? `\nNotes: ${selected.notes}` : ''}`
          })}
          target="_blank"
          rel="noreferrer"
          className="btn-lg"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          Add to Google
        </a>

        <button className="btn-lg btn-primary" onClick={() => setSelected(null)}>
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
            position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100
          }}
        >
          <form
            onClick={(e)=>e.stopPropagation()}
            onSubmit={onSubmit}
            style={{
              background:'#fff', padding:'1rem', borderRadius:8, width:'min(520px, 92vw)',
              boxShadow:'0 10px 30px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{marginTop:0}}>Add Personal Event</h3>

            <label style={{display:'block', marginTop:8}}>Title
              <input
                type="text"
                value={form.title}
                onChange={(e)=>setForm(f=>({...f, title:e.target.value}))}
                required
                style={{width:'100%', padding:8, marginTop:4}}
              />
            </label>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8}}>
              <label>Start (YYYY-MM-DD)
                <input
                  type="date"
                  value={form.date}
                  onChange={(e)=>setForm(f=>({...f, date:e.target.value}))}
                  required
                  style={{width:'100%', padding:8, marginTop:4}}
                />
              </label>
              <label>End (optional)
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e)=>setForm(f=>({...f, endDate:e.target.value}))}
                  style={{width:'100%', padding:8, marginTop:4}}
                />
              </label>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8}}>
              <label>Category
                <select
                  value={form.category}
                  onChange={(e)=>setForm(f=>({...f, category:e.target.value}))}
                  style={{width:'100%', padding:8, marginTop:4}}
                >
                  <option value="personal">Personal</option>
                  <option value="registration">Registration</option>
                  <option value="add/drop">Add/Drop</option>
                  <option value="financial-aid">Financial Aid</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <label style={{display:'block', marginTop:8}}>Notes
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e)=>setForm(f=>({...f, notes:e.target.value}))}
                style={{width:'100%', padding:8, marginTop:4}}
              />
            </label>

            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
              <button
                type="button"
                onClick={()=>setAddOpen(false)}
                style={{ padding:'0.5rem 1rem', border:'1px solid #ccc', background:'#f7f7f7', borderRadius:4 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding:'0.5rem 1rem', border:'none', background:'#4caf50', color:'#fff', borderRadius:4, cursor:'pointer' }}
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
