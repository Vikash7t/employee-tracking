import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SpatialService } from './spatial.service';

@Global()
@Module({
  providers: [PrismaService, SpatialService],
  exports: [PrismaService, SpatialService],
})
export class DatabaseModule {}
