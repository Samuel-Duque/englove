import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '@englove/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RateLimiterService } from '../rate-limiting/rate-limiter.service';
import { consumeAnonymousIpBudgetOnce } from '../rate-limiting/rate-limiter.guard';
import { extractClientIp } from '../utils/identity.utils';

function isUserWithRole(val: unknown): val is { role: Role } {
  if (typeof val !== 'object' || val === null) return false;
  if (!('role' in val)) return false;
  const role = val.role;
  return role === Role.teacher || role === Role.student || role === Role.admin;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly rateLimiterService?: RateLimiterService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const rawUser = typeof request === 'object' && request !== null && 'user' in request ? request.user : undefined;
    const user = isUserWithRole(rawUser) ? rawUser : undefined;

    if (!user || !requiredRoles.includes(user.role)) {
      consumeAnonymousIpBudgetOnce(
        this.rateLimiterService,
        request,
        request && typeof request === 'object' ? extractClientIp(request) : '127.0.0.1',
      );
      throw new ForbiddenException({
        statusCode: 403,
        code: 'AUTH_FORBIDDEN',
        message: 'No tienes acceso a esta sección',
      });
    }

    return true;
  }
}
