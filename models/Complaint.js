const pool = require('../db');

const Complaint = {
  async create(data) {
    const [r] = await pool.query(
      `INSERT INTO complaints (bookingId, driverId, customerName, customerPhone, subject, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.bookingId || null,
        data.driverId || null,
        data.customerName,
        data.customerPhone,
        data.subject,
        data.message,
      ]
    );
    return this.findById(r.insertId);
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async all() {
    const [rows] = await pool.query('SELECT * FROM complaints ORDER BY createdAt DESC');
    return rows;
  },

  async update(id, { status, adminNote }) {
    await pool.query(
      'UPDATE complaints SET status = ?, adminNote = ? WHERE id = ?',
      [status, adminNote, id]
    );
    return this.findById(id);
  },
};

module.exports = Complaint;