import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsService } from '../src/stats/stats.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { GamificationService } from '../src/gamification/gamification.service';
import {
  ActivityType,
  AgeSegment,
  ApprovalStatus,
  AttemptStatus,
  GameMechanic,
  Level,
} from '@englove/shared';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('SPEC-08: StatsService — Estadísticas de rendimiento y constancia (ENG-100 a ENG-103)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const groupId = '22222222-2222-4222-8222-222222222222';
  const student1Id = '33333333-3333-4333-8333-333333333333';
  const student2Id = '44444444-4444-4444-8444-444444444444';
  const assignment1Id = '55555555-5555-4555-8555-555555555555';
  const assignmentGameId = '66666666-6666-4666-8666-666666666666';

  let service: StatsService;
  let mockPrisma: any;
  let mockGamification: any;

  beforeEach(() => {
    mockPrisma = {
      student: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      attempt: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      assignment: {
        findMany: vi.fn(),
      },
      progressEvent: {
        findMany: vi.fn(),
      },
      group: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    };

    mockGamification = {
      calculateStreak: vi.fn().mockResolvedValue({
        weeks: 3,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: '2026-W43',
      }),
      getBogotaIsoWeekKey: vi.fn().mockImplementation((date: Date) => {
        const d = new Date(date);
        return `2026-W${Math.min(52, Math.max(1, Math.ceil(d.getUTCDate() / 7)))}`;
      }),
    };

    service = new StatsService(
      mockPrisma as unknown as PrismaService,
      mockGamification as unknown as GamificationService,
    );
  });

  describe('RF-11: Validación de fechas y parámetros', () => {
    it('lanza 400 VALIDATION_ERROR si from es posterior a to', async () => {
      await expect(
        service.getOverview(orgId, {
          from: '2026-10-20T00:00:00Z',
          to: '2026-10-10T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 400 VALIDATION_ERROR si la fecha está mal formada', async () => {
      await expect(
        service.getOverview(orgId, {
          from: 'invalid-date',
          to: '2026-10-10T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RF-11: Anti-IDOR y aislamiento multi-tenant', () => {
    it('getGroupStats lanza 404 GROUP_NOT_FOUND si el grupo no existe en la organización', async () => {
      mockPrisma.group.findFirst.mockResolvedValue(null);

      await expect(
        service.getGroupStats(orgId, groupId, {}),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.group.findFirst).toHaveBeenCalledWith({
        where: { id: groupId, organization_id: orgId },
        include: expect.anything(),
      });
    });

    it('getStudentStats lanza 404 STUDENT_NOT_FOUND si el estudiante pertenece a otra organización', async () => {
      mockPrisma.student.findFirst.mockResolvedValue(null);

      await expect(
        service.getStudentStats(orgId, student1Id, {}),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.student.findFirst).toHaveBeenCalledWith({
        where: { id: student1Id, organization_id: orgId },
        include: expect.anything(),
      });
    });
  });

  describe('RF-1: Separación de fuentes y regla del último intento calificado', () => {
    it('en agregados, solo toma el último intento calificado MAX(attempt_number)', async () => {
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: student1Id,
          level: Level.A1,
          age_segment: AgeSegment.kids,
          user: { name: 'Juanito Perez' },
          memberships: [{ left_at: null, group_id: groupId, group: { name: 'Kids A1' } }],
        },
      ]);

      // Two graded attempts for same (student, assignment): attempt 1 scored 2.0, attempt 2 scored 4.0
      mockPrisma.attempt.findMany.mockImplementation(({ where }: any) => {
        if (where.status === AttemptStatus.graded) {
          return Promise.resolve([
            {
              id: 'att-2',
              student_id: student1Id,
              assignment_id: assignment1Id,
              attempt_number: 2,
              score: new Prisma.Decimal(4.0),
              graded_at: new Date('2026-10-15T10:00:00Z'),
              assignment: { activity: { expected_duration_seconds: 120 } },
            },
            {
              id: 'att-1',
              student_id: student1Id,
              assignment_id: assignment1Id,
              attempt_number: 1,
              score: new Prisma.Decimal(2.0),
              graded_at: new Date('2026-10-14T10:00:00Z'),
              assignment: { activity: { expected_duration_seconds: 120 } },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      mockPrisma.progressEvent.findMany.mockResolvedValue([]);
      mockPrisma.assignment.findMany.mockResolvedValue([]);
      mockPrisma.group.findMany.mockResolvedValue([]);

      const overview = await service.getOverview(orgId, {
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-28T00:00:00Z',
      });

      // Average score must be 4.0 (from attempt 2), not (4.0 + 2.0)/2 = 3.0
      expect(overview.organizationSummary.averageScore).toBe(4.0);
    });
  });

  describe('RF-2: Universo de cumplimiento, denominador congelado y exclusión de canceladas y microjuegos', () => {
    it('excluye microjuegos (type=game) y actividades canceladas de la tasa de finalización', async () => {
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: student1Id,
          level: Level.A1,
          age_segment: AgeSegment.kids,
          user: { name: 'Juanito' },
          memberships: [],
        },
      ]);
      mockPrisma.attempt.findMany.mockResolvedValue([]);
      mockPrisma.progressEvent.findMany.mockResolvedValue([]);
      mockPrisma.group.findMany.mockResolvedValue([]);

      mockPrisma.assignment.findMany.mockResolvedValue([
        {
          id: assignment1Id,
          historical_student_count: 10,
          due_at: new Date('2026-10-01T00:00:00Z'), // Closed
          opens_at: new Date('2026-09-01T00:00:00Z'),
          group: {
            memberships: [
              {
                student_id: student1Id,
                joined_at: new Date('2026-08-01T00:00:00Z'),
                left_at: null,
                student: { approval_status: ApprovalStatus.approved },
              },
            ],
          },
          attempts: [{ student_id: student1Id }],
        },
      ]);

      const overview = await service.getOverview(orgId, {});

      // Denominator is 10 (historical_student_count), completed is 1
      expect(overview.organizationSummary.completionRatePercent).toBe(10);
      expect(mockPrisma.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cancelled_at: null,
            activity: { type: { not: ActivityType.game } },
          }),
        }),
      );
    });
  });

  describe('RF-3: Recorte de duración máxima (expected_duration_seconds * 3)', () => {
    it('recorta la duración a máximo 3 veces el tiempo esperado', async () => {
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: student1Id,
          level: Level.A1,
          age_segment: AgeSegment.kids,
          user: { name: 'Juanito' },
          memberships: [],
        },
      ]);
      mockPrisma.attempt.findMany.mockImplementation(({ where }: any) => {
        if (where?.status?.in) {
          // Finished attempts: started at 10:00, finished at 11:00 (3600 seconds), expected 60 seconds (max 180s)
          return Promise.resolve([
            {
              started_at: new Date('2026-10-15T10:00:00Z'),
              finished_at: new Date('2026-10-15T11:00:00Z'),
              student_id: student1Id,
              assignment: {
                activity: { expected_duration_seconds: 60 },
              },
            },
          ]);
        }
        return Promise.resolve([]);
      });
      mockPrisma.progressEvent.findMany.mockResolvedValue([]);
      mockPrisma.assignment.findMany.mockResolvedValue([]);
      mockPrisma.group.findMany.mockResolvedValue([]);

      const overview = await service.getOverview(orgId, {});

      // 60 * 3 = 180 seconds
      expect(overview.organizationSummary.totalTimeSpentSeconds).toBe(180);
    });
  });

  describe('RF-6: Vista de grupo con tendencias 30d y 7d (Decisión 112)', () => {
    it('calcula simultáneamente trend30d y trend7d con delta y dirección', async () => {
      const mockStudent = {
        id: student1Id,
        level: Level.A1,
        age_segment: AgeSegment.kids,
        approval_status: ApprovalStatus.approved,
        user: { name: 'Maria Gomez' },
      };

      mockPrisma.group.findFirst.mockResolvedValue({
        id: groupId,
        name: 'Grupo A1',
        memberships: [
          {
            student_id: student1Id,
            student: mockStudent,
            joined_at: new Date('2026-08-01T00:00:00Z'),
            left_at: null,
          },
        ],
      });

      // Attempts in different windows:
      // Current 7d & 30d: score 4.5
      // Prev 7d (7-14d ago): score 4.0 (delta +0.5 => 'up')
      mockPrisma.attempt.findMany.mockImplementation(({ where }: any) => {
        if (where?.status === AttemptStatus.graded) {
          return Promise.resolve([
            {
              student_id: student1Id,
              assignment_id: 'asg-curr',
              attempt_number: 1,
              score: new Prisma.Decimal(4.5),
              graded_at: new Date('2026-10-25T10:00:00Z'),
            },
            {
              student_id: student1Id,
              assignment_id: 'asg-prev7',
              attempt_number: 1,
              score: new Prisma.Decimal(4.0),
              graded_at: new Date('2026-10-18T10:00:00Z'),
            },
          ]);
        }
        return Promise.resolve([]);
      });

      mockPrisma.progressEvent.findMany.mockResolvedValue([]);
      mockPrisma.assignment.findMany.mockResolvedValue([]);

      const result = await service.getGroupStats(orgId, groupId, {
        to: '2026-10-28T00:00:00Z',
        trendMode: '7d',
      });

      expect(result.students.length).toBe(1);
      const row = result.students[0]!;
      expect(row.trend7d.direction).toBe('up');
      expect(row.trend7d.delta).toBe(0.5);
      expect(row.scoreTrend).toBe('up');
    });
  });

  describe('RF-8: Leaderboard privado docente con filtros por nivel y grupo', () => {
    it('ordena deterministamente por promedio DESC, completadas DESC, racha DESC, insignias DESC, nombre ASC', async () => {
      mockPrisma.student.findMany.mockResolvedValue([
        {
          id: student1Id,
          level: Level.A1,
          age_segment: AgeSegment.kids,
          user: { name: 'Carlos Gomez' },
          memberships: [{ group: { id: groupId, name: 'G1' } }],
          badge_awards: [{ id: 'b1' }],
        },
        {
          id: student2Id,
          level: Level.A1,
          age_segment: AgeSegment.kids,
          user: { name: 'Ana Lopez' },
          memberships: [{ group: { id: groupId, name: 'G1' } }],
          badge_awards: [{ id: 'b2' }, { id: 'b3' }],
        },
      ]);

      mockPrisma.attempt.findMany.mockResolvedValue([
        // Both have same average score 4.0
        {
          student_id: student1Id,
          assignment_id: 'asg-1',
          attempt_number: 1,
          score: new Prisma.Decimal(4.0),
          graded_at: new Date('2026-10-15T10:00:00Z'),
        },
        {
          student_id: student2Id,
          assignment_id: 'asg-2',
          attempt_number: 1,
          score: new Prisma.Decimal(4.0),
          graded_at: new Date('2026-10-15T10:00:00Z'),
        },
      ]);

      // Both have 1 completed activity
      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { student_id: student1Id },
        { student_id: student2Id },
      ]);

      // Gamification returns 3 weeks for both
      mockGamification.calculateStreak.mockResolvedValue({ weeks: 3 });

      // Student 2 has 2 badges, Student 1 has 1 badge. Student 2 must be rank 1!
      const leaderboard = await service.getLeaderboard(orgId, { level: Level.A1 });

      expect(leaderboard.entries.length).toBe(2);
      expect(leaderboard.entries[0]!.studentId).toBe(student2Id);
      expect(leaderboard.entries[0]!.rank).toBe(1);
      expect(leaderboard.entries[1]!.studentId).toBe(student1Id);
      expect(leaderboard.entries[1]!.rank).toBe(2);
    });
  });

  describe('RF-9 y RF-10: Ficha de estudiante individual', () => {
    it('incluye todos los intentos 1..N de microjuegos y solo el último de asignaciones en scoreSeries', async () => {
      mockPrisma.student.findFirst.mockResolvedValue({
        id: student1Id,
        level: Level.A1,
        age_segment: AgeSegment.kids,
        user: { name: 'Pepito Perez' },
        created_at: new Date('2026-09-01T00:00:00Z'),
        memberships: [{ group: { id: groupId, name: 'Grupo A1' } }],
      });

      mockPrisma.attempt.findMany.mockImplementation(({ where }: any) => {
        if (where?.status === AttemptStatus.graded) {
          return Promise.resolve([
            // Assignment: attempt 1 and attempt 2
            {
              id: 'att-asg-1',
              student_id: student1Id,
              assignment_id: assignment1Id,
              attempt_number: 1,
              score: new Prisma.Decimal(2.5),
              graded_at: new Date('2026-10-10T10:00:00Z'),
              flags: [],
              previous_attempt: null,
              assignment: {
                activity: {
                  id: 'act-fill',
                  title: 'Fill blank 1',
                  type: ActivityType.fill_blank,
                  level: Level.A1,
                  game_detail: null,
                },
              },
            },
            {
              id: 'att-asg-2',
              student_id: student1Id,
              assignment_id: assignment1Id,
              attempt_number: 2,
              score: new Prisma.Decimal(4.5),
              graded_at: new Date('2026-10-12T10:00:00Z'),
              flags: [],
              previous_attempt: { retry_extend_until: new Date('2026-10-14T00:00:00Z') },
              assignment: {
                activity: {
                  id: 'act-fill',
                  title: 'Fill blank 1',
                  type: ActivityType.fill_blank,
                  level: Level.A1,
                  game_detail: null,
                },
              },
            },
            // Microgame: attempt 1 and attempt 2 (both must be present)
            {
              id: 'att-game-1',
              student_id: student1Id,
              assignment_id: assignmentGameId,
              attempt_number: 1,
              score: new Prisma.Decimal(3.0),
              graded_at: new Date('2026-10-15T10:00:00Z'),
              flags: [],
              previous_attempt: null,
              assignment: {
                activity: {
                  id: 'act-game',
                  title: 'Match Game',
                  type: ActivityType.game,
                  level: Level.A1,
                  game_detail: { mechanic: GameMechanic.match },
                },
              },
            },
            {
              id: 'att-game-2',
              student_id: student1Id,
              assignment_id: assignmentGameId,
              attempt_number: 2,
              score: new Prisma.Decimal(5.0),
              graded_at: new Date('2026-10-16T10:00:00Z'),
              // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10 y SPEC-08 RF-9
              flags: ['implausible_duration'],
              previous_attempt: null,
              assignment: {
                activity: {
                  id: 'act-game',
                  title: 'Match Game',
                  type: ActivityType.game,
                  level: Level.A1,
                  game_detail: { mechanic: GameMechanic.match },
                },
              },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      mockPrisma.progressEvent.findMany.mockResolvedValue([]);
      mockPrisma.assignment.findMany.mockResolvedValue([]);

      const stats = await service.getStudentStats(orgId, student1Id, {});

      // scoreSeries should contain exactly 3 points: att-asg-2, att-game-1, att-game-2
      expect(stats.performance.scoreSeries.length).toBe(3);
      expect(stats.performance.scoreSeries.map((s) => s.attemptId)).toEqual([
        'att-asg-2',
        'att-game-1',
        'att-game-2',
      ]);

      const game2Point = stats.performance.scoreSeries.find((s) => s.attemptId === 'att-game-2');
      // guardrails-ignore G-C06: prueba de flag de negocio implausibleDuration segun SPEC-05 RF-10 y SPEC-08 RF-9
      expect(game2Point?.implausibleDuration).toBe(true);

      const asgPoint = stats.performance.scoreSeries.find((s) => s.attemptId === 'att-asg-2');
      expect(asgPoint?.usedExtendedDeadline).toBe(true);

      // Calendar of 12 weeks
      expect(stats.consistency.weeklyCalendar.length).toBeGreaterThanOrEqual(1);
    });
  });
});
