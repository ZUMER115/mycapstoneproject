// src/pages/Profile.jsx
import { jwtDecode } from 'jwt-decode';
import { useEffect, useState } from 'react';

const API_BASE =
  process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function Profile() {
  const [email, setEmail] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);


  // account-related state
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [msg, setMsg] = useState(null); // { type: 'ok' | 'err', text: string }

  // Canvas ICS import state
  const [icsFile, setIcsFile] = useState(null);
  const [icsStatus, setIcsStatus] = useState('');
  const [icsLoading, setIcsLoading] = useState(false);
  const [campusPref, setCampusPref] = useState('uwb'); // 'uwb' | 'uws' | 'both'

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
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error('Failed to load preferences'))
        )
.then((p) => {
  const ltd = Number(p.lead_time_days ?? 3);
  const thm = p.theme || 'light';
  const campus = p.campus_preference || 'uwb'; // 👈 NEW
  const notif = p.notifications_enabled;

  setLeadTimeDays(clampLead(ltd));
  setTheme(thm);
  applyTheme(thm);
  setCampusPref(campus); // 👈 NEW
  setNotificationsEnabled(notif !== false);
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
  theme,
  campus_preference: campusPref, // 👈 NEW
  notifications_enabled: notificationsEnabled,
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
const storedCampus = data.campus_preference || campusPref; // 👈 NEW
const storedNotif = data.notifications_enabled; 

setLeadTimeDays(clampLead(storedLead));
setTheme(storedTheme);
applyTheme(storedTheme);
setCampusPref(storedCampus); // 👈 NEW
setNotificationsEnabled(storedNotif !== false);

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
const res = await fetch(`${API_BASE}/api/auth/email`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : ''
  },
  body: JSON.stringify({
    newEmail: newEmail.trim(),
    password: currentPasswordForEmail   // 👈 key name changed
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

  // ---- Canvas ICS handlers ----
  const handleIcsFileChange = (e) => {
    const file = e.target.files?.[0];
    setIcsFile(file || null);
    setIcsStatus('');
  };

  const handleIcsUpload = async () => {
    if (!icsFile) {
      setIcsStatus('Please choose a .ics file first.');
      return;
    }

    setIcsLoading(true);
    setIcsStatus('');

    try {
      const icsText = await icsFile.text(); // read file contents
      const token = getToken();

      const res = await fetch(`${API_BASE}/api/canvas/import-ics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ icsText })
      });

      if (res.status === 401) {
        throw new Error('Unauthorized – please log in again.');
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        console.error('Canvas import error:', res.status, text);
        throw new Error(data?.error || data?.message || 'Failed to import Canvas calendar.');
      }

      const imported = data.imported ?? 0;
      setIcsStatus(`Imported ${imported} Canvas events.`);
    } catch (err) {
      console.error('Canvas import failed:', err);
      setIcsStatus(err?.message || 'Failed to import Canvas calendar.');
    } finally {
      setIcsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '1rem', maxWidth: 880, margin: '0 auto' }}>
        Loading profile…
      </div>
    );
  }

  const card = 'profile-card';
  const labelClass = 'profile-label';
  const inputClass = 'profile-input';
  const primaryBtn = 'profile-btn primary';
  const secondaryBtn = 'profile-btn secondary';

  return (
    <div style={{ padding: '1rem', maxWidth: 880, margin: '0 auto' }}>
      {/* local styles just for this page */}
      <style>{`
        :root {
          --text-main: #111827;
          --text-muted: #4b5563;
          --input-border: #d1d5db;
          --input-bg: #ffffff;
          --btn-primary-bg: #2563eb;
          --btn-primary-bg-hover: #1d4ed8;
          --btn-primary-text: #ffffff;
          --btn-secondary-bg: #ffffff;
          --btn-secondary-border: #d1d5db;
          --btn-secondary-text: #111827;
        }
        [data-theme="dark"] {
          --text-main: #e5e7eb;
          --text-muted: #9ca3af;
          --input-border: #4b5563;
          --input-bg: #020617;
          --btn-primary-bg: #2563eb;
          --btn-primary-bg-hover: #1d4ed8;
          --btn-primary-text: #f9fafb;
          --btn-secondary-bg: #020617;
          --btn-secondary-border: #4b5563;
          --btn-secondary-text: #e5e7eb;
        }
        .profile-card {
          background: var(--widget-bg, #020617);
          border: 1px solid var(--border, rgba(148,163,184,0.5));
          border-radius: 12px;
          padding: 1rem;
        }
        .profile-label {
          display: grid;
          gap: 4px;
          font-size: 14px;
          color: var(--text-main);
        }
        .profile-input {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--input-border);
          background: var(--input-bg);
          color: var(--text-main);
        }
        .profile-input::placeholder {
          color: var(--text-muted);
        }
        .profile-btn {
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .profile-btn.primary {
          border: none;
          background: var(--btn-primary-bg);
          color: var(--btn-primary-text);
        }
        .profile-btn.primary:hover:not(:disabled) {
          background: var(--btn-primary-bg-hover);
        }
        .profile-btn.secondary {
          border: 1px solid var(--btn-secondary-border);
          background: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
        }
        .profile-btn:disabled {
          opacity: 0.7;
          cursor: default;
        }
        .profile-section-title {
          margin-top: 0;
          margin-bottom: 4px;
          font-size: 1.05rem;
          color: var(--text-main);
        }
        .profile-section-sub {
          margin-top: 0;
          margin-bottom: 12px;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>

      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Profile</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
          Manage your account, notifications, appearance, and Canvas import.
        </p>
      </header>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Account */}
        <section className={card}>
          <h3 className="profile-section-title">Account</h3>
          <p className="profile-section-sub">
            Update your primary email and password associated with your Sparely account.
          </p>

          <div style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-main)' }}>
            <strong>Email:</strong> {email || '—'}
          </div>

          {/* Update email */}
          <form
            onSubmit={handleEmailUpdate}
            style={{ display: 'grid', gap: 8, maxWidth: 420, marginTop: 8 }}
          >
            <label className={labelClass}>
              <span>New email</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>Current password (for confirmation)</span>
              <input
                type="password"
                value={currentPasswordForEmail}
                onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                className={inputClass}
              />
            </label>

            <button
              type="submit"
              disabled={updatingEmail}
              className={primaryBtn}
              style={{ marginTop: 4, width: 'fit-content' }}
            >
              {updatingEmail ? 'Updating email…' : 'Update email'}
            </button>
          </form>

          {/* Change password */}
          <form
            onSubmit={handlePasswordChange}
            style={{ display: 'grid', gap: 8, maxWidth: 420, marginTop: 20 }}
          >
            <h4 style={{ margin: '4px 0', fontSize: 15, color: 'var(--text-main)' }}>
              Change password
            </h4>

            <label className={labelClass}>
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            <button
              type="submit"
              disabled={updatingPassword}
              className={primaryBtn}
              style={{ marginTop: 4, width: 'fit-content' }}
            >
              {updatingPassword ? 'Updating password…' : 'Change password'}
            </button>
          </form>
        </section>

        {/* Notifications */}
{/* Notifications */}
<section className={card}>
  <h3 className="profile-section-title">Notifications</h3>
  <p className="profile-section-sub">
    Turn daily email reminders on or off and choose how many days{' '}
    <em>before a deadline</em> you want to hear about it.
  </p>

  <div style={{ display: 'grid', gap: 10, maxWidth: 380 }}>
    {/* Master toggle */}
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        color: 'var(--text-main)',
      }}
    >
      <input
        type="checkbox"
        checked={notificationsEnabled}
        onChange={(e) => setNotificationsEnabled(e.target.checked)}
      />
      <span>Enable email reminders</span>
    </label>

    {/* Lead time control (dim + disabled when off) */}
    <div
      style={{
        display: 'grid',
        gap: 6,
        maxWidth: 360,
        opacity: notificationsEnabled ? 1 : 0.5,
      }}
    >
      <label
        className={labelClass}
        style={{
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
        }}
      >
        <span>Lead time (days):</span>
        <input
          type="number"
          min={0}
          max={30}
          step={1}
          value={leadTimeDays}
          onChange={(e) =>
            setLeadTimeDays(clampLead(parseInt(e.target.value, 10)))
          }
          className={inputClass}
          style={{ width: 100 }}
          disabled={!notificationsEnabled}
        />
      </label>

      <small style={{ color: 'var(--text-muted)' }}>
        When enabled, Sparely emails you once per day showing pinned deadlines
        due in the next <strong>{leadTimeDays}</strong>{' '}
        {leadTimeDays === 1 ? 'day' : 'days'}.
      </small>
      {!notificationsEnabled && (
        <small style={{ color: 'var(--text-muted)' }}>
          Email reminders are currently <strong>turned off</strong>.
        </small>
      )}
    </div>
  </div>
</section>

        {/* Campus Preference */}
{/* Campus Preference */}
<section className={card}>
  <h3 className="profile-section-title">Campus</h3>
  <p className="profile-section-sub">
    Choose which campus&apos;s academic calendar you want Sparely to prioritize.
  </p>

  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 420,
      fontSize: 14,
      color: 'var(--text-main)',
    }}
  >
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="radio"
        name="campus"
        value="uwb"
        checked={campusPref === 'uwb'}
        onChange={(e) => setCampusPref(e.target.value)}
      />
      <span>UW Bothell only</span>
    </label>

    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="radio"
        name="campus"
        value="uws"
        checked={campusPref === 'uws'}
        onChange={(e) => setCampusPref(e.target.value)}
      />
      <span>UW Seattle only</span>
    </label>

    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="radio"
        name="campus"
        value="uwt"
        checked={campusPref === 'uwt'}
        onChange={(e) => setCampusPref(e.target.value)}
      />
      <span>UW Tacoma only</span>
    </label>

    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="radio"
        name="campus"
        value="all"
        checked={campusPref === 'all'}
        onChange={(e) => setCampusPref(e.target.value)}
      />
      <span>All campuses</span>
    </label>

    <small style={{ color: 'var(--text-muted)' }}>
      This setting won&apos;t change which deadlines are scraped, but it controls which
      campus you see by default across Sparely.
    </small>
  </div>
</section>


        {/* Appearance */}
        <section className={card}>
          <h3 className="profile-section-title">Appearance</h3>
          <p className="profile-section-sub">
            Switch between light and dark themes. Your choice is remembered across sessions.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)' }}>
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
              className={secondaryBtn}
              style={{ marginLeft: 'auto' }}
            >
              Preview toggle
            </button>
          </div>
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
            The theme applies instantly for preview and is remembered. Click Save to update the
            server copy.
          </small>
        </section>

        {/* Canvas Calendar Import */}
        <section className={card}>
          <h3 className="profile-section-title">Canvas Calendar Import</h3>
          <p className="profile-section-sub">
            Export your Canvas calendar as a <code>.ics</code> file and upload it here to add your
            assignments into Sparely.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap'
            }}
          >
            <input
              type="file"
              accept=".ics,text/calendar"
              onChange={handleIcsFileChange}
              style={{ fontSize: 14, color: 'var(--text-main)' }}
            />
            <button
              type="button"
              onClick={handleIcsUpload}
              disabled={icsLoading || !icsFile}
              className={primaryBtn}
            >
              {icsLoading ? 'Importing…' : 'Import .ics'}
            </button>
          </div>

          {icsStatus && (
            <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-main)' }}>{icsStatus}</p>
          )}
        </section>

        {/* Actions / Status */}
        <section
          className={card}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <button
            onClick={save}
            disabled={saving}
            className={primaryBtn}
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </button>

          <button
            type="button"
            onClick={() => {
              setLeadTimeDays(3);
              setTheme('light');
              applyTheme('light');
              setMsg({ type: 'ok', text: 'Reset locally (remember to Save).' });
            }}
            className={secondaryBtn}
          >
            Reset to defaults
          </button>

          {msg && (
            <span
              style={{
                marginLeft: 4,
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
