// src/pages/Profile.jsx
// At top of the file, define a base (optional but nicer)

import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';
const API_BASE =
  process.env.REACT_APP_API_BASE_URL;


export default function Profile() {
  const [email, setEmail] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // account-related state
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text: string }

  // ---- helpers ----
  const clampLead = (n) => {
    const x = Number.isFinite(n) ? Math.round(n) : 0;
    return Math.max(0, Math.min(30, x));
  };

  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem('theme', t);
    } catch {}
  };

  const getToken = () => {
    try {
      return localStorage.getItem('token') || '';
    } catch {
      return '';
    }
  };

  // Load user + preferences
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const e = decoded?.email || '';
      setEmail(e);

      if (!e) {
        setLoading(false);
        return;
      }

      fetch(`${API_BASE}/api/preferences/${encodeURIComponent(e)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load preferences'))))
        .then((p) => {
          const ltd = Number(p.lead_time_days ?? 3);
          const thm = p.theme || 'light';
          setLeadTimeDays(clampLead(ltd));
          setTheme(thm);
          applyTheme(thm);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch {
      setLoading(false);
    }
  }, []);

  // Save preferences
  const save = async () => {
    if (!email) {
      setMsg({ type: 'err', text: 'Please log in first.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          lead_time_days: clampLead(leadTimeDays),
          theme
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) throw new Error(data?.message || 'Save failed');

      const storedLead = Number(data.lead_time_days ?? leadTimeDays);
      const storedTheme = data.theme || theme;
      setLeadTimeDays(clampLead(storedLead));
      setTheme(storedTheme);
      applyTheme(storedTheme);

      setMsg({ type: 'ok', text: 'Preferences saved.' });
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  // ---- Update Email (no verification, requires current password) ----
  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!email) {
      setMsg({ type: 'err', text: 'Please log in first.' });
      return;
    }
    if (!newEmail.trim()) {
      setMsg({ type: 'err', text: 'Please enter a new email.' });
      return;
    }
    if (!currentPasswordForEmail) {
      setMsg({ type: 'err', text: 'Please enter your current password.' });
      return;
    }

    setUpdatingEmail(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/auth/change-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          currentPassword: currentPasswordForEmail,
          newEmail: newEmail.trim()
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) throw new Error(data?.message || 'Could not update email.');

      // Backend may return a fresh token; if so, store it and re-decode email
      if (data.token) {
        localStorage.setItem('token', data.token);
        try {
          const decoded = jwtDecode(data.token);
          setEmail(decoded?.email || newEmail.trim());
        } catch {
          setEmail(newEmail.trim());
        }
      } else {
        // fallback
        setEmail(newEmail.trim());
      }

      setNewEmail('');
      setCurrentPasswordForEmail('');
      setMsg({ type: 'ok', text: 'Email updated.' });
    } catch (err) {
      setMsg({ type: 'err', text: err?.message || 'Failed to update email.' });
    } finally {
      setUpdatingEmail(false);
    }
  };

  // ---- Change Password (old password + new password) ----
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!email) {
      setMsg({ type: 'err', text: 'Please log in first.' });
      return;
    }
    if (!currentPassword) {
      setMsg({ type: 'err', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword) {
      setMsg({ type: 'err', text: 'Please enter a new password.' });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: 'err', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'err', text: 'New passwords do not match.' });
      return;
    }

    setUpdatingPassword(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) throw new Error(data?.message || 'Could not change password.');

      // Optionally, backend may rotate token; if so, store it
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMsg({ type: 'ok', text: 'Password changed successfully.' });
    } catch (err) {
      setMsg({ type: 'err', text: err?.message || 'Failed to change password.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', maxWidth: 880, margin: '0 auto' }}>
        Loading profile…
      </div>
    );
  }

  const card = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '1rem'
  };

  return (
    <div style={{ padding: '1rem', maxWidth: 880, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Profile</h2>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Account */}
        <section style={card}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Account</h3>
          <div style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
            <div>
              <strong>Email:</strong> {email || '—'}
            </div>
          </div>

          {/* Update email */}
          <form
            onSubmit={handleEmailUpdate}
            style={{ display: 'grid', gap: 8, maxWidth: 420, marginTop: 8 }}
          >
            <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
              <span>New email</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
              <span>Current password (for confirmation)</span>
              <input
                type="password"
                value={currentPasswordForEmail}
                onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <button
              type="submit"
              disabled={updatingEmail}
              style={{
                marginTop: 4,
                padding: '0.6rem 1rem',
                border: 'none',
                borderRadius: 8,
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                width: 'fit-content'
              }}
            >
              {updatingEmail ? 'Updating email…' : 'Update email'}
            </button>
          </form>

          {/* Change password */}
          <form
            onSubmit={handlePasswordChange}
            style={{ display: 'grid', gap: 8, maxWidth: 420, marginTop: 20 }}
          >
            <h4 style={{ margin: '8px 0', fontSize: 15 }}>Change password</h4>

            <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 4, fontSize: 14 }}>
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </label>

            <button
              type="submit"
              disabled={updatingPassword}
              style={{
                marginTop: 4,
                padding: '0.6rem 1rem',
                border: 'none',
                borderRadius: 8,
                background: '#2563eb',
                color: '#fff',
                cursor: 'pointer',
                width: 'fit-content'
              }}
            >
              {updatingPassword ? 'Updating password…' : 'Change password'}
            </button>
          </form>
        </section>

        {/* Notifications */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Notifications</h3>
          <p style={{ marginTop: 4, color: '#555', fontSize: 14 }}>
            Choose how many days <em>before a deadline</em> you want reminders.
          </p>

          <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
            <label
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>Lead time (days):</span>
              <input
                type="number"
                min={0}
                max={30}
                step={1}
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(clampLead(parseInt(e.target.value, 10)))}
                style={{ width: 100, padding: '8px 10px' }}
              />
            </label>

            <small style={{ color: '#6b7280' }}>
              You’ll be alerted <strong>{leadTimeDays}</strong>{' '}
              {leadTimeDays === 1 ? 'day' : 'days'} before each upcoming deadline.
            </small>
          </div>
        </section>

        {/* Appearance */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Appearance</h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === 'light'}
                onChange={(e) => {
                  setTheme(e.target.value);
                  applyTheme(e.target.value);
                }}
              />
              Light
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={theme === 'dark'}
                onChange={(e) => {
                  setTheme(e.target.value);
                  applyTheme(e.target.value);
                }}
              />
              Dark
            </label>

            <button
              type="button"
              onClick={() => {
                setTheme((t) => {
                  const nxt = t === 'light' ? 'dark' : 'light';
                  applyTheme(nxt);
                  return nxt;
                });
              }}
              style={{
                marginLeft: 'auto',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              Preview Toggle
            </button>
          </div>
          <small style={{ color: '#6b7280', display: 'block', marginTop: 6 }}>
            The theme applies instantly for preview and is remembered. Click Save to update the
            server copy.
          </small>
        </section>

        {/* Actions / Status */}
        <section
          style={{
            ...card,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '0.6rem 1rem',
              border: 'none',
              borderRadius: 8,
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>

          <button
            type="button"
            onClick={() => {
              setLeadTimeDays(3);
              setTheme('light');
              applyTheme('light');
              setMsg({ type: 'ok', text: 'Reset locally (remember to Save).' });
            }}
            style={{
              padding: '0.6rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            Reset to defaults
          </button>

          {msg && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 14,
                color: msg.type === 'ok' ? '#065f46' : '#991b1b',
                background: msg.type === 'ok' ? '#d1fae5' : '#fee2e2',
                border: `1px solid ${msg.type === 'ok' ? '#10b981' : '#fca5a5'}`,
                padding: '6px 10px',
                borderRadius: 8
              }}
            >
              {msg.text}
            </span>
          )}
        </section>
      </div>
    </div>
  );
}
