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

export function isAuthenticatedUser(val: unknown): val is AuthenticatedUser {
  return (
    typeof val === 'object' &&
    val !== null &&
    'id' in val &&
    typeof val.id === 'string' &&
    'organizationId' in val &&
    typeof val.organizationId === 'string' &&
    'role' in val &&
    typeof val.role === 'string'
  );
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const rawUser = typeof request === 'object' && request !== null && 'user' in request ? request.user : undefined;
    const user = isAuthenticatedUser(rawUser) ? rawUser : undefined;
    return data ? user?.[data] : user;
  },
);
