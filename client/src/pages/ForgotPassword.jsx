import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ForgotPassword() {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your email.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.message || 'Failed to send reset code.');
        setLoading(false);
        return;
      }

      setStatusMsg('If an account exists for this email, a reset code has been sent.');
      setStep('code');
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');

    if (!code.trim()) {
      setErrorMsg('Please enter the code sent to your email.');
      return;
    }
    if (!newPassword) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    if (newPassword !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.message || 'Failed to reset password.');
        setLoading(false);
        return;
      }

      setStatusMsg('Password reset successfully. Redirecting to login…');
      setTimeout(() => {
        navigate('/'); // login
      }, 1500);
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3.25rem 1rem 2rem',
        boxSizing: 'border-box',
        background:
          'linear-gradient(135deg, #2f3fe4 0%, #7b2ff7 30%, #ff3cac 65%, #ff9a62 100%)'
      }}
    >
      <div
        style={{
          width: 'min(420px, 95vw)',
          background: '#fff',
          borderRadius: 18,
          boxShadow:
            '0 24px 70px rgba(15,23,42,.28), 0 10px 30px rgba(15,23,42,.16)',
          padding: '2.1rem 2.3rem 2.0rem',
          boxSizing: 'border-box'
        }}
      >
        <h1
          style={{
            margin: '0 0 0.25rem 0',
            fontSize: 24,
            fontWeight: 700,
            textAlign: 'center',
            color: '#0f172a'
          }}
        >
          Forgot password
        </h1>
        <p
          style={{
            margin: 0,
            color: '#6b7280',
            fontSize: 14,
            textAlign: 'center'
          }}
        >
          {step === 'email'
            ? 'Enter the email associated with your Sparely account. We’ll send you a 6-digit code if an account exists.'
            : 'Enter the code we sent to your email and choose a new password.'}
        </p>

        {errorMsg && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '8px 10px',
              borderRadius: 10
            }}
          >
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: '#065f46',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '8px 10px',
              borderRadius: 10
            }}
          >
            {statusMsg}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleRequestCode} style={{ marginTop: 20 }}>
            <label
              htmlFor="fp-email"
              style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}
            >
              Email
            </label>
            <input
              id="fp-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                height: 44,
                border: '1px solid #d1d5db',
                borderRadius: 999,
                padding: '0 12px',
                boxSizing: 'border-box',
                fontSize: 14,
                color: '#111827',
                background: '#ffffff',
                marginBottom: 16
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
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
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 25px rgba(99,102,241,.45)'
              }}
            >
              {loading ? 'Sending…' : 'Send reset code'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                marginTop: 12,
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#4b5563',
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleResetPassword} style={{ marginTop: 20 }}>
            <label
              htmlFor="fp-code"
              style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}
            >
              Code
            </label>
            <input
              id="fp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={{
                width: '100%',
                height: 44,
                border: '1px solid #d1d5db',
                borderRadius: 999,
                padding: '0 12px',
                boxSizing: 'border-box',
                fontSize: 16,
                letterSpacing: '0.25em',
                color: '#111827',
                background: '#ffffff',
                marginBottom: 16
              }}
            />

            <label
              htmlFor="fp-newpwd"
              style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}
            >
              New password
            </label>
            <input
              id="fp-newpwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{
                width: '100%',
                height: 44,
                border: '1px solid #d1d5db',
                borderRadius: 999,
                padding: '0 12px',
                boxSizing: 'border-box',
                fontSize: 14,
                color: '#111827',
                background: '#ffffff',
                marginBottom: 12
              }}
            />

            <label
              htmlFor="fp-confpwd"
              style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}
            >
              Confirm new password
            </label>
            <input
              id="fp-confpwd"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              style={{
                width: '100%',
                height: 44,
                border: '1px solid #d1d5db',
                borderRadius: 999,
                padding: '0 12px',
                boxSizing: 'border-box',
                fontSize: 14,
                color: '#111827',
                background: '#ffffff',
                marginBottom: 16
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: 46,
                borderRadius: 999,
                border: 'none',
                background:
                  'linear-gradient(90deg, #22c55e 0%, #16a34a 50%, #22c55e 100%)',
                color: '#022c22',
                fontWeight: 700,
                letterSpacing: 0.3,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 10px 25px rgba(22,163,74,.35)'
              }}
            >
              {loading ? 'Saving…' : 'Reset password'}
            </button>

            <button
              type="button"
              onClick={() => setStep('email')}
              style={{
                marginTop: 12,
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#4b5563',
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
