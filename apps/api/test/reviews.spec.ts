import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewsService } from '../src/reviews/reviews.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { GamificationService } from '../src/gamification/gamification.service';
import { MailService } from '../src/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import {
  ActivityType,
  AttemptStatus,
  MediaAssetStatus,
  ProgressEventType,
  AgeSegment,
} from '@englove/shared';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';

describe('SPEC-07: ReviewsService — Calificación, feedback, retención y nuevo intento', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const otherOrgId = '99999999-9999-4999-8999-999999999999';
  const teacherId = '22222222-2222-4222-8222-222222222222';
  const studentId = '33333333-3333-4333-8333-333333333333';
  const assignmentId = '44444444-4444-4444-8444-444444444444';
  const attemptId = '55555555-5555-4555-8555-555555555555';
  const mediaId = '66666666-6666-4666-8666-666666666666';

  let service: ReviewsService;
  let mockPrisma: any;
  let mockFeatureFlags: any;
  let mockGamification: any;
  let mockMail: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      attempt: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      review: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      mediaAsset: {
        updateMany: vi.fn(),
      },
      assignment: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      progressEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
    };

    mockFeatureFlags = {
      getConfiguration: vi.fn().mockResolvedValue({
        flags: { games: true, extra_content: true },
        config: {
          passing_score: 3.0,
          retention_days: 30,
          pending_upload_ttl_days: 7,
          ungraded_reminder_days: 3,
        },
      }),
    };

    mockGamification = {
      evaluateBadges: vi.fn().mockResolvedValue([]),
    };

    mockMail = {
      sendMail: vi.fn().mockResolvedValue({ status: 'logged', messageId: 'msg-1' }),
    };

    mockConfig = {
      get: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'APP_PUBLIC_URL') return 'http://localhost:3000';
        return defaultValue;
      }),
    };

    service = new ReviewsService(
      mockPrisma as unknown as PrismaService,
      mockFeatureFlags as unknown as FeatureFlagsService,
      mockGamification as unknown as GamificationService,
      mockMail as unknown as MailService,
      mockConfig as unknown as ConfigService,
    );
  });

  describe('RF-1: Queue and Graded listings', () => {
    it('filtra la cola de pendientes por status pending_review y excluye microjuegos (game)', async () => {
      mockPrisma.attempt.count.mockResolvedValue(1);
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: attemptId,
          attempt_number: 1,
          status: AttemptStatus.pending_review,
          score: null,
          finished_at: new Date('2026-10-25T10:00:00Z'),
          graded_at: null,
          retry_granted_at: null,
          retry_extend_until: null,
          student: {
            id: studentId,
            age_segment: AgeSegment.kids,
            user: { name: 'Juan Alumno' },
          },
          assignment: {
            id: assignmentId,
            due_at: new Date('2026-10-26T18:00:00Z'),
            cancelled_at: null,
            group: { id: 'group-1', name: 'Kids A1' },
            activity: { id: 'act-1', title: 'Speaking Animales', type: ActivityType.speaking },
          },
          review: null,
          media_assets: [
            {
              id: mediaId,
              status: MediaAssetStatus.ready,
              duration_seconds: 45,
              converted_key: 'converted.mp4',
              retention_until: null,
            },
          ],
        },
      ]);

      const result = await service.getQueue(orgId, { offset: 0, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.student.displayName).toBe('Juan Alumno');
      expect(result.items[0]?.mediaAsset?.isConverted).toBe(true);
      expect(result.items[0]?.attempt.canGrantRetry).toBe(false);

      expect(mockPrisma.attempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: orgId,
            status: AttemptStatus.pending_review,
            assignment: {
              activity: { type: { not: ActivityType.game } },
            },
          }),
          orderBy: { finished_at: 'asc' },
        }),
      );
    });

    it('lista calificados ordenados por graded_at DESC', async () => {
      mockPrisma.attempt.count.mockResolvedValue(1);
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: attemptId,
          attempt_number: 1,
          status: AttemptStatus.graded,
          score: 4.5,
          finished_at: new Date('2026-10-25T10:00:00Z'),
          graded_at: new Date('2026-10-25T12:00:00Z'),
          retry_granted_at: null,
          retry_extend_until: null,
          student: {
            id: studentId,
            age_segment: AgeSegment.kids,
            user: { name: 'Maria Alumna' },
          },
          assignment: {
            id: assignmentId,
            due_at: new Date('2026-10-26T18:00:00Z'),
            cancelled_at: null,
            group: { id: 'group-1', name: 'Kids A1' },
            activity: { id: 'act-2', title: 'Fill blank clothes', type: ActivityType.fill_blank },
          },
          review: {
            id: 'rev-1',
            comment: 'Buen trabajo',
            stickers: ['great_job'],
            reviewer_id: teacherId,
            created_at: new Date('2026-10-25T12:00:00Z'),
            updated_at: new Date('2026-10-25T12:00:00Z'),
          },
          media_assets: [],
          next_attempt: null,
        },
      ]);

      const result = await service.getGraded(orgId, { offset: 0, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.items[0]?.attempt.score).toBe(4.5);
      expect(result.items[0]?.attempt.stars).toBe(3);
      expect(result.items[0]?.attempt.canGrantRetry).toBe(true);

      expect(mockPrisma.attempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organization_id: orgId,
            status: AttemptStatus.graded,
          }),
          orderBy: { graded_at: 'desc' },
        }),
      );
    });

    it('retorna lista vacia inmediatamente si se consulta por type=game en cola o calificados (Decision 111)', async () => {
      const queueRes = await service.getQueue(orgId, { type: ActivityType.game });
      expect(queueRes).toEqual({ items: [], total: 0, offset: 0, limit: 20 });

      const gradedRes = await service.getGraded(orgId, { type: ActivityType.game });
      expect(gradedRes).toEqual({ items: [], total: 0, offset: 0, limit: 20 });

      expect(mockPrisma.attempt.findMany).not.toHaveBeenCalled();
    });
  });

  describe('RF-4 & RF-5: Submit review, score immutability, stickers', () => {
    it('califica por primera vez un intento pending_review y registra ProgressEvent', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.pending_review,
        score: null,
        attempt_number: 1,
        assignment_id: assignmentId,
        student: { id: studentId, age_segment: AgeSegment.kids, user: { name: 'Juan', email: 'juan@test.com' } },
        assignment: {
          id: assignmentId,
          due_at: new Date('2026-10-30T18:00:00Z'),
          cancelled_at: null,
          group: { id: 'g-1', name: 'Group 1' },
          activity: { id: 'act-1', title: 'Speaking 1', type: ActivityType.speaking, speaking_detail: { prompt: 'Talk about pets', max_duration_seconds: 60 } },
        },
        review: null,
        media_assets: [{ id: mediaId, status: MediaAssetStatus.ready, converted_key: 'conv.mp4' }],
      });

      mockPrisma.attempt.update.mockResolvedValue({});
      mockPrisma.review.create.mockResolvedValue({ id: 'rev-1' });

      // Mock detail retrieval after review
      mockPrisma.attempt.findMany.mockResolvedValue([]);

      const result = await service.submitReview(orgId, teacherId, attemptId, {
        score: 4.8,
        comment: '¡Excelente pronunciación y ritmo!',
        stickers: ['great_job', 'good_pronunciation'],
      });

      expect(result).toBeDefined();

      expect(mockPrisma.attempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: attemptId },
          data: expect.objectContaining({
            score: expect.any(Object),
            status: AttemptStatus.graded,
          }),
        }),
      );

      expect(mockPrisma.mediaAsset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attempt_id: attemptId,
            status: MediaAssetStatus.ready,
          }),
          data: expect.objectContaining({
            retention_until: expect.any(Date),
          }),
        }),
      );

      expect(mockPrisma.progressEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ProgressEventType.review_received,
            student_id: studentId,
            attempt_id: attemptId,
          }),
        }),
      );

      // Verify email was sent without grade or PII
      expect(mockMail.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'grading-notification',
          to: 'juan@test.com',
          variables: {
            activityTitle: 'Speaking 1',
            feedbackUrl: 'http://localhost:3000/feedback',
          },
        }),
      );
    });

    it('rechaza modificación de nota en intento ya graded con 422 SCORE_NOT_EDITABLE (RF-5)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.graded,
        score: 4.0,
        attempt_number: 1,
        assignment_id: assignmentId,
        student: { id: studentId, age_segment: AgeSegment.kids, user: { name: 'Juan', email: 'juan@test.com' } },
        assignment: {
          id: assignmentId,
          due_at: new Date('2026-10-30T18:00:00Z'),
          cancelled_at: null,
          group: { id: 'g-1', name: 'Group 1' },
          activity: { id: 'act-1', title: 'Speaking 1', type: ActivityType.speaking },
        },
        review: { id: 'rev-1', comment: 'Bien', stickers: [] },
        media_assets: [],
      });

      await expect(
        service.submitReview(orgId, teacherId, attemptId, {
          score: 5.0,
          comment: 'Nuevo comentario',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('permite editar comentario y stickers en graded sin reenviar correo (RF-6)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.graded,
        score: 4.0,
        attempt_number: 1,
        assignment_id: assignmentId,
        student: { id: studentId, age_segment: AgeSegment.kids, user: { name: 'Juan', email: 'juan@test.com' } },
        assignment: {
          id: assignmentId,
          due_at: new Date('2026-10-30T18:00:00Z'),
          cancelled_at: null,
          group: { id: 'g-1', name: 'Group 1' },
          activity: { id: 'act-1', title: 'Speaking 1', type: ActivityType.speaking, speaking_detail: { prompt: 'P' } },
        },
        review: { id: 'rev-1', comment: 'Bien', stickers: ['great_job'], created_at: new Date(), updated_at: new Date() },
        media_assets: [],
      });

      mockPrisma.review.update.mockResolvedValue({});
      mockPrisma.attempt.findMany.mockResolvedValue([]);

      await service.submitReview(orgId, teacherId, attemptId, {
        comment: 'Comentario actualizado con más detalles',
        stickers: ['great_job', 'grammar_star'],
      });

      expect(mockPrisma.review.update).toHaveBeenCalled();
      // Should NOT re-send email on editing existing review
      expect(mockMail.sendMail).not.toHaveBeenCalled();
    });

    it('rechaza más de 3 stickers o stickers duplicados (RF-4, Decision 108)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.pending_review,
        assignment_id: assignmentId,
        student: { id: studentId, age_segment: AgeSegment.kids, user: { name: 'Juan', email: 'j@test.com' } },
        assignment: {
          id: assignmentId,
          cancelled_at: null,
          activity: { id: 'a-1', title: 'Act', type: ActivityType.speaking },
        },
      });

      // Duplicates
      await expect(
        service.submitReview(orgId, teacherId, attemptId, {
          score: 4.0,
          comment: 'Test',
          stickers: ['great_job', 'great_job'] as any,
        }),
      ).rejects.toThrow(BadRequestException);

      // More than 3
      await expect(
        service.submitReview(orgId, teacherId, attemptId, {
          score: 4.0,
          comment: 'Test',
          stickers: ['great_job', 'good_pronunciation', 'grammar_star', 'super_effort'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RF-7: grantRetry validations', () => {
    it('rechaza nuevo intento en actividad tipo game (409 RETRY_NOT_ALLOWED, Decision 111)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        assignment_id: assignmentId,
        organization_id: orgId,
        assignment: {
          activity: { type: ActivityType.game },
        },
      });

      await expect(
        service.grantRetry(orgId, teacherId, attemptId, {}),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza nuevo intento si la asignación está cancelada (409 ASSIGNMENT_CANCELLED)', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        assignment_id: assignmentId,
        organization_id: orgId,
        assignment: {
          activity: { type: ActivityType.speaking },
          cancelled_at: new Date(),
        },
      });
      mockPrisma.assignment.findFirst = vi.fn().mockResolvedValue({
        id: assignmentId,
        cancelled_at: new Date(),
      });

      await expect(
        service.grantRetry(orgId, teacherId, attemptId, {}),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza fecha de extensión en el pasado (422 RETRY_EXTEND_INVALID)', async () => {
      mockPrisma.attempt.findFirst
        .mockResolvedValueOnce({
          id: attemptId,
          assignment_id: assignmentId,
          organization_id: orgId,
          status: AttemptStatus.graded,
          next_attempt: null,
          attempt_number: 1,
          assignment: {
            activity: { type: ActivityType.speaking },
            cancelled_at: null,
            due_at: new Date('2026-10-20T00:00:00Z'),
          },
        })
        .mockResolvedValueOnce(null);

      mockPrisma.assignment.findFirst = vi.fn().mockResolvedValue({
        id: assignmentId,
        cancelled_at: null,
        due_at: new Date('2026-10-20T00:00:00Z'),
      });

      await expect(
        service.grantRetry(orgId, teacherId, attemptId, {
          retryExtendUntil: '2020-01-01T00:00:00Z',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('concede nuevo intento atómicamente y emite ProgressEvent(retry_granted)', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        student_id: studentId,
        assignment_id: assignmentId,
        organization_id: orgId,
        status: AttemptStatus.graded,
        next_attempt: null,
        attempt_number: 1,
        assignment: {
          activity: { type: ActivityType.speaking },
          cancelled_at: null,
          due_at: new Date(Date.now() + 3600000),
        },
      }).mockResolvedValueOnce(null); // for higherAttempt check

      mockPrisma.assignment.findFirst = vi.fn().mockResolvedValue({
        id: assignmentId,
        cancelled_at: null,
        due_at: new Date(Date.now() + 3600000),
      });

      mockPrisma.attempt.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.grantRetry(orgId, teacherId, attemptId, {
        retryExtendUntil: futureDate,
      });

      expect(res.attemptId).toBe(attemptId);
      expect(res.retryGrantedBy).toBe(teacherId);
      expect(res.retryExtendUntil).toBe(futureDate);

      expect(mockPrisma.progressEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: ProgressEventType.retry_granted,
            student_id: studentId,
            attempt_id: attemptId,
          }),
        }),
      );
    });

    it('rechaza con 409 RETRY_ALREADY_GRANTED si ya fue concedido', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValueOnce({
        id: attemptId,
        student_id: studentId,
        assignment_id: assignmentId,
        organization_id: orgId,
        status: AttemptStatus.graded,
        next_attempt: null,
        attempt_number: 1,
        assignment: {
          activity: { type: ActivityType.speaking },
          cancelled_at: null,
          due_at: new Date(Date.now() + 3600000),
        },
      }).mockResolvedValueOnce(null);

      mockPrisma.assignment.findFirst = vi.fn().mockResolvedValue({
        id: assignmentId,
        cancelled_at: null,
        due_at: new Date(Date.now() + 3600000),
      });

      mockPrisma.attempt.updateMany.mockResolvedValue({ count: 0 }); // 0 updated -> already granted

      await expect(
        service.grantRetry(orgId, teacherId, attemptId, {}),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('RF-10: Student feedback views', () => {
    it('entrega notas, estrellas, stickers y banner de reintento vigente sin URLs de audio', async () => {
      mockPrisma.attempt.findMany.mockResolvedValue([
        {
          id: attemptId,
          attempt_number: 1,
          score: 4.8,
          graded_at: new Date('2026-10-25T15:00:00Z'),
          retry_granted_at: new Date('2026-10-25T16:00:00Z'),
          retry_extend_until: new Date(Date.now() + 86400000),
          assignment_id: assignmentId,
          assignment: {
            id: assignmentId,
            due_at: new Date(Date.now() - 3600000),
            cancelled_at: null,
            activity: { id: 'act-1', title: 'Speaking 1', type: ActivityType.speaking },
          },
          review: {
            comment: 'Gran pronunciación',
            stickers: ['great_job', 'good_pronunciation'],
          },
          next_attempt: null,
        },
      ]);

      const result = await service.getStudentFeedback(orgId, studentId);

      expect(result.items.length).toBe(1);
      const item = result.items[0];
      expect(item?.activityTitle).toBe('Speaking 1');
      expect(item?.latestAttempt.score).toBe(4.8);
      expect(item?.latestAttempt.stars).toBe(3);
      expect(item?.hasAvailableRetry).toBe(true);
      expect(item?.latestAttempt.stickers.length).toBe(2);
      expect(item?.latestAttempt.stickers[0]?.emoji).toBe('🌟');

      // Crucial: no audio url or key leaked to student
      expect((item as any).url).toBeUndefined();
      expect((item?.latestAttempt as any).mediaUrl).toBeUndefined();
    });
  });

  describe('RF-3: getReviewDetail data mapping and open questions', () => {
    it('extrae rubrica desde config.rubric y enlaza respuesta textual del alumno para open_question', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue({
        id: attemptId,
        student_id: studentId,
        organization_id: orgId,
        status: AttemptStatus.pending_review,
        score: null,
        attempt_number: 1,
        assignment_id: assignmentId,
        payload: { answers: { text: 'My favorite animal is the panda because it sleeps a lot.' } },
        student: { id: studentId, age_segment: AgeSegment.teens, user: { name: 'Carlos Teens' } },
        assignment: {
          id: assignmentId,
          due_at: new Date('2026-10-30T18:00:00Z'),
          cancelled_at: null,
          group: { id: 'g-1', name: 'Teens B1' },
          activity: {
            id: 'act-oq-1',
            title: 'Favorite Animal Essay',
            type: ActivityType.open_question,
            open_question_detail: {
              prompt: 'Write about your favorite animal.',
              config: {
                minWords: 10,
                maxWords: 50,
                rubric: 'Revisar vocabulario, coherencia y uso correcto del tiempo presente.',
              },
            },
          },
        },
        review: null,
        media_assets: [],
      });

      mockPrisma.attempt.findMany.mockResolvedValue([]);

      const detail = await service.getReviewDetail(orgId, attemptId);

      expect(detail.activity.type).toBe(ActivityType.open_question);
      expect(detail.items.length).toBe(1);
      expect(detail.items[0]?.rubricText).toBe(
        'Revisar vocabulario, coherencia y uso correcto del tiempo presente.',
      );
      expect(detail.answers['text']).toBe(
        'My favorite animal is the panda because it sleeps a lot.',
      );
      expect(detail.answers['act-oq-1']).toBe(
        'My favorite animal is the panda because it sleeps a lot.',
      );
    });
  });

  describe('RF-12: Anti-IDOR isolation', () => {
    it('rechaza consultas de otra organización respondiendo 404', async () => {
      mockPrisma.attempt.findFirst.mockResolvedValue(null);

      await expect(
        service.getReviewDetail(otherOrgId, attemptId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
