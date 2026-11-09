import { Module } from '@nestjs/common';
import { WorksitesController } from './worksites.controller';
import { WorksitesService } from './worksites.service';

@Module({
  controllers: [WorksitesController],
  providers: [WorksitesService],
  exports: [WorksitesService],
})
export class WorksitesModule {}
