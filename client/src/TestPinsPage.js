// client/src/TestPinsPage.js
import { jwtDecode } from 'jwt-decode';
import { useEffect, useMemo, useState } from 'react';

const pageStyle = { padding: '1.25rem', background: '#f7f8fa', minHeight: '100vh' };
const card      = { background: '#fff', border: '1px solid #e6e8eb', borderRadius: 12, padding: '1rem' };
const tableCss  = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 14,
};
const thTd = { borderBottom: '1px solid #eee', padding: '8px 10px', textAlign: 'left' };
const badge = (bg, color = '#111') => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12,
  background: bg, color, border: '1px solid rgba(0,0,0,.06)'
});

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toISODateSafe(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    return isNaN(d) ? null : toYMD(d);
  }
  m = s.match(/^([A-Za-z.]+)\s(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const MONTHS = { january:0, jan:0, february:1, feb:1, march:2, mar:2, april:3, apr:3, may:4, june:5, jun:5, july:6, jul:6, august:7, aug:7, september:8, sep:8, sept:8, october:9, oct:9, november:10, nov:10, december:11, dec:11 };
    const mi = MONTHS[m[1].toLowerCase().replace(/\.$/, '')];
    const d = new Date(Number(m[3]), mi, Number(m[2]));
    return (mi == null || isNaN(d)) ? null : toYMD(d);
  }
  m = s.match(/^([A-Za-z.]+)\s(\d{1,2})\s*[-–]\s*([A-Za-z.]+)?\s*(\d{1,2}),\s*(\d{4})$/);
  if (m) return toISODateSafe(`${m[1]} ${m[2]}, ${m[5]}`);

  const dflt = new Date(s);
  return isNaN(dflt) ? null : toYMD(dflt);
}
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const dt = new Date(s);
  return isNaN(dt) ? s : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function csvEscape(v = '') {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function exportPinsToCSV(pins = [], filename = 'pins.csv') {
  const header = ['Date', 'Event', 'Category', 'Source', 'Key'];
  const body = (pins || []).map(p =>
    [csvEscape(p.dateISO), csvEscape(p.event), csvEscape(p.category), csvEscape(p.source), csvEscape(p.key)].join(',')
  );
  const csv = [header.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function TestPinsPage() {
  const [userEmail, setUserEmail] = useState('');     // from JWT
  const [emailOverride, setEmailOverride] = useState(''); // manual testing
  const effectiveEmail = (emailOverride || userEmail || '').toLowerCase();

  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Get email from JWT if present
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      if (decoded?.email) setUserEmail(decoded.email);
    } catch {/* ignore */}
  }, []);

  async function fetchPins(email) {
    if (!email) {
      setPins([]);
      setErr('No email (JWT) found. Enter an email override to test.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`http://localhost:5000/api/pins?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load pins');
      const arr = Array.isArray(data?.pins) ? data.pins : [];
      // Normalize date for safety
      const normalized = arr.map(p => ({
        ...p,
        dateISO: toISODateSafe(p.dateISO || p.date) || '',
        category: String(p.category || 'other').toLowerCase(),
        source: p.source || (String(p.key || '').startsWith('me|') ? 'personal' : 'scraped'),
      }));
      setPins(normalized);
    } catch (e) {
      setErr(e?.message || String(e));
      setPins([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (effectiveEmail) fetchPins(effectiveEmail); }, [effectiveEmail]);

  // Simple stats
  const stats = useMemo(() => {
    const byCategory = pins.reduce((acc, p) => {
      (acc[p.category] ||= 0);
      acc[p.category] += 1;
      return acc;
    }, {});
    const upcomingCount = pins.filter(p => {
      if (!p.dateISO) return false;
      const today = new Date(); today.setHours(0,0,0,0);
      return new Date(p.dateISO + 'T00:00:00') >= today;
    }).length;
    return { total: pins.length, upcomingCount, byCategory };
  }, [pins]);

  return (
    <div style={pageStyle}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 10 }}>
        <h1 style={{ margin: 0 }}>Test: Stored Pinned Deadlines</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ fontSize: 13.5, color:'#556' }}>
            JWT email: <strong>{userEmail || '—'}</strong>
          </div>
          <input
            placeholder="email override (optional)"
            value={emailOverride}
            onChange={e => setEmailOverride(e.target.value)}
            style={{ padding:'6px 8px', border:'1px solid #ccc', borderRadius:6 }}
          />
          <button
            onClick={() => fetchPins(effectiveEmail)}
            disabled={loading}
            style={{ border:'1px solid #aaa', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={() => exportPinsToCSV(pins, 'all-pins.csv')}
            disabled={!pins.length}
            style={{ border:'1px solid #aaa', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gap:'1rem' }}>
        <div style={card}>
          {err && (
            <div style={{ marginBottom:10, color:'#b91c1c', background:'#fef2f2', border:'1px solid #fecaca', padding:8, borderRadius:8 }}>
              {err}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div style={{ border:'1px solid #eef0f3', borderRadius:10, padding:10 }}>
              <div style={{ fontSize:12, color:'#667' }}>Total Pins</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{stats.total}</div>
            </div>
            <div style={{ border:'1px solid #eef0f3', borderRadius:10, padding:10 }}>
              <div style={{ fontSize:12, color:'#667' }}>Upcoming (≥ today)</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{stats.upcomingCount}</div>
            </div>
            <div style={{ border:'1px solid #eef0f3', borderRadius:10, padding:10 }}>
              <div style={{ fontSize:12, color:'#667' }}>Categories</div>
              <div>
                {Object.entries(stats.byCategory).length
                  ? Object.entries(stats.byCategory).map(([cat, n]) => (
                      <span key={cat} style={{ ...badge('#eef2ff', '#4338ca'), marginRight:6, marginTop:6, display:'inline-block' }}>
                        {cat} • {n}
                      </span>
                    ))
                  : <span style={{ color:'#667' }}>—</span>}
              </div>
            </div>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={tableCss}>
              <thead>
                <tr>
                  <th style={thTd}>#</th>
                  <th style={thTd}>Date</th>
                  <th style={thTd}>Event</th>
                  <th style={thTd}>Category</th>
                  <th style={thTd}>Source</th>
                  <th style={thTd}>Key</th>
                </tr>
              </thead>
<tbody>
  {pins.length ? pins.map((p, i) => {
    const isPast = p.dateISO
      ? new Date(p.dateISO + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0))
      : false;

    return (
      <tr key={`${p.key}-${i}`} style={{ background: isPast ? '#fafafa' : 'transparent' }}>
        <td style={thTd}>{i + 1}</td>
        <td style={thTd}>
          <span style={{ ...badge(isPast ? '#f3f4f6' : '#ecfdf5', isPast ? '#111' : '#065f46') }}>
            {p.dateISO ? fmtDate(p.dateISO) : '—'}
          </span>
        </td>
        <td style={thTd} title={p.event}>{p.event || 'Untitled'}</td>
        <td style={{ ...thTd, textTransform: 'capitalize' }}>{p.category || 'other'}</td>
        <td style={thTd}>{p.source || 'scraped'}</td>
        <td title={p.key} style={{ ...thTd, fontFamily: 'monospace' }}>{p.key}</td>
      </tr>
    );
  }) : (
    <tr>
      <td style={thTd} colSpan={6}>&nbsp;No pins returned.</td>
    </tr>
  )}
</tbody>

            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#667' }}>
            The list is returned by <code>/api/pins?email=…</code> in chronological order (<code>dateISO</code> asc, then <code>event</code>).
          </div>
        </div>
      </div>
    </div>
  );
}
