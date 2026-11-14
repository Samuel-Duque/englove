import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ActivityType,
  AgeSegment,
  AttemptStatus,
  GameMechanic,
  Level,
  Role,
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
import { TenantContext } from '../src/common/tenant/tenant.context';
import { isPostgresAvailable } from './postgres-test-helper';

describe.skipIf(!isPostgresAvailable)(
  'RT-01, RT-02 & RT-03: Regresiones de intentos y progreso en PostgreSQL real',
  () => {
    let prisma: PrismaService;
    let attemptsService: AttemptsService;
    let activitiesService: ActivitiesService;
    let assignmentsService: AssignmentsService;

    const orgId = '88880001-1111-4111-8111-111111111111';
    const teacherId = '88880001-2222-4222-8222-222222222222';
    const studentUserId = '88880001-3333-4333-8333-333333333333';
    const studentId = '88880001-4444-4444-8444-444444444444';
    const groupId = '88880001-5555-4555-8555-555555555555';

    async function cleanup(client: PrismaService): Promise<void> {
      await TenantContext.runBypass(async () => {
        await client.progressEvent.deleteMany({ where: { organization_id: orgId } });
        await client.attempt.deleteMany({ where: { organization_id: orgId } });
        await client.assignment.deleteMany({ where: { organization_id: orgId } });
        await client.fillBlankDetail.deleteMany({ where: { organization_id: orgId } });
        await client.gameDetail.deleteMany({ where: { organization_id: orgId } });
        await client.activity.deleteMany({ where: { organization_id: orgId } });
        await client.groupMembership.deleteMany({ where: { organization_id: orgId } });
        await client.group.deleteMany({ where: { organization_id: orgId } });
        await client.student.deleteMany({ where: { organization_id: orgId } });
        await client.user.deleteMany({ where: { organization_id: orgId } });
        await client.featureFlag.deleteMany({ where: { organization_id: orgId } });
        await client.organization.deleteMany({ where: { id: orgId } });
      });
    }

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.$connect();

      const secret = 'rt01-rt02-rt03-postgres-test-jwt-secret-min-32!';
      const configService = new ConfigService({ JWT_SECRET: secret });
      const jwtService = new JwtService({ secret });
      attemptsService = new AttemptsService(
        prisma,
        configService,
        jwtService,
        new ScoringService(),
        new GamificationService(prisma),
        new MediaService(prisma, configService),
        new FeatureFlagsService(prisma),
      );
      activitiesService = new ActivitiesService(prisma);
      assignmentsService = new AssignmentsService(prisma);

      await cleanup(prisma);

      await TenantContext.runBypass(async () => {
        await prisma.organization.create({
          data: {
            id: orgId,
            name: 'RT Attempts Org',
            slug: 'rt-attempts-org',
          },
        });
        await prisma.featureFlag.createMany({
          data: [
            {
              organization_id: orgId,
              key: 'games',
              enabled: true,
              config: {
                passing_score: 3,
                retention_days: 30,
                pending_upload_ttl_days: 7,
                ungraded_reminder_days: 3,
              },
            },
            {
              organization_id: orgId,
              key: 'extra_content',
              enabled: true,
              config: {},
            },
          ],
        });
        await prisma.user.create({
          data: {
            id: teacherId,
            organization_id: orgId,
            email: 'rt-teacher@test.com',
            name: 'Teacher RT',
            password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
            role: Role.teacher,
          },
        });
        await prisma.user.create({
          data: {
            id: studentUserId,
            organization_id: orgId,
            email: 'rt-student@test.com',
            name: 'Student RT',
            password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
            role: Role.student,
          },
        });
        await prisma.student.create({
          data: {
            id: studentId,
            organization_id: orgId,
            user_id: studentUserId,
            birth_date: new Date('2015-05-05'),
            age_segment: AgeSegment.kids,
            approval_status: 'approved',
            can_switch_interface: false,
          },
        });
        await prisma.group.create({
          data: {
            id: groupId,
            organization_id: orgId,
            name: 'Grupo RT',
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
      });
    });

    afterAll(async () => {
      await cleanup(prisma);
      await prisma.$disconnect();
    });

    it('RT-01: deduplicación duradera conserva >500 clientEventIds y el replay de E0 no revierte LATEST', async () => {
      const parsed = parseFillBlankSimpleSyntax('The dog runs [fast|slow].');
      const itemId = '88880001-aaaa-4aaa-8aaa-000000000001';
      const blankKey = parsed.blanks[0]?.id ?? Object.keys(parsed.answerKey)[0] ?? 'b1';

      const created = await TenantContext.run(
        { organizationId: orgId, userId: teacherId, role: Role.teacher },
        async () => {
          const activity = await activitiesService.createActivity(orgId, teacherId, {
            title: 'RT-01 Dedupe >500',
            type: ActivityType.fill_blank,
            level: Level.A1,
            config: {
              items: [{ id: itemId, prompt: parsed.prompt, blanks: parsed.blanks }],
            },
            answerKey: {
              items: { [itemId]: parsed.answerKey },
            },
          });
          await activitiesService.publishActivity(orgId, activity.id);

          const assigned = await assignmentsService.createAssignments(orgId, {
            activityId: activity.id,
            groupIds: [groupId],
            opensAt: new Date(Date.now() - 60_000).toISOString(),
            dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          });
          return { assignment: assigned.items[0]! };
        },
      );

      await TenantContext.run(
        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
        async () => {
          const started = await attemptsService.startAttempt(orgId, studentId, created.assignment.id);
          const attemptId = started.attempt.id;
          const token = started.attemptToken ?? '';

          const eventE0 = '88880001-0000-4000-8000-000000000000';
          await attemptsService.submitEvents(orgId, studentId, attemptId, token, {
            events: [{ itemId, answer: { [blankKey]: 'OLD' }, clientEventId: eventE0 }],
          });

          // Enviar 550 eventos nuevos para superar ampliamente la antigua ventana FIFO de 500
          for (let batch = 0; batch < 11; batch++) {
            const events = Array.from({ length: 50 }, (_, idx) => {
              const seq = batch * 50 + idx + 1;
              return {
                itemId,
                answer: { [blankKey]: seq === 550 ? 'LATEST' : `MID_${seq}` },
                clientEventId: `88880001-0000-4000-8000-${String(seq).padStart(12, '0')}`,
              };
            });
            await attemptsService.submitEvents(orgId, studentId, attemptId, token, { events });
          }

          // Reenviar exactamente E0 (replay tardío)
          const replayRes = await attemptsService.submitEvents(orgId, studentId, attemptId, token, {
            events: [{ itemId, answer: { [blankKey]: 'OLD' }, clientEventId: eventE0 }],
          });
          expect(replayRes.acceptedEventIds).toContain(eventE0);

          const persisted = await prisma.attempt.findFirst({
            where: { id: attemptId, organization_id: orgId },
          });
          const payload = persisted?.payload as {
            answers?: Record<string, Record<string, unknown>>;
            processedEventIds?: string[];
          };
          expect(payload?.answers?.[itemId]?.[blankKey]).toBe('LATEST');
          expect(payload?.processedEventIds?.length).toBeGreaterThanOrEqual(551);
          expect(payload?.processedEventIds).toContain(eventE0);
        },
      );
    }, 30000);

    it('RT-02: juego autónomo expirado (>24h) rechaza completeAttempt con 409 ATTEMPT_CLOSED mientras que uno ya graded sigue siendo idempotente', async () => {
      const l1 = '88880001-bbbb-4bbb-8bbb-000000000001';
      const l2 = '88880001-bbbb-4bbb-8bbb-000000000002';
      const r1 = '88880001-bbbb-4bbb-8bbb-000000000003';
      const r2 = '88880001-bbbb-4bbb-8bbb-000000000004';
      const gameActivity = await TenantContext.run(
        { organizationId: orgId, userId: teacherId, role: Role.teacher },
        async () => {
          const activity = await activitiesService.createActivity(orgId, teacherId, {
            title: 'RT-02 Autonomous Game',
            type: ActivityType.game,
            level: Level.A1,
            config: {
              mechanic: GameMechanic.match,
              settings: {
                left: [
                  { id: l1, text: 'hello' },
                  { id: l2, text: 'bye' },
                ],
                right: [
                  { id: r1, text: 'hola' },
                  { id: r2, text: 'adios' },
                ],
              },
            },
            answerKey: {
              solution: {
                pairs: { [l1]: r1, [l2]: r2 },
              },
            },
          });
          await activitiesService.publishActivity(orgId, activity.id);
          return activity;
        },
      );

      await TenantContext.run(
        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
        async () => {
          const started = await attemptsService.startGameAttempt(orgId, studentId, gameActivity.id);
          const expiredAttemptId = started.attempt.id;
          const expiredToken = started.attemptToken ?? '';

          // Simular intento abierto hace 48 horas (superó ventana de 24h)
          await prisma.attempt.update({
            where: { id: expiredAttemptId, organization_id: orgId },
            data: { started_at: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          });

          const err = await attemptsService
            .completeAttempt(orgId, studentId, expiredAttemptId, expiredToken, {
              answers: { pairs: { [l1]: r1, [l2]: r2 } },
            })
            .catch((e: unknown) => e);

          expect(err).toBeInstanceOf(ConflictException);
          if (!(err instanceof ConflictException)) {
            throw new Error('Expected ConflictException');
          }
          expect(err.getResponse()).toEqual(
            expect.objectContaining({ code: 'ATTEMPT_CLOSED' }),
          );

          const dbExpired = await prisma.attempt.findFirst({
            where: { id: expiredAttemptId, organization_id: orgId },
          });
          expect(dbExpired?.status).toBe(AttemptStatus.abandoned);
          expect(dbExpired?.flags).toContain('offline_sync');

          // Control: un juego autónomo completado dentro de ventana sigue devolviendo recibo idempotente aunque luego pasen >24h
          const validStarted = await attemptsService.startGameAttempt(
            orgId,
            studentId,
            gameActivity.id,
          );
          const validId = validStarted.attempt.id;
          const validTok = validStarted.attemptToken ?? '';

          const firstDone = await attemptsService.completeAttempt(orgId, studentId, validId, validTok, {
            answers: { pairs: { [l1]: r1, [l2]: r2 } },
          });
          expect(firstDone.attempt.status).toBe(AttemptStatus.graded);

          await prisma.attempt.update({
            where: { id: validId, organization_id: orgId },
            data: { started_at: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          });

          const idempotentDone = await attemptsService.completeAttempt(
            orgId,
            studentId,
            validId,
            validTok,
            {},
          );
          expect(idempotentDone.attempt.id).toBe(validId);
          expect(idempotentDone.attempt.status).toBe(AttemptStatus.graded);
        },
      );
    });

    it('RT-03: un fallo al persistir progress_events revierte el Attempt en la misma transacción y el reintento persiste ambos atómicamente', async () => {
      const parsed = parseFillBlankSimpleSyntax('Birds [fly|swim] high.');
      const itemId = '88880001-cccc-4ccc-8ccc-000000000001';
      const blankKey = parsed.blanks[0]?.id ?? Object.keys(parsed.answerKey)[0] ?? 'b1';

      const created = await TenantContext.run(
        { organizationId: orgId, userId: teacherId, role: Role.teacher },
        async () => {
          const activity = await activitiesService.createActivity(orgId, teacherId, {
            title: 'RT-03 Atomic Progress',
            type: ActivityType.fill_blank,
            level: Level.A1,
            config: {
              items: [{ id: itemId, prompt: parsed.prompt, blanks: parsed.blanks }],
            },
            answerKey: {
              items: { [itemId]: parsed.answerKey },
            },
          });
          await activitiesService.publishActivity(orgId, activity.id);

          const assigned = await assignmentsService.createAssignments(orgId, {
            activityId: activity.id,
            groupIds: [groupId],
            opensAt: new Date(Date.now() - 60_000).toISOString(),
            dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          });
          return { assignment: assigned.items[0]! };
        },
      );

      await TenantContext.run(
        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
        async () => {
          const started = await attemptsService.startAttempt(orgId, studentId, created.assignment.id);
          const attemptId = started.attempt.id;
          const token = started.attemptToken ?? '';

          try {
            await prisma.$executeRaw`
              CREATE OR REPLACE FUNCTION rt03_fail_progress_event_insert() RETURNS trigger AS $$
              BEGIN
                IF NEW.organization_id = '88880001-1111-4111-8111-111111111111'::uuid THEN
                  RAISE EXCEPTION 'Simulated transient failure on progress_events for RT-03';
                END IF;
                RETURN NEW;
              END;
              $$ LANGUAGE plpgsql;
            `;
            await prisma.$executeRaw`
              DROP TRIGGER IF EXISTS trg_rt03_fail_progress_event ON progress_events;
            `;
            await prisma.$executeRaw`
              CREATE TRIGGER trg_rt03_fail_progress_event
              BEFORE INSERT ON progress_events
              FOR EACH ROW
              EXECUTE FUNCTION rt03_fail_progress_event_insert();
            `;

            // 1) Falla durante completeAttempt
            await expect(
              attemptsService.completeAttempt(orgId, studentId, attemptId, token, {
                answers: { [itemId]: { [blankKey]: 'fly' } },
              }),
            ).rejects.toThrow();

            // El intento NO debe haber quedado graded en DB (rollback completo)
            const afterFailure = await prisma.attempt.findFirst({
              where: { id: attemptId, organization_id: orgId },
            });
            expect(afterFailure?.status).toBe(AttemptStatus.in_progress);
            const eventsDuringFailure = await prisma.progressEvent.count({
              where: { attempt_id: attemptId, organization_id: orgId },
            });
            expect(eventsDuringFailure).toBe(0);
          } finally {
            await prisma.$executeRaw`DROP TRIGGER IF EXISTS trg_rt03_fail_progress_event ON progress_events;`;
            await prisma.$executeRaw`DROP FUNCTION IF EXISTS rt03_fail_progress_event_insert();`;
          }

          // 2) Dependencia recuperada: reintento completa attempt y registra progress_event en la misma tx
          const recovered = await attemptsService.completeAttempt(orgId, studentId, attemptId, token, {
            answers: { [itemId]: { [blankKey]: 'fly' } },
          });
          expect(recovered.attempt.status).toBe(AttemptStatus.graded);

          const finalEvents = await prisma.progressEvent.count({
            where: { attempt_id: attemptId, organization_id: orgId },
          });
          expect(finalEvents).toBe(1);
        },
      );
    });
  },
);
