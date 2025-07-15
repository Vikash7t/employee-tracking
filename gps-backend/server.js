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
  const { employeeId, employeeName, address, employeeTimestamp, status } = req.body;

  try {
   // ✅ Generate UTC timestamp as fallback
    const date = new Date();

    const yyyy = date.getUTCFullYear();
    const MM = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');

    const generatedTimestamp = `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;

    // ✅ Use timestamp from frontend if provided, else generate new UTC timestamp
    const mysqlTimestamp = employeeTimestamp || generatedTimestamp;


    await db.query(
      `INSERT INTO employee_locations 
        (employee_id, employee_name, address, timestamp, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        employeeId.trim(),
        employeeName.trim(),
        address,
        mysqlTimestamp,
        status
      ]
    );
   
const { DateTime } = require('luxon');

const ist = DateTime.fromSQL(mysqlTimestamp, { zone: 'utc' }).setZone('Asia/Kolkata');



    console.log('✅ Location saved to MySQL:', {
      employeeId,
      employeeName,
      address,
      mysqlTimestamp,
      istTimestamp: ist.toFormat('yyyy-MM-dd HH:mm:ss'),
      status,
    });

    res.json({ message: 'Location saved successfully!' });
  } catch (error) {
    console.error('❌ Error saving location:', error);
    res.status(500).json({ message: 'DB error' });
  }
});






const { DateTime } = require('luxon');

function convertToIST(mysqlTimestamp) {
  if (!mysqlTimestamp) return null;
  return DateTime
    .fromSQL(mysqlTimestamp, { zone: 'utc' })
    .setZone('Asia/Kolkata')
    .toFormat('yyyy-MM-dd HH:mm:ss');
}



app.post('/api/track-gap', async (req, res) => {
  const { 
    employeeId, 
    employeeName, 
    gapType, 
    startTimestamp, 
    endTimestamp, 
    durationMinutes, 
    lastKnownAddress 
  } = req.body;

  try {
    await db.query(
      `INSERT INTO connectivity_gaps
         (employee_id, employee_name, gap_type, start_timestamp, end_timestamp, duration_minutes, last_known_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId.trim(),
        employeeName.trim(),
        gapType,
        startTimestamp,
        endTimestamp,
        durationMinutes,
        lastKnownAddress
      ]
    );

  

 const startIST = convertToIST(startTimestamp);
    const endIST = convertToIST(endTimestamp);

    console.log('✅ Gap saved:', {
      employeeId,
      employeeName,
      gapType,
      startTimestamp,
      startTimestampIST: startIST,
      endTimestamp,
      endTimestampIST: endIST,
      durationMinutes,
      lastKnownAddress
    });



    
    res.json({ message: 'Gap saved successfully!' });
  } catch (error) {
    console.error('❌ Error saving gap:', error);
    res.status(500).json({ message: 'DB error' });
  }
});





// ✅ Serve office coordinates
app.get('/api/office-location', (req, res) => {
  res.json({
    latitude: 12.9857016,
    longitude: 77.5979309
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