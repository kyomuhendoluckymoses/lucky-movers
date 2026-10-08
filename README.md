# 🚚 Lucky Movers

A truck booking platform for Uganda. Customers book trucks, drivers accept or counter-offer, prices are negotiated directly between the parties.

## Features

- 📱 Customer booking form with live map
- 🚚 Driver dashboard with real-time job list
- 💰 Price negotiation (accept or counter-offer)
- 📊 Admin panel for managing drivers and bookings
- 📧 Email notifications (Resend)
- 💳 Payment via MTN Mobile Money, Airtel Money, or cash

## Tech Stack

- **Backend:** Node.js + Express + SQLite (sql.js)
- **Frontend:** React + Vite + Leaflet (maps)
- **Email:** Resend
- **Auth:** bcryptjs

## How to Run

```bash
# Install backend
cd lucky-movers
npm install
node server.js

# In another terminal — install frontend
cd frontend
npm install
npm run dev
