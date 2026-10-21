import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, AgeSegment } from '@englove/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  studentId?: string;
  ageSegment?: AgeSegment;
  sessionId: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    return data ? user?.[data] : user;
  },
);
