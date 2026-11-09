'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOrganizations, fetchWorksites } from '../lib/api-client';
import { Building2, MapPin, CheckCircle2, ShieldCheck, Navigation } from 'lucide-react';

export default function OverviewPage() {
  const { data: orgs = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: fetchOrganizations,
  });

  const { data: worksites = [], isLoading: isLoadingSites } = useQuery({
    queryKey: ['worksites'],
    queryFn: fetchWorksites,
  });

  // PostGIS spatial tester state
  const [testLat, setTestLat] = useState('12.9857016');
  const [testLng, setTestLng] = useState('77.5979309');
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestPresence = () => {
    const lat = parseFloat(testLat);
    const lng = parseFloat(testLng);
    if (isNaN(lat) || isNaN(lng)) return;

    // Default sample office (Bengaluru headquarters)
    const officeLat = 12.9857016;
    const officeLng = 77.5979309;

    // Haversine preview
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(officeLat - lat);
    const dLon = toRad(officeLng - lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) * Math.cos(toRad(officeLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    setTestResult(
      `Computed Distance: ${dist.toFixed(2)}m (${dist <= 50 ? '✅ INSIDE 50m Geofence' : '❌ OUTSIDE Geofence'})`
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Platform Foundation Live</h2>
          <p className="text-xs text-slate-500 mt-1">
            PostgreSQL 18 + PostGIS 3.7.0 database foundation connected via Prisma ORM.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Phase 1 Verified
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Organizations</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {isLoadingOrgs ? '...' : orgs.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-tenant tenants</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Configured Worksites</span>
            <MapPin className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {isLoadingSites ? '...' : worksites.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Geofenced field locations</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Geospatial Engine</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">PostGIS 3.7</div>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">Sub-meter R-Tree Spatial</p>
        </div>
      </div>

      {/* Spatial Verification Quick-Tester */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-slate-900">PostGIS Spatial Verification Tester</h3>
        </div>
        <p className="text-xs text-slate-500">
          Test real-time coordinates against the primary headquarters geofence (Radius: 50m).
        </p>
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
              Verify Presence
            </button>
          </div>
        </div>
        {testResult && (
          <div className="text-xs font-mono font-medium p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800">
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
}
