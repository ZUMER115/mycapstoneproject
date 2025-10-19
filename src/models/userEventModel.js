const mongoose = require('mongoose');

const userEventSchema = new mongoose.Schema({
  email: { type: String, index: true, required: true },
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end:   { type: Date, required: true },
  category: { type: String, default: 'personal' },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.models.UserEvent || mongoose.model('UserEvent', userEventSchema);
