import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MediaAssetStatus } from '@prisma/client';
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
import { MaintenanceService } from '../src/maintenance/maintenance.service';
import { PendingSummaryService } from '../src/dashboard/pending-summary.service';
import { MailService } from '../src/mail/mail.service';
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
    let mediaService: MediaService;
    let gamificationService: GamificationService;
    let featureFlagsService: FeatureFlagsService;
    let configService: ConfigService;

    const orgId = '88880001-1111-4111-8111-111111111111';
    const teacherId = '88880001-2222-4222-8222-222222222222';
    const studentUserId = '88880001-3333-4333-8333-333333333333';
    const studentId = '88880001-4444-4444-8444-444444444444';
    const groupId = '88880001-5555-4555-8555-555555555555';

    async function cleanup(client: PrismaService): Promise<void> {
      await TenantContext.runBypass(async () => {
        await client.mediaAsset.deleteMany({ where: { organization_id: orgId } });
        await client.scheduledJobRun.deleteMany({ where: { organization_id: orgId } });
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
      configService = new ConfigService({
        JWT_SECRET: secret,
        R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || 'local',
        R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || 'minioadmin',
        R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || 'minioadmin',
        R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'englove-dev',
        R2_ENDPOINT: process.env.R2_ENDPOINT || 'http://127.0.0.1:9000',
      });
      const jwtService = new JwtService({ secret });
      gamificationService = new GamificationService(prisma);
      mediaService = new MediaService(prisma, configService, jwtService);
      featureFlagsService = new FeatureFlagsService(prisma);
      attemptsService = new AttemptsService(
        prisma,
        configService,
        jwtService,
        new ScoringService(),
        gamificationService,
        mediaService,
        featureFlagsService,
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

    it('C-04: bloquea y serializa updateActivity frente a startAttempt en PostgreSQL real sin emitir vista V1 obsoleta', async () => {
      const parsed = parseFillBlankSimpleSyntax('She reads [books|magazines].');
      const itemId = '88880001-c040-4000-8000-000000000001';
      const setup = await TenantContext.run(
        { organizationId: orgId, userId: teacherId, role: Role.teacher },
        async () => {
          const act1 = await activitiesService.createActivity(orgId, teacherId, {
            title: 'C-04 V1 Lock Test',
            type: ActivityType.fill_blank,
            level: Level.A1,
            config: { items: [{ id: itemId, prompt: parsed.prompt, blanks: parsed.blanks }] },
            answerKey: { items: { [itemId]: parsed.answerKey } },
          });
          await activitiesService.publishActivity(orgId, act1.id);
          const asg1 = await assignmentsService.createAssignments(orgId, {
            activityId: act1.id,
            groupIds: [groupId],
            opensAt: new Date(Date.now() - 60_000).toISOString(),
            dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          });

          const act2 = await activitiesService.createActivity(orgId, teacherId, {
            title: 'C-04 V1b Concurrent',
            type: ActivityType.fill_blank,
            level: Level.A1,
            config: { items: [{ id: itemId, prompt: parsed.prompt, blanks: parsed.blanks }] },
            answerKey: { items: { [itemId]: parsed.answerKey } },
          });
          await activitiesService.publishActivity(orgId, act2.id);
          const asg2 = await assignmentsService.createAssignments(orgId, {
            activityId: act2.id,
            groupIds: [groupId],
            opensAt: new Date(Date.now() - 60_000).toISOString(),
            dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          });
          return {
            act1Id: act1.id,
            asg1Id: asg1.items[0]!.id,
            act2Id: act2.id,
            asg2Id: asg2.items[0]!.id,
          };
        },
      );

      // 1) Bloqueo determinista: startAttempt espera a FOR UPDATE sobre activities y al commit ve status=archived
      let releaseTx!: () => void;
      const txHoldingLock = TenantContext.run({ organizationId: orgId }, () =>
        prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT id FROM activities
            WHERE id = ${setup.act1Id}::uuid AND organization_id = ${orgId}::uuid
            FOR UPDATE
          `;
          await tx.activity.update({
            where: { id: setup.act1Id, organization_id: orgId },
            data: { status: 'archived' },
          });
          await new Promise<void>((resolve) => {
            releaseTx = resolve;
          });
        }),
      );

      await new Promise((r) => setTimeout(r, 40));
      let startSettled = false;
      const startPromise = TenantContext.run(
        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
        () => attemptsService.startAttempt(orgId, studentId, setup.asg1Id),
      ).finally(() => {
        startSettled = true;
      });

      await new Promise((r) => setTimeout(r, 80));
      expect(startSettled).toBe(false);

      releaseTx();
      await txHoldingLock;
      await expect(startPromise).rejects.toThrow(ConflictException);

      const attemptsForAsg1 = await TenantContext.run({ organizationId: orgId }, () =>
        prisma.attempt.count({ where: { assignment_id: setup.asg1Id, organization_id: orgId } }),
      );
      expect(attemptsForAsg1).toBe(0);

      // 2) Carrera concurrente real Promise.allSettled entre updateActivity y startAttempt
      const [updateRes, raceStartRes] = await Promise.allSettled([
        TenantContext.run({ organizationId: orgId, userId: teacherId, role: Role.teacher }, () =>
          activitiesService.updateActivity(orgId, setup.act2Id, {
            title: 'C-04 V2 New Version',
          }),
        ),
        TenantContext.run(
          { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
          () => attemptsService.startAttempt(orgId, studentId, setup.asg2Id),
        ),
      ]);

      if (updateRes.status === 'rejected') {
        // startAttempt adquirió FOR UPDATE primero -> updateActivity detectó attemptsCount=1 y rechazó 409
        expect(updateRes.reason).toBeInstanceOf(ConflictException);
        expect(raceStartRes.status).toBe('fulfilled');
        if (raceStartRes.status === 'fulfilled') {
          expect(raceStartRes.value.activity.title).toBe('C-04 V1b Concurrent');
        }
      } else {
        // updateActivity adquirió FOR UPDATE primero -> startAttempt re-leyó la actividad actualizada dentro del bloqueo
        expect(raceStartRes.status).toBe('fulfilled');
        if (raceStartRes.status === 'fulfilled') {
          expect(raceStartRes.value.activity.title).toBe('C-04 V2 New Version');
        }
      }
    });

    it('C-05: MaintenanceService no sobrescribe un Attempt que transicionó concurrentemente a graded', async () => {
      const parsed = parseFillBlankSimpleSyntax('Birds [sing|chirp].');
      const itemId = '88880001-c050-4000-8000-000000000001';
      const blankKey = parsed.blanks[0]?.id ?? Object.keys(parsed.answerKey)[0] ?? 'b1';

      const created = await TenantContext.run(
        { organizationId: orgId, userId: teacherId, role: Role.teacher },
        async () => {
          const activity = await activitiesService.createActivity(orgId, teacherId, {
            title: 'C-05 Maintenance Race',
            type: ActivityType.fill_blank,
            level: Level.A1,
            config: { items: [{ id: itemId, prompt: parsed.prompt, blanks: parsed.blanks }] },
            answerKey: { items: { [itemId]: parsed.answerKey } },
          });
          await activitiesService.publishActivity(orgId, activity.id);
          const asg = await assignmentsService.createAssignments(orgId, {
            activityId: activity.id,
            groupIds: [groupId],
            opensAt: new Date(Date.now() - 120_000).toISOString(),
            dueAt: new Date(Date.now() + 120_000).toISOString(),
          });
          return { assignmentId: asg.items[0]!.id };
        },
      );

      const started = await TenantContext.run(
        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
        () => attemptsService.startAttempt(orgId, studentId, created.assignmentId),
      );
      const attemptId = started.attempt.id;
      const token = started.attemptToken ?? '';

      // Simulamos que el cierre + 24h expiró justo cuando MaintenanceService escanea attempts in_progress
      const expiredDueAt = new Date(Date.now() - 30 * 3600 * 1000);
      await TenantContext.run({ organizationId: orgId }, () =>
        prisma.assignment.update({
          where: { id: created.assignmentId, organization_id: orgId },
          data: { due_at: expiredDueAt },
        }),
      );

      let interleavedDone = false;
      const pendingSummaryService = new PendingSummaryService(prisma, featureFlagsService);
      const mailService = new MailService(configService);
      const scopedPrisma = new Proxy(prisma, {
        get(target, prop) {
          if (prop === 'organization') {
            return {
              findMany: () => target.organization.findMany({ where: { id: orgId } }),
            };
          }
          if (prop === 'attempt') {
            return new Proxy(target.attempt, {
              get(attTarget, attProp) {
                if (attProp === 'findMany') {
                  return async (args: Parameters<typeof target.attempt.findMany>[0]) => {
                    const rows = await target.attempt.findMany(args);
                    if (!interleavedDone) {
                      interleavedDone = true;
                      // Antes de ejecutar updateMany en MaintenanceService, completeAttempt entrega y califica el intento
                      await TenantContext.run({ organizationId: orgId }, () =>
                        target.assignment.update({
                          where: { id: created.assignmentId, organization_id: orgId },
                          data: { due_at: new Date(Date.now() + 120_000) },
                        }),
                      );
                      await TenantContext.run(
                        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
                        () =>
                          attemptsService.completeAttempt(orgId, studentId, attemptId, token, {
                            answers: { [itemId]: { [blankKey]: 'sing' } },
                          }),
                      );
                    }
                    return rows;
                  };
                }
                return Reflect.get(attTarget, attProp, attTarget);
              },
            });
          }
          return Reflect.get(target, prop, target);
        },
      });

      const maintenance = new MaintenanceService(
        scopedPrisma,
        gamificationService,
        mediaService,
        featureFlagsService,
        pendingSummaryService,
        mailService,
      );

      await maintenance.runIdentityMaintenance(`2099-${randomUUID().slice(0, 6)}`);
      expect(interleavedDone).toBe(true);

      const finalAttempt = await TenantContext.run({ organizationId: orgId }, () =>
        prisma.attempt.findFirst({ where: { id: attemptId, organization_id: orgId } }),
      );
      expect(finalAttempt?.status).toBe(AttemptStatus.graded);
    });

    it('C-02, C-03 & C-06: MinIO + ffprobe + ffmpeg promueven _confirmed_<hash>, rechazan vídeo MP4 y bloquean pending_delete en PostgreSQL', async () => {
      const parsed = parseFillBlankSimpleSyntax('Say [hello|goodbye].');
      const itemId = '88880001-c020-4000-8000-000000000001';
      const created = await TenantContext.run(
        { organizationId: orgId, userId: teacherId, role: Role.teacher },
        async () => {
          const activity = await activitiesService.createActivity(orgId, teacherId, {
            title: 'C-02/C-03/C-06 Media E2E',
            type: ActivityType.fill_blank,
            level: Level.A1,
            config: { items: [{ id: itemId, prompt: parsed.prompt, blanks: parsed.blanks }] },
            answerKey: { items: { [itemId]: parsed.answerKey } },
          });
          await activitiesService.publishActivity(orgId, activity.id);
          const asg = await assignmentsService.createAssignments(orgId, {
            activityId: activity.id,
            groupIds: [groupId],
            opensAt: new Date(Date.now() - 60_000).toISOString(),
            dueAt: new Date(Date.now() + 86_400_000).toISOString(),
          });
          return { assignmentId: asg.items[0]!.id };
        },
      );

      const started = await TenantContext.run(
        { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
        () => attemptsService.startAttempt(orgId, studentId, created.assignmentId),
      );
      const attemptId = started.attempt.id;

      const s3Endpoint = process.env.R2_ENDPOINT || 'http://127.0.0.1:9000';
      const s3Bucket = process.env.R2_BUCKET_NAME || 'englove-dev';
      const s3Client = new S3Client({
        endpoint: s3Endpoint,
        region: 'auto',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || 'minioadmin',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'minioadmin',
        },
        forcePathStyle: true,
      });

      const keysToDelete: string[] = [];
      try {
        // C-03: MP4 con stream de vídeo subido a MinIO real debe ser rechazado y marcado pending_delete
        const videoMp4 = spawnSync(
          'ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            'lavfi',
            '-i',
            'testsrc=duration=3:size=64x64:rate=10',
            '-f',
            'lavfi',
            '-i',
            'sine=frequency=440:duration=3',
            '-c:v',
            'mpeg4',
            '-c:a',
            'aac',
            '-movflags',
            'frag_keyframe+empty_moov',
            '-f',
            'mp4',
            'pipe:1',
          ],
          { maxBuffer: 5_000_000 },
        );
        expect(videoMp4.status).toBe(0);

        const badMediaId = randomUUID();
        const badKey = `${orgId}/${studentId}/${attemptId}/${badMediaId}.mp4`;
        keysToDelete.push(badKey);

        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: badKey,
            Body: videoMp4.stdout,
            ContentType: 'audio/mp4',
          }),
        );

        await TenantContext.run({ organizationId: orgId }, () =>
          prisma.mediaAsset.create({
            data: {
              id: badMediaId,
              organization_id: orgId,
              student_id: studentId,
              attempt_id: attemptId,
              key: badKey,
              mime_type: 'audio/mp4',
              size_bytes: BigInt(videoMp4.stdout.length),
              status: MediaAssetStatus.pending_upload,
            },
          }),
        );

        await TenantContext.run(
          { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
          async () => {
            await expect(
              mediaService.confirmUpload(orgId, studentId, attemptId, badMediaId, 60),
            ).rejects.toThrow(UnprocessableEntityException);
          },
        );

        const badRow = await TenantContext.run({ organizationId: orgId }, () =>
          prisma.mediaAsset.findFirst({ where: { id: badMediaId, organization_id: orgId } }),
        );
        expect(badRow?.status).toBe(MediaAssetStatus.pending_delete);

        // C-06: asset en pending_delete rechaza getPlaybackUrl y getDownloadUrl con 404
        await TenantContext.run({ organizationId: orgId }, async () => {
          await expect(mediaService.getPlaybackUrl(orgId, badMediaId)).rejects.toThrow(NotFoundException);
          await expect(mediaService.getDownloadUrl(orgId, badMediaId)).rejects.toThrow(NotFoundException);
        });

        // C-02: WebM válido se promueve a _confirmed_<hash16>.webm, transcodifica _converted.mp4 y resiste overwrite tardío
        const audioWebm = spawnSync(
          'ffmpeg',
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            'lavfi',
            '-i',
            'sine=frequency=440:duration=3',
            '-c:a',
            'libopus',
            '-f',
            'webm',
            'pipe:1',
          ],
          { maxBuffer: 2_000_000 },
        );
        expect(audioWebm.status).toBe(0);

        const expectedPrefix = createHash('sha256').update(audioWebm.stdout).digest('hex').slice(0, 16);
        const goodMediaId = randomUUID();
        const stagingKey = `${orgId}/${studentId}/${attemptId}/${goodMediaId}.webm`;
        const expectedConfirmedKey = `${orgId}/${studentId}/${attemptId}/${goodMediaId}_confirmed_${expectedPrefix}.webm`;
        const expectedConvertedKey = `${orgId}/${studentId}/${attemptId}/${goodMediaId}_converted.mp4`;
        keysToDelete.push(stagingKey, expectedConfirmedKey, expectedConvertedKey);

        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: stagingKey,
            Body: audioWebm.stdout,
            ContentType: 'audio/webm',
          }),
        );

        await TenantContext.run({ organizationId: orgId }, () =>
          prisma.mediaAsset.create({
            data: {
              id: goodMediaId,
              organization_id: orgId,
              student_id: studentId,
              attempt_id: attemptId,
              key: stagingKey,
              mime_type: 'audio/webm',
              size_bytes: BigInt(audioWebm.stdout.length),
              status: MediaAssetStatus.pending_upload,
            },
          }),
        );

        const confirmed = await TenantContext.run(
          { organizationId: orgId, userId: studentUserId, role: Role.student, studentId },
          () => mediaService.confirmUpload(orgId, studentId, attemptId, goodMediaId, 60),
        );
        expect(confirmed.status).toBe(MediaAssetStatus.ready);
        expect(confirmed.key).toBe(expectedConfirmedKey);

        const confirmedHead = await s3Client.send(
          new HeadObjectCommand({ Bucket: s3Bucket, Key: expectedConfirmedKey }),
        );
        expect(confirmedHead.ContentLength).toBe(audioWebm.stdout.length);

        // Overwrite tardío sobre la clave de staging ya no afecta al objeto confirmado ni a la transcodificación
        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: stagingKey,
            Body: Buffer.from('corrupted-late-overwrite'),
            ContentType: 'audio/webm',
          }),
        );

        let convertedKeyFound: string | null = null;
        for (let i = 0; i < 40; i++) {
          const row = await TenantContext.run({ organizationId: orgId }, () =>
            prisma.mediaAsset.findFirst({ where: { id: goodMediaId, organization_id: orgId } }),
          );
          if (row?.converted_key) {
            convertedKeyFound = row.converted_key;
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        expect(convertedKeyFound).toBe(expectedConvertedKey);

        const convertedHead = await s3Client.send(
          new HeadObjectCommand({ Bucket: s3Bucket, Key: expectedConvertedKey }),
        );
        expect(convertedHead.ContentLength ?? 0).toBeGreaterThan(0);

        const playback = await TenantContext.run({ organizationId: orgId }, () =>
          mediaService.getPlaybackUrl(orgId, goodMediaId),
        );
        expect(playback.url).toContain(`${goodMediaId}_converted.mp4`);
      } finally {
        for (const key of keysToDelete) {
          await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key })).catch(() => {});
        }
      }
    }, 30000);
  },
);
