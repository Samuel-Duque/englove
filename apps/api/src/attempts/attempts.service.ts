import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { GamificationService } from '../gamification/gamification.service';
import { MediaService } from '../media/media.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  SubmitEventsDto,
  CompleteAttemptDto,
  AssignmentCardQueryDto,
} from './dto/attempts.dto';
import {
  AttemptStatus,
  ActivityType,
  ActivityStatus,
  AttemptView,
  RuntimeView,
  CompletionView,
  AssignmentCard,
  AssignmentCardListResponse,
  StudentProgressView,
  FillBlankConfig,
  FillBlankAnswerKey,
  ExamConfig,
  ExamAnswerKey,
} from '@englove/shared';

interface AttemptTokenPayload {
  attemptId: string;
  studentId: string;
  organizationId: string;
  exp?: number;
}

interface ActivityEntityLike {
  id: string;
  title: string;
  type: ActivityType;
  level: import('@englove/shared').Level;
  fill_blank_detail?: { config: unknown } | null;
  open_question_detail?: { config: unknown } | null;
  speaking_detail?: {
    prompt: string;
    example_url?: string | null;
    min_duration_seconds: number;
    max_duration_seconds: number;
  } | null;
  exam_detail?: { config: unknown } | null;
}

interface AttemptEntityLike {
  id: string;
  assignment_id: string;
  attempt_number: number;
  previous_attempt_id: string | null;
  status: AttemptStatus;
  started_at: Date;
  finished_at: Date | null;
  graded_at: Date | null;
  score: Prisma.Decimal | number | null;
  flags: string[];
  payload?: unknown;
  assignment?: {
    due_at: Date;
    activity: ActivityEntityLike;
  };
  previous_attempt?: {
    retry_extend_until?: Date | null;
  } | null;
}

