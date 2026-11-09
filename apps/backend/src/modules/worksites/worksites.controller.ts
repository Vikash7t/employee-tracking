import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { WorksitesService } from './worksites.service';
import {
  CreateWorksiteInput,
  UpdateWorksiteInput,
  WorksiteDto,
  SpatialDistanceCheck,
  VerifyPresenceInput,
} from '@employee-tracking/contracts';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/guards/current-user.decorator';

@ApiTags('Worksites & Geofences')
@Controller('api/v1/worksites')
export class WorksitesController {
  constructor(private readonly worksitesService: WorksitesService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List worksites with tenant and manager boundary scoping' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of worksites' })
  async findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorksiteDto[]> {
    const targetOrgId = organizationId || user.organizationId;
    return this.worksitesService.findAll(targetOrgId, user);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get worksite details by ID with tenant validation' })
  @ApiResponse({ status: 200, description: 'Worksite details' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorksiteDto> {
    return this.worksitesService.findById(id, user);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ORG_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a circular or polygon worksite geofence' })
  @ApiResponse({ status: 201, description: 'Worksite created' })
  async create(
    @Body() input: CreateWorksiteInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorksiteDto> {
    const targetOrgId = input.organizationId || user.organizationId;
    return this.worksitesService.create({ ...input, organizationId: targetOrgId }, user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ORG_ADMIN', 'MANAGER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update worksite boundaries, radius, or deactivation status' })
  @ApiResponse({ status: 200, description: 'Worksite updated' })
  async update(
    @Param('id') id: string,
    @Body() input: UpdateWorksiteInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorksiteDto> {
    return this.worksitesService.update(id, input, user);
  }

  @Post(':id/verify-presence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user coordinates against circular or polygon geofence with 3-zone model' })
  @ApiResponse({ status: 200, description: 'Distance check and inside/outside/uncertain determination' })
  async verifyPresence(
    @Param('id') id: string,
    @Body() body: VerifyPresenceInput,
  ): Promise<SpatialDistanceCheck> {
    return this.worksitesService.verifyPresence(
      id,
      body.latitude,
      body.longitude,
      body.accuracyMeters,
    );
  }
}
