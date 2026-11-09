const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const PORT = 4002;

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
  console.log('🚀 Starting NestJS Backend on port', PORT, 'for Phase 3 & OWASP verification...');

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
    console.log('✅ Server online! Running Phase 3 test suite...\n');

    // --- TEST 1: OWASP Security Headers (Helmet) ---
    console.log('--- Test 1: OWASP Helmet Security Headers ---');
    const healthRes = await request('GET', '/api/v1/health');
    if (healthRes.headers['x-frame-options'] !== 'DENY') {
      throw new Error(`Expected X-Frame-Options: DENY, got: ${healthRes.headers['x-frame-options']}`);
    }
    if (healthRes.headers['x-content-type-options'] !== 'nosniff') {
      throw new Error(`Expected X-Content-Type-Options: nosniff, got: ${healthRes.headers['x-content-type-options']}`);
    }
    if (healthRes.headers['x-powered-by']) {
      throw new Error(`X-Powered-By header should be hidden, but was: ${healthRes.headers['x-powered-by']}`);
    }
    console.log('✅ OWASP Helmet security headers active (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, X-Powered-By hidden).');

    // Setup Admin Session for Worksite Management
    const prisma = new PrismaClient();
    const org = await prisma.organization.findUnique({ where: { slug: 'acme-corp' } });
    const owner = await prisma.user.findUnique({ where: { email: 'owner@acme.com' } });
    const ownerToken = 'et_test_owner_' + crypto.randomBytes(16).toString('hex');
    await prisma.session.create({
      data: {
        userId: owner.id,
        activeOrganizationId: org.id,
        tokenHash: crypto.createHash('sha256').update(ownerToken).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // --- TEST 2: Invalid Polygon Geometric Rejections ---
    console.log('\n--- Test 2: Invalid Polygon Geometric DoS Rejections ---');
    
    // 2a. Self-intersecting bowtie polygon
    const bowtiePolygon = [
      [
        [77.590, 12.970],
        [77.595, 12.975],
        [77.595, 12.970],
        [77.590, 12.975],
        [77.590, 12.970],
      ],
    ];
    const invalidRes = await request(
      'POST',
      '/api/v1/worksites',
      {
        organizationId: org.id,
        name: 'Invalid Bowtie Site',
        worksiteType: 'POLYGON',
        latitude: 12.9725,
        longitude: 77.5925,
        polygonCoordinates: bowtiePolygon,
      },
      { Authorization: `Bearer ${ownerToken}` },
    );
    if (invalidRes.status !== 400) {
      throw new Error(`Expected 400 for self-intersecting polygon, got: ${invalidRes.status}`);
    }
    console.log('✅ Self-intersecting polygon correctly rejected with 400 Bad Request.');

    // 2b. Unclosed polygon ring
    const unclosedPolygon = [
      [
        [77.590, 12.970],
        [77.595, 12.970],
        [77.595, 12.975],
        [77.590, 12.975], // Missing closing vertex equal to first
      ],
    ];
    const unclosedRes = await request(
      'POST',
      '/api/v1/worksites',
      {
        organizationId: org.id,
        name: 'Unclosed Ring Site',
        worksiteType: 'POLYGON',
        latitude: 12.9725,
        longitude: 77.5925,
        polygonCoordinates: unclosedPolygon,
      },
      { Authorization: `Bearer ${ownerToken}` },
    );
    if (unclosedRes.status !== 400) {
      throw new Error(`Expected 400 for unclosed polygon ring, got: ${unclosedRes.status}`);
    }
    console.log('✅ Unclosed polygon ring correctly rejected with 400 Bad Request.');

    // --- TEST 3: Create Valid Polygon Worksite ---
    console.log('\n--- Test 3: Create Valid Polygon Worksite ---');
    // Valid square polygon covering ~500m x 500m in Bengaluru
    const validPolygonCoords = [
      [
        [77.5900, 12.9700],
        [77.5950, 12.9700],
        [77.5950, 12.9750],
        [77.5900, 12.9750],
        [77.5900, 12.9700], // Closed
      ],
    ];
    const polyCreateRes = await request(
      'POST',
      '/api/v1/worksites',
      {
        organizationId: org.id,
        name: 'Bengaluru Tech Park Polygon',
        worksiteType: 'POLYGON',
        latitude: 12.9725,
        longitude: 77.5925,
        polygonCoordinates: validPolygonCoords,
      },
      { Authorization: `Bearer ${ownerToken}` },
    );
    if (polyCreateRes.status !== 201 || !polyCreateRes.body.id) {
      throw new Error(`Failed to create polygon worksite: ${JSON.stringify(polyCreateRes)}`);
    }
    const polygonSiteId = polyCreateRes.body.id;
    console.log('✅ Valid polygon worksite created successfully. ID:', polygonSiteId);

    // --- TEST 4: Polygon 3-Zone Spatial Presence Evaluation ---
    console.log('\n--- Test 4: Polygon 3-Zone Spatial Presence Determination ---');

    // 4a. Point deep inside the polygon (center at 12.9725, 77.5925, ~250m from edges)
    const insideRes = await request(
      'POST',
      `/api/v1/worksites/${polygonSiteId}/verify-presence`,
      {
        latitude: 12.9725,
        longitude: 77.5925,
        accuracyMeters: 10,
      },
    );
    if (insideRes.status !== 200 || insideRes.body.outcome !== 'INSIDE' || !insideRes.body.isInside) {
      throw new Error(`Expected INSIDE for polygon center, got: ${JSON.stringify(insideRes.body)}`);
    }
    console.log(`✅ Point deep inside polygon: outcome="INSIDE" (distance to boundary: ${insideRes.body.distanceMeters}m).`);

    // 4b. Point right near boundary within GPS accuracy uncertainty (edge is at lng 77.5950, point at 77.59498)
    const uncertainRes = await request(
      'POST',
      `/api/v1/worksites/${polygonSiteId}/verify-presence`,
      {
        latitude: 12.9725,
        longitude: 77.59498, // ~2 meters from perimeter edge
        accuracyMeters: 15,   // uncertainty extends across edge
      },
    );
    if (uncertainRes.status !== 200 || uncertainRes.body.outcome !== 'UNCERTAIN') {
      throw new Error(`Expected UNCERTAIN for point on perimeter edge, got: ${JSON.stringify(uncertainRes.body)}`);
    }
    console.log(`✅ Point on perimeter edge within GPS uncertainty: outcome="UNCERTAIN" (distance: ${uncertainRes.body.distanceMeters}m).`);

    // 4c. Point far outside the polygon
    const outsideRes = await request(
      'POST',
      `/api/v1/worksites/${polygonSiteId}/verify-presence`,
      {
        latitude: 12.9850,
        longitude: 77.6100,
        accuracyMeters: 10,
      },
    );
    if (outsideRes.status !== 200 || outsideRes.body.outcome !== 'OUTSIDE' || outsideRes.body.isInside) {
      throw new Error(`Expected OUTSIDE for distant point, got: ${JSON.stringify(outsideRes.body)}`);
    }
    console.log(`✅ Point far outside polygon: outcome="OUTSIDE" (distance to boundary: ${outsideRes.body.distanceMeters}m).`);

    // 4d. Rejection of degraded GPS accuracy (> 50m)
    const degradedRes = await request(
      'POST',
      `/api/v1/worksites/${polygonSiteId}/verify-presence`,
      {
        latitude: 12.9725,
        longitude: 77.5925,
        accuracyMeters: 65, // > 50m
      },
    );
    if (degradedRes.body.isAccuracyAcceptable !== false) {
      throw new Error(`Expected isAccuracyAcceptable: false for 65m accuracy, got: ${JSON.stringify(degradedRes.body)}`);
    }
    console.log('✅ Degraded GPS accuracy (>50m) flagged as isAccuracyAcceptable: false.');

    // --- TEST 5: OWASP BOLA Protection ---
    console.log('\n--- Test 5: OWASP BOLA (Cross-Tenant Authorization) ---');
    const fakeOtherOrgId = '00000000-0000-0000-0000-111111111111';
    const bolaRes = await request(
      'GET',
      `/api/v1/worksites?organizationId=${fakeOtherOrgId}`,
      null,
      { Authorization: `Bearer ${ownerToken}` },
    );
    if (bolaRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for cross-tenant access, got: ${bolaRes.status}`);
    }
    console.log('✅ Cross-tenant worksite query strictly rejected with 403 Forbidden (BOLA prevented).');

    await prisma.$disconnect();
    console.log('\n🎉 ALL PHASE 3 & OWASP TESTS PASSED PERFECTLY!\n');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
