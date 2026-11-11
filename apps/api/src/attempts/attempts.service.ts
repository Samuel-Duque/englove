import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  UnprocessableEntityException,
  PayloadTooLargeException,
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
  FillBlankConfigSchema,
  FillBlankAnswerKey,
  FillBlankAnswerKeySchema,
  ExamConfig,
  ExamConfigSchema,
  ExamAnswerKey,
  ExamAnswerKeySchema,
  GameConfig,
  GameConfigSchema,
  GameAnswerKey,
  GameAnswerKeySchema,
  GameMechanic,
  scoreToGameStars,
  getGameMotivationMessage,
  AgeSegment,
  toPublicConfig,
  StudentGameCard,
  StudentGamesListResponse,
  getOpenQuestionItems,
} from '@englove/shared';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function getErrorCode(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.code === 'string') {
    return err.code;
  }
  return undefined;
}

function toPrismaJson(val: unknown): Prisma.InputJsonValue {
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => (item === null ? null : toPrismaJson(item)));
  }
  if (isRecord(val)) {
    const obj: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        obj[k] = v === null ? null : toPrismaJson(v);
      }
    }
    return obj;
  }
  return {};
}

const defaultGameConfig: GameConfig = {
  mechanic: GameMechanic.match,
  settings: { left: [], right: [] },
};

const defaultGameAnswerKey: GameAnswerKey = {
  solution: { pairs: {} },
};

function isGameMechanic(val: unknown): val is GameMechanic {
  return (
    val === GameMechanic.match ||
    val === GameMechanic.order_words ||
    val === GameMechanic.drag_drop ||
    val === GameMechanic.memory ||
    val === GameMechanic.timed_choice
  );
}

function parseAttemptPayload(payload: unknown): {
  answers: Record<string, unknown>;
  processedEventIds: string[];
} {
  if (!isRecord(payload)) {
    return { answers: {}, processedEventIds: [] };
  }
  const answers = isRecord(payload.answers) ? { ...payload.answers } : {};
  const processedEventIds = Array.isArray(payload.processedEventIds)
    ? payload.processedEventIds.filter((id): id is string => typeof id === 'string')
    : [];
  return { answers, processedEventIds };
}

interface AttemptTokenPayload {
  attemptId: string;
  studentId: string;
  organizationId: string;
  typ: 'attempt';
  exp?: number;
}

interface ActivityEntityLike {
  id: string;
  title: string;
  type: ActivityType;
  level: import('@englove/shared').Level;
  min_plausible_seconds?: number | null;
  fill_blank_detail?: { config: unknown } | null;
  open_question_detail?: { config: unknown } | null;
  speaking_detail?: {
    prompt: string;
    example_url?: string | null;
    min_duration_seconds: number;
    max_duration_seconds: number;
  } | null;
  game_detail?: {
    mechanic: string;
    config?: unknown;
    answer_key?: unknown;
  } | null;
  exam_detail?: { config: unknown } | null;
}

