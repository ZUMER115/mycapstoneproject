// client/src/Dashboard.js
import { jwtDecode } from 'jwt-decode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
console.log('API:', API);

// ---- Recommended logic helpers ----
const RECO_TARGET        = 7;
const RECO_UPCOMING_DAYS = 4;   // “3–4 days”
const RECO_SHARED_DAYS   = 21;  // pinned categories window;

// Days until a local YYYY-MM-DD date
const daysUntil = (iso) => {
  if (!iso) return Infinity;
  const today = new Date(); const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(iso + 'T00:00:00');
  return Math.floor((d - t0) / (24*60*60*1000));
};

// Return a CSS class for urgency tint
const urgencyClass = (dateLike) => {
  const iso = toISODateSafe(dateLike);
  if (!iso) return '';
  const n = daysUntil(iso);
  if (n < 0)  return 'u-past';   // optional gray for past
  if (n <= 7) return 'u-1w';     // ≤ 1 week
  if (n <= 14) return 'u-2w';    // ≤ 2 weeks
  return 'u-later';              // > 2 weeks
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

function buildPersonalPayload(email, evt) {
  const iso = ymdFromIso(evt.start);
  return {
    email,
    key: `me|${evt._id}`,
    event: evt.title || '',
    category: (evt.category || 'personal').toLowerCase(),
    dateISO: iso,
    source: 'personal'
  };
}

function getISOFromItem(it) {
  return toISODateSafe(it.date || it.dateText || it.text || it.event);
}

/**
 * Compute Recommended Deadlines (YOUR SPEC)
 */
function computeRecommendedDeadlines({
  allItems = [],
  pinnedCats = new Set(),
  excludeKeys = new Set(),
  target = RECO_TARGET
}) {
  const today = startOfDay(new Date());
  const day   = (n) => addDays(today, n);

  const keyFor = (it) =>
    `scr|${getISOFromItem(it) || ''}|${(it.event || it.title || '').toLowerCase().slice(0, 80)}`;

  // Base future pool (exclude currently pinned scraped)
  const baseFuture = allItems.filter((it) => {
    const iso = getISOFromItem(it);
    if (!iso) return false;
    const d = new Date(iso + 'T00:00:00');
    if (d < today) return false;
    return !excludeKeys.has(keyFor(it));
  });

  const byDateAsc = (a, b) => {
    const da = new Date(getISOFromItem(a) + 'T00:00:00');
    const db = new Date(getISOFromItem(b) + 'T00:00:00');
    return da - db;
  };

  const chosen = [];
  const seen   = new Set();

  const addList = (list) => {
    for (const it of list) {
      const k = keyFor(it);
      if (seen.has(k)) continue;
      seen.add(k);
      chosen.push(it);
      if (chosen.length >= target) break;
    }
  };

  // 1) ≤ 4 days out
  const soon = baseFuture.filter((it) => {
    const d = new Date(getISOFromItem(it) + 'T00:00:00');
    return d >= today && d < day(RECO_UPCOMING_DAYS + 1);
  }).sort(byDateAsc);
  addList(soon);
  if (chosen.length >= target) return chosen.sort(byDateAsc);

  // 2) Pinned categories within 21 days
  if (pinnedCats.size) {
    const shared = baseFuture.filter((it) => {
      const cat = (it.category || 'other').toLowerCase();
      const d = new Date(getISOFromItem(it) + 'T00:00:00');
      return pinnedCats.has(cat) && d >= today && d < day(RECO_SHARED_DAYS + 1);
    }).sort(byDateAsc);
    addList(shared);
    if (chosen.length >= target) return chosen.sort(byDateAsc);
  }

  // 3) Category ladder...
  const ladderOrder = ['add/drop', 'financial-aid', 'registration', 'academic'];
  let offset = 7;
  let safety = 0;
  const MAX_STEPS = 365;

  while (chosen.length < target && safety < MAX_STEPS) {
    let addedThisRound = false;
    for (const cat of ladderOrder) {
      const candidate = baseFuture
        .filter((it) => {
          const c = (it.category || 'other').toLowerCase();
          if (c !== cat) return false;
          const d = new Date(getISOFromItem(it) + 'T00:00:00');
          return d >= day(offset);
        })
        .sort(byDateAsc)
        .find((it) => !seen.has(keyFor(it)));
      if (candidate) {
        seen.add(keyFor(candidate));
        chosen.push(candidate);
        addedThisRound = true;
        if (chosen.length >= target) break;
      }
    }
    if (!addedThisRound) offset += 1;
    safety += 1;
  }

  if (chosen.length < target) {
    const filler = baseFuture
      .filter((it) => !seen.has(keyFor(it)))
      .sort(byDateAsc);
    addList(filler);
  }

  return chosen.sort(byDateAsc);
}

// ================= helpers =================
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays     = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// timezone-safe date formatter
const fmtDate = (d) => {
  if (!d) return '';
  const s = String(d).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const dt = new Date(s);
  return isNaN(dt)
    ? s
    : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const ymdFromIso = (iso) => (String(iso).match(/^(\d{4}-\d{2}-\d{2})/) || [,''])[1] || '';

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

// CSV
const csvEscape = (v = '') => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function exportDeadlinesToCSV(rows = [], filename = 'deadlines.csv') {
  const header = ['Event', 'Date', 'Category'];
  const body = rows.map(r => [csvEscape(r.event || r.title || ''), csvEscape(r.date || ''), csvEscape(r.category || 'other')].join(','));
  const csv = [header.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

/* === Compact upcoming-weeks bar chart (numbers outside) === */
const UpcomingLoadChart = ({ items, weeks = 8 }) => {
  const today = startOfDay(new Date());
  const data = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(today, i * 7);
    const count = items.reduce((acc, it) => {
      const iso = toISODateSafe(it.date || it.dateText || it.text || it.event);
      if (!iso) return acc;
      const d = new Date(iso + 'T00:00:00');
      return d >= start && d < addDays(start, 7) ? acc + 1 : acc;
    }, 0);
    return {
      label: `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${addDays(start, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      count
    };
  });
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr max-content', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 13.5, color: '#cbd5f5' }}>{d.label}</div>
          <div style={{ position: 'relative', background: '#111827', height: 12, borderRadius: 999 }}>
            <div
              title={`${d.count} deadline${d.count === 1 ? '' : 's'}`}
              style={{
                width: `${(d.count / max) * 100}%`,
                height: '100%',
                borderRadius: 999,
                background: '#4f46e5',
                transition: 'width 200ms ease'
              }}
            />
          </div>
          <div style={{ fontSize: 13.5, color: '#e5e7eb', textAlign: 'right' }}>{d.count}</div>
        </div>
      ))}
    </div>
  );
};

/* ===== reusable styles ===== */
/* 🔹 Darker blue date badge with white text */
const DATE_BADGE_STYLE = {
  fontSize: 16.5,
  fontWeight: 700,
  background: '#1d4ed8',           // darker blue
  color: '#ffffff',                // white text
  border: '1px solid #1e40af',
  padding: '7px 12px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  minWidth: 118,
  textAlign: 'center'
};

/* 🔹 Dark pin badge so white text shows clearly in dark mode */
const PIN_BADGE_STYLE = {
  border: '1px solid #4b5563',
  padding: '0.25rem 0.6rem',
  borderRadius: 999,
  cursor: 'pointer',
  background: '#111827',
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 600,
  minWidth: 68,
  textAlign: 'center'
};

// 🔹 Helper to detect Canvas items (by category or title)
const isCanvasItem = (item) => {
  const cat = (item?.category || '').toLowerCase();
  const title = (item?.event || item?.title || '').toLowerCase();
  return cat === 'canvas' || title.includes('canvas');
};

/* ================= main component ================= */
const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  function handleLogout() {
    localStorage.removeItem('token');
    setNavOpen(false);
    navigate('/login');
  }

  const [groupedView, setGroupedView] = useState(false);
  const [includePast, setIncludePast] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [miniSelectedDate, setMiniSelectedDate] = useState(null);
  const [miniSelectedItems, setMiniSelectedItems] = useState([]);

  const [userEmail, setUserEmail] = useState('');
  const [deadlines, setDeadlines] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState({});

  const [userEvents, setUserEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [ignoredAlerts, setIgnoredAlerts] = useState(new Set());
  const [fadingAlerts, setFadingAlerts] = useState(new Set());

  const [pinnedKeys, setPinnedKeys] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pinnedKeys') || '[]')); } catch { return new Set(); }
  });
  useEffect(() => { localStorage.setItem('pinnedKeys', JSON.stringify([...pinnedKeys])); }, [pinnedKeys]);

  const listRef = useRef(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    endDate: '',
    category: 'personal',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const keyForScraped = (item) => {
    const iso = toISODateSafe(item.date || item.dateText || item.text || item.event) || '';
       const title = (item.event || item.title || '').toLowerCase().slice(0, 80);
    return `scr|${iso}|${title}`;
  };
  const keyForPersonal = (evt) => `me|${evt._id}`;

  useEffect(() => {
    if (!userEmail) return;
    (async () => {
      const r = await fetch(`${API}/api/pins?email=${encodeURIComponent(userEmail)}`);
      const data = await r.json();
      if (r.ok && Array.isArray(data.pins)) {
        setPinnedKeys(new Set(data.pins.map(p => p.key)));
      }
    })();
  }, [userEmail]);

  // load scraped deadlines + user email
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded?.email) setUserEmail(decoded.email);
      } catch (e) {
        console.error('[Dashboard] jwtDecode failed:', e);
      }
    }

    const url = `${API}/api/deadlines`;
    console.log('[Dashboard] fetching deadlines from', url);

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    fetch(url, { headers })
      .then(async (r) => {
        console.log('[Dashboard] /api/deadlines status:', r.status);
        const text = await r.text();
        console.log('[Dashboard] raw response text:', text.slice(0, 200));
        
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          console.error('[Dashboard] JSON parse failed:', e);
          return setDeadlines([]);
        }

        console.log('[Dashboard] parsed JSON:', json);
        setDeadlines(Array.isArray(json) ? json : []);
      })
      .catch((err) => {
        console.error('[Dashboard] FETCH FAILED (likely CORS or network):', err);
        setDeadlines([]);
      });

  }, []);

  async function refreshUserEvents(email) {
    if (!email) return;
    setLoadingEvents(true);
    try {
      const list = await fetch(`${API}/api/events?email=${encodeURIComponent(email)}`)
        .then(r => (r.ok ? r.json() : []));
      const arr = Array.isArray(list) ? list : [];
      setUserEvents(arr);
      setPinnedKeys(prev => {
        const next = new Set(prev);
        arr.forEach(e => next.add(keyForPersonal(e)));
        return next;
      });
    } catch {
      setUserEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }

  async function togglePinOnServer(payload) {
    if (!userEmail) return alert('Please log in first.');

    const res = await fetch(`${API}/api/pins/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, ...payload })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Failed to toggle pin');

    setPinnedKeys(new Set((data.pins || []).map(p => p.key)));
    return data.pins;
  }

  useEffect(() => { if (userEmail) refreshUserEvents(userEmail); }, [userEmail]);

  useEffect(() => {
    if (!deadlines.length) return;
    const present = new Set(deadlines.map(d => d.category || 'other'));
    setCategoryFilters(prev => {
      const next = { ...prev };
      present.forEach(c => { if (!(c in next)) next[c] = true; });
      Object.keys(next).forEach(k => { if (!present.has(k)) delete next[k]; });
      return next;
    });
  }, [deadlines]);

  const handleSearchChange = (e) => setSearchTerm(e.target.value);

  const today = new Date();
  const todayStart = startOfDay(today);

  const allowedFiltered = deadlines.filter((item) => {
    const category = item.category || 'other';
    const allowed = categoryFilters[category] ?? true;
    const matches = !searchTerm || (item.event || '').toLowerCase().includes(searchTerm.toLowerCase());
    return allowed && matches;
  });

  const getDate = (it) => {
    const iso = toISODateSafe(it.date || it.dateText || it.text || it.event);
    return iso ? new Date(iso + 'T00:00:00') : new Date('Invalid');
  };
  const allAllowedSorted = allowedFiltered
    .map(d => ({ d, t: getDate(d) }))
    .filter(x => !isNaN(x.t))
    .sort((a,b) => a.t - b.t)
    .map(x => x.d);

  const firstUpcomingIdx = allAllowedSorted.findIndex(it => getDate(it) >= todayStart);
  const upcomingOnly     = allAllowedSorted.filter(it => getDate(it) >= todayStart);

  // includePast toggle only; no rangeFilter now
  const filteredDeadlines = includePast ? allAllowedSorted : upcomingOnly;

  const grouped = filteredDeadlines.reduce((acc, item) => {
    const cat = (item.category || 'other').toLowerCase();
    (acc[cat] ||= []).push(item);
    return acc;
  }, {});

  const sortedDeadlines = [...filteredDeadlines].sort((a, b) => {
    const ka = keyForScraped(a), kb = keyForScraped(b);
    const pa = pinnedKeys.has(ka) ? 1 : 0, pb = pinnedKeys.has(kb) ? 1 : 0;
    return pb - pa || getDate(a) - getDate(b);
  });

  const pinnedPersonal = useMemo(() => {
    return (userEvents || []).map(e => ({
      _key: keyForPersonal(e),
      _source: 'personal',
      _id: e._id,
      event: e.title,
      date: ymdFromIso(e.start),
      category: e.category || 'personal',
      _raw: e
    }));
  }, [userEvents]);

  const pinnedScraped = useMemo(() => {
    const set = new Set([...pinnedKeys].filter(k => k.startsWith('scr|')));
    if (!set.size) return [];
    return allAllowedSorted
      .map(it => ({ it, k: keyForScraped(it) }))
      .filter(x => set.has(x.k))
      .map(x => ({
        _key: x.k,
        _source: 'scraped',
        event: x.it.event,
        date: toISODateSafe(x.it.date || x.it.dateText || x.it.text || x.it.event),
        category: x.it.category || 'other',
        _raw: x.it
      }));
  }, [allAllowedSorted, pinnedKeys]);

  const pinnedItems = [...pinnedPersonal, ...pinnedScraped];

  const pinnedScrKeySet = useMemo(
    () => new Set([...pinnedKeys].filter(k => k.startsWith('scr|'))),
    [pinnedKeys]
  );

  const pinnedCategorySet = useMemo(() => {
    const set = new Set();
    pinnedScraped.forEach(p => set.add((p.category || 'other').toLowerCase()));
    pinnedPersonal.forEach(p => {
      const c = (p.category || '').toLowerCase();
      if (c && c !== 'personal') set.add(c);
    });
    return set;
  }, [pinnedScraped, pinnedPersonal]);

  const recommended = useMemo(() => {
    return computeRecommendedDeadlines({
      allItems: allAllowedSorted,
      pinnedCats: pinnedCategorySet,
      excludeKeys: pinnedScrKeySet,
      target: RECO_TARGET,
    });
  }, [allAllowedSorted, pinnedCategorySet, pinnedScrKeySet]);

  const dayAgg = useMemo(() => {
    const agg = {};
    deadlines.forEach(it => {
      const iso = toISODateSafe(it.date || it.dateText || it.text || it.event);
      if (!iso) return;
      (agg[iso] ||= { count: 0, items: [] });
      agg[iso].count += 1;
      agg[iso].items.push({ event: it.event, category: it.category, date: iso, _source:'scraped' });
    });
    userEvents.forEach(e => {
      const iso = toYMD(new Date(e.start));
      (agg[iso] ||= { count: 0, items: [] });
      agg[iso].count += 1;
      agg[iso].items.push({ event: e.title, category: e.category || 'personal', date: iso, _source:'personal' });
    });
    return agg;
  }, [deadlines, userEvents]);

  useEffect(() => {
    if (!includePast || groupedView) return;
    if (firstUpcomingIdx < 0) return;
    const el = listRef.current?.querySelector(`[data-idx="${firstUpcomingIdx}"]`);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [includePast, groupedView, firstUpcomingIdx, filteredDeadlines]);

  /* ===== layout ===== */
  const pageStyle = {
    padding: '1.25rem',
    minHeight: '100vh',
    background: 'var(--page-bg)'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 280px) 1fr',
    gap: '1.25rem',
    alignItems: 'start'
  };

  const card = {
    background: 'var(--widget-bg)',
    border: '1px solid rgba(148,163,184,0.4)',
    borderRadius: 12,
    padding: '1rem'
  };

  const CONTACTS = [
    { name: 'Financial Aid',     phone: '425-352-5240', email: 'uwbfaid@uw.edu' },
    { name: 'Registration',      phone: '425-352-5000', email: 'uwbreg@uw.edu' },
    { name: 'Admissions',        phone: '425-352-5000', email: 'uwbinfo@uw.edu' },
    { name: 'Academic Advising', phone: null,           email: 'uwbadvis@uw.edu', url: 'https://www.uwb.edu/advising/' }
  ];

  const telHref = (s) => `tel:${String(s).replace(/[^\d+]/g, '')}`;
  const ContactsCard = () => {
    const BTN = {
      padding: '10px 14px',
      border: '1px solid rgba(148,163,184,0.5)',
      borderRadius: 10,
      background: 'var(--widget-bg)',
      textDecoration: 'none',
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer'
    };

    return (
      <div style={card}>
        <h3 style={{ margin: '0 0 .75rem 0', fontSize: '1.3rem' }}>Campus Contacts</h3>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 16 }}>
          {CONTACTS.map((c, i) => (
            <li
              key={i}
              style={{
                border: '1px solid rgba(148,163,184,0.4)',
                borderRadius: 12,
                padding: 16,
                background: 'var(--widget-sub-bg)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 19 }}>{c.name}</strong>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 14, color: '#60a5fa', textDecoration: 'none' }}
                  >
                    Visit site ↗
                  </a>
                )}
              </div>

              <div style={{ fontSize: 16, marginTop: 8, display: 'grid', gap: 6, lineHeight: 1.45 }}>
                {c.phone && (
                  <div>
                    <span style={{ color: '#9ca3af' }}>Phone: </span>
                    <a href={telHref(c.phone)} style={{ fontWeight: 600 }}>{c.phone}</a>
                  </div>
                )}
                {c.email && (
                  <div>
                    <span style={{ color: '#9ca3af' }}>Email: </span>
                    <a href={`mailto:${c.email}`} style={{ fontWeight: 600 }}>{c.email}</a>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                {c.phone && <a href={telHref(c.phone)} style={BTN}>Call</a>}
                {c.email && <a href={`mailto:${c.email}`} style={BTN}>Email</a>}
                {c.url   && <a href={c.url} target="_blank" rel="noreferrer" style={BTN}>Website</a>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const togglePinKeyLocal = (k) => setPinnedKeys(prev => {
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const deletePersonal = async (mongoId, key) => {
    if (!mongoId) return;
    if (!window.confirm('Delete this personal event?')) return;
    try {
      await fetch(`${API}/api/events/${mongoId}`, { method: 'DELETE' });
      await refreshUserEvents(userEmail);
      setPinnedKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    } catch {
      alert('Failed to delete.');
    }
  };

  async function syncPinsToServer(email, pinsPayload) {
    if (!email) return;
    const res = await fetch(`${API}/api/pins/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pins: pinsPayload })
    });
    try {
      const data = await res.json();
      if (res.ok && Array.isArray(data.pins)) {
        setPinnedKeys(new Set(data.pins.map(p => p.key)));
      }
    } catch {}
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!userEmail) return alert('Please log in first.');
    if (!form.title.trim() || !form.date) return alert('Title and start date are required.');

    const startDate = new Date(form.date + 'T00:00:00');
    const endDate = form.endDate
      ? new Date(form.endDate + 'T00:00:00')
      : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
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

      await refreshUserEvents(userEmail);

      setAddOpen(false);
      setForm({ title:'', date:'', endDate:'', category:'personal', notes:'' });
      alert('Saved!');
    } catch (err) {
      alert(`Failed to save: ${String(err?.message || err)}`);
    } finally {
      setSaving(false);
    }
  }

  // NOTE: now accepts onAddEvent
  const RecommendedCard = ({ items, onAddEvent }) => {
    const keyFor = (it) =>
      `scr|${getISOFromItem(it) || ''}|${(it.event || it.title || '').toLowerCase().slice(0,80)}`;

    const [rows, setRows] = useState(items);
    const [exiting, setExiting] = useState(new Set());
    const [entering, setEntering] = useState(new Set());

    useEffect(() => {
      const prevKeys = rows.map(keyFor);
      const nextKeys = items.map(keyFor);

      const toAdd    = items.filter(it => !prevKeys.includes(keyFor(it)));
      const toRemove = prevKeys.filter(k => !nextKeys.includes(k));

      if (!toAdd.length && !toRemove.length) return;

      setRows(prev => {
        const map = new Map(prev.map(it => [keyFor(it), it]));
        toAdd.forEach(it => map.set(keyFor(it), it));
        const ordered = [
          ...items,
          ...[...map.values()].filter(it => !nextKeys.includes(keyFor(it)))
        ];
        return ordered;
      });

      if (toAdd.length) {
        setEntering(prev => {
          const next = new Set(prev);
          toAdd.forEach(it => next.add(keyFor(it)));
          return next;
        });
        setTimeout(() => {
          setEntering(prev => {
            const next = new Set(prev);
            toAdd.forEach(it => next.delete(keyFor(it)));
            return next;
          });
        }, 300);
      }

      if (toRemove.length) {
        setExiting(prev => {
          const next = new Set(prev);
          toRemove.forEach(k => next.add(k));
          return next;
        });
        setTimeout(() => {
          setRows(cur => cur.filter(it => !toRemove.includes(keyFor(it))));
          setExiting(prev => {
            const next = new Set(prev);
            toRemove.forEach(k => next.delete(k));
            return next;
          });
        }, 250);
      }
    }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div style={card}>
        <style>{`
          .reco-item { transition: opacity .25s ease, transform .25s ease; }
          .reco-enter { opacity: 0; transform: translateY(4px); }
          .reco-exit  { opacity: 0; transform: translateY(-4px); }
        `}</style>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ marginTop: 0 }}>Recommended Deadlines</h3>
          {onAddEvent && (
            <button
              type="button"
              onClick={onAddEvent}
              style={{
                padding:'0.35rem 0.6rem',
                border:'1px solid #6a6a6a',
                background:'var(--widget-bg)',
                borderRadius:6,
                cursor:'pointer'
              }}
              title="Add a personal event"
            >
              + Add Event
            </button>
          )}
        </div>

        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {rows.length > 0 ? (
            <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display:'grid', gap:8 }}>
              {rows.map((item, i) => {
                const k = keyFor(item);
                const isPinned = pinnedKeys.has(k);
                const cls = [
                  'reco-item',
                  entering.has(k) ? 'reco-enter' : '',
                  exiting.has(k)  ? 'reco-exit'  : ''
                ].join(' ').trim();

                const canvasStripe = isCanvasItem(item)
                  ? { boxShadow: '0 -3px 0 #8b5cf6, 0 3px 0 #8b5cf6' }
                  : {};

                return (
                  <li
                    key={`reco-${k}-${i}`}
                    className={`${cls} deadline-row ${urgencyClass(item.date)}`}
                    style={{
                      padding:'1rem 12px',
                      borderTop:'1px solid #4b5563',
                      display:'flex',
                      gap:'.75rem',
                      alignItems:'center',
                      justifyContent:'space-between',
                      ...canvasStripe
                    }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0, flex:1 }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'baseline', gap:8, minWidth:0 }}>
                          <strong style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {item.event || 'Untitled'}
                          </strong>
                          <span style={{
                            fontSize:11, color:'#e5e7eb', textTransform:'capitalize',
                            border: isCanvasItem(item) ? '1px solid #8b5cf6' : '1px solid #4b5563',
                            borderRadius:999, padding:'2px 6px'
                          }}>
                            {item.category || 'other'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={DATE_BADGE_STYLE}>{fmtDate(item.date)}</span>
                      <button
                        type="button"
                        disabled={!userEmail}
                        onClick={() => togglePinOnServer(buildScrapedPayload(item))}
                        style={PIN_BADGE_STYLE}
                        title={isPinned ? 'Unpin' : 'Pin'}
                      >
                        {isPinned ? '★ Unpin' : '☆ Pin'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>Nothing to recommend right now.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={pageStyle}>
      <style>{`
        .fc-mini .fc-daygrid-day-number {
          display:block; width:100%; text-align:center;
          font-weight:700; color:#111; padding:0; margin:0;
        }
        .fc-mini a.fc-count-link {
          text-decoration: underline;
          color: #1d4ed8;
          font-weight: 700;
          cursor: pointer;
        }
        .fc-mini a.fc-count-link:focus {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
          border-radius: 4px;
        }  
        .deadline-row{
          --bg: transparent; --ring: transparent;
          background: var(--bg);
          border-left: 4px solid var(--ring);
          border-radius: 8px;
          transition: background-color .12s ease, box-shadow .12s ease;
        }
        .deadline-row:hover{
          background: #1f2933;
          box-shadow: 0 0 0 1px #4b5563 inset;
        }
        .deadline-row:focus-within{
          background: #1f2933;
          box-shadow: 0 0 0 2px #60a5fa inset;
        }
        .deadline-row.u-1w    { --bg: rgba(239, 68,  68, .08);  --ring: #f87171; }
        .deadline-row.u-2w    { --bg: rgba(245, 158, 11, .10);  --ring: #f59e0b; }
        .deadline-row.u-later { --bg: rgba( 16, 185,129, .08);  --ring: #34d399; }
        .deadline-row.u-past  { --bg: rgba(107, 114,128, .06);  --ring: #9ca3af; }
      `}</style>

      <div
        style={{
          display:'flex',
          alignItems:'center',
          justifyContent:'space-between',
          marginBottom: 12,
          paddingBottom: 4,
          borderBottom: '1px solid rgba(148,163,184,0.35)'
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h1 style={{ margin: 0 }}>Student Dashboard</h1>
        </div>
        <p style={{ marginTop: 4 }}>Welcome, <strong>{userEmail || '...'}</strong></p>
      </div>

      <div className={`drawer ${navOpen ? 'open' : ''}`} aria-hidden={!navOpen}>
        <div className="backdrop" onClick={() => setNavOpen(false)} role="button" tabIndex={-1} aria-label="Close menu" />
        <aside className="panel" role="dialog" aria-modal="true" aria-label="Main navigation" onClick={(e) => e.stopPropagation()} />
      </div>

      <div style={gridStyle}>
        {/* LEFT */}
        <aside style={{ display: 'grid', gap: '1rem', fontSize: 15, lineHeight: 1.35 }}>
          <ContactsCard />
        </aside>

        {/* RIGHT */}
        <main style={{ display: 'grid', gap: '1rem' }}>
          {/* Upcoming 4 Weeks (sharpened, using shared card style) */}
          <div style={card}>
            <h3 style={{ marginTop: 0 }}>Upcoming 4 Weeks</h3>
            <UpcomingLoadChart items={filteredDeadlines} weeks={4} />
          </div>

          {/* Pinned (personal auto + any pinned scraped) */}
          {pinnedItems.length > 0 && (
            <div style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h3 style={{ marginTop: 0 }}>Pinned Deadlines</h3>
                <button
                  onClick={() => setAddOpen(true)}
                  style={{
                    padding:'0.35rem 0.6rem',
                    border:'1px solid #6a6a6a',
                    background:'var(--widget-bg)',
                    borderRadius:6,
                    cursor:'pointer'
                  }}
                  title="Add a personal event"
                >
                  + Add Event
                </button>
              </div>
              <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0, display: 'grid', gap: 8 }}>
                {pinnedItems.map((item, i) => {
                  const isPersonal = item._source === 'personal';
                  const canvasStripe = !isPersonal && isCanvasItem(item)
                    ? { boxShadow: '0 -3px 0 #8b5cf6, 0 3px 0 #8b5cf6' }
                    : {};

                  return (
                    <li
                      key={`pin-${item._key}-${i}`}
                      className={`deadline-row ${urgencyClass(item.date)}`}
                      style={{
                        border: '1px solid #4b5563',
                        borderRadius: 8,
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        justifyContent:'space-between',
                        ...canvasStripe
                      }}
                    >
                      <div style={{ flex: 1, minWidth:0 }}>
                        <div style={{ fontWeight: 600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {item.event}
                          {isPersonal && (
                            <span style={{
                              marginLeft:8,
                              fontSize:11,
                              color:'#e5e7eb',
                              border:'1px solid #4b5563',
                              borderRadius:999,
                              padding:'2px 6px'
                            }}>
                              personal
                            </span>
                          )}
                        </div>
                        {!isPersonal && (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#9ca3af',
                              textTransform: 'capitalize'
                            }}
                          >
                            {item.category || 'other'}
                          </div>
                        )}
                      </div>
                      <span style={DATE_BADGE_STYLE}>{fmtDate(item.date)}</span>
                      <div style={{ display:'flex', gap:8 }}>
                        {isPersonal ? (
                          <button
                            type="button"
                            onClick={() => deletePersonal(item._id, item._key)}
                            style={{
                              border: '1px solid #b91c1c',
                              padding: '0.25rem 0.5rem',
                              borderRadius: 6,
                              cursor: 'pointer',
                              background:'#7f1d1d',
                              color:'#fee2e2'
                            }}
                            title="Delete personal event"
                          >
                            🗑 Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!userEmail}
                            onClick={() => togglePinOnServer({ key: item._key })}
                            style={PIN_BADGE_STYLE}
                            title="Unpin"
                          >
                            ★ Unpin
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {loadingEvents && <div style={{ marginTop:8, fontSize:12, color:'#9ca3af' }}>Loading personal events…</div>}
            </div>
          )}

          {groupedView ? (
            <div style={card}>
              <h3 style={{ marginTop: 0 }}>Deadlines by Category</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
                marginTop: 8
              }}>
                {Object.keys(grouped).sort().map(cat => (
                  <div
                    key={cat}
                    style={{
                      border: '1px solid rgba(148,163,184,0.4)',
                      borderRadius: 8,
                      padding: '12px',
                      background: 'var(--widget-bg)'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8
                    }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', textTransform: 'capitalize' }}>
                        {cat.replace('-', ' ')}
                      </h4>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{grouped[cat].length}</span>
                    </div>
                    <ul style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      maxHeight: 320,
                      overflowY: 'auto'
                    }}>
                      {grouped[cat].map((item, index) => {
                        const k = keyForScraped(item);
                        const isPinned = pinnedKeys.has(k);
                        const canvasStripe = isCanvasItem(item)
                          ? { boxShadow: '0 -3px 0 #8b5cf6, 0 3px 0 #8b5cf6' }
                          : {};

                        return (
                          <li
                            key={`${cat}-${index}`}
                            className={`deadline-row ${urgencyClass(item.date)}`}
                            style={{
                              padding: '8px 0',
                              borderTop: '1px solid #4b5563',
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              justifyContent:'space-between',
                              ...canvasStripe
                            }}
                          >
                            <div style={{ minWidth:0 }}>
                              <span style={{
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.event || 'Untitled'}
                              </span>
                              <div style={{
                                fontSize: 12,
                                color: '#9ca3af',
                                textTransform: 'capitalize'
                              }}>
                                {item.category || 'other'}
                              </div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={DATE_BADGE_STYLE}>{fmtDate(item.date)}</span>
                              <button
                                type="button"
                                disabled={!userEmail}
                                onClick={() => togglePinOnServer(buildScrapedPayload(item))}
                                style={PIN_BADGE_STYLE}
                                title={isPinned ? 'Unpin' : 'Pin'}
                              >
                                {isPinned ? '★ Unpin' : '☆ Pin'}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <RecommendedCard
              items={recommended}
              onAddEvent={() => setAddOpen(true)}
            />
          )}

          {/* (Your mini-calendar + Add Event modal can remain as-is below) */}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
