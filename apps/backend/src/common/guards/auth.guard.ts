import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from './current-user.decorator';
import { MembershipRole } from '@employee-tracking/contracts';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedException('Empty bearer token provided');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        organization: true,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }

    if (!session.user.isActive || !session.organization.isActive) {
      throw new UnauthorizedException('User account or organization is inactive');
    }

    // Resolve membership and manager scopes
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: session.activeOrganizationId,
          userId: session.userId,
        },
      },
      include: {
        worksiteScopes: true,
        employeeProfile: true,
      },
    });

    if (!membership || !membership.isActive) {
      throw new UnauthorizedException('Membership not found or inactive for this organization');
    }

    const allowedWorksiteIds =
      membership.role === 'MANAGER'
        ? membership.worksiteScopes.map((scope) => scope.worksiteId)
        : [];

    const authenticatedUser: AuthenticatedUser = {
      userId: session.userId,
      organizationId: session.activeOrganizationId,
      role: membership.role as MembershipRole,
      employeeProfileId: membership.employeeProfile?.id,
      allowedWorksiteIds,
    };

    request.user = authenticatedUser;
    request.sessionToken = token;

    return true;
  }
}
