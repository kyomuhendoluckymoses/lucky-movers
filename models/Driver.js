const pool = require('../db');
const bcrypt = require('bcryptjs');

const Driver = {
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM drivers WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM drivers WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findByPhone(phone) {
    const [rows] = await pool.query('SELECT * FROM drivers WHERE phone = ? LIMIT 1', [phone]);
    return rows[0] || null;
  },

  async all() {
    const [rows] = await pool.query('SELECT * FROM drivers ORDER BY createdAt DESC');
    return rows;
  },

  async available() {
    const [rows] = await pool.query(
      "SELECT * FROM drivers WHERE availability = 'available' ORDER BY createdAt DESC"
    );
    return rows;
  },

  async create({ name, email, phone, password, truckType, truckPlate }) {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      `INSERT INTO drivers (name, email, phone, password, truckType, truckPlate, availability)
       VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
      [name, email, phone, hash, truckType, truckPlate || '']
    );
    return this.findById(r.insertId);
  },

  async updateAvailability(id, availability) {
    await pool.query('UPDATE drivers SET availability = ? WHERE id = ?', [availability, id]);
    return this.findById(id);
  },

  async suspend(id, reason) {
    await pool.query(
      "UPDATE drivers SET availability = 'suspended', suspensionReason = ?, suspendedAt = NOW() WHERE id = ?",
      [reason || 'No reason provided', id]
    );
    return this.findById(id);
  },

  async unsuspend(id) {
    await pool.query(
      "UPDATE drivers SET availability = 'offline', suspensionReason = NULL, suspendedAt = NULL WHERE id = ?",
      [id]
    );
    return this.findById(id);
  },

  async delete(id) {
    await pool.query('DELETE FROM drivers WHERE id = ?', [id]);
  },

  async comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  },
};

module.exports = Driver;