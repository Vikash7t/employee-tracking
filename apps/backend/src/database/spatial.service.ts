import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { GeoPolygonCoordinates } from '@employee-tracking/contracts';

export interface PostgisVersionResult {
  postgis_version: string;
}

export interface DistanceResult {
  distance_meters: number;
  is_within: boolean;
}

export interface PolygonPresenceResult {
  isInside: boolean;
  distanceToBoundaryMeters: number;
}

@Injectable()
export class SpatialService {
  private readonly logger = new Logger(SpatialService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies PostGIS extension installation and returns its version.
   */
  async getPostgisVersion(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<PostgisVersionResult[]>`SELECT PostGIS_Version();`;
      return result[0]?.postgis_version || 'Unknown';
    } catch (error) {
      this.logger.error('Failed to query PostGIS version:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Validates GeoJSON Polygon coordinates for topological validity and DoS limits.
   */
  async validatePolygon(coordinates: GeoPolygonCoordinates): Promise<void> {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      throw new BadRequestException('Polygon coordinates must be a non-empty array of rings');
    }

    const exteriorRing = coordinates[0];
    if (!Array.isArray(exteriorRing) || exteriorRing.length < 4) {
      throw new BadRequestException(
        'Polygon exterior ring must have at least 4 coordinates (3 vertices + closed start/end)',
      );
    }

    if (exteriorRing.length > 50) {
      throw new BadRequestException(
        'Polygon exterior ring exceeds maximum allowed vertex limit (50 points)',
      );
    }

    const first = exteriorRing[0];
    const last = exteriorRing[exteriorRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new BadRequestException('Polygon exterior ring must be closed (first and last vertex identical)');
    }

    for (const point of exteriorRing) {
      const [lng, lat] = point;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        throw new BadRequestException('All polygon coordinates must be numeric [longitude, latitude]');
      }
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new BadRequestException(`Coordinates out of bounds: [${lng}, ${lat}]`);
      }
    }

    const geoJson = JSON.stringify({ type: 'Polygon', coordinates });
    const result = await this.prisma.$queryRaw<{ is_valid: boolean }[]>`
      SELECT ST_IsValid(ST_GeomFromGeoJSON(${geoJson})) AS is_valid;
    `;

    if (!result[0]?.is_valid) {
      throw new BadRequestException('Polygon geometry is self-intersecting or topologically invalid');
    }
  }

  /**
   * Calculates spherical distance in meters for circular geofences.
   */
  async calculateDistance(
    userLat: number,
    userLng: number,
    worksiteLat: number,
    worksiteLng: number,
    radiusMeters: number,
  ): Promise<DistanceResult> {
    const result = await this.prisma.$queryRaw<{ distance_meters: number; is_within: boolean }[]>`
      SELECT 
        ST_Distance(
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${worksiteLng}, ${worksiteLat}), 4326)::geography
        ) AS distance_meters,
        ST_DWithin(
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${worksiteLng}, ${worksiteLat}), 4326)::geography,
          ${radiusMeters}
        ) AS is_within;
    `;

    return {
      distance_meters: Number(result[0]?.distance_meters || 0),
      is_within: Boolean(result[0]?.is_within),
    };
  }

  /**
   * Determines whether a point is inside a polygon and calculates distance to nearest boundary.
   */
  async calculatePolygonPresence(
    userLat: number,
    userLng: number,
    coordinates: GeoPolygonCoordinates,
  ): Promise<PolygonPresenceResult> {
    const geoJson = JSON.stringify({ type: 'Polygon', coordinates });

    const result = await this.prisma.$queryRaw<{
      is_inside: boolean;
      distance_to_boundary: number;
    }[]>`
      SELECT 
        ST_Covers(
          ST_SetSRID(ST_GeomFromGeoJSON(${geoJson}), 4326),
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)
        ) AS is_inside,
        ST_Distance(
          ST_Boundary(ST_SetSRID(ST_GeomFromGeoJSON(${geoJson}), 4326))::geography,
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography
        ) AS distance_to_boundary;
    `;

    return {
      isInside: Boolean(result[0]?.is_inside),
      distanceToBoundaryMeters: Number(result[0]?.distance_to_boundary || 0),
    };
  }
}
