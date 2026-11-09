import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  AcceptInvitationInput,
  AcceptInvitationResponse,
} from '@employee-tracking/contracts';

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) {}

  async acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResponse> {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

    const invitation = await this.prisma.employeeInvitation.findUnique({
      where: { tokenHash },
      include: { employeeProfile: true },
    });

    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation is invalid, expired, or already used');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);
    const pinHash = input.pin ? await bcrypt.hash(input.pin, saltRounds) : undefined;

    return await this.prisma.$transaction(async (tx) => {
      await tx.employeeInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      let user = await tx.user.findUnique({ where: { email: invitation.email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            fullName: input.fullName || invitation.employeeProfile.fullName,
            passwordHash,
            pinHash,
            isActive: true,
          },
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: user.passwordHash || passwordHash,
            pinHash: pinHash || user.pinHash,
          },
        });
      }

      const membership = await tx.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: 'MEMBER',
        },
      });

      await tx.employeeProfile.update({
        where: { id: invitation.employeeProfileId },
        data: {
          userId: user.id,
          membershipId: membership.id,
          isActive: true,
        },
      });

      return {
        success: true,
        userId: user.id,
        organizationId: invitation.organizationId,
        employeeProfileId: invitation.employeeProfileId,
      };
    });
  }
}
