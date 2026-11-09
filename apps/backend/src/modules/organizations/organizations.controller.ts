import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationInput, OrganizationDto } from '@employee-tracking/contracts';

@ApiTags('Organizations')
@Controller('api/v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active organizations' })
  @ApiResponse({ status: 200, description: 'List of registered organizations' })
  async findAll(): Promise<OrganizationDto[]> {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by UUID' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  async findById(@Param('id') id: string): Promise<OrganizationDto> {
    return this.organizationsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully' })
  async create(@Body() input: CreateOrganizationInput): Promise<OrganizationDto> {
    return this.organizationsService.create(input);
  }
}
