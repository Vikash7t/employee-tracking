import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import {
  CreateWorksiteInput,
  WorksiteDto,
  SpatialDistanceCheck,
  GeofencePresenceOutcome,
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

  /**
   * Evaluates presence using PostGIS spatial spheroid distance combined with
   * physical GPS horizontal accuracy uncertainty filtering (Master Plan Section 7.5).
   */
  async verifyPresence(
    worksiteId: string,
    userLat: number,
    userLng: number,
    accuracyMeters: number = 10,
  ): Promise<SpatialDistanceCheck> {
    const worksite = await this.findById(worksiteId);

    const check = await this.spatialService.calculateDistance(
      userLat,
      userLng,
      worksite.latitude,
      worksite.longitude,
      worksite.radiusMeters,
    );

    const distance = Math.round(check.distance_meters * 100) / 100;
    const radius = worksite.radiusMeters;
    const isAccuracyAcceptable = accuracyMeters <= Math.max(radius, 50);

    let outcome: GeofencePresenceOutcome = 'UNCERTAIN';
    let isInside = false;

    // Accuracy-aware evaluation
    if (distance + accuracyMeters <= radius) {
      outcome = 'INSIDE';
      isInside = true;
    } else if (distance - accuracyMeters > radius) {
      outcome = 'OUTSIDE';
      isInside = false;
    } else {
      outcome = 'UNCERTAIN';
      // Fallback: If point is mathematically inside within tolerance
      isInside = check.is_within;
    }

    return {
      worksiteId,
      distanceMeters: distance,
      outcome,
      isInside,
      accuracyMeters,
      isAccuracyAcceptable,
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
