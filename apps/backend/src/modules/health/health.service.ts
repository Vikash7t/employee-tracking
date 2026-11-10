import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SpatialService } from '../../database/spatial.service';
import {
  HealthCheckResponse,
  LivenessCheckResponse,
  ReadinessCheckResponse,
} from '@employee-tracking/contracts';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly spatialService: SpatialService,
  ) {}

  checkLiveness(): LivenessCheckResponse {
    const mem = process.memoryUsage();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsageMb: {
        rss: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
        heapTotal: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
        heapUsed: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
      },
    };
  }

  async checkReadiness(): Promise<ReadinessCheckResponse> {
    const health = await this.checkHealth();
    return {
      status: health.status === 'ok' ? 'ready' : 'not_ready',
      timestamp: health.timestamp,
      database: health.database,
    };
  }

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
