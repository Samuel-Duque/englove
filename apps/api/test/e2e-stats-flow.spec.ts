import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ActivityStatus,
  ActivityType,
  AgeSegment,
  ApprovalStatus,
  AttemptStatus,
  GameMechanic,
  Level,
  ProgressEventType,
  Role,
} from '@englove/shared';
import { StatsService } from '../src/stats/stats.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { PendingSummaryService } from '../src/dashboard/pending-summary.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as net from 'net';

function getPostgresPort(): number {
  const url = process.env.DATABASE_URL;
  if (!url) return 5433;
  try {
    const parsed = new URL(url);
    return parsed.port ? parseInt(parsed.port, 10) : 5433;
  } catch {
    return 5433;
  }
}

async function checkPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function checkPostgresRunning(): Promise<boolean> {
  const configuredPort = getPostgresPort();
  if (await checkPortOpen(configuredPort)) return true;
  if (configuredPort !== 5433 && (await checkPortOpen(5433))) return true;
  if (configuredPort !== 5432 && (await checkPortOpen(5432))) return true;
  return false;
}

describe('SPEC-08: Estadísticas y Leaderboard en PostgreSQL real (Docker) — ENG-100 a ENG-104', () => {
  let isPostgresAvailable = false;
  let prisma: PrismaService | null = null;
  let statsService: StatsService;
  let maintenanceService: MaintenanceService;

  const orgId = 'e2e80008-1111-4111-8111-111111111111';
  const teacherUserId = 'e2e80008-2222-4222-8222-222222222222';
  const group1Id = 'e2e80008-3333-4333-8333-333333333331';
  const group2Id = 'e2e80008-3333-4333-8333-333333333332';

  const studentUser1Id = 'e2e80008-4444-4444-8444-444444444441';
  const student1Id = 'e2e80008-5555-4555-8555-555555555551';

  const studentUser2Id = 'e2e80008-4444-4444-8444-444444444442';
  const student2Id = 'e2e80008-5555-4555-8555-555555555552';

  const studentUser3Id = 'e2e80008-4444-4444-8444-444444444443';
  const student3Id = 'e2e80008-5555-4555-8555-555555555553';

  const fillBlankActId = 'e2e80008-6666-4666-8666-666666666661';
  const gameActId = 'e2e80008-6666-4666-8666-666666666662';

  const asgFillBlankId = 'e2e80008-7777-4777-8777-777777777771';
  const asgGameId = 'e2e80008-7777-4777-8777-777777777772';
  const asgCancelledId = 'e2e80008-7777-4777-8777-777777777773';

  beforeAll(async () => {
    isPostgresAvailable = await checkPostgresRunning();
    if (!isPostgresAvailable) {
      console.warn('PostgreSQL no está disponible en localhost; saltando suite E2E de estadísticas en PostgreSQL.');
      return;
    }

    if (!process.env.DATABASE_URL && (await checkPortOpen(5433))) {
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/englove_dev?schema=public';
    }

    prisma = new PrismaService();
    await prisma.$connect();

    const gamificationService = new GamificationService(prisma);
    statsService = new StatsService(prisma, gamificationService);

    const configService = new ConfigService({ APP_ENV: 'local' });
    const pendingSummaryService = new PendingSummaryService(prisma);
    const mailService = new MailService(configService);
    maintenanceService = new MaintenanceService(
      prisma,
      gamificationService,
      undefined,
      undefined,
      pendingSummaryService,
      mailService,
    );

    // Clean fixtures in reverse dependency order
    await prisma.scheduledJobRun.deleteMany({ where: { organization_id: orgId } });
    await prisma.progressEvent.deleteMany({ where: { organization_id: orgId } });
    await prisma.review.deleteMany({ where: { organization_id: orgId } });
    await prisma.attempt.deleteMany({ where: { organization_id: orgId } });
    await prisma.assignment.deleteMany({ where: { organization_id: orgId } });
    await prisma.gameDetail.deleteMany({ where: { organization_id: orgId } });
    await prisma.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
    await prisma.activity.deleteMany({ where: { organization_id: orgId } });
    await prisma.groupMembership.deleteMany({ where: { organization_id: orgId } });
    await prisma.group.deleteMany({ where: { organization_id: orgId } });
    await prisma.student.deleteMany({ where: { organization_id: orgId } });
    await prisma.user.deleteMany({ where: { organization_id: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });

    // 1. Organization
    await prisma.organization.create({
      data: {
        id: orgId,
        name: 'Org E2E Stats',
        slug: 'org-e2e-stats',
      },
    });

    // 2. Teacher
    await prisma.user.create({
      data: {
        id: teacherUserId,
        organization_id: orgId,
        email: 'teacher.stats@englove.org',
        name: 'Profesora Stats',
        password_hash: 'dummyhash',
        role: Role.teacher,
      },
    });

    // 3. Groups (Group 1: A1, Group 2: B1)
    await prisma.group.createMany({
      data: [
        { id: group1Id, organization_id: orgId, name: 'Grupo A1 Stats' },
        { id: group2Id, organization_id: orgId, name: 'Grupo B1 Stats' },
      ],
    });

    // 4. Students
    // Student 1: A1, Group 1, approved
    await prisma.user.create({
      data: {
        id: studentUser1Id,
        organization_id: orgId,
        email: 'student1.stats@englove.org',
        name: 'Ana Gomez',
        password_hash: 'dummyhash',
        role: Role.student,
      },
    });
    await prisma.student.create({
      data: {
        id: student1Id,
        organization_id: orgId,
        user_id: studentUser1Id,
        birth_date: new Date('2014-05-10'),
        age_segment: AgeSegment.teens,
        level: Level.A1,
        approval_status: ApprovalStatus.approved,
      },
    });
    await prisma.groupMembership.create({
      data: {
        id: 'e2e80008-8888-4888-8888-888888888881',
        organization_id: orgId,
        group_id: group1Id,
        student_id: student1Id,
        joined_at: new Date('2026-08-01T00:00:00Z'),
      },
    });

    // Student 2: A1, Group 1, approved
    await prisma.user.create({
      data: {
        id: studentUser2Id,
        organization_id: orgId,
        email: 'student2.stats@englove.org',
        name: 'Beto Lopez',
        password_hash: 'dummyhash',
        role: Role.student,
      },
    });
    await prisma.student.create({
      data: {
        id: student2Id,
        organization_id: orgId,
        user_id: studentUser2Id,
        birth_date: new Date('2015-02-14'),
        age_segment: AgeSegment.kids,
        level: Level.A1,
        approval_status: ApprovalStatus.approved,
      },
    });
    await prisma.groupMembership.create({
      data: {
        id: 'e2e80008-8888-4888-8888-888888888882',
        organization_id: orgId,
        group_id: group1Id,
        student_id: student2Id,
        joined_at: new Date('2026-08-01T00:00:00Z'),
      },
    });

    // Student 3: B1, Group 2, approved (inactive)
    await prisma.user.create({
      data: {
        id: studentUser3Id,
        organization_id: orgId,
        email: 'student3.stats@englove.org',
        name: 'Carlos Diaz',
        password_hash: 'dummyhash',
        role: Role.student,
      },
    });
    await prisma.student.create({
      data: {
        id: student3Id,
        organization_id: orgId,
        user_id: studentUser3Id,
        birth_date: new Date('2013-09-20'),
        age_segment: AgeSegment.teens,
        level: Level.B1,
        approval_status: ApprovalStatus.approved,
      },
    });
    await prisma.groupMembership.create({
      data: {
        id: 'e2e80008-8888-4888-8888-888888888883',
        organization_id: orgId,
        group_id: group2Id,
        student_id: student3Id,
        joined_at: new Date('2026-08-01T00:00:00Z'),
      },
    });

    // 5. Activities
    await prisma.activity.create({
      data: {
        id: fillBlankActId,
        organization_id: orgId,
        title: 'FillBlank Animals',
        type: ActivityType.fill_blank,
        level: Level.A1,
        status: ActivityStatus.published,
        expected_duration_seconds: 120,
        created_by: teacherUserId,
        fill_blank_detail: {
          create: {
            organization_id: orgId,
            config: { items: [{ question: 'The cat is ___', answers: ['sleeping'] }] },
            answer_key: { items: [['sleeping']] },
          },
        },
      },
    });

    await prisma.activity.create({
      data: {
        id: gameActId,
        organization_id: orgId,
        title: 'Match Words',
        type: ActivityType.game,
        level: Level.A1,
        status: ActivityStatus.published,
        expected_duration_seconds: 90,
        created_by: teacherUserId,
        game_detail: {
          create: {
            organization_id: orgId,
            mechanic: GameMechanic.match,
            config: { pairs: [] },
            answer_key: { pairs: [] },
          },
        },
      },
    });

    // 6. Assignments
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    // Closed assignment with historical_student_count = 2
    await prisma.assignment.create({
      data: {
        id: asgFillBlankId,
        organization_id: orgId,
        activity_id: fillBlankActId,
        group_id: group1Id,
        opens_at: tenDaysAgo,
        due_at: twoDaysAgo,
        historical_student_count: 2,
      },
    });

    // Game assignment
    await prisma.assignment.create({
      data: {
        id: asgGameId,
        organization_id: orgId,
        activity_id: gameActId,
        group_id: group1Id,
        opens_at: tenDaysAgo,
        due_at: inTenDays,
      },
    });

    // Cancelled assignment
    await prisma.assignment.create({
      data: {
        id: asgCancelledId,
        organization_id: orgId,
        activity_id: fillBlankActId,
        group_id: group1Id,
        opens_at: tenDaysAgo,
        due_at: inTenDays,
        cancelled_at: new Date(),
      },
    });

    // 7. Attempts
    // Student 1 on asgFillBlank:
    // Attempt 1: score 2.0 (graded 4 days ago)
    const att1 = await prisma.attempt.create({
      data: {
        id: 'e2e80008-9999-4999-8999-999999999991',
        organization_id: orgId,
        assignment_id: asgFillBlankId,
        student_id: student1Id,
        attempt_number: 1,
        status: AttemptStatus.graded,
        score: new Prisma.Decimal(2.0),
        started_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000 - 300 * 1000),
        finished_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000),
        graded_at: new Date(now.getTime() - 4 * 24 * 3600 * 1000),
        retry_granted_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
        retry_extend_until: inTenDays,
      },
    });

    // Attempt 2: score 4.5 (graded 2 days ago, rule of last graded attempt)
    await prisma.attempt.create({
      data: {
        id: 'e2e80008-9999-4999-8999-999999999992',
        organization_id: orgId,
        assignment_id: asgFillBlankId,
        student_id: student1Id,
        attempt_number: 2,
        status: AttemptStatus.graded,
        score: new Prisma.Decimal(4.5),
        started_at: new Date(now.getTime() - 2 * 24 * 3600 * 1000 - 150 * 1000),
        finished_at: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
        graded_at: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
        previous_attempt_id: att1.id,
        // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10 y SPEC-08 RF-9
        flags: ['implausible_duration'],
      },
    });

    // Student 2 on asgFillBlank:
    // Attempt 1: score 3.8
    await prisma.attempt.create({
      data: {
        id: 'e2e80008-9999-4999-8999-999999999993',
        organization_id: orgId,
        assignment_id: asgFillBlankId,
        student_id: student2Id,
        attempt_number: 1,
        status: AttemptStatus.graded,
        score: new Prisma.Decimal(3.8),
        started_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000 - 100 * 1000),
        finished_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
        graded_at: new Date(now.getTime() - 3 * 24 * 3600 * 1000),
      },
    });

    // Student 1 on Game: Attempt 1 and Attempt 2 (autonomous game)
    await prisma.attempt.create({
      data: {
        id: 'e2e80008-9999-4999-8999-999999999994',
        organization_id: orgId,
        assignment_id: asgGameId,
        student_id: student1Id,
        attempt_number: 1,
        status: AttemptStatus.graded,
        score: new Prisma.Decimal(4.0),
        started_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000 - 60 * 1000),
        finished_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
        graded_at: new Date(now.getTime() - 1 * 24 * 3600 * 1000),
      },
    });
    await prisma.attempt.create({
      data: {
        id: 'e2e80008-9999-4999-8999-999999999995',
        organization_id: orgId,
        assignment_id: asgGameId,
        student_id: student1Id,
        attempt_number: 2,
        status: AttemptStatus.graded,
        score: new Prisma.Decimal(5.0),
        started_at: new Date(now.getTime() - 1800 * 1000),
        finished_at: new Date(now.getTime() - 1200 * 1000),
        graded_at: new Date(now.getTime() - 1200 * 1000),
      },
    });

    // 8. ProgressEvents
    // Student 1 active recently
    await prisma.progressEvent.create({
      data: {
        id: 'e2e80008-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        organization_id: orgId,
        student_id: student1Id,
        type: ProgressEventType.attempt_completed,
        occurred_at: new Date(),
      },
    });
    // Student 2 active 5 days ago
    await prisma.progressEvent.create({
      data: {
        id: 'e2e80008-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        organization_id: orgId,
        student_id: student2Id,
        type: ProgressEventType.audio_submitted,
        occurred_at: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
      },
    });
    // Student 3: event 25 days ago (inactive alert!)
    await prisma.progressEvent.create({
      data: {
        id: 'e2e80008-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
        organization_id: orgId,
        student_id: student3Id,
        type: ProgressEventType.attempt_completed,
        occurred_at: new Date(now.getTime() - 25 * 24 * 3600 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.scheduledJobRun.deleteMany({ where: { organization_id: orgId } });
      await prisma.progressEvent.deleteMany({ where: { organization_id: orgId } });
      await prisma.review.deleteMany({ where: { organization_id: orgId } });
      await prisma.attempt.deleteMany({ where: { organization_id: orgId } });
      await prisma.assignment.deleteMany({ where: { organization_id: orgId } });
      await prisma.gameDetail.deleteMany({ where: { organization_id: orgId } });
      await prisma.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
      await prisma.activity.deleteMany({ where: { organization_id: orgId } });
      await prisma.groupMembership.deleteMany({ where: { organization_id: orgId } });
      await prisma.group.deleteMany({ where: { organization_id: orgId } });
      await prisma.student.deleteMany({ where: { organization_id: orgId } });
      await prisma.user.deleteMany({ where: { organization_id: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.$disconnect();
    } catch {}
  });

  it('Paso 1: GET /overview en PostgreSQL real verifica último intento calificado, alerta inactividad 14d y exclusión de game/canceladas', async () => {
    if (!isPostgresAvailable) return;

    const overview = await statsService.getOverview(orgId, {});

    expect(overview.organizationSummary.totalApprovedStudents).toBe(3);
    expect(overview.organizationSummary.activeStudentsInPeriod).toBeGreaterThanOrEqual(2);

    // Rule of last graded attempt:
    // Student 1 on asgFillBlank: 4.5 (not 2.0!)
    // Student 1 on asgGame: 5.0 (not 4.0!)
    // Student 2 on asgFillBlank: 3.8
    // Average = (4.5 + 5.0 + 3.8) / 3 = 13.3 / 3 = 4.433 => 4.4
    expect(overview.organizationSummary.averageScore).toBe(4.4);

    // Inactive alerts: student 3 has last activity 25 days ago (> 14 days)
    expect(overview.inactiveAlerts.length).toBe(1);
    expect(overview.inactiveAlerts[0]!.studentId).toBe(student3Id);
    expect(overview.inactiveAlerts[0]!.daysSinceLastActivity).toBeGreaterThanOrEqual(24);

    // Compliance: asgFillBlank has 2 students obligated, both submitted => 100%
    // asgGame and asgCancelled are excluded from completionRatePercent
    expect(overview.organizationSummary.completionRatePercent).toBe(100);

    // byLevel: Level A1 and B1 present
    const lvlA1 = overview.byLevel.find((l) => l.level === Level.A1);
    expect(lvlA1).toBeDefined();
    expect(lvlA1?.studentCount).toBe(2);

    const lvlB1 = overview.byLevel.find((l) => l.level === Level.B1);
    expect(lvlB1).toBeDefined();
    expect(lvlB1?.studentCount).toBe(1);
  });

  it('Paso 2: GET /groups/:id en PostgreSQL real verifica tendencias 30d/7d simultáneas y ordenamiento de grupo', async () => {
    if (!isPostgresAvailable) return;

    const groupStats = await statsService.getGroupStats(orgId, group1Id, {
      trendMode: '30d',
      sortBy: 'studentName',
      sortOrder: 'asc',
    });

    expect(groupStats.group.id).toBe(group1Id);
    expect(groupStats.students.length).toBe(2);

    // Alphabetical order: Ana Gomez, Beto Lopez
    expect(groupStats.students[0]!.studentName).toBe('Ana Gomez');
    expect(groupStats.students[1]!.studentName).toBe('Beto Lopez');

    // Both trend30d and trend7d are computed simultaneously
    const ana = groupStats.students[0]!;
    expect(ana.trend30d).toBeDefined();
    expect(ana.trend7d).toBeDefined();
    expect(ana.completedAssignedCount).toBe(1);
    expect(ana.completionRatePercent).toBe(100);
  });

  it('Paso 3: GET /leaderboard en PostgreSQL real verifica orden determinista y filtrado por groupId y level', async () => {
    if (!isPostgresAvailable) return;

    // 1. Leaderboard without filters
    const allLb = await statsService.getLeaderboard(orgId, {});
    expect(allLb.entries.length).toBe(3);
    expect(allLb.entries[0]!.rank).toBe(1);
    expect(allLb.entries[1]!.rank).toBe(2);
    expect(allLb.entries[2]!.rank).toBe(3);

    // 2. Filter by Level A1: exactly 2 students
    const a1Lb = await statsService.getLeaderboard(orgId, { level: Level.A1 });
    expect(a1Lb.entries.length).toBe(2);
    expect(a1Lb.entries.every((e) => e.level === Level.A1)).toBe(true);

    // 3. Filter by groupId: tests the memberships relation query in real PostgreSQL!
    const g1Lb = await statsService.getLeaderboard(orgId, { groupId: group1Id });
    expect(g1Lb.entries.length).toBe(2);
    expect(g1Lb.entries.every((e) => e.groupId === group1Id)).toBe(true);

    // 4. Filter by group 2: exactly 1 student
    const g2Lb = await statsService.getLeaderboard(orgId, { groupId: group2Id });
    expect(g2Lb.entries.length).toBe(1);
    expect(g2Lb.entries[0]!.studentId).toBe(student3Id);
  });

  it('Paso 4: GET /students/:id en PostgreSQL real verifica scoreSeries (1..N en games), usedExtendedDeadline, banderas y calendario ISO', async () => {
    if (!isPostgresAvailable) return;

    const studentStats = await statsService.getStudentStats(orgId, student1Id, {});

    expect(studentStats.student.id).toBe(student1Id);
    expect(studentStats.student.name).toBe('Ana Gomez');

    // Score series:
    // asgFillBlank has latest attempt 2 (score 4.5, usedExtendedDeadline = true, bandera duración = true)
    // asgGame has BOTH attempt 1 (4.0) and attempt 2 (5.0) because game includes 1..N!
    const series = studentStats.performance.scoreSeries;
    expect(series.length).toBe(3);

    const fillBlankPoint = series.find((p) => p.activityType === ActivityType.fill_blank);
    expect(fillBlankPoint).toBeDefined();
    expect(fillBlankPoint?.score).toBe(4.5);
    expect(fillBlankPoint?.attemptNumber).toBe(2);
    expect(fillBlankPoint?.usedExtendedDeadline).toBe(true);
    // guardrails-ignore G-C06: prueba de flag de negocio implausibleDuration segun SPEC-05 RF-10 y SPEC-08 RF-9
    expect(fillBlankPoint?.implausibleDuration).toBe(true);

    const gamePoints = series.filter((p) => p.activityType === ActivityType.game);
    expect(gamePoints.length).toBe(2);
    expect(gamePoints[0]!.attemptNumber).toBe(1);
    expect(gamePoints[1]!.attemptNumber).toBe(2);

    // Consistency weekly calendar
    expect(studentStats.consistency.weeklyCalendar.length).toBe(12);

    // Time buckets
    expect(studentStats.consistency.dailyTime.length).toBeGreaterThan(0);
    expect(studentStats.consistency.weeklyTime.length).toBeGreaterThan(0);
  });

  it('Paso 5: Presupuesto de latencia < 500 ms verificado directamente contra PostgreSQL', async () => {
    if (!isPostgresAvailable) return;

    const t0 = performance.now();
    await statsService.getOverview(orgId, {});
    const tOverview = performance.now() - t0;

    const t1 = performance.now();
    await statsService.getGroupStats(orgId, group1Id, {});
    const tGroup = performance.now() - t1;

    const t2 = performance.now();
    await statsService.getLeaderboard(orgId, {});
    const tLeaderboard = performance.now() - t2;

    const t3 = performance.now();
    await statsService.getStudentStats(orgId, student1Id, {});
    const tStudent = performance.now() - t3;

    expect(tOverview).toBeLessThan(500);
    expect(tGroup).toBeLessThan(500);
    expect(tLeaderboard).toBeLessThan(500);
    expect(tStudent).toBeLessThan(500);
  });

  it('Paso 6: Job teacher_pending_summary ejecuta y registra en ScheduledJobRun en PostgreSQL real', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const periodKey = '2026-10-28';
    await maintenanceService.runTeacherPendingSummary(periodKey, undefined, orgId);

    const job = await prisma.scheduledJobRun.findFirst({
      where: {
        organization_id: orgId,
        job_key: 'teacher_pending_summary',
        period_key: periodKey,
      },
    });

    expect(job).toBeDefined();
    expect(job?.status).toBe('done');

    // Executing again on the same day or next day should skip due to 3-day block rule (diffDays < 3)
    const countBefore = await prisma.scheduledJobRun.count({
      where: { organization_id: orgId, job_key: 'teacher_pending_summary' },
    });

    await maintenanceService.runTeacherPendingSummary('2026-10-29', undefined, orgId);

    const countAfter = await prisma.scheduledJobRun.count({
      where: { organization_id: orgId, job_key: 'teacher_pending_summary' },
    });

    expect(countAfter).toBe(countBefore); // Skipped because 1 day < 3 days!
  });

  it('Paso 7: Traslado de grupo y reincorporación en PostgreSQL real no produce duplicados y consolida cumplimiento', async () => {
    if (!isPostgresAvailable || !prisma) return;

    // Simulate Student 2 transferring from Group 1 to Group 2, then re-enrolling in Group 1
    // 1. Set left_at on current Group 1 membership
    const m2 = await prisma.groupMembership.findFirst({
      where: { organization_id: orgId, student_id: student2Id, group_id: group1Id },
    });
    expect(m2).toBeDefined();

    const transferDate = new Date();
    await prisma.groupMembership.update({
      where: { id: m2!.id },
      data: { left_at: transferDate },
    });

    // 2. Create new membership in Group 1 (re-enrolled!)
    await prisma.groupMembership.create({
      data: {
        id: 'e2e80008-8888-4888-8888-888888888889',
        organization_id: orgId,
        group_id: group1Id,
        student_id: student2Id,
        joined_at: transferDate,
        left_at: null,
      },
    });

    // Query group stats for Group 1 in PostgreSQL
    const groupStats = await statsService.getGroupStats(orgId, group1Id, {});

    // Student 2 must appear EXACTLY ONCE in students
    const betoRows = groupStats.students.filter((s) => s.studentId === student2Id);
    expect(betoRows.length).toBe(1);
    expect(betoRows[0]!.isCurrentMember).toBe(true);

    // Group studentCount must remain 2 (Ana Gomez, Beto Lopez)
    expect(groupStats.summary.studentCount).toBe(2);

    // WeekStart check: ISO 8601 Monday
    const stStats = await statsService.getStudentStats(orgId, student2Id, {});
    const firstWk = stStats.consistency.weeklyCalendar[0]!;
    const monday = new Date(`${firstWk.weekStart}T12:00:00Z`);
    expect(monday.getUTCDay()).toBe(1);
  });
});
