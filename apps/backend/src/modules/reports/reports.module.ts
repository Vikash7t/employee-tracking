import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [ReportsService, AuthGuard, RolesGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
