'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../lib/api-client';
import { Activity, Database, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export function HealthBadge() {
  const { data: health, isLoading, isError } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full animate-pulse">
        <Activity className="w-3.5 h-3.5" /> Checking system health...
      </div>
    );
  }

  if (isError || !health) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Backend Disconnected
      </div>
    );
  }

  const isHealthy = health.status === 'ok';

  return (
    <div
      className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border ${
        isHealthy
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-amber-50 text-amber-800 border-amber-200'
      }`}
    >
      {isHealthy ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
      )}
      <span>PostgreSQL 18 & PostGIS {health.database.postgisVersion?.split(' ')[0]}</span>
      <span className="text-slate-400">|</span>
      <span className="flex items-center gap-1 font-mono text-[11px]">
        <Database className="w-3 h-3 text-slate-400" />
        {health.database.latencyMs}ms
      </span>
    </div>
  );
}
