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
const myLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const WhatsAppIcon = ({ size = 18, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

function FitBounds({ pickup, destination }) {
  const map = useMap();
  useEffect(() => {
    if (pickup && destination) {
      map.fitBounds(L.latLngBounds([pickup.lat, pickup.lng], [destination.lat, destination.lng]), { padding: [50, 50] });
    } else if (pickup) map.setView([pickup.lat, pickup.lng], 13);
    else if (destination) map.setView([destination.lat, destination.lng], 13);
  }, [pickup, destination, map]);
  return null;
}

async function geocodePlace(text) {
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ug&q=' + encodeURIComponent(text);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (e) { return null; }
}
export default function CustomerLocationPage() {
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    selectedTruck: 'Small Moving Truck', offeredPrice: '',
    pickupLocation: '', destination: '', pickupDate: '', cargoDescription: ''
  });

  const [priceMode, setPriceMode] = useState('offer'); // 'offer' or 'open'

  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);

  const [booking, setBooking] = useState(null);
  const [driver, setDriver] = useState(null);
  const [offers, setOffers] = useState([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('MTN Mobile Money');
  const [paymentPhone, setPaymentPhone] = useState('');

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }); }

  async function refreshBooking() {
    if (!booking?.id) return;
    try {
      const res = await fetch(`${API}/bookings`);
      const data = await res.json();
      const fresh = (data.bookings || []).find((b) => b.id === booking.id);
      if (fresh) {
        setBooking(fresh);
        if (fresh.driverId && !driver) {
          const dRes = await fetch(`${API}/drivers`);
          const dData = await dRes.json();
          const d = (dData.drivers || []).find((x) => String(x.id) === String(fresh.driverId));
          if (d) setDriver(d);
        }
      }
      // Always refresh offers
      const oRes = await fetch(`${API}/bookings/${booking.id}/offers`);
      const oData = await oRes.json();
      setOffers(oData.offers || []);
    } catch (err) { console.error(err); }
  }

  useEffect(() => {
    if (!booking?.id) return;
    const interval = setInterval(refreshBooking, 2000);
    return () => clearInterval(interval);
  }, [booking?.id, driver]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage('Creating booking...');
    setBooking(null);
    setDriver(null);
    setOffers([]);

    try {
      if (!form.customerName || !form.customerPhone || !form.customerEmail ||
          !form.pickupLocation || !form.destination || !form.pickupDate ||
          !form.cargoDescription) {
        setMessage('Please fill all fields.');
        setSubmitting(false);
        return;
      }

      if (priceMode === 'offer' && (!form.offeredPrice || Number(form.offeredPrice) <= 0)) {
        setMessage('Please enter your offered price, or choose "Let drivers decide".');
        setSubmitting(false);
        return;
      }

      let pickup = null, dest = null;
      try {
        if (navigator.geolocation) {
          pickup = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => resolve(null),
              { enableHighAccuracy: true, timeout: 5000 }
            );
          });
        }
      } catch (e) {}
      setMyLocation(pickup);
      if (!pickup) pickup = await geocodePlace(form.pickupLocation);
      dest = await geocodePlace(form.destination);
      setPickupCoords(pickup);
      setDestinationCoords(dest);

      const payload = {
        ...form,
        offeredPrice: priceMode === 'offer' ? Number(form.offeredPrice) : null,
        pickupCoords: pickup,
        destinationCoords: dest
      };

      const res = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || data.error || 'Error creating booking');
        setSubmitting(false);
        return;
      }

      const created = data.booking;
      setBooking(created);
      setMessage('Booking created. Finding nearby drivers...');

      const broadcastRes = await fetch(`${API}/bookings/${created.id}/broadcast-job`, { method: 'POST' });
      const broadcastData = await broadcastRes.json();

      if (broadcastRes.ok) {
        setMessage('Job sent to ' + broadcastData.driverCount + ' driver(s). Waiting for offers...');
      } else {
        setMessage(broadcastData.message || 'No drivers available right now');
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptOffer(offerId) {
    if (!window.confirm('Accept this offer and confirm the booking?')) return;
    try {
      const res = await fetch(`${API}/bookings/${booking.id}/accept-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId })
      });
      const data = await res.json();
      if (res.ok) {
        setBooking(data.booking);
        setMessage('Booking confirmed!');
      } else {
        alert(data.message || 'Could not accept offer');
      }
    } catch (err) { alert(err.message); }
  }

  async function submitPayment(e) {
    e.preventDefault();
    if (!booking?.id) return;
    if (paymentMethod !== 'Cash on pickup' && !paymentPhone.trim()) {
      alert('Please enter your mobile money number');
      return;
    }
    try {
      const res = await fetch(`${API}/bookings/${booking.id}/choose-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, paymentPhone: paymentPhone.trim() })
      });
      const data = await res.json();
      if (res.ok) setBooking(data.booking);
      else alert(data.message || 'Could not save payment');
    } catch (err) { alert(err.message); }
  }

  const showPaymentSection = booking && booking.status === 'Confirmed' && !booking.paymentMethod;
  const showPaymentSummary = booking && booking.paymentMethod;
  const showOffers = booking && booking.status === 'Negotiating' && offers.length > 0;

  return (
    <div className="lm-app">
      <header className="lm-nav">
        <div className="lm-logo">LUCKY MOVERS</div>
        <nav className="lm-nav-links">
          <a href="/">Home</a>
          <a href="/complaint">Complaint</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <a href="/book" className="lm-nav-cta">Book Now</a>
        </nav>
      </header>

      <div className="lm-book-page">
        <div className="lm-book-header">
          <div className="lm-book-header-icon">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
            </svg>
          </div>
          <div>
            <h1>Book a Truck</h1>
            <p>Fill the form below and we'll match you with a driver in seconds.</p>
          </div>
        </div>

        <div className="lm-card">
          <form onSubmit={handleSubmit} className="lm-form">

            <div className="lm-form-row">
              <label className="lm-form-label">Your Name</label>
              <div className="lm-field">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </span>
                <input name="customerName" placeholder="e.g. John Mukasa" value={form.customerName} onChange={handleChange} required />
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">Phone Number</label>
              <div className="lm-field">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                </span>
                <input name="customerPhone" type="tel" placeholder="e.g. 0742 502 154" value={form.customerPhone} onChange={handleChange} required />
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">Email Address</label>
              <div className="lm-field">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                </span>
                <input name="customerEmail" type="email" placeholder="you@example.com" value={form.customerEmail} onChange={handleChange} required />
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">Pickup Location</label>
              <div className="lm-field">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </span>
                <input name="pickupLocation" placeholder="e.g. Kampala, Uganda" value={form.pickupLocation} onChange={handleChange} required />
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">Destination</label>
              <div className="lm-field">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
                </span>
                <input name="destination" placeholder="e.g. Jinja, Uganda" value={form.destination} onChange={handleChange} required />
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">Pickup Date</label>
              <div className="lm-field">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
                </span>
                <input name="pickupDate" type="date" value={form.pickupDate} onChange={handleChange} required />
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">Truck Type</label>
              <div className="lm-field">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/></svg>
                </span>
                <select name="selectedTruck" value={form.selectedTruck} onChange={handleChange}>
                  <option>Pickup</option>
                  <option>Small Moving Truck</option>
                  <option>Medium Moving Truck</option>
                  <option>Large Moving Truck</option>
                </select>
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">What are you transporting?</label>
              <div className="lm-field lm-field-textarea">
                <span className="lm-field-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z"/></svg>
                </span>
                <textarea name="cargoDescription" placeholder="e.g. Furniture, fridge, boxes" value={form.cargoDescription} onChange={handleChange} required />
              </div>
            </div>

            <div className="lm-form-row">
              <label className="lm-form-label">How do you want to price it?</label>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, padding: 12, border: priceMode === 'offer' ? '3px solid #6EE7B7' : '3px solid #E2E8F0', borderRadius: 12, background: priceMode === 'offer' ? '#F0FDF4' : 'white' }}>
                  <input type="radio" name="priceMode" checked={priceMode === 'offer'} onChange={() => setPriceMode('offer')} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0B1F3A' }}>I'll offer a price</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Drivers can accept or counter</div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, padding: 12, border: priceMode === 'open' ? '3px solid #6EE7B7' : '3px solid #E2E8F0', borderRadius: 12, background: priceMode === 'open' ? '#F0FDF4' : 'white' }}>
                  <input type="radio" name="priceMode" checked={priceMode === 'open'} onChange={() => setPriceMode('open')} />
                  <div>
                    <div style={{ fontWeight: 800, color: '#0B1F3A' }}>Let drivers decide</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Drivers send you their prices</div>
                  </div>
                </label>
              </div>
            </div>

            {priceMode === 'offer' && (
              <div className="lm-form-row">
                <label className="lm-form-label">Your Offered Price (UGX)</label>
                <div className="lm-field">
                  <span className="lm-field-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
                  </span>
                  <input name="offeredPrice" type="number" placeholder="e.g. 50000" value={form.offeredPrice} onChange={handleChange} required={priceMode === 'offer'} />
                </div>
              </div>
            )}

            <button type="submit" className="lm-btn-primary" disabled={submitting}>
              {submitting ? 'Please waitâ€¦' : 'Request a Truck'}
            </button>
          </form>
        </div>

        {message && <div className="lm-message">{message}</div>}

        {booking && (
          <section className="lm-result">
            <h3>Your Booking</h3>
            <p><strong>Code:</strong> {booking.bookingCode || String(booking.id)}</p>
            <p><strong>Status:</strong> <span style={{ fontWeight: 'bold', color: booking.status === 'Confirmed' ? '#16A34A' : booking.status === 'Negotiating' ? '#FF6B00' : '#0B1F3A' }}>{booking.status}</span></p>
            <p><strong>Pickup:</strong> {booking.pickupLocation}</p>
            <p><strong>Destination:</strong> {booking.destination}</p>
            <p><strong>Your offer:</strong> {booking.offeredPrice ? 'UGX ' + Number(booking.offeredPrice).toLocaleString() : 'Let drivers decide'}</p>
          </section>
        )}

        {showOffers && (
          <section className="lm-result" style={{ borderColor: '#FFB100' }}>
            <h3>Drivers who offered ({offers.length})</h3>
            {offers.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, border: '2px solid #E2E8F0', borderRadius: 12, marginBottom: 10, background: o.status === 'accepted' ? '#F0FDF4' : 'white' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#0B1F3A' }}>{o.driverName}</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>{o.driverPhone}</div>
                  {o.message && <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>"{o.message}"</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#16A34A' }}>UGX {Number(o.price).toLocaleString()}</div>
                  {o.status === 'accepted' ? (
                    <div style={{ fontSize: 12, color: '#16A34A', fontWeight: 800 }}>ACCEPTED</div>
                  ) : (
                    <button className="lm-btn-primary" onClick={() => acceptOffer(o.id)} style={{ marginTop: 6 }}>Accept</button>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {driver && (
          <section className="lm-result lm-driver-result">
            <h3>Your Driver</h3>
            <p><strong>Name:</strong> {driver.name}</p>
            <p><strong>Phone:</strong> {driver.phone}</p>
            <p><strong>Truck:</strong> {driver.truckType}</p>
            {booking.agreedPrice && <p><strong>Agreed Price:</strong> UGX {Number(booking.agreedPrice).toLocaleString()}</p>}
            <div className="lm-contact">
              <a href={'tel:' + driver.phone} className="lm-btn-primary">Call</a>
              <a href={'https://wa.me/256' + driver.phone.replace(/^0/, '')} target="_blank" rel="noreferrer" className="lm-btn-whatsapp">
                <WhatsAppIcon size={16} /> WhatsApp
              </a>
            </div>
          </section>
        )}

        {showPaymentSection && (
          <section className="lm-result" style={{ borderColor: '#FFB100' }}>
            <h3>Pay for Your Move</h3>
            <p><strong>Amount:</strong> UGX {Number(booking.agreedPrice || 0).toLocaleString()}</p>
            <form onSubmit={submitPayment}>
              <label><input type="radio" name="pm" value="MTN Mobile Money" checked={paymentMethod === 'MTN Mobile Money'} onChange={(e) => setPaymentMethod(e.target.value)} /> MTN Mobile Money</label><br/>
              <label><input type="radio" name="pm" value="Airtel Money" checked={paymentMethod === 'Airtel Money'} onChange={(e) => setPaymentMethod(e.target.value)} /> Airtel Money</label><br/>
              <label><input type="radio" name="pm" value="Cash on pickup" checked={paymentMethod === 'Cash on pickup'} onChange={(e) => setPaymentMethod(e.target.value)} /> Cash on pickup</label><br/><br/>
              {paymentMethod !== 'Cash on pickup' && (
                <input type="tel" placeholder="Mobile Money number" value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)} style={{ padding: 12, width: '100%', marginBottom: 12, borderRadius: 12, border: '3px solid #E2E8F0' }} />
              )}
              <button type="submit" className="lm-btn-primary">Confirm Payment</button>
            </form>
          </section>
        )}

        {showPaymentSummary && (
          <section className="lm-result" style={{ borderColor: '#16A34A' }}>
            <h3>Payment</h3>
            <p><strong>Amount:</strong> UGX {Number(booking.agreedPrice || 0).toLocaleString()}</p>
            <p><strong>Method:</strong> {booking.paymentMethod}</p>
            {booking.paymentPhone && <p><strong>Phone:</strong> {booking.paymentPhone}</p>}
            <p><strong>Status:</strong> {booking.paymentStatus === 'paid' ? 'Paid' : 'Waiting for payment'}</p>
          </section>
        )}
      </div>
    </div>
  );
}
