const express = require('express');
const router = express.Router();

const Booking = require('../models/Booking');
const Driver = require('../models/Driver');
const pool = require('../db');

const { sendCustomerBookingEmail } = require('../mailer');

// CREATE BOOKING (accepts offeredPrice OR null for "let drivers decide")
router.post('/', async (req, res) => {
  try {
    const data = { ...req.body };

    // If offeredPrice is missing or empty, mark status as "Open"
    if (!data.offeredPrice || Number(data.offeredPrice) <= 0) {
      data.offeredPrice = null;
      data.status = 'Open';
    }

    const booking = await Booking.create(data);

    console.log('BOOKING CREATED:', booking.id, booking.customerEmail);

    if (booking.customerEmail) {
      try {
        await sendCustomerBookingEmail(booking);
        console.log('Customer booking notification sent:', booking.customerEmail);
      } catch (e) {
        console.error('Customer booking email failed:', e.message);
      }
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
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// BROADCAST JOB TO AVAILABLE DRIVERS
router.post('/:id/broadcast-job', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const wantedTruck = booking.selectedTruck || booking.truckType;
    if (!wantedTruck) return res.status(400).json({ message: 'Booking has no truck type' });

    const [availableDrivers] = await pool.query(
      `SELECT * FROM drivers WHERE availability = 'available' AND truckType = ?`,
      [wantedTruck]
    );

    if (!availableDrivers.length) {
      const updated = await Booking.update(req.params.id, { status: 'No driver available' });
      return res.status(404).json({
        message: 'No available driver with a ' + wantedTruck,
        booking: updated
      });
    }

    const updated = await Booking.update(req.params.id, {
      status: 'Broadcasting',
      driverId: null,
      driverName: null
    });

    res.json({
      message: 'Job broadcast to ' + availableDrivers.length + ' driver(s)',
      booking: updated,
      driverCount: availableDrivers.length
    });
  } catch (err) {
    console.error('BROADCAST ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DRIVER ACCEPTS BOOKING (direct accept — used when customer already offered a price)
router.post('/:id/accept-driver', async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ message: 'driverId required' });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const claimed = await Booking.claimForDriver(req.params.id, driver.id, driver.name);
    if (!claimed) {
      const existing = await Booking.findById(req.params.id);
      return res.status(409).json({
        message: 'Job already taken by another driver',
        booking: existing
      });
    }

    await Driver.updateAvailability(driver.id, 'busy');
    res.json({ message: 'Booking accepted', booking: claimed, driver });
  } catch (err) {
    console.error('ACCEPT DRIVER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DRIVER SENDS AN OFFER (works for both "customer offered" and "let drivers decide")
router.post('/:id/offer', async (req, res) => {
  try {
    const { driverId, price, message } = req.body;

    if (!driverId) return res.status(400).json({ message: 'driverId required' });
    if (!price || Number(price) <= 0) return res.status(400).json({ message: 'Valid price required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status === 'Confirmed') {
      return res.status(409).json({ message: 'Booking already confirmed' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    // Insert the offer
    await pool.query(
      `INSERT INTO booking_offers (bookingId, driverId, driverName, driverPhone, price, message, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [booking.id, driver.id, driver.name, driver.phone, Number(price), message || null]
    );

    // Move booking status to "Negotiating" if it was Pending or Broadcasting
    if (['Pending', 'Broadcasting'].includes(booking.status)) {
      await Booking.update(booking.id, { status: 'Negotiating' });
    }

    res.status(201).json({ message: 'Offer sent' });
  } catch (err) {
    console.error('OFFER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET ALL OFFERS FOR A BOOKING
router.get('/:id/offers', async (req, res) => {
  try {
    const [offers] = await pool.query(
      `SELECT * FROM booking_offers WHERE bookingId = ? ORDER BY price ASC`,
      [req.params.id]
    );
    res.json({ count: offers.length, offers });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// CUSTOMER ACCEPTS A DRIVER'S OFFER
router.post('/:id/accept-offer', async (req, res) => {
  try {
    const { offerId } = req.body;
    if (!offerId) return res.status(400).json({ message: 'offerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Load the offer
    const [offerRows] = await pool.query(
      `SELECT * FROM booking_offers WHERE id = ? AND bookingId = ? LIMIT 1`,
      [offerId, booking.id]
    );
    const offer = offerRows[0];
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    // Mark this offer accepted, all others rejected
    await pool.query(`UPDATE booking_offers SET status = 'rejected' WHERE bookingId = ?`, [booking.id]);
    await pool.query(`UPDATE booking_offers SET status = 'accepted' WHERE id = ?`, [offer.id]);

    // Confirm the booking with this driver and price
    const updated = await Booking.update(booking.id, {
      status: 'Confirmed',
      driverId: offer.driverId,
      driverName: offer.driverName,
      agreedPrice: offer.price
    });

    // Set driver to busy
    await Driver.updateAvailability(offer.driverId, 'busy');

    res.json({ message: 'Offer accepted', booking: updated });
  } catch (err) {
    console.error('ACCEPT OFFER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DRIVER REJECTS BOOKING (hides it from their list)
router.post('/:id/reject-driver', async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ message: 'driverId required' });

    await pool.query(
      `INSERT OR IGNORE INTO booking_rejected_drivers (bookingId, driverId) VALUES (?, ?)`,
      [req.params.id, driverId]
    );

    const booking = await Booking.findById(req.params.id);
    res.json({ message: 'You will not see this job again', booking });
  } catch (err) {
    console.error('REJECT DRIVER ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// CUSTOMER CHOOSES PAYMENT METHOD
router.post('/:id/choose-payment', async (req, res) => {
  try {
    const { paymentMethod, paymentPhone } = req.body;
    if (!paymentMethod) return res.status(400).json({ message: 'Payment method required' });

    const updated = await Booking.update(req.params.id, {
      paymentMethod,
      paymentPhone: paymentPhone || null
    });

    if (!updated) return res.status(404).json({ message: 'Booking not found' });

    res.json({ message: 'Payment method saved', booking: updated });
  } catch (err) {
    console.error('CHOOSE PAYMENT ERROR:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;