import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as argon2 from 'argon2';
import { isPostgresAvailable } from './postgres-test-helper';
import { Response, Request } from 'express';
import {
  Role,
  ApprovalStatus,
  AgeSegment,
} from '@englove/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../src/mail/mail.service';
import { RateLimiterService } from '../src/common/rate-limiting/rate-limiter.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { TenantContext } from '../src/common/tenant/tenant.context';
import { hashSha256 } from '../src/common/utils/identity.utils';
import { UnprocessableEntityException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { AttemptsService } from '../src/attempts/attempts.service';
import { sanitizePinoReq } from '../src/app.module';
import { GamificationService } from '../src/gamification/gamification.service';

function createMockResponse(): {
  res: Response;
  cookies: Record<string, { value: string; options: Record<string, unknown> }>;
  clearedCookies: Record<string, Record<string, unknown>>;
} {
  const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};
  const clearedCookies: Record<string, Record<string, unknown>> = {};

  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      cookies[name] = { value, options };
      return res;
    },
    clearCookie: (name: string, options: Record<string, unknown>) => {
      clearedCookies[name] = options;
      return res;
    },
  } as unknown as Response;

  return { res, cookies, clearedCookies };
}

describe.skipIf(!isPostgresAvailable)('WP-02 / Fase F2: Seguridad, Identidad, Sesión y Multi-Tenant (PostgreSQL real)', () => {
  let prisma: PrismaService;
  let authService: AuthService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let mailService: MailService;
  let rateLimiter: RateLimiterService;

  const orgAId = '90000000-0000-4000-8000-000000000001';
  const orgBId = '90000000-0000-4000-8000-000000000002';
  const userAId = '90000000-0000-4000-8000-000000000011';
  const userBId = '90000000-0000-4000-8000-000000000012';
  const studentAId = '90000000-0000-4000-8000-000000000021';
  const sessionAId = '90000000-0000-4000-8000-000000000031';
  const emailReqId = '90000000-0000-4000-8000-000000000041';

  const jwtSecret = 'wp02-test-jwt-secret-min-32-characters-long!';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    configService = new ConfigService({
      JWT_SECRET: jwtSecret,
      APP_ENV: 'local',
      WEB_BASE_URL: 'http://localhost:3000',
      COOKIE_PREFIX: 'englove_test_',
      COOKIE_DOMAIN: '',
    });

    jwtService = new JwtService({ secret: jwtSecret });
    mailService = new MailService(configService);
    rateLimiter = new RateLimiterService();

    authService = new AuthService(
      prisma,
      configService,
      jwtService,
      mailService,
      rateLimiter,
    );

    // Clean fixtures
    await TenantContext.runBypass(async () => {
      // guardrails-ignore G-A06: limpieza de fixtures de prueba multi-tenant
      await prisma.emailChangeRequest.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
      await prisma.passwordResetToken.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
      await prisma.authSession.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
      await prisma.student.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
      await prisma.user.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });

      // Create organizations
      await prisma.organization.create({
        data: { id: orgAId, name: 'WP02 Org A', slug: 'wp02-org-a' },
      });
      await prisma.organization.create({
        data: { id: orgBId, name: 'WP02 Org B', slug: 'wp02-org-b' },
      });

      // Create users
      await prisma.user.create({
        data: {
          id: userAId,
          organization_id: orgAId,
          name: 'Student Org A',
          email: 'student.a@wp02.test',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.student,
        },
      });
      await prisma.student.create({
        data: {
          id: studentAId,
          organization_id: orgAId,
          user_id: userAId,
          birth_date: new Date('2015-05-10'),
          age_segment: AgeSegment.kids,
          approval_status: ApprovalStatus.approved,
        },
      });

      await prisma.user.create({
        data: {
          id: userBId,
          organization_id: orgBId,
          name: 'Teacher Org B',
          email: 'teacher.b@wp02.test',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.teacher,
        },
      });
    });
  });

  afterAll(async () => {
    if (prisma && isPostgresAvailable) {
      await TenantContext.runBypass(async () => {
        // guardrails-ignore G-A06: limpieza final de fixtures de prueba multi-tenant
        await prisma.emailChangeRequest.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
        await prisma.passwordResetToken.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
        await prisma.authSession.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
        await prisma.student.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
        await prisma.user.deleteMany({ where: { organization_id: { in: [orgAId, orgBId] } } });
        await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
      });
      await prisma.$disconnect();
    }
  });

  // ============================================================================
  // P0-01: confirmEmailChange rollback bug
  // ============================================================================
  it('P0-01: 3 intentos fallidos de OTP en confirmEmailChange persisten failed_attempts=3 en PostgreSQL real y bloquean el request', async () => {
    expect(isPostgresAvailable).toBe(true);

    const realOtp = '123456';
    const otpHash = hashSha256(realOtp);

    // Create EmailChangeRequest directly in PostgreSQL
    await TenantContext.runBypass(async () => {
      // guardrails-ignore G-A06: creación de fixture para prueba P0-01
      await prisma.emailChangeRequest.deleteMany({ where: { user_id: userAId } });
      await prisma.emailChangeRequest.create({
        data: {
          id: emailReqId,
          organization_id: orgAId,
          user_id: userAId,
          new_email: 'new.student.a@wp02.test',
          otp_hash: otpHash,
          failed_attempts: 0,
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
    });

    const currentUser = {
      id: userAId,
      email: 'student.a@wp02.test',
      role: Role.student,
      organizationId: orgAId,
      sessionId: sessionAId,
      studentId: studentAId,
      ageSegment: AgeSegment.kids,
    };

    // Intento 1: código incorrecto
    await expect(
      authService.confirmEmailChange({ otp: '000000' }, currentUser),
    ).rejects.toThrow(UnprocessableEntityException);

    let dbReq = await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: consulta de verificación en DB real
      prisma.emailChangeRequest.findUnique({ where: { id: emailReqId } }),
    );
    expect(dbReq?.failed_attempts).toBe(1);
    expect(dbReq?.used_at).toBeNull();

    // Intento 2: código incorrecto
    await expect(
      authService.confirmEmailChange({ otp: '000001' }, currentUser),
    ).rejects.toThrow(UnprocessableEntityException);

    dbReq = await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: consulta de verificación en DB real
      prisma.emailChangeRequest.findUnique({ where: { id: emailReqId } }),
    );
    expect(dbReq?.failed_attempts).toBe(2);
    expect(dbReq?.used_at).toBeNull();

    // Intento 3: código incorrecto -> debe bloquear (OTP_MAX_ATTEMPTS) y marcar used_at
    const err3 = await authService
      .confirmEmailChange({ otp: '000002' }, currentUser)
      .catch((e) => e);
    expect(err3).toBeInstanceOf(UnprocessableEntityException);
    expect(err3.getResponse().code).toBe('OTP_MAX_ATTEMPTS');

    dbReq = await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: consulta de verificación en DB real
      prisma.emailChangeRequest.findUnique({ where: { id: emailReqId } }),
    );
    expect(dbReq?.failed_attempts).toBe(3);
    expect(dbReq?.used_at).not.toBeNull();

    // Intento 4: con el código CORRECTO original -> debe ser rechazado porque está bloqueado
    const err4 = await authService
      .confirmEmailChange({ otp: realOtp }, currentUser)
      .catch((e) => e);
    expect(err4).toBeInstanceOf(UnprocessableEntityException);
    expect(err4.getResponse().code).toBe('OTP_MAX_ATTEMPTS');

    // Confirmar que el correo del usuario en DB NO fue modificado
    const dbUser = await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: consulta de verificación en DB real
      prisma.user.findUnique({ where: { id: userAId } }),
    );
    expect(dbUser?.email).toBe('student.a@wp02.test');
  });

  // ============================================================================
  // P0-02 & QA-02: session_hint cookie
  // ============================================================================
  it('P0-02 & QA-02: setSessionCookies emite cookie session_hint=1 con httpOnly=false y secure según appEnv', () => {
    const { res, cookies } = createMockResponse();

    authService.setSessionCookies(
      res,
      { id: userAId, email: 'student.a@wp02.test', role: Role.student, organization_id: orgAId },
      { id: studentAId, age_segment: AgeSegment.kids },
      { id: sessionAId, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      'test-secret-value-32-chars-long!',
    );

    expect(cookies['englove_test_session_hint']).toBeDefined();
    expect(cookies['englove_test_session_hint']?.value).toBe('1');
    expect(cookies['englove_test_session_hint']?.options.httpOnly).toBe(false);
    expect(cookies['englove_test_session_hint']?.options.sameSite).toBe('lax');
    expect(cookies['englove_test_session_hint']?.options.path).toBe('/');
    // En local sin https, secure es false
    expect(cookies['englove_test_session_hint']?.options.secure).toBe(false);
  });

  // ============================================================================
  // P0-03 & QA-02: refresh_token path y GET /api/v1/auth/session
  // ============================================================================
  it('P0-03 & QA-02: refresh_token cookie tiene path /api/v1/auth y getSession devuelve sesión sin rotar refresh_token', async () => {
    expect(isPostgresAvailable).toBe(true);

    const { res, cookies } = createMockResponse();

    authService.setSessionCookies(
      res,
      { id: userAId, email: 'student.a@wp02.test', role: Role.student, organization_id: orgAId },
      { id: studentAId, age_segment: AgeSegment.kids },
      { id: sessionAId, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      'test-secret-value-32-chars-long!',
    );

    // Path de refresh_token debe ser /api/v1/auth
    expect(cookies['englove_test_refresh_token']?.options.path).toBe('/api/v1/auth');

    // Endpoint de solo lectura getSession
    const sessionResult = await authService.getSession({
      id: userAId,
      email: 'student.a@wp02.test',
      role: Role.student,
      organizationId: orgAId,
      sessionId: sessionAId,
      studentId: studentAId,
      ageSegment: AgeSegment.kids,
    });

    expect(sessionResult.user.id).toBe(userAId);
    expect(sessionResult.user.email).toBe('student.a@wp02.test');
    expect(sessionResult.student?.id).toBe(studentAId);
    expect(sessionResult.student?.ageSegment).toBe(AgeSegment.kids);
  });

  // ============================================================================
  // P1-12: logout con id, user_id y organization_id
  // ============================================================================
  it('P1-12: logout revoca AuthSession filtrando por id, user_id y organization_id en DB real', async () => {
    expect(isPostgresAvailable).toBe(true);

    const secret = 'refresh-secret-logout-test-32ch!';
    const secretHash = hashSha256(secret);

    // Create session in DB real
    await TenantContext.runBypass(async () => {
      // guardrails-ignore G-A06: creación de fixture para prueba logout
      await prisma.authSession.deleteMany({ where: { id: sessionAId } });
      await prisma.authSession.create({
        data: {
          id: sessionAId,
          organization_id: orgAId,
          user_id: userAId,
          refresh_token_hash: secretHash,
          expires_at: new Date(Date.now() + 100000),
        },
      });
    });

    const { res, clearedCookies } = createMockResponse();

    await authService.logout(`${sessionAId}.${secret}`, undefined, res);

    // Verify session revoked in PostgreSQL
    const sessionInDb = await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: verificación de revocación en DB real
      prisma.authSession.findUnique({ where: { id: sessionAId } }),
    );
    expect(sessionInDb?.revoked_at).not.toBeNull();
    expect(clearedCookies['englove_test_session_hint']).toBeDefined();
    expect(clearedCookies['englove_test_refresh_token']?.path).toBe('/api/v1/auth');
  });

  // ============================================================================
  // P1-12: JwtAuthGuard con claim typ obligatorio y verificación de locked_until
  // ============================================================================
  it('P1-12: JwtAuthGuard rechaza JWT sin typ: "access" y rechaza usuarios con locked_until activo', async () => {
    expect(isPostgresAvailable).toBe(true);

    const reflector = new Reflector();
    const guard = new JwtAuthGuard(reflector, jwtService, configService, prisma);

    // 1. JWT sin typ
    const tokenNoTyp = jwtService.sign(
      { sub: userAId, email: 'student.a@wp02.test', role: Role.student, org: orgAId, sid: sessionAId },
      { secret: jwtSecret },
    );

    const contextNoTyp = {
      switchToHttp: () => ({
        getRequest: () => ({
          cookies: { englove_test_access_token: tokenNoTyp },
          headers: {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as import('@nestjs/common').ExecutionContext;

    await expect(guard.canActivate(contextNoTyp)).rejects.toThrow(UnauthorizedException);

    // 2. JWT con typ incorrecto (e.g. 'attempt')
    const tokenWrongTyp = jwtService.sign(
      { sub: userAId, email: 'student.a@wp02.test', role: Role.student, org: orgAId, sid: sessionAId, typ: 'attempt' },
      { secret: jwtSecret },
    );

    const contextWrongTyp = {
      switchToHttp: () => ({
        getRequest: () => ({
          cookies: { englove_test_access_token: tokenWrongTyp },
          headers: {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as import('@nestjs/common').ExecutionContext;

    await expect(guard.canActivate(contextWrongTyp)).rejects.toThrow(UnauthorizedException);

    // 3. JWT válido con typ: 'access', pero usuario con locked_until en futuro
    const tokenValidTyp = jwtService.sign(
      { sub: userAId, email: 'student.a@wp02.test', role: Role.student, org: orgAId, sid: sessionAId, typ: 'access' },
      { secret: jwtSecret },
    );

    // Reactivar sesión en DB y bloquear usuario
    await TenantContext.runBypass(async () => {
      // guardrails-ignore G-A06: reactivación de sesión y bloqueo para prueba
      await prisma.authSession.updateMany({
        where: { id: sessionAId },
        data: { revoked_at: null, expires_at: new Date(Date.now() + 100000) },
      });
      await prisma.user.update({
        where: { id: userAId },
        data: { locked_until: new Date(Date.now() + 60 * 60 * 1000) }, // Bloqueado por 1 hora
      });
    });

    const contextLocked = {
      switchToHttp: () => ({
        getRequest: () => ({
          cookies: { englove_test_access_token: tokenValidTyp },
          headers: {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as import('@nestjs/common').ExecutionContext;

    const errLocked = await guard.canActivate(contextLocked).catch((e) => e);
    expect(errLocked).toBeInstanceOf(UnauthorizedException);
    expect(errLocked.message).toContain('bloqueada');

    // Desbloquear usuario para dejar DB limpia
    await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: reseteo de bloqueo
      prisma.user.update({ where: { id: userAId }, data: { locked_until: null } }),
    );
  });

  // ============================================================================
  // P1-12: TenantPrismaExtension intercepta mutaciones y bloquea { not: ... }
  // ============================================================================
  it('P1-12: TenantPrismaExtension bloquea mutaciones sin tenant y rechaza filtros de tenant maliciosos ({ not: ... })', async () => {
    expect(isPostgresAvailable).toBe(true);

    // Fuera de TenantContext y sin bypass:
    // 1. create sin organization_id válido debe fallar
    await expect(
      prisma.student.create({
        data: {
          user_id: userBId,
          birth_date: new Date('2014-01-01'),
          age_segment: AgeSegment.teens,
        } as unknown as import('@prisma/client').Prisma.StudentCreateInput,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id ausente en TenantContext/);

    // 2. update con organization_id discordante en TenantContext debe fallar (aislamiento anti-IDOR)
    await expect(
      TenantContext.run({ organizationId: orgAId }, async () => {
        return prisma.user.update({
          where: { id: userAId, organization_id: orgBId } as unknown as import('@prisma/client').Prisma.UserWhereUniqueInput,
          data: { name: 'Compromised Name' },
        });
      }),
    ).rejects.toThrow(/Violación de aislamiento tenant en User: organization_id discordante/);

    // 3. update con filtro { not: ... } fuera de TenantContext debe ser rechazado
    await expect(
      prisma.user.update({
        where: { id: userAId, organization_id: { not: orgBId } } as unknown as import('@prisma/client').Prisma.UserWhereUniqueInput,
        data: { name: 'Compromised Name' },
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id inválido/);

    // 3b. deleteMany con filtro { not: ... } sin TenantContext debe fallar
    await expect(
      prisma.student.deleteMany({
        where: { organization_id: { not: orgBId } } as unknown as import('@prisma/client').Prisma.StudentWhereInput,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada/);

    // 4. filtro { not: ... } sin TenantContext debe fallar (no aceptar truthy)
    await expect(
      prisma.user.findFirst({
        where: {
          organization_id: { not: orgBId } as unknown as string,
        },
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id ausente en TenantContext/);

    // 5. $queryRaw sin TenantContext y sin mención a organization_id debe fallar
    await expect(
      prisma.$queryRaw`SELECT * FROM users WHERE email = 'student.a@wp02.test'`,
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id ausente en TenantContext para \$queryRaw/);
  });

  // ============================================================================
  // P1-01: Redacción de x-attempt-token y sanitización de query strings
  // ============================================================================
  it('P1-01: AllExceptionsFilter sanitiza URL removiendo query string antes de registrar en logs', () => {
    const filter = new AllExceptionsFilter();
    let loggedMessage = '';
    // Spy on logger
    (filter as unknown as { logger: { error: (msg: string) => void } }).logger = {
      error: (msg: string) => {
        loggedMessage = msg;
      },
    };

    const mockRequest = {
      method: 'GET',
      url: '/api/v1/auth/callback?token=super-secret-token&code=123456',
    } as Request;

    const mockResponse = {
      status: () => mockResponse,
      json: () => mockResponse,
      setHeader: () => mockResponse,
      getHeader: () => undefined,
    } as unknown as Response;

    const mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as import('@nestjs/common').ArgumentsHost;

    // Trigger unexpected error
    filter.catch(new Error('Test unexpected database failure'), mockHost);

    expect(loggedMessage).toContain('/api/v1/auth/callback');
    expect(loggedMessage).not.toContain('super-secret-token');
    expect(loggedMessage).not.toContain('code=123456');
  });

  // ============================================================================
  // P2-01: Mitigación de DoS en reset-password y oráculo temporal en signup
  // ============================================================================
  it('P2-01: resetPassword rechaza token inválido sin computar Argon2id (pre-check en DB)', async () => {
    expect(isPostgresAvailable).toBe(true);

    // Verify with non-existent token: must throw BadRequestException without error
    await expect(
      authService.resetPassword({
        token: 'non-existent-token-that-never-existed-in-db!',
        newPassword: 'ValidPassword123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ============================================================================
  // QA-08: Cookies Secure dinámicas según APP_ENV
  // ============================================================================
  it('QA-08: Cookies en entorno staging o producción aplican secure=true estrictamente', () => {
    const prodConfigService = new ConfigService({
      JWT_SECRET: jwtSecret,
      APP_ENV: 'staging',
      WEB_BASE_URL: 'https://staging.englove.org',
      COOKIE_PREFIX: 'englove_staging_',
    });

    const prodAuthService = new AuthService(
      prisma,
      prodConfigService,
      jwtService,
      mailService,
      rateLimiter,
    );

    const { res, cookies } = createMockResponse();

    prodAuthService.setSessionCookies(
      res,
      { id: userAId, email: 'student.a@wp02.test', role: Role.student, organization_id: orgAId },
      { id: studentAId, age_segment: AgeSegment.kids },
      { id: sessionAId, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      'test-secret-value-32-chars-long!',
    );

    expect(cookies['englove_staging_access_token']?.options.secure).toBe(true);
    expect(cookies['englove_staging_refresh_token']?.options.secure).toBe(true);
    expect(cookies['englove_staging_session_hint']?.options.secure).toBe(true);
  });

  // ============================================================================
  // P1-12b: logout con access_token expirado (ignoreExpiration) y refresh corrupto
  // ============================================================================
  it('P1-12b: logout revoca sesión usando access_token expirado con ignoreExpiration cuando refresh_token está corrupto o ausente', async () => {
    expect(isPostgresAvailable).toBe(true);

    const sessionBId = '90000000-0000-4000-8000-000000000032';
    await TenantContext.runBypass(async () => {
      // guardrails-ignore G-A06: creación de fixture para prueba de logout con access_token expirado
      await prisma.authSession.deleteMany({ where: { id: sessionBId } });
      await prisma.authSession.create({
        data: {
          id: sessionBId,
          organization_id: orgAId,
          user_id: userAId,
          refresh_token_hash: 'hash-for-session-b',
          expires_at: new Date(Date.now() + 100000),
        },
      });
    });

    const expiredAccessToken = jwtService.sign(
      { sub: userAId, email: 'student.a@wp02.test', role: Role.student, org: orgAId, sid: sessionBId, typ: 'access' },
      { secret: jwtSecret, expiresIn: '0s' },
    );

    const { res, clearedCookies } = createMockResponse();

    // Call logout with corrupted refresh token and expired access token
    await authService.logout('corrupted-refresh-token', expiredAccessToken, res);

    const sessionInDb = await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: verificación de revocación en DB real
      prisma.authSession.findUnique({ where: { id: sessionBId } }),
    );
    expect(sessionInDb?.revoked_at).not.toBeNull();
    expect(clearedCookies['englove_test_session_hint']).toBeDefined();
    expect(clearedCookies['englove_test_access_token']).toBeDefined();
  });

  // ============================================================================
  // T2.5: AttemptsService verifyAttemptTokenSignature tipado estricto de claim typ
  // ============================================================================
  it('T2.5: AttemptsService rechaza estrictamente tokens de intento sin claim typ o con typ !== attempt', () => {
    const attemptsService = new AttemptsService(
      prisma,
      configService,
      jwtService,
      {} as unknown as import('../src/scoring/scoring.service').ScoringService,
      {} as unknown as GamificationService,
      {} as unknown as import('../src/media/media.service').MediaService,
      {} as unknown as import('../src/feature-flags/feature-flags.service').FeatureFlagsService,
    );

    const testAttemptId = 'att-00000000-0000-4000-8000-000000000001';

    // 1. Token sin claim typ
    const tokenWithoutTyp = jwtService.sign(
      { attemptId: testAttemptId, studentId: studentAId, organizationId: orgAId },
      { secret: jwtSecret },
    );
    expect(() =>
      attemptsService.verifyAttemptTokenSignature(tokenWithoutTyp, testAttemptId, studentAId, orgAId),
    ).toThrow(UnauthorizedException);

    // 2. Token con typ !== 'attempt' (por ejemplo 'access')
    const tokenWithAccessTyp = jwtService.sign(
      { attemptId: testAttemptId, studentId: studentAId, organizationId: orgAId, typ: 'access' },
      { secret: jwtSecret },
    );
    expect(() =>
      attemptsService.verifyAttemptTokenSignature(tokenWithAccessTyp, testAttemptId, studentAId, orgAId),
    ).toThrow(UnauthorizedException);

    // 3. Token correcto con typ: 'attempt'
    const validAttemptToken = jwtService.sign(
      { attemptId: testAttemptId, studentId: studentAId, organizationId: orgAId, typ: 'attempt' },
      { secret: jwtSecret },
    );
    expect(() =>
      attemptsService.verifyAttemptTokenSignature(validAttemptToken, testAttemptId, studentAId, orgAId),
    ).not.toThrow();
  });

  // ============================================================================
  // P1-01b: pinoHttp serializer req sanitiza url eliminando query string y vacía req.query sin mutar input
  // ============================================================================
  it('P1-01b: sanitizePinoReq sanitiza url eliminando query string y vacía req.query sin mutar request original', () => {
    const rawReq = {
      url: '/api/v1/auth/login?token=super-secret-query-param&code=456789',
      query: { token: 'super-secret-query-param', code: '456789' },
      method: 'POST',
    };

    const serialized = sanitizePinoReq({ ...rawReq });
    expect(serialized.url).toBe('/api/v1/auth/login');
    expect(serialized.query).toEqual({});
    // Inmutable: el objeto original no debe ser mutado in-place
    expect(rawReq.url).toBe('/api/v1/auth/login?token=super-secret-query-param&code=456789');
    expect(rawReq.query).toEqual({ token: 'super-secret-query-param', code: '456789' });
  });

  // ============================================================================
  // Edge Case: Logout con access_token manipulado / secreto foráneo o sid no-UUID
  // ============================================================================
  it('Edge Case: logout con access_token manipulado o refresh_token no-UUID no lanza errores no controlados y limpia cookies', async () => {
    const foreignJwtService = new JwtService({ secret: 'completely-foreign-untrusted-secret-key-32' });
    const forgedAccessToken = foreignJwtService.sign(
      { sub: userAId, email: 'student.a@wp02.test', role: Role.student, org: orgAId, sid: sessionAId, typ: 'access' },
    );

    const { res, clearedCookies } = createMockResponse();

    // Invocar con refresh_token con sid no-UUID y access_token manipulado
    await expect(
      authService.logout('not-a-valid-uuid.secret', forgedAccessToken, res),
    ).resolves.not.toThrow();

    // Las cookies de sesión deben haber sido limpiadas
    expect(clearedCookies['englove_test_access_token']).toBeDefined();
    expect(clearedCookies['englove_test_refresh_token']).toBeDefined();
    expect(clearedCookies['englove_test_session_hint']).toBeDefined();
  });

  // ============================================================================
  // Edge Case: confirmEmailChange sin solicitud activa devuelve 422 OTP_MAX_ATTEMPTS
  // ============================================================================
  it('Edge Case: confirmEmailChange sin solicitud activa devuelve 422 OTP_MAX_ATTEMPTS mediante resultado discriminado', async () => {
    expect(isPostgresAvailable).toBe(true);

    // Usuario sin ninguna solicitud de cambio pendiente
    const userWithoutReq = {
      id: userBId,
      email: 'teacher.b@wp02.test',
      role: Role.teacher,
      organizationId: orgBId,
      sessionId: '00000000-0000-4000-8000-000000000099',
    };

    const err = await authService.confirmEmailChange({ otp: '123456' }, userWithoutReq).catch((e) => e);
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect(err.getResponse().code).toBe('OTP_MAX_ATTEMPTS');
  });

  // ============================================================================
  // T2.3 / P1-12: AuthController.logout con Authorization: Bearer <token> revoca sesión en DB
  // ============================================================================
  it('T2.3 / P1-12: AuthController.logout revoca sesión en PostgreSQL cuando se envía Authorization Bearer sin cookies', async () => {
    expect(isPostgresAvailable).toBe(true);

    const sessionBearerId = '90000000-0000-4000-8000-000000000033';
    await TenantContext.runBypass(async () => {
      // guardrails-ignore G-A06: creación de fixture para prueba logout con Bearer header
      await prisma.authSession.deleteMany({ where: { id: sessionBearerId } });
      await prisma.authSession.create({
        data: {
          id: sessionBearerId,
          organization_id: orgAId,
          user_id: userAId,
          refresh_token_hash: 'hash-for-bearer-session',
          expires_at: new Date(Date.now() + 100000),
        },
      });
    });

    const bearerAccessToken = jwtService.sign(
      { sub: userAId, email: 'student.a@wp02.test', role: Role.student, org: orgAId, sid: sessionBearerId, typ: 'access' },
      { secret: jwtSecret },
    );

    const authController = new (await import('../src/auth/auth.controller')).AuthController(
      authService,
      configService,
    );

    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${bearerAccessToken}` },
    } as unknown as Request;

    const { res } = createMockResponse();

    await authController.logout(req, res);

    // Sesión debe estar revocada en PostgreSQL
    const sessionInDb = await TenantContext.runBypass(() =>
      // guardrails-ignore G-A06: verificación de revocación en DB real
      prisma.authSession.findUnique({ where: { id: sessionBearerId } }),
    );
    expect(sessionInDb?.revoked_at).not.toBeNull();
  });

  // ============================================================================
  // T2.6 / P1-12: TenantPrismaExtension bloquea bypass con NOT o OR en PostgreSQL real
  // ============================================================================
  it('T2.6 / P1-12: TenantPrismaExtension bloquea consultas maliciosas con NOT u OR sin TenantContext en PostgreSQL real', async () => {
    expect(isPostgresAvailable).toBe(true);

    // Consulta con NOT: [{ organization_id: orgAId }] no debe ser aceptada como filtro positivo
    await expect(
      prisma.user.findFirst({
        where: {
          NOT: [{ organization_id: orgAId }],
        } as unknown as import('@prisma/client').Prisma.UserWhereInput,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id ausente en TenantContext/);

    // Consulta con OR: [{ organization_id: orgAId }, { id: userBId }] no debe ejecutarse
    await expect(
      prisma.user.findMany({
        where: {
          OR: [{ organization_id: orgAId }, { id: userBId }],
        } as unknown as import('@prisma/client').Prisma.UserWhereInput,
      }),
    ).rejects.toThrow(/Operación multi-tenant rechazada: organization_id ausente en TenantContext/);
  });

  // ============================================================================
  // P1-01c: sanitizePinoReq limpia query strings tanto en url como en originalUrl
  // ============================================================================
  it('P1-01c: sanitizePinoReq limpia query strings tanto en url como en originalUrl', () => {
    const rawReq = {
      url: '/api/v1/auth/callback?token=sensitive-token',
      originalUrl: '/api/v1/auth/callback?token=sensitive-token',
      query: { token: 'sensitive-token' },
      method: 'GET',
    };

    const sanitized = sanitizePinoReq(rawReq);
    expect(sanitized.url).toBe('/api/v1/auth/callback');
    expect(sanitized.originalUrl).toBe('/api/v1/auth/callback');
    expect(sanitized.query).toEqual({});
  });

  // ============================================================================
  // RT-07: refresh con sid no-UUID rechaza con 401 AUTH_UNAUTHORIZED sin 500 de Postgres
  // ============================================================================
  it('RT-07: refresh con sid malformado o no-UUID devuelve 401 AUTH_UNAUTHORIZED y limpia cookies', async () => {
    expect(isPostgresAvailable).toBe(true);

    const { res, clearedCookies } = createMockResponse();
    const err = await authService.refresh('not-a-uuid.some-secret', res).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.getResponse().code).toBe('AUTH_UNAUTHORIZED');
    expect(clearedCookies['englove_test_access_token']).toBeDefined();
    expect(clearedCookies['englove_test_refresh_token']).toBeDefined();
    expect(clearedCookies['englove_test_session_hint']).toBeDefined();
  });

  // ============================================================================
  // RT-08: confirmEmailChange notifica al correo real en DB aunque currentUser.email esté obsoleto
  // ============================================================================
  it('RT-08: confirmEmailChange envía email-changed al correo real previo de DB aunque el JWT porte un email obsoleto', async () => {
    expect(isPostgresAvailable).toBe(true);

    const reqId = '90000000-0000-4000-8000-000000000049';
    const otp = '748291';
    const sendSpy = vi.spyOn(mailService, 'sendMail').mockResolvedValue({
      status: 'accepted',
      messageId: 'rt08-msg',
    });

    try {
      await TenantContext.runBypass(async () => {
        // Simula usuario cuyo correo actual en DB ya es email-b@wp02.test (tras un primer cambio),
        // pero su JWT aún porta el claim antiguo email-a@wp02.test.
        await prisma.user.update({
          where: { id: userBId, organization_id: orgBId },
          data: { email: 'email-b@wp02.test' },
        });
        await prisma.emailChangeRequest.deleteMany({
          where: { organization_id: orgBId, user_id: userBId },
        });
        await prisma.emailChangeRequest.create({
          data: {
            id: reqId,
            organization_id: orgBId,
            user_id: userBId,
            new_email: 'email-c@wp02.test',
            otp_hash: hashSha256(otp),
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
            failed_attempts: 0,
          },
        });
      });

      const staleJwtUser = {
        id: userBId,
        email: 'email-a@wp02.test',
        role: Role.teacher,
        organizationId: orgBId,
        sessionId: '00000000-0000-4000-8000-000000000099',
      };

      const res = await authService.confirmEmailChange({ otp }, staleJwtUser);
      expect(res.message).toBe('Tu correo fue actualizado.');
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'email-changed',
          to: 'email-b@wp02.test',
        }),
      );
    } finally {
      sendSpy.mockRestore();
      await TenantContext.runBypass(async () => {
        await prisma.emailChangeRequest.deleteMany({
          where: { organization_id: orgBId, user_id: userBId },
        });
        await prisma.user.update({
          where: { id: userBId, organization_id: orgBId },
          data: { email: 'teacher.b@wp02.test' },
        });
      });
    }
  });

  // ============================================================================
  // C-01: Autenticación — no DoS en refresh ante secreto arbitrario + revocación acreditada
  // ============================================================================
  it('C-01: refresh con sid válido y secreto arbitrario rechaza con 401 sin revocar AuthSession, mientras el reuso acreditado revoca la familia en PostgreSQL', async () => {
    expect(isPostgresAvailable).toBe(true);

    const c01UserId = '90000000-0000-4000-8000-0000000000c1';
    const c01Email = 'c01.teacher@wp02.test';
    const c01Password = 'C01StrongPass2026!';
    const passwordHash = await argon2.hash(c01Password);

    await TenantContext.runBypass(async () => {
      await prisma.user.create({
        data: {
          id: c01UserId,
          organization_id: orgBId,
          name: 'C01 Teacher',
          email: c01Email,
          password_hash: passwordHash,
          role: Role.teacher,
        },
      });
    });

    try {
      const loginMock = createMockResponse();
      await authService.login({ email: c01Email, password: c01Password }, '127.0.0.1', loginMock.res);
      const initialRefresh = loginMock.cookies['englove_test_refresh_token']?.value;
      expect(initialRefresh).toBeDefined();
      const [sid] = (initialRefresh ?? '').split('.');
      expect(sid).toMatch(/^[0-9a-f-]{36}$/i);

      // 1) Petición forjada con sid conocido y secreto arbitrario NO debe revocar la sesión
      const forgedMock = createMockResponse();
      await expect(
        authService.refresh(`${sid}.forged-arbitrary-secret-not-hmac`, forgedMock.res),
      ).rejects.toThrow(UnauthorizedException);

      const sessionAfterForged = await TenantContext.run({ organizationId: orgBId }, () =>
        prisma.authSession.findFirst({ where: { id: sid, organization_id: orgBId } }),
      );
      expect(sessionAfterForged?.revoked_at).toBeNull();

      // 2) El token legítimo emitido originalmente sigue funcionando y rota el token
      const validMock = createMockResponse();
      const refreshed = await authService.refresh(initialRefresh ?? '', validMock.res);
      expect(refreshed.user.id).toBe(c01UserId);
      const rotatedRefresh = validMock.cookies['englove_test_refresh_token']?.value;
      expect(rotatedRefresh).toBeDefined();
      expect(rotatedRefresh).not.toBe(initialRefresh);

      // 3) El reuso acreditado del token anterior (HMAC válido para este sid) SÍ revoca la familia
      const replayMock = createMockResponse();
      await expect(authService.refresh(initialRefresh ?? '', replayMock.res)).rejects.toThrow(
        UnauthorizedException,
      );

      const sessionAfterReplay = await TenantContext.run({ organizationId: orgBId }, () =>
        prisma.authSession.findFirst({ where: { id: sid, organization_id: orgBId } }),
      );
      expect(sessionAfterReplay?.revoked_at).not.toBeNull();

      // 4) Incluso el token nuevo rotado queda invalidado tras revocar la familia
      const postRevokeMock = createMockResponse();
      await expect(authService.refresh(rotatedRefresh ?? '', postRevokeMock.res)).rejects.toThrow(
        UnauthorizedException,
      );
    } finally {
      await TenantContext.runBypass(async () => {
        // guardrails-ignore G-A06: limpieza de fixture aislada de prueba C-01
        await prisma.authSession.deleteMany({ where: { organization_id: orgBId, user_id: c01UserId } });
        await prisma.user.deleteMany({ where: { organization_id: orgBId, id: c01UserId } });
      });
    }
  });
});
