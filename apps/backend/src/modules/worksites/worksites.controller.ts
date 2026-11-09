import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WorksitesService } from './worksites.service';
import {
  CreateWorksiteInput,
  WorksiteDto,
  SpatialDistanceCheck,
} from '@employee-tracking/contracts';

@ApiTags('Worksites & Geofences')
@Controller('api/v1/worksites')
export class WorksitesController {
  constructor(private readonly worksitesService: WorksitesService) {}

  @Get()
  @ApiOperation({ summary: 'List all worksites with optional organization filter' })
  @ApiQuery({ name: 'organizationId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of worksites' })
  async findAll(@Query('organizationId') organizationId?: string): Promise<WorksiteDto[]> {
    return this.worksitesService.findAll(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get worksite details by ID' })
  @ApiResponse({ status: 200, description: 'Worksite details' })
  async findById(@Param('id') id: string): Promise<WorksiteDto> {
    return this.worksitesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new worksite / geofenced area' })
  @ApiResponse({ status: 201, description: 'Worksite created' })
  async create(@Body() input: CreateWorksiteInput): Promise<WorksiteDto> {
    return this.worksitesService.create(input);
  }

  @Post(':id/verify-presence')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user coordinates against worksite geofence with GPS accuracy model' })
  @ApiResponse({ status: 200, description: 'Distance check and inside/outside/uncertain determination' })
  async verifyPresence(
    @Param('id') id: string,
    @Body() body: { latitude: number; longitude: number; accuracyMeters?: number },
  ): Promise<SpatialDistanceCheck> {
    return this.worksitesService.verifyPresence(
      id,
      body.latitude,
      body.longitude,
      body.accuracyMeters,
    );
  }
}
