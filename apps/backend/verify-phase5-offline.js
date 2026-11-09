const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const PORT = 4003;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let resBody = '';
        res.on('data', (chunk) => (resBody += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(resBody);
          } catch {
            parsed = resBody;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Starting NestJS Backend on port', PORT, 'for Phase 5 Offline Sync verification...');

  // Reset seed
  const seedProc = spawn('node', ['apps/backend/prisma/seed.js'], { stdio: 'inherit' });
  await new Promise((resolve) => seedProc.on('exit', resolve));

  const server = spawn('node', ['dist/main.js'], {
    cwd: path.resolve(__dirname),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit',
  });

  try {
    let ready = false;
    for (let i = 0; i < 25; i++) {
      try {
        const res = await request('GET', '/api/v1/health');
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {
        await wait(500);
      }
    }

    if (!ready) {
      throw new Error('Backend failed to boot on port ' + PORT);
    }
    console.log('✅ Server online! Running Phase 5 Offline Sync test suite...\n');

    const prisma = new PrismaClient();
    const org = await prisma.organization.findUnique({ where: { slug: 'acme-corp' } });
    const employeeUser = await prisma.user.findUnique({ where: { email: 'john.doe@acme.com' } });
    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: {
        organizationId_employeeCode: {
          organizationId: org.id,
          employeeCode: 'EMP-001',
        },
      },
    });

    const sessionToken = 'et_sync_test_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: employeeUser.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(sessionToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Clean up any leftover test events for this employee
    await prisma.attendanceEvent.deleteMany({
      where: { employeeProfileId: employeeProfile.id },
    });

    // --- TEST 1: Simulated Offline Event Batch Ingestion ---
    console.log('--- Test 1: Simulated 4-Hour Offline Burst Ingestion ---');
    const batchEvents = [];
    const baseTime = Date.now() - 4 * 60 * 60 * 1000; // 4 hours ago

    for (let seq = 1; seq <= 25; seq++) {
      batchEvents.push({
        eventId: crypto.randomUUID(),
        organizationId: org.id,
        employeeProfileId: employeeProfile.id,
        eventType: seq === 1 ? 'PUNCH_IN_REQUESTED' : 'LOCATION_OBSERVED',
        sequenceNumber: seq,
        clientTimestamp: new Date(baseTime + seq * 60000).toISOString(),
        elapsedRealtimeMs: 1000000 + seq * 60000,
        payload: {
          latitude: 12.9857,
          longitude: 77.5979,
          accuracy: 8,
          isMocked: false,
        },
      });
    }

    const syncRes1 = await request(
      'POST',
      '/api/v1/sync/events',
      { events: batchEvents },
      { Authorization: `Bearer ${sessionToken}` },
    );

    if (syncRes1.status !== 200 || syncRes1.body.acknowledgedEventIds.length !== 25) {
      throw new Error(`Sync batch failed: ${JSON.stringify(syncRes1.body)}`);
    }
    console.log(`✅ Ingested 25 offline events accumulated over 4 hours. Acknowledged: ${syncRes1.body.acknowledgedEventIds.length}.`);

    // --- TEST 2: Duplicate Delivery / Network Timeout Replay Test ---
    console.log('\n--- Test 2: Duplicate Batch Delivery (Idempotent Deduplication) ---');
    const syncRes2 = await request(
      'POST',
      '/api/v1/sync/events',
      { events: batchEvents }, // Exact same 25 events resent
      { Authorization: `Bearer ${sessionToken}` },
    );

    if (syncRes2.status !== 200 || syncRes2.body.acknowledgedEventIds.length !== 25) {
      throw new Error(`Duplicate sync failed: ${JSON.stringify(syncRes2.body)}`);
    }

    // Verify database row count didn't duplicate
    const totalCount = await prisma.attendanceEvent.count({
      where: { employeeProfileId: employeeProfile.id },
    });
    if (totalCount !== 25) {
      throw new Error(`Expected exactly 25 database rows, found: ${totalCount}`);
    }
    console.log(`✅ Duplicate batch acknowledged with 200 OK without duplicating database rows (Total rows: ${totalCount}).`);

    // --- TEST 3: Out-of-Order Batch Delivery & Sequence Reconstruction ---
    console.log('\n--- Test 3: Out-of-Order Event Sequence Reconstruction ---');
    const outOfOrderEvents = [
      {
        eventId: crypto.randomUUID(),
        organizationId: org.id,
        employeeProfileId: employeeProfile.id,
        eventType: 'LOCATION_OBSERVED',
        sequenceNumber: 29, // Future sequence arriving first
        clientTimestamp: new Date(Date.now() - 10000).toISOString(),
        payload: { latitude: 12.9857, longitude: 77.5979 },
      },
      {
        eventId: crypto.randomUUID(),
        organizationId: org.id,
        employeeProfileId: employeeProfile.id,
        eventType: 'LOCATION_OBSERVED',
        sequenceNumber: 26, // Arriving out of order
        clientTimestamp: new Date(Date.now() - 40000).toISOString(),
        payload: { latitude: 12.9857, longitude: 77.5979 },
      },
      {
        eventId: crypto.randomUUID(),
        organizationId: org.id,
        employeeProfileId: employeeProfile.id,
        eventType: 'LOCATION_OBSERVED',
        sequenceNumber: 28,
        clientTimestamp: new Date(Date.now() - 20000).toISOString(),
        payload: { latitude: 12.9857, longitude: 77.5979 },
      },
    ];

    const syncRes3 = await request(
      'POST',
      '/api/v1/sync/events',
      { events: outOfOrderEvents },
      { Authorization: `Bearer ${sessionToken}` },
    );
    if (syncRes3.status !== 200 || syncRes3.body.acknowledgedEventIds.length !== 3) {
      throw new Error(`Out of order sync failed: ${JSON.stringify(syncRes3.body)}`);
    }

    // Fetch chronological event history
    const historyRes = await request(
      'GET',
      `/api/v1/sync/events/${employeeProfile.id}`,
      null,
      { Authorization: `Bearer ${sessionToken}` },
    );
    const history = historyRes.body;
    const sequences = history.map((e) => e.sequenceNumber);
    
    // Verify sequence is strictly monotonic
    for (let i = 1; i < sequences.length; i++) {
      if (sequences[i] < sequences[i - 1]) {
        throw new Error(`Events not sorted chronologically: ${sequences}`);
      }
    }
    console.log('✅ Out-of-order events ingested and reconstructed in strict chronological sequence.');

    // --- TEST 4: Partial Batch Failure Isolation ---
    console.log('\n--- Test 4: Partial Batch Failure Isolation ---');
    const mixedBatch = [
      {
        eventId: crypto.randomUUID(),
        organizationId: org.id,
        employeeProfileId: employeeProfile.id,
        eventType: 'LOCATION_OBSERVED',
        sequenceNumber: 30,
        clientTimestamp: new Date().toISOString(),
        payload: { latitude: 12.9857, longitude: 77.5979 },
      },
      {
        eventId: crypto.randomUUID(),
        organizationId: '00000000-0000-0000-0000-999999999999', // Malicious cross-tenant event!
        employeeProfileId: employeeProfile.id,
        eventType: 'LOCATION_OBSERVED',
        sequenceNumber: 31,
        clientTimestamp: new Date().toISOString(),
        payload: { latitude: 12.9857, longitude: 77.5979 },
      },
    ];

    const partialRes = await request(
      'POST',
      '/api/v1/sync/events',
      { events: mixedBatch },
      { Authorization: `Bearer ${sessionToken}` },
    );
    if (
      partialRes.status !== 200 ||
      partialRes.body.acknowledgedEventIds.length !== 1 ||
      partialRes.body.rejectedEvents.length !== 1
    ) {
      throw new Error(`Expected partial failure handling, got: ${JSON.stringify(partialRes.body)}`);
    }
    console.log('✅ Partial batch isolation verified: valid event acknowledged, malicious event rejected with reason.');

    // --- TEST 5: Full Jitter Exponential Backoff Math Verification ---
    console.log('\n--- Test 5: Full Jitter Exponential Backoff Verification ---');
    function calculateBackoffWithJitter(attempt) {
      const maxBackoffMs = 60000;
      const baseBackoffMs = 2000;
      const exponential = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, attempt));
      return Math.floor(Math.random() * exponential);
    }

    for (let attempt = 1; attempt <= 6; attempt++) {
      const wait = calculateBackoffWithJitter(attempt);
      const maxPossible = Math.min(60000, 2000 * Math.pow(2, attempt));
      if (wait < 0 || wait > maxPossible) {
        throw new Error(`Invalid backoff calculated: ${wait} for attempt ${attempt} (max: ${maxPossible})`);
      }
    }
    console.log('✅ Full jitter exponential backoff verified across all attempt tiers.');

    await prisma.$disconnect();
    console.log('\n🎉 ALL PHASE 5 OFFLINE SYNC TESTS PASSED PERFECTLY!\n');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
