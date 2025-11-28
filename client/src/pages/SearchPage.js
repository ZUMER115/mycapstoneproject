// src/pages/SearchPage.js
import { jwtDecode } from 'jwt-decode';
import { useEffect, useMemo, useRef, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/* ===== helpers ===== */
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

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
  background: '#1d4ed8',
  color: '#ffffff',
  border: '1px solid #1e40af',
  padding: '6px 10px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  textAlign: 'center'
};

// 🔹 Dark pin badge
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

// stable key
const keyForScraped = (item) => {
  const iso = toISODateSafe(item.date || item.dateText || item.text || item.event) || '';
  const title = (item.event || item.title || '').toLowerCase().slice(0, 80);
  return `scr|${iso}|${title}`;
};

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

// sync pins
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

// smooth scroll
function smoothScrollTo(container, target, duration = 600) {
  const start = container.scrollTop;
  const change = target - start;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    container.scrollTop = start + change * eased;
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// canonical categories
const CANONICAL_CATS = ['registration', 'academic', 'financial-aid', 'add/drop', 'other'];

export default function SearchPage() {
  const [deadlines, setDeadlines] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [canvasFilter, setCanvasFilter] = useState(true); // master Canvas toggle
  const [canvasCourseFilters, setCanvasCourseFilters] = useState({});
  const listRef = useRef(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastSeq, setToastSeq] = useState(0);
  const [showSkipButton, setShowSkipButton] = useState(false);

  const [userEmail, setUserEmail] = useState('');
  // local campus filter for this page only
  const [campusSearchFilter, setCampusSearchFilter] = useState('all'); // 'all' | 'uwb' | 'uws' | 'uwt'

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

  // hydrate category filters from data (non-canvas)
  useEffect(() => {
    if (!deadlines.length) return;
    setCategoryFilters(prev => {
      const next = { ...prev };
      // ensure canonical categories exist
      CANONICAL_CATS.forEach(c => {
        if (!(c in next)) next[c] = true;
      });

      // clean up any categories that no longer appear
      const present = new Set(
        deadlines
          .map(d => d.category || 'other')
          .filter(c => !/canvas/i.test(String(c)))
      );
      Object.keys(next).forEach(k => {
        if (!CANONICAL_CATS.includes(k) && !present.has(k)) {
          delete next[k];
        }
      });

      return next;
    });
  }, [deadlines]);

  // derive per-course Canvas filters
  useEffect(() => {
    const courses = new Set();

    deadlines.forEach(d => {
      const cat = String(d.category || '');
      const isCanvas = d.source === 'canvas' || /canvas/i.test(cat);
      if (!isCanvas) return;

      let label = 'General';
      const m = cat.match(/^Canvas\s*\((.+)\)$/i);
      if (m) label = m[1].trim();
      courses.add(label);
    });

    setCanvasCourseFilters(prev => {
      const next = { ...prev };
      courses.forEach(c => {
        if (!(c in next)) next[c] = true;
      });
      Object.keys(next).forEach(k => {
        if (!courses.has(k)) delete next[k];
      });
      return next;
    });
  }, [deadlines]);

  // grouped canvas course list
  const canvasCourseList = useMemo(
    () => Object.keys(canvasCourseFilters).sort(),
    [canvasCourseFilters]
  );

  // pinned
  const [pinnedKeys, setPinnedKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pinnedKeys') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('pinnedKeys', JSON.stringify([...pinnedKeys]));
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

  const today = new Date();
  const todayStart = startOfDay(today);

  const getDate = (it) => {
    const iso = toISODateSafe(it.date || it.dateText || it.text || it.event);
    return iso ? new Date(iso + 'T00:00:00') : new Date('Invalid');
  };

  const anyCategoryOn = Object.values(categoryFilters).some(Boolean);
  const anyCanvasOn = canvasFilter;

  // 1) category + campus + search + canvas filter
  const allowedFiltered = deadlines.filter((item) => {
    const category = (item.category || 'other').toLowerCase();
    const matches = !searchTerm || (item.event || '').toLowerCase().includes(searchTerm.toLowerCase());

    const isCanvas =
      item.source === 'canvas' ||
      (/canvas/i.test(category));

    const campus = item.campus || null;

    // campus filter (UW only)
    if (campusSearchFilter !== 'all' && !isCanvas) {
      if (campus && campusSearchFilter !== campus) {
        return false;
      }
    }

    // if nothing is checked at all => show nothing
    if (!anyCategoryOn && !anyCanvasOn) return false;

    // Canvas handling
    if (isCanvas) {
      if (!canvasFilter) return false;

      let label = 'General';
      const m = String(item.category || '').match(/^Canvas\s*\((.+)\)$/i);
      if (m) label = m[1].trim();

      if (canvasCourseList.length) {
        const allowedCourse = canvasCourseFilters[label] ?? true;
        if (!allowedCourse) return false;
      }

      if (!matches) return false;
      return true;
    }

    // UW category handling
    const key = CANONICAL_CATS.includes(category) ? category : 'other';
    const allowed = categoryFilters[key] ?? true;
    if (!allowed) return false;
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

  // first upcoming index
  const firstUpcomingIdx = useMemo(() => {
    const base = visibleList === upcomingOnly ? visibleList : allAllowedSorted;
    const idx = base.findIndex(it => getDate(it) >= todayStart);
    return idx;
  }, [visibleList, includePast, allAllowedSorted, todayStart, upcomingOnly]);

  const sortedDeadlines = useMemo(() => visibleList, [visibleList]);

  // scroll to first upcoming
  const scrollToFirstUpcoming = (instant = false) => {
    if (firstUpcomingIdx == null || firstUpcomingIdx < 0) return;
    const listEl = listRef.current;
    if (!listEl) return;

    const itemEl = listEl.querySelector(`[data-idx="${firstUpcomingIdx}"]`);
    if (!itemEl) return;

    const listRect = listEl.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const currentScroll = listEl.scrollTop;
    const offset = itemRect.top - listRect.top;
    const targetScrollTop = currentScroll + offset;

    if (instant) {
      listEl.scrollTop = targetScrollTop;
    } else {
      smoothScrollTo(listEl, targetScrollTop, 600);
    }
  };

  // jump to today on list change
  useEffect(() => {
    if (sortedDeadlines.length > 0) {
      scrollToFirstUpcoming(true);
    }
  }, [sortedDeadlines]);

  // show/hide "Back to today"
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;

    const handleScroll = () => {
      if (firstUpcomingIdx == null || firstUpcomingIdx < 0) {
        setShowSkipButton(false);
        return;
      }
      const itemEl = listEl.querySelector(`[data-idx="${firstUpcomingIdx}"]`);
      if (!itemEl) {
        setShowSkipButton(false);
        return;
      }
      const listRect = listEl.getBoundingClientRect();
      const itemRect = itemEl.getBoundingClientRect();

      const isVisible =
        itemRect.top >= listRect.top + 4 &&
        itemRect.bottom <= listRect.bottom - 4;

      setShowSkipButton(!isVisible);
    };

    handleScroll();
    listEl.addEventListener('scroll', handleScroll);
    return () => listEl.removeEventListener('scroll', handleScroll);
  }, [firstUpcomingIdx, sortedDeadlines]);

  const togglePinKey = (k) =>
    setPinnedKeys(prev => {
      const n = new Set(prev);
      const already = n.has(k);
      if (already) n.delete(k); else n.add(k);

      setToastMsg(already ? 'Unpinned' : 'Pinned');
      setToastSeq(s => s + 1);

      return n;
    });

  const clearAllFilters = () => {
    setSearchTerm('');
    setIncludePast(false);
    setCanvasFilter(true);
    setCampusSearchFilter('all');

    setCategoryFilters(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => (next[k] = true));
      return next;
    });

    setCanvasCourseFilters(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => (next[k] = true));
      return next;
    });
  };

  const campusLabel = (value) => {
    if (value === 'uwb') return 'UW Bothell';
    if (value === 'uws') return 'UW Seattle';
    if (value === 'uwt') return 'UW Tacoma';
    return 'All campuses';
  };

  return (
    <div
      style={{
        padding: '1.25rem',
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
          background: #e0f2fe; /* light blue hover */
          box-shadow: 0 0 0 1px #93c5fd inset;
        }
        .deadline-row:focus-within {
          background: #e0f2fe;
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

        .search-layout {
          display: grid;
          grid-template-columns: minmax(230px, 290px) minmax(0, 1fr);
          gap: 1rem;
          align-items: flex-start;
        }

        @media (max-width: 900px) {
          .search-layout {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      {toastMsg && (
        <div className="pin-toast" key={toastSeq} role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}

      <h1 style={{ margin: '0 0 0.75rem 0' }}>Search Deadlines</h1>

      <div className="search-layout">
        {/* LEFT SIDEBAR: filters */}
        <aside
          style={{
            background: 'var(--widget-bg)',
            border: '1px solid rgba(148,163,184,0.4)',
            borderRadius: 12,
            padding: '0.75rem',
            display: 'grid',
            gap: 14
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
              style={{
                padding:'0.45rem 0.55rem',
                width:'100%',
                borderRadius:6,
                border:'1px solid #d1d5db',
                background:'#ffffff',
                color:'#111827'
              }}
            />
          </div>

          {/* Categories */}
          <div>
            <div style={{ fontWeight:700, marginBottom:4 }}>Categories</div>
            <div style={{ display:'grid', gap:6 }}>
              {CANONICAL_CATS.map((catKey) => {
                const label =
                  catKey === 'financial-aid' ? 'Financial-Aid'
                  : catKey === 'add/drop' ? 'Add/Drop'
                  : catKey.charAt(0).toUpperCase() + catKey.slice(1);

                // hide "Other" if there are no "other" events at all
                if (catKey === 'other') {
                  const hasOther = deadlines.some(d => {
                    const c = (d.category || 'other').toLowerCase();
                    return !CANONICAL_CATS.includes(c) || c === 'other';
                  });
                  if (!hasOther) return null;
                }

                return (
                  <label
                    key={catKey}
                    style={{
                      display:'inline-flex',
                      alignItems:'center',
                      gap:8,
                      border:'1px solid #d1d5db',
                      borderRadius:999,
                      padding:'4px 10px',
                      background:'#ffffff',
                      color:'#111827',
                      fontSize:13
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={categoryFilters[catKey] ?? true}
                      onChange={(e) =>
                        setCategoryFilters(prev => ({ ...prev, [catKey]: e.target.checked }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Canvas */}
          <div>
            <div style={{ fontWeight:700, marginBottom:4 }}>Canvas</div>
            <div
              style={{
                display:'grid',
                gap:6,
                padding:'6px 8px',
                borderRadius:8,
                border:'1px solid #e5e7eb',
                background:'#f9fafb'
              }}
            >
              <label
                style={{
                  display:'inline-flex',
                  alignItems:'center',
                  gap:8,
                  fontSize:13
                }}
              >
                <input
                  type="checkbox"
                  checked={canvasFilter}
                  onChange={(e) => setCanvasFilter(e.target.checked)}
                />
                <span>Show Canvas events</span>
              </label>

              {canvasCourseList.length > 0 && (
                <div style={{ marginLeft:4 }}>
                  <div style={{ fontSize:11, textTransform:'uppercase', color:'#6b7280', marginBottom:4 }}>
                    Courses
                  </div>
                  <div style={{ display:'grid', gap:4 }}>
                    {canvasCourseList.map(course => (
                      <label
                        key={course}
                        style={{
                          display:'inline-flex',
                          alignItems:'center',
                          gap:6,
                          fontSize:12,
                          opacity: canvasFilter ? 1 : 0.4
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={!canvasFilter}
                          checked={canvasCourseFilters[course] ?? true}
                          onChange={(e) =>
                            setCanvasCourseFilters(prev => ({ ...prev, [course]: e.target.checked }))
                          }
                        />
                        <span>{course}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Campus filter (search-only) */}
          <div>
            <div style={{ fontWeight:700, marginBottom:4 }}>Campus</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {['all', 'uwb', 'uws', 'uwt'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCampusSearchFilter(value)}
                  style={{
                    borderRadius:999,
                    padding:'4px 12px',
                    border: campusSearchFilter === value
                      ? '1px solid #2563eb'
                      : '1px solid #d1d5db',
                    background: campusSearchFilter === value ? '#dbeafe' : '#ffffff',
                    color:'#111827',
                    fontSize:13,
                    cursor:'pointer'
                  }}
                >
                  {campusLabel(value)}
                </button>
              ))}
            </div>
            <small style={{ color:'#9ca3af', display:'block', marginTop:4 }}>
              Only changes what you see on this page.
            </small>
          </div>

          {/* Past toggle + clear */}
          <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:8, marginTop:4 }}>
            <div style={{ display:'grid', gap:8 }}>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13 }}>
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
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#111827',
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize:13
                }}
                title="Reset search & filters; show upcoming only"
              >
                Show all (clear)
              </button>
            </div>
          </div>
        </aside>

        {/* RIGHT: results list */}
        <section
          style={{
            background: 'var(--widget-bg)',
            border: '2px solid #2563eb',                     // 🔹 clearer outline
            boxShadow: '0 12px 32px rgba(37,99,235,0.16)',  // 🔹 subtle blue glow
            borderRadius: 12,
            padding: '0.9rem',
            minHeight: '72vh'                               // 🔹 taller card
          }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ marginTop: 0 }}>
              {includePast ? 'All Deadlines' : 'Upcoming Deadlines'}
            </h3>

            {showSkipButton && (
              <button
                onClick={() => scrollToFirstUpcoming(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize:13
                }}
              >
                Back to today
              </button>
            )}
          </div>

          <div
            ref={listRef}
            style={{
              maxHeight: '78vh',          // 🔹 uses more vertical space
              overflowY: 'auto',
              paddingBottom: '0.5rem'
            }}
          >
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
              {sortedDeadlines.length > 0 ? (
                sortedDeadlines.map((item) => {
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
                        borderTop: '1px solid #e5e7eb',
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
                              color:'#374151',
                              textTransform:'capitalize',
                              border:'1px solid #e5e7eb',
                              borderRadius:999,
                              padding:'2px 6px',
                              background:'#f9fafb'
                            }}
                          >
                            {item.category || 'other'}
                          </span>
                          {item.campus && (
                            <span
                              style={{
                                fontSize:10,
                                textTransform:'uppercase',
                                color:'#6b7280',
                                padding:'1px 5px',
                                borderRadius:999,
                                border:'1px solid #e5e7eb',
                                background:'#f3f4f6'
                              }}
                            >
                              {item.campus.toUpperCase()}
                            </span>
                          )}
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
        </section>
      </div>
    </div>
  );
}
