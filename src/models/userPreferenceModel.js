const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true, unique: true },
  lead_time_days: { type: Number, default: 3 },   // you already use this
  bio:   { type: String, default: '' },
  notes: { type: String, default: '' },
  theme: { type: String, enum: ['light','dark'], default: 'light' },
  campus_preference: {
  type: String,
  enum: ['uwb', 'uws', 'both'],
  default: 'uwb',
},

  
}, { timestamps: true });

module.exports = mongoose.models.UserPreference
  || mongoose.model('UserPreference', userPreferenceSchema);
