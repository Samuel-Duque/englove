import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { RateLimiterService } from './rate-limiter.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { extractClientIp } from '../utils/identity.utils';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(private readonly rateLimiterService: RateLimiterService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as unknown as { user?: AuthenticatedUser }).user;
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
