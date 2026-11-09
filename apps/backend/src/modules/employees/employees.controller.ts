import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import {
  ProvisionEmployeeInput,
  ProvisionEmployeeResponse,
  EmployeeProfileDto,
} from '@employee-tracking/contracts';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/guards/current-user.decorator';

@ApiTags('Employees')
@Controller('api/v1/employees')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post('provision')
  @Roles('OWNER', 'ORG_ADMIN', 'MANAGER')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision new employee profile and generate single-use invitation' })
  @ApiResponse({ status: 201, description: 'Employee provisioned, returns invitation token' })
  async provisionEmployee(
    @Body() input: ProvisionEmployeeInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProvisionEmployeeResponse> {
    return this.employeesService.provisionEmployee(input, user);
  }

  @Get()
  @ApiOperation({ summary: 'List employees scoped to organization and manager worksite boundaries' })
  async listEmployees(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeProfileDto[]> {
    const targetOrgId = organizationId || user.organizationId;
    return this.employeesService.listEmployees(targetOrgId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee profile by ID with strict tenant and scope enforcement' })
  async getEmployeeById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeProfileDto> {
    return this.employeesService.getEmployeeById(id, user);
  }
}
