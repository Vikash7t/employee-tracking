import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/guards/current-user.decorator';
import {
  TimesheetSummaryDto,
  WorksiteAdherenceReportDto,
  AttendanceCorrectionDto,
  CreateCorrectionInput,
} from '@employee-tracking/contracts';

@Controller('api/v1/reports')
@UseGuards(AuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('timesheet')
  async getTimesheet(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('employeeProfileId') employeeProfileId?: string,
  ): Promise<TimesheetSummaryDto> {
    return this.reportsService.getTimesheetSummary(
      user.organizationId,
      startDate || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0],
      employeeProfileId,
      user,
    );
  }

  @Get('worksite-adherence')
  async getWorksiteAdherence(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<WorksiteAdherenceReportDto> {
    return this.reportsService.getWorksiteAdherence(
      user.organizationId,
      startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0],
    );
  }

  @Get('export/timesheet-csv')
  async exportTimesheetCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.reportsService.streamTimesheetCsv(
      res,
      user.organizationId,
      startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0],
      user,
    );
  }

  @Post('corrections')
  async applyCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCorrectionInput,
  ): Promise<AttendanceCorrectionDto> {
    return this.reportsService.applyCorrection(body, user);
  }

  @Get('sessions/:sessionId/corrections')
  async getSessionCorrections(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<AttendanceCorrectionDto[]> {
    return this.reportsService.getSessionCorrections(sessionId, user);
  }
}
