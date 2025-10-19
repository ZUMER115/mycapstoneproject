// server/models/Pin.js
const mongoose = require('mongoose');

const PinSchema = new mongoose.Schema({
  email:    { type: String, index: true, required: true },
  key:      { type: String, required: true }, // e.g. "scr|YYYY-MM-DD|lowercased-title" or "me|<mongoId>"
  event:    { type: String, default: '' },
  category: { type: String, default: 'other' },
  dateISO:  { type: String, index: true },    // YYYY-MM-DD
  source:   { type: String, enum: ['scraped', 'personal'], default: 'scraped' },
  createdAt:{ type: Date, default: Date.now }
});

PinSchema.index({ email: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Pin', PinSchema);
