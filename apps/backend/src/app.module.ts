import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { WorksitesModule } from './modules/worksites/worksites.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120, // 120 requests per minute
      },
    ]),
    DatabaseModule,
    HealthModule,
    OrganizationsModule,
    WorksitesModule,
    AuthModule,
    EmployeesModule,
    SyncModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
