/**
 * Phase 6 Integration Verification Test Suite:
 * Deterministic Attendance State Machine, Geofence Grace Periods, Interval Accounting, and OWASP Security.
 */
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const PORT = 4004;
const BASE_URL = `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log(`🚀 Starting NestJS Backend on port ${PORT} for Phase 6 Attendance State Machine verification...`);

  const server = spawn('npm', ['run', 'start:dev', '--workspace=@employee-tracking/backend'], {
    env: { ...process.env, PORT: PORT.toString() },
    stdio: 'inherit',
    shell: true,
  });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
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
    console.log('✅ Server online! Running Phase 6 Attendance State Machine test suite...\n');

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

    // Create a circular worksite with 50m radius and 10-second grace period for quick test evaluation
    let testWorksite = await prisma.worksite.findFirst({
      where: { organizationId: org.id, name: 'Phase 6 Test Worksite' },
    });
    if (!testWorksite) {
      testWorksite = await prisma.worksite.create({
        data: {
          organizationId: org.id,
          name: 'Phase 6 Test Worksite',
          latitude: 12.9857,
          longitude: 77.5979,
          radiusMeters: 50,
          gracePeriodSeconds: 10,
        },
      });
    }

    // Clean up past sessions and intervals for clean test run
    await prisma.attendanceInterval.deleteMany({
      where: { attendanceSession: { employeeProfileId: employeeProfile.id } },
    });
    await prisma.attendanceSession.deleteMany({
      where: { employeeProfileId: employeeProfile.id },
    });

    const sessionToken = 'et_phase6_test_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: employeeUser.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(sessionToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const authHeaders = { Authorization: `Bearer ${sessionToken}` };

    // --- TEST 1: Punch In Inside Worksite ---
    console.log('--- Test 1: Geofence Punch-In Verification ---');
    const punchInRes = await request(
      'POST',
      '/api/v1/attendance/punch-in',
      {
        worksiteId: testWorksite.id,
        latitude: 12.9857, // Exact worksite coordinates
        longitude: 77.5979,
        accuracy: 5,
      },
      authHeaders,
    );

    if (punchInRes.status !== 201 && punchInRes.status !== 200) {
      throw new Error(`Punch-in failed: ${JSON.stringify(punchInRes.body)}`);
    }
    const session1 = punchInRes.body;
    if (
      session1.status !== 'ACTIVE' ||
      session1.presenceStatus !== 'INSIDE' ||
      session1.reviewStatus !== 'NOT_REQUIRED'
    ) {
      throw new Error(`Invalid punch-in session state: ${JSON.stringify(session1)}`);
    }
    console.log(`✅ Punch-in verified: Session ${session1.id} ACTIVE (Presence: INSIDE, Review: NOT_REQUIRED).`);

    // --- TEST 2: Reject Concurrent Punch-In ---
    console.log('\n--- Test 2: Concurrent Active Session Prevention ---');
    const duplicatePunchIn = await request(
      'POST',
      '/api/v1/attendance/punch-in',
      {
        worksiteId: testWorksite.id,
        latitude: 12.9857,
        longitude: 77.5979,
        accuracy: 5,
      },
      authHeaders,
    );

    if (duplicatePunchIn.status !== 400) {
      throw new Error(`Expected 400 Bad Request on duplicate punch-in, got: ${duplicatePunchIn.status}`);
    }
    console.log('✅ Duplicate punch-in correctly rejected (400 Bad Request: Employee already has an active attendance session).');

    // --- TEST 3: Exit Grace Period Initiation & Cancellation (Bounce Protection) ---
    console.log('\n--- Test 3: Exit Grace Period Initiation & Cancellation (Bounce Flap) ---');
    const { AttendanceService } = require('./dist/modules/attendance/attendance.service');
    
    // Simulate mobile observation 500m outside worksite
    const outsideObsTime = new Date();
    await request(
      'POST',
      '/api/v1/sync/events',
      {
        events: [
          {
            eventId: crypto.randomUUID(),
            organizationId: org.id,
            employeeProfileId: employeeProfile.id,
            eventType: 'LOCATION_OBSERVED',
            sequenceNumber: 101,
            clientTimestamp: outsideObsTime.toISOString(),
            payload: { latitude: 12.9950, longitude: 77.6100, accuracy: 10 },
          },
        ],
      },
      authHeaders,
    );

    const pendingSession = await prisma.attendanceSession.findUnique({
      where: { id: session1.id },
    });
    if (pendingSession.presenceStatus !== 'EXIT_PENDING' || !pendingSession.exitGraceExpiresAt) {
      throw new Error(`Expected EXIT_PENDING status with grace deadline, got: ${pendingSession.presenceStatus}`);
    }
    console.log('✅ First outside observation initiated EXIT_PENDING with persisted grace deadline.');

    // Simulate immediate return before grace expiration (3 seconds later)
    const returnObsTime = new Date(outsideObsTime.getTime() + 3000);
    await request(
      'POST',
      '/api/v1/sync/events',
      {
        events: [
          {
            eventId: crypto.randomUUID(),
            organizationId: org.id,
            employeeProfileId: employeeProfile.id,
            eventType: 'LOCATION_OBSERVED',
            sequenceNumber: 102,
            clientTimestamp: returnObsTime.toISOString(),
            payload: { latitude: 12.9857, longitude: 77.5979, accuracy: 5 },
          },
        ],
      },
      authHeaders,
    );

    const restoredSession = await prisma.attendanceSession.findUnique({
      where: { id: session1.id },
    });
    if (restoredSession.presenceStatus !== 'INSIDE' || restoredSession.exitPendingSince !== null) {
      throw new Error(`Expected cancellation of EXIT_PENDING on quick return, got: ${restoredSession.presenceStatus}`);
    }
    console.log('✅ Quick return before grace expiration cancelled EXIT_PENDING and restored INSIDE status without false breach.');

    // --- TEST 4: Grace Expiration & Confirmed Exit ---
    console.log('\n--- Test 4: Grace Expiration & Confirmed Exit ---');
    const exitStartTime = new Date();
    // Step A: Trigger EXIT_PENDING again
    await request(
      'POST',
      '/api/v1/sync/events',
      {
        events: [
          {
            eventId: crypto.randomUUID(),
            organizationId: org.id,
            employeeProfileId: employeeProfile.id,
            eventType: 'LOCATION_OBSERVED',
            sequenceNumber: 103,
            clientTimestamp: exitStartTime.toISOString(),
            payload: { latitude: 12.9950, longitude: 77.6100, accuracy: 10 },
          },
        ],
      },
      authHeaders,
    );

    // Step B: Observation 15 seconds later (past 10s grace period)
    const exitConfirmTime = new Date(exitStartTime.getTime() + 15000);
    await request(
      'POST',
      '/api/v1/sync/events',
      {
        events: [
          {
            eventId: crypto.randomUUID(),
            organizationId: org.id,
            employeeProfileId: employeeProfile.id,
            eventType: 'LOCATION_OBSERVED',
            sequenceNumber: 104,
            clientTimestamp: exitConfirmTime.toISOString(),
            payload: { latitude: 12.9950, longitude: 77.6100, accuracy: 10 },
          },
        ],
      },
      authHeaders,
    );

    const confirmedExitSession = await prisma.attendanceSession.findUnique({
      where: { id: session1.id },
    });
    if (confirmedExitSession.presenceStatus !== 'OUTSIDE') {
      throw new Error(`Expected confirmed OUTSIDE status after grace expiration, got: ${confirmedExitSession.presenceStatus}`);
    }
    console.log('✅ Continuous observation beyond grace deadline confirmed OUTSIDE presence.');

    // --- TEST 5: Re-entry Detection ---
    console.log('\n--- Test 5: Re-entry Detection ---');
    const reentryTime = new Date(exitConfirmTime.getTime() + 20000);
    await request(
      'POST',
      '/api/v1/sync/events',
      {
        events: [
          {
            eventId: crypto.randomUUID(),
            organizationId: org.id,
            employeeProfileId: employeeProfile.id,
            eventType: 'LOCATION_OBSERVED',
            sequenceNumber: 105,
            clientTimestamp: reentryTime.toISOString(),
            payload: { latitude: 12.9857, longitude: 77.5979, accuracy: 5 },
          },
        ],
      },
      authHeaders,
    );

    const reenteredSession = await prisma.attendanceSession.findUnique({
      where: { id: session1.id },
    });
    if (reenteredSession.presenceStatus !== 'INSIDE') {
      throw new Error(`Expected INSIDE status on re-entry, got: ${reenteredSession.presenceStatus}`);
    }
    console.log('✅ Re-entry into worksite successfully detected and confirmed.');

    // --- TEST 6: Clean Clock-Out & Interval Reconciliation ---
    console.log('\n--- Test 6: Clean Clock-Out & Interval Reconciliation ---');
    const punchOutRes = await request(
      'POST',
      '/api/v1/attendance/punch-out',
      {
        latitude: 12.9857,
        longitude: 77.5979,
      },
      authHeaders,
    );

    if (punchOutRes.status !== 200 && punchOutRes.status !== 201) {
      throw new Error(`Punch out failed: ${JSON.stringify(punchOutRes.body)}`);
    }
    const completedSession = punchOutRes.body;
    if (completedSession.status !== 'COMPLETED' || !completedSession.clockOutAt) {
      throw new Error(`Session not marked COMPLETED: ${JSON.stringify(completedSession)}`);
    }

    const intervals = await prisma.attendanceInterval.findMany({
      where: { attendanceSessionId: session1.id },
      orderBy: { startedAt: 'asc' },
    });
    console.log(`✅ Session marked COMPLETED. Granular attendance intervals recorded: ${intervals.length}`);
    for (const inv of intervals) {
      console.log(`   - [${inv.intervalType}] from ${inv.startedAt.toISOString()} to ${inv.endedAt ? inv.endedAt.toISOString() : 'ACTIVE'} (${inv.durationSeconds || 0}s)`);
    }

    // --- TEST 7: OWASP BOLA / IDOR Verification ---
    console.log('\n--- Test 7: OWASP BOLA / IDOR Verification ---');
    const unauthorizedQuery = await request(
      'GET',
      '/api/v1/attendance/history?employeeProfileId=00000000-0000-0000-0000-000000000001',
      null,
      authHeaders,
    );
    if (unauthorizedQuery.status !== 403) {
      throw new Error(`Expected 403 Forbidden on cross-employee history query, got: ${unauthorizedQuery.status}`);
    }
    console.log('✅ OWASP BOLA check passed: Employee cannot query coworker attendance history (403 Forbidden).');

    await prisma.$disconnect();
    console.log('\n🎉 ALL PHASE 6 ATTENDANCE STATE MACHINE TESTS PASSED PERFECTLY!\n');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
