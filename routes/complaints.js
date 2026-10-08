const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');

router.post('/', async (req, res) => {
  try {
    const complaint = await Complaint.create(req.body);
    res.status(201).json({ message: 'Complaint submitted', complaint });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;