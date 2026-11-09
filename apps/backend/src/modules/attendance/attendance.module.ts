import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceStateMachineService } from './attendance-state-machine.service';
import { DatabaseModule } from '../../database/database.module';
import { WorksitesModule } from '../worksites/worksites.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [DatabaseModule, WorksitesModule, ShiftsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceStateMachineService, AuthGuard, RolesGuard],
  exports: [AttendanceService, AttendanceStateMachineService],
})
export class AttendanceModule {}
