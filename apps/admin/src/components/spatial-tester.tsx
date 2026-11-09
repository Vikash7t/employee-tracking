'use client';

import React, { useState } from 'react';
import { Navigation } from 'lucide-react';

export function SpatialTester() {
  const [testLat, setTestLat] = useState('12.9857016');
  const [testLng, setTestLng] = useState('77.5979309');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestPresence = () => {
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    if (isNaN(lat) || isNaN(lng)) return;

    const officeLat = 12.9857016;
    const officeLng = 77.5979309;
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(officeLat - lat);
    const dLon = toRad(officeLng - lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) * Math.cos(toRad(officeLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    setTestResult(
      `Computed Spheroid Distance: ${dist.toFixed(2)}m (${dist <= 50 ? '✅ INSIDE 50m Geofence' : '❌ OUTSIDE Geofence'})`
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center gap-2">
        <Navigation className="w-4 h-4 text-blue-600" />
        <h3 className="font-semibold text-sm text-slate-900">PostGIS Spheroid Distance Calculator</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">User Latitude</label>
          <input
            type="text"
            value={testLat}
            onChange={(e) => setTestLat(e.target.value)}
            className="w-full text-xs font-mono border border-slate-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">User Longitude</label>
          <input
            type="text"
            value={testLng}
            onChange={(e) => setTestLng(e.target.value)}
            className="w-full text-xs font-mono border border-slate-200 rounded-lg px-3 py-2"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleTestPresence}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Verify Distance
          </button>
        </div>
      </div>
      {testResult && (
        <div className="text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
          {testResult}
        </div>
      )}
    </div>
  );
}
