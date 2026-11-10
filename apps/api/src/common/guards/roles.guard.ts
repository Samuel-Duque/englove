import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@englove/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

function isUserWithRole(val: unknown): val is { role: Role } {
  if (typeof val !== 'object' || val === null) return false;
  if (!('role' in val)) return false;
  const role = val.role;
  return role === Role.teacher || role === Role.student || role === Role.admin;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const rawUser = typeof request === 'object' && request !== null && 'user' in request ? request.user : undefined;
    const user = isUserWithRole(rawUser) ? rawUser : undefined;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'AUTH_FORBIDDEN',
        message: 'No tienes acceso a esta sección',
      });
    }

    return true;
  }
}
