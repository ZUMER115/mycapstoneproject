// src/pages/SearchPage.js
import { jwtDecode } from 'jwt-decode';
import { useEffect, useMemo, useRef, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/* ===== helpers copied from Dashboard ===== */
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// format a Date -> YYYY-MM-DD (no timezone shift)
const toYMD = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Parse many date formats → YYYY-MM-DD (first day for ranges)
function toISODateSafe(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // M/D/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = Number(m[1]), dd = Number(m[2]), yy = Number(m[3]);
    const d = new Date(yy, mm - 1, dd);
    return isNaN(d) ? null : toYMD(d);
  }

  // "Oct 2, 2024"
  m = s.match(/^([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const MONTHS = {
      january:0, jan:0, february:1, feb:1, march:2, mar:2, april:3, apr:3, may:4,
      june:5, jun:5, july:6, jul:6, august:7, aug:7, september:8, sep:8, sept:8,
      october:9, oct:9, november:10, nov:10, december:11, dec:11
    };
    const key = m[1].toLowerCase().replace(/\.$/, '');
    const mi  = MONTHS[key];
    const dt  = new Date(Number(m[3]), mi, Number(m[2]));
    return (mi == null || isNaN(dt)) ? null : toYMD(dt);
  }

  // "Oct 2–8, 2024" or "Oct 31–Nov 3, 2024" → first day
  m = s.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)?\s*(\d{1,2}),\s*(\d{4})$/);
  if (m) return toISODateSafe(`${m[1]} ${m[2]}, ${m[5]}`);

  const dflt = new Date(s);
  return isNaN(dflt) ? null : toYMD(dflt);
}

// 🔹 Darker date badge like Dashboard
const DATE_BADGE_STYLE = {
  fontSize: 14,
  fontWeight: 700,
  background: '#1d4ed8',      // darker blue
  color: '#ffffff',           // white text
  border: '1px solid #1e40af',
  padding: '6px 10px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  textAlign: 'center'
};

// 🔹 Dark pin badge so it shows on dark widgets
const PIN_BADGE_STYLE = {
  border: '1px solid #4b5563',
  padding: '0.25rem 0.6rem',
  borderRadius: 999,
  cursor: 'pointer',
  background: '#111827',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 600,
  minWidth: 70,
  textAlign: 'center'
};

// build a stable key for scraped items
const keyForScraped = (item) => {
  const iso = toISODateSafe(item.date || item.dateText || item.text || item.event) || '';
  const title = (item.event || item.title || '').toLowerCase().slice(0, 80);
  return `scr|${iso}|${title}`;
};

// build full payload like Dashboard
function buildScrapedPayload(item) {
  const iso = toISODateSafe(item.date || item.dateText || item.text || item.event) || '';
  const title = (item.event || item.title || '').toLowerCase().slice(0, 80);
  return {
    key: `scr|${iso}|${title}`,
    event: item.event || item.title || '',
    category: (item.category || 'other').toLowerCase(),
    dateISO: iso,
    source: 'scraped'
  };
}

