import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ActivityStatus,
  ActivityType,
  AttemptStatus,
  GameMechanic,
  Level,
  Role,
  AgeSegment,
  ProgressEventType,
  GameConfig,
  GameAnswerKey,
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
import { ConflictException } from '@nestjs/common';
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

describe('SPEC-06: Flujo integral de microjuegos en PostgreSQL real con Docker (ENG-080 a ENG-087)', () => {
  let isPostgresAvailable = false;
  let prisma: PrismaService | null = null;
  let activitiesService: ActivitiesService;
  let assignmentsService: AssignmentsService;
  let attemptsService: AttemptsService;

  const orgId = 'e2e66666-1111-4111-8111-111111111111';
  const teacherId = 'e2e66666-2222-4222-8222-222222222222';
  const studentUserId = 'e2e66666-3333-4333-8333-333333333333';
  const studentId = 'e2e66666-4444-4444-8444-444444444444';
  const groupId = 'e2e66666-5555-4555-8555-555555555555';
  const leftAppleId = '11111111-1111-4111-8111-111111111101';
  const leftDogId = '11111111-1111-4111-8111-111111111102';
  const rightManzanaId = '22222222-2222-4222-8222-222222222201';
  const rightPerroId = '22222222-2222-4222-8222-222222222202';

  let activityId = '';
  let assignmentId = '';
  let attempt1Id = '';
  let attempt1Token = '';
  let attempt2Id = '';

  beforeAll(async () => {
    isPostgresAvailable = await checkPostgresRunning();
    if (!isPostgresAvailable) {
      console.warn('PostgreSQL no está disponible en localhost; saltando pruebas E2E de microjuegos en DB real.');
      return;
    }

    try {
      prisma = new PrismaService();
      await prisma.$connect();

      const configService = new ConfigService({
        JWT_SECRET: 'e2e-microgames-flow-test-jwt-secret-min-32-chars-long!',
      });
      const jwtService = new JwtService({
        secret: 'e2e-microgames-flow-test-jwt-secret-min-32-chars-long!',
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
      await prisma.gameDetail.deleteMany({ where: { organization_id: orgId } });
      await prisma.activity.deleteMany({ where: { organization_id: orgId } });
      await prisma.groupMembership.deleteMany({ where: { organization_id: orgId } });
      await prisma.group.deleteMany({ where: { organization_id: orgId } });
      await prisma.student.deleteMany({ where: { organization_id: orgId } });
      await prisma.user.deleteMany({ where: { organization_id: orgId } });
      await prisma.featureFlag.deleteMany({ where: { organization_id: orgId } });
      await prisma.scheduledJobRun.deleteMany({ where: { organization_id: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });

      // Seed organization
      await prisma.organization.create({
        data: {
          id: orgId,
          name: 'Academia E2E Microjuegos SPEC-06',
          slug: 'e2e-microjuegos-spec06',
        },
      });

      // Feature flags canonical: games = false, extra_content = true
      await prisma.featureFlag.create({
        data: {
          organization_id: orgId,
          key: 'games',
          enabled: false,
          config: {
            passing_score: 3.5,
            retention_days: 90,
            pending_upload_ttl_days: 7,
            ungraded_reminder_days: 3,
          },
        },
      });

      await prisma.featureFlag.create({
        data: {
          organization_id: orgId,
          key: 'extra_content',
          enabled: true,
          config: {},
        },
      });

      // Seed teacher user
      await prisma.user.create({
        data: {
          id: teacherId,
          organization_id: orgId,
          email: 'teacher-microgames@englove.test',
          name: 'Teacher Microjuegos',
          password_hash: 'mock-hash-pass',
          role: Role.teacher,
        },
      });

      // Seed student user and student record
      await prisma.user.create({
        data: {
          id: studentUserId,
          organization_id: orgId,
          email: 'student-microgames@englove.test',
          name: 'Student Microjuegos',
          password_hash: 'mock-hash-pass',
          role: Role.student,
        },
      });

      await prisma.student.create({
        data: {
          id: studentId,
          organization_id: orgId,
          user_id: studentUserId,
          birth_date: new Date('2016-05-15'),
          age_segment: AgeSegment.kids,
          approval_status: 'approved',
          can_switch_interface: false,
          guardian_name: 'Parent E2E',
          guardian_contact: '+573000000000',
        },
      });

      // Seed group and active membership
      await prisma.group.create({
        data: {
          id: groupId,
          organization_id: orgId,
          name: 'Kids Group 101',
        },
      });

      await prisma.groupMembership.create({
        data: {
          organization_id: orgId,
          group_id: groupId,
          student_id: studentId,
          joined_at: new Date(),
        },
      });

      // Seed badge rule for first activity completed
      await prisma.badgeRule.create({
        data: {
          organization_id: orgId,
          key: 'first_activity',
          name: 'Primera misión',
          description: 'Completaste tu primer microjuego con éxito',
          icon: 'rocket',
          rule: { type: 'event_count', event: 'attempt_completed', threshold: 1 },
          active: true,
        },
      });
    } catch (err) {
      console.warn('Error conectando a Docker PostgreSQL para E2E de microjuegos:', err);
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
        await prisma.gameDetail.deleteMany({ where: { organization_id: orgId } });
        await prisma.activity.deleteMany({ where: { organization_id: orgId } });
        await prisma.groupMembership.deleteMany({ where: { organization_id: orgId } });
        await prisma.group.deleteMany({ where: { organization_id: orgId } });
        await prisma.student.deleteMany({ where: { organization_id: orgId } });
        await prisma.user.deleteMany({ where: { organization_id: orgId } });
        await prisma.featureFlag.deleteMany({ where: { organization_id: orgId } });
        await prisma.organization.deleteMany({ where: { id: orgId } });
      } catch {}
      await prisma.$disconnect();
    }
  });

  it('Paso 1: Docente crea y publica actividad de tipo game (mechanic = match) en PostgreSQL', async () => {
    if (!isPostgresAvailable) return;

    const gameConfig: GameConfig = {
      mechanic: GameMechanic.match,
      instructions: 'Une cada palabra con su traducción',
      settings: {
        left: [
          { id: leftAppleId, text: 'Apple' },
          { id: leftDogId, text: 'Dog' },
        ],
        right: [
          { id: rightManzanaId, text: 'Manzana' },
          { id: rightPerroId, text: 'Perro' },
        ],
      },
    };

    const gameAnswerKey: GameAnswerKey = {
      solution: {
        pairs: {
          [leftAppleId]: rightManzanaId,
          [leftDogId]: rightPerroId,
        },
      },
    };

    const created = await activitiesService.createActivity(orgId, teacherId, {
      title: 'Match Animals & Fruits',
      type: ActivityType.game,
      level: Level.A1,
      expectedDurationSeconds: 120,
      minPlausibleSeconds: 15,
      config: gameConfig,
      answerKey: gameAnswerKey,
    });

    activityId = created.id;
    expect(created.type).toBe(ActivityType.game);
    expect(created.status).toBe(ActivityStatus.draft);

    // Verify GameDetail persistence in PostgreSQL
    const detailInDb = await prisma!.gameDetail.findFirst({
      where: { organization_id: orgId, activity_id: activityId },
    });
    expect(detailInDb).toBeDefined();
    expect(detailInDb?.mechanic).toBe(GameMechanic.match);

    // Publish activity
    const published = await activitiesService.publishActivity(orgId, activityId);
    expect(published.status).toBe(ActivityStatus.published);
  });

  it('Paso 2: Docente asigna la actividad al grupo de alumnos', async () => {
    if (!isPostgresAvailable) return;

    const now = new Date();
    const opensAt = new Date(now.getTime() - 60000); // opened 1 min ago
    const dueAt = new Date(now.getTime() + 7 * 24 * 3600000); // due in 7 days

    const result = await assignmentsService.createAssignments(orgId, {
      activityId,
      groupIds: [groupId],
      opensAt: opensAt.toISOString(),
      dueAt: dueAt.toISOString(),
    });

    assignmentId = result.items[0]!.id;
    expect(assignmentId).toBeDefined();
    expect(result.items[0]?.activity.id).toBe(activityId);
  });

  it('Paso 3: Feature Flag gating (RF-11) — startAttempt falla con 409 si flags.games es false', async () => {
    if (!isPostgresAvailable) return;

    await expect(
      attemptsService.startAttempt(orgId, studentId, assignmentId),
    ).rejects.toThrow(ConflictException);
  });

  it('Paso 4: Habilitar feature flag games y listar asignaciones disponibles para alumno (RF-11, Decisión 104)', async () => {
    if (!isPostgresAvailable) return;

    await prisma!.featureFlag.update({
      where: {
        organization_id_key: {
          organization_id: orgId,
          key: 'games',
        },
      },
      data: { enabled: true },
    });

    const availList = await attemptsService.listStudentAssignments(orgId, studentId, {
      scope: 'available',
    });

    expect(availList.items.length).toBe(1);
    const card = availList.items[0]!;
    expect(card.id).toBe(assignmentId);
    expect(card.activity.type).toBe(ActivityType.game);
    expect(card.activity.mechanic).toBe(GameMechanic.match);
    expect(card.canStart).toBe(true);
    expect(card.latestAttempt).toBeNull();
  });

  it('Paso 5: Alumno inicia Intento #1 (RF-1, RF-7) — crea Attempt en PostgreSQL con attempt_number = 1 y entrega GamePublicConfig', async () => {
    if (!isPostgresAvailable) return;

    const runtime = await attemptsService.startAttempt(orgId, studentId, assignmentId);

    attempt1Id = runtime.attempt.id;
    attempt1Token = runtime.attemptToken!;

    expect(runtime.attempt.attemptNumber).toBe(1);
    expect(runtime.attempt.status).toBe(AttemptStatus.in_progress);
    expect(runtime.activity.type).toBe(ActivityType.game);

    const publicCfg = runtime.activity.config as { mechanic?: string; answerKey?: unknown };
    expect(publicCfg.mechanic).toBe(GameMechanic.match);
    expect(publicCfg.answerKey).toBeDefined();

    // Verify row in real PostgreSQL
    const attemptInDb = await prisma!.attempt.findFirst({
      where: { id: attempt1Id, organization_id: orgId },
    });
    expect(attemptInDb).toBeDefined();
    expect(attemptInDb?.attempt_number).toBe(1);
    expect(attemptInDb?.previous_attempt_id).toBeNull();
    expect(attemptInDb?.status).toBe(AttemptStatus.in_progress);
  });

  it('Paso 6: Transmisión de eventos de emparejamiento con idempotencia y reemplazo exacto (RF-8)', async () => {
    if (!isPostgresAvailable) return;

    // Event 1: student matches apple -> manzana, dog -> perro
    const evRes1 = await attemptsService.submitEvents(orgId, studentId, attempt1Id, attempt1Token, {
      events: [
        {
          clientEventId: 'evt-match-001',
          itemId: 'pairs',
          answer: {
            [leftAppleId]: rightManzanaId,
            [leftDogId]: rightPerroId,
          },
        },
      ],
    });
    expect(evRes1.acceptedEventIds).toContain('evt-match-001');

    // Event 2: duplicate clientEventId is ignored idempotently
    const evRes2 = await attemptsService.submitEvents(orgId, studentId, attempt1Id, attempt1Token, {
      events: [
        {
          clientEventId: 'evt-match-001',
          itemId: 'pairs',
          answer: { [leftAppleId]: 'wrong' },
        },
      ],
    });
    expect(evRes2.acceptedEventIds).toContain('evt-match-001');

    // Verify in PostgreSQL that answers reflects evt-match-001
    const attemptAfterEv = await prisma!.attempt.findFirst({
      where: { id: attempt1Id, organization_id: orgId },
    });
    const payload = attemptAfterEv?.payload as { answers?: { pairs?: Record<string, string> } };
    expect(payload.answers?.pairs?.[leftAppleId]).toBe(rightManzanaId);
    expect(payload.answers?.pairs?.[leftDogId]).toBe(rightPerroId);
  });

  it('Paso 7: Completar Intento #1 (RF-7) — calificación determinista 5.0 en servidor, insignias y finished_at en PostgreSQL', async () => {
    if (!isPostgresAvailable) return;

    // Ensure started_at was at least 20s ago so min_plausible_seconds (15s) is satisfied
    await prisma!.attempt.update({
      where: { id: attempt1Id },
      data: {
        started_at: new Date(Date.now() - 25000),
      },
    });

    const completion = await attemptsService.completeAttempt(orgId, studentId, attempt1Id, attempt1Token, {});

    expect(completion.attempt.status).toBe(AttemptStatus.graded);
    expect(completion.attempt.score).toBe(5.0);
    expect(completion.attempt.flags).toEqual([]);
    expect(completion.newBadges.length).toBeGreaterThanOrEqual(1);
    expect(completion.newBadges[0]?.key).toBe('first_activity');

    // Verify in real PostgreSQL database
    const gradedInDb = await prisma!.attempt.findFirst({
      where: { id: attempt1Id, organization_id: orgId },
    });
    expect(gradedInDb?.status).toBe(AttemptStatus.graded);
    expect(Number(gradedInDb?.score)).toBe(5.0);
    expect(gradedInDb?.finished_at).toBeDefined();
    expect(gradedInDb?.graded_at).toBeDefined();

    // Verify ProgressEvent in PostgreSQL
    const progressEventInDb = await prisma!.progressEvent.findFirst({
      where: {
        organization_id: orgId,
        student_id: studentId,
        type: ProgressEventType.attempt_completed,
      },
    });
    expect(progressEventInDb).toBeDefined();
    expect(Number(progressEventInDb?.value)).toBe(5.0);
  });

  it('Paso 8: Decisión 104 — Jugar de nuevo en asignación abierta crea un Attempt individual (attempt_number = 2) sin sobrescribir el 1', async () => {
    if (!isPostgresAvailable) return;

    const runtime2 = await attemptsService.startAttempt(orgId, studentId, assignmentId);

    attempt2Id = runtime2.attempt.id;
    expect(runtime2.attempt.attemptNumber).toBe(2);
    expect(attempt2Id).not.toBe(attempt1Id);

    // Verify DB state: Attempt 1 is still graded 5.0, and Attempt 2 is a separate row
    const att1InDb = await prisma!.attempt.findFirst({
      where: { id: attempt1Id, organization_id: orgId },
    });
    expect(att1InDb?.status).toBe(AttemptStatus.graded);
    expect(Number(att1InDb?.score)).toBe(5.0);

    const att2InDb = await prisma!.attempt.findFirst({
      where: { id: attempt2Id, organization_id: orgId },
    });
    expect(att2InDb?.attempt_number).toBe(2);
    expect(att2InDb?.previous_attempt_id).toBe(attempt1Id);
    expect(att2InDb?.status).toBe(AttemptStatus.in_progress);

    // Attempting to start a 3rd attempt while attempt 2 is in_progress must fail with 409
    await expect(
      attemptsService.startAttempt(orgId, studentId, assignmentId),
    ).rejects.toThrow(ConflictException);
  });

  // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10 y SPEC-06 RF-8
  it('Paso 9: RF-8 — Intento completado en < min_plausible_seconds recibe flag implausible_duration conservando puntaje en PostgreSQL', async () => {
    if (!isPostgresAvailable) return;

    // started_at set to 4 seconds ago (< 15s min_plausible_seconds)
    await prisma!.attempt.update({
      where: { id: attempt2Id },
      data: {
        started_at: new Date(Date.now() - 4000),
      },
    });

    const token2 = (await attemptsService.getAttempt(orgId, studentId, attempt2Id)).attemptToken!;

    await attemptsService.submitEvents(orgId, studentId, attempt2Id, token2, {
      events: [
        {
          clientEventId: 'evt-match-002',
          itemId: 'pairs',
          answer: {
            [leftAppleId]: rightManzanaId,
            [leftDogId]: rightPerroId,
          },
        },
      ],
    });

    const completion2 = await attemptsService.completeAttempt(orgId, studentId, attempt2Id, token2, {});

    expect(completion2.attempt.score).toBe(5.0);
    // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10 y SPEC-06 RF-8
    expect(completion2.attempt.flags).toContain('implausible_duration');

    // Verify flag in PostgreSQL
    const att2InDb = await prisma!.attempt.findFirst({
      where: { id: attempt2Id, organization_id: orgId },
    });
    expect(att2InDb?.status).toBe(AttemptStatus.graded);
    expect(Number(att2InDb?.score)).toBe(5.0);
    // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10 y SPEC-06 RF-8
    expect(att2InDb?.flags).toContain('implausible_duration');
  });

  it('Paso 10: RF-11 — Consultar asignaciones tras completar partidas devuelve canStart = true y estado histórico correcto', async () => {
    if (!isPostgresAvailable) return;

    const continuityList = await attemptsService.listStudentAssignments(orgId, studentId, {
      scope: 'continuity',
    });

    expect(continuityList.items.length).toBe(1);
    const card = continuityList.items[0]!;
    expect(card.id).toBe(assignmentId);
    expect(card.canStart).toBe(true); // Open window allows playing again
    expect(card.latestAttempt?.attemptNumber).toBe(2);
    expect(card.latestAttempt?.score).toBe(5.0);
  });
});
