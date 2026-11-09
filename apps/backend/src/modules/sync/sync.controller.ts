import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncBatchInput, SyncBatchResponse } from '@employee-tracking/contracts';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/guards/current-user.decorator';

@ApiTags('Offline Sync & Events')
@Controller('api/v1/sync')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ingest offline attendance event batch with idempotent deduplication' })
  @ApiResponse({ status: 200, description: 'Batch processed, returns acknowledged event IDs' })
  async ingestEvents(
    @Body() input: SyncBatchInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncBatchResponse> {
    return this.syncService.ingestEvents(input, user);
  }

  @Get('events/:employeeProfileId')
  @ApiOperation({ summary: 'Get chronological attendance event history for an employee' })
  @ApiResponse({ status: 200, description: 'Chronological event history' })
  async getEventsForEmployee(
    @Param('employeeProfileId') employeeProfileId: string,
    @Query('limit') limit: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<any[]> {
    return this.syncService.getEventsForEmployee(employeeProfileId, user, limit ? Number(limit) : 100);
  }
}