// optional sync, mirrors Dashboard
async function syncPinsToServer(email, pinsPayload) {
  try {
    await fetch(`${API}/api/pins/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pins: pinsPayload })
    });
  } catch (e) {
    console.warn('pin sync failed:', e?.message || e);
  }
}

export default function SearchPage() {
  const [deadlines, setDeadlines] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [includePast, setIncludePast] = useState(false); // same behavior as Dashboard list
  const [canvasFilter, setCanvasFilter] = useState(true); // 🔹 NEW: global Canvas on/off
  const listRef = useRef(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastSeq, setToastSeq] = useState(0); // forces animation to replay

  // user email (for pin sync)
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded?.email) setUserEmail(decoded.email);
      } catch {}
    }
  }, []);

  // load deadlines (UW + Canvas if token present)
  useEffect(() => {
    const token = localStorage.getItem('token');

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    fetch(`${API}/api/deadlines`, { headers })
      .then(r => r.json())
      .then(data => setDeadlines(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // hydrate category filters from data (per-category for UW/Canvas labels)
  useEffect(() => {
    if (!deadlines.length) return;
    setCategoryFilters(prev => {
      const present = new Set(deadlines.map(d => d.category || 'other'));
      const next = { ...prev };
      present.forEach(c => { if (!(c in next)) next[c] = true; });
      Object.keys(next).forEach(k => { if (!present.has(k)) delete next[k]; });
      return next;
    });
  }, [deadlines]);

  // Pinned keys in localStorage (scraped only here)
  const [pinnedKeys, setPinnedKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pinnedKeys') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('pinnedKeys', JSON.stringify([...pinnedKeys]));
    // optional: push only currently visible/pinned scraped to server for this page
    if (userEmail) {
      const payload = [...pinnedKeys]
        .filter(k => k.startsWith('scr|'))
        .map(k => {
          const found = deadlines.find(d => keyForScraped(d) === k);
          return found ? buildScrapedPayload(found) : null;
        })
        .filter(Boolean);
      syncPinsToServer(userEmail, payload);
    }
  }, [pinnedKeys, userEmail, deadlines]);

  // filtering pipeline
  const today = new Date();
  const todayStart = startOfDay(today);

  const getDate = (it) => {
    const iso = toISODateSafe(it.date || it.dateText || it.text || it.event);
    return iso ? new Date(iso + 'T00:00:00') : new Date('Invalid');
  };

  // 1) category + search + canvas filter
  const allowedFiltered = deadlines.filter((item) => {
    const category = item.category || 'other';
    const allowed = categoryFilters[category] ?? true;
    const matches = !searchTerm || (item.event || '').toLowerCase().includes(searchTerm.toLowerCase());

    const isCanvas =
      item.source === 'canvas' ||
      (/canvas/i.test(category));

    if (!allowed) return false;
    if (!canvasFilter && isCanvas) return false;
    if (!matches) return false;

    return true;
  });

  // 2) sort by date; drop unparseables
  const allAllowedSorted = useMemo(() => {
    return allowedFiltered
      .map(d => ({ d, t: getDate(d) }))
      .filter(x => !isNaN(x.t))
      .sort((a,b) => a.t - b.t)
      .map(x => x.d);
  }, [allowedFiltered]);

  // 3) upcoming vs all toggle
  const upcomingOnly = allAllowedSorted.filter(it => getDate(it) >= todayStart);
  const visibleList = includePast ? allAllowedSorted : upcomingOnly;

  // first upcoming index (in visibleList context)
  const firstUpcomingIdx = useMemo(() => {
    const base = visibleList === upcomingOnly ? visibleList : allAllowedSorted;
    const idx = base.findIndex(it => getDate(it) >= todayStart);
    if (includePast) return idx;
    return idx;
  }, [visibleList, includePast, allAllowedSorted, todayStart, upcomingOnly]);

  const sortedDeadlines = useMemo(() => {
    return visibleList;
  }, [visibleList]);

  // scroll handler for "Skip to today"
  const scrollToFirstUpcoming = () => {
    if (firstUpcomingIdx < 0) return;
    const el = listRef.current?.querySelector(`[data-idx="${firstUpcomingIdx}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
  };

  const togglePinKey = (k) =>
    setPinnedKeys(prev => {
      const n = new Set(prev);
      const already = n.has(k);
      if (already) n.delete(k); else n.add(k);

      setToastMsg(already ? 'Unpinned' : 'Pinned');
      setToastSeq(s => s + 1);   // retrigger animation

      return n;
    });

  const clearAllFilters = () => {
    // reset search + enable all categories + show upcoming (like Dashboard "Show all / clear")
    setSearchTerm('');
    setIncludePast(false);
    setCanvasFilter(true);
    setCategoryFilters(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => (next[k] = true));
      return next;
    });
  };

  return (
    <div
      style={{
        padding: '1.25rem',
        display: 'grid',
        gap: '1rem',
        minHeight: '100vh',
        background: 'var(--page-bg)'
      }}
    >
      <style>{`
        .deadline-row {
          --bg: transparent;
          --ring: transparent;
          background: var(--bg);
          border-left: 4px solid var(--ring);
          border-radius: 8px;
          transition: background-color .12s ease, box-shadow .12s ease;
        }
        .deadline-row:hover {
          background: #1f2933;
          box-shadow: 0 0 0 1px #4b5563 inset;
        }
        .deadline-row:focus-within {
          background: #1f2933;
          box-shadow: 0 0 0 2px #60a5fa inset;
        }

        .pin-toast {
          position: fixed;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: #111827;
          color: #fff;
          border: 1px solid #1f2937;
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 0 12px 40px rgba(0,0,0,.2);
          pointer-events: none;
          animation: toastDrop 1600ms ease forwards;
          font-weight: 600;
          letter-spacing: .2px;
        }
        @keyframes toastDrop {
          0%   { opacity: 0; transform: translate(-50%, -14px); }
          18%  { opacity: 1; transform: translate(-50%, 0); }
          82%  { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -8px); }
        }
      `}</style>

      {toastMsg && (
        <div className="pin-toast" key={toastSeq} role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}

      <h1 style={{ margin: 0 }}>Search Deadlines</h1>

      {/* Controls */}
      <div
        style={{
          background: 'var(--widget-bg)',
          border: '1px solid rgba(148,163,184,0.4)',
          borderRadius: 12,
          padding: '0.75rem',
          display: 'grid',
          gap: 12
        }}
      >
        {/* Search */}
        <div>
          <label style={{ display:'block', fontWeight:700, marginBottom:6 }}>Search</label>
          <input
            type="text"
            placeholder="Search by keyword…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding:'0.5rem', width:'min(520px, 100%)' }}
          />
        </div>

        {/* Category filters */}
        <div>
          <label style={{ display:'block', fontWeight:700, marginBottom:6 }}>Categories</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
            {Object.keys(categoryFilters).length === 0 && (
              <span style={{ color:'#667' }}>No categories yet.</span>
            )}
            {Object.keys(categoryFilters).sort().map((cat) => (
              <label
                key={cat}
                style={{
                  display:'inline-flex',
                  alignItems:'center',
                  gap:6,
                  border:'1px solid #e6e8eb',
                  borderRadius:999,
                  padding:'4px 10px'
                }}
              >
                <input
                  type="checkbox"
                  checked={!!categoryFilters[cat]}
                  onChange={(e) =>
                    setCategoryFilters(prev => ({ ...prev, [cat]: e.target.checked }))
                  }
                />
                <span style={{ textTransform:'capitalize' }}>{cat}</span>
              </label>
            ))}

            {/* 🔹 extra Canvas global checkbox */}
            <label
              style={{
                display:'inline-flex',
                alignItems:'center',
                gap:6,
                border:'1px solid #e6e8eb',
                borderRadius:999,
                padding:'4px 10px'
              }}
            >
              <input
                type="checkbox"
                checked={canvasFilter}
                onChange={(e) => setCanvasFilter(e.target.checked)}
              />
              <span>Canvas</span>
            </label>
          </div>
        </div>

        {/* Include past toggle + actions */}
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <input
              type="checkbox"
              checked={includePast}
              onChange={(e)=>{ setIncludePast(e.target.checked); }}
            />
            Show past deadlines
          </label>

          <button
            onClick={clearAllFilters}
            style={{
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.9)',
              color: '#e5e7eb',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: 'pointer'
            }}
            title="Reset search & categories; show upcoming only"
          >
            Show all (clear)
          </button>

          <button
            onClick={scrollToFirstUpcoming}
            style={{
              border: '1px solid rgba(148,163,184,0.7)',
              background: 'rgba(15,23,42,0.9)',
              color: '#e5e7eb',
              padding: '6px 10px',
              borderRadius: 6,
              cursor: 'pointer'
            }}
            title="Scroll to today's first upcoming item"
          >
            Skip to today
          </button>
        </div>
      </div>

      {/* Results list */}
      <div
        style={{
          background: 'var(--widget-bg)',
          border: '1px solid rgba(148,163,184,0.4)',
          borderRadius: 12,
          padding: '0.75rem'
        }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ marginTop: 0 }}>
            {includePast ? 'All Deadlines' : 'Upcoming Application Deadlines'}
          </h3>
        </div>

        <div ref={listRef} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
            {sortedDeadlines.length > 0 ? (
              sortedDeadlines.map((item, index) => {
                const absoluteIdx = visibleList.indexOf(item);
                const k = keyForScraped(item);
                const isPinned = pinnedKeys.has(k);
                const iso = toISODateSafe(item.date || item.dateText || item.text || item.event);

                return (
                  <li
                    key={k}
                    data-idx={absoluteIdx}
                    className="deadline-row"
                    style={{
                      padding: '1rem 12px',
                      borderTop: '1px solid #4b5563',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display:'flex', alignItems:'baseline', gap:8, minWidth:0 }}>
                        <strong style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {item.event || 'Untitled'}
                        </strong>
                        <span
                          style={{
                            fontSize:11,
                            color:'#666',
                            textTransform:'capitalize',
                            border:'1px solid #eee',
                            borderRadius:999,
                            padding:'2px 6px'
                          }}
                        >
                          {item.category || 'other'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={DATE_BADGE_STYLE}>
                        {iso
                          ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
                              month:'short',
                              day:'numeric',
                              year:'numeric'
                            })
                          : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePinKey(k)}
                        style={PIN_BADGE_STYLE}
                        title={isPinned ? 'Unpin' : 'Pin'}
                      >
                        {isPinned ? '★ Unpin' : '☆ Pin'}
                      </button>
                    </div>
                  </li>
                );
              })
            ) : (
              <li style={{ padding:'0.75rem 0' }}>Nothing to show.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
