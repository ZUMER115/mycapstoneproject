// src/pages/Login.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom'; // ⬅️ add this

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
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) { setStatus('success'); setMessage('Login successful!'); onLogin(data.token); }
      else { setStatus('error'); setMessage(data.message || 'Login failed'); }
    } catch {
      setStatus('error'); setMessage('Something went wrong');
    }
  };

  // layout + styles
  const outer = {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingTop: '4.5rem',
    paddingLeft: '1rem',
    paddingBottom: '2rem',
    paddingRight: '12rem',
    background:
      'radial-gradient(700px 700px at 100% 0%, rgba(79,70,229,.10) 0%, rgba(79,70,229,0) 55%), linear-gradient(180deg,#f3f4f6 0%, #ffffff 60%)'
  };

  const card = {
    width: 'min(440px, 92vw)',
    background: '#fff',
    border: '1px solid #dbe2ff',
    borderRadius: 16,
    boxShadow: '0 28px 60px rgba(36,41,66,.12), 0 8px 20px rgba(36,41,66,.06)',
    padding: '1.25rem 1.25rem 1.35rem'
  };

  const title = { margin: '0 0 .75rem 0', fontSize: 28, lineHeight: 1.1 };
  const sub   = { margin: 0, color: '#6b7280', fontSize: 14 };

  const label = { fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#111827' };
  const input = {
    width: '100%', height: 46,
    border: '1px solid #d1d5db', borderRadius: 10,
    padding: '10px 12px', boxSizing: 'border-box',
    fontSize: 16, color: '#111827', background: '#fff'
  };
  const btn = {
    width: '100%', height: 46,
    border: '1px solid #4f46e5', background: '#4f46e5',
    color: '#fff', fontWeight: 700, borderRadius: 10,
    cursor: status === 'loading' ? 'not-allowed' : 'pointer'
  };
  const msg = {
    marginTop: 10, fontSize: 14,
    color: status === 'success' ? '#065f46' : '#b91c1c',
    background: status === 'success' ? '#ecfdf5' : '#fef2f2',
    border: `1px solid ${status === 'success' ? '#a7f3d0' : '#fecaca'}`,
    padding: '8px 10px', borderRadius: 8
  };

  return (
    <div className="login-wrap" style={outer}>
      <style>{`
        .login-input:focus { outline: 3px solid #c7d2fe; border-color: #818cf8; }
        .pwd-wrap { position: relative; }
        .pwd-toggle {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          border: 1px solid #d1d5db; background: #fff; border-radius: 8px;
          padding: 6px 8px; font-size: 12px; cursor: pointer;
        }
        .pwd-toggle:focus { outline: 2px solid #c7d2fe; }

        /* Create account link */
        .cta-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-weight: 600; text-decoration: none; color: #4f46e5;
          background: #eef2ff; border: 1px solid #c7d2fe;
          padding: 8px 10px; border-radius: 10px;
        }
        .cta-link:hover { background: #e0e7ff; }

        /* Responsive nudges */
        @media (max-width: 1200px) { .login-wrap { padding-right: 8rem !important; } }
        @media (max-width: 900px)  { .login-wrap { padding-right: 3rem !important; } }
        @media (max-width: 640px)  { .login-wrap { justify-content: center; padding-right: 1rem !important; } }
      `}</style>

      <form onSubmit={handleLogin} style={card} noValidate>
        <h1 style={title}>Welcome back</h1>
        <p style={sub}>Sign in to continue to your dashboard</p>

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <div>
            <label style={label} htmlFor="email">Email</label>
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
            <label style={label} htmlFor="password">Password</label>
            <div className="pwd-wrap">
              <input
                id="password"
                className="login-input"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                required
                style={{ ...input, paddingRight: 80 }}
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowPwd(s => !s)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* ⬇️ New: Create account option ABOVE the Sign in button */}
          <div style={{ margin: '2px 0 2px' }}>
            <Link to="/register" className="cta-link">
              Create an account
            </Link>
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
  );
};

export default Login;
