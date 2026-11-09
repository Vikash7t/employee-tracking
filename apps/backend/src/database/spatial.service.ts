import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface PostgisVersionResult {
  postgis_version: string;
}

export interface DistanceResult {
  distance_meters: number;
  is_within: boolean;
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
   * Calculates the exact spherical distance in meters between user coordinates
   * and a worksite boundary using PostGIS geography types.
   */
  async calculateDistance(
    userLat: number,
    userLng: number,
    worksiteLat: number,
    worksiteLng: number,
    radiusMeters: number
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
      is_within: Boolean(result[0]?.is_within)
    };
  }
}
