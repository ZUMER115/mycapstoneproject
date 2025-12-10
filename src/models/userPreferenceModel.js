// src/models/userPreferenceModel.js
const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true, unique: true },
  lead_time_days: { type: Number, default: 3 },
  bio:   { type: String, default: '' },
  notes: { type: String, default: '' },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  notifications_enabled: { type: Boolean, default: true },


  campus_preference: {
    type: String,
    enum: ['uwb', 'uws', 'uwt', 'all'],  // 👈 added uwt + all
    default: 'uwb',
  },
}, { timestamps: true });

module.exports =
  mongoose.models.UserPreference ||
  mongoose.model('UserPreference', userPreferenceSchema);
