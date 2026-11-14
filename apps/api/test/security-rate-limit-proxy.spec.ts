import 'reflect-metadata';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { type CanActivate } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { Role } from '@englove/shared';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { OriginGuard } from '../src/common/guards/origin.guard';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import {
  PreAuthRateLimiterGuard,
  RateLimiterGuard,
} from '../src/common/rate-limiting/rate-limiter.guard';
import { RateLimiterService } from '../src/common/rate-limiting/rate-limiter.service';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';
import {
  extractClientIp,
  resolveTrustProxySetting,
} from '../src/common/utils/identity.utils';
import { PrismaService } from '../src/prisma/prisma.service';

function runGuardPipeline(
  app: express.Express,
  guards: CanActivate[],
  handlerMetadata: Map<string, { isPublic?: boolean; roles?: Role[] }>,
): void {
  const filter = new AllExceptionsFilter();

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const meta = handlerMetadata.get(`${req.method.toUpperCase()} ${req.path}`) ?? {};
    const handlerFn = () => undefined;
    if (meta.isPublic) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, true, handlerFn);
    }
    if (meta.roles) {
      Reflect.defineMetadata(ROLES_KEY, meta.roles, handlerFn);
    }

    class DummyController {}
    const ctx = new ExecutionContextHost([req, res, next], DummyController, handlerFn);
    ctx.setType('http');

    try {
      for (const guard of guards) {
        await guard.canActivate(ctx);
      }
      next();
    } catch (err) {
      filter.catch(err, ctx);
    }
  });
}

