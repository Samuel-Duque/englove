import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoringService } from '../src/scoring/scoring.service';
import { AttemptsService } from '../src/attempts/attempts.service';
import {
  ActivityType,
  AttemptStatus,
  GameMechanic,
  GameConfig,
  GameAnswerKey,
  Level,
} from '@englove/shared';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GamificationService } from '../src/gamification/gamification.service';
import { MediaService } from '../src/media/media.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';

interface ItemCorrection {
  correct: boolean;
  expected: unknown;
  submitted: unknown;
}

interface MemoryCorrection {
  summary: {
    foundPairs: number;
    totalPairs: number;
    failedSelections: number;
  };
  pairs: Array<[string, string]>;
}

describe('SPEC-06 Microjuegos — ScoringService y AttemptsService (RF-7, RF-8, Decisiones 104 y 106)', () => {
  let scoringService: ScoringService;

  beforeEach(() => {
    scoringService = new ScoringService();
  });

  describe('RF-7 & RF-8: Scorers de servidor por GameMechanic', () => {
    it('match: califica aciertos sobre left y no permite duplicar right', () => {
      const config: GameConfig = {
        mechanic: GameMechanic.match,
        settings: {
          left: [
            { id: 'l1', text: 'Cat' },
            { id: 'l2', text: 'Dog' },
            { id: 'l3', text: 'Bird' },
          ],
          right: [
            { id: 'r1', text: 'Gato' },
            { id: 'r2', text: 'Perro' },
            { id: 'r3', text: 'Pájaro' },
          ],
        },
      };

      const answerKey: GameAnswerKey = {
        solution: {
          pairs: { l1: 'r1', l2: 'r2', l3: 'r3' },
        },
      };

      // 3 of 3 correct
      const resFull = scoringService.calculateGame(config, answerKey, {
        pairs: { l1: 'r1', l2: 'r2', l3: 'r3' },
      });
      expect(resFull.fraction).toBe(1.0);
      expect(resFull.score).toBe(5.0);
      expect((resFull.correction['l1'] as ItemCorrection).correct).toBe(true);

      // Attempting to reuse r1 for multiple lefts
      const resReuse = scoringService.calculateGame(config, answerKey, {
        pairs: { l1: 'r1', l2: 'r1', l3: 'r3' },
      });
      // only l1 and l3 can be counted
      expect(resReuse.fraction).toBeCloseTo(2 / 3);
      expect(resReuse.score).toBe(3.3);
      expect((resReuse.correction['l2'] as ItemCorrection).correct).toBe(false);
    });

    it('order_words: tokens con texto idéntico intercambiados otorgan 100% (SPEC-06 RF-7)', () => {
      const config: GameConfig = {
        mechanic: GameMechanic.order_words,
        settings: {
          tokens: [
            { id: 't-the-1', text: 'The' },
            { id: 't-the-2', text: 'The' },
            { id: 't-dog', text: 'dog' },
          ],
        },
      };

      const answerKey: GameAnswerKey = {
        solution: {
          tokenIds: ['t-the-1', 't-dog', 't-the-2'],
        },
      };

      // Swap t-the-1 and t-the-2
      const res = scoringService.calculateGame(config, answerKey, {
        tokenIds: ['t-the-2', 't-dog', 't-the-1'],
      });
      expect(res.fraction).toBe(1.0);
      expect(res.score).toBe(5.0);
      expect((res.correction['pos_0'] as ItemCorrection).correct).toBe(true);
      expect((res.correction['pos_1'] as ItemCorrection).correct).toBe(true);
      expect((res.correction['pos_2'] as ItemCorrection).correct).toBe(true);
    });

    it('order_words: maneja defensivamente respuestas vacías sin fallar', () => {
      const config: GameConfig = {
        mechanic: GameMechanic.order_words,
        settings: {
          tokens: [
            { id: 't1', text: 'Hello' },
            { id: 't2', text: 'World' },
          ],
        },
      };
      const answerKey: GameAnswerKey = {
        solution: { tokenIds: ['t1', 't2'] },
      };

      const res = scoringService.calculateGame(config, answerKey, {});
      expect(res.fraction).toBe(0);
      expect(res.score).toBe(0.0);
      expect((res.correction['pos_0'] as ItemCorrection).correct).toBe(false);
      expect((res.correction['pos_0'] as ItemCorrection).submitted).toBeNull();
    });

    it('drag_drop: califica ubicación de objetos en contenedores destino', () => {
      const config: GameConfig = {
        mechanic: GameMechanic.drag_drop,
        settings: {
          objects: [
            { id: 'o1', text: 'Apple' },
            { id: 'o2', text: 'Banana' },
            { id: 'o3', text: 'Dog' },
            { id: 'o4', text: 'Cat' },
          ],
          targets: [
            { id: 'c1', text: 'Fruits' },
            { id: 'c2', text: 'Animals' },
          ],
        },
      };

      const answerKey: GameAnswerKey = {
        solution: {
          placements: { o1: 'c1', o2: 'c1', o3: 'c2', o4: 'c2' },
        },
      };

      const res = scoringService.calculateGame(config, answerKey, {
        placements: { o1: 'c1', o2: 'c2', o3: 'c2', o4: 'c2' }, // 3 correct of 4
      });
      expect(res.fraction).toBe(0.75);
      expect(res.score).toBe(3.8); // 0.75 * 5 = 3.75 -> 3.8
      expect((res.correction['o1'] as ItemCorrection).correct).toBe(true);
      expect((res.correction['o2'] as ItemCorrection).correct).toBe(false);
    });

    it('memory: 4 pares con 1 fallo calcula 4.0 ignorando jugadas posteriores a cartas resueltas (SPEC-06 RF-7)', () => {
      const config: GameConfig = {
        mechanic: GameMechanic.memory,
        settings: {
          cards: [
            { id: 'c1', text: 'Dog' },
            { id: 'c2', text: 'Perro' },
            { id: 'c3', text: 'Cat' },
            { id: 'c4', text: 'Gato' },
            { id: 'c5', text: 'Sun' },
            { id: 'c6', text: 'Sol' },
            { id: 'c7', text: 'Moon' },
            { id: 'c8', text: 'Luna' },
          ],
        },
      };

      const answerKey: GameAnswerKey = {
        solution: {
          pairs: [
            ['c1', 'c2'],
            ['c3', 'c4'],
            ['c5', 'c6'],
            ['c7', 'c8'],
          ],
        },
      };

      // Turn sequence:
      // Turn 1: [c1, c3] -> fail (1 fail)
      // Turn 2: [c1, c2] -> match (pair 1)
      // Turn 3: [c3, c4] -> match (pair 2)
      // Turn 4: [c5, c6] -> match (pair 3)
      // Turn 5: [c7, c8] -> match (pair 4)
      // Spurious extra plays touching already resolved c1, c2 -> should be ignored!
      // Turn 6: [c1, c7] -> already resolved, ignored
      const selections: Array<[string, string]> = [
        ['c1', 'c3'],
        ['c1', 'c2'],
        ['c3', 'c4'],
        ['c5', 'c6'],
        ['c7', 'c8'],
        ['c1', 'c7'],
      ];

      const res = scoringService.calculateGame(config, answerKey, { selections });
      // 4 found / (4 total + 1 fail) = 4 / 5 = 0.8
      // 0.8 * 5 = 4.0
      expect(res.fraction).toBe(0.8);
      expect(res.score).toBe(4.0);
      const memCorr = res.correction as unknown as MemoryCorrection;
      expect(memCorr.summary.foundPairs).toBe(4);
      expect(memCorr.summary.totalPairs).toBe(4);
      expect(memCorr.summary.failedSelections).toBe(1);
    });

    it('timed_choice: evalúa respuestas y asigna 0 a nulas/vencidas', () => {
      const config: GameConfig = {
        mechanic: GameMechanic.timed_choice,
        settings: {
          timeLimitSeconds: 15,
          questions: [
            { id: 'q1', prompt: 'Color of sky?', options: [{ id: 'opt1', text: 'Blue' }, { id: 'opt2', text: 'Red' }] },
            { id: 'q2', prompt: '2 + 2?', options: [{ id: 'opt3', text: '4' }, { id: 'opt4', text: '5' }] },
          ],
        },
      };

      const answerKey: GameAnswerKey = {
        solution: {
          choices: { q1: 'opt1', q2: 'opt3' },
        },
      };

      // q1 correct, q2 timed out (null)
      const res = scoringService.calculateGame(config, answerKey, {
        choices: { q1: 'opt1', q2: null },
      });
      expect(res.fraction).toBe(0.5);
      expect(res.score).toBe(2.5);
      expect((res.correction['q1'] as ItemCorrection).correct).toBe(true);
      expect((res.correction['q2'] as ItemCorrection).correct).toBe(false);
    });

    it('RF-8: durationSeconds < minPlausibleSeconds marca flag implausible_duration conservando score', () => {
      const config: GameConfig = {
        mechanic: GameMechanic.timed_choice,
        settings: {
          timeLimitSeconds: 20,
          questions: [{ id: 'q1', prompt: 'Test', options: [{ id: 'o1', text: 'A' }, { id: 'o2', text: 'B' }] }],
        },
      };
      const answerKey: GameAnswerKey = { solution: { choices: { q1: 'o1' } } };

      // duration is 5s, but minPlausible is 15s
      const res = scoringService.calculateGame(
        config,
        answerKey,
        { choices: { q1: 'o1' } },
        5,
        15,
      );
      expect(res.score).toBe(5.0);
      expect(res.flags).toContain('implausible_duration'); // duracion plausible (SPEC-06 RF-8)

      // duration is 18s >= 15s
      const resNormal = scoringService.calculateGame(
        config,
        answerKey,
        { choices: { q1: 'o1' } },
        18,
        15,
      );
      expect(resNormal.flags).toEqual([]);
    });
  });

  describe('RF-7 & RF-11: AttemptsService y múltiples intentos individuales para game (Decisión 104)', () => {
    let attemptsService: AttemptsService;
    let mockPrisma: {
      student: { findFirst: ReturnType<typeof vi.fn> };
      assignment: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
      attempt: {
        findMany: ReturnType<typeof vi.fn>;
        findFirst: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
      gameDetail: { findFirst: ReturnType<typeof vi.fn> };
    };
    let mockFeatureFlags: { isFeatureEnabled: ReturnType<typeof vi.fn> };
    let mockGamification: { recordAttemptCompleted: ReturnType<typeof vi.fn> };
    let mockMedia: Record<string, unknown>;
    let mockJwt: { sign: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };
    let mockConfig: { get: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockPrisma = {
        student: {
          findFirst: vi.fn(),
        },
        assignment: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        attempt: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        gameDetail: {
          findFirst: vi.fn(),
        },
      };

      mockFeatureFlags = {
        isFeatureEnabled: vi.fn().mockResolvedValue(true),
      };

      mockGamification = {
        recordAttemptCompleted: vi.fn().mockResolvedValue([]),
      };

      mockMedia = {};
      mockJwt = {
        sign: vi.fn().mockReturnValue('mock-token'),
        verify: vi.fn().mockReturnValue({ attemptId: 'att-1', studentId: 'stu-1', organizationId: 'org-1' }),
      };
      mockConfig = {
        get: vi.fn().mockReturnValue('secret'),
      };

      attemptsService = new AttemptsService(
        mockPrisma as unknown as PrismaService,
        mockConfig as unknown as ConfigService,
        mockJwt as unknown as JwtService,
        scoringService,
        mockGamification as unknown as GamificationService,
        mockMedia as unknown as MediaService,
        mockFeatureFlags as unknown as FeatureFlagsService,
      );
    });

    it('startAttempt falla con 409 si flags.games es false para tipo game', async () => {
      mockFeatureFlags.isFeatureEnabled.mockResolvedValue(false);
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'stu-1',
        memberships: [{ group_id: 'grp-1', left_at: null }],
      });
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: 'asg-1',
        group_id: 'grp-1',
        cancelled_at: null,
        activity: {
          status: 'published',
          type: ActivityType.game,
        },
      });

      await expect(
        attemptsService.startAttempt('org-1', 'stu-1', 'asg-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('startAttempt en game: si intento anterior ya finalizó (graded), crea attempt_number = 2 sin retry_granted_at (Decisión 104)', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'stu-1',
        memberships: [{ group_id: 'grp-1', left_at: null }],
      });

      const now = new Date();
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: 'asg-1',
        group_id: 'grp-1',
        cancelled_at: null,
        opens_at: new Date(now.getTime() - 10000),
        due_at: new Date(now.getTime() + 100000),
        activity: {
          id: 'act-1',
          status: 'published',
          type: ActivityType.game,
          level: Level.A1,
        },
      });

      // Existing attempt 1 is graded
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          attempt_number: 1,
          status: AttemptStatus.graded,
          retry_granted_at: null,
          next_attempt: null,
        },
      ]);

      mockPrisma.attempt.create.mockImplementation((args: { data: Record<string, unknown> }) => ({
        id: 'att-2',
        ...args.data,
      }));

      mockPrisma.gameDetail.findFirst.mockResolvedValue({
        mechanic: 'match',
        config: { settings: { left: [], right: [] } },
        answer_key: { solution: { pairs: {} } },
      });

      const runtime = await attemptsService.startAttempt('org-1', 'stu-1', 'asg-1');

      expect(mockPrisma.attempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attempt_number: 2,
            previous_attempt_id: 'att-1',
            status: AttemptStatus.in_progress,
          }),
        }),
      );
      expect(runtime.attempt.attemptNumber).toBe(2);
      expect(runtime.activity.config).toBeDefined();
    });

    it('startAttempt en game: si ya existe un intento in_progress, rechaza con 409 ATTEMPT_ALREADY_EXISTS', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'stu-1',
        memberships: [{ group_id: 'grp-1', left_at: null }],
      });

      const now = new Date();
      mockPrisma.assignment.findFirst.mockResolvedValue({
        id: 'asg-1',
        group_id: 'grp-1',
        cancelled_at: null,
        opens_at: new Date(now.getTime() - 10000),
        due_at: new Date(now.getTime() + 100000),
        activity: {
          id: 'act-1',
          status: 'published',
          type: ActivityType.game,
        },
      });

      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          attempt_number: 1,
          status: AttemptStatus.in_progress,
        },
      ]);

      await expect(
        attemptsService.startAttempt('org-1', 'stu-1', 'asg-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('submitEvents: reemplaza answers en lugar de mezclar para game properties (RF-8)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: 'att-1',
        status: AttemptStatus.in_progress,
        started_at: new Date(),
        assignment: { due_at: new Date(Date.now() + 100000) },
        payload: {
          answers: {
            placements: { obj1: 'catA', obj2: 'catB' },
          },
          processedEventIds: ['ev-0'],
        },
      });
      mockPrisma.attempt.update.mockResolvedValue({});

      // Submitting new placements where obj2 was removed
      await attemptsService.submitEvents('org-1', 'stu-1', 'att-1', 'valid-token', {
        events: [
          {
            itemId: 'placements',
            answer: { obj1: 'catB' },
            clientEventId: 'ev-1',
          },
        ],
      });

      expect(mockPrisma.attempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: expect.objectContaining({
              answers: {
                placements: { obj1: 'catB' }, // obj2 is cleanly removed, not merged!
              },
            }),
          }),
        }),
      );
    });

    it('getAssignmentsCards: en scope continuity y available incluye mechanic y canStart = true para game abierto (Decisión 104 y RF-11)', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: 'stu-1',
        memberships: [{ group_id: 'grp-1', left_at: null }],
      });

      const now = new Date();
      const assignmentRecord = {
        id: 'asg-game-1',
        opens_at: new Date(now.getTime() - 10000),
        due_at: new Date(now.getTime() + 100000),
        cancelled_at: null,
        activity: {
          id: 'act-game-1',
          title: 'Memory Animals',
          type: ActivityType.game,
          level: Level.A1,
          version: 1,
          game_detail: {
            mechanic: GameMechanic.memory,
          },
        },
      };

      // 1. Available scope
      mockPrisma.assignment.findMany.mockResolvedValue([
        {
          ...assignmentRecord,
          attempts: [
            {
              id: 'att-1',
              assignment_id: 'asg-game-1',
              attempt_number: 1,
              status: AttemptStatus.graded,
              started_at: new Date(now.getTime() - 5000),
              finished_at: new Date(now.getTime() - 2000),
              graded_at: new Date(now.getTime() - 2000),
              score: 4.5,
              flags: [],
              retry_granted_at: null,
              retry_extend_until: null,
              next_attempt: null,
            },
          ],
        },
      ]);

      const availRes = await attemptsService.listStudentAssignments('org-1', 'stu-1', {
        scope: 'available',
      });
      expect(availRes.items.length).toBe(1);
      expect(availRes.items[0]?.canStart).toBe(true);
      expect(availRes.items[0]?.activity.mechanic).toBe(GameMechanic.memory);

      // 2. Continuity scope
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-1',
          assignment_id: 'asg-game-1',
          attempt_number: 1,
          status: AttemptStatus.graded,
          started_at: new Date(now.getTime() - 5000),
          finished_at: new Date(now.getTime() - 2000),
          graded_at: new Date(now.getTime() - 2000),
          score: 4.5,
          flags: [],
          retry_granted_at: null,
          retry_extend_until: null,
          next_attempt: null,
          assignment: assignmentRecord,
        },
      ]);

      const contRes = await attemptsService.listStudentAssignments('org-1', 'stu-1', {
        scope: 'continuity',
      });
      expect(contRes.items.length).toBe(1);
      expect(contRes.items[0]?.canStart).toBe(true);
      expect(contRes.items[0]?.activity.mechanic).toBe(GameMechanic.memory);
    });
  });
});
