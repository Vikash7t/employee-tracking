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

// ✅ Save location to MySQL
app.post('/api/location', async (req, res) => {
  const { employeeId,employeeName, address, timestamp, status } = req.body;

  try {
    await db.query(
      `INSERT INTO employee_locations 
        (employee_id, employee_name,  address, is_inside_office, gps_status, internet_status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        employeeName,
        address,
        status?.isInsideOffice || false,
        status?.gps || 'off',
        status?.internet || 'off'
      ]
    );

    console.log('✅ Location saved to MySQL:', req.body);

    res.json({ message: 'Location saved successfully!' });
  } catch (error) {
    console.error('❌ Error saving location:', error);
    res.status(500).json({ message: 'DB error' });
  }
});

// ✅ Serve office coordinates
app.get('/api/office-location', (req, res) => {
  res.json({
    latitude: 12.9857270,
    longitude: 77.5979289
  });
});

// ✅ Fetch all location entries
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
