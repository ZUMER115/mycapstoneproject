const express = require('express');
const router = express.Router();
const { fetchAllDeadlines } = require('../utils/deadlineScraper');

router.get('/deadlines', async (req, res) => {
  try {
    const deadlines = await fetchAllDeadlines();
    console.log('Fetched deadlines:', deadlines); // ✅ For debugging
    res.json(deadlines);
  } catch (err) {
    console.error('Error fetching deadlines:', err);
    res.status(500).json({ message: 'Failed to retrieve deadlines' });
  }
});

module.exports = router;
