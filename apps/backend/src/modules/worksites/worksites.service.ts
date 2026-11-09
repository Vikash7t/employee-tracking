import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import {
  CreateWorksiteInput,
  WorksiteDto,
  SpatialDistanceCheck,
} from '@employee-tracking/contracts';

@Injectable()
export class WorksitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spatialService: SpatialService,
  ) {}

  async findAll(organizationId?: string): Promise<WorksiteDto[]> {
    const where = organizationId ? { organizationId } : {};
    const sites = await this.prisma.worksite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return sites.map(this.mapToDto);
  }

  async findById(id: string): Promise<WorksiteDto> {
    const site = await this.prisma.worksite.findUnique({ where: { id } });
    if (!site) {
      throw new NotFoundException(`Worksite with ID ${id} not found`);
    }
    return this.mapToDto(site);
  }

  async create(input: CreateWorksiteInput): Promise<WorksiteDto> {
    const created = await this.prisma.worksite.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        worksiteType: input.worksiteType || 'CIRCULAR',
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters || 50,
        gracePeriodSeconds: input.gracePeriodSeconds || 120,
      },
    });
    return this.mapToDto(created);
  }

  async verifyPresence(
    worksiteId: string,
    userLat: number,
    userLng: number,
  ): Promise<SpatialDistanceCheck> {
    const worksite = await this.findById(worksiteId);

    const check = await this.spatialService.calculateDistance(
      userLat,
      userLng,
      worksite.latitude,
      worksite.longitude,
      worksite.radiusMeters,
    );

    return {
      worksiteId,
      distanceMeters: Math.round(check.distance_meters * 100) / 100,
      isInside: check.is_within,
    };
  }

  private mapToDto(site: any): WorksiteDto {
    return {
      id: site.id,
      organizationId: site.organizationId,
      name: site.name,
      worksiteType: site.worksiteType,
      latitude: Number(site.latitude),
      longitude: Number(site.longitude),
      radiusMeters: site.radiusMeters,
      gracePeriodSeconds: site.gracePeriodSeconds,
      isActive: site.isActive,
      createdAt: site.createdAt.toISOString(),
      updatedAt: site.updatedAt.toISOString(),
    };
  }
}
