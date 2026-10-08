const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'lucky_movers.db');

let db = null;
let ready = null;

function init() {
  if (ready) return ready;

  ready = initSqlJs().then((SQL) => {
    if (fs.existsSync(DB_FILE)) {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    db.run(`
CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password TEXT NOT NULL,
  truckType TEXT,
  truckPlate TEXT,
  availability TEXT DEFAULT 'offline',
  suspensionReason TEXT,
  suspendedAt TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerName TEXT,
  customerPhone TEXT,
  customerEmail TEXT,
  selectedTruck TEXT,
  offeredPrice REAL,
  agreedPrice REAL,
  pickupLocation TEXT,
  destination TEXT,
  pickupDate TEXT,
  cargoDescription TEXT,
  bookingCode TEXT,
  status TEXT DEFAULT 'Pending',
  driverId INTEGER,
  driverName TEXT,
  driverCounterPrice REAL,
  paymentMethod TEXT,
  paymentPhone TEXT,
  paymentStatus TEXT,
  paidAt TEXT,
  pickupCoords TEXT,
  destinationCoords TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookingId INTEGER,
  driverId INTEGER,
  customerName TEXT,
  customerPhone TEXT,
  subject TEXT,
  message TEXT,
  status TEXT DEFAULT 'Open',
  adminNote TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_rejected_drivers (
  bookingId INTEGER,
  driverId INTEGER,
  PRIMARY KEY (bookingId, driverId)
);

CREATE TABLE IF NOT EXISTS booking_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookingId INTEGER NOT NULL,
  driverId INTEGER NOT NULL,
  driverName TEXT,
  driverPhone TEXT,
  price REAL NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
    `);

    save();
    console.log('Database initialized');
    return db;
  });

  return ready;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function query(sql, params = []) {
  await init();

  const trimmed = sql.trim().toLowerCase();

  if (trimmed.startsWith('select')) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return [rows];
  }

  if (trimmed.startsWith('insert')) {
    db.run(sql, params);
    const idResult = db.exec('SELECT last_insert_rowid() AS id');
    const insertId = idResult[0].values[0][0];
    save();
    return [{ insertId, affectedRows: 1 }];
  }

  db.run(sql, params);
  const changes = db.getRowsModified();
  save();
  return [{ insertId: 0, affectedRows: changes }];
}

module.exports = { query, init };