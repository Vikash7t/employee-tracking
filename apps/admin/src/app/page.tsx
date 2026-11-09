'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOrganizations,
  fetchWorksites,
  fetchAttendanceHistory,
} from '../lib/api-client';
import { useAppStore } from '../store/use-app-store';
import dynamicImport from 'next/dynamic';
import { GeofenceEditor } from '../components/map/GeofenceEditor';
import { AttendanceTimeline } from '../components/attendance/AttendanceTimeline';
import { SpatialTester } from '../components/spatial-tester';
import {
  Building2,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Navigation,
  Clock,
  Users,
} from 'lucide-react';

const MapLibreViewer = dynamicImport(
  () => import('../components/map/MapLibreViewer').then((mod) => mod.MapLibreViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-400">
        Loading MapLibre spatial engine...
      </div>
    ),
  },
);

export default function AdminDashboardPage() {
  const { activeTab, activeToken } = useAppStore();
  const queryClient = useQueryClient();

  const { data: orgs = [], isLoading: isLoadingOrgs } = useQuery({
    queryKey: ['organizations', activeToken],
    queryFn: () => fetchOrganizations(activeToken),
  });

  const { data: worksites = [], isLoading: isLoadingSites } = useQuery({
    queryKey: ['worksites', activeToken],
    queryFn: () => fetchWorksites(activeToken),
  });

  const { data: attendanceSessions = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendanceHistory', activeToken],
    queryFn: () => fetchAttendanceHistory(activeToken, 30),
    refetchInterval: 15000, // 15-second controlled polling
  });

  const primaryOrgId = orgs[0]?.id || '';
  const activeEmployeesCount = attendanceSessions.filter((s) => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Tab: Live Map Geospatial Command Center */}
      {activeTab === 'live-map' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Live Geospatial Command Center</h2>
              <p className="text-xs text-slate-500">
                Vector geofences and active workforce location observations rendered via MapLibre GL.
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
              Live Polling: 15s
            </span>
          </div>
          <MapLibreViewer
            worksites={worksites}
            activeSessions={attendanceSessions.filter((s) => s.status === 'ACTIVE')}
            height="620px"
          />
        </div>
      )}

      {/* Tab: Worksites & Geofence Editor */}
      {activeTab === 'worksites' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Worksite Geofence Management</h2>
              <p className="text-xs text-slate-500">
                Configure circular and polygon PostGIS boundaries with custom exit grace periods.
              </p>
            </div>
            {primaryOrgId && (
              <GeofenceEditor
                organizationId={primaryOrgId}
                onWorksiteCreated={() => queryClient.invalidateQueries({ queryKey: ['worksites'] })}
              />
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Worksite Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Coordinates</th>
                  <th className="px-4 py-3">Radius / Extent</th>
                  <th className="px-4 py-3">Exit Grace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {worksites.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{w.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {w.worksiteType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}</td>
                    <td className="px-4 py-3">{w.radiusMeters}m</td>
                    <td className="px-4 py-3">{w.gracePeriodSeconds}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Attendance Sessions & Timeline */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Attendance Session Inspector</h2>
            <p className="text-xs text-slate-500">
              Deterministic attendance sessions with granular inside, outside, and break interval breakdowns.
            </p>
          </div>
          <AttendanceTimeline sessions={attendanceSessions} />
        </div>
      )}

      {/* Tab: Platform Overview (Default) */}
      {(activeTab === 'overview' || activeTab === 'organizations' || activeTab === 'telemetry') && (
        <>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Enterprise Operations Portal</h2>
              <p className="text-xs text-slate-500 mt-1">
                Next.js 15 App Router + MapLibre vector geofencing + PostGIS 3.7 attendance engine.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Operational
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Active Tenancies</span>
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{isLoadingOrgs ? '...' : orgs.length}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Geofenced Worksites</span>
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{isLoadingSites ? '...' : worksites.length}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Active On-Duty Shifts</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{isLoadingAttendance ? '...' : activeEmployeesCount}</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Spatial Precision</span>
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">PostGIS 3.7</div>
            </div>
          </div>

          {/* Quick Map Preview */}
          <div className="space-y-2">
            <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">Geospatial Preview</h3>
            <MapLibreViewer worksites={worksites} height="360px" />
          </div>

          {/* Spatial Tester */}
          <SpatialTester />
        </>
      )}
    </div>
  );
}
