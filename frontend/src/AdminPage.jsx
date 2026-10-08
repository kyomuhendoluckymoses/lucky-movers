import { useState, useEffect } from 'react';

const API = 'http://localhost:3000/api';

const inputStyle = {
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #ccc',
  borderRadius: 6,
  width: '100%',
  boxSizing: 'border-box'
};

export default function AdminPage() {
  const [key, setKey] = useState(localStorage.getItem('adminKey') || '');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState('drivers');
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [message, setMessage] = useState('');
  const [newDriver, setNewDriver] = useState({
    name: '', email: '', phone: '', password: '', truckType: 'Small Moving Truck'
  });
  const [formMessage, setFormMessage] = useState('');

  function headers() {
    return { 'Content-Type': 'application/json', 'x-admin-key': key };
  }

  async function login(e) {
    e.preventDefault();
    setMessage('Checking...');
    try {
      const res = await fetch(`${API}/admin/ping`, { headers: headers() });
      if (res.ok) {
        localStorage.setItem('adminKey', key);
        setAuthed(true);
        setMessage('Logged in');
      } else {
        setMessage('Wrong admin key');
      }
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function loadAll() {
    try {
      const [d, b, c] = await Promise.all([
        fetch(`${API}/admin/drivers`, { headers: headers() }).then(r => r.json()),
        fetch(`${API}/admin/bookings`, { headers: headers() }).then(r => r.json()),
        fetch(`${API}/admin/complaints`, { headers: headers() }).then(r => r.json())
      ]);
      setDrivers(d.drivers || []);
      setBookings(b.bookings || []);
      setComplaints(c.complaints || []);
    } catch (err) {
      setMessage(err.message);
    }
  }

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  async function registerDriver() {
    setFormMessage('');
    if (!newDriver.name || !newDriver.email || !newDriver.phone || !newDriver.password || !newDriver.truckType) {
      setFormMessage('Fill all fields');
      return;
    }
    try {
      const res = await fetch(`${API}/admin/drivers`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(newDriver)
      });
      const data = await res.json();
      if (res.ok) {
        setFormMessage('Driver registered: ' + data.driver.name);
        setNewDriver({ name: '', email: '', phone: '', password: '', truckType: 'Small Moving Truck' });
        loadAll();
      } else {
        setFormMessage(data.message || 'Failed');
      }
    } catch (err) {
      setFormMessage(err.message);
    }
  }

  async function suspendDriver(driver) {
    const reason = window.prompt('Why are you suspending ' + driver.name + '?');
    if (!reason || !reason.trim()) return;
    await fetch(`${API}/admin/drivers/${driver.id}/suspend`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ reason: reason.trim() })
    });
    setMessage('Suspended: ' + driver.name);
    loadAll();
  }

  async function unsuspendDriver(id) {
    if (!window.confirm('Reactivate this driver?')) return;
    await fetch(`${API}/admin/drivers/${id}/unsuspend`, { method: 'PATCH', headers: headers() });
    loadAll();
  }

  async function deleteDriver(driver) {
    const typed = window.prompt('Type the driver\'s name to confirm deletion:\n\n' + driver.name);
    if ((typed || '').trim().toLowerCase() !== (driver.name || '').trim().toLowerCase()) {
      alert('Name did not match.');
      return;
    }
    const reason = window.prompt('Reason for removal:');
    if (!reason) return;
    await fetch(`${API}/admin/drivers/${driver.id}`, {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ reason: reason.trim() })
    });
    setMessage('Removed: ' + driver.name);
    loadAll();
  }

  async function setPayment(id, status) {
    await fetch(`${API}/admin/bookings/${id}/payment`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ paymentStatus: status })
    });
    loadAll();
  }

  async function resolveComplaint(id) {
    const note = window.prompt('Admin note:') || '';
    await fetch(`${API}/admin/complaints/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status: 'Resolved', adminNote: note })
    });
    loadAll();
  }

  function fmt(n) {
    return 'UGX ' + Number(n || 0).toLocaleString();
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', padding: 20, fontFamily: 'Arial' }}>
        <h1>Admin Login</h1>
        <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="password" placeholder="Admin key" value={key}
            onChange={(e) => setKey(e.target.value)} style={{ padding: 10, fontSize: 16 }} />
          <button type="submit" style={{ padding: 10, fontSize: 16 }}>Log In</button>
        </form>
        {message && <p>{message}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'Arial' }}>
      <h1>Admin Dashboard</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('drivers')}>Drivers ({drivers.length})</button>
        <button onClick={() => setTab('bookings')}>Bookings ({bookings.length})</button>
        <button onClick={() => setTab('complaints')}>Complaints ({complaints.length})</button>
        <button onClick={loadAll}>Refresh</button>
        <button onClick={() => { localStorage.removeItem('adminKey'); setAuthed(false); }}>Log Out</button>
      </div>

      {message && <p style={{ fontWeight: 'bold' }}>{message}</p>}

      {tab === 'drivers' && (
        <>
          <div style={{ background: '#f5f5f7', padding: 20, borderRadius: 12, marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Register a New Driver</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input placeholder="Full Name" value={newDriver.name}
                onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} style={inputStyle} />
              <input placeholder="Email" type="email" value={newDriver.email}
                onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })} style={inputStyle} />
              <input placeholder="Phone" value={newDriver.phone}
                onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })} style={inputStyle} />
              <input placeholder="Password" type="text" value={newDriver.password}
                onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })} style={inputStyle} />
              <select value={newDriver.truckType}
                onChange={(e) => setNewDriver({ ...newDriver, truckType: e.target.value })} style={inputStyle}>
                <option>Pickup</option>
                <option>Small Moving Truck</option>
                <option>Medium Moving Truck</option>
                <option>Large Moving Truck</option>
              </select>
              <button onClick={registerDriver}
                style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '12px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>
                Register Driver
              </button>
            </div>
            {formMessage && <p style={{ marginTop: 12, fontWeight: 'bold' }}>{formMessage}</p>}
          </div>
          <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#1a0d2e', color: 'white' }}>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>Truck</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.email || '—'}</td>
                  <td>{d.phone}</td>
                  <td>{d.truckType}</td>
                  <td style={{
                    color: d.availability === 'available' ? 'green' :
                           d.availability === 'suspended' ? 'red' :
                           d.availability === 'busy' ? 'darkorange' : '#666',
                    fontWeight: 'bold'
                  }}>{d.availability}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {d.availability !== 'suspended' ? (
                      <button onClick={() => suspendDriver(d)} style={{ background: '#ff9800', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginRight: 6 }}>
                        Suspend
                      </button>
                    ) : (
                      <button onClick={() => unsuspendDriver(d.id)} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', marginRight: 6 }}>
                        Reactivate
                      </button>
                    )}
                    <button onClick={() => deleteDriver(d)} style={{ background: 'crimson', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'bookings' && (
        <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#1a0d2e', color: 'white' }}>
            <tr>
              <th>Customer</th><th>Driver</th><th>Amount</th>
              <th>Payment Method</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id}>
                <td><strong>{b.customerName}</strong><br /><small>{b.customerPhone}</small></td>
                <td>{b.driverName || '-'}</td>
                <td>{fmt(b.agreedPrice || b.offeredPrice)}</td>
                <td>{b.paymentMethod || '-'}</td>
                <td style={{
                  color: b.paymentStatus === 'paid' ? 'green'
                       : b.paymentStatus === 'refunded' ? 'orange'
                       : 'red',
                  fontWeight: 'bold'
                }}>{b.paymentStatus || 'unpaid'}</td>
                <td>
                  <button onClick={() => setPayment(b.id, 'paid')}>Mark Paid</button>
                  <button onClick={() => setPayment(b.id, 'refunded')}>Refund</button>
                  <button onClick={() => setPayment(b.id, 'unpaid')}>Unpaid</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'complaints' && (
        <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#1a0d2e', color: 'white' }}>
            <tr>
              <th>Customer</th><th>Subject</th><th>Message</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map(c => (
              <tr key={c.id}>
                <td><strong>{c.customerName}</strong><br /><small>{c.customerPhone}</small></td>
                <td>{c.subject}</td>
                <td>{c.message}</td>
                <td>{c.status}</td>
                <td>
                  {c.status !== 'Resolved' && (
                    <button onClick={() => resolveComplaint(c.id)}>Resolve</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}