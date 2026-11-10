import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppMinVersionMiddleware } from '../src/common/middleware/app-min-version.middleware';
import { AttemptsService } from '../src/attempts/attempts.service';
import { MediaService } from '../src/media/media.service';
import { StatsService } from '../src/stats/stats.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ScoringService } from '../src/scoring/scoring.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import {
  AttemptStatus,
  ActivityType,
  Level,
  AgeSegment,
} from '@englove/shared';

describe('SPEC-09: PWA, offline y accesibilidad — API (RF-7, RF-16, RF-17)', () => {
  describe('RF-7: Header X-App-Min-Version expuesto por CORS', () => {
    it('incluye X-App-Min-Version cuando APP_MIN_VERSION está configurada', () => {
      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'APP_MIN_VERSION') return '1.2.0';
          return null;
        }),
      } as unknown as ConfigService;

      const middleware = new AppMinVersionMiddleware(configService);
      const req = {} as any;
      const headersSet: Record<string, string> = {};
      const res = {
        setHeader: vi.fn((k: string, v: string) => {
          headersSet[k] = v;
        }),
      } as any;
      const next = vi.fn();

      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(headersSet['X-App-Min-Version']).toBe('1.2.0');
    });

    it('no incluye X-App-Min-Version cuando APP_MIN_VERSION no está configurada', () => {
      const configService = {
        get: vi.fn(() => null),
      } as unknown as ConfigService;

      const middleware = new AppMinVersionMiddleware(configService);
      const req = {} as any;
      const headersSet: Record<string, string> = {};
      const res = {
        setHeader: vi.fn((k: string, v: string) => {
          headersSet[k] = v;
        }),
      } as any;
      const next = vi.fn();

      middleware.use(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(headersSet['X-App-Min-Version']).toBeUndefined();
    });
  });

  describe('RF-16: Marca offline_sync en entregas tardías (cierre + 24 h)', () => {
    const orgId = '11111111-1111-1111-1111-111111111111';
    const studentId = '22222222-2222-2222-2222-222222222222';
    const attemptId = '44444444-4444-4444-4444-444444444444';
    const jwtSecret = 'test-secret-at-least-32-chars-long-local!';
    let jwtService: JwtService;

    beforeEach(() => {
      jwtService = new JwtService({ secret: jwtSecret });
    });

    it('POST /attempts/:id/events tras ventana con token auténtico marca offline_sync y responde 409 ATTEMPT_CLOSED', async () => {
      const pastDue = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago (past due + 24h)
      const mockAttempt = {
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        flags: [],
        started_at: new Date(Date.now() - 50 * 60 * 60 * 1000),
        assignment: {
          due_at: pastDue,
        },
        previous_attempt: null,
      };

      const updateMock = vi.fn().mockResolvedValue({});
      const prismaMock = {
        attempt: {
          findFirst: vi.fn().mockResolvedValue(mockAttempt),
          update: updateMock,
        },
      } as unknown as PrismaService;

      const configMock = {
        get: vi.fn(() => jwtSecret),
      } as unknown as ConfigService;

      const attemptsService = new AttemptsService(
        prismaMock,
        configMock,
        jwtService,
        {} as ScoringService,
        {} as GamificationService,
        {} as MediaService,
        {} as FeatureFlagsService,
      );

      // Authentic attemptToken
      const authenticToken = jwtService.sign({
        attemptId,
        studentId,
        organizationId: orgId,
        typ: 'attempt',
      });

      await expect(
        attemptsService.submitEvents(orgId, studentId, attemptId, authenticToken, {
          events: [{ clientEventId: 'evt-1', itemId: 'item-1', answer: 'hello' }],
        }),
      ).rejects.toThrow(ConflictException);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.abandoned,
          flags: ['offline_sync'],
        },
      });
    });

    it('POST /attempts/:id/events no duplica offline_sync si el intento ya lo tenía', async () => {
      const pastDue = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const mockAttempt = {
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.abandoned,
        flags: ['offline_sync'],
        started_at: new Date(Date.now() - 50 * 60 * 60 * 1000),
        assignment: { due_at: pastDue },
        previous_attempt: null,
      };

      const updateMock = vi.fn().mockResolvedValue({});
      const prismaMock = {
        attempt: {
          findFirst: vi.fn().mockResolvedValue(mockAttempt),
          update: updateMock,
        },
      } as unknown as PrismaService;

      const configMock = { get: vi.fn(() => jwtSecret) } as unknown as ConfigService;
      const attemptsService = new AttemptsService(
        prismaMock,
        configMock,
        jwtService,
        {} as ScoringService,
        {} as GamificationService,
        {} as MediaService,
        {} as FeatureFlagsService,
      );

      const authenticToken = jwtService.sign({ attemptId, studentId, organizationId: orgId, typ: 'attempt' });

      await expect(
        attemptsService.submitEvents(orgId, studentId, attemptId, authenticToken, {
          events: [{ clientEventId: 'evt-2', itemId: 'item-1', answer: 'world' }],
        }),
      ).rejects.toThrow(ConflictException);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.abandoned,
          flags: ['offline_sync'], // Not duplicated
        },
      });
    });

    it('POST /attempts/:id/events con token alterado devuelve 401 y NO modifica el intento', async () => {
      const pastDue = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const mockAttempt = {
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        flags: [],
        started_at: new Date(Date.now() - 50 * 60 * 60 * 1000),
        assignment: { due_at: pastDue },
        previous_attempt: null,
      };

      const updateMock = vi.fn();
      const prismaMock = {
        attempt: {
          findFirst: vi.fn().mockResolvedValue(mockAttempt),
          update: updateMock,
        },
      } as unknown as PrismaService;

      const configMock = { get: vi.fn(() => jwtSecret) } as unknown as ConfigService;
      const attemptsService = new AttemptsService(
        prismaMock,
        configMock,
        jwtService,
        {} as ScoringService,
        {} as GamificationService,
        {} as MediaService,
        {} as FeatureFlagsService,
      );

      // Tampered token with wrong secret
      const fakeToken = new JwtService({ secret: 'wrong-secret-12345678901234567890' }).sign({
        attemptId,
        studentId,
        organizationId: orgId,
        typ: 'attempt',
      });

      await expect(
        attemptsService.submitEvents(orgId, studentId, attemptId, fakeToken, {
          events: [{ clientEventId: 'evt-1', itemId: 'item-1', answer: 'hack' }],
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('POST /attempts/:id/complete tras ventana con token auténtico marca offline_sync y responde 409', async () => {
      const pastDue = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const mockAttempt = {
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        flags: [],
        started_at: new Date(Date.now() - 50 * 60 * 60 * 1000),
        assignment: {
          due_at: pastDue,
          activity: { type: ActivityType.fill_blank },
        },
        previous_attempt: null,
      };

      const updateMock = vi.fn().mockResolvedValue({});
      const prismaMock = {
        attempt: {
          findFirst: vi.fn().mockResolvedValue(mockAttempt),
          update: updateMock,
        },
      } as unknown as PrismaService;

      const configMock = { get: vi.fn(() => jwtSecret) } as unknown as ConfigService;
      const attemptsService = new AttemptsService(
        prismaMock,
        configMock,
        jwtService,
        {} as ScoringService,
        {} as GamificationService,
        {} as MediaService,
        {} as FeatureFlagsService,
      );

      const authenticToken = jwtService.sign({ attemptId, studentId, organizationId: orgId, typ: 'attempt' });

      await expect(
        attemptsService.completeAttempt(orgId, studentId, attemptId, authenticToken, {}),
      ).rejects.toThrow(ConflictException);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.abandoned,
          flags: ['offline_sync'],
        },
      });
    });

    it('POST /media/upload-url tras ventana marca offline_sync y responde 409', async () => {
      const pastDue = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const mockAttempt = {
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        flags: [],
        assignment: {
          due_at: pastDue,
          activity: { type: ActivityType.speaking },
        },
        previous_attempt: null,
      };

      const updateMock = vi.fn().mockResolvedValue({});
      const prismaMock = {
        attempt: {
          findFirst: vi.fn().mockResolvedValue(mockAttempt),
          update: updateMock,
        },
      } as unknown as PrismaService;

      const mediaService = new MediaService(
        prismaMock,
        {
          get: vi.fn((k: string) => {
            if (k === 'R2_ACCOUNT_ID') return 'acc-id';
            if (k === 'R2_ACCESS_KEY_ID') return 'key-id';
            if (k === 'R2_SECRET_ACCESS_KEY') return 'secret';
            if (k === 'R2_BUCKET_NAME') return 'bucket';
            return '';
          }),
        } as unknown as ConfigService,
      );

      await expect(
        mediaService.createUploadUrl(orgId, studentId, {
          attemptId,
          mimeType: 'audio/webm',
          sizeBytes: 1024,
        }),
      ).rejects.toThrow(ConflictException);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.abandoned,
          flags: ['offline_sync'],
        },
      });
    });
  });

  describe('RF-17: GET /stats/students/:id incluye offlineUndeliveredAttempts', () => {
    const orgId = '11111111-1111-1111-1111-111111111111';
    const studentId = '22222222-2222-2222-2222-222222222222';

    it('expone offlineUndeliveredAttempts ordenados por startedAt descendente con completeUntil', async () => {
      const studentMock = {
        id: studentId,
        user: { name: 'Juan Alumno' },
        level: Level.A1,
        age_segment: AgeSegment.kids,
        created_at: new Date('2026-09-01T00:00:00Z'),
        memberships: [],
      };

      const now = new Date();
      const att1Date = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const att2Date = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const due1 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      const offlineAttempts = [
        {
          id: 'att-late-1',
          assignment_id: 'asg-1',
          started_at: att1Date,
          assignment: {
            due_at: due1,
            activity: { title: 'Animals Fill Blank', type: ActivityType.fill_blank },
          },
          previous_attempt: null,
        },
        {
          id: 'att-late-2',
          assignment_id: 'asg-2',
          started_at: att2Date,
          assignment: {
            due_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
            activity: { title: 'Speaking Greeting', type: ActivityType.speaking },
          },
          previous_attempt: null,
        },
      ];

      const prismaMock = {
        student: {
          findFirst: vi.fn().mockResolvedValue(studentMock),
        },
        attempt: {
          findMany: vi.fn((args: any) => {
            // If checking offline_sync attempts
            if (args.where?.flags?.has === 'offline_sync') {
              return Promise.resolve(offlineAttempts);
            }
            // Graded attempts
            return Promise.resolve([]);
          }),
        },
        progressEvent: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        assignment: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;

      const gamificationMock = {
        computeStreakState: vi.fn().mockResolvedValue({
          weeks: 0,
          bestWeeks: 0,
          forgivenessAvailable: true,
        }),
        calculateStreak: vi.fn().mockResolvedValue({
          weeks: 0,
          forgivenessAvailable: true,
        }),
        getBogotaIsoWeekKey: vi.fn().mockReturnValue('2026-W44'),
      } as unknown as GamificationService;

      const statsService = new StatsService(prismaMock, gamificationMock);

      const stats = await statsService.getStudentStats(orgId, studentId, {});
      expect(stats.consistency.offlineUndeliveredAttempts).toHaveLength(2);
      expect(stats.consistency.offlineUndeliveredAttempts[0]).toEqual({
        attemptId: 'att-late-1',
        assignmentId: 'asg-1',
        activityTitle: 'Animals Fill Blank',
        activityType: ActivityType.fill_blank,
        startedAt: att1Date.toISOString(),
        completeUntil: new Date(due1.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    });
  });
});
