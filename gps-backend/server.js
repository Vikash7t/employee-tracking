const express = require('express');
const cors = require('cors');
const { DateTime } = require('luxon');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security configuration from environment
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'dev_admin_secret_key_change_in_prod';
const CLIENT_API_KEY = process.env.CLIENT_API_KEY || 'dev_client_api_key_change_in_prod';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
  : null;

// Lightweight in-memory rate limiter (sliding window counter)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = requestCounts.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    entry.count += 1;
  }

  requestCounts.set(ip, entry);

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  next();
}

// Periodic cleanup of rate limit map (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requestCounts.entries()) {
    if (now > entry.resetTime) requestCounts.delete(ip);
  }
}, 5 * 60 * 1000).unref();

// Middleware
app.use(rateLimiter);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, server-to-server) where origin is undefined
    if (!origin) return callback(null, true);
    if (!ALLOWED_ORIGINS || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Access denied for this origin.'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'x-admin-key']
}));

app.use(express.json({ limit: '64kb' })); // Restrict payload size

// Security Guard Middlewares
function requireAdminKey(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Valid x-admin-key header required.' });
  }
  next();
}

function requireClientApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const enforceKey = process.env.ENFORCE_CLIENT_API_KEY === 'true';

  if (apiKey) {
    if (apiKey !== CLIENT_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized: Invalid x-api-key.' });
    }
    return next();
  }

  // Grace period for existing installed field APKs:
  if (enforceKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing x-api-key header.' });
  }

  console.warn(`⚠️ [LEGACY_INGESTION] Received write from ${req.ip} without x-api-key`);
  next();
}

// String validation helper
function isValidString(val, minLen = 1, maxLen = 255) {
  return typeof val === 'string' && val.trim().length >= minLen && val.trim().length <= maxLen;
}

function convertToIST(mysqlTimestamp) {
  if (!mysqlTimestamp) return null;
  return DateTime
    .fromSQL(mysqlTimestamp, { zone: 'utc' })
    .setZone('Asia/Kolkata')
    .toFormat('yyyy-MM-dd HH:mm:ss');
}

// Database Connection Check
db.getConnection()
  .then(conn => {
    console.log('✅ Connected to MySQL database pool');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error connecting to MySQL:', err.message);
  });

// 1. Ingestion: Save location to MySQL (Protected with client API key & payload validation)
app.post('/api/location', requireClientApiKey, async (req, res) => {
  const { employeeId, employeeName, address, employeeTimestamp, status } = req.body;

  if (!isValidString(employeeId, 1, 64) || !isValidString(employeeName, 1, 128)) {
    return res.status(400).json({ error: 'Invalid or missing employeeId / employeeName' });
  }

  try {
    const date = new Date();
    const generatedTimestamp = date.toISOString().slice(0, 19).replace('T', ' ');
    const mysqlTimestamp = employeeTimestamp && isValidString(employeeTimestamp, 10, 30)
      ? employeeTimestamp
      : generatedTimestamp;

    await db.query(
      `INSERT INTO employee_locations 
        (employee_id, employee_name, address, timestamp, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        employeeId.trim(),
        employeeName.trim(),
        typeof address === 'string' ? address.slice(0, 500) : null,
        mysqlTimestamp,
        typeof status === 'string' ? status.slice(0, 100) : 'Unknown'
      ]
    );

    res.json({ message: 'Location saved successfully' });
  } catch (error) {
    console.error('❌ Error saving location:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Ingestion: Save connectivity gap to MySQL
app.post('/api/track-gap', requireClientApiKey, async (req, res) => {
  const { 
    employeeId, 
    employeeName, 
    gapType, 
    startTimestamp, 
    endTimestamp, 
    durationMinutes, 
    lastKnownAddress 
  } = req.body;

  if (!isValidString(employeeId, 1, 64) || !isValidString(employeeName, 1, 128)) {
    return res.status(400).json({ error: 'Invalid or missing employeeId / employeeName' });
  }

  const validGapTypes = ['GPS', 'INTERNET', 'APP_TERMINATED'];
  if (!gapType || !validGapTypes.includes(gapType)) {
    return res.status(400).json({ error: 'Invalid gapType. Must be GPS or INTERNET' });
  }

  try {
    await db.query(
      `INSERT INTO connectivity_gaps
         (employee_id, employee_name, gap_type, start_timestamp, end_timestamp, duration_minutes, last_known_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId.trim(),
        employeeName.trim(),
        gapType,
        startTimestamp || null,
        endTimestamp || null,
        typeof durationMinutes === 'number' ? Math.round(durationMinutes) : null,
        typeof lastKnownAddress === 'string' ? lastKnownAddress.slice(0, 500) : null
      ]
    );

    res.json({ message: 'Gap saved successfully' });
  } catch (error) {
    console.error('❌ Error saving gap:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Office reference location
app.get('/api/office-location', (req, res) => {
  res.json({
    latitude: 12.9857016,
    longitude: 77.5979309
  });
});

// 4. Read location records (CONTAINMENT FIX: Protected with Admin Secret Key)
app.get('/api/location', requireAdminKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const [rows] = await db.query(
      'SELECT id, employee_id, employee_name, address, timestamp, status FROM employee_locations ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('❌ Error fetching data:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔒 Secured legacy backend running at http://0.0.0.0:${PORT}`);
});
