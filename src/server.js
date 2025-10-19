// src/server.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// 1) Load env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 2) Create app + core middleware
const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// 3) Import routes (once)
const authRoutes        = require('./routes/auth');
const deadlineRoutes    = require('./routes/deadlines');
const eventRoutes       = require('./routes/events');
const preferencesRoutes = require('./routes/preferences');
const notifyRoutes      = require('./routes/notify');
const pinsRoutes        = require('./routes/pins');
const timelineRoutes    = require('./routes/timeline'); // <-- import only, don’t use until after app is created

// 4) Health checks
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/health/db', (_req, res) => {
  const stateNames = ['disconnected','connected','connecting','disconnecting','uninitialized'];
  res.json({
    state: mongoose.connection.readyState,
    stateName: stateNames[mongoose.connection.readyState] || 'unknown'
  });
});
app.get('/', (_req, res) => res.send('Sparely backend is running'));

// 5) Mount routes (exactly once each)
// NOTE: your route files should define paths like router.get('/deadlines', ...) if mounted at '/api'
app.use('/api/auth',        authRoutes);
app.use('/api',             deadlineRoutes);
app.use('/api',             eventRoutes);
app.use('/api',             preferencesRoutes);
app.use('/api',             notifyRoutes);
app.use('/api/pins',             pinsRoutes);          // keep only this one; remove the duplicate below
app.use('/api/timeline',    timelineRoutes);      // timeline router should use router.get('/', ...)

// 6) Connect to Mongo and start server
const PORT = process.env.PORT || 5000;
const uri  = process.env.MONGO_URI;

if (!uri) {
  console.error('❌ MONGO_URI is missing. Check your .env');
  process.exit(1);
}

(async () => {
  try {
    console.log('🔌 Connecting to MongoDB…');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    });
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('❌ MongoDB connection error:', err?.message || err);
    process.exit(1);
  }
})();
