import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/guards/current-user.decorator';
import { sanitizeCsvField } from './csv-sanitizer';
import {
  TimesheetSummaryDto,
  DailyTimesheetRowDto,
  WorksiteAdherenceReportDto,
  AttendanceCorrectionDto,
  CreateCorrectionInput,
} from '@employee-tracking/contracts';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates aggregated timesheet summary for an organization across a date range.
   */
  async getTimesheetSummary(
    organizationId: string,
    startDateStr: string,
    endDateStr: string,
    targetEmployeeProfileId: string | undefined,
    authUser: AuthenticatedUser,
  ): Promise<TimesheetSummaryDto> {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid start or end date parameter');
    }

    // Role-based scoping
    let employeeFilter: string | undefined = targetEmployeeProfileId;
    if (authUser.role === 'MEMBER') {
      employeeFilter = authUser.employeeProfileId;
    }

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        organizationId,
        clockInAt: { gte: startDate, lte: endDate },
        ...(employeeFilter ? { employeeProfileId: employeeFilter } : {}),
      },
      include: {
        employeeProfile: true,
        shiftTemplate: true,
        worksite: true,
      },
      orderBy: { clockInAt: 'desc' },
    });

    let totalInsideSeconds = 0;
    let totalOutsideSeconds = 0;
    let totalLateCount = 0;
    let totalEarlyDepartureCount = 0;

    const rows: DailyTimesheetRowDto[] = sessions.map((s) => {
      totalInsideSeconds += s.insideDurationSeconds;
      totalOutsideSeconds += s.outsideDurationSeconds;
      if (s.isLate) totalLateCount++;
      if (s.isEarlyDeparture) totalEarlyDepartureCount++;

      return {
        sessionId: s.id,
        date: s.clockInAt.toISOString().split('T')[0],
        employeeCode: s.employeeProfile.employeeCode,
        employeeName: s.employeeProfile.fullName,
        department: s.employeeProfile.department,
        shiftName: s.shiftTemplate?.name || null,
        clockInAt: s.clockInAt.toISOString(),
        clockOutAt: s.clockOutAt ? s.clockOutAt.toISOString() : null,
        isLate: s.isLate,
        isEarlyDeparture: s.isEarlyDeparture,
        insideDurationMinutes: Math.floor(s.insideDurationSeconds / 60),
        outsideDurationMinutes: Math.floor(s.outsideDurationSeconds / 60),
        breakDurationMinutes: Math.floor(s.breakDurationSeconds / 60),
        status: s.status as any,
        reviewStatus: s.reviewStatus as any,
      };
    });

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      totalSessions: rows.length,
      totalInsideMinutes: Math.floor(totalInsideSeconds / 60),
      totalOutsideMinutes: Math.floor(totalOutsideSeconds / 60),
      totalLateCount,
      totalEarlyDepartureCount,
      rows,
    };
  }

  /**
   * Calculates geofence adherence rate grouped by worksite.
   */
  async getWorksiteAdherence(
    organizationId: string,
    startDateStr: string,
    endDateStr: string,
  ): Promise<WorksiteAdherenceReportDto> {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const worksites = await this.prisma.worksite.findMany({
      where: { organizationId, isActive: true },
    });

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        organizationId,
        clockInAt: { gte: startDate, lte: endDate },
      },
    });

    const siteStats = worksites.map((site) => {
      const siteSessions = sessions.filter((s) => s.worksiteId === site.id);
      const totalInside = siteSessions.reduce((acc, s) => acc + s.insideDurationSeconds, 0);
      const totalOutside = siteSessions.reduce((acc, s) => acc + s.outsideDurationSeconds, 0);
      const totalRecorded = totalInside + totalOutside;
      const adherence = totalRecorded > 0 ? (totalInside / totalRecorded) * 100 : 100;

      return {
        worksiteId: site.id,
        worksiteName: site.name,
        totalSessions: siteSessions.length,
        totalInsideMinutes: Math.floor(totalInside / 60),
        totalOutsideMinutes: Math.floor(totalOutside / 60),
        adherencePercentage: Math.round(adherence * 10) / 10,
      };
    });

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      worksites: siteStats,
    };
  }

  /**
   * Pipes timesheet rows directly to HTTP response stream with OWASP formula injection protection.
   */
  async streamTimesheetCsv(
    res: Response,
    organizationId: string,
    startDateStr: string,
    endDateStr: string,
    authUser: AuthenticatedUser,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="timesheet-export.csv"');

    // Header row
    const headers = [
      'Session ID',
      'Date',
      'Employee Code',
      'Employee Name',
      'Department',
      'Shift',
      'Clock In',
      'Clock Out',
      'Is Late',
      'Is Early Departure',
      'Inside Minutes',
      'Outside Minutes',
      'Status',
    ];
    res.write(headers.join(',') + '\r\n');

    const summary = await this.getTimesheetSummary(
      organizationId,
      startDateStr,
      endDateStr,
      undefined,
      authUser,
    );

    for (const row of summary.rows) {
      const line = [
        sanitizeCsvField(row.sessionId),
        sanitizeCsvField(row.date),
        sanitizeCsvField(row.employeeCode),
        sanitizeCsvField(row.employeeName),
        sanitizeCsvField(row.department || ''),
        sanitizeCsvField(row.shiftName || ''),
        sanitizeCsvField(row.clockInAt),
        sanitizeCsvField(row.clockOutAt || ''),
        sanitizeCsvField(row.isLate ? 'YES' : 'NO'),
        sanitizeCsvField(row.isEarlyDeparture ? 'YES' : 'NO'),
        sanitizeCsvField(row.insideDurationMinutes),
        sanitizeCsvField(row.outsideDurationMinutes),
        sanitizeCsvField(row.status),
      ].join(',');

      res.write(line + '\r\n');
    }

    res.end();
  }

  /**
   * Applies an audited correction to an attendance session without destroying history.
   */
  async applyCorrection(
    input: CreateCorrectionInput,
    authUser: AuthenticatedUser,
  ): Promise<AttendanceCorrectionDto> {
    if (authUser.role === 'MEMBER') {
      throw new ForbiddenException('Regular employees cannot apply attendance corrections');
    }

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: input.attendanceSessionId },
      include: { employeeProfile: true },
    });

    if (!session || session.organizationId !== authUser.organizationId) {
      throw new NotFoundException('Attendance session not found in active organization');
    }

    if (!['clockInAt', 'clockOutAt', 'status', 'reviewStatus'].includes(input.fieldAdjusted)) {
      throw new BadRequestException(`Field "${input.fieldAdjusted}" is not eligible for manual correction`);
    }

    const originalValue = String((session as any)[input.fieldAdjusted] || '');

    // Transactionally record the immutable audit entry and apply session adjustment
    const correction = await this.prisma.$transaction(async (tx) => {
      const auditLog = await tx.attendanceCorrection.create({
        data: {
          organizationId: authUser.organizationId,
          attendanceSessionId: session.id,
          adjustedByUserId: authUser.userId,
          fieldAdjusted: input.fieldAdjusted,
          originalValue,
          correctedValue: input.newValue,
          reason: input.reason.trim(),
        },
      });

      const updateData: any = {};
      if (input.fieldAdjusted === 'clockInAt' || input.fieldAdjusted === 'clockOutAt') {
        updateData[input.fieldAdjusted] = new Date(input.newValue);
      } else {
        updateData[input.fieldAdjusted] = input.newValue;
      }

      await tx.attendanceSession.update({
        where: { id: session.id },
        data: updateData,
      });

      return auditLog;
    });

    this.logger.log(
      `[Reports] Correction applied to session ${session.id} on ${input.fieldAdjusted} by user ${authUser.userId}`,
    );

    return {
      id: correction.id,
      organizationId: correction.organizationId,
      attendanceSessionId: correction.attendanceSessionId,
      adjustedByUserId: correction.adjustedByUserId,
      fieldAdjusted: correction.fieldAdjusted,
      originalValue: correction.originalValue,
      correctedValue: correction.correctedValue,
      reason: correction.reason,
      createdAt: correction.createdAt.toISOString(),
    };
  }

  async getSessionCorrections(
    sessionId: string,
    authUser: AuthenticatedUser,
  ): Promise<AttendanceCorrectionDto[]> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.organizationId !== authUser.organizationId) {
      throw new NotFoundException('Attendance session not found');
    }

    const corrections = await this.prisma.attendanceCorrection.findMany({
      where: { attendanceSessionId: sessionId },
      orderBy: { createdAt: 'desc' },
    });

    return corrections.map((c) => ({
      id: c.id,
      organizationId: c.organizationId,
      attendanceSessionId: c.attendanceSessionId,
      adjustedByUserId: c.adjustedByUserId,
      fieldAdjusted: c.fieldAdjusted,
      originalValue: c.originalValue,
      correctedValue: c.correctedValue,
      reason: c.reason,
      createdAt: c.createdAt.toISOString(),
    }));
  }
}
