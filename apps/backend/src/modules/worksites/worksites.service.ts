import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import {
  CreateWorksiteInput,
  UpdateWorksiteInput,
  WorksiteDto,
  SpatialDistanceCheck,
  GeofencePresenceOutcome,
} from '@employee-tracking/contracts';
import { AuthenticatedUser } from '../../common/guards/current-user.decorator';

@Injectable()
export class WorksitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spatialService: SpatialService,
  ) {}

  async findAll(organizationId: string, authUser?: AuthenticatedUser): Promise<WorksiteDto[]> {
    if (authUser && authUser.organizationId !== organizationId) {
      throw new ForbiddenException('Cross-tenant worksite access is strictly forbidden');
    }

    const where: any = { organizationId, isActive: true };
    if (authUser && authUser.role === 'MANAGER') {
      where.id = { in: authUser.allowedWorksiteIds };
    }

    const sites = await this.prisma.worksite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return sites.map(this.mapToDto);
  }

  async findById(id: string, authUser?: AuthenticatedUser): Promise<WorksiteDto> {
    const site = await this.prisma.worksite.findUnique({ where: { id } });
    if (!site) {
      throw new NotFoundException(`Worksite with ID ${id} not found`);
    }

    if (authUser) {
      if (site.organizationId !== authUser.organizationId) {
        throw new ForbiddenException('Cross-tenant worksite access is strictly forbidden');
      }
      if (authUser.role === 'MANAGER' && !authUser.allowedWorksiteIds.includes(site.id)) {
        throw new ForbiddenException('Managers can only inspect their assigned worksites');
      }
    }

    return this.mapToDto(site);
  }

  async create(input: CreateWorksiteInput, authUser?: AuthenticatedUser): Promise<WorksiteDto> {
    if (authUser && authUser.organizationId !== input.organizationId) {
      throw new ForbiddenException('Cannot create worksites in another organization');
    }

    if (input.worksiteType === 'POLYGON') {
      if (!input.polygonCoordinates) {
        throw new BadRequestException('Polygon worksites require valid polygonCoordinates');
      }
      await this.spatialService.validatePolygon(input.polygonCoordinates);
    }

    const created = await this.prisma.worksite.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        worksiteType: input.worksiteType || 'CIRCULAR',
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters || 50,
        polygonCoordinates: input.polygonCoordinates ? (input.polygonCoordinates as any) : undefined,
        gracePeriodSeconds: input.gracePeriodSeconds || 120,
      },
    });

    return this.mapToDto(created);
  }

  async update(
    id: string,
    input: UpdateWorksiteInput,
    authUser: AuthenticatedUser,
  ): Promise<WorksiteDto> {
    const existing = await this.findById(id, authUser);

    if (authUser.role === 'MANAGER' && !authUser.allowedWorksiteIds.includes(id)) {
      throw new ForbiddenException('Managers cannot modify worksites outside their assigned scope');
    }

    if (input.worksiteType === 'POLYGON' || (existing.worksiteType === 'POLYGON' && input.polygonCoordinates)) {
      const coords = input.polygonCoordinates || existing.polygonCoordinates;
      if (!coords) {
        throw new BadRequestException('Polygon worksites require valid polygonCoordinates');
      }
      await this.spatialService.validatePolygon(coords);
    }

    const updated = await this.prisma.worksite.update({
      where: { id },
      data: {
        name: input.name,
        worksiteType: input.worksiteType,
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters: input.radiusMeters,
        polygonCoordinates: input.polygonCoordinates ? (input.polygonCoordinates as any) : undefined,
        gracePeriodSeconds: input.gracePeriodSeconds,
        isActive: input.isActive,
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Evaluates presence using PostGIS spatial spheroid distance & polygon containment
   * combined with physical GPS horizontal accuracy uncertainty filtering (Master Plan Section 7.5).
   */
  async verifyPresence(
    worksiteId: string,
    userLat: number,
    userLng: number,
    accuracyMeters: number = 10,
  ): Promise<SpatialDistanceCheck> {
    const worksite = await this.findById(worksiteId);
    const isAccuracyAcceptable = accuracyMeters <= 50;

    if (worksite.worksiteType === 'POLYGON' && worksite.polygonCoordinates) {
      const polyResult = await this.spatialService.calculatePolygonPresence(
        userLat,
        userLng,
        worksite.polygonCoordinates,
      );

      const distanceToBoundary = Math.round(polyResult.distanceToBoundaryMeters * 100) / 100;
      let outcome: GeofencePresenceOutcome = 'UNCERTAIN';
      let isInside = false;

      if (polyResult.isInside) {
        if (distanceToBoundary >= accuracyMeters) {
          outcome = 'INSIDE';
          isInside = true;
        } else {
          outcome = 'UNCERTAIN';
          isInside = true;
        }
      } else {
        if (distanceToBoundary > accuracyMeters) {
          outcome = 'OUTSIDE';
          isInside = false;
        } else {
          outcome = 'UNCERTAIN';
          isInside = false;
        }
      }

      return {
        worksiteId,
        distanceMeters: distanceToBoundary,
        outcome,
        isInside,
        accuracyMeters,
        isAccuracyAcceptable,
      };
    }

    // Circular worksite fallback
    const check = await this.spatialService.calculateDistance(
      userLat,
      userLng,
      worksite.latitude,
      worksite.longitude,
      worksite.radiusMeters,
    );

    const distance = Math.round(check.distance_meters * 100) / 100;
    const radius = worksite.radiusMeters;

    let outcome: GeofencePresenceOutcome = 'UNCERTAIN';
    let isInside = false;

    if (distance + accuracyMeters <= radius) {
      outcome = 'INSIDE';
      isInside = true;
    } else if (distance - accuracyMeters > radius) {
      outcome = 'OUTSIDE';
      isInside = false;
    } else {
      outcome = 'UNCERTAIN';
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
      polygonCoordinates: site.polygonCoordinates || undefined,
      gracePeriodSeconds: site.gracePeriodSeconds,
      isActive: site.isActive,
      createdAt: site.createdAt.toISOString(),
      updatedAt: site.updatedAt.toISOString(),
    };
  }
}
