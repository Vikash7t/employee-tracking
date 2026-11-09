import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { InvitationService } from './invitation.service';
import {
  EmployeeLoginInput,
  EmployeeLoginResponse,
  VerifyPinInput,
  AcceptInvitationInput,
  AcceptInvitationResponse,
  MembershipRole,
} from '@employee-tracking/contracts';
import { AuthenticatedUser } from '../../common/guards/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationService: InvitationService,
  ) {}

  async loginEmployee(input: EmployeeLoginInput): Promise<EmployeeLoginResponse> {
    const org = await this.prisma.organization.findUnique({
      where: { slug: input.organizationSlug },
    });
    if (!org || !org.isActive) {
      throw new UnauthorizedException('Organization not found or inactive');
    }

    const profile = await this.prisma.employeeProfile.findUnique({
      where: {
        organizationId_employeeCode: {
          organizationId: org.id,
          employeeCode: input.employeeCode,
        },
      },
      include: {
        user: true,
        membership: true,
      },
    });

    if (!profile || !profile.isActive) {
      throw new UnauthorizedException('Employee profile not found or inactive');
    }

    // Scoped brute-force lockout check on this specific employee profile
    if (profile.lockoutUntil && profile.lockoutUntil > new Date()) {
      const remainingSecs = Math.ceil(
        (profile.lockoutUntil.getTime() - Date.now()) / 1000,
      );
      throw new HttpException(
        `Account is temporarily locked due to too many failed attempts. Try again in ${remainingSecs} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!profile.userId || !profile.user) {
      throw new UnauthorizedException('Employee account has not been activated yet');
    }

    const isPasswordValid = profile.user.passwordHash
      ? await bcrypt.compare(input.password, profile.user.passwordHash)
      : false;

    if (!isPasswordValid) {
      const failedAttempts = profile.failedAttempts + 1;
      const lockoutUntil =
        failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.prisma.employeeProfile.update({
        where: { id: profile.id },
        data: { failedAttempts, lockoutUntil },
      });

      if (failedAttempts >= 5) {
        throw new HttpException(
          'Account is now locked for 15 minutes due to 5 consecutive failed attempts.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException(
        `Invalid employee credentials. ${5 - failedAttempts} attempt(s) remaining.`,
      );
    }

    // Reset failed attempts on successful login
    if (profile.failedAttempts > 0 || profile.lockoutUntil) {
      await this.prisma.employeeProfile.update({
        where: { id: profile.id },
        data: { failedAttempts: 0, lockoutUntil: null },
      });
    }

    // Device binding & cryptographic secret generation
    let deviceBindingDto;
    let deviceSecret: string | undefined;

    if (input.deviceId) {
      const existingDevice = await this.prisma.deviceBinding.findUnique({
        where: {
          employeeProfileId_deviceId: {
            employeeProfileId: profile.id,
            deviceId: input.deviceId,
          },
        },
      });

      if (!existingDevice) {
        deviceSecret = crypto.randomBytes(32).toString('hex');
        const deviceSecretHash = crypto
          .createHash('sha256')
          .update(deviceSecret)
          .digest('hex');

        const newDevice = await this.prisma.deviceBinding.create({
          data: {
            employeeProfileId: profile.id,
            deviceId: input.deviceId,
            deviceSecretHash,
            deviceModel: input.deviceModel,
            osVersion: input.osVersion,
            isTrusted: true,
          },
        });

        deviceBindingDto = {
          id: newDevice.id,
          employeeProfileId: newDevice.employeeProfileId,
          deviceId: newDevice.deviceId,
          deviceModel: newDevice.deviceModel,
          osVersion: newDevice.osVersion,
          isTrusted: newDevice.isTrusted,
          registeredAt: newDevice.registeredAt.toISOString(),
          lastSeenAt: newDevice.lastSeenAt.toISOString(),
        };
      } else {
        const updated = await this.prisma.deviceBinding.update({
          where: { id: existingDevice.id },
          data: { lastSeenAt: new Date() },
        });
        deviceBindingDto = {
          id: updated.id,
          employeeProfileId: updated.employeeProfileId,
          deviceId: updated.deviceId,
          deviceModel: updated.deviceModel,
          osVersion: updated.osVersion,
          isTrusted: updated.isTrusted,
          registeredAt: updated.registeredAt.toISOString(),
          lastSeenAt: updated.lastSeenAt.toISOString(),
        };
      }
    }

    // Generate stateful session
    const rawToken = 'et_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prisma.session.create({
      data: {
        userId: profile.userId,
        activeOrganizationId: org.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token: rawToken,
      user: {
        id: profile.user.id,
        email: profile.user.email,
        fullName: profile.user.fullName,
        isActive: profile.user.isActive,
        createdAt: profile.user.createdAt.toISOString(),
      },
      organization: { ...org, createdAt: org.createdAt.toISOString(), updatedAt: org.updatedAt.toISOString() },
      membership: {
        id: profile.membership?.id || '',
        organizationId: org.id,
        userId: profile.userId,
        role: (profile.membership?.role as MembershipRole) || 'MEMBER',
        isActive: profile.membership?.isActive ?? true,
        createdAt: profile.membership?.createdAt.toISOString() || '',
      },
      employeeProfile: {
        ...profile,
        isLockedOut: false,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
      deviceBinding: deviceBindingDto,
      deviceSecret,
    };
  }

  async verifyPin(
    input: VerifyPinInput,
    userId: string,
    employeeProfileId?: string,
  ): Promise<{ valid: boolean }> {
    if (!employeeProfileId) {
      throw new BadRequestException('User does not have an active employee profile');
    }

    const device = await this.prisma.deviceBinding.findUnique({
      where: {
        employeeProfileId_deviceId: {
          employeeProfileId,
          deviceId: input.deviceId,
        },
      },
    });

    if (!device || !device.isTrusted) {
      throw new UnauthorizedException('Device is not registered or untrusted');
    }

    const secretHash = crypto
      .createHash('sha256')
      .update(input.deviceSecret)
      .digest('hex');

    if (secretHash !== device.deviceSecretHash) {
      throw new UnauthorizedException('Invalid device cryptographic secret');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.pinHash) {
      throw new BadRequestException('No PIN configured for this account');
    }

    const isPinValid = await bcrypt.compare(input.pin, user.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Incorrect PIN');
    }

    await this.prisma.deviceBinding.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    return { valid: true };
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResponse> {
    return this.invitationService.acceptInvitation(input);
  }

  async logout(token: string): Promise<{ success: boolean }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.prisma.session.deleteMany({ where: { tokenHash } });
    return { success: true };
  }

  async getMe(authUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, email: true, fullName: true, isActive: true, createdAt: true },
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: authUser.organizationId },
    });

    let employeeProfile = null;
    if (authUser.employeeProfileId) {
      employeeProfile = await this.prisma.employeeProfile.findUnique({
        where: { id: authUser.employeeProfileId },
      });
    }

    return {
      user,
      organization: org,
      role: authUser.role,
      allowedWorksiteIds: authUser.allowedWorksiteIds,
      employeeProfile,
    };
  }
}
