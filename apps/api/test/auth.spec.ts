import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  HttpException,
  ParseUUIDPipe,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  Role,
  ApprovalStatus,
  AgeSegment,
  Level,
} from '@englove/shared';
import { AuthService } from '../src/auth/auth.service';
import { StudentsService } from '../src/students/students.service';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { RateLimiterService } from '../src/common/rate-limiting/rate-limiter.service';
import { RateLimitedException } from '../src/common/rate-limiting/rate-limiter.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { OriginGuard } from '../src/common/guards/origin.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import {
  validatePasswordPolicy,
  validateCivilBirthDate,
  hashSha256,
} from '../src/common/utils/identity.utils';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { Reflector } from '@nestjs/core';

describe('SPEC-02: Identidad y Sesión — Pruebas de integración y unitarias (ENG-026)', () => {
  const JWT_SECRET = 'test-secret-at-least-32-chars-for-hmac-sha256';
  const orgId = '11111111-1111-1111-1111-111111111111';
  const otherOrgId = '22222222-2222-2222-2222-222222222222';
  const teacherId = '33333333-3333-3333-3333-333333333333';
  const studentUserId = '44444444-4444-4444-4444-444444444444';
  const studentId = '55555555-5555-5555-5555-555555555555';
  const sessionId = '66666666-6666-6666-6666-666666666666';
  const groupId = '77777777-7777-7777-7777-777777777777';

  let jwtService: JwtService;
  let rateLimiter: RateLimiterService;
  let mockMailService: MailService;
  let mockConfigService: ConfigService;

  const createMockResponse = () => {
    const cookies: Record<string, { value: string; options: Record<string, unknown> }> = {};
    const clearedCookies: Record<string, Record<string, unknown>> = {};
    const res = {
      cookie: vi.fn((name: string, value: string, options: Record<string, unknown>) => {
        cookies[name] = { value, options };
        return res;
      }),
      clearCookie: vi.fn((name: string, options: Record<string, unknown>) => {
        clearedCookies[name] = options;
        return res;
      }),
      cookies,
      clearedCookies,
    } as unknown as Response & {
      cookies: Record<string, { value: string; options: Record<string, unknown> }>;
      clearedCookies: Record<string, Record<string, unknown>>;
    };
    return res;
  };

  beforeEach(() => {
    jwtService = new JwtService({ secret: JWT_SECRET });
    rateLimiter = new RateLimiterService();
    mockMailService = {
      sendMail: vi.fn().mockResolvedValue({ id: 'msg-123' }),
    } as unknown as MailService;

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          JWT_SECRET,
          COOKIE_PREFIX: 'englove_',
          COOKIE_DOMAIN: '',
          WEB_BASE_URL: 'http://localhost:3000',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;
  });

  // =========================================================================
  // RF-1: Login normaliza correo y emite sesión sin elegir tenant
  // =========================================================================
  describe('RF-1: Login y emisión de sesión', () => {
    it('normaliza el correo y emite sesión + cookies httpOnly para credenciales válidas', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const teacherUser = {
        id: teacherId,
        organization_id: orgId,
        name: 'Profesora Laura',
        email: 'laura@school.edu',
        password_hash: passwordHash,
        role: Role.teacher,
        failed_login_count: 0,
        locked_until: null,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(teacherUser),
          update: vi.fn().mockResolvedValue(teacherUser),
        },
        authSession: {
          create: vi.fn().mockResolvedValue({
            id: sessionId,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      const result = await authService.login(
        { email: '  LAURA@School.EDU ', password: 'Secret123' },
        '127.0.0.1',
        res,
      );

      // Verify email was normalized
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'laura@school.edu' },
      });

      // Verify response envelope (SessionView without tokens)
      expect(result).toEqual({
        user: {
          id: teacherId,
          name: 'Profesora Laura',
          email: 'laura@school.edu',
          role: Role.teacher,
        },
        student: null,
      });

      // Verify httpOnly cookies were set
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookies['englove_access_token']?.options.httpOnly).toBe(true);
      expect(res.cookies['englove_access_token']?.options.path).toBe('/');
      expect(res.cookies['englove_refresh_token']?.options.httpOnly).toBe(true);
      expect(res.cookies['englove_refresh_token']?.options.path).toBe('/api/v1/auth/refresh');
    });

    it('devuelve respuesta uniforme 401 AUTH_INVALID_CREDENTIALS ante correo inexistente o contraseña errónea', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      await expect(
        authService.login({ email: 'noone@school.edu', password: 'Secret123' }, '127.0.0.1', res),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await authService.login({ email: 'noone@school.edu', password: 'Secret123' }, '127.0.0.1', res);
      } catch (err) {
        const ex = err as UnauthorizedException;
        expect(ex.getResponse()).toEqual({
          statusCode: 401,
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'El correo o la contraseña no son correctos',
        });
      }
    });
  });

  // =========================================================================
  // RF-2: Cuenta pendiente no obtiene sesión ni supera guard
  // =========================================================================
  describe('RF-2: Alumno pendiente de aprobación', () => {
    it('devuelve 403 ACCOUNT_PENDING_APPROVAL con contraseña correcta', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const studentUser = {
        id: studentUserId,
        organization_id: orgId,
        name: 'Carlos Alumno',
        email: 'carlos@student.edu',
        password_hash: passwordHash,
        role: Role.student,
        failed_login_count: 0,
        locked_until: null,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(studentUser),
          update: vi.fn().mockResolvedValue(studentUser),
        },
        student: {
          findFirst: vi.fn().mockResolvedValue({
            id: studentId,
            age_segment: AgeSegment.kids,
            can_switch_interface: false,
            approval_status: ApprovalStatus.pending_approval,
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      try {
        await authService.login({ email: 'carlos@student.edu', password: 'Secret123' }, '127.0.0.1', res);
        expect.unreachable('Should have thrown ForbiddenException');
      } catch (err) {
        const ex = err as ForbiddenException;
        expect(ex.getResponse()).toEqual({
          statusCode: 403,
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Tu cuenta está pendiente de aprobación por tu profesora',
        });
      }
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('devuelve 401 ante contraseña incorrecta en cuenta pendiente (sin revelar estado)', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const studentUser = {
        id: studentUserId,
        organization_id: orgId,
        name: 'Carlos Alumno',
        email: 'carlos@student.edu',
        password_hash: passwordHash,
        role: Role.student,
        failed_login_count: 0,
        locked_until: null,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(studentUser),
          update: vi.fn().mockResolvedValue(studentUser),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      try {
        await authService.login({ email: 'carlos@student.edu', password: 'WrongPassword' }, '127.0.0.1', res);
        expect.unreachable('Should have thrown UnauthorizedException');
      } catch (err) {
        const ex = err as UnauthorizedException;
        expect(ex.getResponse()).toEqual({
          statusCode: 401,
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'El correo o la contraseña no son correctos',
        });
      }
    });
  });

  // =========================================================================
  // RF-3: Refresh rotativo y reutilización revocan access
  // =========================================================================
  describe('RF-3: Refresh rotativo y detección de reuso', () => {
    it('rota refresh token conservando expires_at absoluto de la familia', async () => {
      const initialSecret = 'secret-one';
      const initialHash = hashSha256(initialSecret);
      const fixedExpiresAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);

      const sessionRecord = {
        id: sessionId,
        organization_id: orgId,
        user_id: teacherId,
        refresh_token_hash: initialHash,
        expires_at: fixedExpiresAt,
        rotated_at: null,
        revoked_at: null,
      };

      const mockPrisma = {
        authSession: {
          findFirst: vi.fn().mockResolvedValue(sessionRecord),
          update: vi.fn().mockImplementation(({ data }) => ({
            ...sessionRecord,
            ...data,
          })),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: teacherId,
            organization_id: orgId,
            name: 'Profesora Laura',
            email: 'laura@school.edu',
            role: Role.teacher,
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      const result = await authService.refresh(`${sessionId}.${initialSecret}`, res);

      expect(result.user.email).toBe('laura@school.edu');
      expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: sessionId }),
          data: expect.objectContaining({
            rotated_at: expect.any(Date),
            last_used_at: expect.any(Date),
          }),
        }),
      );
      expect(res.cookie).toHaveBeenCalledTimes(2);
    });

    it('revoca la familia de sesión completa si se detecta reuso de token rotado', async () => {
      const oldSecret = 'already-rotated-secret';
      const currentSecret = 'newest-secret';
      const currentHash = hashSha256(currentSecret);

      const sessionRecord = {
        id: sessionId,
        organization_id: orgId,
        user_id: teacherId,
        refresh_token_hash: currentHash, // current hash in DB does not match oldSecret
        expires_at: new Date(Date.now() + 100000),
        revoked_at: null,
      };

      const mockPrisma = {
        authSession: {
          findFirst: vi.fn().mockResolvedValue(sessionRecord),
          update: vi.fn().mockResolvedValue({
            ...sessionRecord,
            revoked_at: new Date(),
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      try {
        await authService.refresh(`${sessionId}.${oldSecret}`, res);
        expect.unreachable('Should have thrown UnauthorizedException');
      } catch (err) {
        const ex = err as UnauthorizedException;
        expect(ex.getStatus()).toBe(401);
      }

      // Verify session was revoked in DB
      expect(mockPrisma.authSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { revoked_at: expect.any(Date) },
      });
      // Verify cookies were cleared
      expect(res.clearCookie).toHaveBeenCalled();
    });

    it('detecta carrera concurrente en rotación y revoca la familia al perder la condición atómica', async () => {
      const validSecret = 'valid-secret';
      const validHash = hashSha256(validSecret);

      const sessionRecord = {
        id: sessionId,
        organization_id: orgId,
        user_id: teacherId,
        refresh_token_hash: validHash,
        expires_at: new Date(Date.now() + 100000),
        revoked_at: null,
      };

      const mockPrisma = {
        authSession: {
          findFirst: vi.fn().mockResolvedValue(sessionRecord),
          // updateMany returns count 0, simulating another concurrent request won the rotation
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: teacherId,
            organization_id: orgId,
            name: 'Laura',
            email: 'laura@school.edu',
            role: Role.teacher,
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      await expect(authService.refresh(`${sessionId}.${validSecret}`, res)).rejects.toThrow(
        UnauthorizedException,
      );
      // Entire session family revoked
      expect(mockPrisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { id: sessionId, organization_id: orgId, revoked_at: null },
        data: { revoked_at: expect.any(Date) },
      });
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // RF-4: Bloqueo sin enumeración (Decisión 94)
  // =========================================================================
  describe('RF-4: Política de bloqueo 10/10 sin enumeración (Decisión 94)', () => {
    it('el décimo fallo consecutivo devuelve 401 (no 423) para evitar enumeración', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const user = {
        id: studentUserId,
        organization_id: orgId,
        email: 'carlos@student.edu',
        password_hash: passwordHash,
        role: Role.student,
        failed_login_count: 9, // already 9 failures
        locked_until: null,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(user),
          update: vi.fn().mockResolvedValue({
            ...user,
            failed_login_count: 10,
            locked_until: new Date(Date.now() + 10 * 60 * 1000),
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      try {
        await authService.login({ email: 'carlos@student.edu', password: 'WrongPassword' }, '127.0.0.1', res);
        expect.unreachable('Should have thrown 401');
      } catch (err) {
        const ex = err as UnauthorizedException;
        expect(ex.getStatus()).toBe(401);
        expect(ex.getResponse()).toEqual({
          statusCode: 401,
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'El correo o la contraseña no son correctos',
        });
      }

      // User was locked
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: studentUserId },
          data: expect.objectContaining({
            failed_login_count: 10,
            locked_until: expect.any(Date),
          }),
        }),
      );
    });

    it('durante bloqueo activo: contraseña errónea devuelve 401 y congela contador/plazo', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const futureLock = new Date(Date.now() + 8 * 60 * 1000);
      const user = {
        id: studentUserId,
        organization_id: orgId,
        email: 'carlos@student.edu',
        password_hash: passwordHash,
        role: Role.student,
        failed_login_count: 10,
        locked_until: futureLock,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(user),
          update: vi.fn(),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      try {
        await authService.login({ email: 'carlos@student.edu', password: 'WrongPassword' }, '127.0.0.1', res);
        expect.unreachable('Should have thrown 401');
      } catch (err) {
        const ex = err as UnauthorizedException;
        expect(ex.getStatus()).toBe(401);
      }

      // Update was NOT called: counter and deadline remain frozen
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('durante bloqueo activo: contraseña correcta devuelve 423 AUTH_ACCOUNT_LOCKED con Retry-After', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const futureLock = new Date(Date.now() + 300 * 1000); // 300 seconds left
      const user = {
        id: studentUserId,
        organization_id: orgId,
        email: 'carlos@student.edu',
        password_hash: passwordHash,
        role: Role.student,
        failed_login_count: 10,
        locked_until: futureLock,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(user),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      try {
        await authService.login({ email: 'carlos@student.edu', password: 'Secret123' }, '127.0.0.1', res);
        expect.unreachable('Should have thrown 423');
      } catch (err) {
        const ex = err as HttpException;
        expect(ex.getStatus()).toBe(423);
        expect(ex.getResponse()).toEqual({
          statusCode: 423,
          code: 'AUTH_ACCOUNT_LOCKED',
          message: 'Demasiados intentos. Intenta de nuevo en unos minutos',
          retryAfter: expect.any(Number),
        });
      }
    });

    it('bloqueo expirado se reinicia inmediatamente antes de evaluar login', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const pastLock = new Date(Date.now() - 1000); // expired 1s ago
      const user = {
        id: teacherId,
        organization_id: orgId,
        name: 'Laura',
        email: 'laura@school.edu',
        password_hash: passwordHash,
        role: Role.teacher,
        failed_login_count: 10,
        locked_until: pastLock,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue(user),
          update: vi.fn().mockResolvedValue({
            ...user,
            failed_login_count: 0,
            locked_until: null,
          }),
        },
        authSession: {
          create: vi.fn().mockResolvedValue({
            id: sessionId,
            expires_at: new Date(Date.now() + 100000),
          }),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = createMockResponse();
      const result = await authService.login(
        { email: 'laura@school.edu', password: 'Secret123' },
        '127.0.0.1',
        res,
      );

      expect(result.user.email).toBe('laura@school.edu');
      // Verify expired lock was reset
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: teacherId },
        data: { failed_login_count: 0, locked_until: null },
      });
    });
  });

  // =========================================================================
  // RF-5: Lista y desbloquea solo alumnos bloqueados propios
  // =========================================================================
  describe('RF-5: Gestión de alumnos bloqueados', () => {
    it('lista y desbloquea alumno reseteando locked_until y failed_login_count', async () => {
      const mockPrisma = {
        student: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue([
            {
              id: studentId,
              user_id: studentUserId,
              birth_date: new Date('2014-05-10'),
              level: Level.A1,
              age_segment: AgeSegment.kids,
              can_switch_interface: false,
              approval_status: ApprovalStatus.approved,
              guardian_name: null,
              guardian_contact: null,
              user: {
                name: 'Carlos',
                email: 'carlos@student.edu',
                locked_until: new Date(Date.now() + 600000),
              },
              memberships: [{ group_id: groupId }],
            },
          ]),
          findFirst: vi.fn().mockResolvedValue({
            id: studentId,
            user_id: studentUserId,
            organization_id: orgId,
          }),
        },
        user: {
          update: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      const list = await studentsService.listLocked(orgId, { offset: 0, limit: 20 });
      expect(list.items.length).toBe(1);
      expect(list.items[0]?.email).toBe('carlos@student.edu');

      // Unlock
      await studentsService.unlockStudent(orgId, studentId);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: studentUserId },
        data: { locked_until: null, failed_login_count: 0 },
      });
    });
  });

  // =========================================================================
  // RF-6 & RF-7: Signup crea User y Student; unicidad global uniforme
  // =========================================================================
  describe('RF-6 & RF-7: Auto-registro de estudiante', () => {
    it('crea exactamente User y Student con estado pending_approval', async () => {
      const mockPrisma = {
        organization: {
          findFirst: vi.fn().mockResolvedValue({ id: orgId, name: 'Pilot' }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            user: {
              create: vi.fn().mockResolvedValue({
                id: studentUserId,
                organization_id: orgId,
                email: 'new@student.edu',
              }),
            },
            student: {
              create: vi.fn().mockResolvedValue({
                id: studentId,
                organization_id: orgId,
                age_segment: AgeSegment.kids,
              }),
            },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = await authService.signup(
        {
          name: 'Ana Gómez',
          email: 'Ana@Student.Edu',
          password: 'Password123',
          birthDate: '2016-03-15',
          guardianName: 'Padre Gómez',
          guardianContact: '3001234567',
          acceptTerms: true,
        },
        '127.0.0.1',
      );

      expect(res).toEqual({ message: 'Recibimos tu solicitud. Revisa tu correo.' });
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'signup-received',
          to: 'ana@student.edu',
        }),
      );
    });

    it('devuelve respuesta uniforme 201 sin duplicar registros si el correo ya existe (RF-7)', async () => {
      const mockPrisma = {
        organization: {
          findFirst: vi.fn().mockResolvedValue({ id: orgId }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'existing-id' }),
        },
        $transaction: vi.fn(),
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = await authService.signup(
        {
          name: 'Ana Gómez',
          email: 'existing@student.edu',
          password: 'Password123',
          birthDate: '2015-01-01',
          acceptTerms: true,
        },
        '127.0.0.1',
      );

      expect(res).toEqual({ message: 'Recibimos tu solicitud. Revisa tu correo.' });
      // Transaction was NOT called, no new records inserted
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // RF-8: Validación de contraseña y fecha civil
  // =========================================================================
  describe('RF-8: Política de contraseña y fecha civil', () => {
    it('valida longitud 8-16 sin espacios y rechaza longitudes 7, 17 o con espacios', () => {
      expect(() => validatePasswordPolicy('1234567')).toThrow(BadRequestException);
      expect(() => validatePasswordPolicy('12345678901234567')).toThrow(BadRequestException);
      expect(() => validatePasswordPolicy('pass word123')).toThrow(BadRequestException);
      expect(() => validatePasswordPolicy(' pass1234')).toThrow(BadRequestException);

      // Valid cases
      expect(() => validatePasswordPolicy('exact8ch')).not.toThrow();
      expect(() => validatePasswordPolicy('sixteencharspass')).not.toThrow();
      expect(() => validatePasswordPolicy('sol-luna-azul')).not.toThrow();

      // Unicode code point length (SPEC-02 §4, §9: RF-8)
      expect(() => validatePasswordPolicy('sol🚀luna')).not.toThrow(); // 8 Unicode characters
      expect(() => validatePasswordPolicy('123456789012345🚀')).not.toThrow(); // 16 Unicode characters
      expect(() => validatePasswordPolicy('🚀🚀🚀🚀🚀🚀🚀🚀')).not.toThrow(); // 8 Unicode emojis
      expect(() => validatePasswordPolicy('sol🚀lun')).toThrow(BadRequestException); // 7 Unicode characters
      expect(() => validatePasswordPolicy('1234567890123456🚀')).toThrow(BadRequestException); // 17 Unicode characters
      expect(() => validatePasswordPolicy('pass\u2000word')).toThrow(BadRequestException); // Unicode whitespace
    });

    it('rechaza fecha civil futura o inválida', () => {
      expect(() => validateCivilBirthDate('invalid-date')).toThrow(BadRequestException);
      expect(() => validateCivilBirthDate('2015-02-30')).toThrow(BadRequestException);
      expect(() => validateCivilBirthDate('2099-01-01')).toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // RF-9: Consulta y edición de alumnos
  // =========================================================================
  describe('RF-9: Consulta y edición de alumnos', () => {
    it('edita nombre y contactos atómicamente', async () => {
      const studentRecord = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        birth_date: new Date('2015-04-12'),
        level: Level.A1,
        age_segment: AgeSegment.kids,
        can_switch_interface: false,
        approval_status: ApprovalStatus.approved,
        guardian_name: 'Antiguo Acudiente',
        guardian_contact: '3001111111',
        user: { name: 'Juan Carlos', email: 'juan@student.edu', locked_until: null },
        memberships: [{ group_id: groupId, left_at: null }],
      };

      const mockPrisma = {
        student: {
          findFirst: vi.fn().mockResolvedValue(studentRecord),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            user: { update: vi.fn().mockResolvedValue({}) },
            student: { update: vi.fn().mockResolvedValue({}) },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      const res = await studentsService.updateStudent(orgId, studentId, {
        name: 'Juan Actualizado',
        guardianName: 'Nuevo Acudiente',
      });

      expect(res.name).toBe('Juan Carlos');
    });

    it('rechaza asignar nivel a alumno pendiente devolviendo 400 VALIDATION_ERROR', async () => {
      const pendingStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        birth_date: new Date('2015-04-12'),
        level: null,
        age_segment: AgeSegment.kids,
        can_switch_interface: false,
        approval_status: ApprovalStatus.pending_approval,
        guardian_name: null,
        guardian_contact: null,
        user: { name: 'Juan', email: 'juan@student.edu', locked_until: null },
      };

      const mockPrisma = {
        student: {
          findFirst: vi.fn().mockResolvedValue(pendingStudent),
        },
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      await expect(
        studentsService.updateStudent(orgId, studentId, { level: Level.A1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza dejar a un alumno aprobado sin nivel con 400 VALIDATION_ERROR', async () => {
      const approvedStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        birth_date: new Date('2015-04-12'),
        level: Level.A1,
        age_segment: AgeSegment.kids,
        can_switch_interface: false,
        approval_status: ApprovalStatus.approved,
        user: { name: 'Juan', email: 'juan@student.edu', locked_until: null },
      };

      const mockPrisma = {
        student: {
          findFirst: vi.fn().mockResolvedValue(approvedStudent),
        },
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      await expect(
        studentsService.updateStudent(orgId, studentId, { level: null as unknown as Level }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza nombre con longitud inválida o vacío con 400 VALIDATION_ERROR', async () => {
      const studentRecord = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        birth_date: new Date('2015-04-12'),
        level: Level.A1,
        age_segment: AgeSegment.kids,
        can_switch_interface: false,
        approval_status: ApprovalStatus.approved,
        user: { name: 'Juan', email: 'juan@student.edu', locked_until: null },
      };

      const mockPrisma = {
        student: {
          findFirst: vi.fn().mockResolvedValue(studentRecord),
        },
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      await expect(
        studentsService.updateStudent(orgId, studentId, { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ParseUUIDPipe en StudentsController rechaza id malformado con 400 VALIDATION_ERROR', async () => {
      const pipe = new ParseUUIDPipe({
        version: '4',
        exceptionFactory: () =>
          new BadRequestException({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'ID debe ser un UUID v4 válido',
          }),
      });

      await expect(pipe.transform('not-a-valid-uuid', { type: 'param' })).rejects.toThrow(
        BadRequestException,
      );

      try {
        await pipe.transform('123-bad', { type: 'param' });
      } catch (err) {
        const ex = err as BadRequestException;
        const res = ex.getResponse() as { statusCode: number; code: string; message: string };
        expect(res.statusCode).toBe(400);
        expect(res.code).toBe('VALIDATION_ERROR');
        expect(res.message).toBe('ID debe ser un UUID v4 válido');
      }
    });
  });

  // =========================================================================
  // RF-10: Aprueba membresía única o rechaza eliminando registros
  // =========================================================================
  describe('RF-10: Aprobación y rechazo de alumnos', () => {
    it('aprueba alumno asignando nivel y membresía activa en grupo', async () => {
      const pendingStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        approval_status: ApprovalStatus.pending_approval,
        birth_date: new Date('2015-04-12'),
        user: { name: 'Juan', email: 'juan@student.edu' },
      };

      const approvedStudent = {
        ...pendingStudent,
        approval_status: ApprovalStatus.approved,
        level: Level.A1,
        age_segment: AgeSegment.kids,
        can_switch_interface: false,
        guardian_name: null,
        guardian_contact: null,
        user: { name: 'Juan', email: 'juan@student.edu', locked_until: null },
        memberships: [{ group_id: groupId, left_at: null }],
      };

      let findCount = 0;
      const mockPrisma = {
        student: {
          findFirst: vi.fn().mockImplementation(() => {
            findCount++;
            return Promise.resolve(findCount === 1 ? pendingStudent : approvedStudent);
          }),
        },
        group: {
          findFirst: vi.fn().mockResolvedValue({
            id: groupId,
            organization_id: orgId,
            archived_at: null,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            student: {
              update: vi.fn().mockResolvedValue(approvedStudent),
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            groupMembership: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      const approved = await studentsService.approveStudent(orgId, studentId, {
        level: Level.A1,
        groupId,
      });

      expect(approved.approvalStatus).toBe(ApprovalStatus.approved);
      expect(approved.groupId).toBe(groupId);
    });

    it('rechazo elimina Student y User sin dejar huérfanos', async () => {
      const mockPrisma = {
        student: {
          findFirst: vi.fn().mockResolvedValue({
            id: studentId,
            user_id: studentUserId,
            organization_id: orgId,
            approval_status: ApprovalStatus.pending_approval,
          }),
        },
        user: {
          delete: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      await studentsService.rejectStudent(orgId, studentId);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: studentUserId },
      });
    });

    it('carrera concurrente en aprobación rechaza la segunda con 409 STUDENT_NOT_PENDING', async () => {
      const pendingStudent = {
        id: studentId,
        user_id: studentUserId,
        organization_id: orgId,
        approval_status: ApprovalStatus.pending_approval,
        birth_date: new Date('2015-04-12'),
        user: { name: 'Juan', email: 'juan@student.edu' },
      };

      const mockPrisma = {
        student: {
          findFirst: vi.fn().mockResolvedValue(pendingStudent),
        },
        group: {
          findFirst: vi.fn().mockResolvedValue({
            id: groupId,
            organization_id: orgId,
            archived_at: null,
          }),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            student: {
              // count: 0 simulates losing the race to approve
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            groupMembership: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const studentsService = new StudentsService(mockPrisma, mockMailService, mockConfigService);
      await expect(
        studentsService.approveStudent(orgId, studentId, {
          level: Level.A1,
          groupId,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // RF-11 & RF-12: Recuperación y consumo de token con revocación de sesiones
  // =========================================================================
  describe('RF-11 & RF-12: Recuperación de contraseña y reset', () => {
    it('forgot-password responde 202 uniforme y genera token de 30 minutos', async () => {
      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: studentUserId,
            organization_id: orgId,
            email: 'carlos@student.edu',
          }),
        },
        passwordResetToken: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = await authService.forgotPassword({ email: 'carlos@student.edu' }, '127.0.0.1');
      expect(res.message).toBe(
        'Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.',
      );
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'password-reset',
          to: 'carlos@student.edu',
        }),
      );
    });

    it('reset-password consume token, revoca todas las sesiones y resetea bloqueo', async () => {
      const rawToken = 'plain-token-string';
      const tokenHash = hashSha256(rawToken);

      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            passwordResetToken: {
              findFirst: vi.fn().mockResolvedValue({
                id: 'token-id',
                organization_id: orgId,
                user_id: studentUserId,
                token_hash: tokenHash,
                used_at: null,
                expires_at: new Date(Date.now() + 100000),
              }),
              update: vi.fn().mockResolvedValue({}),
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            user: {
              update: vi.fn().mockResolvedValue({}),
            },
            authSession: {
              updateMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = await authService.resetPassword({
        token: rawToken,
        newPassword: 'NewPassword123',
      });

      expect(res.message).toBe('Contraseña actualizada. Inicia sesión.');
    });

    it('carrera concurrente en reset-password rechaza la segunda con 400 PASSWORD_RESET_INVALID', async () => {
      const rawToken = 'plain-token-string';
      const tokenHash = hashSha256(rawToken);

      const mockPrisma = {
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            passwordResetToken: {
              findFirst: vi.fn().mockResolvedValue({
                id: 'token-id',
                organization_id: orgId,
                user_id: studentUserId,
                token_hash: tokenHash,
                used_at: null,
                expires_at: new Date(Date.now() + 100000),
              }),
              updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Lost the race!
            },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      await expect(
        authService.resetPassword({
          token: rawToken,
          newPassword: 'NewPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // RF-13 & RF-14: Cambio propio de correo con OTP de 6 dígitos
  // =========================================================================
  describe('RF-13 & RF-14: Cambio de correo y confirmación con OTP', () => {
    it('requestEmailChange valida contraseña actual y genera OTP de 6 dígitos', async () => {
      const passwordHash = await argon2.hash('Secret123');
      const currentUser = {
        id: studentUserId,
        email: 'old@student.edu',
        role: Role.student,
        organizationId: orgId,
        sessionId,
      };

      const mockPrisma = {
        user: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            if (where.id === studentUserId) {
              return { id: studentUserId, password_hash: passwordHash };
            }
            if (where.email === 'new@student.edu') {
              return null; // new email is available
            }
            return null;
          }),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            emailChangeRequest: {
              updateMany: vi.fn().mockResolvedValue({ count: 0 }),
              create: vi.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = await authService.requestEmailChange(
        { newEmail: 'new@student.edu', password: 'Secret123' },
        currentUser,
      );

      expect(res.message).toBe('Enviamos un código a tu nuevo correo.');
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'email-change-otp',
          to: 'new@student.edu',
          variables: expect.objectContaining({
            otp: expect.stringMatching(/^\d{6}$/),
          }),
        }),
      );
    });

    it('confirmEmailChange invalida solicitud tras 3 fallos y revoca otras sesiones tras éxito', async () => {
      const validOtp = '123456';
      const currentUser = {
        id: studentUserId,
        email: 'old@student.edu',
        role: Role.student,
        organizationId: orgId,
        sessionId,
      };

      const mockPrisma = {
        emailChangeRequest: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'req-id',
            user_id: studentUserId,
            new_email: 'new@student.edu',
            otp_hash: hashSha256(validOtp),
            failed_attempts: 0,
            used_at: null,
            expires_at: new Date(Date.now() + 100000),
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            user: {
              findUnique: vi.fn().mockResolvedValue(null),
              update: vi.fn().mockResolvedValue({}),
            },
            emailChangeRequest: {
              update: vi.fn().mockResolvedValue({}),
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            passwordResetToken: { updateMany: vi.fn().mockResolvedValue({}) },
            authSession: { updateMany: vi.fn().mockResolvedValue({}) },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      const res = await authService.confirmEmailChange({ otp: validOtp }, currentUser);
      expect(res.message).toBe('Tu correo fue actualizado.');
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'email-changed',
          to: 'old@student.edu',
        }),
      );
    });

    it('carrera concurrente en confirmEmailChange rechaza la segunda con 400 OTP_INVALID', async () => {
      const validOtp = '123456';
      const currentUser = {
        id: studentUserId,
        email: 'old@student.edu',
        role: Role.student,
        organizationId: orgId,
        sessionId,
      };

      const mockPrisma = {
        emailChangeRequest: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'req-id',
            organization_id: orgId,
            user_id: studentUserId,
            new_email: 'new@student.edu',
            otp_hash: hashSha256(validOtp),
            failed_attempts: 0,
            used_at: null,
            expires_at: new Date(Date.now() + 100000),
          }),
        },
        $transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            emailChangeRequest: {
              updateMany: vi.fn().mockResolvedValue({ count: 0 }), // Lost the race!
            },
          };
          return cb(tx);
        }),
      } as unknown as PrismaService;

      const authService = new AuthService(
        mockPrisma,
        mockConfigService,
        jwtService,
        mockMailService,
        rateLimiter,
      );

      await expect(
        authService.confirmEmailChange({ otp: validOtp }, currentUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // RF-15: Guards aíslan Student y AuthSession
  // =========================================================================
  describe('RF-15: Guards de autenticación y autorización', () => {
    it('JwtAuthGuard rechaza token con sesión revocada o discrepancia de tenant', async () => {
      const token = jwtService.sign(
        { sub: studentUserId, email: 'carlos@student.edu', role: Role.student, org: orgId, sid: sessionId },
        { secret: JWT_SECRET },
      );

      const mockPrisma = {
        authSession: {
          findFirst: vi.fn().mockResolvedValue({
            id: sessionId,
            user_id: studentUserId,
            organization_id: otherOrgId, // Discordant tenant!
            revoked_at: null,
            expires_at: new Date(Date.now() + 100000),
          }),
        },
      } as unknown as PrismaService;

      const guard = new JwtAuthGuard(
        new Reflector(),
        jwtService,
        mockConfigService,
        mockPrisma,
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { englove_access_token: token },
            headers: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as import('@nestjs/common').ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('JwtAuthGuard bloquea JWT sintético de estudiante sin student_id cuando el alumno no está aprobado', async () => {
      // Synthetic token without student_id in payload
      const token = jwtService.sign(
        { sub: studentUserId, email: 'carlos@student.edu', role: Role.student, org: orgId, sid: sessionId },
        { secret: JWT_SECRET },
      );

      const mockPrisma = {
        authSession: {
          findFirst: vi.fn().mockResolvedValue({
            id: sessionId,
            user_id: studentUserId,
            organization_id: orgId,
            revoked_at: null,
            expires_at: new Date(Date.now() + 100000),
          }),
        },
        student: {
          findFirst: vi.fn().mockResolvedValue({
            id: studentId,
            user_id: studentUserId,
            organization_id: orgId,
            approval_status: ApprovalStatus.pending_approval, // Not yet approved
          }),
        },
      } as unknown as PrismaService;

      const guard = new JwtAuthGuard(
        new Reflector(),
        jwtService,
        mockConfigService,
        mockPrisma,
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { englove_access_token: token },
            headers: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as import('@nestjs/common').ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it('RolesGuard permite rol autorizado y rechaza no autorizado con 403', () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.teacher]);
      const guard = new RolesGuard(reflector);

      const studentContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.student },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as import('@nestjs/common').ExecutionContext;

      expect(() => guard.canActivate(studentContext)).toThrow(ForbiddenException);

      const teacherContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.teacher },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as import('@nestjs/common').ExecutionContext;

      expect(guard.canActivate(teacherContext)).toBe(true);
    });
  });

  // =========================================================================
  // RF-16: Rate limiter con Retry-After y OriginGuard
  // =========================================================================
  describe('RF-16: Rate limiter y OriginGuard', () => {
    it('RateLimiter lanza RateLimitedException con Retry-After exacto al superar límite', () => {
      const limiter = new RateLimiterService();
      const key = 'test:rate:limit';

      // 5 requests allowed in 60s
      for (let i = 0; i < 5; i++) {
        expect(() => limiter.check(key, 5, 60000)).not.toThrow();
      }

      // 6th request should fail with RateLimitedException
      try {
        limiter.check(key, 5, 60000);
        expect.unreachable('Should have thrown RateLimitedException');
      } catch (err) {
        const ex = err as RateLimitedException;
        expect(ex.getStatus()).toBe(429);
        expect(ex.retryAfter).toBeGreaterThanOrEqual(1);
        expect(ex.retryAfter).toBeLessThanOrEqual(60);
      }
    });

    it('OriginGuard rechaza mutaciones con Origin faltante o ajeno y permite lecturas', () => {
      const guard = new OriginGuard(mockConfigService);

      const mutatingGet = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            headers: {},
          }),
        }),
      } as unknown as import('@nestjs/common').ExecutionContext;
      expect(guard.canActivate(mutatingGet)).toBe(true);

      const mutatingNoOrigin = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            headers: {},
          }),
        }),
      } as unknown as import('@nestjs/common').ExecutionContext;
      expect(() => guard.canActivate(mutatingNoOrigin)).toThrow(ForbiddenException);

      const mutatingForeignOrigin = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            headers: { origin: 'http://malicious.site.com' },
          }),
        }),
      } as unknown as import('@nestjs/common').ExecutionContext;
      expect(() => guard.canActivate(mutatingForeignOrigin)).toThrow(ForbiddenException);

      const mutatingValidOrigin = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            headers: { origin: 'http://localhost:3000' },
          }),
        }),
      } as unknown as import('@nestjs/common').ExecutionContext;
      expect(guard.canActivate(mutatingValidOrigin)).toBe(true);
    });
  });

  // =========================================================================
  // RF-21: Limpieza nocturna idempotente (JobRunStatus)
  // =========================================================================
  describe('RF-21: Mantenimiento nocturno y limpieza de sesiones', () => {
    it('limpia bloqueos vencidos, tokens viejos y sesiones de 30 días registrando en ScheduledJobRun', async () => {
      const mockPrisma = {
        organization: {
          findMany: vi.fn().mockResolvedValue([{ id: orgId, name: 'Pilot' }]),
        },
        scheduledJobRun: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'job-1' }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
        authSession: {
          deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
        },
        passwordResetToken: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        emailChangeRequest: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      } as unknown as PrismaService;

      const maintenance = new MaintenanceService(mockPrisma);
      await maintenance.runIdentityMaintenance('2026-10-21');

      expect(mockPrisma.scheduledJobRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            job_key: 'identity_maintenance',
            period_key: '2026-10-21',
            status: 'running',
          }),
        }),
      );

      // Cleans locks
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          organization_id: orgId,
          locked_until: { lte: expect.any(Date) },
        },
        data: { locked_until: null, failed_login_count: 0 },
      });

      // Cleans 30-day revoked/expired sessions
      expect(mockPrisma.authSession.deleteMany).toHaveBeenCalled();

      // Updates job run to done
      expect(mockPrisma.scheduledJobRun.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: orgId,
            job_key: 'identity_maintenance',
            period_key: '2026-10-21',
          }),
          data: expect.objectContaining({
            status: 'done',
          }),
        }),
      );
    });

    it('ignora error P2002 por colisión concurrente al crear ScheduledJobRun sin fallar', async () => {
      const p2002Error = new Error('Unique constraint failed');
      (p2002Error as unknown as { code: string }).code = 'P2002';

      const mockPrisma = {
        organization: {
          findMany: vi.fn().mockResolvedValue([{ id: orgId, name: 'Pilot' }]),
        },
        scheduledJobRun: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockRejectedValue(p2002Error),
        },
        user: {
          updateMany: vi.fn(),
        },
      } as unknown as PrismaService;

      const maintenance = new MaintenanceService(mockPrisma);
      await expect(maintenance.runIdentityMaintenance('2026-10-21')).resolves.not.toThrow();
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });
  });
});
