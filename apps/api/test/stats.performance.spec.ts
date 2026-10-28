import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsService } from '../src/stats/stats.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { GamificationService } from '../src/gamification/gamification.service';
import {
  ActivityType,
  AgeSegment,
  ApprovalStatus,
  AttemptStatus,
  Level,
  ProgressEventType,
} from '@englove/shared';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

describe('SPEC-08 RF-4: Presupuesto de latencia < 500 ms e índices de rendimiento (ENG-100)', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const groupId = '22222222-2222-4222-8222-222222222222';
  const studentId = '33333333-3333-4333-8333-333333333333';

  let service: StatsService;
  let mockPrisma: any;
  let mockGamification: any;

  beforeEach(() => {
    // Generate volume of 100 students
    const volumeStudents = Array.from({ length: 100 }, (_, i) => ({
      id: `std-${i}`,
      level: i % 4 === 0 ? Level.A1 : i % 4 === 1 ? Level.A2 : i % 4 === 2 ? Level.B1 : Level.B2,
      age_segment: i % 2 === 0 ? AgeSegment.kids : AgeSegment.teens,
      approval_status: ApprovalStatus.approved,
      user: { name: `Estudiante Vol ${i}` },
      memberships: [
        {
          group_id: groupId,
          left_at: null,
          joined_at: new Date('2026-08-01T00:00:00Z'),
          group: { id: groupId, name: 'Grupo Volumen' },
          student: { approval_status: ApprovalStatus.approved },
        },
      ],
      badge_awards: [],
      created_at: new Date('2026-08-01T00:00:00Z'),
    }));

    // Generate 500 graded attempts across 3 months
    const volumeAttempts = Array.from({ length: 500 }, (_, i) => ({
      id: `att-${i}`,
      student_id: `std-${i % 100}`,
      assignment_id: `asg-${i % 20}`,
      attempt_number: 1 + Math.floor(i / 100),
      status: AttemptStatus.graded,
      score: new Prisma.Decimal(3.5),
      graded_at: new Date(Date.now() - (i % 90) * 24 * 60 * 60 * 1000),
      started_at: new Date(Date.now() - 3600 * 1000),
      finished_at: new Date(),
      flags: [],
      previous_attempt: null,
      assignment: {
        id: `asg-${i % 20}`,
        activity: {
          id: `act-${i % 20}`,
          title: `Activity ${i % 20}`,
          type: ActivityType.fill_blank,
          level: Level.A1,
          expected_duration_seconds: 120,
          game_detail: null,
        },
      },
    }));

    // Generate 1000 progress events
    const volumeEvents = Array.from({ length: 1000 }, (_, i) => ({
      id: `ev-${i}`,
      student_id: `std-${i % 100}`,
      type: i % 2 === 0 ? ProgressEventType.attempt_completed : ProgressEventType.audio_submitted,
      occurred_at: new Date(Date.now() - (i % 90) * 24 * 60 * 60 * 1000),
    }));

    mockPrisma = {
      student: {
        findMany: vi.fn().mockResolvedValue(volumeStudents),
        findFirst: vi.fn().mockResolvedValue(volumeStudents[0]),
      },
      attempt: {
        findMany: vi.fn().mockResolvedValue(volumeAttempts),
      },
      progressEvent: {
        findMany: vi.fn().mockResolvedValue(volumeEvents),
      },
      assignment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      group: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: groupId,
            name: 'Grupo Volumen',
            memberships: volumeStudents.map((s) => ({
              student_id: s.id,
              student: s,
              joined_at: new Date('2026-08-01T00:00:00Z'),
              left_at: null,
            })),
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: groupId,
          name: 'Grupo Volumen',
          memberships: volumeStudents.map((s) => ({
            student_id: s.id,
            student: s,
            joined_at: new Date('2026-08-01T00:00:00Z'),
            left_at: null,
          })),
        }),
      },
    };

    mockGamification = {
      calculateStreak: vi.fn().mockResolvedValue({
        weeks: 5,
        forgivenessAvailable: true,
        activeWeeksSinceForgivenessUsed: 0,
        periodKey: '2026-W43',
      }),
      getBogotaIsoWeekKey: vi.fn().mockReturnValue('2026-W43'),
    };

    service = new StatsService(
      mockPrisma as unknown as PrismaService,
      mockGamification as unknown as GamificationService,
    );
  });

  it('los 4 endpoints de estadísticas procesan volumen de 3 meses en < 500 ms', async () => {
    const t0 = performance.now();
    await service.getOverview(orgId, {});
    const tOverview = performance.now() - t0;

    const t1 = performance.now();
    await service.getGroupStats(orgId, groupId, {});
    const tGroup = performance.now() - t1;

    const t2 = performance.now();
    await service.getLeaderboard(orgId, {});
    const tLeaderboard = performance.now() - t2;

    const t3 = performance.now();
    await service.getStudentStats(orgId, studentId, {});
    const tStudent = performance.now() - t3;

    expect(tOverview).toBeLessThan(500);
    expect(tGroup).toBeLessThan(500);
    expect(tLeaderboard).toBeLessThan(500);
    expect(tStudent).toBeLessThan(500);
  });

  it('los índices compuestos sobre Attempt y ProgressEvent están definidos en schema.prisma', () => {
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf8');

    expect(content).toContain('@@index([organization_id, status, graded_at])');
    expect(content).toContain('@@index([organization_id, status, finished_at])');
    expect(content).toContain('@@index([organization_id, type, occurred_at])');
  });
});
