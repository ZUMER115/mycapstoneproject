// src/server.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { query } = require('./config/db'); // ✅ add: pg pool helper, used by authController
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();

// --- CORS (allow Vercel and localhost) ---
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:3000',
  'https://mycapstoneproject-tbo9.vercel.app'
];

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

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API listening on ${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err?.message || err);
    process.exit(1);
  }
})();
