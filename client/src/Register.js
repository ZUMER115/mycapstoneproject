// src/pages/Register.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';

const Register = () => {                     // ⬅️ dropped onRegister, no auto-login here
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!email || !password || !confirm) {
      setStatus('error');
      setMessage('Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setStatus('loading');
    try {
      const base = process.env.REACT_APP_API_URL;
      if (!base) throw new Error('REACT_APP_API_URL is not set');

      const res = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('success');
        // 🔑 KEY CHANGE: message now tells user to verify email first
        setMessage(
          data.message ||
            'Account created. Check your email to verify your account before signing in.'
        );

        // optional: clear sensitive fields
        setPassword('');
        setConfirm('');
        // ⛔️ NO auto-login from register.
        // if (onRegister && data.token) onRegister(data.token);  // removed
      } else {
        setStatus('error');
        setMessage(data.message || 'Registration failed');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Something went wrong');
    }
  };

  // shared layout (matches Login.jsx)
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

  const inner = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  };

  const logo = {
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: 1.5,
    color: '#ffffff',
    textTransform: 'uppercase',
    textShadow: '0 16px 40px rgba(15,23,42,.65)',
    opacity: 0,
    animation: 'fadeInLogo 900ms ease-out forwards',
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
    fontSize: 26,
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
    <div className="auth-page" style={outer}>
      <style>{`
        @keyframes fadeInLogo {
          0%   { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .auth-input:focus {
          outline: none;
          border-color: #818cf8;
          box-shadow: 0 0 0 2px rgba(129,140,248,.45);
        }

        .auth-footer {
          margin-top: 10px;
          font-size: 13px;
          text-align: center;
          color: #4b5563;
        }
        .auth-footer a {
          color: #4f46e5;
          font-weight: 600;
          text-decoration: none;
        }
        .auth-footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 640px) {
          .auth-page {
            padding-top: 5rem !important;
          }
        }
      `}</style>

      <div style={inner}>
        {/* Fading Sparely wordmark */}
        <div style={logo}>Sparely</div>

        <form onSubmit={handleRegister} style={card} noValidate>
          <h1 style={title}>Create your account</h1>
          <p style={sub}>
            It only takes a moment. Then check your email to verify before signing in.
          </p>

          <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
            {/* Email */}
            <div>
              <label style={label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="auth-input"
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
              <input
                id="password"
                className="auth-input"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={input}
              />
            </div>

            {/* Confirm */}
            <div>
              <label style={label} htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                className="auth-input"
                type="password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                style={input}
              />
            </div>

            {/* Primary button */}
            <button type="submit" style={btn} disabled={status === 'loading'}>
              {status === 'loading' ? 'Creating account…' : 'Create account'}
            </button>

            {/* Status message */}
            {message && (
              <div role="status" aria-live="polite" style={msg}>
                {message}
              </div>
            )}

            {/* Footer */}
            <div className="auth-footer">
              Already have an account? <Link to="/">Sign in</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
