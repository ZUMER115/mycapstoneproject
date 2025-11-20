// src/models/Deadlines.js
const mongoose = require('mongoose');

const deadlineSchema = new mongoose.Schema(
  {
    event:    { type: String, required: true },      // e.g. "Tuition due"
    date:     { type: String, required: true },      // raw date string from site
    category: { type: String, default: 'other' },    // 'registration' | 'add/drop' | 'financial-aid' | ...
    source:   { type: String, default: 'scraped' },  // 'scraped' or 'personal'

    // NEW: which campus this deadline is from
    campus: {
      type: String,
      enum: ['uwb', 'uws', 'other'],
      default: 'uwb'
    },

    // optional fields if your scraper emits them:
    dateText: String,
    text:     String,
  },
  { timestamps: true }
);

// Helpful indexes
deadlineSchema.index({ date: 1 });
deadlineSchema.index({ category: 1, date: 1 });
deadlineSchema.index({ campus: 1, date: 1 });

module.exports = mongoose.model('Deadlines', deadlineSchema);
