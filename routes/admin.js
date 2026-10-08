const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const Complaint = require('../models/Complaint');

const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) throw new Error('ADMIN_KEY environment variable is required.');

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

router.use(requireAdmin);

router.get('/ping', (req, res) => res.json({ ok: true }));

// ─── DRIVERS ───
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await Driver.all();
    drivers.forEach((d) => delete d.password);
    res.json({ count: drivers.length, drivers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/drivers', async (req, res) => {
  try {
    const { name, email, phone, password, truckType } = req.body;
    if (!name || !email || !phone || !password || !truckType) {
      return res.status(400).json({ message: 'All fields required' });
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
    });

    delete driver.password;
    res.status(201).json({ message: 'Driver registered by admin', driver });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/drivers/:id/suspend', async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await Driver.suspend(req.params.id, reason);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    delete driver.password;
    res.json({ message: 'Driver suspended', driver });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/drivers/:id/unsuspend', async (req, res) => {
  try {
    const driver = await Driver.unsuspend(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    delete driver.password;
    res.json({ message: 'Driver reactivated', driver });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/drivers/:id', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const activeJobs = await Booking.countActiveForDriver(driver.id);

    if (activeJobs > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        message: `This driver has ${activeJobs} active job(s).`,
        activeJobs,
      });
    }

    await Driver.delete(driver.id);
    delete driver.password;
    res.json({ message: 'Driver deleted', driver });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── BOOKINGS ───
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.all();
    res.json({ count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/bookings/:id/payment', async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const booking = await Booking.update(req.params.id, {
      paymentStatus,
      paidAt: paymentStatus === 'paid' ? new Date().toISOString() : null,
    });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Payment updated', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── COMPLAINTS ───
router.get('/complaints', async (req, res) => {
  try {
    const complaints = await Complaint.all();
    res.json({ count: complaints.length, complaints });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/complaints/:id', async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const complaint = await Complaint.update(req.params.id, { status, adminNote });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json({ message: 'Complaint updated', complaint });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;