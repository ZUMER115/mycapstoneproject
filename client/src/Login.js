// src/pages/Login.jsx
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
        body: JSON.stringify({ email, password }),
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

  // base layout styles
  const outer = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4.5rem 1rem 2rem',
    boxSizing: 'border-box',
    background:
      'linear-gradient(135deg, #2f3fe4 0%, #7b2ff7 30%, #ff3cac 65%, #ff9a62 100%)',
  };

  const card = {
    width: 'min(420px, 95vw)',
    background: '#ffffff',
    borderRadius: 18,
    boxShadow:
      '0 24px 70px rgba(15,23,42,.28), 0 10px 30px rgba(15,23,42,.16)',
    padding: '2.1rem 2.3rem 2.0rem',
    boxSizing: 'border-box',
  };

  const title = {
    margin: '0 0 0.25rem 0',
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'center',
    color: '#0f172a',
  };

  const sub = {
    margin: 0,
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  };

  const label = {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 6,
    color: '#111827',
  };

  const input = {
    width: '100%',
    height: 44,
    border: '1px solid #d1d5db',
    borderRadius: 999,
    padding: '0 12px',
    boxSizing: 'border-box',
    fontSize: 14,
    color: '#111827',
    background: '#ffffff',
  };

  const btn = {
    width: '100%',
    height: 46,
    borderRadius: 999,
    border: 'none',
    background:
      'linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
    color: '#ffffff',
    fontWeight: 700,
    letterSpacing: 0.4,
    fontSize: 14,
    cursor: status === 'loading' ? 'not-allowed' : 'pointer',
    boxShadow: '0 10px 25px rgba(99,102,241,.45)',
  };

  const msg = {
    marginTop: 10,
    fontSize: 13,
    color: status === 'success' ? '#065f46' : '#b91c1c',
    background: status === 'success' ? '#ecfdf5' : '#fef2f2',
    border: `1px solid ${status === 'success' ? '#a7f3d0' : '#fecaca'}`,
    padding: '8px 10px',
    borderRadius: 10,
  };

  return (
    <div className="login-page" style={outer}>
      <style>{`
        .login-input:focus {
          outline: none;
          border-color: #818cf8;
          box-shadow: 0 0 0 2px rgba(129,140,248,.45);
        }

        .pwd-wrap {
          position: relative;
        }
        .pwd-toggle {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          font-size: 12px;
          font-weight: 600;
          color: #4b5563;
          cursor: pointer;
        }
        .pwd-toggle:focus {
          outline: 2px solid #c7d2fe;
          border-radius: 999px;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 10px 0 4px;
          font-size: 12px;
          color: #6b7280;
        }
        .login-divider::before,
        .login-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }

        .social-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 4px;
        }
        .social-btn {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(15,23,42,.25);
        }
        .social-btn.fb    { background: #1877f2; }
        .social-btn.tt    { background: #0f172a; }
        .social-btn.gg    { background: #ea4335; }

        .login-footer {
          margin-top: 10px;
          font-size: 13px;
          text-align: center;
          color: #4b5563;
        }
        .login-footer a {
          color: #4f46e5;
          font-weight: 600;
          text-decoration: none;
        }
        .login-footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .login-page {
            padding-top: 5rem !important;
          }
        }
      `}</style>

      <form onSubmit={handleLogin} style={card} noValidate>
        <h1 style={title}>Login</h1>
        <p style={sub}>Sign in to access your dashboard</p>

        <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
          {/* Email */}
          <div>
            <label style={label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="login-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={input}
            />
          </div>

          {/* Password */}
          <div>
            <label style={label} htmlFor="password">
              Password
            </label>
            <div className="pwd-wrap">
              <input
                id="password"
                className="login-input"
                type={showPwd ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ ...input, paddingRight: 70 }}
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
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                textAlign: 'right',
                color: '#4b5563',
              }}
            >
              {/* Placeholder only; you can wire this later */}
              <span style={{ opacity: 0.8 }}>Forgot password?</span>
            </div>
          </div>

          {/* Primary login button */}
          <button type="submit" style={btn} disabled={status === 'loading'}>
            {status === 'loading' ? 'Signing in…' : 'LOGIN'}
          </button>

          {/* Message */}
          {message && (
            <div role="status" aria-live="polite" style={msg}>
              {message}
            </div>
          )}

          {/* Divider + social row (visual only) */}
          <div className="login-divider">Or sign in with</div>
          <div className="social-row" aria-hidden="true">
            <button type="button" className="social-btn fb">
              f
            </button>
            <button type="button" className="social-btn tt">
              x
            </button>
            <button type="button" className="social-btn gg">
              G
            </button>
          </div>

          {/* Footer sign-up link */}
          <div className="login-footer">
            Don&apos;t have an account?{' '}
            <Link to="/register">Sign up</Link>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Login;
