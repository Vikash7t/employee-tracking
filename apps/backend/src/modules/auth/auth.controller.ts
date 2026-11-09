import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  EmployeeLoginInput,
  EmployeeLoginResponse,
  VerifyPinInput,
  AcceptInvitationInput,
  AcceptInvitationResponse,
} from '@employee-tracking/contracts';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/guards/current-user.decorator';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login via employee code and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns session token' })
  async loginEmployee(
    @Body() input: EmployeeLoginInput,
  ): Promise<EmployeeLoginResponse> {
    return this.authService.loginEmployee(input);
  }

  @Post('session/verify-pin')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify mobile quick re-entry PIN on registered device' })
  async verifyPin(
    @Body() input: VerifyPinInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ valid: boolean }> {
    return this.authService.verifyPin(input, user.userId, user.employeeProfileId);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept single-use invitation and set credentials' })
  async acceptInvitation(
    @Body() input: AcceptInvitationInput,
  ): Promise<AcceptInvitationResponse> {
    return this.authService.acceptInvitation(input);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active session token' })
  async logout(@Req() req: any): Promise<{ success: boolean }> {
    return this.authService.logout(req.sessionToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user and tenancy context' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }
}
