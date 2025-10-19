const mongoose = require('mongoose');

const deadlineSchema = new mongoose.Schema(
  {
    event:    { type: String, required: true },      // e.g. "Tuition due"
    date:     { type: String, required: true },      // "YYYY-MM-DD"
    category: { type: String, default: 'other' },    // 'registration' | 'add/drop' | 'financial-aid' | ...
    source:   { type: String, default: 'scraped' },  // 'scraped' or 'personal'
    // optional fields if your scraper emits them:
    dateText: String,
    text:     String,
  },
  { timestamps: true }
);

// Helpful indexes
deadlineSchema.index({ date: 1 });
deadlineSchema.index({ category: 1, date: 1 });

// Model name can be anything; keeping "Deadlines" to match your require
module.exports = mongoose.model('Deadlines', deadlineSchema);
