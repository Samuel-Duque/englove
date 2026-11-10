import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { GamificationService } from '../gamification/gamification.service';
import { MailService } from '../mail/mail.service';
import { ReviewQueryDto, SubmitReviewDto, GrantRetryDto } from './dto/reviews.dto';
import {
  ActivityType,
  AttemptStatus,
  MediaAssetStatus,
  ProgressEventType,
  STICKER_CODES,
  STICKERS,
  StickerCode,
  scoreToStars,
  ReviewListResponse,
  ReviewListItemView,
  AttemptReviewDetailView,
  ReviewItemDetailView,
  AttemptHistoryItemView,
  GrantRetryResponse,
  StudentFeedbackListResponse,
  StudentFeedbackItemView,
  StudentFeedbackAttemptView,
  FillBlankConfigSchema,
  FillBlankAnswerKeySchema,
  ExamConfigSchema,
  ExamAnswerKeySchema,
  getOpenQuestionItems,
} from '@englove/shared';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isStickerCode(val: unknown): val is StickerCode {
  return typeof val === 'string' && val in STICKERS;
}

function parseStickers(stickers: unknown): StickerCode[] {
  if (!Array.isArray(stickers)) return [];
  return stickers.filter(isStickerCode);
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private readonly appPublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly gamificationService: GamificationService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.appPublicUrl =
      this.configService.get<string>('WEB_BASE_URL') ||
      'http://localhost:3000';
  }

  /**
   * RF-1: Queue of attempts pending review (speaking, open_question)
   */
  async getQueue(
    organizationId: string,
    query: ReviewQueryDto,
  ): Promise<ReviewListResponse> {
    const assignmentWhere: Prisma.AssignmentWhereInput = {
      activity: {
        type: { not: ActivityType.game },
      },
    };

    if (query.groupId) {
      assignmentWhere.group_id = query.groupId;
    }

    if (query.type) {
      if (query.type === ActivityType.game) {
        return {
          items: [],
          total: 0,
          offset: query.offset || 0,
          limit: query.limit || 20,
        };
      }
      assignmentWhere.activity = {
        type: query.type,
      };
    }

    const where: Prisma.AttemptWhereInput = {
      organization_id: organizationId,
      status: AttemptStatus.pending_review,
      assignment_id: { not: null },
      assignment: assignmentWhere,
    };

    if (query.from || query.to) {
      where.finished_at = {};
      if (query.from) {
        where.finished_at.gte = new Date(query.from);
      }
      if (query.to) {
        where.finished_at.lte = new Date(query.to);
      }
    }

    const [total, attempts] = await Promise.all([
      this.prisma.attempt.count({ where }),
      this.prisma.attempt.findMany({
        where,
        orderBy: { finished_at: 'asc' },
        skip: query.offset || 0,
        take: query.limit || 20,
        include: {
          student: { include: { user: true } },
          assignment: { include: { activity: true, group: true } },
          review: true,
          media_assets: true,
          previous_attempt: { select: { retry_extend_until: true } },
          next_attempt: true,
        },
      }),
    ]);

    const items = attempts
      .filter((att): att is typeof att & { assignment: NonNullable<typeof att.assignment> } => Boolean(att.assignment))
      .map((att) => this.mapToReviewListItem(att));

    return {
      items,
      total,
      offset: query.offset || 0,
      limit: query.limit || 20,
    };
  }

  /**
   * RF-1: List of graded attempts for assigned activities
   */
  async getGraded(
    organizationId: string,
    query: ReviewQueryDto,
  ): Promise<ReviewListResponse> {
    const assignmentWhere: Prisma.AssignmentWhereInput = {
      activity: {
        type: { not: ActivityType.game },
      },
    };

    if (query.groupId) {
      assignmentWhere.group_id = query.groupId;
    }

    if (query.type) {
      if (query.type === ActivityType.game) {
        return {
          items: [],
          total: 0,
          offset: query.offset || 0,
          limit: query.limit || 20,
        };
      }
      assignmentWhere.activity = {
        type: query.type,
      };
    }

    const where: Prisma.AttemptWhereInput = {
      organization_id: organizationId,
      status: AttemptStatus.graded,
      assignment_id: { not: null },
      assignment: assignmentWhere,
    };

    if (query.from || query.to) {
      where.graded_at = {};
      if (query.from) {
        where.graded_at.gte = new Date(query.from);
      }
      if (query.to) {
        where.graded_at.lte = new Date(query.to);
      }
    }

    const [total, attempts] = await Promise.all([
      this.prisma.attempt.count({ where }),
      this.prisma.attempt.findMany({
        where,
        orderBy: { graded_at: 'desc' },
        skip: query.offset || 0,
        take: query.limit || 20,
        include: {
          student: { include: { user: true } },
          assignment: { include: { activity: true, group: true } },
          review: true,
          media_assets: true,
          previous_attempt: { select: { retry_extend_until: true } },
          next_attempt: true,
        },
      }),
    ]);

    const items = attempts
      .filter((att): att is typeof att & { assignment: NonNullable<typeof att.assignment> } => Boolean(att.assignment))
      .map((att) => this.mapToReviewListItem(att));

    return {
      items,
      total,
      offset: query.offset || 0,
      limit: query.limit || 20,
    };
  }

  /**
   * RF-3: Detail view of an attempt for evaluation context
   */
  async getReviewDetail(
    organizationId: string,
    attemptId: string,
  ): Promise<AttemptReviewDetailView> {
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: attemptId,
        organization_id: organizationId,
      },
      include: {
        student: { include: { user: true } },
        assignment: {
          include: {
            group: true,
            activity: {
              include: {
                fill_blank_detail: {
                  // guardrails-ignore G-C04: lectura controlada de answer_key para evaluacion docente en getReviewDetail
                  select: { id: true, config: true, answer_key: true },
                },
                open_question_detail: true,
                speaking_detail: true,
                exam_detail: {
                  // guardrails-ignore G-C04: lectura controlada de answer_key para evaluacion docente en getReviewDetail
                  select: { id: true, config: true, answer_key: true },
                },
              },
            },
          },
        },
        review: true,
        media_assets: true,
        previous_attempt: { select: { retry_extend_until: true } },
        next_attempt: true,
      },
    });

    if (!attempt || !attempt.assignment || attempt.assignment.activity.type === ActivityType.game) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento de actividad asignada no encontrado',
      });
    }

    // Extract items depending on activity type
    const items: ReviewItemDetailView[] = [];
    const act = attempt.assignment.activity;

    if (act.type === ActivityType.fill_blank && act.fill_blank_detail) {
      const fbConfig = FillBlankConfigSchema.safeParse(act.fill_blank_detail.config);
      const fbKey = FillBlankAnswerKeySchema.safeParse(act.fill_blank_detail.answer_key);
      const itemsList = fbConfig.success ? fbConfig.data.items : [];
      const keyItems = fbKey.success ? fbKey.data.items : {};
      for (const it of itemsList) {
        items.push({
          id: it.id,
          prompt: it.prompt,
          correctAnswer: keyItems[it.id] ?? null,
          rubricText: null,
        });
      }
    } else if (act.type === ActivityType.open_question && act.open_question_detail) {
      const cfg = isRecord(act.open_question_detail.config) ? act.open_question_detail.config : {};
      const rawItems = 'items' in cfg && Array.isArray(cfg.items) ? cfg.items : [];
      if (rawItems.length > 0) {
        for (const it of rawItems) {
          if (isRecord(it) && typeof it.id === 'string') {
            const prompt = typeof it.prompt === 'string' ? it.prompt : undefined;
            const rubric =
              typeof it.rubric === 'string'
                ? it.rubric
                : typeof it.rubricText === 'string'
                  ? it.rubricText
                  : null;
            items.push({
              id: it.id,
              prompt,
              rubricText: rubric,
              correctAnswer: null,
            });
          }
        }
      } else {
        const prompt = typeof cfg.prompt === 'string' ? cfg.prompt : undefined;
        const rubricText =
          typeof cfg.rubric === 'string'
            ? cfg.rubric
            : typeof cfg.rubricText === 'string'
              ? cfg.rubricText
              : typeof cfg.rubric_text === 'string'
                ? cfg.rubric_text
                : null;
        const sampleAnswer = typeof cfg.sample_answer === 'string' ? cfg.sample_answer : null;
        items.push({
          id: act.id,
          prompt,
          rubricText,
          correctAnswer: sampleAnswer,
        });
      }
    } else if (act.type === ActivityType.speaking && act.speaking_detail) {
      items.push({
        id: act.id,
        prompt: act.speaking_detail.prompt,
        maxDurationSeconds: act.speaking_detail.max_duration_seconds,
      });
    } else if (act.type === ActivityType.exam && act.exam_detail) {
      const exConfig = ExamConfigSchema.safeParse(act.exam_detail.config);
      const exKey = ExamAnswerKeySchema.safeParse(act.exam_detail.answer_key);
      const itemsList = exConfig.success ? exConfig.data.items : [];
      const keyItems = exKey.success ? exKey.data.items : {};
      for (const it of itemsList) {
        items.push({
          id: it.id,
          prompt: it.prompt,
          weight: it.weight,
          correctAnswer: keyItems[it.id] ?? null,
          rubricText: null,
        });
      }
    }

    const payloadObj = isRecord(attempt.payload) ? attempt.payload : {};
    const rawAnswers = isRecord(payloadObj.answers) ? payloadObj.answers : {};
    let flattenedAnswers: Record<string, unknown> = { ...rawAnswers };
    if ('items' in rawAnswers && isRecord(rawAnswers.items)) {
      flattenedAnswers = { ...flattenedAnswers, ...rawAnswers.items };
    }
    const answers = { ...flattenedAnswers };

    // If open_question, bridge answers['text'] with answers[act.id] and answers[item.id] ONLY for single-item activity (P1-07, RFC-01)
    if (act.type === ActivityType.open_question) {
      const oqItems = getOpenQuestionItems(act.open_question_detail?.config, act.id);
      const isMultiItem = oqItems.length > 1;
      if (!isMultiItem) {
        const singleItemId = oqItems.length === 1 && oqItems[0] ? oqItems[0].id : act.id;

        if (answers['text'] !== undefined && answers[singleItemId] === undefined) {
          answers[singleItemId] = answers['text'];
        } else if (answers[singleItemId] !== undefined && answers['text'] === undefined) {
          answers['text'] = answers[singleItemId];
        }

        if (singleItemId !== act.id) {
          if (answers['text'] !== undefined && answers[act.id] === undefined) {
            answers[act.id] = answers['text'];
          } else if (answers[act.id] !== undefined && answers['text'] === undefined) {
            answers['text'] = answers[act.id];
          }
        }
      }
    }

    // Load attempt history for this assignment and student
    const historyAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        assignment_id: attempt.assignment_id,
        student_id: attempt.student_id,
      },
      orderBy: { attempt_number: 'asc' },
      include: { review: true },
    });

    const attemptHistory: AttemptHistoryItemView[] = historyAttempts.map((h) => ({
      attemptId: h.id,
      attemptNumber: h.attempt_number,
      status: h.status,
      score: h.score !== null ? Number(h.score) : null,
      stars: scoreToStars(h.score !== null ? Number(h.score) : null),
      finishedAt: h.finished_at?.toISOString() ?? null,
      gradedAt: h.graded_at?.toISOString() ?? null,
      retryGrantedAt: h.retry_granted_at?.toISOString() ?? null,
      review: h.review
        ? {
            comment: h.review.comment,
            stickers: parseStickers(h.review.stickers),
          }
        : null,
    }));

    const baseItem = this.mapToReviewListItem({
      ...attempt,
      assignment: attempt.assignment,
    });

    return {
      ...baseItem,
      items,
      answers,
      attemptHistory,
    };
  }

  /**
   * RF-4, RF-5, RF-6, RF-7: Submit or update review
   */
  async submitReview(
    organizationId: string,
    reviewerId: string,
    attemptId: string,
    dto: SubmitReviewDto,
  ): Promise<AttemptReviewDetailView> {
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: attemptId,
        organization_id: organizationId,
      },
      include: {
        student: { include: { user: true } },
        assignment: {
          include: {
            activity: true,
            group: true,
          },
        },
        review: true,
        media_assets: true,
      },
    });

    if (!attempt || !attempt.assignment || attempt.assignment.activity.type === ActivityType.game) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento de actividad asignada no encontrado',
      });
    }

    // Validate stickers
    const stickers = this.validateStickers(dto.stickers);

    // Validate comment
    const rawComment = dto.comment?.trim() ?? '';
    const isManualActivity =
      attempt.assignment.activity.type === ActivityType.open_question ||
      attempt.assignment.activity.type === ActivityType.speaking;

    const now = new Date();
    let isFirstReview = false;

    if (dto.score !== undefined && (typeof dto.score !== 'number' || dto.score < 0 || dto.score > 5)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'SCORE_OUT_OF_RANGE',
        message: 'La calificación debe estar entre 0.0 y 5.0',
      });
    }

    if (attempt.status === AttemptStatus.pending_review) {
      // Manual initial grading (RF-4)
      if (dto.score === undefined || dto.score === null) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'SCORE_REQUIRED',
          message: 'El puntaje es obligatorio para calificar un intento pendiente',
        });
      }

      if (isManualActivity && rawComment.length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'COMMENT_REQUIRED',
          message: 'El comentario de retroalimentación es obligatorio para actividades manuales',
        });
      }

      const roundedScore = Number(dto.score.toFixed(1));
      isFirstReview = true;

      // Read retention configuration
      let retentionDays: number;
      try {
        const config = await this.featureFlagsService.getConfiguration(organizationId);
        retentionDays = config.config.retention_days;
      } catch {
        retentionDays = 30;
      }

      const retentionUntil = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

      await this.prisma.$transaction(async (tx) => {
        // Concurrency lock (ENG-152)
        let locked: { id: string; status: AttemptStatus } | undefined;
        if (typeof tx.$queryRaw === 'function') {
          const lockedRows = await tx.$queryRaw<Array<{ id: string; status: AttemptStatus }>>`
            SELECT id, status
            FROM attempts
            WHERE id = ${attempt.id}::uuid AND organization_id = ${organizationId}::uuid
            FOR UPDATE
          `;
          locked = lockedRows?.[0];
        }
        if (!locked) {
          locked = { id: attempt.id, status: attempt.status };
        }
        if (locked.status === AttemptStatus.graded && dto.score !== undefined) {
          throw new UnprocessableEntityException({
            statusCode: 422,
            code: 'SCORE_NOT_EDITABLE',
            message: 'El puntaje ya no es editable una vez calificado el intento',
          });
        }

        // Update attempt
        await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            score: new Prisma.Decimal(roundedScore),
            graded_at: now,
            status: AttemptStatus.graded,
          },
        });

        // Create or update review atomically (P1-06)
        const existingReview = tx.review?.findFirst
          ? await tx.review.findFirst({
              where: { attempt_id: attempt.id, organization_id: organizationId },
            })
          : attempt.review;

        if (existingReview) {
          const reviewTarget = tx.review ?? this.prisma.review;
          await reviewTarget.update({
            where: { id: existingReview.id },
            data: {
              reviewer_id: reviewerId,
              comment: rawComment.length > 0 ? rawComment : null,
              stickers,
            },
          });
        } else {
          await tx.review.create({
            data: {
              organization_id: organizationId,
              attempt_id: attempt.id,
              reviewer_id: reviewerId,
              comment: rawComment.length > 0 ? rawComment : null,
              stickers,
            },
          });
        }

        // Set retention_until on ready MediaAssets
        await tx.mediaAsset.updateMany({
          where: {
            attempt_id: attempt.id,
            organization_id: organizationId,
            status: MediaAssetStatus.ready,
          },
          data: {
            retention_until: retentionUntil,
          },
        });

        // Create progress event (review_received) only once
        if (!existingReview) {
          await tx.progressEvent.create({
            data: {
              organization_id: organizationId,
              student_id: attempt.student_id,
              attempt_id: attempt.id,
              type: ProgressEventType.review_received,
              value: new Prisma.Decimal(roundedScore),
            },
          });
        }

        if (dto.allowRetry) {
          await this.applyGrantRetryTx(
            tx,
            organizationId,
            reviewerId,
            attempt.id,
            dto.retryExtendUntil,
            now,
          );
        }
      });

      // Evaluate badges outside transaction
      await this.gamificationService
        .evaluateBadges(organizationId, attempt.student_id)
        .catch(() => {});
    } else if (attempt.status === AttemptStatus.graded) {
      // Editing review of already graded attempt (RF-5)
      if (dto.score !== undefined) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'SCORE_NOT_EDITABLE',
          message: 'El puntaje ya no es editable una vez calificado el intento',
        });
      }

      if (isManualActivity) {
        if (rawComment.length === 0) {
          throw new BadRequestException({
            statusCode: 400,
            code: 'COMMENT_REQUIRED',
            message: 'El comentario de retroalimentación es obligatorio para actividades manuales',
          });
        }
      } else {
        // Auto-graded: requires either non-empty comment or 1..3 stickers (Decision 84 & RF-5)
        if (rawComment.length === 0 && stickers.length === 0) {
          throw new BadRequestException({
            statusCode: 400,
            code: 'COMMENT_OR_STICKERS_REQUIRED',
            message: 'Debes ingresar un comentario o al menos un sticker para guardar la retroalimentación',
          });
        }
      }

      await this.prisma.$transaction(async (tx) => {
        if (typeof tx.$queryRaw === 'function') {
          await tx.$queryRaw`
            SELECT id
            FROM attempts
            WHERE id = ${attempt.id}::uuid AND organization_id = ${organizationId}::uuid
            FOR UPDATE
          `;
        }

        const existingReview = tx.review?.findFirst
          ? await tx.review.findFirst({
              where: { attempt_id: attempt.id, organization_id: organizationId },
            })
          : attempt.review;

        isFirstReview = !existingReview;

        if (existingReview) {
          const reviewTarget = tx.review ?? this.prisma.review;
          await reviewTarget.update({
            where: { id: existingReview.id },
            data: {
              reviewer_id: reviewerId,
              comment: rawComment.length > 0 ? rawComment : null,
              stickers,
            },
          });
        } else {
          await tx.review.create({
            data: {
              organization_id: organizationId,
              attempt_id: attempt.id,
              reviewer_id: reviewerId,
              comment: rawComment.length > 0 ? rawComment : null,
              stickers,
            },
          });
        }

        if (isFirstReview) {
          await tx.progressEvent.create({
            data: {
              organization_id: organizationId,
              student_id: attempt.student_id,
              attempt_id: attempt.id,
              type: ProgressEventType.review_received,
              value: attempt.score,
            },
          });
        }

        if (dto.allowRetry) {
          await this.applyGrantRetryTx(
            tx,
            organizationId,
            reviewerId,
            attempt.id,
            dto.retryExtendUntil,
            now,
          );
        }
      });

      if (isFirstReview) {
        await this.gamificationService
          .evaluateBadges(organizationId, attempt.student_id)
          .catch(() => {});
      }
    } else {
      throw new ConflictException({
        statusCode: 409,
        code: 'INVALID_ATTEMPT_STATUS',
        message: 'El intento no está en un estado válido para revisión',
      });
    }

    // RF-6: Send email only on first review and without PII or grade
    if (isFirstReview) {
      this.sendGradingNotification(
        attempt.student.user.email,
        attempt.assignment.activity.title,
        attempt.id,
      );
    }

    return this.getReviewDetail(organizationId, attemptId);
  }

  /**
   * RF-7: Grant retry for an assigned activity
   */
  async grantRetry(
    organizationId: string,
    teacherUserId: string,
    attemptId: string,
    dto: GrantRetryDto,
  ): Promise<GrantRetryResponse> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      return this.applyGrantRetryTx(
        tx,
        organizationId,
        teacherUserId,
        attemptId,
        dto.retryExtendUntil,
        now,
      );
    });
  }

  /**
   * Internal transactional implementation of grantRetry (RF-7)
   */
  private async applyGrantRetryTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    teacherUserId: string,
    attemptId: string,
    retryExtendUntilRaw?: string | null,
    now: Date = new Date(),
  ): Promise<GrantRetryResponse> {
    const attempt = await tx.attempt.findFirst({
      where: {
        id: attemptId,
        organization_id: organizationId,
      },
      include: {
        assignment: {
          include: {
            activity: true,
          },
        },
        next_attempt: true,
      },
    });

    // 1. Validation: must exist, have assignment and not be game (Decision 111)
    if (!attempt || !attempt.assignment || !attempt.assignment_id || attempt.assignment.activity.type === ActivityType.game) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RETRY_NOT_ALLOWED',
        message: 'Los microjuegos son de práctica autónoma 24/7 y no admiten nuevo intento asignado',
      });
    }

    const assignmentId = attempt.assignment_id;

    // 2. Lock assignment and verify not cancelled (RF-7)
    let assignment: { id: string; due_at: Date; cancelled_at: Date | null } | null;
    if (typeof tx.$queryRaw === 'function') {
      try {
        const rows = await tx.$queryRaw<Array<{ id: string; due_at: Date; cancelled_at: Date | null }>>`
          SELECT id, due_at, cancelled_at
          FROM assignments
          WHERE id = ${assignmentId}::uuid AND organization_id = ${organizationId}::uuid
          FOR UPDATE
        `;
        assignment = rows[0] || null;
      } catch {
        assignment = await tx.assignment.findFirst({
          where: {
            id: assignmentId,
            organization_id: organizationId,
          },
        });
      }
    } else {
      assignment = await tx.assignment.findFirst({
        where: {
          id: assignmentId,
          organization_id: organizationId,
        },
      });
    }

    if (!assignment || assignment.cancelled_at !== null) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ASSIGNMENT_CANCELLED',
        message: 'La asignación fue cancelada',
      });
    }

    // 3. Status must be graded and must be latest attempt
    if (attempt.status !== AttemptStatus.graded || attempt.next_attempt !== null) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RETRY_NOT_ALLOWED',
        message: 'Solo se puede conceder un nuevo intento sobre el último intento calificado',
      });
    }

    // Check if another attempt with higher attempt_number exists
    const higherAttempt = await tx.attempt.findFirst({
      where: {
        assignment_id: assignmentId,
        student_id: attempt.student_id,
        organization_id: organizationId,
        attempt_number: { gt: attempt.attempt_number },
      },
    });

    if (higherAttempt) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RETRY_NOT_ALLOWED',
        message: 'Solo se puede conceder un nuevo intento sobre el último intento calificado',
      });
    }

    // 4. Validate retryExtendUntil if provided
    let retryExtendUntil: Date | null = null;
    if (retryExtendUntilRaw) {
      const parsed = new Date(retryExtendUntilRaw);
      if (isNaN(parsed.getTime()) || parsed <= now) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'RETRY_EXTEND_INVALID',
          message: 'La fecha de extensión debe ser una fecha válida posterior a la actual',
        });
      }
      retryExtendUntil = parsed;
    }

    // 5. Atomic update ensuring retry_granted_at was null
    const updateResult = await tx.attempt.updateMany({
      where: {
        id: attempt.id,
        organization_id: organizationId,
        retry_granted_at: null,
      },
      data: {
        retry_granted_at: now,
        retry_granted_by: teacherUserId,
        retry_extend_until: retryExtendUntil,
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RETRY_ALREADY_GRANTED',
        message: 'Ya se concedió un nuevo intento para esta entrega',
      });
    }

    // 6. Record ProgressEvent(retry_granted)
    await tx.progressEvent.create({
      data: {
        organization_id: organizationId,
        student_id: attempt.student_id,
        attempt_id: attempt.id,
        type: ProgressEventType.retry_granted,
        payload: {
          retry_extend_until: retryExtendUntil ? retryExtendUntil.toISOString() : null,
        },
      },
    });

    const effectiveDueAt = retryExtendUntil ?? assignment.due_at;

    return {
      attemptId: attempt.id,
      retryGrantedAt: now.toISOString(),
      retryGrantedBy: teacherUserId,
      retryExtendUntil: retryExtendUntil ? retryExtendUntil.toISOString() : null,
      effectiveDueAt: effectiveDueAt.toISOString(),
    };
  }

  /**
   * RF-10: List all feedback for the authenticated student
   */
  async getStudentFeedback(
    organizationId: string,
    studentId: string,
  ): Promise<StudentFeedbackListResponse> {
    // Find all graded attempts of this student for assigned activities
    const gradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        status: AttemptStatus.graded,
        assignment_id: { not: null },
        assignment: {
          activity: {
            type: { not: ActivityType.game },
          },
        },
      },
      orderBy: { attempt_number: 'asc' },
      include: {
        assignment: {
          include: {
            activity: true,
          },
        },
        review: true,
        next_attempt: true,
      },
    });

    // Group by assignment_id
    const assignmentMap = new Map<string, typeof gradedAttempts>();
    for (const att of gradedAttempts) {
      if (!att.assignment_id || !att.assignment) continue;
      const list = assignmentMap.get(att.assignment_id) || [];
      list.push(att);
      assignmentMap.set(att.assignment_id, list);
    }

    const now = new Date();
    const items: StudentFeedbackItemView[] = [];

    for (const [, attempts] of assignmentMap) {
      const latest = attempts[attempts.length - 1];
      if (!latest || !latest.assignment) {
        continue;
      }
      const assignment = latest.assignment;

      const hasAvailableRetry =
        latest.retry_granted_at !== null &&
        latest.next_attempt === null &&
        assignment.cancelled_at === null &&
        now <= (latest.retry_extend_until ?? assignment.due_at);

      const effectiveDueAt = (latest.retry_extend_until ?? assignment.due_at).toISOString();

      const mappedAttempts: StudentFeedbackAttemptView[] = attempts.map((a) =>
        this.mapToStudentFeedbackAttempt(a),
      );

      items.push({
        assignmentId: assignment.id,
        activityTitle: assignment.activity.title,
        activityType: assignment.activity.type,
        latestAttempt: this.mapToStudentFeedbackAttempt(latest),
        hasAvailableRetry,
        effectiveDueAt,
        attempts: mappedAttempts,
      });
    }

    // Sort by latestAttempt.gradedAt DESC
    items.sort(
      (a, b) =>
        new Date(b.latestAttempt.gradedAt).getTime() -
        new Date(a.latestAttempt.gradedAt).getTime(),
    );

    return { items };
  }

  /**
   * RF-10: Feedback for a single assignment for the authenticated student
   */
  async getStudentAssignmentFeedback(
    organizationId: string,
    studentId: string,
    assignmentId: string,
  ): Promise<StudentFeedbackItemView> {
    const gradedAttempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        assignment_id: assignmentId,
        status: AttemptStatus.graded,
      },
      orderBy: { attempt_number: 'asc' },
      include: {
        assignment: {
          include: {
            activity: true,
          },
        },
        review: true,
        next_attempt: true,
      },
    });

    if (gradedAttempts.length === 0) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'FEEDBACK_NOT_FOUND',
        message: 'No hay retroalimentación calificada para esta actividad',
      });
    }

    const latest = gradedAttempts[gradedAttempts.length - 1];
    if (!latest || !latest.assignment) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'FEEDBACK_NOT_FOUND',
        message: 'No hay retroalimentación calificada para esta actividad',
      });
    }
    const assignment = latest.assignment;
    const now = new Date();

    const hasAvailableRetry =
      latest.retry_granted_at !== null &&
      latest.next_attempt === null &&
      assignment.cancelled_at === null &&
      now <= (latest.retry_extend_until ?? assignment.due_at);

    const effectiveDueAt = (latest.retry_extend_until ?? assignment.due_at).toISOString();

    return {
      assignmentId: assignment.id,
      activityTitle: assignment.activity.title,
      activityType: assignment.activity.type,
      latestAttempt: this.mapToStudentFeedbackAttempt(latest),
      hasAvailableRetry,
      effectiveDueAt,
      attempts: gradedAttempts.map((a) => this.mapToStudentFeedbackAttempt(a)),
    };
  }

  private mapToReviewListItem(att: {
    id: string;
    attempt_number: number;
    status: AttemptStatus;
    score: Prisma.Decimal | null;
    finished_at: Date | null;
    graded_at: Date | null;
    retry_granted_at: Date | null;
    retry_extend_until: Date | null;
    student: {
      id: string;
      age_segment: import('@englove/shared').AgeSegment;
      user: { name: string };
    };
    assignment: {
      id: string;
      due_at: Date;
      cancelled_at: Date | null;
      group: { id: string; name: string };
      activity: { id: string; title: string; type: ActivityType };
    };
    review: {
      id: string;
      comment: string | null;
      stickers: string[];
      reviewer_id: string;
      created_at: Date;
      updated_at: Date;
    } | null;
    media_assets: Array<{
      id: string;
      status: import('@englove/shared').MediaAssetStatus;
      duration_seconds: number | null;
      converted_key: string | null;
      retention_until: Date | null;
    }>;
    previous_attempt?: {
      retry_extend_until?: Date | null;
    } | null;
    next_attempt?: unknown;
  }): ReviewListItemView {
    const rawScore = att.score !== null ? Number(att.score) : null;
    const effectiveDueAt = (att.previous_attempt?.retry_extend_until ?? att.assignment.due_at).toISOString();

    const canGrantRetry =
      att.status === AttemptStatus.graded &&
      att.assignment.cancelled_at === null &&
      att.retry_granted_at === null &&
      !att.next_attempt;

    const media = att.media_assets.find((m) => m.status === MediaAssetStatus.ready) || att.media_assets[0] || null;

    return {
      student: {
        id: att.student.id,
        displayName: att.student.user.name,
        ageSegment: att.student.age_segment,
      },
      group: {
        id: att.assignment.group.id,
        name: att.assignment.group.name,
      },
      activity: {
        id: att.assignment.activity.id,
        title: att.assignment.activity.title,
        type: att.assignment.activity.type,
      },
      assignment: {
        id: att.assignment.id,
        dueAt: att.assignment.due_at.toISOString(),
        cancelledAt: att.assignment.cancelled_at?.toISOString() ?? null,
      },
      attempt: {
        attemptId: att.id,
        attemptNumber: att.attempt_number,
        status: att.status,
        score: rawScore,
        stars: scoreToStars(rawScore),
        finishedAt: att.finished_at?.toISOString() ?? null,
        gradedAt: att.graded_at?.toISOString() ?? null,
        retryGrantedAt: att.retry_granted_at?.toISOString() ?? null,
        retryExtendUntil: att.retry_extend_until?.toISOString() ?? null,
        effectiveDueAt,
        canGrantRetry,
      },
      review: att.review
        ? {
            id: att.review.id,
            comment: att.review.comment,
            stickers: parseStickers(att.review.stickers),
            reviewerId: att.review.reviewer_id,
            createdAt: att.review.created_at?.toISOString?.() ?? new Date().toISOString(),
            updatedAt: att.review.updated_at?.toISOString?.() ?? new Date().toISOString(),
          }
        : null,
      mediaAsset: media
        ? {
            id: media.id,
            status: media.status,
            durationSeconds: media.duration_seconds ?? null,
            isConverted: Boolean(media.converted_key),
            retentionUntil: media.retention_until?.toISOString() ?? null,
          }
        : null,
    };
  }

  private mapToStudentFeedbackAttempt(att: {
    id: string;
    attempt_number: number;
    score: Prisma.Decimal | null;
    graded_at: Date | null;
    review: {
      comment: string | null;
      stickers: string[];
    } | null;
  }): StudentFeedbackAttemptView {
    const rawScore = att.score !== null ? Number(att.score) : 0;
    const stickerDefs = parseStickers(att.review?.stickers)
      .map((code) => STICKERS[code])
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    return {
      id: att.id,
      attemptNumber: att.attempt_number,
      score: rawScore,
      stars: scoreToStars(rawScore),
      gradedAt: att.graded_at?.toISOString() ?? new Date().toISOString(),
      comment: att.review?.comment ?? null,
      stickers: stickerDefs,
    };
  }

  private validateStickers(stickers?: StickerCode[]): StickerCode[] {
    if (!stickers || stickers.length === 0) {
      return [];
    }

    if (stickers.length > 3) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STICKERS',
        message: 'No puedes seleccionar más de 3 stickers',
      });
    }

    const uniqueSet = new Set(stickers);
    if (uniqueSet.size !== stickers.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_STICKERS',
        message: 'No se permiten stickers duplicados',
      });
    }

    for (const code of stickers) {
      if (!STICKER_CODES.includes(code)) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'INVALID_STICKERS',
          message: `Código de sticker inválido: ${code}`,
        });
      }
    }

    return stickers;
  }

  private sendGradingNotification(toEmail: string, activityTitle: string, attemptId: string): void {
    const dispatch = async (isRetry = false) => {
      try {
        await this.mailService.sendMail({
          template: 'grading-notification',
          to: toEmail,
          variables: {
            activityTitle,
            feedbackUrl: `${this.appPublicUrl}/feedback`,
          },
          idempotencyKey: `grading-${attemptId}`,
        });
      } catch {
        if (!isRetry) {
          // Retry once on failure
          setTimeout(() => {
            dispatch(true).catch(() => {});
          }, 1000);
        } else {
          this.logger.warn(`Fallo al enviar notificación de calificación para intento ${attemptId}`);
        }
      }
    };

    dispatch(false).catch(() => {});
  }
}
