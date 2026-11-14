import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RateLimiterService } from '../rate-limiting/rate-limiter.service';
import { consumeAnonymousIpBudgetOnce } from '../rate-limiting/rate-limiter.guard';
import { extractClientIp } from '../utils/identity.utils';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly rateLimiterService?: RateLimiterService,
  ) {
    const webBaseUrl = this.configService.get<string>('WEB_BASE_URL', 'http://localhost:3000');
    this.allowedOrigins = [webBaseUrl.replace(/\/$/, '')];
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method?.toUpperCase();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    const origin = request.headers.origin;
    if (!origin) {
      consumeAnonymousIpBudgetOnce(this.rateLimiterService, request, extractClientIp(request));
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Origen no permitido',
      });
    }

    const normalizedOrigin = (Array.isArray(origin) ? origin[0] : origin).replace(/\/$/, '');
    if (!this.allowedOrigins.includes(normalizedOrigin)) {
      consumeAnonymousIpBudgetOnce(this.rateLimiterService, request, extractClientIp(request));
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Origen no permitido',
      });
    }

    return true;
  }
}
