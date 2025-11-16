// src/server.js yes

console.log();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { query } = require('./config/db'); // ✅ add: pg pool helper, used by authController
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
console.log('[email-test] RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
console.log('🚀 Sparely server.js starting up!');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();

// --- CORS (allow Vercel and localhost) ---
// ✅ define allowedOrigins BEFORE app.use(cors(...))
const allowedOrigins = [
  process.env.FRONTEND_URL,                        // e.g. https://your-frontend.com
  'https://mycapstoneproject-kd1i.onrender.com',   // your Render app URL
  'http://localhost:3000',                         // local React dev
  'http://localhost:5173',                          // if you ever use Vite
  'https://mycapstoneproject-tbo9.vercel.app'   
].filter(Boolean); // remove undefined/null entries

app.use(
  cors({
    origin(origin, callback) {
      // Allow:
      //   - same-origin server-to-server
      //   - tools like Postman (no origin)
      //   - any origin in our whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.log('[CORS] Blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

const { getOrPopulateDeadlines } = require('./utils/deadlineScraper');  // ⬅️ Add this near your other imports

// allow vercel preview URLs dynamically
app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());



app.use(express.json());

// --- health checks ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));
// --- Postgres health check ---
app.get('/health/pg', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, pg: 'up' });
  } catch (err) {
    res.status(500).json({ ok: false, pg: 'down', error: err?.message || String(err) });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/health/db', (_req, res) => {
  const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'];
  res.json({ state: mongoose.connection.readyState, stateName: stateNames[mongoose.connection.readyState] || 'unknown' });
});
app.get('/', (_req, res) => res.send('Sparely backend is running'));


app.use((req, _res, next) => {
  console.log('➡️ Incoming:', req.method, req.url);
  next();
});
// --- routes ---
const authRoutes        = require('./routes/auth');
const deadlineRoutes    = require('./routes/deadlines');
const eventRoutes       = require('./routes/events');
const preferencesRoutes = require('./routes/preferences');
const notifyRoutes      = require('./routes/notify');
const pinsRoutes        = require('./routes/pins');
const timelineRoutes    = require('./routes/timeline');

app.use('/api/auth',     authRoutes);
app.use('/api',          deadlineRoutes);
app.use('/api',          eventRoutes);
app.use('/api',          preferencesRoutes);
app.use('/api',          notifyRoutes);
app.use('/api/pins',     pinsRoutes);
app.use('/api/timeline', timelineRoutes);

// --- start after DB connect ---
const PORT = process.env.PORT || 5000;
const uri  = process.env.MONGO_URI;

// TEMP: test route to check Resend email sending
app.get('/api/test-resend', async (req, res) => {
  try {
    console.log('[email-test] /api/test-resend hit');

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'zackbozz1@gmail.com',  // or any address you want to test
      subject: 'Sparely Resend test',
      html: '<p>If you see this email, the backend successfully called <strong>Resend</strong>.</p>'
    });

    if (error) {
      console.error('[email-test] Resend ERROR:', error);
      return res.status(500).json({
        ok: false,
        message: 'Resend returned an error',
        error
      });
    }

    console.log('[email-test] Resend SUCCESS:', data);
    return res.json({
      ok: true,
      message: 'Test email request sent to Resend',
      data
    });
  } catch (err) {
    console.error('[email-test] Unexpected exception:', err);
    return res.status(500).json({
      ok: false,
      message: 'Unexpected server error when calling Resend',
      error: err.message
    });
  }
});

// POSTGRES health (add-only)
app.get('/health/pg', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, pg: 'up' });
  } catch (e) {
    res.status(500).json({ ok: false, pg: 'down', error: e?.message || String(e) });
  }
});
(async () => {
  try {
    if (!uri) throw new Error('MONGO_URI is missing. Check your .env');
    console.log('🔌 Connecting to MongoDB…');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 20000 });
    console.log('✅ MongoDB connected');

    // ⬇️ Add this one line to populate deadlines once
    await getOrPopulateDeadlines();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API listening on ${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err?.message || err);
    process.exit(1);
  }
})();
