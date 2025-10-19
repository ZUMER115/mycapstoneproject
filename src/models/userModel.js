const mongoose = require('mongoose');

const userPinsSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true, unique: true },
    // store simple, stable info we can match against scraped data
    pins: [
      {
        event: { type: String, required: true }, // raw event title shown on dashboard
        date:  { type: String, required: true }, // raw date text (e.g., "Sep 24, 2025" or "Sep 24–30, 2025")
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserPins', userPinsSchema);
