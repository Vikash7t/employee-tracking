/**
 * Phase 8 Integration Verification Test Suite:
 * Shift & Break Orchestration, Overnight Shifts, Grace Lateness Detection, and Conflict Validation.
 */
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const PORT = 4005;
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
  console.log(`🚀 Starting NestJS Backend on port ${PORT} for Phase 8 Shift Orchestration verification...`);

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
    console.log('✅ Server online! Running Phase 8 Shift Orchestration test suite...\n');

    const prisma = new PrismaClient();
    const org = await prisma.organization.findUnique({ where: { slug: 'acme-corp' } });
    const ownerUser = await prisma.user.findUnique({ where: { email: 'owner@acme.com' } });
    const employeeUser = await prisma.user.findUnique({ where: { email: 'john.doe@acme.com' } });
    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: {
        organizationId_employeeCode: {
          organizationId: org.id,
          employeeCode: 'EMP-001',
        },
      },
    });

    // Create session token for owner (Admin/Manager role)
    const ownerToken = 'et_phase8_owner_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: ownerUser.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(ownerToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    // Create session token for employee (Member role)
    const empToken = 'et_phase8_emp_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: employeeUser.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(empToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    const empHeaders = { Authorization: `Bearer ${empToken}` };

    // Clean up test shifts and assignments
    await prisma.shiftAssignment.deleteMany({ where: { organizationId: org.id } });
    await prisma.shiftTemplate.deleteMany({ where: { organizationId: org.id } });
    await prisma.attendanceInterval.deleteMany({
      where: { attendanceSession: { employeeProfileId: employeeProfile.id } },
    });
    await prisma.attendanceSession.deleteMany({
      where: { employeeProfileId: employeeProfile.id },
    });

    // Find test worksite
    let worksite = await prisma.worksite.findFirst({ where: { organizationId: org.id } });

    // --- TEST 1: Standard Day Shift Template Creation ---
    console.log('--- Test 1: Standard Day Shift Template Creation ---');
    const dayShiftRes = await request(
      'POST',
      '/api/v1/shifts/templates',
      {
        organizationId: org.id,
        name: 'Standard Morning Shift',
        startTime: '09:00',
        endTime: '18:00',
        lateArrivalGraceMin: 15,
        earlyExitGraceMin: 10,
        breakAllowanceMin: 60,
      },
      ownerHeaders,
    );

    if (dayShiftRes.status !== 201) {
      throw new Error(`Failed to create day shift: ${JSON.stringify(dayShiftRes.body)}`);
    }
    const dayShift = dayShiftRes.body;
    if (dayShift.isOvernight !== false || dayShift.startTime !== '09:00') {
      throw new Error(`Invalid day shift data: ${JSON.stringify(dayShift)}`);
    }
    console.log(`✅ Standard day shift "${dayShift.name}" created (09:00-18:00, Overnight: false).`);

    // --- TEST 2: Overnight Shift Template Creation with Auto-Detection ---
    console.log('\n--- Test 2: Overnight Shift Template Creation (Auto-Detection) ---');
    const nightShiftRes = await request(
      'POST',
      '/api/v1/shifts/templates',
      {
        organizationId: org.id,
        name: 'Night Operations Shift',
        startTime: '22:00',
        endTime: '06:00',
        lateArrivalGraceMin: 15,
        earlyExitGraceMin: 15,
        breakAllowanceMin: 45,
      },
      ownerHeaders,
    );

    if (nightShiftRes.status !== 201) {
      throw new Error(`Failed to create night shift: ${JSON.stringify(nightShiftRes.body)}`);
    }
    const nightShift = nightShiftRes.body;
    if (nightShift.isOvernight !== true) {
      throw new Error(`Expected isOvernight to be true for 22:00 -> 06:00 shift`);
    }
    console.log(`✅ Overnight shift "${nightShift.name}" created (22:00-06:00, Overnight: true detected automatically).`);

    // --- TEST 3: Assign Shift Schedule to Employee ---
    console.log('\n--- Test 3: Assign Shift Schedule to Employee ---');
    const today = new Date();
    const jsDay = today.getDay();
    const currentDayOfWeek = jsDay === 0 ? 7 : jsDay;

    const assignRes = await request(
      'POST',
      '/api/v1/shifts/assign',
      {
        organizationId: org.id,
        employeeProfileId: employeeProfile.id,
        shiftTemplateId: dayShift.id,
        workDays: [1, 2, 3, 4, 5, 6, 7], // All days for testing
        effectiveFrom: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      },
      ownerHeaders,
    );

    if (assignRes.status !== 201) {
      throw new Error(`Failed to assign shift: ${JSON.stringify(assignRes.body)}`);
    }
    console.log(`✅ Assigned "${dayShift.name}" to employee ${employeeProfile.employeeCode}.`);

    // --- TEST 4: Schedule Conflict Detection ---
    console.log('\n--- Test 4: Schedule Conflict Rejection ---');
    const conflictRes = await request(
      'POST',
      '/api/v1/shifts/assign',
      {
        organizationId: org.id,
        employeeProfileId: employeeProfile.id,
        shiftTemplateId: nightShift.id,
        workDays: [currentDayOfWeek], // Conflicting workday
        effectiveFrom: new Date().toISOString().split('T')[0],
      },
      ownerHeaders,
    );

    if (conflictRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request on conflicting shift assignment, got: ${conflictRes.status}`);
    }
    console.log('✅ Conflicting overlapping shift assignment correctly rejected (400 Bad Request).');

    // --- TEST 5: Automatic Lateness Detection on Punch-In ---
    console.log('\n--- Test 5: Automatic Lateness Detection on Punch-In ---');
    // Simulate punch-in at 09:30 AM (scheduled: 09:00, grace: 15m => 15m late past grace)
    const latePunchInTime = new Date();
    latePunchInTime.setHours(9, 30, 0, 0);

    const punchInRes = await request(
      'POST',
      '/api/v1/attendance/punch-in',
      {
        worksiteId: worksite.id,
        latitude: Number(worksite.latitude),
        longitude: Number(worksite.longitude),
        accuracy: 10,
        clientTimestamp: latePunchInTime.toISOString(),
      },
      empHeaders,
    );

    if (punchInRes.status !== 200 && punchInRes.status !== 201) {
      throw new Error(`Punch-in failed: ${JSON.stringify(punchInRes.body)}`);
    }
    const session = punchInRes.body;
    if (session.shiftTemplateId !== dayShift.id || session.isLate !== true) {
      throw new Error(`Expected isLate: true associated with shift template, got: ${JSON.stringify(session)}`);
    }
    console.log(`✅ Lateness auto-detected: Session ${session.id} marked isLate: true (Review: PENDING_REVIEW).`);

    // --- TEST 6: Automatic Early Departure Detection on Punch-Out ---
    console.log('\n--- Test 6: Automatic Early Departure Detection on Punch-Out ---');
    // Simulate punch-out at 16:00 PM (scheduled: 18:00, earlyExitGrace: 10m => 2h early)
    const earlyPunchOutTime = new Date();
    earlyPunchOutTime.setHours(16, 0, 0, 0);

    const punchOutRes = await request(
      'POST',
      '/api/v1/attendance/punch-out',
      {
        latitude: Number(worksite.latitude),
        longitude: Number(worksite.longitude),
        clientTimestamp: earlyPunchOutTime.toISOString(),
      },
      empHeaders,
    );

    if (punchOutRes.status !== 200 && punchOutRes.status !== 201) {
      throw new Error(`Punch-out failed: ${JSON.stringify(punchOutRes.body)}`);
    }
    const completed = punchOutRes.body;
    if (completed.isEarlyDeparture !== true) {
      throw new Error(`Expected isEarlyDeparture: true, got: ${JSON.stringify(completed)}`);
    }
    console.log('✅ Early departure auto-detected: Session marked isEarlyDeparture: true.');

    // --- TEST 7: Attendance Variance Calculation ---
    console.log('\n--- Test 7: Attendance Variance Calculation ---');
    const varianceRes = await request(
      'GET',
      `/api/v1/shifts/sessions/${session.id}/variance`,
      null,
      ownerHeaders,
    );

    if (varianceRes.status !== 200) {
      throw new Error(`Variance calculation failed: ${JSON.stringify(varianceRes.body)}`);
    }
    const v = varianceRes.body;
    if (!v.isLate || v.latenessMinutes !== 30 || !v.isEarlyDeparture || v.earlyDepartureMinutes !== 120) {
      throw new Error(`Invalid variance metrics: ${JSON.stringify(v)}`);
    }
    console.log(`✅ Variance calculation verified: Lateness = ${v.latenessMinutes}min, Early Departure = ${v.earlyDepartureMinutes}min, Actual Duration = ${v.actualDurationMinutes}min.`);

    // --- TEST 8: Scoped RBAC Validation ---
    console.log('\n--- Test 8: Scoped RBAC Validation ---');
    const unauthorizedShiftCreation = await request(
      'POST',
      '/api/v1/shifts/templates',
      {
        organizationId: org.id,
        name: 'Unauthorized Shift',
        startTime: '10:00',
        endTime: '19:00',
      },
      empHeaders, // Employee token
    );

    if (unauthorizedShiftCreation.status !== 403) {
      throw new Error(`Expected 403 Forbidden on employee shift creation, got: ${unauthorizedShiftCreation.status}`);
    }
    console.log('✅ Scoped RBAC check passed: Employee cannot create shift templates (403 Forbidden).');

    await prisma.$disconnect();
    console.log('\n🎉 ALL PHASE 8 SHIFT ORCHESTRATION TESTS PASSED PERFECTLY!\n');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
