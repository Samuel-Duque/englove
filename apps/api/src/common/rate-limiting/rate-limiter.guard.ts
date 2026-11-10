import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RateLimiterService } from './rate-limiter.service';
import { extractClientIp } from '../utils/identity.utils';

function isUserWithId(val: unknown): val is { id: string } {
  return typeof val === 'object' && val !== null && 'id' in val && typeof val.id === 'string';
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(private readonly rateLimiterService: RateLimiterService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path || request.url || '';
    if (path === '/health' || path === '/api/v1/health' || path.endsWith('/health')) {
      return true;
    }

    const user = 'user' in request && isUserWithId(request.user) ? request.user : undefined;
    const ip = extractClientIp(request);

    if (user?.id) {
      // Authenticated limit: 120 / min by validated user (Architecture §8.3, SPEC-02 §4)
      this.rateLimiterService.check(`api:user:${user.id}`, 120, 60 * 1000);
    } else {
      // Anonymous limit: 30 / min by IP
      this.rateLimiterService.check(`api:ip:${ip}`, 30, 60 * 1000);
    }

    return true;
  }
}
