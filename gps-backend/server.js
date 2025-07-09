const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

const db = require('./db');

db.getConnection()
  .then(conn => {
    console.log('✅ Successfully connected to MySQL!');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error connecting to MySQL:', err);
  });

app.use(cors());
app.use(express.json());

function toMySQLTimestamp(raw) {
  if (!raw) return null;
  // Try to parse the incoming string
  const d = new Date(raw);
  if (isNaN(d)) {
    console.error('❌ Invalid timestamp string received:', raw);
    return null;
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}


// ✅ Save normal location ping
app.post('/api/location', async (req, res) => {
  const { employeeId, employeeName, address, timestamp, status } = req.body;

  try {
    await db.query(
      `INSERT INTO employee_locations 
        (employee_id, employee_name, address, is_inside_office, gps_status, internet_status, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        employeeName,
        address,
        status?.isInsideOffice || false,
        status?.gps || 'off',
        status?.internet || 'off',
        toMySQLTimestamp(timestamp)
      ]
    );

    console.log('✅ Location saved to MySQL:', req.body);

    res.json({ message: 'Location saved successfully!' });
  } catch (error) {
    console.error('❌ Error saving location:', error);
    res.status(500).json({ message: 'DB error' });
  }
});

// ✅ Save outside-for-2-min event
app.post('/api/location/outside', async (req, res) => {
  const { employeeId, employeeName, outsideStartTime, outsideAddress } = req.body;

  try {
    await db.query(
      `INSERT INTO outside_events
        (employee_id, employee_name, outside_start_time, outside_address)
      VALUES (?, ?, ?, ?)`,
      [
        employeeId,
        employeeName,
        toMySQLTimestamp(outsideStartTime),
        outsideAddress
      ]
    );

    console.log('✅ Outside event saved:', req.body);

    res.json({ message: 'Outside event saved!' });
  } catch (error) {
    console.error('❌ Error saving outside event:', error);
    res.status(500).json({ message: 'DB error' });
  }
});

// ✅ Save return event when user comes back inside
app.post('/api/employee-return', async (req, res) => {
  const { employeeId, employeeName, exitTime, reEntryTime, durationMinutes, outsideAddress } = req.body;

  try {
    await db.query(
      `INSERT INTO employee_returns
        (employee_id, employee_name, exit_time, re_entry_time, duration_minutes, outside_address)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        employeeName,
        toMySQLTimestamp(exitTime),
        toMySQLTimestamp(reEntryTime),
        durationMinutes,
        outsideAddress
      ]
    );

    console.log('✅ Return event saved:', req.body);

    res.json({ message: 'Employee return recorded.' });
  } catch (error) {
    console.error('❌ Error saving return event:', error);
    res.status(500).json({ message: 'DB error' });
  }
});

// ✅ Save tracking gap
app.post('/api/tracking-gap', async (req, res) => {
  const { employeeId, employeeName, gapStartTime, gapEndTime, durationMinutes, lastKnownAddress } = req.body;

  try {
    await db.query(
      `INSERT INTO tracking_gaps
        (employee_id, employee_name, gap_start_time, gap_end_time, duration_minutes, last_known_address)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        employeeName,
        toMySQLTimestamp(gapStartTime),
        toMySQLTimestamp(gapEndTime),
        durationMinutes,
        lastKnownAddress
      ]
    );

    console.log('✅ Tracking gap saved:', req.body);

    res.json({ message: 'Tracking gap saved.' });
  } catch (error) {
    console.error('❌ Error saving tracking gap:', error);
    res.status(500).json({ message: 'DB error' });
  }
});

// ✅ Serve dynamic office coordinates
app.get('/api/office-location', (req, res) => {
  res.json({
    latitude: 12.9857270,
    longitude: 77.5979289
  });
});

// ✅ Fetch all locations (for future dashboard)
app.get('/api/location', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM employee_locations');
    res.json(rows);
  } catch (error) {
    console.error('❌ Error fetching data:', error);
    res.status(500).json({ message: 'DB error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});

