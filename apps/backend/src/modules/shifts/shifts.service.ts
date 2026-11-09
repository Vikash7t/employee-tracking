import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ShiftTemplateDto,
  CreateShiftTemplateInput,
  ShiftAssignmentDto,
  AssignShiftInput,
  AttendanceVarianceDto,
} from '@employee-tracking/contracts';
import { AuthenticatedUser } from '../../common/guards/current-user.decorator';

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a reusable shift template with automated overnight detection.
   */
  async createTemplate(
    input: CreateShiftTemplateInput,
    authUser: AuthenticatedUser,
  ): Promise<ShiftTemplateDto> {
    if (authUser.role === 'MEMBER') {
      throw new ForbiddenException('Employees cannot create shift templates');
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(input.startTime) || !timeRegex.test(input.endTime)) {
      throw new BadRequestException('Start and end time must follow 24h format HH:mm');
    }

    const [startH, startM] = input.startTime.split(':').map(Number);
    const [endH, endM] = input.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Overnight shift: end time is less than or equal to start time (crosses midnight)
    const isOvernight = endMinutes <= startMinutes;

    const template = await this.prisma.shiftTemplate.create({
      data: {
        organizationId: authUser.organizationId,
        name: input.name.trim(),
        startTime: input.startTime,
        endTime: input.endTime,
        isOvernight,
        lateArrivalGraceMin: input.lateArrivalGraceMin ?? 15,
        earlyExitGraceMin: input.earlyExitGraceMin ?? 10,
        breakAllowanceMin: input.breakAllowanceMin ?? 60,
        isFlexible: input.isFlexible ?? false,
      },
    });

    this.logger.log(`[Shifts] Created template "${template.name}" (Overnight: ${isOvernight})`);
    return this.mapTemplateToDto(template);
  }

  async getTemplates(organizationId: string): Promise<ShiftTemplateDto[]> {
    const templates = await this.prisma.shiftTemplate.findMany({
      where: { organizationId, isActive: true },
      orderBy: { startTime: 'asc' },
    });
    return templates.map((t) => this.mapTemplateToDto(t));
  }

  /**
   * Assigns an employee to a shift schedule with overlap conflict detection.
   */
  async assignShift(
    input: AssignShiftInput,
    authUser: AuthenticatedUser,
  ): Promise<ShiftAssignmentDto> {
    if (authUser.role === 'MEMBER') {
      throw new ForbiddenException('Employees cannot assign shifts');
    }

    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id: input.employeeProfileId },
    });
    if (!profile || profile.organizationId !== authUser.organizationId) {
      throw new NotFoundException('Employee profile not found in active organization');
    }

    // Scoped manager check
    if (
      authUser.role === 'MANAGER' &&
      (!profile.primaryWorksiteId || !authUser.allowedWorksiteIds.includes(profile.primaryWorksiteId))
    ) {
      throw new ForbiddenException('Managers can only assign shifts to employees within assigned worksites');
    }

    const template = await this.prisma.shiftTemplate.findUnique({
      where: { id: input.shiftTemplateId },
    });
    if (!template || template.organizationId !== authUser.organizationId) {
      throw new NotFoundException('Shift template not found in organization');
    }

    const fromDate = new Date(input.effectiveFrom);
    const toDate = input.effectiveTo ? new Date(input.effectiveTo) : null;

    // Check for conflicting active assignments overlapping on the same work days
    const existingAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        employeeProfileId: input.employeeProfileId,
        isActive: true,
      },
      include: { shiftTemplate: true },
    });

    for (const existing of existingAssignments) {
      const hasOverlappingDays = input.workDays.some((d) => existing.workDays.includes(d));
      if (hasOverlappingDays) {
        const existingEnd = existing.effectiveTo || new Date('2099-12-31');
        const newEnd = toDate || new Date('2099-12-31');
        if (fromDate <= existingEnd && newEnd >= existing.effectiveFrom) {
          throw new BadRequestException(
            `Shift assignment conflicts with existing schedule "${existing.shiftTemplate.name}" on shared workdays`,
          );
        }
      }
    }

    const assignment = await this.prisma.shiftAssignment.create({
      data: {
        organizationId: authUser.organizationId,
        employeeProfileId: input.employeeProfileId,
        shiftTemplateId: input.shiftTemplateId,
        workDays: input.workDays,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
      },
      include: { shiftTemplate: true },
    });

    this.logger.log(`[Shifts] Assigned shift "${template.name}" to employee ${profile.employeeCode}`);
    return this.mapAssignmentToDto(assignment);
  }

  /**
   * Finds the active assigned shift matching an employee's reference timestamp.
   */
  async findMatchingShiftForTime(
    organizationId: string,
    employeeProfileId: string,
    referenceTime: Date,
  ): Promise<{
    template: ShiftTemplateDto;
    scheduledStart: Date;
    scheduledEnd: Date;
  } | null> {
    // 1=Mon, 2=Tue, ..., 7=Sun
    const jsDay = referenceTime.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        organizationId,
        employeeProfileId,
        isActive: true,
        effectiveFrom: { lte: referenceTime },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: referenceTime } }],
      },
      include: { shiftTemplate: true },
    });

    for (const assignment of assignments) {
      if (assignment.workDays.includes(dayOfWeek)) {
        const template = assignment.shiftTemplate;
        const [sH, sM] = template.startTime.split(':').map(Number);
        const [eH, eM] = template.endTime.split(':').map(Number);

        const scheduledStart = new Date(referenceTime);
        scheduledStart.setHours(sH, sM, 0, 0);

        const scheduledEnd = new Date(referenceTime);
        if (template.isOvernight) {
          scheduledEnd.setDate(scheduledEnd.getDate() + 1);
        }
        scheduledEnd.setHours(eH, eM, 0, 0);

        return {
          template: this.mapTemplateToDto(template),
          scheduledStart,
          scheduledEnd,
        };
      }
    }

    return null;
  }

  /**
   * Computes lateness and early departure variance against scheduled shift.
   */
  async calculateAttendanceVariance(
    sessionId: string,
    authUser: AuthenticatedUser,
  ): Promise<AttendanceVarianceDto> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { shiftTemplate: true },
    });

    if (!session || session.organizationId !== authUser.organizationId) {
      throw new NotFoundException('Attendance session not found');
    }

    if (!session.shiftTemplate || !session.scheduledStart || !session.scheduledEnd) {
      throw new BadRequestException('Session is not associated with a scheduled shift template');
    }

    const t = session.shiftTemplate;
    const clockIn = session.clockInAt;
    const clockOut = session.clockOutAt || new Date();

    const lateThreshold = new Date(session.scheduledStart.getTime() + t.lateArrivalGraceMin * 60000);
    const isLate = clockIn > lateThreshold;
    const latenessMinutes = isLate
      ? Math.max(0, Math.floor((clockIn.getTime() - session.scheduledStart.getTime()) / 60000))
      : 0;

    const earlyThreshold = new Date(session.scheduledEnd.getTime() - t.earlyExitGraceMin * 60000);
    const isEarlyDeparture = session.clockOutAt ? clockOut < earlyThreshold : false;
    const earlyDepartureMinutes = isEarlyDeparture
      ? Math.max(0, Math.floor((session.scheduledEnd.getTime() - clockOut.getTime()) / 60000))
      : 0;

    const scheduledDurationMinutes = Math.floor(
      (session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60000,
    );
    const actualDurationMinutes = Math.floor(
      (clockOut.getTime() - clockIn.getTime()) / 60000,
    );

    return {
      sessionId: session.id,
      isLate,
      latenessMinutes,
      isEarlyDeparture,
      earlyDepartureMinutes,
      scheduledDurationMinutes,
      actualDurationMinutes,
    };
  }

  private mapTemplateToDto(t: any): ShiftTemplateDto {
    return {
      id: t.id,
      organizationId: t.organizationId,
      name: t.name,
      startTime: t.startTime,
      endTime: t.endTime,
      isOvernight: t.isOvernight,
      lateArrivalGraceMin: t.lateArrivalGraceMin,
      earlyExitGraceMin: t.earlyExitGraceMin,
      breakAllowanceMin: t.breakAllowanceMin,
      isFlexible: t.isFlexible,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
    };
  }

  private mapAssignmentToDto(a: any): ShiftAssignmentDto {
    return {
      id: a.id,
      organizationId: a.organizationId,
      employeeProfileId: a.employeeProfileId,
      shiftTemplateId: a.shiftTemplateId,
      workDays: a.workDays,
      effectiveFrom: a.effectiveFrom.toISOString().split('T')[0],
      effectiveTo: a.effectiveTo ? a.effectiveTo.toISOString().split('T')[0] : null,
      isActive: a.isActive,
      shiftTemplate: a.shiftTemplate ? this.mapTemplateToDto(a.shiftTemplate) : undefined,
      createdAt: a.createdAt.toISOString(),
    };
  }
}
