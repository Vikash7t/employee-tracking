import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/guards/current-user.decorator';
import {
  PunchInInput,
  PunchOutInput,
  AttendanceSessionDto,
} from '@employee-tracking/contracts';

@Controller('api/v1/attendance')
@UseGuards(AuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('punch-in')
  async punchIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PunchInInput,
  ): Promise<AttendanceSessionDto> {
    const employeeProfileId = user.employeeProfileId;
    if (!employeeProfileId) {
      throw new BadRequestException('User does not have an associated employee profile');
    }

    return this.attendanceService.punchIn(user.organizationId, employeeProfileId, body);
  }

  @Post('punch-out')
  async punchOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PunchOutInput,
  ): Promise<AttendanceSessionDto> {
    const employeeProfileId = user.employeeProfileId;
    if (!employeeProfileId) {
      throw new BadRequestException('User does not have an associated employee profile');
    }

    return this.attendanceService.punchOut(user.organizationId, employeeProfileId, body);
  }

  @Get('active')
  async getActiveSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttendanceSessionDto | null> {
    const employeeProfileId = user.employeeProfileId;
    if (!employeeProfileId) {
      throw new BadRequestException('User does not have an associated employee profile');
    }

    return this.attendanceService.getActiveSession(user.organizationId, employeeProfileId);
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeProfileId') targetProfileId?: string,
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ): Promise<AttendanceSessionDto[]> {
    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    // OWASP BOLA Check: Regular employees can only query their own history
    if (['MEMBER', 'EMPLOYEE'].includes(user.role)) {
      if (targetProfileId && targetProfileId !== user.employeeProfileId) {
        throw new ForbiddenException('Employees can only query their own attendance history');
      }
      return this.attendanceService.getSessionHistory(
        user.organizationId,
        user.employeeProfileId,
        parsedLimit,
        parsedOffset,
      );
    }

    return this.attendanceService.getSessionHistory(
      user.organizationId,
      targetProfileId,
      parsedLimit,
      parsedOffset,
    );
  }
}
