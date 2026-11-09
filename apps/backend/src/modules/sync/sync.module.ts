import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { DatabaseModule } from '../../database/database.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [DatabaseModule, AttendanceModule],
  controllers: [SyncController],
  providers: [SyncService, AuthGuard, RolesGuard],
  exports: [SyncService],
})
export class SyncModule {}
