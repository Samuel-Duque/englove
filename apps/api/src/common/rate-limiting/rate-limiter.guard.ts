import { Injectable, CanActivate, ExecutionContext, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RateLimiterService } from './rate-limiter.service';
import { extractClientIp } from '../utils/identity.utils';

function isUserWithId(val: unknown): val is { id: string } {
  return typeof val === 'object' && val !== null && 'id' in val && typeof val.id === 'string';
}

const anonymousBudgetChecked = new WeakSet<object>();

export function consumeAnonymousIpBudgetOnce(
  rateLimiterService: RateLimiterService | undefined,
  request: Request | undefined,
  ip: string,
): void {
  if (!rateLimiterService) {
    return;
  }
  if (request && typeof request === 'object') {
    if (anonymousBudgetChecked.has(request)) {
      return;
    }
    anonymousBudgetChecked.add(request);
  }
  rateLimiterService.check(`api:ip:${ip}`, 30, 60 * 1000);
}

function isHealthPath(request: Request): boolean {
  const rawPath = (request.path || request.url || '').split('?')[0] ?? '';
  const normalizedPath = rawPath.replace(/\/+$/, '');
  return normalizedPath === '/health' || normalizedPath === '/api/v1/health';
}

function hasAccessCredential(request: Request, cookiePrefix: string): boolean {
  const cookieName = `${cookiePrefix}access_token`;
  const fromCookie = request.cookies?.[cookieName];
  if (typeof fromCookie === 'string' && fromCookie.trim().length > 0) {
    return true;
  }
  const authHeader = request.headers?.authorization;
  return typeof authHeader === 'string' && authHeader.startsWith('Bearer ') && authHeader.length > 7;
}

@Injectable()
export class PreAuthRateLimiterGuard implements CanActivate {
  private readonly cookiePrefix: string;

  constructor(
    private readonly rateLimiterService: RateLimiterService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.cookiePrefix = this.configService?.get<string>('COOKIE_PREFIX', 'englove_') ?? 'englove_';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (isHealthPath(request)) {
      return true;
    }

    const ip = extractClientIp(request);

    // Límite grueso por IP antes de OriginGuard / JwtAuthGuard / RolesGuard (RT-06)
    this.rateLimiterService.check(`api:ip:coarse:${ip}`, 600, 60 * 1000);

    // Tráfico sin credencial de acceso consume de inmediato el presupuesto anónimo de 30/min por IP
    if (!hasAccessCredential(request, this.cookiePrefix)) {
      consumeAnonymousIpBudgetOnce(this.rateLimiterService, request, ip);
    }

    return true;
  }
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(private readonly rateLimiterService: RateLimiterService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (isHealthPath(request)) {
      return true;
    }

    const user = 'user' in request && isUserWithId(request.user) ? request.user : undefined;
    const ip = extractClientIp(request);

    if (user?.id) {
      // Authenticated limit: 120 / min by validated user (Architecture §8.3, SPEC-02 §4)
      this.rateLimiterService.check(`api:user:${user.id}`, 120, 60 * 1000);
    } else {
      // Anonymous limit: 30 / min by IP (deduplicated if already checked in PreAuthRateLimiterGuard)
      consumeAnonymousIpBudgetOnce(this.rateLimiterService, request, ip);
    }

    return true;
  }
}
