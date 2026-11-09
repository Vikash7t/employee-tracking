import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationService } from './invitation.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, InvitationService, AuthGuard, RolesGuard],
  exports: [AuthService, InvitationService, AuthGuard, RolesGuard],
})
export class AuthModule {}
