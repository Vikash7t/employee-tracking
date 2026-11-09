import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MembershipRole } from '@employee-tracking/contracts';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  role: MembershipRole;
  employeeProfileId?: string;
  allowedWorksiteIds: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    return data ? user?.[data] : user;
  },
);
