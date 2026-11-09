import { Module } from '@nestjs/common';
import { WorksitesController } from './worksites.controller';
import { WorksitesService } from './worksites.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [WorksitesController],
  providers: [WorksitesService, AuthGuard, RolesGuard],
  exports: [WorksitesService],
})
export class WorksitesModule {}
