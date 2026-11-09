import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { WorksitesModule } from './modules/worksites/worksites.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    OrganizationsModule,
    WorksitesModule,
    AuthModule,
    EmployeesModule,
  ],
})
export class AppModule {}
