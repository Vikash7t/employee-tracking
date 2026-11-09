import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/guards/current-user.decorator';
import {
  ShiftTemplateDto,
  CreateShiftTemplateInput,
  ShiftAssignmentDto,
  AssignShiftInput,
  AttendanceVarianceDto,
} from '@employee-tracking/contracts';

@Controller('api/v1/shifts')
@UseGuards(AuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('templates')
  async createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateShiftTemplateInput,
  ): Promise<ShiftTemplateDto> {
    return this.shiftsService.createTemplate(body, user);
  }

  @Get('templates')
  async getTemplates(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ShiftTemplateDto[]> {
    return this.shiftsService.getTemplates(user.organizationId);
  }

  @Post('assign')
  async assignShift(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AssignShiftInput,
  ): Promise<ShiftAssignmentDto> {
    return this.shiftsService.assignShift(body, user);
  }

  @Get('sessions/:sessionId/variance')
  async getAttendanceVariance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ): Promise<AttendanceVarianceDto> {
    return this.shiftsService.calculateAttendanceVariance(sessionId, user);
  }
}
