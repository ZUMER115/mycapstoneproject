// src/App.js
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import Dashboard from './Dashboard';
import Login from './Login';
import CalendarPage from './pages/CalendarPage';
import Profile from './pages/Profile';
import SearchPage from './pages/SearchPage';
import Register from './Register';
import TestPinsPage from './TestPinsPage';

/**
 * Root: only provides the Router.
 * All hooks that depend on Router (useLocation) live in AppFrame.
 */
function App() {
  return (
    <Router>
      <AppFrame />
    </Router>
  );
}

function AppFrame() {
  const location = useLocation();

  // moved inside component (no top-level hooks!)
  const [navOpen, setNavOpen] = useState(false);
  const [token, setToken] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Smooth unmount after exit animation
  const [renderMenu, setRenderMenu] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Theme is controlled from Profile; we still mirror it here for page loads
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) setToken(stored);

    const currentTheme = document.documentElement.dataset.theme || localStorage.getItem('theme');
    if (currentTheme && currentTheme !== theme) setTheme(currentTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // control mount/unmount for exit animation
  useEffect(() => {
    if (dropdownOpen) setRenderMenu(true);
    else {
      const t = setTimeout(() => setRenderMenu(false), 160); // match animation duration
      return () => clearTimeout(t);
    }
  }, [dropdownOpen]);

  // click outside / Esc to close
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e) => e.key === 'Escape' && setDropdownOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [dropdownOpen]);

  const handleLogin = (t) => {
    setToken(t);
    localStorage.setItem('token', t);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  const linkStyle = {
    padding: '0.5rem 1rem',
    color: '#fff',
    textDecoration: 'none',
    display: 'block',
    backgroundColor: '#800080'
  };

  return (
    <div className="App">
      {/* Global theme + dropdown animation styles */}<style>{`
          /* ---------- THEME COLORS ---------- */
          :root {
            --page-bg: #f9fafb;     /* light mode page background */
            --widget-bg: #ffffff;   /* light mode widget/card background */
            --text-color: #111827;  /* light mode text */
          }

          /* Dark mode: very dark gray bg, lighter gray widgets, white text */
          [data-theme="dark"] {
            --page-bg: #121212;     /* whole site background */
            --widget-bg: #1e1e1e;   /* widgets/cards dark gray */
            --text-color: #ffffff;  /* text white */
          }

          html, body, #root, .App {
            margin: 0;
            min-height: 100%;
            background-color: var(--page-bg);
            color: var(--text-color);
          }

          /* Generic sections as widgets */
          .App section {
            background-color: var(--widget-bg);
            color: var(--text-color);
          }

          /* Panels/menus use widget background in dark mode */
          [data-theme="dark"] .menu-panel,
          [data-theme="dark"] .left-drawer .panel {
            background-color: var(--widget-bg) !important;
            color: var(--text-color) !important;
          }

          /* Ensure text follows theme even if inline styles exist */
          [data-theme="dark"] .App,
          [data-theme="dark"] .App * {
            color: var(--text-color) !important;
          }

          /* Inputs in dark mode */
          [data-theme="dark"] input {
            background-color: #2a2a2a !important;
            color: #ffffff !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
          }

          /* Dropdown + existing styles */
          .menu-wrap { position: relative; }
          .menu-btn {
            padding: .5rem 1rem; background:#fff; border-radius: 6px; cursor:pointer;
            border: none; font-weight: 600; display: inline-flex; align-items: center; gap: .35rem;
            box-shadow: 0 2px 8px rgba(0,0,0,.08);
            transition: transform .15s ease;
          }
          .menu-btn:active { transform: translateY(1px); }
          .chev { display:inline-block; transition: transform .16s ease; }
          .chev.open { transform: rotate(180deg); }

          .menu-panel {
            position: absolute; top: 100%; right: 0;
            background-color: #800080; border-radius: 8px;
            box-shadow: 0 10px 24px rgba(0,0,0,0.25);
            z-index: 999; min-width: 180px; overflow: hidden;
            transform-origin: 90% 0%;
            animation: menuIn .16s ease forwards;
          }
          .menu-panel.closing { animation: menuOut .16s ease forwards; }

          @keyframes menuIn {
            from { opacity: 0; transform: translateY(-6px) scale(.98); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes menuOut {
            from { opacity: 1; transform: translateY(0) scale(1); }
            to   { opacity: 0; transform: translateY(-6px) scale(.98); }
          }

          @media (prefers-reduced-motion: reduce) {
            .menu-panel, .menu-btn, .chev { transition: none !important; animation: none !important; }
          }

          :root { --appbar-h: 56px; }

          /* Button square */
          .hamburger {
            width: 40px;
            height: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            background: #800080;
            border: none;
            border-radius: 10px;
            outline: 3px solid #fff;
            outline-offset: 2px;
            transition: background .16s ease, transform .12s ease;
            gap: 0 !important;
          }

          /* Hamburger bars */
          .hamburger .bar {
            width: 20px;
            height: 2px;
            background: #fff;
            border-radius: 1px;
            transition: background .16s ease;
          }
          .hamburger .bar + .bar {
            margin-top: 4px !important;
          }

          /* Hover: invert colors */
          .hamburger:hover { background: #fff; }
          .hamburger:hover .bar { background: #111; }

          /* Press feedback */
          .hamburger:active { transform: translateY(1px); }

          .left-drawer {
            position: fixed;
            top: var(--appbar-h);
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1300;
            pointer-events: none;
          }
          .left-drawer .backdrop {
            position: absolute; inset: 0;
            background: rgba(0,0,0,.45);
            opacity: 0; transition: opacity .2s ease;
          }
          .left-drawer .panel {
            position: absolute;
            top: 0; left: 0; height: 100%;
            width: min(82vw, 320px);
            background: #fff;
            border-right: 1px solid rgba(0,0,0,.08);
            transform: translateX(-100%);
            transition: transform .25s ease;
            display: flex; flex-direction: column;
          }
          .left-drawer.open { pointer-events: auto; }
          .left-drawer.open .backdrop { opacity: 1; }
          .left-drawer.open .panel { transform: translateX(0); }

          .drawer-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
            padding: 14px;
          }
          .drawer-tile {
            display: grid; place-items: center;
            height: 96px; border-radius: 12px;
            text-decoration: none; color: #111; font-weight: 700;
            border: 1px solid #e6e8eb; background: #f8f9fb;
          }
          .drawer-tile.active { outline: 2px solid #c7d2fe; background:#eef2ff; color:#4338ca; }
          .drawer-logout { margin-top: auto; padding: 12px 14px; border: none; border-top: 1px solid #eee; background: #fff; }
          .drawer-logout > button {
            width: 100%; height: 48px; border-radius: 10px; border: none;
            background: #cc0000; color: #fff; font-weight: 700; cursor: pointer;
          }

          /* Sidebar restyle */
          .left-drawer .panel {
            background: #1e1e2f; /* dark navy by default (still OK in light; overridden by dark widget-bg above when needed) */
            border-right: 1px solid rgba(255,255,255,.18);
          }

          .left-drawer .panel h3,
          .left-drawer .panel .nav-label,
          .left-drawer .panel .drawer-label {
            color: #fff !important;
          }

          .drawer-tile {
            background: #1e1e2f;
            color: #fff;
            text-decoration: none;
            border: none;
            outline: 2px solid #fff;
            outline-offset: 2px;
            box-shadow: 0 2px 8px rgba(0,0,0,.2);
            transition: background .16s ease, color .16s ease, transform .12s ease;
          }

          .drawer-tile:hover,
          .drawer-tile:focus-visible {
            background: #ffffff;
            color: #111;
          }

          .drawer-tile:active { transform: translateY(1px); }

          .drawer-tile.active {
            background: #ffffff;
            color: #111;
          }

          .left-drawer .panel .drawer-header{
            padding: 14px;
            border-bottom: 1px solid rgba(255,255,255,.18);
            display: flex;
            align-items: center;
            gap: 8px;
            color: #fff;
          }
          .left-drawer .panel .drawer-header strong{
            color: #fff;
            font-size: 16px;
            font-weight: 700;
          }

          .drawer-grid{
            gap: 28px !important;
            padding: 22px 16px !important;
          }

          .drawer-tile{
            height: 104px;
          }
        `}</style>


      {/* Top Navigation (persistent) */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          height: 'var(--appbar-h)',
          padding: '0 12px',
          backgroundColor: '#800080',
          borderBottom: '1px solid rgba(255,255,255,.15)'
        }}
      >
        {/* LEFT: Hamburger toggles the left drawer */}
        {token ? (
          <button
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            className="hamburger"
            onClick={() => setNavOpen((o) => !o)}
            title={navOpen ? 'Close navigation' : 'Open navigation'}
            style={{ marginRight: 10 }}
          >
            <span className="bar" />
            <span className="bar" />
            <span className="bar" />
          </button>
        ) : (
          // keep layout aligned when logged out
          <span style={{ width: 44, height: 44, display: 'inline-block' }} />
        )}

        {/* TITLE pushed right by the hamburger */}
        <h2
          style={{
            color: '#fff',
            margin: 0,
            marginLeft: 8,
            fontSize: 22,
            fontWeight: 900
          }}
        >
          Sparely
        </h2>

        {/* RIGHT: existing dropdown / auth buttons */}
        <div style={{ marginLeft: 'auto' }}>
          {token ? (
            <div className="menu-wrap">
              <button
                ref={buttonRef}
                onClick={() => setDropdownOpen((o) => !o)}
                className="menu-btn"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                aria-controls="main-menu"
              >
                Menu <span className={`chev ${dropdownOpen ? 'open' : ''}`}>▾</span>
              </button>

              {renderMenu && (
                <div
                  id="main-menu"
                  ref={menuRef}
                  className={`menu-panel ${dropdownOpen ? '' : 'closing'}`}
                  role="menu"
                >
                  <Link to="/dashboard" style={linkStyle} onClick={() => setDropdownOpen(false)} role="menuitem">
                    Dashboard
                  </Link>
                  <Link to="/calendar" style={linkStyle} onClick={() => setDropdownOpen(false)} role="menuitem">
                    Calendar
                  </Link>
                  <Link to="/profile" style={linkStyle} onClick={() => setDropdownOpen(false)} role="menuitem">
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setDropdownOpen(false);
                    }}
                    style={{ ...linkStyle, background: '#cc0000', border: 'none', width: '100%', textAlign: 'left' }}
                    role="menuitem"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/" style={{ ...linkStyle, backgroundColor: '#4CAF50' }}>
                Login
              </Link>
              <Link to="/register" style={{ ...linkStyle, backgroundColor: '#2196F3' }}>
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Left slide-in drawer (below the top bar) */}
      {token && (
        <div className={`left-drawer ${navOpen ? 'open' : ''}`}>
          <div
            className="backdrop"
            onClick={() => setNavOpen(false)}
            role="button"
            aria-label="Close menu"
          />
          <aside
            className="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <strong>Navigation</strong>
            </div>

            {/* Big tiles */}
            <nav className="drawer-grid">
              <Link
                to="/search"
                className={`drawer-tile ${location.pathname.startsWith('/search') ? 'active' : ''}`}
                onClick={() => setNavOpen(false)}
              >
                Search
              </Link>
              <Link
                to="/dashboard"
                className={`drawer-tile ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
                onClick={() => setNavOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/calendar"
                className={`drawer-tile ${location.pathname.startsWith('/calendar') ? 'active' : ''}`}
                onClick={() => setNavOpen(false)}
              >
                Calendar
              </Link>
              <Link
                to="/profile"
                className={`drawer-tile ${location.pathname.startsWith('/profile') ? 'active' : ''}`}
                onClick={() => setNavOpen(false)}
              >
                Profile
              </Link>
            </nav>

            <div className="drawer-logout">
              <button
                onClick={() => {
                  handleLogout();
                  setNavOpen(false);
                }}
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Routing */}
      <Routes>
        <Route
          path="/"
          element={token ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />}
        />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/profile" element={token ? <Profile /> : <Navigate to="/" />} />
        <Route path="/calendar" element={token ? <CalendarPage /> : <Navigate to="/" />} />
        <Route path="/search" element={token ? <SearchPage /> : <Navigate to="/" />} />
        <Route path="/test-pins" element={<TestPinsPage />} />
      </Routes>
    </div>
  );
}

export default App;