describe('RT-05 & RT-06: Trust Proxy anti-spoofing y Rate Limit pre-autenticación', () => {
  const jwtSecret = 'test-secret-for-rt05-rt06-at-least-32-chars!';
  const orgId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const sessionId = '33333333-3333-4333-8333-333333333333';

  it('RT-06: AppModule registra PreAuthRateLimiterGuard antes que OriginGuard, JwtAuthGuard y RolesGuard', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as Array<{
      provide?: unknown;
      useClass?: unknown;
    }>;
    const guardClasses = providers
      .filter((p) => p && typeof p === 'object' && p.provide === APP_GUARD)
      .map((p) => p.useClass);

    expect(guardClasses).toEqual([
      PreAuthRateLimiterGuard,
      OriginGuard,
      JwtAuthGuard,
      RolesGuard,
      RateLimiterGuard,
    ]);
  });

  it('RT-05: en entorno local directo ignora X-Forwarded-For rotado y aplica límite real por IP', async () => {
    const rateLimiter = new RateLimiterService();
    const filter = new AllExceptionsFilter();
    const app = express();
    app.set('trust proxy', resolveTrustProxySetting('local', undefined));

    app.post('/api/v1/auth/login', (req, res, next) => {
      try {
        const ip = extractClientIp(req);
        rateLimiter.check(`auth:login:ip:${ip}`, 10, 15 * 60 * 1000);
        res.status(200).json({ ip });
      } catch (err) {
        const host = new ExecutionContextHost([req, res, next]);
        host.setType('http');
        filter.catch(err, host);
      }
    });

    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('No se pudo obtener el puerto de prueba');
      }
      const baseUrl = `http://127.0.0.1:${address.port}`;

      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'X-Forwarded-For': `203.0.113.${i}` },
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ip: string };
        expect(body.ip).not.toBe(`203.0.113.${i}`);
      }

      const blocked = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': '203.0.113.250' },
      });
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('retry-after')).toBeTruthy();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      rateLimiter.onModuleDestroy();
    }
  });

  it('RT-05: resolveTrustProxySetting deshabilita proxy en local y limita a saltos privados en staging/production', () => {
    expect(resolveTrustProxySetting('local', undefined)).toBe(false);
    expect(resolveTrustProxySetting('local', 'false')).toBe(false);
    expect(resolveTrustProxySetting('staging', undefined)).toBe('loopback, linklocal, uniquelocal');
    expect(resolveTrustProxySetting('production', undefined)).toBe('loopback, linklocal, uniquelocal');
    expect(resolveTrustProxySetting('staging', '1')).toBe(1);
  });

  it('RT-06: 35 GET anónimos y tokens inválidos consumen el cupo global de 30/min por IP y devuelven 429 RATE_LIMITED', async () => {
    const rateLimiter = new RateLimiterService();
    const jwtService = new JwtService({ secret: jwtSecret });
    const mockConfig = new ConfigService({
      APP_ENV: 'local',
      WEB_BASE_URL: 'http://localhost:3000',
      COOKIE_PREFIX: 'englove_',
      JWT_SECRET: jwtSecret,
    });
    const mockPrisma = {
      authSession: {
        findFirst: async () => ({
          id: sessionId,
          user_id: userId,
          organization_id: orgId,
          revoked_at: null,
          expires_at: new Date(Date.now() + 60_000),
          user: { id: userId, email: 'fresh-db@test.edu', locked_until: null },
        }),
      },
      student: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService;

    const reflector = new Reflector();
    const guards: CanActivate[] = [
      new PreAuthRateLimiterGuard(rateLimiter, mockConfig),
      new OriginGuard(mockConfig, rateLimiter),
      new JwtAuthGuard(reflector, jwtService, mockConfig, mockPrisma, rateLimiter),
      new RolesGuard(reflector, rateLimiter),
      new RateLimiterGuard(rateLimiter),
    ];

    const app = express();
    app.set('trust proxy', false);
    app.use(cookieParser());
    runGuardPipeline(
      app,
      guards,
      new Map([
        ['GET /api/v1/me', {}],
        ['GET /api/v1/activities/health', {}],
        ['GET /api/v1/teacher-only', { roles: [Role.teacher] }],
        ['POST /api/v1/auth/login', { isPublic: true }],
      ]),
    );
    app.get('/api/v1/me', (req, res) =>
      res.status(200).json({ ok: true, user: Reflect.get(req, 'user') }),
    );
    app.get('/api/v1/activities/health', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/v1/teacher-only', (_req, res) => res.status(200).json({ ok: true }));
    app.post('/api/v1/auth/login', (_req, res) => res.status(200).json({ ok: true }));

    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('No se pudo obtener el puerto de prueba');
      }
      const baseUrl = `http://127.0.0.1:${address.port}`;

      // 1) Un usuario autenticado válido tiene cupo de 120/min y no se limita a 30/min,
      //    y JwtAuthGuard hidrata email desde DB aunque el JWT porte un correo anterior (RT-08)
      const validToken = jwtService.sign({
        sub: userId,
        email: 'stale-jwt@test.edu',
        role: Role.teacher,
        org: orgId,
        sid: sessionId,
        typ: 'access',
      });

      for (let i = 0; i < 35; i++) {
        const res = await fetch(`${baseUrl}/api/v1/me`, {
          headers: { Authorization: `Bearer ${validToken}` },
        });
        expect(res.status).toBe(200);
        if (i === 0) {
          const body: unknown = await res.json();
          const userObj =
            typeof body === 'object' && body !== null ? Reflect.get(body, 'user') : undefined;
          const userEmail =
            typeof userObj === 'object' && userObj !== null
              ? Reflect.get(userObj, 'email')
              : undefined;
          expect(userEmail).toBe('fresh-db@test.edu');
        }
      }

      // 2) 35 GET anónimos (401): primeros 30 => 401, siguientes 5 => 429 RATE_LIMITED
      const statusesAnon: number[] = [];
      for (let i = 0; i < 35; i++) {
        const res = await fetch(`${baseUrl}/api/v1/me`);
        statusesAnon.push(res.status);
        if (res.status === 429) {
          expect(res.headers.get('retry-after')).toBeTruthy();
        }
      }
      expect(statusesAnon.slice(0, 30).every((s) => s === 401)).toBe(true);
      expect(statusesAnon.slice(30).every((s) => s === 429)).toBe(true);

      // 3) Tokens inválidos (401 tras verify) también consumen el cupo anónimo y cortan en 31 con 429
      rateLimiter.reset();
      const statusesInvalidJwt: number[] = [];
      for (let i = 0; i < 35; i++) {
        const res = await fetch(`${baseUrl}/api/v1/me`, {
          headers: { Authorization: 'Bearer invalid.jwt.token' },
        });
        statusesInvalidJwt.push(res.status);
      }
      expect(statusesInvalidJwt.slice(0, 30).every((s) => s === 401)).toBe(true);
      expect(statusesInvalidJwt.slice(30).every((s) => s === 429)).toBe(true);

      // 4) Ruta @Public() no sufre doble conteo (permite exactamente 30 peticiones anónimas, no 15)
      rateLimiter.reset();
      const publicStatuses: number[] = [];
      for (let i = 0; i < 32; i++) {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { Origin: 'http://localhost:3000' },
        });
        publicStatuses.push(res.status);
      }
      expect(publicStatuses.slice(0, 30).every((s) => s === 200)).toBe(true);
      expect(publicStatuses.slice(30).every((s) => s === 429)).toBe(true);

      // 5) Ruta que termina en /health pero no es /health ni /api/v1/health NO omite el rate limiter (RT-06)
      rateLimiter.reset();
      const nonHealthStatuses: number[] = [];
      for (let i = 0; i < 32; i++) {
        const res = await fetch(`${baseUrl}/api/v1/activities/health`);
        nonHealthStatuses.push(res.status);
      }
      expect(nonHealthStatuses.slice(0, 30).every((s) => s === 401)).toBe(true);
      expect(nonHealthStatuses.slice(30).every((s) => s === 429)).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      rateLimiter.onModuleDestroy();
    }
  });
});
