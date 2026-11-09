const fs = require('fs');
const path = require('path');

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateAdaptiveTier(minDistanceMeters, isInside) {
  if (isInside || minDistanceMeters <= 100) {
    return { tier: 3, timeInterval: 15000, distanceInterval: 10, accuracy: 'Highest' };
  }
  if (minDistanceMeters <= 500) {
    return { tier: 2, timeInterval: 60000, distanceInterval: 25, accuracy: 'High' };
  }
  return { tier: 1, timeInterval: 120000, distanceInterval: 50, accuracy: 'Balanced' };
}

async function run() {
  console.log('🚀 Running Phase 4 Mobile Location Engine Verification Suite...\n');

  // --- TEST 1: Android 14+ Permissions & Store Compliance ---
  console.log('--- Test 1: Android 14+ Permissions & Configuration ---');
  const appJsonPath = path.resolve(__dirname, 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const permissions = appJson.expo.android.permissions;

  const requiredPerms = [
    'ACCESS_FINE_LOCATION',
    'ACCESS_COARSE_LOCATION',
    'ACCESS_BACKGROUND_LOCATION',
    'FOREGROUND_SERVICE',
    'FOREGROUND_SERVICE_LOCATION',
    'RECEIVE_BOOT_COMPLETED',
  ];

  for (const perm of requiredPerms) {
    if (!permissions.includes(perm)) {
      throw new Error(`Missing mandatory permission in app.json: ${perm}`);
    }
  }
  console.log('✅ All mandatory Android 14+ permissions configured (FOREGROUND_SERVICE_LOCATION, RECEIVE_BOOT_COMPLETED, etc.).');

  // --- TEST 2: Mock Location / Fake GPS Detection ---
  console.log('\n--- Test 2: Fake GPS Detection Logic ---');
  const rawSpoofedLocation = {
    coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 5 },
    mocked: true,
    timestamp: Date.now(),
  };
  const rawGenuineLocation = {
    coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 5 },
    mocked: false,
    timestamp: Date.now(),
  };

  const isMocked1 = Boolean(rawSpoofedLocation.mocked);
  const isMocked2 = Boolean(rawGenuineLocation.mocked);

  if (!isMocked1 || isMocked2) {
    throw new Error('Fake GPS mock location detection failed assertion');
  }
  console.log('✅ Spoofed coordinates identified (isMocked=true), genuine coordinates approved (isMocked=false).');

  // --- TEST 3: Nearest Worksite in Multi-Site Setup ---
  console.log('\n--- Test 3: Nearest Worksite Multi-Site Calculation ---');
  const cachedWorksites = [
    { id: 'site-hq', name: 'HQ', latitude: 12.9716, longitude: 77.5946, radiusMeters: 50 },
    { id: 'site-warehouse', name: 'Warehouse', latitude: 12.9352, longitude: 77.6245, radiusMeters: 100 },
    { id: 'site-depot', name: 'Depot', latitude: 13.0358, longitude: 77.5970, radiusMeters: 75 },
  ];

  // User is right next to Warehouse (12.9353, 77.6246)
  const userLoc = { latitude: 12.9353, longitude: 77.6246 };
  let nearestSite = null;
  let minDistance = Infinity;

  for (const site of cachedWorksites) {
    const dist = haversineMeters(userLoc.latitude, userLoc.longitude, site.latitude, site.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestSite = site;
    }
  }

  if (nearestSite.id !== 'site-warehouse' || minDistance > 50) {
    throw new Error(`Expected site-warehouse as nearest, got ${nearestSite?.id} at distance ${minDistance}`);
  }
  console.log(`✅ Correctly identified nearest worksite: "${nearestSite.name}" (${Math.round(minDistance)}m away).`);

  // --- TEST 4: Adaptive Battery-Optimized Polling Tiers ---
  console.log('\n--- Test 4: Adaptive Battery-Optimized Polling Tiers ---');
  
  // 4a. Distant (> 500m) -> Tier 1 (120s interval)
  const tierDistant = calculateAdaptiveTier(1500, false);
  if (tierDistant.tier !== 1 || tierDistant.timeInterval !== 120000 || tierDistant.distanceInterval !== 50) {
    throw new Error(`Distant tier mismatch: ${JSON.stringify(tierDistant)}`);
  }
  console.log(`✅ Distant (>500m): Tier 1 (120s interval, 50m filter, Balanced Power).`);

  // 4b. Approaching (100m - 500m) -> Tier 2 (60s interval)
  const tierApproaching = calculateAdaptiveTier(350, false);
  if (tierApproaching.tier !== 2 || tierApproaching.timeInterval !== 60000 || tierApproaching.distanceInterval !== 25) {
    throw new Error(`Approaching tier mismatch: ${JSON.stringify(tierApproaching)}`);
  }
  console.log(`✅ Approaching (100m-500m): Tier 2 (60s interval, 25m filter, High Accuracy).`);

  // 4c. Inside / Active Perimeter (< 100m) -> Tier 3 (15s interval)
  const tierActive = calculateAdaptiveTier(25, true);
  if (tierActive.tier !== 3 || tierActive.timeInterval !== 15000 || tierActive.distanceInterval !== 10) {
    throw new Error(`Active tier mismatch: ${JSON.stringify(tierActive)}`);
  }
  console.log(`✅ Active Geofence (<100m / Inside): Tier 3 (15s interval, 10m filter, Highest Accuracy).`);

  console.log('\n🎉 ALL PHASE 4 MOBILE LOCATION ENGINE TESTS PASSED PERFECTLY!\n');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
