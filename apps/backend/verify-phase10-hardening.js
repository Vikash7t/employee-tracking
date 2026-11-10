/**
 * Phase 10 Integration Verification Test Suite:
 * Enterprise Hardening, Observability (Liveness/Readiness), Correlation ID Propagation (CWE-117),
 * Fail-Fast Production Environment Security Validation, and Docker/CI Specification Checks.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateEnvironment } = require('./dist/common/config/env-validator');

const PORT = 4007;
const BASE_URL = `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
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
  console.log(`🚀 Starting NestJS Backend on port ${PORT} for Phase 10 Enterprise Hardening verification...`);

  const server = spawn('npm', ['run', 'start:dev', '--workspace=@employee-tracking/backend'], {
    env: { ...process.env, PORT: PORT.toString() },
    stdio: 'inherit',
    shell: true,
  });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const res = await request('GET', '/api/v1/health/liveness');
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
    console.log('✅ Server online! Running Phase 10 Enterprise Hardening test suite...\n');

    console.log('🧪 TEST 1: Kubernetes / ECS Liveness Probe (/api/v1/health/liveness)');
    const livenessRes = await request('GET', '/api/v1/health/liveness');
    if (livenessRes.status !== 200) {
      throw new Error(`Liveness probe failed: ${JSON.stringify(livenessRes.body)}`);
    }
    const liveness = livenessRes.body;
    console.log(`   - Status: ${liveness.status}`);
    console.log(`   - Uptime: ${liveness.uptimeSeconds}s`);
    console.log(`   - Memory Usage RSS: ${liveness.memoryUsageMb.rss} MB, Heap: ${liveness.memoryUsageMb.heapUsed} MB`);
    if (liveness.status !== 'ok' || typeof liveness.memoryUsageMb?.rss !== 'number') {
      throw new Error('Liveness probe returned unexpected body format');
    }
    console.log('   ✅ Cloud-native liveness probe verified (zero DB overhead).\n');

    console.log('🧪 TEST 2: Kubernetes / ECS Readiness Probe (/api/v1/health/readiness)');
    const readinessRes = await request('GET', '/api/v1/health/readiness');
    if (readinessRes.status !== 200) {
      throw new Error(`Readiness probe failed: ${JSON.stringify(readinessRes.body)}`);
    }
    const readiness = readinessRes.body;
    console.log(`   - Status: ${readiness.status}`);
    console.log(`   - PostgreSQL Connected: ${readiness.database.connected}`);
    console.log(`   - PostGIS Installed: ${readiness.database.postgisInstalled} (${readiness.database.postgisVersion})`);
    console.log(`   - DB Latency: ${readiness.database.latencyMs}ms`);
    if (readiness.status !== 'ready' || !readiness.database.connected || !readiness.database.postgisInstalled) {
      throw new Error('Readiness probe reported degraded or disconnected database');
    }
    console.log('   ✅ Cloud-native readiness probe & PostGIS status verified.\n');

    console.log('🧪 TEST 3: Correlation ID Propagation & Log-Injection Sanitization (CWE-117)');
    // 3a. Auto-generation of UUID when header is absent
    const noHeaderRes = await request('GET', '/api/v1/health/liveness');
    const autoGenId = noHeaderRes.headers['x-correlation-id'];
    console.log(`   - Auto-generated Correlation ID: ${autoGenId}`);
    if (!autoGenId || autoGenId.length < 16) {
      throw new Error('Auto-generated correlation ID header is missing or malformed');
    }

    // 3b. Safe client-supplied correlation ID is preserved
    const safeCustomId = 'enterprise-trace-id-abc12345';
    const safeRes = await request('GET', '/api/v1/health/liveness', null, {
      'x-correlation-id': safeCustomId,
    });
    console.log(`   - Supplied ID: ${safeCustomId} -> Response ID: ${safeRes.headers['x-correlation-id']}`);
    if (safeRes.headers['x-correlation-id'] !== safeCustomId) {
      throw new Error('Safe custom correlation ID was not propagated');
    }

    // 3c. Unsafe correlation ID containing illegal characters/script injection is neutralized
    const unsafeId = 'invalid<script>alert(1)</script>';
    const sanitizeRes = await request('GET', '/api/v1/health/liveness', null, {
      'x-correlation-id': unsafeId,
    });
    const sanitizedId = sanitizeRes.headers['x-correlation-id'];
    console.log(`   - Unsafe ID neutralized and replaced with safe UUID: ${sanitizedId}`);
    if (sanitizedId === unsafeId || sanitizedId.includes('<') || sanitizedId.includes('>')) {
      throw new Error('CWE-117 Log Injection vulnerability! Unsanitized correlation ID was echoed.');
    }
    console.log('   ✅ Correlation ID propagation and CWE-117 log-injection defense verified.\n');

    console.log('🧪 TEST 4: Fail-Fast Production Environment Security Validation');
    // 4a. Rejects missing DATABASE_URL
    let failedMissingDb = false;
    try {
      validateEnvironment({ NODE_ENV: 'production' });
    } catch (e) {
      failedMissingDb = e.message.includes('DATABASE_URL');
    }
    if (!failedMissingDb) throw new Error('Validator allowed missing DATABASE_URL');
    console.log('   - Missing DATABASE_URL successfully blocked.');

    // 4b. Rejects default dev JWT secret in production
    let failedDevSecret = false;
    try {
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@db.prod.internal:5432/app',
        JWT_SECRET: 'dev_jwt_secret_key_change_in_production_min_32_chars',
      });
    } catch (e) {
      failedDevSecret = e.message.includes('Default development JWT_SECRET is forbidden');
    }
    if (!failedDevSecret) throw new Error('Validator allowed default dev JWT_SECRET in production');
    console.log('   - Default development JWT secret successfully blocked in production.');

    // 4c. Rejects short JWT secret in production (< 32 chars)
    let failedShortSecret = false;
    try {
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@db.prod.internal:5432/app',
        JWT_SECRET: 'short_secret_under_32_chars',
      });
    } catch (e) {
      failedShortSecret = e.message.includes('at least 32 characters');
    }
    if (!failedShortSecret) throw new Error('Validator allowed short JWT_SECRET in production');
    console.log('   - Low-entropy JWT secret (<32 chars) successfully blocked in production.');

    // 4d. Rejects localhost in production DATABASE_URL
    let failedLocalhostDb = false;
    try {
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
        JWT_SECRET: 'a_very_secure_and_cryptographically_strong_production_secret_key_123',
      });
    } catch (e) {
      failedLocalhostDb = e.message.includes('localhost or loopback');
    }
    if (!failedLocalhostDb) throw new Error('Validator allowed localhost DATABASE_URL in production');
    console.log('   - Localhost DATABASE_URL successfully blocked in production.');

    // 4e. Accepts valid production configuration
    validateEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@db.prod.internal:5432/app',
      JWT_SECRET: 'a_very_secure_and_cryptographically_strong_production_secret_key_123',
    });
    console.log('   - Valid production configuration approved.');
    console.log('   ✅ Fail-fast environment validation rules verified.\n');

    console.log('🧪 TEST 5: Docker & CI/CD Specification Structural Verification');
    const rootDir = path.resolve(__dirname, '../..');

    // 5a. Backend Dockerfile checks
    const backendDocker = fs.readFileSync(path.join(rootDir, 'apps/backend/Dockerfile'), 'utf8');
    if (!backendDocker.includes('USER node:node') || !backendDocker.includes('dumb-init')) {
      throw new Error('apps/backend/Dockerfile missing CIS Benchmark non-root USER or dumb-init');
    }
    console.log('   - apps/backend/Dockerfile enforces unprivileged USER node:node and dumb-init PID 1.');

    // 5b. Admin Dockerfile checks
    const adminDocker = fs.readFileSync(path.join(rootDir, 'apps/admin/Dockerfile'), 'utf8');
    if (!adminDocker.includes('USER node:node') || !adminDocker.includes('standalone')) {
      throw new Error('apps/admin/Dockerfile missing standalone configuration or non-root user');
    }
    console.log('   - apps/admin/Dockerfile enforces Next.js standalone runner and USER node:node.');

    // 5c. docker-compose.yml checks
    const dockerCompose = fs.readFileSync(path.join(rootDir, 'docker-compose.yml'), 'utf8');
    if (!dockerCompose.includes('postgis/postgis:16-3.5-alpine') || !dockerCompose.includes('pg_isready')) {
      throw new Error('docker-compose.yml missing official PostGIS image or healthchecks');
    }
    console.log('   - docker-compose.yml orchestrates PostGIS 16-3.5-alpine, Backend, and Admin with healthchecks.');

    // 5d. GitHub Actions CI workflow checks
    const ciWorkflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
    if (
      !ciWorkflow.includes('lint-and-typecheck') ||
      !ciWorkflow.includes('test-and-verify') ||
      !ciWorkflow.includes('docker-build-check')
    ) {
      throw new Error('.github/workflows/ci.yml is missing required quality pipeline jobs');
    }
    console.log('   - .github/workflows/ci.yml defines complete 3-stage CI/CD pipeline.');
    console.log('   ✅ Docker & CI/CD specifications structurally verified.\n');

    console.log('🎉 ALL 5 PHASE 10 ENTERPRISE HARDENING VERIFICATION CHECKS PASSED WITH ZERO ERRORS!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Phase 10 verification failed:', err);
    process.exit(1);
  } finally {
    server.kill();
  }
}

run();
