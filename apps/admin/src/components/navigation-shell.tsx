'use client';

import React from 'react';
import { useAppStore } from '../store/use-app-store';
import { HealthBadge } from './health-badge';
import {
  Building2,
  MapPin,
  Shield,
  LayoutDashboard,
  Users,
  Menu,
  Navigation,
  Clock,
} from 'lucide-react';
import { NavigationTab } from '../store/use-app-store';

export function NavigationShell({ children }: { children: React.ReactNode }) {
  const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useAppStore();

  const navItems: { id: NavigationTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Platform Overview', icon: LayoutDashboard },
    { id: 'live-map', label: 'Live Geospatial Map', icon: Navigation },
    { id: 'worksites', label: 'Worksites & Geofences', icon: MapPin },
    { id: 'attendance', label: 'Attendance & Timeline', icon: Clock },
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'telemetry', label: 'Security & Telemetry', icon: Shield },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              ET
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-tight">Workforce Geospatial Platform</h1>
              <p className="text-[11px] text-slate-500">Phase 1 Foundation</p>
            </div>
          </div>
        </div>

        <HealthBadge />
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        {isSidebarOpen && (
          <aside className="w-64 bg-white border-r border-slate-200 p-4 space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Management
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}

            <div className="pt-6 px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              System Architecture
            </div>
            <div className="px-3 py-2 space-y-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between">
                <span>Database:</span>
                <span className="font-semibold text-slate-700">PostgreSQL 18</span>
              </div>
              <div className="flex justify-between">
                <span>Spatial Engine:</span>
                <span className="font-semibold text-slate-700">PostGIS 3.7</span>
              </div>
              <div className="flex justify-between">
                <span>Backend:</span>
                <span className="font-semibold text-slate-700">NestJS 11/12</span>
              </div>
              <div className="flex justify-between">
                <span>Frontend:</span>
                <span className="font-semibold text-slate-700">Next.js 15/16</span>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
