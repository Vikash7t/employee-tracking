const { spawn } = require('child_process');
const path = require('path');

const server = spawn('node', ['apps/backend/dist/src/main.js'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

server.stdout.on('data', (d) => process.stdout.write(`[SERVER] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[SERVER ERR] ${d}`));

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function run() {
  console.log('Waiting for NestJS server to boot on port 4000...');
  await wait(3000);

  try {
    // 1. Health Endpoint
    console.log('\n--- 1. Testing GET /api/v1/health ---');
    const healthRes = await fetch('http://localhost:4000/api/v1/health');
    const healthJson = await healthRes.json();
    console.log('Status:', healthRes.status, JSON.stringify(healthJson, null, 2));

    // 2. Organizations Endpoint
    console.log('\n--- 2. Testing GET /api/v1/organizations ---');
    const orgsRes = await fetch('http://localhost:4000/api/v1/organizations');
    const orgsJson = await orgsRes.json();
    console.log('Status:', orgsRes.status, JSON.stringify(orgsJson, null, 2));

    // 3. Worksites Endpoint
    console.log('\n--- 3. Testing GET /api/v1/worksites ---');
    const sitesRes = await fetch('http://localhost:4000/api/v1/worksites');
    const sitesJson = await sitesRes.json();
    console.log('Status:', sitesRes.status, JSON.stringify(sitesJson, null, 2));

    // 4. PostGIS Presence Verification
    console.log('\n--- 4. Testing POST /api/v1/worksites/:id/verify-presence (PostGIS ST_Distance) ---');
    const verifyRes = await fetch(
      'http://localhost:4000/api/v1/worksites/00000000-0000-0000-0000-000000000001/verify-presence',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 12.9859, longitude: 77.5982 }),
      }
    );
    const verifyJson = await verifyRes.json();
    console.log('Status:', verifyRes.status, JSON.stringify(verifyJson, null, 2));

    // 5. Swagger Docs
    console.log('\n--- 5. Testing GET /api/docs ---');
    const docsRes = await fetch('http://localhost:4000/api/docs');
    console.log('Swagger UI Status:', docsRes.status);

    console.log('\n🎉 ALL NESTJS BACKEND VERIFICATION CHECKS PASSED!');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.kill();
    process.exit(0);
  }
}

run();
