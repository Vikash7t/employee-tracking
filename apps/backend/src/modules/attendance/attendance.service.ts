import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WorksitesService } from '../worksites/worksites.service';
import { ShiftsService } from '../shifts/shifts.service';
import { AttendanceStateMachineService } from './attendance-state-machine.service';
import { mapAttendanceSessionToDto } from './attendance.mapper';
import {
  PunchInInput,
  PunchOutInput,
  AttendanceSessionDto,
  AttendanceEventDto,
  WorkplacePresenceStatus,
  AttendanceReviewStatus,
} from '@employee-tracking/contracts';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly worksitesService: WorksitesService,
    private readonly stateMachine: AttendanceStateMachineService,
    private readonly shiftsService: ShiftsService,
  ) {}

  /**
   * Evaluates geofence, verifies active constraints, and registers clock-in.
   */
  async punchIn(
    organizationId: string,
    employeeProfileId: string,
    input: PunchInInput,
  ): Promise<AttendanceSessionDto> {
    const existingActive = await this.prisma.attendanceSession.findFirst({
      where: {
        organizationId,
        employeeProfileId,
        status: 'ACTIVE',
      },
    });

    if (existingActive) {
      throw new BadRequestException('Employee already has an active attendance session');
    }

    const worksite = await this.worksitesService.findById(input.worksiteId);
    if (worksite.organizationId !== organizationId) {
      throw new BadRequestException('Worksite does not belong to employee organization');
    }

    // Spatial geofence evaluation with uncertainty check
    const presence = await this.worksitesService.verifyPresence(
      input.worksiteId,
      input.latitude,
      input.longitude,
      input.accuracy || 10,
    );

    const clockInTime = input.clientTimestamp ? new Date(input.clientTimestamp) : new Date();
    const presenceStatus: WorkplacePresenceStatus = presence.isInside ? 'INSIDE' : 'OUTSIDE';
    let reviewStatus: AttendanceReviewStatus = presence.isInside
      ? 'NOT_REQUIRED'
      : 'PENDING_REVIEW';

    // Match scheduled shift and calculate lateness
    const matchingShift = await this.shiftsService.findMatchingShiftForTime(
      organizationId,
      employeeProfileId,
      clockInTime,
    );

    let isLate = false;
    let scheduledStart: Date | undefined = undefined;
    let scheduledEnd: Date | undefined = undefined;
    let shiftTemplateId: string | undefined = undefined;

    if (matchingShift) {
      shiftTemplateId = matchingShift.template.id;
      scheduledStart = matchingShift.scheduledStart;
      scheduledEnd = matchingShift.scheduledEnd;
      const lateThreshold = new Date(
        scheduledStart.getTime() + matchingShift.template.lateArrivalGraceMin * 60000,
      );
      if (clockInTime > lateThreshold) {
        isLate = true;
        reviewStatus = 'PENDING_REVIEW';
      }
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attendanceSession.create({
        data: {
          organizationId,
          employeeProfileId,
          worksiteId: input.worksiteId,
          shiftTemplateId,
          isLate,
          scheduledStart,
          scheduledEnd,
          status: 'ACTIVE',
          presenceStatus,
          reviewStatus,
          clockInAt: clockInTime,
          lastEvaluatedAt: clockInTime,
        },
      });

      await tx.attendanceInterval.create({
        data: {
          attendanceSessionId: created.id,
          intervalType: presenceStatus,
          startedAt: clockInTime,
        },
      });

      return created;
    });

    this.logger.log(`[Attendance] Punch-in accepted for employee ${employeeProfileId} (Status: ${presenceStatus})`);
    return mapAttendanceSessionToDto(session);
  }

  /**
   * Finalizes clock-out, computes total duration, and marks session COMPLETED.
   */
  async punchOut(
    organizationId: string,
    employeeProfileId: string,
    input: PunchOutInput,
  ): Promise<AttendanceSessionDto> {
    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        organizationId,
        employeeProfileId,
        status: 'ACTIVE',
      },
      include: {
        intervals: { orderBy: { startedAt: 'desc' }, take: 1 },
        shiftTemplate: true,
      },
    });

    if (!session) {
      throw new BadRequestException('No active attendance session found');
    }

    const clockOutTime = input.clientTimestamp ? new Date(input.clientTimestamp) : new Date();
    const latestInterval = session.intervals[0];

    let isEarlyDeparture = false;
    if (session.shiftTemplate && session.scheduledEnd) {
      const earlyThreshold = new Date(
        session.scheduledEnd.getTime() - session.shiftTemplate.earlyExitGraceMin * 60000,
      );
      if (clockOutTime < earlyThreshold) {
        isEarlyDeparture = true;
      }
    }

    const completed = await this.prisma.$transaction(async (tx) => {
      if (latestInterval && !latestInterval.endedAt) {
        const intervalDuration = Math.max(
          0,
          Math.floor((clockOutTime.getTime() - latestInterval.startedAt.getTime()) / 1000),
        );
        await tx.attendanceInterval.update({
          where: { id: latestInterval.id },
          data: {
            endedAt: clockOutTime,
            durationSeconds: intervalDuration,
          },
        });
      }

      return tx.attendanceSession.update({
        where: { id: session.id },
        data: {
          status: 'COMPLETED',
          clockOutAt: clockOutTime,
          isEarlyDeparture,
          exitPendingSince: null,
          exitGraceExpiresAt: null,
          insideDurationSeconds: session.insideDurationSeconds + (session.presenceStatus === 'INSIDE' ? Math.max(0, Math.floor((clockOutTime.getTime() - session.lastEvaluatedAt.getTime()) / 1000)) : 0),
          outsideDurationSeconds: session.outsideDurationSeconds + (session.presenceStatus === 'OUTSIDE' ? Math.max(0, Math.floor((clockOutTime.getTime() - session.lastEvaluatedAt.getTime()) / 1000)) : 0),
          lastEvaluatedAt: clockOutTime,
        },
      });
    });

    this.logger.log(`[Attendance] Punch-out completed for employee ${employeeProfileId}`);
    return mapAttendanceSessionToDto(completed);
  }

  /**
   * Evaluates location observation against active session worksite and executes state transition.
   */
  async processLocationObservation(
    organizationId: string,
    employeeProfileId: string,
    latitude: number,
    longitude: number,
    accuracy: number,
    eventTimestamp: Date,
  ): Promise<AttendanceSessionDto | null> {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { organizationId, employeeProfileId, status: 'ACTIVE' },
      include: { worksite: true },
    });

    if (!session) return null;

    const presence = await this.worksitesService.verifyPresence(
      session.worksiteId,
      latitude,
      longitude,
      accuracy,
    );

    const transition = this.stateMachine.evaluateTransition(
      {
        currentPresenceStatus: session.presenceStatus as WorkplacePresenceStatus,
        exitPendingSince: session.exitPendingSince,
        exitGraceExpiresAt: session.exitGraceExpiresAt,
        lastEvaluatedAt: session.lastEvaluatedAt,
        gracePeriodSeconds: session.worksite.gracePeriodSeconds,
      },
      presence.outcome,
      eventTimestamp,
    );

    return this.prisma.$transaction(async (tx) => {
      if (transition.action === 'CONFIRM_EXIT' || transition.action === 'REENTERED_WORKSITE') {
        const latestInterval = await tx.attendanceInterval.findFirst({
          where: { attendanceSessionId: session.id, endedAt: null },
          orderBy: { startedAt: 'desc' },
        });

        if (latestInterval) {
          const duration = Math.max(
            0,
            Math.floor((eventTimestamp.getTime() - latestInterval.startedAt.getTime()) / 1000),
          );
          await tx.attendanceInterval.update({
            where: { id: latestInterval.id },
            data: { endedAt: eventTimestamp, durationSeconds: duration },
          });
        }

        await tx.attendanceInterval.create({
          data: {
            attendanceSessionId: session.id,
            intervalType: transition.nextPresenceStatus,
            startedAt: eventTimestamp,
          },
        });
      }

      const updated = await tx.attendanceSession.update({
        where: { id: session.id },
        data: {
          presenceStatus: transition.nextPresenceStatus,
          exitPendingSince: transition.exitPendingSince,
          exitGraceExpiresAt: transition.exitGraceExpiresAt,
          insideDurationSeconds: session.insideDurationSeconds + transition.accumulatedInsideSeconds,
          outsideDurationSeconds: session.outsideDurationSeconds + transition.accumulatedOutsideSeconds,
          lastEvaluatedAt: eventTimestamp,
        },
      });

      return mapAttendanceSessionToDto(updated);
    });
  }

  /**
   * Deterministically replays ingested offline events through the state machine.
   */
  async processIngestedEvents(events: AttendanceEventDto[]): Promise<void> {
    for (const event of events) {
      try {
        const eventTime = new Date(event.clientTimestamp);
        if (event.eventType === 'PUNCH_IN_REQUESTED') {
          await this.punchIn(event.organizationId, event.employeeProfileId, {
            worksiteId: event.payload.worksiteId,
            latitude: event.payload.latitude,
            longitude: event.payload.longitude,
            accuracy: event.payload.accuracy || 10,
            clientTimestamp: event.clientTimestamp,
          });
        } else if (event.eventType === 'LOCATION_OBSERVED') {
          await this.processLocationObservation(
            event.organizationId,
            event.employeeProfileId,
            event.payload.latitude,
            event.payload.longitude,
            event.payload.accuracy || 10,
            eventTime,
          );
        } else if (event.eventType === 'PUNCH_OUT_REQUESTED') {
          await this.punchOut(event.organizationId, event.employeeProfileId, {
            clientTimestamp: event.clientTimestamp,
            latitude: event.payload.latitude,
            longitude: event.payload.longitude,
          });
        }
      } catch (err) {
        this.logger.warn(`[Attendance] Event replay error for event ${event.eventId}: ${(err as Error).message}`);
      }
    }
  }

  async getActiveSession(
    organizationId: string,
    employeeProfileId: string,
  ): Promise<AttendanceSessionDto | null> {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { organizationId, employeeProfileId, status: 'ACTIVE' },
      include: { intervals: { orderBy: { startedAt: 'asc' } } },
    });

    return session ? mapAttendanceSessionToDto(session) : null;
  }

  async getSessionHistory(
    organizationId: string,
    employeeProfileId?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<AttendanceSessionDto[]> {
    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        organizationId,
        ...(employeeProfileId ? { employeeProfileId } : {}),
      },
      include: { intervals: { orderBy: { startedAt: 'asc' } } },
      orderBy: { clockInAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    });

    return sessions.map((s) => mapAttendanceSessionToDto(s));
  }
}
