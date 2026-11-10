import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';
import {
  HealthCheckResponse,
  LivenessCheckResponse,
  ReadinessCheckResponse,
} from '@employee-tracking/contracts';

@ApiTags('System Health')
@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'System and database health status' })
  @ApiResponse({
    status: 200,
    description: 'System health report including PostgreSQL and PostGIS status',
  })
  async getHealth(): Promise<HealthCheckResponse> {
    return this.healthService.checkHealth();
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Kubernetes/ECS liveness probe (Node event loop check)' })
  @ApiResponse({ status: 200, description: 'Process is alive and responsive' })
  getLiveness(): LivenessCheckResponse {
    return this.healthService.checkLiveness();
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Kubernetes/ECS readiness probe (Database and spatial engine check)' })
  @ApiResponse({ status: 200, description: 'Backend is ready to receive traffic' })
  @ApiResponse({ status: 503, description: 'Backend database is not ready' })
  async getReadiness(@Res() res: Response): Promise<void> {
    const report = await this.healthService.checkReadiness();
    const status = report.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(status).json(report);
  }
}