@Injectable()
export class AttemptsService {
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly scoringService: ScoringService,
    private readonly gamificationService: GamificationService,
    private readonly mediaService: MediaService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'englove-dev-jwt-secret-min-32-chars-long-local-secret!',
    );
  }

  /**
   * Starts a new attempt or consumes an existing retry grant (RF-3, RF-4).
   */
  async startAttempt(
    organizationId: string,
    studentId: string,
    assignmentId: string,
  ): Promise<RuntimeView> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organization_id: organizationId },
      include: {
        memberships: {
          where: { left_at: null },
        },
      },
    });

    const activeMembership = student?.memberships[0];
    if (!student || !activeMembership) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'NO_ACTIVE_GROUP',
        message: 'El alumno no tiene un grupo activo',
      });
    }

    const activeGroupId = activeMembership.group_id;

    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId, organization_id: organizationId },
      include: {
        activity: {
          include: {
            fill_blank_detail: true,
            open_question_detail: true,
            speaking_detail: true,
            game_detail: true,
            exam_detail: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Asignación no encontrada',
      });
    }

    if (assignment.cancelled_at !== null) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ASSIGNMENT_CANCELLED',
        message: 'La asignación fue cancelada',
      });
    }

    if (assignment.activity.status !== ActivityStatus.published) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_NOT_AVAILABLE',
        message: 'La actividad no está disponible',
      });
    }

    if (assignment.activity.type === ActivityType.game) {
      const gamesEnabled = await this.featureFlagsService.isFeatureEnabled(
        organizationId,
        'games',
      );
      if (!gamesEnabled) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ACTIVITY_NOT_AVAILABLE',
          message: 'Los microjuegos aún no están disponibles',
        });
      }
    }

    if (assignment.group_id !== activeGroupId) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ASSIGNMENT_NOT_IN_ACTIVE_GROUP',
        message: 'La asignación no pertenece a tu grupo actual',
      });
    }

    // Check existing attempts for this student on this assignment
    const existingAttempts = await this.prisma.attempt.findMany({
      where: {
        assignment_id: assignmentId,
        student_id: studentId,
        organization_id: organizationId,
      },
      orderBy: { attempt_number: 'desc' },
      include: { next_attempt: true },
    });

    const now = new Date();
    let attemptNumber = 1;
    let previousAttemptId: string | null = null;
    let effectiveDueAt = assignment.due_at;

    const latestAttempt = existingAttempts[0];
    if (latestAttempt) {
      // Check for unconsumed retry authorization (RF-4, Decision 61, 74)
      const hasUnconsumedRetry =
        latestAttempt.retry_granted_at !== null && !latestAttempt.next_attempt;

      if (!hasUnconsumedRetry) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ATTEMPT_ALREADY_EXISTS',
          message: 'Ya existe un intento para esta asignación',
        });
      }

      attemptNumber = latestAttempt.attempt_number + 1;
      previousAttemptId = latestAttempt.id;
      effectiveDueAt = latestAttempt.retry_extend_until ?? assignment.due_at;
    }

    // Time window validation (RF-3, Decision 84)
    if (now < assignment.opens_at) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_OPEN',
        message: `Esta actividad abre el ${assignment.opens_at.toISOString()}`,
      });
    }

    if (now > effectiveDueAt) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_CLOSED',
        message: 'La actividad ya está cerrada',
      });
    }

    // Atomically create Attempt (RF-3, RF-4, Decision 74)
    let attempt;
    try {
      attempt = await this.prisma.attempt.create({
        data: {
          organization_id: organizationId,
          assignment_id: assignmentId,
          student_id: studentId,
          attempt_number: attemptNumber,
          previous_attempt_id: previousAttemptId,
          status: AttemptStatus.in_progress,
          started_at: now,
          payload: { answers: {}, processedEventIds: [] },
          flags: [],
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          code: 'ATTEMPT_ALREADY_EXISTS',
          message: 'Ya existe un intento en curso o creado para esta autorización',
        });
      }
      throw err;
    }

    const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);
    const token = this.generateAttemptToken(attempt.id, studentId, organizationId, completeUntil);

    return this.buildRuntimeView(attempt, assignment, effectiveDueAt, completeUntil, token);
  }

  /**
   * Retrieves an attempt by ID for the owning student (RF-2).
   */
  async getAttempt(
    organizationId: string,
    studentId: string,
    attemptId: string,
  ): Promise<RuntimeView> {
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: attemptId,
        student_id: studentId,
        organization_id: organizationId,
      },
      include: {
        assignment: {
          include: {
            activity: {
              include: {
                fill_blank_detail: true,
                open_question_detail: true,
                speaking_detail: true,
                game_detail: true,
                exam_detail: true,
              },
            },
          },
        },
        previous_attempt: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento no encontrado',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ?? attempt.assignment.due_at;
    const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

    const isContinuable =
      attempt.status === AttemptStatus.in_progress && new Date() <= completeUntil;

    const token = isContinuable
      ? this.generateAttemptToken(attempt.id, studentId, organizationId, completeUntil)
      : null;

    return this.buildRuntimeView(attempt, attempt.assignment, effectiveDueAt, completeUntil, token);
  }

  /**
   * Submits event batch idempotently (RF-7).
   */
  async submitEvents(
    organizationId: string,
    studentId: string,
    attemptId: string,
    token: string,
    dto: SubmitEventsDto,
  ): Promise<{ acceptedEventIds: string[] }> {
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: attemptId,
        student_id: studentId,
        organization_id: organizationId,
      },
      include: {
        assignment: true,
        previous_attempt: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento no encontrado',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ?? attempt.assignment.due_at;
    const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

    // Verify token authentic and not expired
    this.verifyAttemptToken(token, attempt.id, studentId, organizationId, completeUntil);

    if (attempt.status !== AttemptStatus.in_progress) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_IN_PROGRESS',
        message: 'El intento ya no admite cambios',
      });
    }

    if (new Date() > completeUntil) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_CLOSED',
        message: 'La actividad ya está cerrada',
      });
    }

    // Merge payload safely
    const currentPayload = (attempt.payload as {
      answers?: Record<string, unknown>;
      processedEventIds?: string[];
    }) || {};

    const answers = { ...(currentPayload.answers || {}) };
    const processedSet = new Set<string>(currentPayload.processedEventIds || []);
    const acceptedEventIds: string[] = [];

    for (const ev of dto.events) {
      acceptedEventIds.push(ev.clientEventId);
      if (!processedSet.has(ev.clientEventId)) {
        processedSet.add(ev.clientEventId);
        if (typeof ev.answer === 'object' && ev.answer !== null && !Array.isArray(ev.answer)) {
          const existing = (answers[ev.itemId] as Record<string, unknown>) || {};
          answers[ev.itemId] = { ...existing, ...(ev.answer as Record<string, unknown>) };
        } else {
          answers[ev.itemId] = ev.answer;
        }
      }
    }

    await this.prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        payload: {
          answers,
          processedEventIds: Array.from(processedSet),
        } as unknown as Prisma.InputJsonObject,
      },
    });

    return { acceptedEventIds };
  }

  /**
   * Completes attempt atomically and computes score if auto-graded (RF-8, RF-9, RF-10, RF-13).
   */
  async completeAttempt(
    organizationId: string,
    studentId: string,
    attemptId: string,
    token: string,
    dto: CompleteAttemptDto,
  ): Promise<CompletionView> {
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        id: attemptId,
        student_id: studentId,
        organization_id: organizationId,
      },
      include: {
        assignment: {
          include: {
            activity: {
              include: {
                fill_blank_detail: true,
                open_question_detail: true,
                speaking_detail: true,
                exam_detail: true,
              },
            },
          },
        },
        previous_attempt: true,
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento no encontrado',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ?? attempt.assignment.due_at;
    const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

    // Verify token
    this.verifyAttemptToken(token, attempt.id, studentId, organizationId, completeUntil);

    // If already finished and within tolerance: idempotent return of completion receipt (RF-8)
    if (attempt.status === AttemptStatus.graded || attempt.status === AttemptStatus.pending_review) {
      return this.buildExistingCompletionView(attempt, attempt.assignment.activity);
    }

    if (attempt.status !== AttemptStatus.in_progress) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_IN_PROGRESS',
        message: 'El intento ya no admite cambios',
      });
    }

    if (new Date() > completeUntil) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_CLOSED',
        message: 'La actividad ya está cerrada',
      });
    }

    const activity = attempt.assignment.activity;
    const now = new Date();
    const durationSeconds = Math.max(0, Math.round((now.getTime() - attempt.started_at.getTime()) / 1000));
    const minPlausible = activity.min_plausible_seconds;

    const payload = (attempt.payload as { answers?: Record<string, unknown> }) || {};
    const answers = payload.answers || {};

    let updatedAttempt;
    let correction: Record<string, unknown> | null = null;
    let newBadges: import('@englove/shared').BadgeAwardView[] = [];

    if (activity.type === ActivityType.speaking) {
      if (!dto.mediaId) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'MEDIA_REQUIRED',
          message: 'Se requiere mediaId para completar una actividad de speaking',
        });
      }

      const maxDur = activity.speaking_detail?.max_duration_seconds ?? 120;
      await this.mediaService.confirmUpload(
        organizationId,
        studentId,
        attempt.id,
        dto.mediaId,
        maxDur,
      );

      updatedAttempt = await this.prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.pending_review,
          finished_at: now,
        },
      });

      newBadges = await this.gamificationService.recordAudioSubmitted(
        organizationId,
        studentId,
        attempt.id,
      );
    } else if (activity.type === ActivityType.open_question) {
      updatedAttempt = await this.prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.pending_review,
          finished_at: now,
        },
      });

      newBadges = await this.gamificationService.recordAttemptCompleted(
        organizationId,
        studentId,
        attempt.id,
        null,
      );
    } else if (activity.type === ActivityType.fill_blank) {
      const config = activity.fill_blank_detail?.config as unknown as FillBlankConfig;
      // Get answer_key with direct server-side query for auto-grading (Decision 75)
      const detailWithKey = await this.prisma.fillBlankDetail.findFirst({
        where: { organization_id: organizationId, activity_id: activity.id },
        // guardrails-ignore G-C04: lectura exclusiva de answer_key en el servidor para autocalificacion de intento
        select: { answer_key: true },
      });

      const answerKey = (detailWithKey?.answer_key as unknown as FillBlankAnswerKey) || { items: {} };
      const scoreResult = this.scoringService.calculateFillBlank(
        config,
        answerKey,
        answers as Record<string, string>,
        durationSeconds,
        minPlausible ?? undefined,
      );

      correction = scoreResult.correction;

      updatedAttempt = await this.prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.graded,
          score: new Prisma.Decimal(scoreResult.score),
          graded_at: now,
          finished_at: now,
          flags: scoreResult.flags,
        },
      });

      newBadges = await this.gamificationService.recordAttemptCompleted(
        organizationId,
        studentId,
        attempt.id,
        scoreResult.score,
      );
    } else if (activity.type === ActivityType.exam) {
      const config = activity.exam_detail?.config as unknown as ExamConfig;
      const detailWithKey = await this.prisma.examDetail.findFirst({
        where: { organization_id: organizationId, activity_id: activity.id },
        // guardrails-ignore G-C04: lectura exclusiva de answer_key en el servidor para autocalificacion de intento
        select: { answer_key: true },
      });

      const answerKey = (detailWithKey?.answer_key as unknown as ExamAnswerKey) || { items: {} };
      const scoreResult = this.scoringService.calculateExam(
        config,
        answerKey,
        answers as Record<string, Record<string, string>>,
        durationSeconds,
        minPlausible ?? undefined,
      );

      correction = scoreResult.correction;

      updatedAttempt = await this.prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.graded,
          score: new Prisma.Decimal(scoreResult.score),
          graded_at: now,
          finished_at: now,
          flags: scoreResult.flags,
        },
      });

      newBadges = await this.gamificationService.recordAttemptCompleted(
        organizationId,
        studentId,
        attempt.id,
        scoreResult.score,
      );
    } else {
      // Default / fallback
      updatedAttempt = await this.prisma.attempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.pending_review,
          finished_at: now,
        },
      });
    }

    return {
      attempt: this.mapAttemptView(updatedAttempt, effectiveDueAt, completeUntil),
      correction,
      newBadges,
    };
  }

  /**
   * Lists assignment cards for the student (RF-2).
   */
  async listStudentAssignments(
    organizationId: string,
    studentId: string,
    query: AssignmentCardQueryDto,
  ): Promise<AssignmentCardListResponse> {
    const scope = query.scope || 'available';
    const offset = query.offset || 0;
    const limit = query.limit || 20;

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, organization_id: organizationId },
      include: {
        memberships: {
          where: { left_at: null },
        },
      },
    });

    if (!student) {
      return { items: [], total: 0, offset, limit };
    }

    const now = new Date();
    const activeGroupId = student.memberships[0]?.group_id;

    if (scope === 'available') {
      if (!activeGroupId) {
        return { items: [], total: 0, offset, limit };
      }

      // Check games feature flag
      const gamesEnabled = await this.featureFlagsService.isFeatureEnabled(organizationId, 'games');

      const assignments = await this.prisma.assignment.findMany({
        where: {
          organization_id: organizationId,
          group_id: activeGroupId,
          cancelled_at: null,
          activity: {
            status: ActivityStatus.published,
            ...(gamesEnabled ? {} : { type: { not: ActivityType.game } }),
          },
        },
        include: {
          activity: true,
          attempts: {
            where: { student_id: studentId },
            orderBy: { attempt_number: 'desc' },
            include: { next_attempt: true },
          },
        },
        orderBy: [{ due_at: 'asc' }, { id: 'asc' }],
      });

      const cards: AssignmentCard[] = [];

      for (const a of assignments) {
        const latestAttempt = a.attempts[0] || null;
        const effectiveDueAt = latestAttempt?.retry_extend_until ?? a.due_at;
        const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

        let canStart = false;
        let canContinue = false;
        let retryAvailable = false;

        if (!latestAttempt) {
          canStart = now >= a.opens_at && now <= a.due_at;
        } else if (latestAttempt.status === AttemptStatus.in_progress) {
          canContinue = now <= completeUntil;
        } else {
          // Completed or abandoned attempt
          if (latestAttempt.retry_granted_at !== null && !latestAttempt.next_attempt) {
            retryAvailable = true;
            canStart = now <= effectiveDueAt;
          }
        }

        // Available scope includes cards that can be started, continued, or have a retry available
        if (canStart || canContinue || retryAvailable) {
          cards.push({
            id: a.id,
            activity: {
              id: a.activity.id,
              title: a.activity.title,
              type: a.activity.type,
              level: a.activity.level,
              version: a.activity.version,
            },
            opensAt: a.opens_at.toISOString(),
            dueAt: a.due_at.toISOString(),
            cancelledAt: null,
            effectiveDueAt: effectiveDueAt.toISOString(),
            latestAttempt: latestAttempt
              ? this.mapAttemptView(latestAttempt, effectiveDueAt, completeUntil)
              : null,
            canStart,
            canContinue,
            retryAvailable,
          });
        }
      }

      const total = cards.length;
      const paginated = cards.slice(offset, offset + limit);
      return { items: paginated, total, offset, limit };
    } else {
      // Continuity scope: assignments with student attempts
      const attempts = await this.prisma.attempt.findMany({
        where: {
          student_id: studentId,
          organization_id: organizationId,
        },
        include: {
          assignment: {
            include: { activity: true },
          },
          next_attempt: true,
        },
        orderBy: [{ assignment: { due_at: 'asc' } }, { assignment_id: 'asc' }],
      });

      // Group attempts by assignment
      const assignmentMap = new Map<string, typeof attempts>();
      for (const att of attempts) {
        const list = assignmentMap.get(att.assignment_id) || [];
        list.push(att);
        assignmentMap.set(att.assignment_id, list);
      }

      const cards: AssignmentCard[] = [];

      for (const [, attList] of assignmentMap.entries()) {
        attList.sort((x, y) => y.attempt_number - x.attempt_number);
        const latestAttempt = attList[0];
        if (!latestAttempt) {
          continue;
        }
        const a = latestAttempt.assignment;
        const effectiveDueAt = latestAttempt.retry_extend_until ?? a.due_at;
        const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

        const canContinue =
          latestAttempt.status === AttemptStatus.in_progress && now <= completeUntil;
        const retryAvailable =
          latestAttempt.retry_granted_at !== null && !latestAttempt.next_attempt;
        const canStart = retryAvailable && now <= effectiveDueAt && a.cancelled_at === null;

        cards.push({
          id: a.id,
          activity: {
            id: a.activity.id,
            title: a.activity.title,
            type: a.activity.type,
            level: a.activity.level,
            version: a.activity.version,
          },
          opensAt: a.opens_at.toISOString(),
          dueAt: a.due_at.toISOString(),
          cancelledAt: a.cancelled_at ? a.cancelled_at.toISOString() : null,
          effectiveDueAt: effectiveDueAt.toISOString(),
          latestAttempt: this.mapAttemptView(latestAttempt, effectiveDueAt, completeUntil),
          canStart,
          canContinue,
          retryAvailable,
        });
      }

      cards.sort((x, y) => new Date(x.dueAt).getTime() - new Date(y.dueAt).getTime() || x.id.localeCompare(y.id));
      const total = cards.length;
      const paginated = cards.slice(offset, offset + limit);
      return { items: paginated, total, offset, limit };
    }
  }

  /**
   * Retrieves personal progress for the student (RF-22, Decision 101).
   */
  async getStudentProgress(
    organizationId: string,
    studentId: string,
  ): Promise<StudentProgressView> {
    const attempts = await this.prisma.attempt.findMany({
      where: {
        student_id: studentId,
        organization_id: organizationId,
      },
      orderBy: [{ assignment_id: 'asc' }, { attempt_number: 'desc' }],
    });

    const assignmentLatestGraded = new Map<string, typeof attempts[0]>();
    for (const att of attempts) {
      if (att.status === AttemptStatus.graded && att.score !== null) {
        if (!assignmentLatestGraded.has(att.assignment_id)) {
          assignmentLatestGraded.set(att.assignment_id, att);
        }
      }
    }

    const activities = Array.from(assignmentLatestGraded.values()).map((att) => {
      const numScore = Number(att.score);
      return {
        assignmentId: att.assignment_id,
        attemptId: att.id,
        score: numScore,
        stars: this.scoringService.scoreToStars(numScore),
      };
    });

    const badgeAwards = await this.prisma.badgeAward.findMany({
      where: { student_id: studentId, organization_id: organizationId },
      include: { badge_rule: true },
      orderBy: { awarded_at: 'desc' },
    });

    const badges = badgeAwards.map((b) => ({
      id: b.id,
      key: b.badge_rule.key,
      name: b.badge_rule.name,
      description: b.badge_rule.description,
      icon: b.badge_rule.icon,
      awardedAt: b.awarded_at.toISOString(),
    }));

    const streak = await this.gamificationService.calculateStreak(organizationId, studentId);

    return {
      activities,
      badges,
      streak,
    };
  }

  private generateAttemptToken(
    attemptId: string,
    studentId: string,
    organizationId: string,
    completeUntil: Date,
  ): string {
    const now = Date.now();
    const remainingSeconds = Math.max(1, Math.floor((completeUntil.getTime() - now) / 1000));

    return this.jwtService.sign(
      {
        attemptId,
        studentId,
        organizationId,
      },
      {
        secret: this.jwtSecret,
        expiresIn: `${remainingSeconds}s`,
      },
    );
  }

  private verifyAttemptToken(
    token: string,
    attemptId: string,
    studentId: string,
    organizationId: string,
    completeUntil: Date,
  ): void {
    if (!token) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Token de intento ausente',
      });
    }

    let payload: AttemptTokenPayload;
    try {
      payload = this.jwtService.verify<AttemptTokenPayload>(token, {
        secret: this.jwtSecret,
        ignoreExpiration: true,
      });
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Token de intento alterado o inválido',
      });
    }

    if (
      payload.attemptId !== attemptId ||
      payload.studentId !== studentId ||
      payload.organizationId !== organizationId
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Token de intento discordante',
      });
    }

    // Check expiration against completeUntil
    if (new Date() > completeUntil) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_CLOSED',
        message: 'La ventana de entrega del intento ha expirado',
      });
    }
  }

  private buildRuntimeView(
    attempt: AttemptEntityLike,
    assignment: { activity: ActivityEntityLike },
    effectiveDueAt: Date,
    completeUntil: Date,
    token: string | null,
  ): RuntimeView {
    const activity = assignment.activity;
    let config: unknown = {};

    if (activity.type === ActivityType.fill_blank) {
      config = activity.fill_blank_detail?.config || {};
    } else if (activity.type === ActivityType.open_question) {
      config = activity.open_question_detail?.config || {};
    } else if (activity.type === ActivityType.speaking) {
      config = {
        prompt: activity.speaking_detail?.prompt || '',
        exampleUrl: activity.speaking_detail?.example_url || null,
        minDurationSeconds: activity.speaking_detail?.min_duration_seconds || 2,
        maxDurationSeconds: activity.speaking_detail?.max_duration_seconds || 120,
      };
    } else if (activity.type === ActivityType.exam) {
      config = activity.exam_detail?.config || {};
    }

    const payload = (attempt.payload as { answers?: Record<string, unknown> }) || {};
    const answers = payload.answers || {};

    return {
      attempt: this.mapAttemptView(attempt, effectiveDueAt, completeUntil),
      activity: {
        id: activity.id,
        title: activity.title,
        type: activity.type,
        level: activity.level,
        config,
      },
      answers,
      mediaId: null,
      correction: null,
      attemptToken: token,
    };
  }

  private buildExistingCompletionView(
    attempt: AttemptEntityLike,
    _activity?: ActivityEntityLike,
  ): CompletionView {
    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ?? attempt.assignment?.due_at ?? new Date();
    const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

    return {
      attempt: this.mapAttemptView(attempt, effectiveDueAt, completeUntil),
      correction: null,
      newBadges: [],
    };
  }

  private mapAttemptView(
    attempt: AttemptEntityLike,
    effectiveDueAt: Date,
    completeUntil: Date,
  ): AttemptView {
    return {
      id: attempt.id,
      assignmentId: attempt.assignment_id,
      attemptNumber: attempt.attempt_number,
      previousAttemptId: attempt.previous_attempt_id ?? null,
      status: attempt.status,
      startedAt: attempt.started_at.toISOString(),
      finishedAt: attempt.finished_at ? attempt.finished_at.toISOString() : null,
      gradedAt: attempt.graded_at ? attempt.graded_at.toISOString() : null,
      score: attempt.score !== null ? Number(attempt.score) : null,
      flags: attempt.flags || [],
      effectiveDueAt: effectiveDueAt.toISOString(),
      completeUntil: completeUntil.toISOString(),
    };
  }
}
