const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Dummy in-memory database
const locations = [];

app.use(cors());
app.use(express.json());

app.post('/api/location', (req, res) => {
  const { employeeId, address, timestamp, status, } = req.body;

  locations.push({
    employeeId,
    address,
    timestamp,
    status,
  });

  console.log('New location saved:', req.body);

  res.json({
    message: 'Location saved successfully!',
    totalRecords: locations.length,
  });
});

// ✅ ADD THIS ROUTE
app.get('/api/office-location', (req, res) => {
  res.json({
    latitude: 12.9857270,
    longitude: 77.5979289
  });
});

app.get('/api/location', (req, res) => {
  res.json(locations);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});