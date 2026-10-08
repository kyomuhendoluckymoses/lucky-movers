const express = require('express');
const router = express.Router();

const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const pool = require('../db');

const { sendCustomerBookingEmail } = require('../mailer');

// CREATE BOOKING
router.post('/', async (req, res) => {
  try {
    const booking = await Booking.create(req.body);

    console.log('BOOKING CREATED:', booking.id, booking.customerEmail);

    if (booking.customerEmail) {
      try {
        await sendCustomerBookingEmail(booking);
        console.log('Customer booking notification sent to:', booking.customerEmail);
      } catch (emailError) {
        console.error('Customer booking email failed:', emailError.message);
      }
    } else {
      console.log('No customer email provided. Email not sent.');
    }

    res.status(201).json({ message: 'Booking created', booking });
  } catch (err) {
    console.error('CREATE BOOKING ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ALL BOOKINGS
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.all();
    res.json({ count: bookings.length, bookings });
  } catch (err) {
    console.error('GET BOOKINGS ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// BROADCAST JOB TO AVAILABLE DRIVERS
router.post('/:id/broadcast-job', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const wantedTruck = booking.selectedTruck || booking.truckType;

    if (!wantedTruck) {
      return res.status(400).json({ message: 'Booking has no truck type' });
    }

    const [availableDrivers] = await pool.query(
      `SELECT * FROM drivers
       WHERE availability = 'available'
       AND truckType = ?`,
      [wantedTruck]
    );

    if (!availableDrivers.length) {
      const updated = await Booking.update(req.params.id, { status: 'No driver available' });
      return res.status(404).json({
        message: 'No available driver with a ' + wantedTruck,
        booking: updated,
      });
    }

    const updated = await Booking.update(req.params.id, {
      status: 'Broadcasting',
      driverId: null,
      driverName: null,
    });

    res.json({
      message: 'Job broadcast to ' + availableDrivers.length + ' driver(s)',
      booking: updated,
      driverCount: availableDrivers.length,
    });
  } catch (err) {
    console.error('BROADCAST ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DRIVER ACCEPTS BOOKING
router.post('/:id/accept-driver', async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId required' });
    }

    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    const claimed = await Booking.claimForDriver(req.params.id, driver.id, driver.name);

    if (!claimed) {
      const existing = await Booking.findById(req.params.id);
      return res.status(409).json({
        message: 'Job already taken by another driver',
        booking: existing,
      });
    }

    await Driver.updateAvailability(driver.id, 'busy');

    res.json({ message: 'Booking accepted', booking: claimed, driver });
  } catch (err) {
    console.error('ACCEPT DRIVER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DRIVER REJECTS BOOKING
router.post('/:id/reject-driver', async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({ message: 'driverId required' });
    }

    await pool.query(
      `INSERT OR IGNORE INTO booking_rejected_drivers (bookingId, driverId)
       VALUES (?, ?)`,
      [req.params.id, driverId]
    );

    const booking = await Booking.findById(req.params.id);

    res.json({
      message: 'You will not see this job again',
      booking,
    });
  } catch (err) {
    console.error('REJECT DRIVER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DRIVER COUNTER OFFER
router.post('/:id/counter-offer', async (req, res) => {
  try {
    const { newPrice, driverId } = req.body;

    if (!newPrice || Number(newPrice) <= 0) {
      return res.status(400).json({ message: 'Invalid new price' });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    let driverName = booking.driverName;
    let driverObj = null;

    if (driverId) {
      driverObj = await Driver.findById(driverId);
      if (driverObj) driverName = driverObj.name;
    }

    const updated = await Booking.update(req.params.id, {
      status: 'Counter-offered',
      driverCounterPrice: Number(newPrice),
      driverId: driverId || booking.driverId,
      driverName,
    });

    res.json({ message: 'Counter-offer saved', booking: updated });
  } catch (err) {
    console.error('COUNTER OFFER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// CUSTOMER CHOOSES PAYMENT METHOD
router.post('/:id/choose-payment', async (req, res) => {
  try {
    const { paymentMethod, paymentPhone } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method required' });
    }

    const updated = await Booking.update(req.params.id, {
      paymentMethod,
      paymentPhone: paymentPhone || null,
    });

    if (!updated) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ message: 'Payment method saved', booking: updated });
  } catch (err) {
    console.error('CHOOSE PAYMENT ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;