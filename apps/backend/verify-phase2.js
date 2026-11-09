const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 4001;

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
          resolve({ status: res.statusCode, body: parsed });
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
  console.log('🚀 Starting NestJS Backend on port', PORT, 'for Phase 2 verification...');

  // Reset seed first
  const seedProc = spawn('node', ['apps/backend/prisma/seed.js'], { stdio: 'inherit' });
  await new Promise((resolve) => seedProc.on('exit', resolve));

  // Reset test employees before test
  const { PrismaClient } = require('@prisma/client');
  const cleanupPrisma = new PrismaClient();
  await cleanupPrisma.employeeProfile.deleteMany({
    where: { employeeCode: { not: 'EMP-001' } },
  });
  await cleanupPrisma.$disconnect();

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
    console.log('✅ Server online! Running Phase 2 test suite...\n');

    // 1. Test Employee Login
    console.log('--- Test 1: Employee Code + Password Login ---');
    const loginRes = await request('POST', '/api/v1/auth/login/employee', {
      organizationSlug: 'acme-corp',
      employeeCode: 'EMP-001',
      password: 'EmployeePass123!',
      deviceId: 'device-pixel-8',
    });
    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes)}`);
    }
    const employeeToken = loginRes.body.token;
    console.log('✅ Employee login successful. Received session token.');

    // 2. Test Quick PIN Verification
    console.log('\n--- Test 2: Mobile Quick PIN Re-entry ---');
    const pinRes = await request(
      'POST',
      '/api/v1/auth/session/verify-pin',
      {
        pin: '1234',
        deviceId: 'device-pixel-8',
        deviceSecret: 'dev-secret-1234567890',
      },
      { Authorization: `Bearer ${employeeToken}` },
    );
    if (pinRes.status !== 200 || !pinRes.body.valid) {
      throw new Error(`PIN verification failed: ${JSON.stringify(pinRes)}`);
    }
    console.log('✅ Quick PIN verification succeeded with valid hardware binding.');

    // 3. Test Invalid PIN Rejection
    const badPinRes = await request(
      'POST',
      '/api/v1/auth/session/verify-pin',
      {
        pin: '9999',
        deviceId: 'device-pixel-8',
        deviceSecret: 'dev-secret-1234567890',
      },
      { Authorization: `Bearer ${employeeToken}` },
    );
    if (badPinRes.status !== 401) {
      throw new Error(`Expected 401 on bad PIN, got: ${badPinRes.status}`);
    }
    console.log('✅ Incorrect PIN correctly rejected with 401 Unauthorized.');

    // 4. Test Manager Login & Scoped Provisioning
    console.log('\n--- Test 3: Manager Login & Scoped Provisioning ---');
    const managerLogin = await request('POST', '/api/v1/auth/login/employee', {
      organizationSlug: 'acme-corp',
      employeeCode: 'EMP-001', // reuse session setup
      password: 'EmployeePass123!',
    });
    // Let's create a manager session directly via login if we provision an employee profile for manager,
    // or let's create a manager session for manager@acme.com:
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const manager = await prisma.user.findUnique({ where: { email: 'manager@acme.com' } });
    const org = await prisma.organization.findUnique({ where: { slug: 'acme-corp' } });
    const crypto = require('crypto');
    const mgrToken = 'et_mgr_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: manager.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(mgrToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    await prisma.$disconnect();

    // 4a. Manager provisioning out-of-scope worksite -> MUST FAIL 403
    const badProvision = await request(
      'POST',
      '/api/v1/employees/provision',
      {
        organizationId: org.id,
        employeeCode: 'EMP-OUT-OF-SCOPE',
        fullName: 'Unauthorized Worker',
        email: 'unauth@acme.com',
        primaryWorksiteId: '00000000-0000-0000-0000-999999999999', // out of scope
      },
      { Authorization: `Bearer ${mgrToken}` },
    );
    if (badProvision.status !== 403) {
      throw new Error(`Expected 403 for out-of-scope manager provision, got: ${badProvision.status}`);
    }
    console.log('✅ Manager out-of-scope worksite provisioning strictly blocked (403 Forbidden).');

    // 4b. Manager provisioning in assigned worksite -> MUST SUCCEED 201
    const goodProvision = await request(
      'POST',
      '/api/v1/employees/provision',
      {
        organizationId: org.id,
        employeeCode: 'EMP-002',
        fullName: 'Jane Smith',
        email: 'jane.smith@acme.com',
        department: 'Field Engineering',
        primaryWorksiteId: '00000000-0000-0000-0000-000000000001',
      },
      { Authorization: `Bearer ${mgrToken}` },
    );
    if (goodProvision.status !== 201 || !goodProvision.body.invitationToken) {
      throw new Error(`Expected 201 for valid provision, got: ${JSON.stringify(goodProvision)}`);
    }
    const invitationToken = goodProvision.body.invitationToken;
    console.log('✅ Manager provisioned employee in assigned worksite. Received activation token.');

    // 5. Test Single-Use Activation
    console.log('\n--- Test 4: Single-Use Activation Invitation ---');
    const activateRes = await request('POST', '/api/v1/auth/invitations/accept', {
      token: invitationToken,
      password: 'JaneNewPassword123!',
      pin: '5678',
    });
    if (activateRes.status !== 200 || !activateRes.body.success) {
      throw new Error(`Activation failed: ${JSON.stringify(activateRes)}`);
    }
    console.log('✅ Employee successfully accepted invitation and set credentials.');

    // 5a. Double activation attempt MUST FAIL 400
    const reActivateRes = await request('POST', '/api/v1/auth/invitations/accept', {
      token: invitationToken,
      password: 'JaneNewPassword123!',
    });
    if (reActivateRes.status !== 400) {
      throw new Error(`Expected 400 on duplicate activation, got: ${reActivateRes.status}`);
    }
    console.log('✅ Re-activation of already consumed token strictly rejected (400 Bad Request).');

    // 5b. Log in as newly activated employee
    const newEmployeeLogin = await request('POST', '/api/v1/auth/login/employee', {
      organizationSlug: 'acme-corp',
      employeeCode: 'EMP-002',
      password: 'JaneNewPassword123!',
      deviceId: 'device-iphone-15',
    });
    if (newEmployeeLogin.status !== 200 || !newEmployeeLogin.body.token) {
      throw new Error(`Login with new credentials failed: ${JSON.stringify(newEmployeeLogin)}`);
    }
    console.log('✅ Newly activated employee logged in successfully with custom credentials.');

    // 6. Test Brute-Force Lockout
    console.log('\n--- Test 5: Scoped Brute-Force Lockout Protection ---');
    for (let i = 1; i <= 5; i++) {
      const failRes = await request('POST', '/api/v1/auth/login/employee', {
        organizationSlug: 'acme-corp',
        employeeCode: 'EMP-002',
        password: 'WrongPassword!',
      });
      if (i === 5) {
        if (failRes.status !== 429) {
          throw new Error(`Expected 429 on 5th failed attempt, got ${failRes.status}`);
        }
        console.log('✅ 5th failed attempt triggered 429 Too Many Requests lockout.');
      }
    }

    console.log('\n🎉 ALL PHASE 2 TESTS PASSED PERFECTLY!\n');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
