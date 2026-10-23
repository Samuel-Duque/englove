import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ActivityType,
  AttemptStatus,
  Level,
  Role,
  AgeSegment,
  ProgressEventType,
  parseFillBlankSimpleSyntax,
} from '@englove/shared';
import { AttemptsService } from '../src/attempts/attempts.service';
import { ActivitiesService } from '../src/activities/activities.service';
import { AssignmentsService } from '../src/assignments/assignments.service';
import { ScoringService } from '../src/scoring/scoring.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { MediaService } from '../src/media/media.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as net from 'net';

function getPostgresPort(): number {
  const url = process.env.DATABASE_URL;
  if (!url) return 5432;
  try {
    const parsed = new URL(url);
    return parsed.port ? parseInt(parsed.port, 10) : 5432;
  } catch {
    return 5432;
  }
}

async function checkPostgresRunning(): Promise<boolean> {
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
    socket.connect(getPostgresPort(), '127.0.0.1');
  });
}

describe('SPEC-05 RF-30: Flujo de intento del alumno en PostgreSQL real (ENG-072)', () => {
  let isPostgresAvailable = false;
  let prisma: PrismaService | null = null;
  let activitiesService: ActivitiesService;
  let assignmentsService: AssignmentsService;
  let attemptsService: AttemptsService;

  const orgId = 'e2e77777-1111-4111-8111-111111111111';
  const teacherId = 'e2e77777-2222-4222-8222-222222222222';
  const studentUserId = 'e2e77777-3333-4333-8333-333333333333';
  const studentId = 'e2e77777-4444-4444-8444-444444444444';
  const groupId = 'e2e77777-5555-4555-8555-555555555555';

  const itemId = 'e2e77777-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let blankId = '';
  let correctOptionId = '';

  let activityId = '';
  let assignmentId = '';
  let attemptId = '';
  let attemptToken = '';

  beforeAll(async () => {
    isPostgresAvailable = await checkPostgresRunning();
    if (!isPostgresAvailable) {
      console.warn('PostgreSQL no está disponible en localhost:5432; saltando pruebas E2E contra DB real.');
      return;
    }

    try {
      prisma = new PrismaService();
      await prisma.$connect();

      const configService = new ConfigService({
        JWT_SECRET: 'e2e-student-flow-test-jwt-secret-min-32-chars-long!',
      });
      const jwtService = new JwtService({
        secret: 'e2e-student-flow-test-jwt-secret-min-32-chars-long!',
      });
      const scoringService = new ScoringService();
      const gamificationService = new GamificationService(prisma);
      const mediaService = new MediaService(prisma, configService);
      const featureFlagsService = new FeatureFlagsService(prisma);

      activitiesService = new ActivitiesService(prisma);
      assignmentsService = new AssignmentsService(prisma);
      attemptsService = new AttemptsService(
        prisma,
        configService,
        jwtService,
        scoringService,
        gamificationService,
        mediaService,
        featureFlagsService,
      );

      // Clean prior fixtures in reverse dependency order
      await prisma.badgeAward.deleteMany({ where: { organization_id: orgId } });
      await prisma.badgeRule.deleteMany({ where: { organization_id: orgId } });
      await prisma.progressEvent.deleteMany({ where: { organization_id: orgId } });
      await prisma.attempt.deleteMany({ where: { organization_id: orgId } });
      await prisma.assignment.deleteMany({ where: { organization_id: orgId } });
      await prisma.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
      await prisma.activity.deleteMany({ where: { organization_id: orgId } });
      await prisma.groupMembership.deleteMany({ where: { organization_id: orgId } });
      await prisma.group.deleteMany({ where: { organization_id: orgId } });
      await prisma.student.deleteMany({ where: { organization_id: orgId } });
      await prisma.user.deleteMany({ where: { organization_id: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });

      // Create Organization
      await prisma.organization.create({
        data: {
          id: orgId,
          name: 'E2E Student Flow Org',
          slug: 'e2e-student-flow-org',
        },
      });

      // Create Teacher User
      await prisma.user.create({
        data: {
          id: teacherId,
          organization_id: orgId,
          email: 'e2e-studentflow-teacher@test.com',
          name: 'Teacher E2E Real Flow',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.teacher,
        },
      });

      // Create Student User
      await prisma.user.create({
        data: {
          id: studentUserId,
          organization_id: orgId,
          email: 'e2e-studentflow-student@test.com',
          name: 'Student Real E2E Flow',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.student,
        },
      });

      // Create Student profile
      await prisma.student.create({
        data: {
          id: studentId,
          user_id: studentUserId,
          organization_id: orgId,
          birth_date: new Date('2016-05-15'),
          age_segment: AgeSegment.kids,
          approval_status: 'approved',
          can_switch_interface: false,
        },
      });

      // Create Group
      await prisma.group.create({
        data: {
          id: groupId,
          organization_id: orgId,
          name: 'Group Kids Flow A1',
        },
      });

      // Create GroupMembership
      await prisma.groupMembership.create({
        data: {
          organization_id: orgId,
          student_id: studentId,
          group_id: groupId,
          joined_at: new Date(),
        },
      });

      // Teacher creates and publishes fill_blank activity
      const parsed = parseFillBlankSimpleSyntax('The cat is [sleeping|barking]');
      blankId = parsed.blanks[0]!.id;
      // In parseFillBlankSimpleSyntax, the first option is the correct one
      correctOptionId = parsed.answerKey[blankId]!;

      const createdActivity = await activitiesService.createActivity(orgId, teacherId, {
        title: 'Fill Blank E2E Student Flow',
        type: ActivityType.fill_blank,
        level: Level.A1,
        config: {
          items: [
            {
              id: itemId,
              prompt: parsed.prompt,
              blanks: parsed.blanks,
            },
          ],
        },
        answerKey: {
          items: {
            [itemId]: parsed.answerKey,
          },
        },
      });
      activityId = createdActivity.id;

      await activitiesService.publishActivity(orgId, activityId);

      // Teacher assigns activity to group (active now)
      const assignResult = await assignmentsService.createAssignments(orgId, {
        activityId,
        groupIds: [groupId],
        opensAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        dueAt: new Date(Date.now() + 86400000).toISOString(), // in 24 hours
      });
      assignmentId = assignResult.items[0]!.id;
    } catch (err: unknown) {
      console.warn('Error inicializando PostgreSQL para E2E student flow:', err);
      isPostgresAvailable = false;
    }
  });

  afterAll(async () => {
    if (prisma && isPostgresAvailable) {
      try {
        await prisma.badgeAward.deleteMany({ where: { organization_id: orgId } });
        await prisma.badgeRule.deleteMany({ where: { organization_id: orgId } });
        await prisma.progressEvent.deleteMany({ where: { organization_id: orgId } });
        await prisma.attempt.deleteMany({ where: { organization_id: orgId } });
        await prisma.assignment.deleteMany({ where: { organization_id: orgId } });
        await prisma.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
        await prisma.activity.deleteMany({ where: { organization_id: orgId } });
        await prisma.groupMembership.deleteMany({ where: { organization_id: orgId } });
        await prisma.group.deleteMany({ where: { organization_id: orgId } });
        await prisma.student.deleteMany({ where: { organization_id: orgId } });
        await prisma.user.deleteMany({ where: { organization_id: orgId } });
        await prisma.organization.deleteMany({ where: { id: orgId } });
      } catch (err) {
        console.warn('Error en limpieza post-E2E:', err);
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  it('Paso 1: Alumno inicia intento válidamente (RF-3)', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const result = await attemptsService.startAttempt(orgId, studentId, assignmentId);

    expect(result.attempt).toBeDefined();
    expect(result.attempt.status).toBe(AttemptStatus.in_progress);
    expect(result.attempt.attemptNumber).toBe(1);
    expect(result.attemptToken).toBeTruthy();
    if (!result.attemptToken) {
      throw new Error('attemptToken should be defined');
    }

    attemptId = result.attempt.id;
    attemptToken = result.attemptToken;

    // Verificar persistencia en base de datos real
    const dbAttempt = await prisma.attempt.findFirst({
      where: { organization_id: orgId, id: attemptId },
    });
    expect(dbAttempt).not.toBeNull();
    expect(dbAttempt?.status).toBe('in_progress');
    expect(dbAttempt?.student_id).toBe(studentId);
  });

  it('Paso 2: Alumno envía eventos de respuesta con clientEventId idempotente (RF-7)', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const clientEventId1 = 'e2e-student-event-001';
    const submitResult = await attemptsService.submitEvents(
      orgId,
      studentId,
      attemptId,
      attemptToken,
      {
        events: [
          {
            clientEventId: clientEventId1,
            itemId,
            answer: {
              [blankId]: correctOptionId,
            },
          },
        ],
      },
    );

    expect(submitResult.acceptedEventIds).toContain(clientEventId1);

    // Reenvío idempotente del mismo clientEventId no genera duplicados
    const resubmitResult = await attemptsService.submitEvents(
      orgId,
      studentId,
      attemptId,
      attemptToken,
      {
        events: [
          {
            clientEventId: clientEventId1,
            itemId,
            answer: {
              [blankId]: correctOptionId,
            },
          },
        ],
      },
    );
    expect(resubmitResult.acceptedEventIds).toContain(clientEventId1);
  });

  it('Paso 3: Alumno finaliza entrega, se autocalifica en servidor y registra eventos (RF-8, RF-9, RF-16)', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const completion = await attemptsService.completeAttempt(
      orgId,
      studentId,
      attemptId,
      attemptToken,
      {},
    );

    expect(completion.attempt.status).toBe(AttemptStatus.graded);
    expect(Number(completion.attempt.score)).toBe(5.0);
    expect(completion.attempt.gradedAt).toBeDefined();
    expect(completion.correction).toBeDefined();
    const correctionMap = completion.correction as Record<string, Record<string, { correct: boolean }>>;
    expect(correctionMap[itemId]?.[blankId]?.correct).toBe(true);

    // Verificar en PostgreSQL real
    const dbAttempt = await prisma.attempt.findFirst({
      where: { organization_id: orgId, id: attemptId },
    });
    expect(dbAttempt?.status).toBe('graded');
    expect(Number(dbAttempt?.score)).toBe(5.0);
    expect(dbAttempt?.finished_at).not.toBeNull();
    expect(dbAttempt?.graded_at).not.toBeNull();

    // Verificar emisión de ProgressEvent
    const progressEvents = await prisma.progressEvent.findMany({
      where: {
        organization_id: orgId,
        student_id: studentId,
        attempt_id: attemptId,
      },
    });
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    const completedEvent = progressEvents.find(
      (e) => e.type === ProgressEventType.attempt_completed,
    );
    expect(completedEvent).toBeDefined();
    expect(Number(completedEvent?.value)).toBe(5.0);
  });

  it('Paso 4: Consulta de progreso propio refleja estrellas y racha actualizada (RF-22)', async () => {
    if (!isPostgresAvailable || !prisma) return;

    const progress = await attemptsService.getStudentProgress(orgId, studentId);

    expect(progress.activities.length).toBe(1);
    expect(progress.activities[0]?.score).toBe(5.0);
    expect(progress.activities[0]?.stars).toBe(3); // 5.0 score -> 3 stars (Decision 101)
    expect(progress.streak.weeks).toBeGreaterThanOrEqual(1);
    expect(progress.streak.forgivenessAvailable).toBe(true);
  });
});
