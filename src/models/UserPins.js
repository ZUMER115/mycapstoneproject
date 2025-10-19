// src/models/UserPins.js
const mongoose = require('mongoose');

const pinSchema = new mongoose.Schema({
  event: { type: String, required: true },
  date: { type: String, required: true },
  category: { type: String },
  source: { type: String },
  dateObj: { type: Date }
});

const userPinsSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  pins: [pinSchema]
});

module.exports = mongoose.model('UserPins', userPinsSchema);
