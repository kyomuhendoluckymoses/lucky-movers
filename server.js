require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const driverRoutes = require('./routes/drivers');
app.use('/api/drivers', driverRoutes);

const bookingRoutes = require('./routes/bookings');
app.use('/api/bookings', bookingRoutes);

const complaintRoutes = require('./routes/complaints');
app.use('/api/complaints', complaintRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Lucky Movers server is running!' });
});

const PORT = process.env.PORT || 3000;

pool
  .init()
  .then(() => {
    console.log('Connected to database');
    app.listen(PORT, () => console.log(`Server on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection failed:');
    console.error(err);
    process.exit(1);
  });