import { AttendanceSessionDto } from '@employee-tracking/contracts';

export function mapAttendanceSessionToDto(session: any): AttendanceSessionDto {
  return {
    id: session.id,
    organizationId: session.organizationId,
    employeeProfileId: session.employeeProfileId,
    worksiteId: session.worksiteId,
    status: session.status,
    presenceStatus: session.presenceStatus,
    reviewStatus: session.reviewStatus,
    clockInAt: session.clockInAt.toISOString(),
    clockOutAt: session.clockOutAt?.toISOString() || null,
    exitPendingSince: session.exitPendingSince?.toISOString() || null,
    exitGraceExpiresAt: session.exitGraceExpiresAt?.toISOString() || null,
    insideDurationSeconds: session.insideDurationSeconds,
    outsideDurationSeconds: session.outsideDurationSeconds,
    breakDurationSeconds: session.breakDurationSeconds,
    autoClockedOut: session.autoClockedOut,
    intervals: session.intervals?.map((i: any) => ({
      id: i.id,
      attendanceSessionId: i.attendanceSessionId,
      intervalType: i.intervalType,
      startedAt: i.startedAt.toISOString(),
      endedAt: i.endedAt?.toISOString() || null,
      durationSeconds: i.durationSeconds,
    })),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
