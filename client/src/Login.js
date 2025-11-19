import { useState } from 'react';
import { Link } from 'react-router-dom';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const base = process.env.REACT_APP_API_URL;
      if (!base) {
        throw new Error('REACT_APP_API_URL is not set');
      }
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage('Login successful!');
        onLogin(data.token);
      } else {
        setStatus('error');
        setMessage(data.message || 'Login failed');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong');
    }
  };

  // === layout + styles ===
  const outer = {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '4.5rem', // leave room for top nav
    paddingBottom: '2.5rem',
    paddingInline: '2rem',
    background:
      'radial-gradient(700px 700px at 100% 0%, rgba(79,70,229,.10) 0%, rgba(79,70,229,0) 55%), linear-gradient(180deg,#f3f4f6 0%, #ffffff 60%)'
  };

  const inner = {
    width: 'min(1120px, 100%)',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
    gap: '3rem',
    alignItems: 'center'
  };

  // Left hero panel
  const hero = {
    background: 'linear-gradient(135deg,#020617,#111827)',
    borderRadius: 18,
    padding: '2.1rem 2.25rem',
    color: '#e5e7eb',
    boxShadow: '0 24px 60px rgba(15,23,42,.55)',
    border: '1px solid rgba(148,163,184,0.35)'
  };
  const heroTitle = {
    margin: '1rem 0 .75rem',
    fontSize: 30,
    lineHeight: 1.15,
    fontWeight: 700,
    color: '#f9fafb'
  };
  const heroBody = {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: '#cbd5f5'
  };
  const heroList = {
    margin: '1.25rem 0 0',
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gap: 8,
    fontSize: 14.5,
    color: '#e5e7eb'
  };
  const heroBulletRow = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8
  };
  const heroBulletIcon = {
    marginTop: 2,
    width: 18,
    height: 18,
    borderRadius: '999px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(52,211,153,0.15)',
    color: '#6ee7b7',
    fontSize: 12,
    flexShrink: 0
  };

  // Right auth card
  const card = {
    width: 'min(440px, 100%)',
    background: '#fff',
    border: '1px solid #dbe2ff',
    borderRadius: 16,
    boxShadow: '0 28px 60px rgba(36,41,66,.12), 0 8px 20px rgba(36,41,66,.06)',
    padding: '1.6rem 1.5rem 1.5rem'
  };

  const title = { margin: '0 0 .5rem 0', fontSize: 26, lineHeight: 1.2 };
  const sub = { margin: 0, color: '#6b7280', fontSize: 14.5 };

  const label = { fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#111827' };
  const input = {
    width: '100%',
    height: 46,
    border: '1px solid #d1d5db',
    borderRadius: 10,
    padding: '10px 12px',
    boxSizing: 'border-box',
    fontSize: 15.5,
    color: '#111827',
    background: '#fff'
  };
  const btn = {
    width: '100%',
    height: 46,
    border: '1px solid #4f46e5',
    background: status === 'loading' ? '#4338ca' : '#4f46e5',
    color: '#fff',
    fontWeight: 700,
    borderRadius: 10,
    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
    boxShadow: status === 'loading'
      ? '0 0 0 0 rgba(79,70,229,0)'
      : '0 10px 30px rgba(79,70,229,.35)'
  };
  const msg = {
    marginTop: 10,
    fontSize: 14,
    color: status === 'success' ? '#065f46' : '#b91c1c',
    background: status === 'success' ? '#ecfdf5' : '#fef2f2',
    border: `1px solid ${status === 'success' ? '#a7f3d0' : '#fecaca'}`,
    padding: '8px 10px',
    borderRadius: 8
  };

  return (
    <div className="login-wrap" style={outer}>
      <style>{`
        .login-input:focus {
          outline: 3px solid #c7d2fe;
          border-color: #818cf8;
        }
        .pwd-wrap { position: relative; }
        .pwd-toggle {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 12px;
          cursor: pointer;
        }
        .pwd-toggle:focus { outline: 2px solid #c7d2fe; }

        /* Create account link */
        .cta-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          text-decoration: none;
          color: #4f46e5;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          padding: 8px 10px;
          border-radius: 10px;
        }
        .cta-link:hover { background: #e0e7ff; }

        /* Responsive tweaks */
        @media (max-width: 1200px) {
          .login-wrap {
            padding-inline: 1.75rem !important;
          }
        }
        @media (max-width: 1024px) {
          .login-wrap {
            justify-content: center;
            padding-inline: 1.75rem !important;
          }
          .login-hero {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .login-wrap {
            padding-inline: 1.25rem !important;
            padding-top: 4rem !important;
          }
        }
      `}</style>

      <div className="login-inner" style={inner}>
        {/* LEFT: Hero / marketing panel */}
        <section className="login-hero" style={hero}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(79,70,229,.16)',
              fontSize: 11.5,
              fontWeight: 600,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: '#c7d2fe'
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '999px',
                background: '#22c55e',
                boxShadow: '0 0 0 4px rgba(34,197,94,0.35)'
              }}
            />
            <span>Student success workspace</span>
          </div>

          <h1 style={heroTitle}>Stay ahead of UW deadlines.</h1>
          <p style={heroBody}>
            Sparely pulls in UW Bothell academic dates and turns them into a simple,
            personalized timeline so you never miss a registration or financial aid milestone.
          </p>

          <ul style={heroList}>
            <li style={heroBulletRow}>
              <span style={heroBulletIcon}>✓</span>
              <span>Smart reminders before add/drop, registration, and tuition deadlines.</span>
            </li>
            <li style={heroBulletRow}>
              <span style={heroBulletIcon}>✓</span>
              <span>Combine official UW dates with your own personal events.</span>
            </li>
            <li style={heroBulletRow}>
              <span style={heroBulletIcon}>✓</span>
              <span>One place to see what matters this week, month, and quarter.</span>
            </li>
          </ul>

          <p style={{ marginTop: '1.4rem', fontSize: 13, color: '#9ca3af' }}>
            Designed for UW students who juggle classes, work, and everything in between.
          </p>
        </section>

        {/* RIGHT: Login card */}
        <form onSubmit={handleLogin} style={card} noValidate>
          <h1 style={title}>Welcome back</h1>
          <p style={sub}>Sign in to continue to your dashboard.</p>

          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            <div>
              <label style={label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="login-input"
                type="email"
                placeholder="you@uw.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={input}
              />
            </div>

            <div>
              <label style={label} htmlFor="password">
                Password
              </label>
              <div className="pwd-wrap">
                <input
                  id="password"
                  className="login-input"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...input, paddingRight: 80 }}
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 2
              }}
            >
              <Link to="/register" className="cta-link">
                Create an account
              </Link>
              {/* placeholder for future "Forgot password" flow */}
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                UW student? Use your <strong>@uw.edu</strong> email.
              </span>
            </div>

            <button type="submit" style={btn} disabled={status === 'loading'}>
              {status === 'loading' ? 'Signing in…' : 'Sign in'}
            </button>

            {message && (
              <div role="status" aria-live="polite" style={msg}>
                {message}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
