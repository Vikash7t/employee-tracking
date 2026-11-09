import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import { HealthCheckResponse } from '@employee-tracking/contracts';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly spatialService: SpatialService,
  ) {}

  async checkHealth(): Promise<HealthCheckResponse> {
    const startDb = Date.now();
    let isConnected = false;
    let postgisVersion = 'Not installed';
    let postgisInstalled = false;

    try {
      await this.prisma.$queryRaw`SELECT 1;`;
      isConnected = true;

      postgisVersion = await this.spatialService.getPostgisVersion();
      postgisInstalled = postgisVersion !== 'Unknown';
    } catch {
      isConnected = false;
    }

    const latencyMs = Date.now() - startDb;
    const isHealthy = isConnected && postgisInstalled;

    return {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'employee-tracking-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      database: {
        connected: isConnected,
        postgisInstalled,
        postgisVersion,
        latencyMs,
      },
    };
  }
}
