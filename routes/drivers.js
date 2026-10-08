const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, truckType, truckPlate } = req.body;

    if (!name || !email || !phone || !password || !truckType) {
      return res.status(400).json({
        message: 'Name, email, phone, password and truck type are required',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    if (await Driver.findByEmail(cleanEmail)) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    if (await Driver.findByPhone(cleanPhone)) {
      return res.status(400).json({ message: 'Phone already registered' });
    }

    const driver = await Driver.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: password.trim(),
      truckType: truckType.trim(),
      truckPlate: truckPlate ? truckPlate.trim() : '',
    });

    delete driver.password;
    res.status(201).json({ message: 'Driver registered successfully', driver });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const driver = await Driver.findByEmail(email.toLowerCase().trim());
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const ok = await Driver.comparePassword(password.trim(), driver.password);
    if (!ok) return res.status(401).json({ message: 'Wrong password' });

    if (driver.availability === 'suspended') {
      return res.status(403).json({
        message: 'Your account is suspended. Contact Lucky Movers admin.',
      });
    }

    delete driver.password;
    res.json({ message: 'Login successful', driver });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/:id/availability', async (req, res) => {
  try {
    const { availability } = req.body;
    if (!['available', 'busy', 'offline'].includes(availability)) {
      return res.status(400).json({
        message: 'Availability must be available, busy, or offline',
      });
    }
    const driver = await Driver.updateAvailability(req.params.id, availability);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    delete driver.password;
    res.json({ message: 'Availability updated', driver });
  } catch (err) {
    console.error('AVAILABILITY ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/available', async (req, res) => {
  try {
    const drivers = await Driver.available();
    drivers.forEach((d) => delete d.password);
    res.json({ count: drivers.length, drivers });
  } catch (err) {
    console.error('AVAILABLE DRIVERS ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.all();
    drivers.forEach((d) => delete d.password);
    res.json({ count: drivers.length, drivers });
  } catch (err) {
    console.error('GET DRIVERS ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;