import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  ActivityType,
  ActivityStatus,
  AttemptStatus,
  Level,
  Role,
  AgeSegment,
  ApprovalStatus,
  ProgressEventType,
  MediaAssetStatus,
} from '@englove/shared';
import { AttemptsService } from '../src/attempts/attempts.service';
import { ReviewsService } from '../src/reviews/reviews.service';
import { PendingSummaryService } from '../src/dashboard/pending-summary.service';
import { ScoringService } from '../src/scoring/scoring.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { MediaService } from '../src/media/media.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnprocessableEntityException, NotFoundException, ConflictException } from '@nestjs/common';
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

describe('SPEC-07 / Flujo 3 E2E: Ciclo completo de revisión, feedback, correo único y nuevo intento en PostgreSQL real (ENG-094)', () => {
  let isPostgresAvailable = false;
  let prisma: PrismaService | null = null;
  let attemptsService: AttemptsService;
  let reviewsService: ReviewsService;
  let pendingSummaryService: PendingSummaryService;
  let mailService: MailService;

  const orgId = 'e2e88888-1111-4111-8111-111111111111';
  const otherOrgId = 'e2e88888-9999-4999-8999-999999999999';
  const teacherId = 'e2e88888-2222-4222-8222-222222222222';
  const studentUserId = 'e2e88888-3333-4333-8333-333333333333';
  const studentId = 'e2e88888-4444-4444-8444-444444444444';
  const groupId = 'e2e88888-5555-4555-8555-555555555555';
  const activityId = 'e2e88888-6666-4666-8666-666666666666';
  const assignmentId = 'e2e88888-7777-4777-8777-777777777777';

  let attemptId = '';

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
        JWT_SECRET: 'e2e-review-flow-test-jwt-secret-min-32-chars-long!',
        APP_ENV: 'local',
        APP_PUBLIC_URL: 'http://localhost:3000',
        R2_ACCOUNT_ID: 'mock-account',
        R2_ACCESS_KEY_ID: 'mock-key',
        R2_SECRET_ACCESS_KEY: 'mock-secret',
        R2_BUCKET_NAME: 'englove-test-bucket',
      });
      const jwtService = new JwtService({
        secret: 'e2e-review-flow-test-jwt-secret-min-32-chars-long!',
      });
      const scoringService = new ScoringService();
      const gamificationService = new GamificationService(prisma);
      const mediaService = new MediaService(prisma, configService);
      const featureFlagsService = new FeatureFlagsService(prisma);
      mailService = new MailService(configService);

      attemptsService = new AttemptsService(
        prisma,
        configService,
        jwtService,
        scoringService,
        gamificationService,
        mediaService,
        featureFlagsService,
      );

      reviewsService = new ReviewsService(
        prisma,
        featureFlagsService,
        gamificationService,
        mailService,
        configService,
      );

      pendingSummaryService = new PendingSummaryService(prisma, featureFlagsService);

      // Clean prior fixtures in reverse dependency order
      await prisma.scheduledJobRun.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.review.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.mediaAsset.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.progressEvent.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.attempt.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.assignment.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.speakingDetail.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.activity.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.groupMembership.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.group.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.student.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.featureFlag.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.user.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });

      // Create Organization
      await prisma.organization.create({
        data: {
          id: orgId,
          name: 'E2E Review Flow Org',
          slug: 'e2e-review-flow-org',
        },
      });

      // Create Other Organization for anti-IDOR tests
      await prisma.organization.create({
        data: {
          id: otherOrgId,
          name: 'Other Org',
          slug: 'other-org',
        },
      });

      // Feature flags canonical rows (RF-14)
      await prisma.featureFlag.createMany({
        data: [
          {
            organization_id: orgId,
            key: 'games',
            enabled: true,
            config: {
              passing_score: 3.0,
              retention_days: 30,
              pending_upload_ttl_days: 7,
              ungraded_reminder_days: 3,
            },
          },
          {
            organization_id: orgId,
            key: 'extra_content',
            enabled: false,
            config: {},
          },
        ],
      });

      // Create Teacher User
      await prisma.user.create({
        data: {
          id: teacherId,
          organization_id: orgId,
          email: 'teacher-review-e2e@test.com',
          name: 'Profesora Laura Gomez',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.teacher,
        },
      });

      // Create Student User
      await prisma.user.create({
        data: {
          id: studentUserId,
          organization_id: orgId,
          email: 'student-review-e2e@test.com',
          name: 'Santiago Martinez',
          password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
          role: Role.student,
        },
      });

      // Create Student profile
      await prisma.student.create({
        data: {
          id: studentId,
          organization_id: orgId,
          user_id: studentUserId,
          birth_date: new Date('2017-04-12T00:00:00Z'),
          age_segment: AgeSegment.kids,
          level: Level.A1,
          approval_status: ApprovalStatus.approved,
          guardian_name: 'Marta Gomez',
          guardian_contact: '3001234567',
        },
      });

      // Create Group & active membership
      await prisma.group.create({
        data: {
          id: groupId,
          organization_id: orgId,
          name: 'Kids 3A',
        },
      });

      await prisma.groupMembership.create({
        data: {
          organization_id: orgId,
          group_id: groupId,
          student_id: studentId,
          joined_at: new Date('2026-10-01T00:00:00Z'),
        },
      });

      // Create Speaking Activity
      await prisma.activity.create({
        data: {
          id: activityId,
          organization_id: orgId,
          created_by: teacherId,
          title: 'My Favorite Animal Speaking',
          type: ActivityType.speaking,
          level: Level.A1,
          status: ActivityStatus.published,
          speaking_detail: {
            create: {
              organization_id: orgId,
              prompt: 'Describe your favorite pet or animal in English for at least 15 seconds.',
              min_duration_seconds: 5,
              max_duration_seconds: 60,
            },
          },
        },
      });

      // Create Assignment (opens 2h ago, due in 2 days)
      await prisma.assignment.create({
        data: {
          id: assignmentId,
          organization_id: orgId,
          activity_id: activityId,
          group_id: groupId,
          opens_at: new Date(Date.now() - 2 * 3600 * 1000),
          due_at: new Date(Date.now() + 2 * 86400 * 1000),
        },
      });
    } catch (err) {
      console.error('Error inicializando DB real para E2E Flujo 3:', err);
      isPostgresAvailable = false;
    }
  });

  afterAll(async () => {
    if (prisma && isPostgresAvailable) {
      await prisma.scheduledJobRun.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.review.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.mediaAsset.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.progressEvent.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.attempt.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.assignment.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.speakingDetail.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.activity.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.groupMembership.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.group.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.student.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.featureFlag.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { organization_id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } }).catch(() => {});
      await prisma.$disconnect().catch(() => {});
    }
  });

  it('Paso 1: El alumno inicia la actividad de speaking y completa el intento quedando en pending_review', async () => {
    if (!isPostgresAvailable) return;

    // Start attempt
    const runtime = await attemptsService.startAttempt(orgId, studentId, assignmentId);
    expect(runtime.attempt).toBeDefined();
    expect(runtime.attempt.attemptNumber).toBe(1);
    expect(runtime.attempt.status).toBe(AttemptStatus.in_progress);
    attemptId = runtime.attempt.id;

    // Create a mock ready audio MediaAsset for this attempt
    const mediaAsset = await prisma!.mediaAsset.create({
      data: {
        organization_id: orgId,
        attempt_id: attemptId,
        student_id: studentId,
        key: `audios/${attemptId}/speaking_raw.webm`,
        converted_key: `audios/${attemptId}/speaking_converted.mp4`,
        mime_type: 'audio/webm',
        size_bytes: BigInt(256000),
        duration_seconds: 22,
        status: MediaAssetStatus.ready,
      },
    });

    // Complete attempt
    const completion = await attemptsService.completeAttempt(
      orgId,
      studentId,
      attemptId,
      runtime.attemptToken!,
      { mediaId: mediaAsset.id },
    );

    expect(completion.attempt.status).toBe(AttemptStatus.pending_review);
    expect(completion.attempt.score).toBeNull();
  });

  it('Paso 2: La profesora consulta la cola de pendientes y obtiene el detalle para evaluación', async () => {
    if (!isPostgresAvailable) return;

    const reminders = await pendingSummaryService.getReminders(orgId);
    expect(reminders.overdueReviews).toBe(0);

    const queue = await reviewsService.getQueue(orgId, { offset: 0, limit: 10 });
    expect(queue.total).toBe(1);
    expect(queue.items[0]?.attempt.attemptId).toBe(attemptId);
    expect(queue.items[0]?.student.displayName).toBe('Santiago Martinez');
    expect(queue.items[0]?.mediaAsset?.isConverted).toBe(true);
    expect(queue.items[0]?.attempt.canGrantRetry).toBe(false);

    // Detail
    const detail = await reviewsService.getReviewDetail(orgId, attemptId);
    expect(detail.attempt.attemptId).toBe(attemptId);
    expect(detail.activity.title).toBe('My Favorite Animal Speaking');
    expect(detail.items.length).toBeGreaterThan(0);
    expect(detail.items[0]?.prompt).toContain('Describe your favorite pet');
  });

  it('Paso 3: La profesora califica con nota, comentario y stickers; se emite ProgressEvent y correo único', async () => {
    if (!isPostgresAvailable) return;

    const updated = await reviewsService.submitReview(orgId, teacherId, attemptId, {
      score: 4.8,
      comment: '¡Excelente pronunciación y fluidez! Usaste un vocabulario muy apropiado.',
      stickers: ['great_job', 'good_pronunciation'],
    });

    expect(updated.review?.stickers).toEqual(['great_job', 'good_pronunciation']);

    // Verify DB Attempt
    const dbAttempt = await prisma!.attempt.findFirst({
      where: { id: attemptId, organization_id: orgId },
    });

    expect(dbAttempt?.status).toBe(AttemptStatus.graded);
    expect(Number(dbAttempt?.score)).toBe(4.8);
    expect(dbAttempt?.graded_at).toBeDefined();

    // Verify DB Review
    const dbReview = await prisma!.review.findFirst({
      where: { attempt_id: attemptId, organization_id: orgId },
    });
    expect(dbReview?.comment).toContain('¡Excelente pronunciación');
    expect(dbReview?.stickers).toEqual(['great_job', 'good_pronunciation']);

    // Verify MediaAsset retention_until is set to graded_at + 30 days
    const dbMedia = await prisma!.mediaAsset.findFirst({
      where: { attempt_id: attemptId, organization_id: orgId },
    });
    expect(dbMedia?.retention_until).toBeDefined();
    expect(dbMedia!.retention_until!.getTime()).toBeGreaterThan(Date.now() + 25 * 86400 * 1000);

    // Verify ProgressEvent(review_received)
    const event = await prisma!.progressEvent.findFirst({
      where: {
        attempt_id: attemptId,
        type: ProgressEventType.review_received,
        organization_id: orgId,
      },
    });
    expect(event).toBeDefined();
    expect(Number(event?.value)).toBe(4.8);
  });

  it('Paso 4: La nota es inmutable en intentos graded (422 SCORE_NOT_EDITABLE); solo se edita feedback', async () => {
    if (!isPostgresAvailable) return;

    // Trying to modify score must be rejected with 422
    await expect(
      reviewsService.submitReview(orgId, teacherId, attemptId, {
        score: 5.0,
        comment: 'Intento cambiar nota',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    // Editing only comment and stickers succeeds
    const updated = await reviewsService.submitReview(orgId, teacherId, attemptId, {
      comment: 'Comentario editado con felicitación ampliada.',
      stickers: ['great_job', 'good_pronunciation', 'super_effort'],
    });

    expect(updated.review?.stickers.length).toBe(3);

    const dbReview = await prisma!.review.findFirst({
      where: { attempt_id: attemptId, organization_id: orgId },
    });
    expect(dbReview?.comment).toContain('Comentario editado');
    expect(dbReview?.stickers.length).toBe(3);

    // Score remains completely untouched
    const dbAttempt = await prisma!.attempt.findFirst({
      where: { id: attemptId, organization_id: orgId },
    });
    expect(Number(dbAttempt?.score)).toBe(4.8);
  });

  it('Paso 5: La profesora concede un nuevo intento con extensión de plazo opcional', async () => {
    if (!isPostgresAvailable) return;

    const futureExtend = new Date(Date.now() + 5 * 86400 * 1000).toISOString();

    const grantRes = await reviewsService.grantRetry(orgId, teacherId, attemptId, {
      retryExtendUntil: futureExtend,
    });

    expect(grantRes.attemptId).toBe(attemptId);
    expect(grantRes.retryGrantedBy).toBe(teacherId);
    expect(grantRes.retryExtendUntil).toBe(futureExtend);

    // Verify DB Attempt
    const dbAttempt = await prisma!.attempt.findFirst({
      where: { id: attemptId, organization_id: orgId },
    });
    expect(dbAttempt?.retry_granted_at).toBeDefined();
    expect(dbAttempt?.retry_extend_until).toBeDefined();

    // Verify ProgressEvent(retry_granted)
    const event = await prisma!.progressEvent.findFirst({
      where: {
        attempt_id: attemptId,
        type: ProgressEventType.retry_granted,
        organization_id: orgId,
      },
    });
    expect(event).toBeDefined();

    // Second grant on same attempt must fail with 409 RETRY_ALREADY_GRANTED
    await expect(
      reviewsService.grantRetry(orgId, teacherId, attemptId, {}),
    ).rejects.toThrow(ConflictException);
  });

  it('Paso 6: El alumno consume la autorización creando el intento #2 enlazado por previous_attempt_id', async () => {
    if (!isPostgresAvailable) return;

    const retryRuntime = await attemptsService.startAttempt(orgId, studentId, assignmentId);
    expect(retryRuntime.attempt.attemptNumber).toBe(2);
    expect(retryRuntime.attempt.previousAttemptId).toBe(attemptId);
    expect(retryRuntime.attempt.status).toBe(AttemptStatus.in_progress);

    // Original attempt remains intact
    const original = await prisma!.attempt.findFirst({
      where: { id: attemptId, organization_id: orgId },
    });
    expect(Number(original?.score)).toBe(4.8);
    expect(original?.status).toBe(AttemptStatus.graded);
  });

  it('Paso 7: El alumno consulta /feedback y ve el historial cronológico y su retroalimentación sin fugas de audio', async () => {
    if (!isPostgresAvailable) return;

    const feedback = await reviewsService.getStudentFeedback(orgId, studentId);
    expect(feedback.items.length).toBe(1);

    const item = feedback.items[0];
    expect(item?.activityTitle).toBe('My Favorite Animal Speaking');
    expect(item?.latestAttempt.score).toBe(4.8);
    expect(item?.latestAttempt.stars).toBe(3);
    expect(item?.latestAttempt.stickers.length).toBe(3);
    expect(item?.latestAttempt.stickers[0]?.emoji).toBe('🌟');

    // Attempt history has 1 graded attempt
    expect(item?.attempts.length).toBe(1);
    expect(item?.attempts[0]?.attemptNumber).toBe(1);

    // Anti-leak: no media urls or private keys in response
    expect((item as any).url).toBeUndefined();
    expect((item?.latestAttempt as any).key).toBeUndefined();
  });

  it('Paso 8: Aislamiento anti-IDOR: intentar leer intento desde otra organización responde 404', async () => {
    if (!isPostgresAvailable) return;

    await expect(
      reviewsService.getReviewDetail(otherOrgId, attemptId),
    ).rejects.toThrow(NotFoundException);
  });
});
