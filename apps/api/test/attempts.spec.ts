import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttemptsService } from '../src/attempts/attempts.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ScoringService } from '../src/scoring/scoring.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { MediaService } from '../src/media/media.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import {
  ActivityType,
  ActivityStatus,
  AttemptStatus,
  Level,
} from '@englove/shared';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

type MockFn = ReturnType<typeof vi.fn>;

describe('SPEC-05: AttemptsService & Ciclo de Vida de Intentos (RF-1 a RF-11)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const studentId = '22222222-2222-4222-8222-222222222222';
  const groupId = '66666666-6666-4666-8666-666666666666';
  const assignmentId = '33333333-3333-4333-8333-333333333333';
  const attemptId = '44444444-4444-4444-8444-444444444444';
  const activityId = '55555555-5555-4555-8555-555555555555';
  const validToken = 'valid.jwt.token';

  let service: AttemptsService;
  let mockPrisma: {
    student: { findFirst: MockFn };
    assignment: { findFirst: MockFn };
    attempt: {
      findFirst: MockFn;
      findMany: MockFn;
      create: MockFn;
      update: MockFn;
    };
    progressEvent: { create: MockFn; findMany: MockFn };
    fillBlankDetail: { findFirst: MockFn };
    examDetail: { findFirst: MockFn };
  };
  let mockConfigService: { get: MockFn };
  let mockJwtService: { sign: MockFn; verify: MockFn };
  let mockScoringService: {
    calculateFillBlank: MockFn;
    calculateExam: MockFn;
    scoreToStars: MockFn;
  };
  let mockGamificationService: {
    recordAttemptCompleted: MockFn;
    recordAudioSubmitted: MockFn;
    calculateStreak: MockFn;
    evaluateBadges: MockFn;
  };
  let mockMediaService: { confirmUpload: MockFn };
  let mockFeatureFlagsService: { isEnabled: MockFn };

  beforeEach(() => {
    mockPrisma = {
      student: {
        findFirst: vi.fn().mockResolvedValue({
          id: studentId,
          organization_id: orgId,
          memberships: [
            {
              group_id: groupId,
              left_at: null,
            },
          ],
        }),
      },
      assignment: {
        findFirst: vi.fn().mockResolvedValue({
          id: assignmentId,
          organization_id: orgId,
          group_id: groupId,
          opens_at: new Date(Date.now() - 3600000), // 1h ago
          due_at: new Date(Date.now() + 86400000), // in 24h
          cancelled_at: null,
          activity: {
            id: activityId,
            title: 'Fill blank practice',
            type: ActivityType.fill_blank,
            level: Level.A1,
            status: ActivityStatus.published,
            fill_blank_detail: {
              config: { items: [] },
            },
          },
        }),
      },
      attempt: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({
          id: attemptId,
          organization_id: orgId,
          student_id: studentId,
          assignment_id: assignmentId,
          attempt_number: 1,
          status: AttemptStatus.in_progress,
          started_at: new Date(Date.now() - 60000),
          finished_at: null,
          graded_at: null,
          score: null,
          flags: [],
          payload: { answers: {} },
          assignment: {
            id: assignmentId,
            due_at: new Date(Date.now() + 86400000),
            activity: {
              id: activityId,
              title: 'Fill blank practice',
              type: ActivityType.fill_blank,
              level: Level.A1,
              fill_blank_detail: {
                config: { items: [] },
              },
            },
          },
          previous_attempt: null,
        }),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: attemptId,
          ...data,
          started_at: new Date(),
          finished_at: null,
          graded_at: null,
          score: null,
          flags: [],
          assignment: {
            due_at: new Date(Date.now() + 86400000),
            activity: {
              id: activityId,
              title: 'Fill blank practice',
              type: ActivityType.fill_blank,
              level: Level.A1,
              fill_blank_detail: {
                config: { items: [] },
              },
            },
          },
        })),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: attemptId,
          organization_id: orgId,
          student_id: studentId,
          assignment_id: assignmentId,
          attempt_number: 1,
          status: data.status ?? AttemptStatus.in_progress,
          started_at: new Date(Date.now() - 60000),
          finished_at: data.finished_at ?? null,
          graded_at: data.graded_at ?? null,
          score: data.score ?? null,
          flags: data.flags ?? [],
          payload: data.payload ?? { answers: {} },
          assignment: {
            due_at: new Date(Date.now() + 86400000),
            activity: {
              id: activityId,
              title: 'Fill blank practice',
              type: ActivityType.fill_blank,
              level: Level.A1,
            },
          },
        })),
      },
      progressEvent: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'pe-1' }),
      },
      fillBlankDetail: {
        findFirst: vi.fn().mockResolvedValue({
          answer_key: { items: {} },
        }),
      },
      examDetail: {
        findFirst: vi.fn().mockResolvedValue({
          answer_key: { items: {} },
        }),
      },
    };

    mockConfigService = {
      get: vi.fn((_key: string, def?: string) => def ?? 'test-secret'),
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue(validToken),
      verify: vi.fn().mockReturnValue({
        attemptId,
        studentId,
        organizationId: orgId,
      }),
    };

    mockScoringService = {
      calculateFillBlank: vi.fn().mockReturnValue({
        score: 4.5,
        fraction: 0.9,
        correction: {},
        flags: [],
      }),
      calculateExam: vi.fn().mockReturnValue({
        score: 5.0,
        fraction: 1.0,
        correction: {},
        flags: [],
      }),
      scoreToStars: vi.fn().mockReturnValue(3),
    };

    mockGamificationService = {
      recordAttemptCompleted: vi.fn().mockResolvedValue([]),
      recordAudioSubmitted: vi.fn().mockResolvedValue([]),
      calculateStreak: vi.fn().mockResolvedValue({
        weeks: 1,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: '2026-W42',
      }),
      evaluateBadges: vi.fn().mockResolvedValue([]),
    };

    mockMediaService = {
      confirmUpload: vi.fn().mockResolvedValue({ id: 'media-1' }),
    };

    mockFeatureFlagsService = {
      isEnabled: vi.fn().mockResolvedValue(true),
    };

    service = new AttemptsService(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
      mockJwtService as unknown as JwtService,
      mockScoringService as unknown as ScoringService,
      mockGamificationService as unknown as GamificationService,
      mockMediaService as unknown as MediaService,
      mockFeatureFlagsService as unknown as FeatureFlagsService,
    );
  });

  describe('startAttempt (RF-1 a RF-4)', () => {
    it('inicia intento correctamente y devuelve token firmado', async () => {
      const runtime = await service.startAttempt(orgId, studentId, assignmentId);

      expect(runtime.attemptToken).toBe(validToken);
      expect(runtime.attempt.id).toBe(attemptId);
      expect(runtime.attempt.status).toBe(AttemptStatus.in_progress);
      expect(mockPrisma.attempt.create).toHaveBeenCalled();
    });

    it('rechaza con 404 si la asignación no existe', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.startAttempt(orgId, studentId, assignmentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza con 409 si la asignación aún no abre (opens_at en futuro)', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValueOnce({
        id: assignmentId,
        organization_id: orgId,
        group_id: groupId,
        opens_at: new Date(Date.now() + 3600000), // in 1h
        due_at: new Date(Date.now() + 86400000),
        cancelled_at: null,
        activity: {
          id: activityId,
          status: ActivityStatus.published,
        },
      });

      await expect(
        service.startAttempt(orgId, studentId, assignmentId),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza con 409 si la ventana de tolerancia (+24h) ha vencido', async () => {
      mockPrisma.assignment.findFirst.mockResolvedValueOnce({
        id: assignmentId,
        organization_id: orgId,
        group_id: groupId,
        opens_at: new Date(Date.now() - 100000000),
        due_at: new Date(Date.now() - 30 * 3600 * 1000), // due 30h ago (exceeds +24h tolerance)
        cancelled_at: null,
        activity: {
          id: activityId,
          status: ActivityStatus.published,
        },
      });

      await expect(
        service.startAttempt(orgId, studentId, assignmentId),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza con 409 si el alumno ya completó intento 1 y no tiene reintento habilitado', async () => {
      mockPrisma.attempt.findMany.mockResolvedValueOnce([
        {
          id: 'prev-attempt',
          attempt_number: 1,
          status: AttemptStatus.graded,
          retry_granted_at: null,
        },
      ]);

      await expect(
        service.startAttempt(orgId, studentId, assignmentId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getAttempt (RF-5, RF-6, Decisión 75)', () => {
    it('obtiene estado de ejecución sin incluir jamás el answer_key', async () => {
      const runtime = await service.getAttempt(orgId, studentId, attemptId);

      expect(runtime.attempt.id).toBe(attemptId);
      expect('answer_key' in runtime.activity).toBe(false);
      expect('answerKey' in runtime.activity).toBe(false);
    });

    it('rechaza con 404 si el intento no existe o pertenece a otro estudiante', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.getAttempt(orgId, 'other-student', attemptId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitEvents y deduplicación (RF-7, RF-8)', () => {
    it('deduplica eventos por clientEventId y no procesa repetidos', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.in_progress,
        payload: {
          answers: { 'item-1': 'cat' },
          processedEventIds: ['ev-1'],
        },
        assignment: {
          due_at: new Date(Date.now() + 86400000),
        },
      });

      const response = await service.submitEvents(orgId, studentId, attemptId, validToken, {
        events: [
          { itemId: 'item-1', answer: 'wrong', clientEventId: 'ev-1' }, // repetido, no debe sobreescribir
          { itemId: 'item-2', answer: 'dog', clientEventId: 'ev-2' }, // nuevo
        ],
      });

      expect(response.acceptedEventIds).toContain('ev-1');
      expect(response.acceptedEventIds).toContain('ev-2');
      expect(mockPrisma.attempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: attemptId },
          data: {
            payload: {
              answers: { 'item-1': 'cat', 'item-2': 'dog' },
              processedEventIds: ['ev-1', 'ev-2'],
            },
          },
        }),
      );
    });
  });

  describe('completeAttempt y autocalificación vs revisión (RF-9, RF-10, Decisión 100)', () => {
    it('autocalifica inmediatamente actividades fill_blank marcándolas como graded', async () => {
      const completion = await service.completeAttempt(orgId, studentId, attemptId, validToken, {});

      expect(completion.attempt.status).toBe(AttemptStatus.graded);
      expect(mockScoringService.calculateFillBlank).toHaveBeenCalled();
      expect(mockGamificationService.recordAttemptCompleted).toHaveBeenCalledWith(
        orgId,
        studentId,
        attemptId,
        4.5,
      );
    });

    it('marca pending_review con score null para open_question (no autocalificado)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        organization_id: orgId,
        student_id: studentId,
        assignment_id: assignmentId,
        status: AttemptStatus.in_progress,
        started_at: new Date(Date.now() - 60000),
        assignment: {
          due_at: new Date(Date.now() + 86400000),
          activity: {
            id: activityId,
            type: ActivityType.open_question,
            title: 'Open question',
            level: Level.A1,
            open_question_detail: { config: {} },
          },
        },
      });

      const completion = await service.completeAttempt(orgId, studentId, attemptId, validToken, {});

      expect(completion.attempt.status).toBe(AttemptStatus.pending_review);
      expect(mockGamificationService.recordAttemptCompleted).toHaveBeenCalledWith(
        orgId,
        studentId,
        attemptId,
        null, // Decisión 100: value = null para open_question
      );
    });
  });
});
