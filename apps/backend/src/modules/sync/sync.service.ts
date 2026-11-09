import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import {
  SyncBatchInput,
  SyncBatchResponse,
  AttendanceEventDto,
} from '@employee-tracking/contracts';
import { AuthenticatedUser } from '../../common/guards/current-user.decorator';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  async ingestEvents(
    input: SyncBatchInput,
    authUser: AuthenticatedUser,
  ): Promise<SyncBatchResponse> {
    if (!input.events || !Array.isArray(input.events)) {
      throw new BadRequestException('Events must be provided as an array');
    }

    if (input.events.length === 0) {
      return { acknowledgedEventIds: [], rejectedEvents: [] };
    }

    // Limit batch size to prevent payload exhaustion (OWASP API4)
    if (input.events.length > 100) {
      throw new BadRequestException('Batch size exceeds maximum limit of 100 events');
    }

    const acknowledgedEventIds: string[] = [];
    const rejectedEvents: { eventId: string; reason: string }[] = [];
    const validEventsToInsert: any[] = [];

    // Sort events deterministically by sequence and timestamp
    const sorted = [...input.events].sort((a, b) => {
      if (a.sequenceNumber !== b.sequenceNumber) {
        return a.sequenceNumber - b.sequenceNumber;
      }
      return new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime();
    });

    for (const evt of sorted) {
      // 1. Enforce strict tenant isolation (BOLA)
      if (evt.organizationId !== authUser.organizationId) {
        rejectedEvents.push({
          eventId: evt.eventId,
          reason: 'Cross-tenant event ingestion rejected',
        });
        continue;
      }

      // 2. Enforce employee self-submission for MEMBER role
      if (authUser.role === 'MEMBER' && authUser.employeeProfileId && evt.employeeProfileId !== authUser.employeeProfileId) {
        rejectedEvents.push({
          eventId: evt.eventId,
          reason: 'Cannot ingest attendance events for another employee',
        });
        continue;
      }

      validEventsToInsert.push({
        id: evt.eventId,
        organizationId: evt.organizationId,
        employeeProfileId: evt.employeeProfileId,
        eventType: evt.eventType,
        sequenceNumber: evt.sequenceNumber,
        clientTimestamp: new Date(evt.clientTimestamp),
        elapsedRealtimeMs: evt.elapsedRealtimeMs ? BigInt(evt.elapsedRealtimeMs) : null,
        payload: evt.payload || {},
        signature: evt.signature || null,
      });

      acknowledgedEventIds.push(evt.eventId);
    }

    // Idempotent batch insertion: ON CONFLICT DO NOTHING
    if (validEventsToInsert.length > 0) {
      await this.prisma.attendanceEvent.createMany({
        data: validEventsToInsert,
        skipDuplicates: true, // Native PostgreSQL ON CONFLICT DO NOTHING
      });

      // Pass valid chronological events through Attendance State Machine
      const sortedEvents = [...input.events]
        .filter((e) => acknowledgedEventIds.includes(e.eventId))
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      await this.attendanceService.processIngestedEvents(sortedEvents);
    }

    return {
      acknowledgedEventIds,
      rejectedEvents,
    };
  }

  async getEventsForEmployee(
    employeeProfileId: string,
    authUser: AuthenticatedUser,
    limit: number = 100,
  ): Promise<any[]> {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeProfileId },
    });

    if (!profile || profile.organizationId !== authUser.organizationId) {
      throw new ForbiddenException('Cross-tenant employee events access denied');
    }

    if (authUser.role === 'MEMBER' && authUser.employeeProfileId !== employeeProfileId) {
      throw new ForbiddenException('Employees can only inspect their own event history');
    }

    if (
      authUser.role === 'MANAGER' &&
      (!profile.primaryWorksiteId || !authUser.allowedWorksiteIds.includes(profile.primaryWorksiteId))
    ) {
      throw new ForbiddenException('Managers can only inspect events for assigned worksites');
    }

    const events = await this.prisma.attendanceEvent.findMany({
      where: { employeeProfileId },
      orderBy: { sequenceNumber: 'asc' },
      take: Math.min(limit, 200),
    });

    return events.map((e) => ({
      eventId: e.id,
      organizationId: e.organizationId,
      employeeProfileId: e.employeeProfileId,
      eventType: e.eventType,
      sequenceNumber: e.sequenceNumber,
      clientTimestamp: e.clientTimestamp.toISOString(),
      elapsedRealtimeMs: e.elapsedRealtimeMs ? Number(e.elapsedRealtimeMs) : undefined,
      serverReceivedAt: e.serverReceivedAt.toISOString(),
      payload: e.payload,
      signature: e.signature,
      isReconciled: e.isReconciled,
    }));
  }
}
