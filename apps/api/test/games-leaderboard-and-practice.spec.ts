import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ActivityType,
  ActivityStatus,
  Level,
  AttemptStatus,
  ApprovalStatus,
  Role,
  GameMechanic,
  AgeSegment,
} from '@englove/shared';
import { StatsService } from '../src/stats/stats.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { AttemptsService } from '../src/attempts/attempts.service';
import { StudentsService } from '../src/students/students.service';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('SPEC-11 / RF-12 & Remediations: Games Leaderboard, Autonomous Practice & Security Guardrails', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const student1Id = '22222222-2222-4222-8222-222222222221';
  const student2Id = '22222222-2222-4222-8222-222222222222';
  const student3Id = '22222222-2222-4222-8222-222222222223';
  const groupId = '33333333-3333-4333-8333-333333333333';
  const gameActivityId = '44444444-4444-4444-8444-444444444441';

  let mockPrisma: any;
  let mockGamificationService: any;
  let mockConfigService: any;
  let mockMailService: any;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string, defaultVal?: string) => {
        if (key === 'WEB_BASE_URL') return 'http://localhost:3000';
        if (key === 'JWT_SECRET') return 'englove-dev-jwt-secret-min-32-chars-long-local-secret!';
        return defaultVal;
      }),
    };

    mockMailService = {
      sendMail: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    mockGamificationService = {
      calculateStreakFromEvents: vi.fn().mockReturnValue({
        weeks: 0,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: null,
        forgivenWeekKeys: [],
      }),
      calculateStreak: vi.fn().mockResolvedValue({
        weeks: 0,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: null,
        forgivenWeekKeys: [],
      }),
      getBogotaIsoWeekKey: vi.fn().mockReturnValue('2026-W44'),
      recordAttemptCompleted: vi.fn(),
      recordAudioSubmitted: vi.fn(),
    };

    mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'mock-id', archived_at: null, status: 'in_progress', score: null, finished_at: null }]),
      group: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      groupMembership: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      student: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
      activity: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      assignment: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      attempt: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      progressEvent: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      fillBlankDetail: {
        findFirst: vi.fn(),
      },
      gameDetail: {
        findFirst: vi.fn(),
      },
      examDetail: {
        findFirst: vi.fn(),
      },
      speakingDetail: {
        findFirst: vi.fn(),
      },
      openQuestionDetail: {
        findFirst: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      passwordResetToken: {
        deleteMany: vi.fn(),
      },
      emailChangeRequest: {
        deleteMany: vi.fn(),
      },
    };
  });

  describe('RF-12 (ENG-162 / Decisión 137): GET /stats/games-leaderboard', () => {
    let statsService: StatsService;

    beforeEach(() => {
      statsService = new StatsService(mockPrisma, mockGamificationService);
    });

    it('ranks students with 6 deterministic tie-breakers and returns GamesLeaderboardResponse', async () => {
      // Setup 3 approved students in Grupo A
      mockPrisma.student.findMany.mockResolvedValue([
        { id: student1Id, user: { name: 'Alice' }, level: Level.A1, memberships: [{ group_id: groupId, group: { id: groupId, name: 'Grupo A' } }] },
        { id: student2Id, user: { name: 'Bob' }, level: Level.A1, memberships: [{ group_id: groupId, group: { id: groupId, name: 'Grupo A' } }] },
        { id: student3Id, user: { name: 'Charlie' }, level: Level.A1, memberships: [{ group_id: groupId, group: { id: groupId, name: 'Grupo A' } }] },
      ]);

      const baseTime = new Date('2026-11-01T10:00:00Z');

      // Student 1 (Alice): two 5.0 score attempts (3 stars, 50 pts each = 6 stars, 100 pts)
      // Student 2 (Bob): one 5.0 score (3 stars, 50 pts) + one 4.0 score (2 stars, 25 pts) = 5 stars, 75 pts
      // Student 3 (Charlie): three 5.0 score attempts (3 stars, 50 pts each = 9 stars, 150 pts)
      mockPrisma.attempt.findMany.mockResolvedValue([
        // Student 1
        {
          id: 'att-1',
          student_id: student1Id,
          activity_id: 'game-1',
          score: 5.0,
          flags: [],
          started_at: baseTime,
          finished_at: new Date(baseTime.getTime() + 60000),
          graded_at: new Date(baseTime.getTime() + 60000),
          activity: { id: 'game-1', title: 'Memory Animals', expected_duration_seconds: 60 },
        },
        {
          id: 'att-2',
          student_id: student1Id,
          activity_id: 'game-2',
          score: 5.0,
          flags: [],
          started_at: new Date(baseTime.getTime() + 120000),
          finished_at: new Date(baseTime.getTime() + 180000),
          graded_at: new Date(baseTime.getTime() + 180000),
          activity: { id: 'game-2', title: 'Phonics Pop', expected_duration_seconds: 60 },
        },
        // Student 2
        {
          id: 'att-3',
          student_id: student2Id,
          activity_id: 'game-1',
          score: 5.0,
          flags: [],
          started_at: baseTime,
          finished_at: new Date(baseTime.getTime() + 60000),
          graded_at: new Date(baseTime.getTime() + 60000),
          activity: { id: 'game-1', title: 'Memory Animals', expected_duration_seconds: 60 },
        },
        {
          id: 'att-4',
          student_id: student2Id,
          activity_id: 'game-2',
          score: 4.0,
          flags: [],
          started_at: new Date(baseTime.getTime() + 120000),
          finished_at: new Date(baseTime.getTime() + 180000),
          graded_at: new Date(baseTime.getTime() + 180000),
          activity: { id: 'game-2', title: 'Phonics Pop', expected_duration_seconds: 60 },
        },
        // Student 3
        {
          id: 'att-5',
          student_id: student3Id,
          activity_id: 'game-1',
          score: 5.0,
          flags: [],
          started_at: baseTime,
          finished_at: new Date(baseTime.getTime() + 60000),
          graded_at: new Date(baseTime.getTime() + 60000),
          activity: { id: 'game-1', title: 'Memory Animals', expected_duration_seconds: 60 },
        },
        {
          id: 'att-6',
          student_id: student3Id,
          activity_id: 'game-2',
          score: 5.0,
          flags: [],
          started_at: new Date(baseTime.getTime() + 120000),
          finished_at: new Date(baseTime.getTime() + 180000),
          graded_at: new Date(baseTime.getTime() + 180000),
          activity: { id: 'game-2', title: 'Phonics Pop', expected_duration_seconds: 60 },
        },
        {
          id: 'att-7',
          student_id: student3Id,
          activity_id: 'game-3',
          score: 5.0,
          flags: [],
          started_at: new Date(baseTime.getTime() + 240000),
          finished_at: new Date(baseTime.getTime() + 300000),
          graded_at: new Date(baseTime.getTime() + 300000),
          activity: { id: 'game-3', title: 'Word Catch', expected_duration_seconds: 60 },
        },
      ]);

      const result = await statsService.getGamesLeaderboard(orgId, {});

      expect(result.items.length).toBe(3);

      // Rank 1: Charlie (150 pts, 9 stars, 3 unique games)
      expect(result.items[0]!.studentId).toBe(student3Id);
      expect(result.items[0]!.rank).toBe(1);
      expect(result.items[0]!.gamePoints).toBe(150);
      expect(result.items[0]!.totalStars).toBe(9);
      expect(result.items[0]!.uniqueGamesPlayed).toBe(3);

      // Rank 2: Alice (100 pts, 6 stars, 2 unique games)
      expect(result.items[1]!.studentId).toBe(student1Id);
      expect(result.items[1]!.rank).toBe(2);
      expect(result.items[1]!.gamePoints).toBe(100);
      expect(result.items[1]!.totalStars).toBe(6);

      // Rank 3: Bob (75 pts, 5 stars, 2 unique games)
      expect(result.items[2]!.studentId).toBe(student2Id);
      expect(result.items[2]!.rank).toBe(3);
      expect(result.items[2]!.gamePoints).toBe(75);
      expect(result.items[2]!.totalStars).toBe(5);
    });

    it('caps scoring at top 5 attempts per activity per student', async () => {
      mockPrisma.student.findMany.mockResolvedValue([
        { id: student1Id, user: { name: 'Alice' }, level: Level.A1, memberships: [] },
      ]);

      // 7 attempts on the SAME activity, all score 5.0 (3 stars, 50 pts)
      const attempts = Array.from({ length: 7 }, (_, i) => ({
        id: `att-${i}`,
        student_id: student1Id,
        activity_id: 'game-same',
        score: 5.0,
        flags: [],
        started_at: new Date(),
        finished_at: new Date(),
        graded_at: new Date(),
        activity: { id: 'game-same', title: 'Same Game', expected_duration_seconds: 60 },
      }));

      mockPrisma.attempt.findMany.mockResolvedValue(attempts);

      const result = await statsService.getGamesLeaderboard(orgId, {});
      expect(result.items.length).toBe(1);
      // Top 5 capped: 5 * 50 = 250 points, 5 * 3 = 15 stars
      expect(result.items[0]!.gamePoints).toBe(250);
      expect(result.items[0]!.totalStars).toBe(15);
      // All 7 attempts count in gamesPlayedCount
      expect(result.items[0]!.gamesPlayedCount).toBe(7);
    });
  });

  describe('RF-12 (ENG-162): getGroupStats and getStudentStats microgames segregation', () => {
    let statsService: StatsService;

    beforeEach(() => {
      statsService = new StatsService(mockPrisma, mockGamificationService);
    });

    it('getGroupStats includes gamesPractice metrics aggregated for the group', async () => {
      mockPrisma.group.findFirst.mockResolvedValue({
        id: groupId,
        name: 'Grupo A',
        level: Level.A1,
        created_at: new Date(),
        memberships: [
          {
            student_id: student1Id,
            student: {
              id: student1Id,
              approval_status: ApprovalStatus.approved,
              user: { name: 'Alice' },
            },
          },
        ],
      });

      mockPrisma.assignment.findMany.mockResolvedValue([]);
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-game-1',
          student_id: student1Id,
          activity_id: 'game-1',
          assignment_id: null,
          score: 5.0,
          flags: [],
          started_at: new Date('2026-11-01T10:00:00Z'),
          finished_at: new Date('2026-11-01T10:10:00Z'),
          graded_at: new Date('2026-11-01T10:10:00Z'),
          activity: { id: 'game-1', title: 'Game Fun', level: Level.A1, game_detail: { mechanic: 'match' } },
        },
      ]);

      const result = await statsService.getGroupStats(orgId, groupId, {});
      expect(result.gamesPractice).toBeDefined();
      expect(result.gamesPractice?.totalSessions).toBe(1);
      expect(result.gamesPractice?.uniqueGamesPlayed).toBe(1);
    });

    it('getStudentStats completely excludes games from academic stats and places them in gamesPractice', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: student1Id,
        organization_id: orgId,
        approval_status: ApprovalStatus.approved,
        level: Level.A1,
        created_at: new Date('2026-10-01T00:00:00Z'),
        user: { name: 'Alice', email: 'alice@englove.org', is_active: true },
        memberships: [{ group: { id: groupId, name: 'Grupo A' } }],
      });

      mockPrisma.assignment.findMany.mockResolvedValue([]);
      // Academic attempt (fill_blank) + autonomous game attempt
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-academic',
          student_id: student1Id,
          assignment_id: 'asg-1',
          activity_id: null,
          score: 4.5,
          status: AttemptStatus.graded,
          attempt_number: 1,
          started_at: new Date('2026-11-01T10:00:00Z'),
          finished_at: new Date('2026-11-01T10:15:00Z'),
          graded_at: new Date('2026-11-01T10:15:00Z'),
          flags: [],
          payload: {},
          assignment: {
            id: 'asg-1',
            activity: {
              id: 'act-academic',
              title: 'Academic Quiz',
              type: ActivityType.fill_blank,
              level: Level.A1,
            },
          },
        },
        {
          id: 'att-game',
          student_id: student1Id,
          assignment_id: null,
          activity_id: gameActivityId,
          score: 5.0,
          status: AttemptStatus.graded,
          attempt_number: 1,
          started_at: new Date('2026-11-02T10:00:00Z'),
          finished_at: new Date('2026-11-02T10:10:00Z'),
          graded_at: new Date('2026-11-02T10:10:00Z'),
          flags: [],
          payload: { practiceStars: 3 },
          activity: {
            id: gameActivityId,
            title: 'Autonomous Game',
            type: ActivityType.game,
            level: Level.A1,
            game_detail: { mechanic: 'quiz' },
          },
        },
      ]);

      const result = await statsService.getStudentStats(orgId, student1Id, {});

      // Academic performance should only have the academic attempt (average 4.5, not distorted by 5.0 game score)
      expect(result.performance.scoreSeries.length).toBe(1);
      expect(result.performance.scoreSeries[0]!.activityTitle).toBe('Academic Quiz');
      expect(result.performance.studentAverageScore).toBe(4.5);
      expect(result.performance.byActivityType.some((b) => b.type === ActivityType.game)).toBe(false);

      // Microgame practice should be in gamesPractice
      expect(result.gamesPractice).toBeDefined();
      expect(result.gamesPractice?.totalSessions).toBe(1);
      expect(result.gamesPractice?.sessions?.length).toBe(1);
      expect(result.gamesPractice?.sessions?.[0]?.activityTitle).toBe('Autonomous Game');
      expect(result.gamesPractice?.sessions?.[0]?.stars).toBe(3);
    });
  });

  describe('RF-4 / Remediations: updateActivity prevents mutating activities with autonomous attempts', () => {
    let activitiesService: ActivitiesService;

    beforeEach(() => {
      activitiesService = new ActivitiesService(mockPrisma);
    });

    it('throws 409 ACTIVITY_HAS_ATTEMPTS when updating a game that has autonomous attempts', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue({
        id: gameActivityId,
        organization_id: orgId,
        type: ActivityType.game,
        title: 'Microgame',
        status: ActivityStatus.published,
      });

      // Attempt count returns 1 for autonomous attempts on this activity
      mockPrisma.attempt.count.mockResolvedValue(1);

      await expect(
        activitiesService.updateActivity(orgId, gameActivityId, { title: 'New Title' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.attempt.count).toHaveBeenCalledWith({
        where: {
          organization_id: orgId,
          OR: [
            { activity_id: gameActivityId },
            { assignment: { activity_id: gameActivityId } },
          ],
        },
      });
    });
  });

  describe('RF-4 / Remediations: submitEvents validates itemId against legitimate activity items', () => {
    let attemptsService: AttemptsService;
    let mockJwtService: any;

    beforeEach(() => {
      mockJwtService = {
        sign: vi.fn(),
        verify: vi.fn().mockReturnValue({
          attemptId: '55555555-5555-5555-5555-555555555555',
          studentId: student1Id,
          organizationId: orgId,
          typ: 'attempt',
        }),
      };

      attemptsService = new AttemptsService(
        mockPrisma,
        mockConfigService,
        mockJwtService,
        { calculateFillBlank: vi.fn(), calculateExam: vi.fn(), scoreToStars: vi.fn() } as any,
        mockGamificationService,
        {} as any,
        { isFeatureEnabled: vi.fn().mockResolvedValue(true) } as any,
      );
    });

    it('throws 422 INVALID_ACTIVITY_PAYLOAD when itemId is not part of the activity items', async () => {
      const attemptId = '55555555-5555-5555-5555-555555555555';
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        organization_id: orgId,
        student_id: student1Id,
        status: AttemptStatus.in_progress,
        activity_id: null,
        assignment_id: 'asg-1',
        assignment: {
          due_at: new Date(Date.now() + 86400000),
          activity: {
            id: 'act-fill',
            type: ActivityType.fill_blank,
            fill_blank_detail: {
              config: {
                items: [{ id: 'item-1', blanks: [{ id: 'blank-1' }, { id: 'blank-2' }] }],
              },
            },
          },
        },
      });

      const foreignEvent = {
        type: 'answered',
        timestamp: Date.now(),
        itemId: 'foreign-id-not-in-blanks',
        payload: { answer: 'cat' },
      };

      await expect(
        attemptsService.submitEvents(orgId, student1Id, attemptId, 'token', {
          events: [foreignEvent as any],
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('Table 5.1 / Remediations: transferStudentGroup returns effectiveDueAt on UNCONSUMED_RETRY_WARNING', () => {
    let studentsService: StudentsService;

    beforeEach(() => {
      studentsService = new StudentsService(
        mockPrisma,
        mockMailService,
        mockConfigService,
      );
    });

    it('includes effectiveDueAt in affectedActivities when throwing 409 UNCONSUMED_RETRY_WARNING', async () => {
      const targetGroupId = '77777777-7777-7777-7777-777777777777';
      const now = new Date();

      mockPrisma.student.findFirst.mockResolvedValue({
        id: student1Id,
        organization_id: orgId,
        approval_status: ApprovalStatus.approved,
        memberships: [{ group_id: groupId }],
      });

      mockPrisma.group.findFirst.mockResolvedValue({
        id: targetGroupId,
        organization_id: orgId,
        archived_at: null,
      });

      // Group membership exists
      mockPrisma.groupMembership.findFirst.mockResolvedValue({
        id: 'gm-1',
        student_id: student1Id,
        group_id: groupId,
      });

      // Unconsumed retries exist
      const retryExtendUntil = new Date(Date.now() + 86400000);
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-unconsumed',
          student_id: student1Id,
          assignment_id: 'asg-1',
          retry_granted_at: now,
          retry_extend_until: retryExtendUntil,
          next_attempt: null,
          assignment: {
            id: 'asg-1',
            activity_id: 'act-1',
            due_at: now,
            activity: {
              id: 'act-1',
              title: 'Grammar Test',
            },
          },
        },
      ]);

      try {
        await studentsService.transferStudentGroup(
          orgId,
          student1Id,
          targetGroupId,
          false, // confirmLostRetries = false
        );
        expect.fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const response = err.getResponse() as any;
        expect(response.code).toBe('UNCONSUMED_RETRY_WARNING');
        expect(response.details.affectedActivities).toBeDefined();
        expect(response.details.affectedActivities.length).toBe(1);
        expect(response.details.affectedActivities[0].effectiveDueAt).toBe(
          retryExtendUntil.toISOString(),
        );
      }
    });
  });

  describe('Table 5.1: startGameAttempt returns 404 ACTIVITY_NOT_FOUND', () => {
    let attemptsService: AttemptsService;

    beforeEach(() => {
      attemptsService = new AttemptsService(
        mockPrisma,
        mockConfigService,
        { sign: vi.fn(), verify: vi.fn() } as any,
        {} as any,
        {} as any,
        {} as any,
        { isFeatureEnabled: vi.fn().mockResolvedValue(true) } as any,
      );
    });

    it('throws 404 ACTIVITY_NOT_FOUND when activity is not found or not published', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: student1Id,
        organization_id: orgId,
      });

      mockPrisma.activity.findFirst.mockResolvedValue(null);

      try {
        await attemptsService.startGameAttempt(orgId, student1Id, 'non-existent-game');
        expect.fail('Should have thrown NotFoundException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(NotFoundException);
        const response = err.getResponse() as any;
        expect(response.code).toBe('ACTIVITY_NOT_FOUND');
      }
    });
  });

  describe('T4.1 & T4.3: startGameAttempt deletes prior in_progress attempt, bounds token to 24h, and hides scores', () => {
    let attemptsService: AttemptsService;
    let mockJwtService: any;

    beforeEach(() => {
      mockJwtService = {
        sign: vi.fn().mockReturnValue('mock-jwt-token-24h'),
        verify: vi.fn(),
      };

      attemptsService = new AttemptsService(
        mockPrisma,
        mockConfigService,
        mockJwtService,
        { calculateFillBlank: vi.fn(), calculateExam: vi.fn(), scoreToStars: vi.fn() } as any,
        mockGamificationService,
        {} as any,
        { isFeatureEnabled: vi.fn().mockResolvedValue(true) } as any,
      );
    });

    it('deletes in_progress attempt without 409, signs token for 24h, and returns null score', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: student1Id,
        organization_id: orgId,
        age_segment: AgeSegment.kids,
      });

      const publishedGame = {
        id: gameActivityId,
        organization_id: orgId,
        type: ActivityType.game,
        title: 'Word Search',
        status: ActivityStatus.published,
        level: Level.A1,
        game_detail: {
          mechanic: GameMechanic.timed_choice,
          config: { questions: [] },
        },
      };
      mockPrisma.activity.findFirst.mockResolvedValue(publishedGame);
      mockPrisma.attempt.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.attempt.findFirst.mockResolvedValue(null);
      mockPrisma.attempt.findMany.mockResolvedValue([]);

      const createdAttempt = {
        id: 'new-game-attempt-id',
        organization_id: orgId,
        student_id: student1Id,
        activity_id: gameActivityId,
        assignment_id: null,
        attempt_number: 1,
        status: AttemptStatus.in_progress,
        started_at: new Date('2026-11-10T10:00:00.000Z'),
        finished_at: null,
        graded_at: null,
        score: null,
        flags: [],
        previous_attempt_id: null,
        activity: publishedGame,
      };
      mockPrisma.attempt.create.mockResolvedValue(createdAttempt);

      const runtime = await attemptsService.startGameAttempt(orgId, student1Id, gameActivityId);

      // 1. Prior in_progress attempts deleted cleanly
      expect(mockPrisma.attempt.deleteMany).toHaveBeenCalledWith({
        where: {
          organization_id: orgId,
          student_id: student1Id,
          activity_id: gameActivityId,
          status: AttemptStatus.in_progress,
        },
      });

      // 2. Token bounded to 24h
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptId: 'new-game-attempt-id',
          studentId: student1Id,
          organizationId: orgId,
          typ: 'attempt',
        }),
        expect.objectContaining({
          expiresIn: expect.stringMatching(/^8639\ds|86400s$/),
        }),
      );

      // 3. effectiveDueAt / completeUntil bounded to 24h from now
      const completeUntilMs = new Date(runtime.attempt.completeUntil!).getTime();
      const effectiveDueAtMs = new Date(runtime.attempt.effectiveDueAt!).getTime();
      const expected24hMs = Date.now() + 24 * 60 * 60 * 1000;
      expect(Math.abs(completeUntilMs - expected24hMs)).toBeLessThan(5000);
      expect(Math.abs(effectiveDueAtMs - expected24hMs)).toBeLessThan(5000);

      // 4. Score is null (never exposed for games)
      expect(runtime.attempt.score).toBeNull();
    });
  });

  describe('T4.2 & P0-10: completeAttempt restores ProgressEvent via recordAttemptCompleted with score = null', () => {
    let attemptsService: AttemptsService;
    let mockJwtService: any;

    beforeEach(() => {
      mockJwtService = {
        sign: vi.fn(),
        verify: vi.fn().mockReturnValue({
          attemptId: 'game-attempt-to-complete',
          studentId: student1Id,
          organizationId: orgId,
          typ: 'attempt',
        }),
      };

      attemptsService = new AttemptsService(
        mockPrisma,
        mockConfigService,
        mockJwtService,
        {
          calculateGame: vi.fn().mockReturnValue({
            score: 5.0,
            feedback: { correctCount: 5, totalCount: 5 },
            flags: [],
          }),
        } as any,
        mockGamificationService,
        {} as any,
        { isFeatureEnabled: vi.fn().mockResolvedValue(true) } as any,
      );
    });

    const publishedGame = {
      id: gameActivityId,
      organization_id: orgId,
      type: ActivityType.game,
      title: 'Quiz Game',
      status: ActivityStatus.published,
      level: Level.A1,
      expected_duration_seconds: 60,
      game_detail: {
        mechanic: GameMechanic.timed_choice,
        config: {
          questions: [{ id: 'q1', text: 'Q1' }],
          answerKey: { solution: {} },
        },
      },
    };

    it('records progress event with null score for autonomous games and returns stars + motivation message', async () => {
      const attemptId = 'game-attempt-to-complete';

      const inProgressAttempt = {
        id: attemptId,
        organization_id: orgId,
        student_id: student1Id,
        activity_id: gameActivityId,
        assignment_id: null,
        attempt_number: 1,
        status: AttemptStatus.in_progress,
        started_at: new Date(Date.now() - 30000),
        finished_at: null,
        graded_at: null,
        score: null,
        flags: [],
        previous_attempt_id: null,
        activity: publishedGame,
        assignment: null,
        student: { age_segment: AgeSegment.kids },
      };

      mockPrisma.$queryRaw.mockResolvedValue([
        { id: attemptId, status: AttemptStatus.in_progress, score: null, finished_at: null },
      ]);
      mockPrisma.attempt.findFirst.mockResolvedValue(inProgressAttempt);
      mockPrisma.attempt.update.mockResolvedValue({
        ...inProgressAttempt,
        status: AttemptStatus.graded,
        score: 5.0,
        finished_at: new Date(),
        graded_at: new Date(),
      });

      const completion = await attemptsService.completeAttempt(
        orgId,
        student1Id,
        attemptId,
        'token-game',
        {},
      );

      // P0-10: recordAttemptCompleted is invoked with score = null
      expect(mockGamificationService.recordAttemptCompleted).toHaveBeenCalledWith(
        orgId,
        student1Id,
        attemptId,
        null,
      );

      // Student view hides numeric score, shows stars and normative motivation message
      expect(completion.attempt.score).toBeNull();
      expect(completion.attempt.stars).toBe(3);
      expect(completion.attempt.motivationMessage).toBe('¡Increíble! Acertaste todo en esta partida.');

      // T4.1 / SPEC-11: effectiveDueAt and completeUntil bounded to 24h from started_at (not 365 days)
      const expected24h = new Date(inProgressAttempt.started_at.getTime() + 24 * 60 * 60 * 1000).toISOString();
      expect(completion.attempt.effectiveDueAt).toBe(expected24h);
      expect(completion.attempt.completeUntil).toBe(expected24h);
    });

    it('returns teens motivation message when student age_segment is teens', async () => {
      const attemptId = 'att-test-game-teens';
      mockJwtService.verify.mockReturnValue({
        attemptId,
        studentId: student1Id,
        organizationId: orgId,
        typ: 'attempt',
      });
      const inProgressAttempt = {
        id: attemptId,
        organization_id: orgId,
        student_id: student1Id,
        activity_id: gameActivityId,
        assignment_id: null,
        attempt_number: 1,
        status: AttemptStatus.in_progress,
        started_at: new Date(Date.now() - 30000),
        finished_at: null,
        graded_at: null,
        score: null,
        flags: [],
        previous_attempt_id: null,
        activity: publishedGame,
        assignment: null,
        student: { age_segment: AgeSegment.teens },
      };

      mockPrisma.$queryRaw.mockResolvedValue([
        { id: attemptId, status: AttemptStatus.in_progress, score: null, finished_at: null },
      ]);
      mockPrisma.attempt.findFirst.mockResolvedValue(inProgressAttempt);
      mockPrisma.attempt.update.mockResolvedValue({
        id: attemptId,
        organization_id: orgId,
        student_id: student1Id,
        activity_id: gameActivityId,
        assignment_id: null,
        attempt_number: 1,
        status: AttemptStatus.graded,
        started_at: inProgressAttempt.started_at,
        score: 5.0,
        finished_at: new Date(),
        graded_at: new Date(),
        flags: [],
        payload: { answers: {} },
      });

      const completion = await attemptsService.completeAttempt(
        orgId,
        student1Id,
        attemptId,
        'token-game',
        {},
      );

      expect(completion.attempt.score).toBeNull();
      expect(completion.attempt.stars).toBe(3);
      expect(completion.attempt.motivationMessage).toBe('¡Partida impecable! Acertaste todos los retos.');
    });
  });

  describe('T4.3 & RF-10: listStudentGames never exposes score or bestScore', () => {
    let attemptsService: AttemptsService;

    beforeEach(() => {
      attemptsService = new AttemptsService(
        mockPrisma,
        mockConfigService,
        { sign: vi.fn(), verify: vi.fn() } as any,
        {} as any,
        mockGamificationService,
        {} as any,
        { isFeatureEnabled: vi.fn().mockResolvedValue(true) } as any,
      );
    });

    it('returns bestScore: null and bestMaxScore: null on all student game cards', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: student1Id,
        organization_id: orgId,
        level: Level.A1,
      });

      mockPrisma.activity.findMany.mockResolvedValue([
        {
          id: gameActivityId,
          title: 'Memory Animals',
          type: ActivityType.game,
          level: Level.A1,
          game_detail: { mechanic: GameMechanic.match, config: {} },
        },
      ]);

      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: 'att-past-1',
          activity_id: gameActivityId,
          student_id: student1Id,
          score: 5.0,
          status: AttemptStatus.graded,
          flags: [],
        },
      ]);

      const list = await attemptsService.listStudentGames(orgId, student1Id);
      expect(list.items.length).toBe(1);
      const card = list.items[0]!;
      expect(card.bestScore).toBeNull();
      expect(card.bestMaxScore).toBeNull();
      expect(card.bestStars).toBe(3);
    });
  });

  describe('QA-06: getGamesLeaderboard completely excludes attempts with implausible_duration flag', () => {
    let statsService: StatsService;

    beforeEach(() => {
      statsService = new StatsService(mockPrisma, mockGamificationService);
    });

    it('excludes flagged attempts from points, stars, count, and practice duration', async () => {
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: student1Id,
          user: { name: 'Alice' },
          level: Level.A1,
          memberships: [{ group_id: groupId, group: { id: groupId, name: 'Grupo A' } }],
        },
      ]);

      const baseTime = new Date('2026-11-01T10:00:00Z');
      mockPrisma.attempt.findMany.mockResolvedValue([
        // Valid attempt: 60s, score 5.0 -> 3 stars, 50 points
        {
          id: 'att-valid',
          student_id: student1Id,
          activity_id: gameActivityId,
          score: 5.0,
          flags: [],
          started_at: baseTime,
          finished_at: new Date(baseTime.getTime() + 60000),
          graded_at: new Date(baseTime.getTime() + 60000),
          activity: { id: gameActivityId, title: 'Memory Animals', expected_duration_seconds: 60 },
        },
        // Fraudulent / rushed attempt: 2s, score 5.0, flag implausible_duration
        {
          id: 'att-fraudulent',
          student_id: student1Id,
          activity_id: gameActivityId,
          score: 5.0,
          flags: ['implausible_duration'],
          started_at: new Date(baseTime.getTime() + 120000),
          finished_at: new Date(baseTime.getTime() + 122000),
          graded_at: new Date(baseTime.getTime() + 122000),
          activity: { id: gameActivityId, title: 'Memory Animals', expected_duration_seconds: 60 },
        },
      ]);

      const result = await statsService.getGamesLeaderboard(orgId, {});
      expect(result.items.length).toBe(1);
      const studentRow = result.items[0]!;

      // Only the valid attempt should be counted
      expect(studentRow.gamePoints).toBe(50);
      expect(studentRow.totalStars).toBe(3);
      expect(studentRow.gamesPlayedCount).toBe(1);
      expect(studentRow.uniqueGamesPlayed).toBe(1);
      expect(studentRow.practiceTimeSeconds).toBe(60);
    });
  });

  describe('P1-11: groupAverageScore and computeGamesPractice with order_words', () => {
    let statsService: StatsService;

    beforeEach(() => {
      statsService = new StatsService(mockPrisma, mockGamificationService);
    });

    it('groupAverageScore averages multiple students correctly and computeGamesPractice includes order_words', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: student1Id,
        organization_id: orgId,
        approval_status: ApprovalStatus.approved,
        level: Level.A1,
        created_at: new Date('2026-10-01T00:00:00Z'),
        user: { name: 'Alice', email: 'alice@englove.org', is_active: true },
        memberships: [{ group: { id: groupId, name: 'Grupo A' } }],
      });

      const asgId = 'assignment-multi-student';
      mockPrisma.assignment.findMany.mockResolvedValue([]);
      // 2 students took the assignment: Alice scored 4.0, Bob scored 5.0
      // Average must be 4.5
      mockPrisma.attempt.findMany.mockResolvedValue([
        // Alice attempt (student1Id)
        {
          id: 'att-alice',
          student_id: student1Id,
          assignment_id: asgId,
          activity_id: null,
          score: 4.0,
          status: AttemptStatus.graded,
          attempt_number: 1,
          started_at: new Date('2026-11-01T10:00:00Z'),
          finished_at: new Date('2026-11-01T10:15:00Z'),
          graded_at: new Date('2026-11-01T10:15:00Z'),
          flags: [],
          payload: {},
          assignment: {
            id: asgId,
            activity: {
              id: 'act-quiz',
              title: 'Grammar Quiz',
              type: ActivityType.fill_blank,
              level: Level.A1,
            },
          },
        },
        // Bob attempt (student2Id)
        {
          id: 'att-bob',
          student_id: student2Id,
          assignment_id: asgId,
          activity_id: null,
          score: 5.0,
          status: AttemptStatus.graded,
          attempt_number: 1,
          started_at: new Date('2026-11-01T10:00:00Z'),
          finished_at: new Date('2026-11-01T10:15:00Z'),
          graded_at: new Date('2026-11-01T10:15:00Z'),
          flags: [],
          payload: {},
          assignment: {
            id: asgId,
            activity: {
              id: 'act-quiz',
              title: 'Grammar Quiz',
              type: ActivityType.fill_blank,
              level: Level.A1,
            },
          },
        },
        // Autonomous game with order_words mechanic
        {
          id: 'att-order-words',
          student_id: student1Id,
          assignment_id: null,
          activity_id: 'act-order-words',
          score: 5.0,
          status: AttemptStatus.graded,
          attempt_number: 1,
          started_at: new Date('2026-11-02T10:00:00Z'),
          finished_at: new Date('2026-11-02T10:10:00Z'),
          graded_at: new Date('2026-11-02T10:10:00Z'),
          flags: [],
          payload: { practiceStars: 3 },
          activity: {
            id: 'act-order-words',
            title: 'Sentence Builder',
            type: ActivityType.game,
            level: Level.A1,
            game_detail: { mechanic: 'order_words' },
          },
        },
      ]);

      const result = await statsService.getStudentStats(orgId, student1Id, {});

      // Performance verifies groupAverageScore = 4.5
      expect(result.performance.scoreSeries.length).toBe(1);
      expect(result.performance.groupAverageScore).toBe(4.5);

      // gamesPractice includes order_words mechanic
      expect(result.gamesPractice).toBeDefined();
      const orderWordsBreakdown = result.gamesPractice?.byMechanic.find(
        (m) => m.mechanic === ('order_words' as any),
      );
      expect(orderWordsBreakdown).toBeDefined();
      expect(orderWordsBreakdown?.sessionsCount).toBe(1);
    });
  });

  describe('T4.7 / RF-12.4: RolesGuard returns 403 AUTH_FORBIDDEN on student unauthorized access', () => {
    it('throws ForbiddenException with AUTH_FORBIDDEN code when role is student but endpoint requires teacher', () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.teacher]);

      const guard = new RolesGuard(reflector);
      const mockContext = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            user: {
              id: 'user-std',
              role: Role.student,
              organizationId: orgId,
            },
          }),
        }),
      } as any;

      try {
        guard.canActivate(mockContext);
        expect.fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = err.getResponse() as any;
        expect(res.statusCode).toBe(403);
        expect(res.code).toBe('AUTH_FORBIDDEN');
      }
    });
  });
});
