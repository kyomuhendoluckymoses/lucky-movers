import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const API = 'http://localhost:3000/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

function FitBounds({ pickup, destination }) {
  const map = useMap();
  useEffect(() => {
    if (pickup && destination) {
      map.fitBounds(L.latLngBounds([pickup.lat, pickup.lng], [destination.lat, destination.lng]), { padding: [50, 50] });
    } else if (pickup) map.setView([pickup.lat, pickup.lng], 13);
  }, [pickup, destination, map]);
  return null;
}

function JobMap({ booking }) {
  const { pickupCoords, destinationCoords } = booking;
  if (!pickupCoords && !destinationCoords) return null;
  return (
    <div style={{ height: 260, borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
      <MapContainer center={[
        (pickupCoords?.lat || destinationCoords?.lat) || 0.3476,
        (pickupCoords?.lng || destinationCoords?.lng) || 32.5825
      ]} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
        <FitBounds pickup={pickupCoords} destination={destinationCoords} />
        {pickupCoords && <Marker position={pickupCoords} icon={pickupIcon}><Popup>Pickup</Popup></Marker>}
        {destinationCoords && <Marker position={destinationCoords} icon={destinationIcon}><Popup>Destination</Popup></Marker>}
      </MapContainer>
    </div>
  );
}
export default function DriverPage() {
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regForm, setRegForm] = useState({
    name: '', email: '', phone: '', password: '', truckType: 'Small Moving Truck'
  });
  const [driver, setDriver] = useState(null);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [activeJobs, setActiveJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [offerFor, setOfferFor] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setMessage('Logging in...');
    try {
      const res = await fetch(`${API}/drivers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || data.message || 'Login failed'); return; }
      setDriver(data.driver);
      setMessage('Welcome, ' + data.driver.name + '!');
      loadJobs(data.driver.id, data.driver.truckType);
    } catch (err) { setMessage(err.message); }
  }

  function handleRegChange(e) { setRegForm({ ...regForm, [e.target.name]: e.target.value }); }

  async function handleRegister(e) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API}/drivers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Registered! You can now log in.');
        setRegForm({ name: '', email: '', phone: '', password: '', truckType: 'Small Moving Truck' });
        setView('login');
      } else {
        setMessage(data.error || data.message || 'Registration failed');
      }
    } catch (err) { setMessage(err.message); }
  }

  async function loadJobs(driverId, truckType) {
    if (!driverId) return;
    try {
      const res = await fetch(`${API}/bookings`);
      const data = await res.json();
      const all = data.bookings || [];
      const mine = all.filter((b) => String(b.driverId) === String(driverId));
      const active = mine.filter((b) => b.status === 'Confirmed');
      const broadcast = all.filter((b) =>
        (b.status === 'Broadcasting' || b.status === 'Negotiating' || b.status === 'Open') &&
        b.selectedTruck === truckType &&
        !b.driverId
      );
      setPendingJobs(broadcast);
      setActiveJobs(active);
    } catch (err) { console.error(err); }
  }

  useEffect(() => {
    if (!driver?.id) return;
    const interval = setInterval(() => loadJobs(driver.id, driver.truckType), 3000);
    return () => clearInterval(interval);
  }, [driver?.id, driver?.truckType]);

  async function setAvailability(newStatus) {
    if (!driver) return;
    try {
      const res = await fetch(`${API}/drivers/${driver.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: newStatus })
      });
      const data = await res.json();
      if (res.ok) { setDriver(data.driver); setMessage('Status: ' + newStatus); }
      else setMessage(data.message || 'Failed');
    } catch (err) { setMessage(err.message); }
  }

  async function acceptJob(id) {
    if (!window.confirm('Accept this job at the customer price?')) return;
    try {
      const res = await fetch(`${API}/bookings/${id}/accept-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id })
      });
      const data = await res.json();
      if (res.ok) { setMessage('Job accepted!'); loadJobs(driver.id, driver.truckType); }
      else if (res.status === 409) { alert('Another driver already took this job.'); loadJobs(driver.id, driver.truckType); }
      else alert(data.message || 'Could not accept');
    } catch (err) { alert(err.message); }
  }

  function openOfferForm(jobId, currentPrice) {
    setOfferFor(jobId);
    setOfferPrice(currentPrice ? String(currentPrice) : '');
    setOfferNote('');
  }

  async function submitOffer() {
    if (!offerPrice || Number(offerPrice) <= 0) { alert('Please enter a valid price'); return; }
    try {
      const res = await fetch(`${API}/bookings/${offerFor}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id, price: Number(offerPrice), message: offerNote.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Offer sent for UGX ' + offerPrice);
        setOfferFor(null); setOfferPrice(''); setOfferNote('');
        loadJobs(driver.id, driver.truckType);
      } else alert(data.message || 'Failed to send offer');
    } catch (err) { alert(err.message); }
  }

  async function rejectJob(id) {
    if (!window.confirm('Hide this job from your list?')) return;
    try {
      await fetch(`${API}/bookings/${id}/reject-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id })
      });
      setMessage('Job hidden');
      loadJobs(driver.id, driver.truckType);
    } catch (err) { alert(err.message); }
  }

  function logout() {
    setDriver(null); setPendingJobs([]); setActiveJobs([]);
    setEmail(''); setPassword(''); setMessage('');
  }

  if (!driver) {
    return (
      <div className="container">
        <h1>Lucky Movers — Driver</h1>
        {view === 'login' && (
          <form onSubmit={handleLogin} className="card">
            <h3>Log In</h3>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">Log In</button>
            <p style={{ marginTop: 12 }}>
              New driver?{' '}
              <button type="button" onClick={() => { setView('register'); setMessage(''); }}
                style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}>
                Register here
              </button>
            </p>
          </form>
        )}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="card">
            <h3>Register a New Driver</h3>
            <input name="name" placeholder="Full Name" value={regForm.name} onChange={handleRegChange} required />
            <input name="email" type="email" placeholder="Email" value={regForm.email} onChange={handleRegChange} required />
            <input name="phone" type="tel" placeholder="Phone" value={regForm.phone} onChange={handleRegChange} required />
            <input name="password" type="password" placeholder="Password" value={regForm.password} onChange={handleRegChange} required />
            <select name="truckType" value={regForm.truckType} onChange={handleRegChange}>
              <option>Pickup</option>
              <option>Small Moving Truck</option>
              <option>Medium Moving Truck</option>
              <option>Large Moving Truck</option>
            </select>
            <button type="submit">Register</button>
            <p style={{ marginTop: 12 }}>
              Already have an account?{' '}
              <button type="button" onClick={() => { setView('login'); setMessage(''); }}
                style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', textDecoration: 'underline' }}>
                Log in here
              </button>
            </p>
          </form>
        )}
        {message && <p className="message">{message}</p>}
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Driver: {driver.name}</h1>
      <p><strong>Email:</strong> {driver.email}</p>
      <p><strong>Phone:</strong> {driver.phone}</p>
      <p><strong>Truck:</strong> {driver.truckType}</p>

      <div className="card">
        <h2>My Status</h2>
        <p><strong>Current:</strong>{' '}
          <span style={{
            fontWeight: 'bold',
            color: driver.availability === 'available' ? 'green' :
                   driver.availability === 'busy' ? 'darkorange' : 'gray'
          }}>{driver.availability}</span>
        </p>
        <button onClick={() => setAvailability('available')} disabled={driver.availability === 'available'} style={{ background: '#2e7d32' }}>I'm Available</button>
        <button onClick={() => setAvailability('busy')} disabled={driver.availability === 'busy'} style={{ background: '#c62828' }}>I'm Busy</button>
        <button onClick={() => setAvailability('offline')} disabled={driver.availability === 'offline'} style={{ background: '#616161' }}>Go Offline</button>
      </div>

      {message && <p className="message">{message}</p>}

      <button onClick={logout} style={{ marginBottom: 20 }}>Log Out</button>

      <h2 style={{ marginTop: 24, color: '#c62828' }}>New Jobs ({pendingJobs.length})</h2>

      {pendingJobs.length === 0 ? (
        <p style={{ color: '#666' }}>No new jobs right now. They appear here automatically.</p>
      ) : (
        pendingJobs.map((b) => (
          <div key={b.id} className="card">
            <h3>Job {b.bookingCode || String(b.id)}</h3>
            <p><strong>Customer:</strong> {b.customerName}</p>
            <p><strong>Pickup:</strong> {b.pickupLocation}</p>
            <p><strong>Destination:</strong> {b.destination}</p>
            <p><strong>Cargo:</strong> {b.cargoDescription}</p>
            <p style={{ fontSize: 18, color: b.offeredPrice ? '#ff6b35' : '#64748B' }}>
              <strong>{b.offeredPrice ? 'Customer offers: UGX ' + Number(b.offeredPrice).toLocaleString() : 'Customer wants you to send a price'}</strong>
            </p>

            <JobMap booking={b} />

            <div style={{ marginTop: 12 }}>
              {b.offeredPrice && (
                <button onClick={() => acceptJob(b.id)} style={{ background: '#2e7d32' }}>Accept UGX {Number(b.offeredPrice).toLocaleString()}</button>
              )}
              <button onClick={() => openOfferForm(b.id, b.offeredPrice)} style={{ background: '#ff9800' }}>
                {b.offeredPrice ? 'Send my counter-offer' : 'Send my price'}
              </button>
              <button onClick={() => rejectJob(b.id)} style={{ background: '#616161' }}>Hide</button>
            </div>
          </div>
        ))
      )}

      {offerFor && (
        <div className="card" style={{ border: '3px solid #FFB100', background: '#FFFBEB' }}>
          <h3>Send your price for Job #{offerFor}</h3>
          <input
            type="number"
            placeholder="Your price in UGX"
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
            style={{ padding: 12, fontSize: 16, width: '100%', marginBottom: 10, borderRadius: 8, border: '2px solid #E2E8F0' }}
          />
          <input
            type="text"
            placeholder="Optional message (e.g. includes fuel)"
            value={offerNote}
            onChange={(e) => setOfferNote(e.target.value)}
            style={{ padding: 12, fontSize: 14, width: '100%', marginBottom: 12, borderRadius: 8, border: '2px solid #E2E8F0' }}
          />
          <button onClick={submitOffer} style={{ background: '#2e7d32' }}>Send Offer</button>
          <button onClick={() => setOfferFor(null)} style={{ background: '#616161' }}>Cancel</button>
        </div>
      )}

      <h2 style={{ marginTop: 32, color: '#2e7d32' }}>My Active Jobs ({activeJobs.length})</h2>

      {activeJobs.length === 0 ? (
        <p style={{ color: '#666' }}>You have no active jobs yet.</p>
      ) : (
        activeJobs.map((b) => (
          <div key={b.id} className="card">
            <h3>Job {b.bookingCode || String(b.id)}</h3>
            <p><strong>Customer:</strong> {b.customerName} — {b.customerPhone}</p>
            <p><strong>Pickup:</strong> {b.pickupLocation}</p>
            <p><strong>Destination:</strong> {b.destination}</p>
            <p><strong>Agreed Price: UGX {Number(b.agreedPrice || b.offeredPrice || 0).toLocaleString()}</strong></p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <a href={'tel:' + b.customerPhone} className="lm-btn-primary">Call</a>
              <a href={'https://wa.me/256' + b.customerPhone.replace(/^0/, '')} target="_blank" rel="noreferrer" className="lm-btn-whatsapp">WhatsApp</a>
            </div>
            <JobMap booking={b} />
          </div>
        ))
      )}
    </div>
  );
}
