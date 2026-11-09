import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Verify user coordinates against worksite geofence using PostGIS' })
  @ApiResponse({ status: 200, description: 'Distance check and inside/outside determination' })
  async verifyPresence(
    @Param('id') id: string,
    @Body() coords: { latitude: number; longitude: number },
  ): Promise<SpatialDistanceCheck> {
    return this.worksitesService.verifyPresence(id, coords.latitude, coords.longitude);
  }
}
