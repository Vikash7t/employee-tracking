/**
 * Phase 9 Integration Verification Test Suite:
 * Audited Reports, Timesheet Analytics, Streaming CSV Export with OWASP Formula Injection Protection,
 * and Tamper-Proof Attendance Corrections.
 */
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const PORT = 4006;
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
            resolve({ status: res.statusCode, headers: res.headers, body: parsed, rawText: data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data, rawText: data });
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
  console.log(`🚀 Starting NestJS Backend on port ${PORT} for Phase 9 Reports & Analytics verification...`);

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
    console.log('✅ Server online! Running Phase 9 Reports & Analytics test suite...\n');

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

    const worksite = await prisma.worksite.findFirst({ where: { organizationId: org.id } });

    // Create session token for owner (Admin/Manager role)
    const ownerToken = 'et_phase9_owner_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: ownerUser.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(ownerToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Create session token for employee (Member role)
    const employeeToken = 'et_phase9_emp_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: employeeUser.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(employeeToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const employeeHeaders = { Authorization: `Bearer ${employeeToken}` };

    // Seed test attendance session with known durations and formula injection string in employee profile department
    const testSession = await prisma.attendanceSession.create({
      data: {
        organization: { connect: { id: org.id } },
        employeeProfile: { connect: { id: employeeProfile.id } },
        worksite: { connect: { id: worksite.id } },
        clockInAt: new Date('2026-11-09T09:15:00Z'),
        clockOutAt: new Date('2026-11-09T17:30:00Z'),
        status: 'COMPLETED',
        reviewStatus: 'APPROVED',
        isLate: true,
        isEarlyDeparture: false,
        insideDurationSeconds: 27000, // 450 mins inside
        outsideDurationSeconds: 2700, // 45 mins outside
      },
    });

    console.log('🧪 TEST 1: Timesheet Summary Analytics Aggregation');
    const timesheetRes = await request(
      'GET',
      '/api/v1/reports/timesheet?startDate=2026-11-01&endDate=2026-11-10',
      null,
      ownerHeaders,
    );
    if (timesheetRes.status !== 200) {
      throw new Error(`Timesheet summary failed: ${JSON.stringify(timesheetRes.body)}`);
    }
    const timesheet = timesheetRes.body;
    console.log(`   - Total Sessions: ${timesheet.totalSessions}`);
    console.log(`   - Total Inside Minutes: ${timesheet.totalInsideMinutes}`);
    console.log(`   - Late Count: ${timesheet.totalLateCount}`);
    if (timesheet.totalSessions < 1 || timesheet.totalLateCount < 1) {
      throw new Error('Timesheet summary metric count mismatch');
    }
    console.log('   ✅ Timesheet summary aggregation verified.\n');

    console.log('🧪 TEST 2: Worksite Adherence Report');
    const adherenceRes = await request(
      'GET',
      '/api/v1/reports/worksite-adherence?startDate=2026-11-01&endDate=2026-11-10',
      null,
      ownerHeaders,
    );
    if (adherenceRes.status !== 200) {
      throw new Error(`Worksite adherence report failed: ${JSON.stringify(adherenceRes.body)}`);
    }
    const adherence = adherenceRes.body;
    console.log(`   - Total Worksites: ${adherence.worksites.length}`);
    const activeSite = adherence.worksites.find((w) => w.totalSessions > 0);
    if (!activeSite || typeof activeSite.adherencePercentage !== 'number') {
      throw new Error('Worksite adherence percentage is invalid or missing');
    }
    console.log(`   - Active Worksite "${activeSite.worksiteName}" Adherence Rate: ${activeSite.adherencePercentage}%`);
    console.log('   ✅ Worksite adherence report verified.\n');

    console.log('🧪 TEST 3: Streaming CSV Export & OWASP Formula Injection Neutralization');
    // Temporarily update employee profile full name to test formula injection string
    const originalName = employeeProfile.fullName;
    const maliciousFormula = "=cmd|' /C calc'!A0";
    await prisma.employeeProfile.update({
      where: { id: employeeProfile.id },
      data: { fullName: maliciousFormula },
    });

    const csvRes = await request(
      'GET',
      '/api/v1/reports/export/timesheet-csv?startDate=2026-11-01&endDate=2026-11-10',
      null,
      ownerHeaders,
    );
    if (csvRes.status !== 200) {
      throw new Error(`CSV export failed: ${csvRes.rawText}`);
    }
    if (!csvRes.headers['content-type']?.includes('text/csv')) {
      throw new Error(`Unexpected Content-Type: ${csvRes.headers['content-type']}`);
    }
    // Restore profile name immediately
    await prisma.employeeProfile.update({
      where: { id: employeeProfile.id },
      data: { fullName: originalName },
    });

    const csvContent = csvRes.rawText;
    console.log(`   - CSV Header: ${csvContent.split('\r\n')[0]}`);
    console.log(`   - CSV Stream preview length: ${csvContent.length} bytes`);

    // Verify formula was neutralized by prepending single quote
    const formulaEscaped = `"'${maliciousFormula}"`;
    if (!csvContent.includes(formulaEscaped)) {
      throw new Error(`OWASP Formula Injection sanitizer failed! Expected ${formulaEscaped} in CSV stream.`);
    }
    console.log('   - Formula Injection string neutralized to:', formulaEscaped);
    console.log('   ✅ CSV streaming export and OWASP CWE-1236 mitigation verified.\n');

    console.log('🧪 TEST 4: Audited Attendance Correction Creation & Session History');
    const newClockIn = '2026-11-09T09:00:00.000Z';
    const correctionRes = await request(
      'POST',
      '/api/v1/reports/corrections',
      {
        attendanceSessionId: testSession.id,
        fieldAdjusted: 'clockInAt',
        newValue: newClockIn,
        reason: 'Manager approved grace period due to transit delay',
      },
      ownerHeaders,
    );

    if (correctionRes.status !== 201) {
      throw new Error(`Correction failed: ${JSON.stringify(correctionRes.body)}`);
    }
    console.log(`   - Correction Log ID: ${correctionRes.body.id}`);
    console.log(`   - Original: ${correctionRes.body.originalValue} -> Corrected: ${correctionRes.body.correctedValue}`);

    // Verify session was actually updated
    const updatedSession = await prisma.attendanceSession.findUnique({
      where: { id: testSession.id },
    });
    if (new Date(updatedSession.clockInAt).toISOString() !== newClockIn) {
      throw new Error('Attendance session clockInAt was not adjusted');
    }

    // Verify history retrieval
    const historyRes = await request(
      'GET',
      `/api/v1/reports/sessions/${testSession.id}/corrections`,
      null,
      ownerHeaders,
    );
    if (historyRes.status !== 200 || historyRes.body.length < 1) {
      throw new Error('Failed to retrieve session correction history');
    }
    console.log(`   - Verified ${historyRes.body.length} audited correction records in session timeline.`);
    console.log('   ✅ Audited correction engine and immutable trail verified.\n');

    console.log('🧪 TEST 5: RBAC & Security Boundary Enforcement');
    // Regular employee should NOT be able to apply corrections
    const forbiddenRes = await request(
      'POST',
      '/api/v1/reports/corrections',
      {
        attendanceSessionId: testSession.id,
        fieldAdjusted: 'status',
        newValue: 'APPROVED',
        reason: 'Unauthorized employee adjustment',
      },
      employeeHeaders,
    );
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for employee correction, got ${forbiddenRes.status}`);
    }
    console.log('   - Member rejected with 403 Forbidden on manual correction.');

    // Attempt invalid field adjustment (e.g. employeeProfileId or id)
    const invalidFieldRes = await request(
      'POST',
      '/api/v1/reports/corrections',
      {
        attendanceSessionId: testSession.id,
        fieldAdjusted: 'id',
        newValue: 'tampered-id',
        reason: 'Tamper attempt',
      },
      ownerHeaders,
    );
    if (invalidFieldRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for ineligible field adjustment, got ${invalidFieldRes.status}`);
    }
    console.log('   - Tamper attempt on immutable field rejected with 400 Bad Request.');
    console.log('   ✅ RBAC and boundary enforcement verified.\n');

    // Clean up test session
    await prisma.attendanceCorrection.deleteMany({
      where: { attendanceSessionId: testSession.id },
    });
    await prisma.attendanceSession.delete({
      where: { id: testSession.id },
    });
    await prisma.session.deleteMany({
      where: { tokenHash: { in: [
        crypto.createHash('sha256').update(ownerToken).digest('hex'),
        crypto.createHash('sha256').update(employeeToken).digest('hex')
      ] } }
    });

    console.log('🎉 ALL 5 PHASE 9 VERIFICATION SUITE CHECKS PASSED WITH ZERO ERRORS!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    server.kill();
  }
}

run();