interface AttemptEntityLike {
  id: string;
  assignment_id: string | null;
  activity_id?: string | null;
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
  } | null;
  activity?: ActivityEntityLike | null;
  student?: {
    age_segment?: AgeSegment;
  } | null;
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
    this.jwtSecret =
      typeof this.configService.getOrThrow === 'function'
        ? this.configService.getOrThrow<string>('JWT_SECRET')
        : (this.configService.get<string>('JWT_SECRET') ?? '');
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET configuration is missing');
    }
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
      if (assignment.activity.type === ActivityType.game) {
        // Decision 104: For games, if latest is in_progress, prevent duplicate
        if (latestAttempt.status === AttemptStatus.in_progress) {
          throw new ConflictException({
            statusCode: 409,
            code: 'ATTEMPT_ALREADY_EXISTS',
            message: 'Ya existe un intento en curso para este microjuego',
          });
        }
        // Completed/abandoned game within open window: create new individual attempt (attempt_number + 1)
        attemptNumber = latestAttempt.attempt_number + 1;
        previousAttemptId = latestAttempt.id;
        effectiveDueAt = assignment.due_at;
      } else {
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

    // Atomically create Attempt (RF-3, RF-4, Decision 74, 104)
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
      if (getErrorCode(err) === 'P2002') {
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

    let gameAnswerKey: unknown;
    if (assignment.activity.type === ActivityType.game) {
      const gameDetailWithKey = await this.prisma.gameDetail.findFirst({
        where: { organization_id: organizationId, activity_id: assignment.activity.id },
        // guardrails-ignore G-C04: lectura controlada de answer_key para toPublicConfig en RuntimeView de microjuegos (SPEC-06 §4)
        select: { mechanic: true, config: true, answer_key: true },
      });
      gameAnswerKey = gameDetailWithKey?.answer_key;
    }

    return this.buildRuntimeView(
      attempt,
      assignment,
      effectiveDueAt,
      completeUntil,
      token,
      gameAnswerKey,
    );
  }

  /**
   * Lists published microgames for the student with personal practice statistics (RF-01, RF-08).
   */
  async listStudentGames(
    organizationId: string,
    studentId: string,
  ): Promise<StudentGamesListResponse> {
    const gamesEnabled = await this.featureFlagsService.isFeatureEnabled(
      organizationId,
      'games',
    );
    if (!gamesEnabled) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_NOT_AVAILABLE',
        message: 'Los microjuegos están deshabilitados',
      });
    }

    const activities = await this.prisma.activity.findMany({
      where: {
        organization_id: organizationId,
        type: ActivityType.game,
        status: ActivityStatus.published,
      },
      include: {
        game_detail: {
          select: { mechanic: true },
        },
      },
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });

    const actIds = activities.map((a) => a.id);
    const attempts = await this.prisma.attempt.findMany({
      where: {
        organization_id: organizationId,
        student_id: studentId,
        activity_id: { in: actIds },
      },
      orderBy: { attempt_number: 'desc' },
    });

    const attemptsByAct = new Map<string, typeof attempts>();
    for (const att of attempts) {
      if (att.activity_id) {
        const list = attemptsByAct.get(att.activity_id) || [];
        list.push(att);
        attemptsByAct.set(att.activity_id, list);
      }
    }

    const items: StudentGameCard[] = activities.map((act) => {
      const actAttempts = attemptsByAct.get(act.id) || [];
      const attemptsCount = actAttempts.length;
      const latest = actAttempts[0];
      const lastStars = latest?.score != null ? scoreToGameStars(Number(latest.score)) : null;

      let bestScore: number | null = null;
      for (const a of actAttempts) {
        if (a.score != null) {
          const num = Number(a.score);
          if (bestScore === null || num > bestScore) {
            bestScore = num;
          }
        }
      }
      const bestStars = bestScore !== null ? scoreToGameStars(bestScore) : null;

      const inProgressAttempt = actAttempts.find((a) => a.status === AttemptStatus.in_progress);
      let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
      if (inProgressAttempt) {
        status = 'in_progress';
      } else if (attemptsCount > 0) {
        status = 'completed';
      }

      return {
        id: act.id,
        title: act.title,
        mechanic: isGameMechanic(act.game_detail?.mechanic) ? act.game_detail.mechanic : GameMechanic.match,
        level: act.level,
        expectedDurationSeconds: act.expected_duration_seconds,
        minPlausibleSeconds: act.min_plausible_seconds,
        bestStars,
        lastStars,
        bestScore: null,
        bestMaxScore: null,
        attemptsCount,
        lastPlayedAt: latest?.started_at ? latest.started_at.toISOString() : null,
        status,
        inProgressAttemptId: inProgressAttempt ? inProgressAttempt.id : null,
      };
    });

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Starts an autonomous microgame practice attempt without an Assignment (RF-01, Decision 130).
   */
  async startGameAttempt(
    organizationId: string,
    studentId: string,
    activityId: string,
  ): Promise<RuntimeView> {
    const gamesEnabled = await this.featureFlagsService.isFeatureEnabled(
      organizationId,
      'games',
    );
    if (!gamesEnabled) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_NOT_AVAILABLE',
        message: 'Los microjuegos están deshabilitados',
      });
    }

    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        organization_id: organizationId,
      },
      include: {
        game_detail: true,
      },
    });

    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ACTIVITY_NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    if (activity.type !== ActivityType.game || activity.status !== ActivityStatus.published) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_NOT_AVAILABLE',
        message: 'La actividad no es un microjuego publicado',
      });
    }

    // SPEC-11 §5.1 / T4.1: Eliminar intentos previos in_progress sin lanzar 409 para permitir reinicios limpios
    await this.prisma.attempt.deleteMany({
      where: {
        activity_id: activityId,
        student_id: studentId,
        organization_id: organizationId,
        status: AttemptStatus.in_progress,
      },
    });

    const existingAttempts = await this.prisma.attempt.findMany({
      where: {
        activity_id: activityId,
        student_id: studentId,
        organization_id: organizationId,
      },
      orderBy: { attempt_number: 'desc' },
    });

    const latest = existingAttempts[0];

    const now = new Date();
    const attemptNumber = (latest?.attempt_number ?? 0) + 1;
    const previousAttemptId = latest?.id ?? null;

    let attempt;
    try {
      attempt = await this.prisma.attempt.create({
        data: {
          organization_id: organizationId,
          assignment_id: null,
          activity_id: activityId,
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
      if (getErrorCode(err) === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          code: 'ATTEMPT_ALREADY_EXISTS',
          message: 'Ya existe un intento para esta autorización',
        });
      }
      throw err;
    }

    // T4.1 / Decisión 60: Acotar la duración de attemptToken a 24 horas (en lugar de 365 días)
    const effectiveDueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const completeUntil = effectiveDueAt;
    const token = this.generateAttemptToken(attempt.id, studentId, organizationId, completeUntil);

    const gameDetailWithKey = await this.prisma.gameDetail.findFirst({
      where: { organization_id: organizationId, activity_id: activityId },
      // guardrails-ignore G-C04: lectura controlada de answer_key para toPublicConfig en RuntimeView de microjuegos (SPEC-06 §4)
      select: { mechanic: true, config: true, answer_key: true },
    });

    return {
      attempt: this.mapAttemptView(attempt, effectiveDueAt, completeUntil),
      activity: {
        id: activity.id,
        title: activity.title,
        type: activity.type,
        level: activity.level,
        config: toPublicConfig(
          activity.type,
          gameDetailWithKey?.config ?? activity.game_detail?.config ?? {},
          gameDetailWithKey?.answer_key,
        ),
      },
      answers: {},
      mediaId: null,
      correction: null,
      attemptToken: token,
    };
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
        activity: {
          include: {
            fill_blank_detail: true,
            open_question_detail: true,
            speaking_detail: true,
            game_detail: true,
            exam_detail: true,
          },
        },
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
        student: {
          select: {
            age_segment: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento no encontrado',
      });
    }

    const activity = attempt.activity ?? attempt.assignment?.activity;
    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ACTIVITY_NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ??
      attempt.assignment?.due_at ??
      new Date(
        (attempt.started_at instanceof Date ? attempt.started_at : new Date(attempt.started_at)).getTime() +
          24 * 60 * 60 * 1000,
      );
    const completeUntil = attempt.assignment
      ? new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000)
      : effectiveDueAt;

    const isContinuable =
      attempt.status === AttemptStatus.in_progress && new Date() <= completeUntil;

    const token = isContinuable
      ? this.generateAttemptToken(attempt.id, studentId, organizationId, completeUntil)
      : null;

    let gameAnswerKey: unknown;
    if (activity.type === ActivityType.game) {
      const gameDetailWithKey = await this.prisma.gameDetail.findFirst({
        where: { organization_id: organizationId, activity_id: activity.id },
        // guardrails-ignore G-C04: lectura controlada de answer_key para toPublicConfig en RuntimeView de microjuegos (SPEC-06 §4)
        select: { mechanic: true, config: true, answer_key: true },
      });
      gameAnswerKey = gameDetailWithKey?.answer_key;
    }

    return this.buildRuntimeView(
      attempt,
      attempt.assignment ?? { activity },
      effectiveDueAt,
      completeUntil,
      token,
      gameAnswerKey,
    );
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
    const checkDangerousKeys = (obj: unknown, depth = 0) => {
      if (!isRecord(obj) || depth > 5) return;
      for (const [k, val] of Object.entries(obj)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
          throw new UnprocessableEntityException({
            statusCode: 422,
            code: 'INVALID_ACTIVITY_PAYLOAD',
            message: 'Clave no permitida en el evento',
          });
        }
        checkDangerousKeys(val, depth + 1);
      }
    };

    for (const ev of dto.events) {
      if (['__proto__', 'constructor', 'prototype'].includes(ev.itemId)) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          code: 'INVALID_ACTIVITY_PAYLOAD',
          message: 'Clave de evento no permitida',
        });
      }
      if (ev.answer !== undefined && ev.answer !== null) {
        checkDangerousKeys(ev.answer);
        const answerStr = typeof ev.answer === 'string' ? ev.answer : JSON.stringify(ev.answer);
        if (answerStr && answerStr.length > 10000) {
          throw new PayloadTooLargeException({
            statusCode: 413,
            code: 'PAYLOAD_TOO_LARGE',
            message: 'La respuesta del evento supera el tamaño máximo permitido (10 KB)',
          });
        }
      }
    }

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
        activity: {
          include: {
            fill_blank_detail: true,
            open_question_detail: true,
            speaking_detail: true,
            game_detail: true,
            exam_detail: true,
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

    // Validate itemId membership against activity items (RF-4, SPEC-11 §5.2, P1-04)
    const act = attempt.activity ?? attempt.assignment?.activity;
    if (act) {
      const validItemIds = new Set<string>();
      if (act.type === ActivityType.game) {
        ['pairs', 'tokenIds', 'placements', 'selections', 'choices'].forEach((k) =>
          validItemIds.add(k),
        );
      } else if (act.type === ActivityType.open_question) {
        validItemIds.add(act.id);
        const openItems = getOpenQuestionItems(act.open_question_detail?.config, act.id);
        openItems.forEach((item) => validItemIds.add(item.id));
        if (openItems.length <= 1) {
          validItemIds.add('text');
        }
      } else if (act.type === ActivityType.fill_blank && act.fill_blank_detail?.config) {
        const parsed = FillBlankConfigSchema.safeParse(act.fill_blank_detail.config);
        const rawItems = parsed.success
          ? parsed.data.items
          : (isRecord(act.fill_blank_detail.config) && Array.isArray(act.fill_blank_detail.config.items)
            ? act.fill_blank_detail.config.items
            : []);
        for (const it of rawItems) {
          if (isRecord(it)) {
            if (typeof it.id === 'string') validItemIds.add(it.id);
            if (Array.isArray(it.blanks)) {
              for (const b of it.blanks) {
                if (isRecord(b) && typeof b.id === 'string') validItemIds.add(b.id);
              }
            }
          }
        }
      } else if (act.type === ActivityType.exam && act.exam_detail?.config) {
        const parsed = ExamConfigSchema.safeParse(act.exam_detail.config);
        const rawItems = parsed.success
          ? parsed.data.items
          : (isRecord(act.exam_detail.config) && Array.isArray(act.exam_detail.config.items)
            ? act.exam_detail.config.items
            : []);
        for (const it of rawItems) {
          if (isRecord(it)) {
            if (typeof it.id === 'string') validItemIds.add(it.id);
            if (Array.isArray(it.blanks)) {
              for (const b of it.blanks) {
                if (isRecord(b) && typeof b.id === 'string') validItemIds.add(b.id);
              }
            }
          }
        }
      } else if (act.type === ActivityType.speaking) {
        validItemIds.add(act.id);
        validItemIds.add('audio');
      }

      if (validItemIds.size > 0) {
        for (const ev of dto.events) {
          if (!validItemIds.has(ev.itemId)) {
            throw new UnprocessableEntityException({
              statusCode: 422,
              code: 'INVALID_ACTIVITY_PAYLOAD',
              message: `El ítem ${ev.itemId} no pertenece a esta actividad`,
            });
          }
        }
      }
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ??
      attempt.assignment?.due_at ??
      new Date(
        (attempt.started_at instanceof Date ? attempt.started_at : new Date(attempt.started_at)).getTime() +
          24 * 60 * 60 * 1000,
      );
    const completeUntil = attempt.assignment
      ? new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000)
      : effectiveDueAt;

    // Verify token authentic (signature and claims)
    this.verifyAttemptTokenSignature(token, attempt.id, studentId, organizationId);

    // Check expiration and mark offline_sync if late (SPEC-09 RF-16)
    await this.checkLateSubmissionAndMarkOfflineSync(attempt, completeUntil, organizationId);

    if (attempt.status !== AttemptStatus.in_progress) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_IN_PROGRESS',
        message: 'El intento ya no admite cambios',
      });
    }

    // Merge payload atomically: lock the attempt row so concurrent batches never
    // overwrite each other (SPEC-05 RF-7, architecture A70, ENG-074).
    return await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<Array<{ status: string; payload: unknown }>>`
        SELECT status, payload
        FROM attempts
        WHERE id = ${attempt.id}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;
      const locked = lockedRows[0];
      if (!locked || locked.status !== AttemptStatus.in_progress) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ATTEMPT_NOT_IN_PROGRESS',
          message: 'El intento ya no admite cambios',
        });
      }

      const currentPayload = parseAttemptPayload(locked.payload);
      const answers = currentPayload.answers;
      const processedSet = new Set<string>(currentPayload.processedEventIds);
      const acceptedEventIds: string[] = [];

      for (const ev of dto.events) {
        acceptedEventIds.push(ev.clientEventId);
        if (!processedSet.has(ev.clientEventId)) {
          processedSet.add(ev.clientEventId);
          const isGameMap = ['pairs', 'tokenIds', 'placements', 'selections', 'choices'].includes(
            ev.itemId,
          );
          if (!isGameMap && isRecord(ev.answer)) {
            const rawExisting = answers[ev.itemId];
            const existing = isRecord(rawExisting) ? rawExisting : {};
            answers[ev.itemId] = { ...existing, ...ev.answer };
          } else {
            answers[ev.itemId] = ev.answer;
          }
        }
      }

      // Bound processedEventIds buffer to last 500 items FIFO to prevent unbounded memory growth (BUG-01)
      const finalProcessedEventIds = Array.from(processedSet).slice(-500);

      await tx.attempt.update({
        where: { id: attempt.id },
        data: {
          payload: toPrismaJson({
            answers,
            processedEventIds: finalProcessedEventIds,
          }),
        },
      });

      return { acceptedEventIds };
    });
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
        activity: {
          include: {
            fill_blank_detail: true,
            open_question_detail: true,
            speaking_detail: true,
            game_detail: true,
            exam_detail: true,
          },
        },
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
        student: {
          select: {
            age_segment: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Intento no encontrado',
      });
    }

    const activity = attempt.activity ?? attempt.assignment?.activity;
    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'ACTIVITY_NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ??
      attempt.assignment?.due_at ??
      new Date(
        (attempt.started_at instanceof Date ? attempt.started_at : new Date(attempt.started_at)).getTime() +
          24 * 60 * 60 * 1000,
      );
    const completeUntil = attempt.assignment
      ? new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000)
      : effectiveDueAt;

    // Verify token authentic (signature and claims)
    this.verifyAttemptTokenSignature(token, attempt.id, studentId, organizationId);

    // If already finished and within tolerance: idempotent return of completion receipt (RF-8, P2-04)
    if (
      attempt.status === AttemptStatus.graded ||
      attempt.status === AttemptStatus.pending_review
    ) {
      return await this.buildExistingCompletionView(organizationId, attempt, activity);
    }

    // Check expiration and mark offline_sync if late (SPEC-09 RF-16)
    if (attempt.assignment_id !== null) {
      await this.checkLateSubmissionAndMarkOfflineSync(attempt, completeUntil, organizationId);
    }

    if (attempt.status !== AttemptStatus.in_progress) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_NOT_IN_PROGRESS',
        message: 'El intento ya no admite cambios',
      });
    }

    // Validate dto.answers (P1-04, RF-4.2)
    if (dto.answers) {
      const checkDangerousKeys = (obj: unknown, depth = 0) => {
        if (!isRecord(obj) || depth > 5) return;
        for (const [k, val] of Object.entries(obj)) {
          if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
            throw new UnprocessableEntityException({
              statusCode: 422,
              code: 'INVALID_ACTIVITY_PAYLOAD',
              message: 'Clave de respuesta no permitida',
            });
          }
          checkDangerousKeys(val, depth + 1);
        }
      };
      checkDangerousKeys(dto.answers);
      if (Object.keys(dto.answers).length > 100) {
        throw new PayloadTooLargeException({
          statusCode: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Demasiadas respuestas enviadas (máximo 100)',
        });
      }
      const answersJson = JSON.stringify(dto.answers);
      if (answersJson.length > 65536) {
        throw new PayloadTooLargeException({
          statusCode: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Las respuestas superan el tamaño máximo permitido (64 KB)',
        });
      }
    }

    // Speaking activity pre-validation & upload confirmation
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
    }

    // Atomic transaction with SELECT ... FOR UPDATE (P1-06, SEC-09d)
    const txResult = await this.prisma.$transaction(async (tx) => {
      // guardrails-ignore G-A06: Bloqueo transaccional anti-carrera P1-06 para completeAttempt
      const lockedRows = await tx.$queryRaw<Array<{
        id: string;
        status: AttemptStatus;
        payload: unknown;
        started_at: Date;
        finished_at: Date | null;
        graded_at: Date | null;
        score: Prisma.Decimal | null;
        flags: string[];
        attempt_number: number;
        assignment_id: string | null;
        activity_id: string | null;
        previous_attempt_id: string | null;
      }>>`
        SELECT id, status, payload, started_at, finished_at, graded_at, score, flags, attempt_number, assignment_id, activity_id, previous_attempt_id
        FROM attempts
        WHERE id = ${attempt.id}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;
      const locked = lockedRows[0];
      if (!locked) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'ATTEMPT_NOT_FOUND',
          message: 'Intento no encontrado',
        });
      }

      // Check if another concurrent request completed this attempt while waiting for the lock
      if (
        locked.status === AttemptStatus.graded ||
        locked.status === AttemptStatus.pending_review
      ) {
        const mergedAttempt = { ...attempt, ...locked };
        const view = await this.buildExistingCompletionView(
          organizationId,
          mergedAttempt,
          activity,
          tx,
        );
        return { isExisting: true, view, updatedAttempt: null, correction: null, scoreForEvent: null, isAudioSubmitted: false, isGame: false };
      }

      if (locked.status !== AttemptStatus.in_progress) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ATTEMPT_NOT_IN_PROGRESS',
          message: 'El intento ya no admite cambios',
        });
      }

      const now = new Date();
      const startedAt = locked.started_at ? new Date(locked.started_at) : attempt.started_at;
      const durationSeconds = Math.max(
        0,
        Math.round((now.getTime() - startedAt.getTime()) / 1000),
      );
      const minPlausible =
        activity.min_plausible_seconds ?? (activity.type === ActivityType.game ? 15 : undefined);

      const lockedPayload = parseAttemptPayload(locked.payload);
      const attemptPayload = parseAttemptPayload(attempt.payload);

      const payload = {
        answers: {
          ...attemptPayload.answers,
          ...lockedPayload.answers,
        },
        processedEventIds: Array.from(
          new Set([
            ...attemptPayload.processedEventIds,
            ...lockedPayload.processedEventIds,
          ]),
        ),
      };
      const answers = {
        ...payload.answers,
        ...(dto.answers || {}),
      };
      const updatedPayload = {
        ...payload,
        answers,
      };

      let updatedAttempt;
      let correction: Record<string, unknown> | null = null;
      let scoreForEvent: number | null = null;
      let isAudioSubmitted = false;

      if (activity.type === ActivityType.speaking) {
        updatedAttempt = await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            payload: toPrismaJson(updatedPayload),
            status: AttemptStatus.pending_review,
            finished_at: now,
          },
        });
        isAudioSubmitted = true;
      } else if (activity.type === ActivityType.open_question) {
        updatedAttempt = await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            payload: toPrismaJson(updatedPayload),
            status: AttemptStatus.pending_review,
            finished_at: now,
          },
        });
        scoreForEvent = null;
      } else if (activity.type === ActivityType.fill_blank) {
        const parsedCfg = FillBlankConfigSchema.safeParse(activity.fill_blank_detail?.config);
        const config: FillBlankConfig = parsedCfg.success ? parsedCfg.data : { items: [] };
        const detailWithKey = await tx.fillBlankDetail.findFirst({
          where: { organization_id: organizationId, activity_id: activity.id },
          // guardrails-ignore G-C04: lectura exclusiva de answer_key en el servidor para autocalificacion de intento
          select: { answer_key: true },
        });

        const parsedKey = FillBlankAnswerKeySchema.safeParse(detailWithKey?.answer_key);
        const answerKey: FillBlankAnswerKey = parsedKey.success ? parsedKey.data : { items: {} };
        const scoreResult = this.scoringService.calculateFillBlank(
          config,
          answerKey,
          answers,
          durationSeconds,
          minPlausible ?? undefined,
        );

        correction = scoreResult.correction;
        scoreForEvent = scoreResult.score;

        updatedAttempt = await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            payload: toPrismaJson(updatedPayload),
            status: AttemptStatus.graded,
            score: new Prisma.Decimal(scoreResult.score),
            graded_at: now,
            finished_at: now,
            flags: scoreResult.flags,
          },
        });
      } else if (activity.type === ActivityType.exam) {
        const parsedCfg = ExamConfigSchema.safeParse(activity.exam_detail?.config);
        const config: ExamConfig = parsedCfg.success ? parsedCfg.data : { items: [] };
        const detailWithKey = await tx.examDetail.findFirst({
          where: { organization_id: organizationId, activity_id: activity.id },
          // guardrails-ignore G-C04: lectura exclusiva de answer_key en el servidor para autocalificacion de intento
          select: { answer_key: true },
        });

        const parsedKey = ExamAnswerKeySchema.safeParse(detailWithKey?.answer_key);
        const answerKey: ExamAnswerKey = parsedKey.success ? parsedKey.data : { items: {} };
        const examAnswers: Record<string, Record<string, string>> = {};
        for (const [k, v] of Object.entries(answers)) {
          if (isRecord(v)) {
            const inner: Record<string, string> = {};
            for (const [ik, iv] of Object.entries(v)) {
              if (typeof iv === 'string') inner[ik] = iv;
            }
            examAnswers[k] = inner;
          }
        }
        const scoreResult = this.scoringService.calculateExam(
          config,
          answerKey,
          examAnswers,
          durationSeconds,
          minPlausible ?? undefined,
        );

        correction = scoreResult.correction;
        scoreForEvent = scoreResult.score;

        updatedAttempt = await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            payload: toPrismaJson(updatedPayload),
            status: AttemptStatus.graded,
            score: new Prisma.Decimal(scoreResult.score),
            graded_at: now,
            finished_at: now,
            flags: scoreResult.flags,
          },
        });
      } else if (activity.type === ActivityType.game) {
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

        const detailWithKey = await tx.gameDetail.findFirst({
          where: { organization_id: organizationId, activity_id: activity.id },
          // guardrails-ignore G-C04: lectura exclusiva de answer_key en el servidor para autocalificacion de intento
          select: { mechanic: true, config: true, answer_key: true },
        });

        const parsedGameCfg = GameConfigSchema.safeParse(detailWithKey?.config);
        const config: GameConfig = parsedGameCfg.success
          ? parsedGameCfg.data
          : defaultGameConfig;
        const parsedKey = GameAnswerKeySchema.safeParse(detailWithKey?.answer_key);
        const answerKey: GameAnswerKey = parsedKey.success ? parsedKey.data : defaultGameAnswerKey;

        const scoreResult = this.scoringService.calculateGame(
          config,
          answerKey,
          answers,
          durationSeconds,
          minPlausible ?? 15,
        );

        correction = scoreResult.correction;
        const stars = scoreToGameStars(scoreResult.score);
        const gamePayload = {
          ...updatedPayload,
          stars,
          score: scoreResult.score,
        };

        updatedAttempt = await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            payload: toPrismaJson(gamePayload),
            status: AttemptStatus.graded,
            score: new Prisma.Decimal(scoreResult.score),
            graded_at: now,
            finished_at: now,
            flags: scoreResult.flags,
          },
        });
      } else {
        // Default / fallback
        updatedAttempt = await tx.attempt.update({
          where: { id: attempt.id },
          data: {
            status: AttemptStatus.pending_review,
            finished_at: now,
          },
        });
      }

      return {
        isExisting: false,
        view: null,
        updatedAttempt,
        correction,
        scoreForEvent,
        isAudioSubmitted,
        isGame: activity.type === ActivityType.game,
      };
    });

    if (txResult.isExisting && txResult.view) {
      return txResult.view;
    }

    let newBadges: import('@englove/shared').BadgeAwardView[] = [];
    if (txResult.isAudioSubmitted) {
      newBadges = await this.gamificationService.recordAudioSubmitted(
        organizationId,
        studentId,
        attempt.id,
      );
    } else if (txResult.isGame) {
      // P0-10: Restaurar ProgressEvent en microjuegos autónomos pasando score=null para alimentar rachas e insignias sin alterar notas
      newBadges = await this.gamificationService.recordAttemptCompleted(
        organizationId,
        studentId,
        attempt.id,
        null,
      );
    } else if (txResult.scoreForEvent !== undefined) {
      newBadges = await this.gamificationService.recordAttemptCompleted(
        organizationId,
        studentId,
        attempt.id,
        txResult.scoreForEvent,
      );
    }

    return {
      attempt: this.mapAttemptView(
        {
          ...txResult.updatedAttempt!,
          student: attempt.student,
          activity: attempt.activity,
          assignment: attempt.assignment,
        },
        effectiveDueAt,
        completeUntil,
      ),
      correction: txResult.correction ?? null,
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
          activity: {
            include: {
              game_detail: {
                select: { mechanic: true },
              },
            },
          },
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
          if (a.activity.type === ActivityType.game && gamesEnabled) {
            canStart = now >= a.opens_at && now <= effectiveDueAt;
          } else if (latestAttempt.retry_granted_at !== null && !latestAttempt.next_attempt) {
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
              mechanic: isGameMechanic(a.activity.game_detail?.mechanic) ? a.activity.game_detail.mechanic : undefined,
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
      const gamesEnabled = await this.featureFlagsService.isFeatureEnabled(organizationId, 'games');

      const attempts = await this.prisma.attempt.findMany({
        where: {
          student_id: studentId,
          organization_id: organizationId,
        },
        include: {
          assignment: {
            include: {
              activity: {
                include: {
                  game_detail: {
                    select: { mechanic: true },
                  },
                },
              },
            },
          },
          next_attempt: true,
        },
        orderBy: [{ assignment: { due_at: 'asc' } }, { assignment_id: 'asc' }],
      });

      // Group attempts by assignment
      const assignmentMap = new Map<string, typeof attempts>();
      for (const att of attempts) {
        if (!att.assignment_id || !att.assignment) {
          continue;
        }
        const list = assignmentMap.get(att.assignment_id) || [];
        list.push(att);
        assignmentMap.set(att.assignment_id, list);
      }

      const cards: AssignmentCard[] = [];

      for (const [, attList] of assignmentMap.entries()) {
        attList.sort((x, y) => y.attempt_number - x.attempt_number);
        const latestAttempt = attList[0];
        if (!latestAttempt || !latestAttempt.assignment) {
          continue;
        }
        const a = latestAttempt.assignment;
        const effectiveDueAt = latestAttempt.retry_extend_until ?? a.due_at;
        const completeUntil = new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000);

        const isActivityPublished = a.activity.status !== ActivityStatus.archived && a.activity.status !== ActivityStatus.draft;

        const canContinue = isActivityPublished &&
          latestAttempt.status === AttemptStatus.in_progress && now <= completeUntil;
        const retryAvailable =
          latestAttempt.retry_granted_at !== null && !latestAttempt.next_attempt;

        const canStart =
          isActivityPublished &&
          (a.activity.type === ActivityType.game && gamesEnabled
            ? latestAttempt.status !== AttemptStatus.in_progress &&
              now >= a.opens_at &&
              now <= effectiveDueAt &&
              a.cancelled_at === null
            : retryAvailable && now <= effectiveDueAt && a.cancelled_at === null);

        cards.push({
          id: a.id,
          activity: {
            id: a.activity.id,
            title: a.activity.title,
            type: a.activity.type,
            level: a.activity.level,
            version: a.activity.version,
            mechanic: isGameMechanic(a.activity.game_detail?.mechanic) ? a.activity.game_detail.mechanic : undefined,
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
      include: {
        assignment: {
          include: {
            activity: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: [{ assignment_id: 'asc' }, { attempt_number: 'desc' }],
    });

    const assignmentLatestGraded = new Map<string, typeof attempts[0]>();
    for (const att of attempts) {
      if (att.assignment_id && att.status === AttemptStatus.graded && att.score !== null) {
        if (!assignmentLatestGraded.has(att.assignment_id)) {
          assignmentLatestGraded.set(att.assignment_id, att);
        }
      }
    }

    const activities = Array.from(assignmentLatestGraded.values()).map((att) => {
      const numScore = Number(att.score);
      return {
        assignmentId: att.assignment_id!,
        attemptId: att.id,
        activityTitle: att.assignment?.activity?.title,
        attemptNumber: att.attempt_number,
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
    const remainingSeconds = Math.max(1, Math.round((completeUntil.getTime() - now) / 1000));

    return this.jwtService.sign(
      {
        attemptId,
        studentId,
        organizationId,
        typ: 'attempt',
      },
      {
        secret: this.jwtSecret,
        expiresIn: `${remainingSeconds}s`,
      },
    );
  }

  public verifyAttemptTokenSignature(
    token: string,
    attemptId: string,
    studentId: string,
    organizationId: string,
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
      payload.organizationId !== organizationId ||
      payload.typ !== 'attempt'
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'Token de intento discordante o tipo inválido',
      });
    }
  }

  /**
   * Helper that checks if submission is past completeUntil and marks offline_sync if applicable (SPEC-09 RF-16).
   */
  private async checkLateSubmissionAndMarkOfflineSync(
    attempt: { id: string; status: AttemptStatus; flags: string[] },
    completeUntil: Date,
    _organizationId: string,
  ): Promise<void> {
    if (new Date() > completeUntil) {
      if (
        attempt.status === AttemptStatus.in_progress ||
        attempt.status === AttemptStatus.abandoned
      ) {
        const currentFlags = attempt.flags || [];
        const newFlags = currentFlags.includes('offline_sync')
          ? currentFlags
          : [...currentFlags, 'offline_sync'];

        await this.prisma.attempt.update({
          where: { id: attempt.id },
          data: {
            status: AttemptStatus.abandoned,
            flags: newFlags,
          },
        });
      }

      throw new ConflictException({
        statusCode: 409,
        code: 'ATTEMPT_CLOSED',
        message: 'La actividad ya está cerrada',
      });
    }
  }

  private buildRuntimeView(
    attempt: AttemptEntityLike,
    assignment: { activity: ActivityEntityLike },
    effectiveDueAt: Date,
    completeUntil: Date,
    token: string | null,
    gameAnswerKey?: unknown,
  ): RuntimeView {
    const activity = assignment.activity;
    let rawConfig: unknown = {};
    let answerKey: unknown = undefined;

    if (activity.type === ActivityType.fill_blank) {
      rawConfig = activity.fill_blank_detail?.config || {};
    } else if (activity.type === ActivityType.open_question) {
      rawConfig = activity.open_question_detail?.config || {};
    } else if (activity.type === ActivityType.speaking) {
      rawConfig = {
        prompt: activity.speaking_detail?.prompt || '',
        exampleUrl: activity.speaking_detail?.example_url || null,
        minDurationSeconds: activity.speaking_detail?.min_duration_seconds || 2,
        maxDurationSeconds: activity.speaking_detail?.max_duration_seconds || 120,
      };
    } else if (activity.type === ActivityType.exam) {
      rawConfig = activity.exam_detail?.config || {};
    } else if (activity.type === ActivityType.game) {
      rawConfig = activity.game_detail?.config || {};
      answerKey = gameAnswerKey ?? activity.game_detail?.answer_key;
    }

    const config = toPublicConfig(activity.type, rawConfig, answerKey);

    const currentPayload = parseAttemptPayload(attempt.payload);
    const answers = currentPayload.answers;

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

  private async buildExistingCompletionView(
    organizationId: string,
    attempt: AttemptEntityLike,
    activity?: ActivityEntityLike,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<CompletionView> {
    const effectiveDueAt =
      attempt.previous_attempt?.retry_extend_until ??
      attempt.assignment?.due_at ??
      new Date(
        (attempt.started_at instanceof Date ? attempt.started_at : new Date(attempt.started_at)).getTime() +
          24 * 60 * 60 * 1000,
      );
    const completeUntil = attempt.assignment
      ? new Date(effectiveDueAt.getTime() + 24 * 60 * 60 * 1000)
      : effectiveDueAt;

    let correction: Record<string, unknown> | null = null;
    if (activity && attempt.status === AttemptStatus.graded) {
      const currentPayload = parseAttemptPayload(attempt.payload);
      const answers = currentPayload.answers;
      const started = attempt.started_at ? new Date(attempt.started_at) : null;
      const finished = attempt.finished_at ? new Date(attempt.finished_at) : null;
      const durationSeconds =
        finished && started
          ? Math.max(0, Math.round((finished.getTime() - started.getTime()) / 1000))
          : 0;

      if (activity.type === ActivityType.fill_blank) {
        const detailWithKey = await prismaClient.fillBlankDetail.findFirst({
          where: { organization_id: organizationId, activity_id: activity.id },
          // guardrails-ignore G-C04: lectura de answer_key en el servidor para reconstruccion de correction
          select: { config: true, answer_key: true },
        });
        if (detailWithKey?.answer_key) {
          const parsedCfg = FillBlankConfigSchema.safeParse(detailWithKey.config ?? activity.fill_blank_detail?.config);
          const config: FillBlankConfig = parsedCfg.success ? parsedCfg.data : { items: [] };
          const parsedKey = FillBlankAnswerKeySchema.safeParse(detailWithKey.answer_key);
          const ak: FillBlankAnswerKey = parsedKey.success ? parsedKey.data : { items: {} };
          const res = this.scoringService.calculateFillBlank(
            config,
            ak,
            answers,
            durationSeconds,
            activity.min_plausible_seconds ?? undefined,
          );
          correction = res.correction;
        }
      } else if (activity.type === ActivityType.exam) {
        const detailWithKey = await prismaClient.examDetail.findFirst({
          where: { organization_id: organizationId, activity_id: activity.id },
          // guardrails-ignore G-C04: lectura de answer_key en el servidor para reconstruccion de correction
          select: { config: true, answer_key: true },
        });
        if (detailWithKey?.answer_key) {
          const parsedCfg = ExamConfigSchema.safeParse(detailWithKey.config ?? activity.exam_detail?.config);
          const config: ExamConfig = parsedCfg.success ? parsedCfg.data : { items: [] };
          const parsedKey = ExamAnswerKeySchema.safeParse(detailWithKey.answer_key);
          const ak: ExamAnswerKey = parsedKey.success ? parsedKey.data : { items: {} };
          const examAnswers: Record<string, Record<string, string>> = {};
          for (const [k, v] of Object.entries(answers)) {
            if (isRecord(v)) {
              const inner: Record<string, string> = {};
              for (const [ik, iv] of Object.entries(v)) {
                if (typeof iv === 'string') inner[ik] = iv;
              }
              examAnswers[k] = inner;
            }
          }
          const res = this.scoringService.calculateExam(
            config,
            ak,
            examAnswers,
            durationSeconds,
            activity.min_plausible_seconds ?? undefined,
          );
          correction = res.correction;
        }
      } else if (activity.type === ActivityType.game) {
        const detailWithKey = await prismaClient.gameDetail.findFirst({
          where: { organization_id: organizationId, activity_id: activity.id },
          // guardrails-ignore G-C04: lectura de answer_key en el servidor para reconstruccion de correction
          select: { mechanic: true, config: true, answer_key: true },
        });
        if (detailWithKey?.answer_key) {
          const parsedGameCfg = GameConfigSchema.safeParse(detailWithKey.config);
          const cfg: GameConfig = parsedGameCfg.success
            ? parsedGameCfg.data
            : defaultGameConfig;
          const parsedKey = GameAnswerKeySchema.safeParse(detailWithKey.answer_key);
          const ak: GameAnswerKey = parsedKey.success ? parsedKey.data : defaultGameAnswerKey;
          const res = this.scoringService.calculateGame(
            cfg,
            ak,
            answers,
            durationSeconds,
            activity.min_plausible_seconds ?? 15,
          );
          correction = res.correction;
        }
      }
    }

    return {
      attempt: this.mapAttemptView(attempt, effectiveDueAt, completeUntil),
      correction,
      newBadges: [],
    };
  }

  private mapAttemptView(
    attempt: AttemptEntityLike,
    effectiveDueAt: Date,
    completeUntil: Date,
  ): AttemptView {
    const toIso = (d: Date | string | null | undefined): string | null => {
      if (!d) return null;
      return (d instanceof Date ? d : new Date(d)).toISOString();
    };

    const isGame = Boolean(
      attempt.activity_id ||
        attempt.activity?.type === ActivityType.game ||
        attempt.assignment?.activity?.type === ActivityType.game,
    );
    const numericScore = attempt.score !== null ? Number(attempt.score) : null;
    const stars = isGame && numericScore !== null ? scoreToGameStars(numericScore) : undefined;
    const studentAgeSegment = attempt.student?.age_segment;
    const motivationMessage =
      isGame && numericScore !== null
        ? getGameMotivationMessage(numericScore, studentAgeSegment)
        : undefined;

    return {
      id: attempt.id,
      assignmentId: attempt.assignment_id ?? null,
      activityId: attempt.activity_id ?? null,
      attemptNumber: attempt.attempt_number,
      previousAttemptId: attempt.previous_attempt_id ?? null,
      status: attempt.status,
      startedAt: (attempt.started_at instanceof Date ? attempt.started_at : new Date(attempt.started_at)).toISOString(),
      finishedAt: toIso(attempt.finished_at),
      gradedAt: toIso(attempt.graded_at),
      score: isGame ? null : numericScore,
      stars,
      motivationMessage,
      flags: attempt.flags || [],
      effectiveDueAt: (effectiveDueAt instanceof Date ? effectiveDueAt : new Date(effectiveDueAt)).toISOString(),
      completeUntil: (completeUntil instanceof Date ? completeUntil : new Date(completeUntil)).toISOString(),
    };
  }
}
