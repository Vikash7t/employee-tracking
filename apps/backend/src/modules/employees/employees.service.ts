import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  ProvisionEmployeeInput,
  ProvisionEmployeeResponse,
  EmployeeProfileDto,
} from '@employee-tracking/contracts';
import { AuthenticatedUser } from '../../common/guards/current-user.decorator';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async provisionEmployee(
    input: ProvisionEmployeeInput,
    authUser: AuthenticatedUser,
  ): Promise<ProvisionEmployeeResponse> {
    // 1. Enforce tenant isolation
    if (input.organizationId !== authUser.organizationId) {
      throw new ForbiddenException('Cannot provision employees in a different organization');
    }

    // 2. Enforce role & manager scoping
    if (authUser.role === 'MEMBER') {
      throw new ForbiddenException('Employees with role MEMBER cannot provision staff');
    }

    if (authUser.role === 'MANAGER') {
      if (!input.primaryWorksiteId) {
        throw new BadRequestException('Managers must assign a primary worksite when provisioning');
      }
      if (!authUser.allowedWorksiteIds.includes(input.primaryWorksiteId)) {
        throw new ForbiddenException(
          'Managers can only provision employees for their explicitly assigned worksites',
        );
      }
    }

    // 3. Check employee code uniqueness in organization
    const existingCode = await this.prisma.employeeProfile.findUnique({
      where: {
        organizationId_employeeCode: {
          organizationId: input.organizationId,
          employeeCode: input.employeeCode,
        },
      },
    });

    if (existingCode) {
      throw new ConflictException(
        `Employee code "${input.employeeCode}" already exists in this organization`,
      );
    }

    // 4. Generate cryptographically secure invitation token
    const rawInvitationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawInvitationToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    const result = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.employeeProfile.create({
        data: {
          organizationId: input.organizationId,
          employeeCode: input.employeeCode,
          fullName: input.fullName,
          department: input.department,
          primaryWorksiteId: input.primaryWorksiteId,
          isActive: true,
        },
      });

      await tx.employeeInvitation.create({
        data: {
          organizationId: input.organizationId,
          employeeProfileId: profile.id,
          email: input.email,
          tokenHash,
          expiresAt,
          createdByUserId: authUser.userId,
        },
      });

      return profile;
    });

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const invitationUrl = `${appBaseUrl}/activate?token=${rawInvitationToken}`;

    return {
      employeeProfile: {
        id: result.id,
        organizationId: result.organizationId,
        userId: result.userId,
        membershipId: result.membershipId,
        employeeCode: result.employeeCode,
        fullName: result.fullName,
        department: result.department,
        primaryWorksiteId: result.primaryWorksiteId,
        isActive: result.isActive,
        isLockedOut: false,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
      invitationToken: rawInvitationToken,
      invitationUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async listEmployees(
    organizationId: string,
    authUser: AuthenticatedUser,
  ): Promise<EmployeeProfileDto[]> {
    if (organizationId !== authUser.organizationId) {
      throw new ForbiddenException('Cross-tenant data access is strictly forbidden');
    }

    const whereClause: any = {
      organizationId,
      isActive: true,
    };

    if (authUser.role === 'MANAGER') {
      whereClause.primaryWorksiteId = { in: authUser.allowedWorksiteIds };
    } else if (authUser.role === 'MEMBER') {
      whereClause.id = authUser.employeeProfileId;
    }

    const profiles = await this.prisma.employeeProfile.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return profiles.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      userId: p.userId,
      membershipId: p.membershipId,
      employeeCode: p.employeeCode,
      fullName: p.fullName,
      department: p.department,
      primaryWorksiteId: p.primaryWorksiteId,
      isActive: p.isActive,
      isLockedOut: Boolean(p.lockoutUntil && p.lockoutUntil > new Date()),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async getEmployeeById(
    id: string,
    authUser: AuthenticatedUser,
  ): Promise<EmployeeProfileDto> {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException('Employee profile not found');
    }

    if (profile.organizationId !== authUser.organizationId) {
      throw new ForbiddenException('Cross-tenant data access is strictly forbidden');
    }

    if (authUser.role === 'MEMBER' && profile.id !== authUser.employeeProfileId) {
      throw new ForbiddenException('Employees can only inspect their own profile');
    }

    if (
      authUser.role === 'MANAGER' &&
      (!profile.primaryWorksiteId ||
        !authUser.allowedWorksiteIds.includes(profile.primaryWorksiteId))
    ) {
      throw new ForbiddenException('Managers can only inspect employees at their assigned worksites');
    }

    return {
      id: profile.id,
      organizationId: profile.organizationId,
      userId: profile.userId,
      membershipId: profile.membershipId,
      employeeCode: profile.employeeCode,
      fullName: profile.fullName,
      department: profile.department,
      primaryWorksiteId: profile.primaryWorksiteId,
      isActive: profile.isActive,
      isLockedOut: Boolean(profile.lockoutUntil && profile.lockoutUntil > new Date()),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
