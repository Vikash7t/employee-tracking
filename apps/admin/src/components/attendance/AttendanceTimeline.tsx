'use client';

import React from 'react';
import { AttendanceSessionDto } from '@employee-tracking/contracts';
import { Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface AttendanceTimelineProps {
  sessions: AttendanceSessionDto[];
}

export function AttendanceTimeline({ sessions }: AttendanceTimelineProps) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
        No attendance sessions found for the selected criteria.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const isCompleted = s.status === 'COMPLETED';
        const clockInDate = new Date(s.clockInAt);
        const clockOutDate = s.clockOutAt ? new Date(s.clockOutAt) : null;
        const totalInsideMins = Math.floor(s.insideDurationSeconds / 60);
        const totalOutsideMins = Math.floor(s.outsideDurationSeconds / 60);

        const intervals = s.intervals || [];
        const totalSessionSeconds = Math.max(
          1,
          s.insideDurationSeconds + s.outsideDurationSeconds + s.breakDurationSeconds,
        );

        return (
          <div
            key={s.id}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3"
          >
            {/* Session Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isCompleted
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <span>{clockInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span>
                      {clockOutDate
                        ? clockOutDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active Shift'}
                    </span>
                    <span className="text-slate-400 font-normal">
                      ({clockInDate.toLocaleDateString()})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Employee Profile: <span className="font-mono">{s.employeeProfileId.slice(0, 8)}...</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    s.presenceStatus === 'INSIDE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : s.presenceStatus === 'EXIT_PENDING'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  Presence: {s.presenceStatus}
                </span>

                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    isCompleted
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {s.status}
                </span>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs py-1">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Inside Site</span>
                <span className="font-bold text-emerald-700 text-sm">{totalInsideMins}m</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Outside Site</span>
                <span className="font-bold text-amber-700 text-sm">{totalOutsideMins}m</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Review Status</span>
                <span className="font-bold text-slate-700 text-sm">{s.reviewStatus}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Intervals</span>
                <span className="font-bold text-slate-700 text-sm">{intervals.length} segments</span>
              </div>
            </div>

            {/* Granular Interval Visualizer Bar */}
            {intervals.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Timeline Interval Breakdown
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-md overflow-hidden flex">
                  {intervals.map((inv, idx) => {
                    const duration = inv.durationSeconds || 60;
                    const widthPercent = Math.max(2, (duration / totalSessionSeconds) * 100);
                    const isInside = inv.intervalType === 'INSIDE';
                    const isBreak = inv.intervalType === 'BREAK';

                    return (
                      <div
                        key={inv.id || idx}
                        style={{ width: `${widthPercent}%` }}
                        title={`${inv.intervalType}: ${duration}s (${new Date(inv.startedAt).toLocaleTimeString()})`}
                        className={`h-full transition-all ${
                          isInside
                            ? 'bg-emerald-500'
                            : isBreak
                            ? 'bg-purple-500'
                            : 'bg-amber-500'
                        } border-r border-white/40 last:border-r-0`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
