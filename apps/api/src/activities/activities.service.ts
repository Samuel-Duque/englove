import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivityStatus,
  ActivityType,
  ActivitySummary,
  ActivityEditor,
  ActivityListResponse,
  resolveActivityDurations,
  validateActivityPayload,
  ActivityValidationError,
  GameConfig,
} from '@englove/shared';
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityQueryDto,
} from './dto/activities.dto';

interface ActivityWithDetails {
  id: string;
  organization_id: string;
  type: ActivityType;
  level: ActivitySummary['level'];
  title: string;
  status: ActivityStatus;
  version: number;
  parent_id: string | null;
  expected_duration_seconds: number | null;
  min_plausible_seconds: number | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  fill_blank_detail?: { config: unknown; answer_key: unknown } | null;
  open_question_detail?: { config: unknown } | null;
  speaking_detail?: {
    prompt: string;
    example_url: string | null;
    min_duration_seconds: number;
    max_duration_seconds: number;
  } | null;
  game_detail?: { mechanic: unknown; config: unknown; answer_key: unknown } | null;
  exam_detail?: { config: unknown; answer_key: unknown } | null;
}

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private toActivitySummary(activity: {
    id: string;
    title: string;
    type: ActivityType;
    level: ActivitySummary['level'];
    status: ActivityStatus;
    version: number;
    parent_id: string | null;
    created_at: Date;
    updated_at: Date;
  }): ActivitySummary {
    return {
      id: activity.id,
      title: activity.title,
      type: activity.type,
      level: activity.level,
      status: activity.status,
      version: activity.version,
      parentId: activity.parent_id,
      createdAt: activity.created_at.toISOString(),
      updatedAt: activity.updated_at.toISOString(),
    };
  }

  private extractConfigAndKey(activity: ActivityWithDetails): {
    config: unknown;
    answerKey?: unknown;
  } {
    switch (activity.type) {
      case ActivityType.fill_blank:
        return {
          config: activity.fill_blank_detail?.config ?? {},
          answerKey: activity.fill_blank_detail?.answer_key,
        };
      case ActivityType.open_question:
        return {
          config: activity.open_question_detail?.config ?? {},
        };
      case ActivityType.speaking:
        return {
          config: {
            prompt: activity.speaking_detail?.prompt ?? '',
            exampleUrl: activity.speaking_detail?.example_url ?? undefined,
            minDurationSeconds: activity.speaking_detail?.min_duration_seconds ?? 2,
            maxDurationSeconds: activity.speaking_detail?.max_duration_seconds ?? 120,
          },
        };
      case ActivityType.game:
        return {
          config: activity.game_detail?.config ?? {},
          answerKey: activity.game_detail?.answer_key,
        };
      case ActivityType.exam:
        return {
          config: activity.exam_detail?.config ?? { items: [] },
          answerKey: activity.exam_detail?.answer_key,
        };
      default:
        return { config: {} };
    }
  }

  private toActivityEditor(
    activity: ActivityWithDetails,
    weightsAdjusted: boolean = false,
  ): ActivityEditor {
    const { config, answerKey } = this.extractConfigAndKey(activity);
    return {
      ...this.toActivitySummary(activity),
      expectedDurationSeconds: activity.expected_duration_seconds,
      minPlausibleSeconds: activity.min_plausible_seconds,
      config,
      ...(answerKey !== undefined ? { answerKey } : {}),
      weightsAdjusted,
    };
  }

  private validateActivityContent(
    type: ActivityType,
    config: unknown,
    answerKey: unknown,
    isPublishing: boolean = false,
  ): { validConfig: unknown; validAnswerKey?: unknown; weightsAdjusted: boolean } {
    try {
      return validateActivityPayload(type, config, answerKey, isPublishing);
    } catch (err: unknown) {
      if (err instanceof ActivityValidationError) {
        if (err.code === 'EXAM_MIN_ITEMS') {
          throw new ConflictException({
            statusCode: 409,
            code: 'EXAM_MIN_ITEMS',
            message: err.message,
          });
        }
        throw new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: err.message,
        });
      }
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: err instanceof Error ? err.message : 'Error en validación de contenido',
      });
    }
  }

  async listActivities(
    organizationId: string,
    query: ActivityQueryDto,
  ): Promise<ActivityListResponse> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {
      organization_id: organizationId,
    };

    if (query.level) {
      where.level = query.level;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    } else {
      // Default: active catalogue (draft and published, Decision 95, SPEC-03 §5)
      where.status = { in: [ActivityStatus.draft, ActivityStatus.published] };
    }

    const [total, items] = await Promise.all([
      this.prisma.activity.count({
        where: {
          organization_id: organizationId,
          ...where,
        },
      }),
      this.prisma.activity.findMany({
        where: {
          organization_id: organizationId,
          ...where,
        },
        orderBy: [{ updated_at: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => this.toActivitySummary(item)),
      total,
      offset,
      limit,
    };
  }

  async getActivity(organizationId: string, id: string): Promise<ActivityEditor> {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        fill_blank_detail: {
          select: { config: true, answer_key: true },
        },
        open_question_detail: {
          select: { config: true },
        },
        speaking_detail: true,
        game_detail: {
          select: { mechanic: true, config: true, answer_key: true },
        },
        exam_detail: {
          select: { config: true, answer_key: true },
        },
      },
    });

    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    return this.toActivityEditor(activity as unknown as ActivityWithDetails, false);
  }

  async createActivity(
    organizationId: string,
    userId: string,
    dto: CreateActivityDto,
  ): Promise<ActivityEditor> {
    const trimmedTitle = dto.title.trim();
    if (trimmedTitle.length < 1 || trimmedTitle.length > 100) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El título debe tener entre 1 y 100 caracteres',
      });
    }

    const { validConfig, validAnswerKey, weightsAdjusted } = this.validateActivityContent(
      dto.type,
      dto.config,
      dto.answerKey,
      false,
    );

    let durations;
    try {
      durations = resolveActivityDurations(dto.type, validConfig, {
        expectedDurationSeconds: dto.expectedDurationSeconds,
        minPlausibleSeconds: dto.minPlausibleSeconds,
      });
    } catch (err: unknown) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: err instanceof Error ? err.message : 'Error en validación de duraciones',
      });
    }

    const createdActivity = await this.prisma.$transaction(async (tx) => {
      const act = await tx.activity.create({
        data: {
          organization_id: organizationId,
          title: trimmedTitle,
          type: dto.type,
          level: dto.level,
          status: ActivityStatus.draft,
          version: 1,
          parent_id: null,
          created_by: userId,
          expected_duration_seconds: durations.expectedDurationSeconds,
          min_plausible_seconds: durations.minPlausibleSeconds,
        },
      });

      switch (dto.type) {
        case ActivityType.fill_blank:
          await tx.fillBlankDetail.create({
            data: {
              organization_id: organizationId,
              activity_id: act.id,
              config: validConfig as object,
              answer_key: (validAnswerKey ?? {}) as object,
            },
          });
          break;

        case ActivityType.open_question:
          await tx.openQuestionDetail.create({
            data: {
              organization_id: organizationId,
              activity_id: act.id,
              config: validConfig as object,
            },
          });
          break;

        case ActivityType.speaking: {
          const spkConfig = validConfig as {
            prompt: string;
            exampleUrl?: string;
            minDurationSeconds: number;
            maxDurationSeconds: number;
          };
          await tx.speakingDetail.create({
            data: {
              organization_id: organizationId,
              activity_id: act.id,
              prompt: spkConfig.prompt,
              example_url: spkConfig.exampleUrl ?? null,
              min_duration_seconds: spkConfig.minDurationSeconds,
              max_duration_seconds: spkConfig.maxDurationSeconds,
            },
          });
          break;
        }

        case ActivityType.game: {
          const gameConfig = validConfig as GameConfig;
          await tx.gameDetail.create({
            data: {
              organization_id: organizationId,
              activity_id: act.id,
              mechanic: gameConfig.mechanic,
              config: validConfig as object,
              answer_key: (validAnswerKey ?? {}) as object,
            },
          });
          break;
        }

        case ActivityType.exam:
          await tx.examDetail.create({
            data: {
              organization_id: organizationId,
              activity_id: act.id,
              config: validConfig as object,
              answer_key: (validAnswerKey ?? {}) as object,
            },
          });
          break;
      }

      return act;
    });

    return this.getActivity(organizationId, createdActivity.id).then((editor) => ({
      ...editor,
      weightsAdjusted,
    }));
  }

  async updateActivity(
    organizationId: string,
    id: string,
    dto: UpdateActivityDto,
  ): Promise<ActivityEditor> {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        fill_blank_detail: { select: { config: true, answer_key: true } },
        open_question_detail: { select: { config: true } },
        speaking_detail: true,
        game_detail: { select: { mechanic: true, config: true, answer_key: true } },
        exam_detail: { select: { config: true, answer_key: true } },
      },
    });

    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    if (activity.status === ActivityStatus.archived) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_NOT_EDITABLE',
        message: 'Esta actividad está archivada. Restáurala al catálogo o duplícala para editarla',
      });
    }

    const attemptCount = await this.prisma.attempt.count({
      where: {
        organization_id: organizationId,
        assignment: {
          activity_id: id,
        },
      },
    });

    if (attemptCount > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_HAS_ATTEMPTS',
        message: 'No se puede editar una actividad que ya tiene intentos de alumnos. Duplícala para crear una nueva versión editable.',
      });
    }

    const hasAnyField =
      dto.title !== undefined ||
      dto.level !== undefined ||
      dto.config !== undefined ||
      dto.answerKey !== undefined ||
      dto.expectedDurationSeconds !== undefined ||
      dto.minPlausibleSeconds !== undefined;

    if (!hasAnyField) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe proporcionar al menos un campo para actualizar',
      });
    }

    if (
      (activity.type === ActivityType.fill_blank ||
        activity.type === ActivityType.exam ||
        activity.type === ActivityType.game) &&
      ((dto.config !== undefined && dto.answerKey === undefined) ||
        (dto.config === undefined && dto.answerKey !== undefined))
    ) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Debe proporcionar conjuntamente config y answerKey para modificar el contenido',
      });
    }

    if (activity.type === ActivityType.game && dto.config !== undefined) {
      const existingMechanic = activity.game_detail?.mechanic;
      const newMechanic = (dto.config as Record<string, unknown>)?.['mechanic'];
      if (newMechanic && existingMechanic && newMechanic !== existingMechanic) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'No se puede cambiar la mecánica de un microjuego existente',
        });
      }
    }

    let trimmedTitle: string | undefined = undefined;
    if (dto.title !== undefined) {
      trimmedTitle = dto.title.trim();
      if (trimmedTitle.length < 1 || trimmedTitle.length > 100) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'El título debe tener entre 1 y 100 caracteres',
        });
      }
    }

    const isPublished = activity.status === ActivityStatus.published;
    const configToValidate = dto.config !== undefined ? dto.config : this.extractConfigAndKey(activity as unknown as ActivityWithDetails).config;
    const answerKeyToValidate = dto.answerKey !== undefined ? dto.answerKey : this.extractConfigAndKey(activity as unknown as ActivityWithDetails).answerKey;

    const { validConfig, validAnswerKey, weightsAdjusted } = this.validateActivityContent(
      activity.type,
      configToValidate,
      answerKeyToValidate,
      isPublished,
    );

    let durations: { expectedDurationSeconds: number; minPlausibleSeconds: number } | undefined = undefined;
    if (
      dto.expectedDurationSeconds !== undefined ||
      dto.minPlausibleSeconds !== undefined ||
      dto.config !== undefined
    ) {
      try {
        durations = resolveActivityDurations(activity.type, validConfig, {
          expectedDurationSeconds:
            dto.expectedDurationSeconds !== undefined
              ? dto.expectedDurationSeconds
              : activity.expected_duration_seconds,
          minPlausibleSeconds:
            dto.minPlausibleSeconds !== undefined
              ? dto.minPlausibleSeconds
              : activity.min_plausible_seconds,
        });
      } catch (err: unknown) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: err instanceof Error ? err.message : 'Error en validación de duraciones',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const attemptsCount = await tx.attempt.count({
        where: {
          assignment: {
            activity_id: id,
          },
          organization_id: organizationId,
        },
      });

      if (attemptsCount > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ACTIVITY_HAS_ATTEMPTS',
          message: 'Esta actividad ya tiene intentos. Duplícala para hacer cambios',
        });
      }
      await tx.activity.update({
        where: { id: activity.id },
        data: {
          title: trimmedTitle,
          level: dto.level,
          expected_duration_seconds: durations ? durations.expectedDurationSeconds : undefined,
          min_plausible_seconds: durations ? durations.minPlausibleSeconds : undefined,
        },
      });

      if (dto.config !== undefined || dto.answerKey !== undefined) {
        switch (activity.type) {
          case ActivityType.fill_blank:
            await tx.fillBlankDetail.update({
              where: { activity_id: activity.id },
              data: {
                config: validConfig as object,
                answer_key: (validAnswerKey ?? {}) as object,
              },
            });
            break;

          case ActivityType.open_question:
            await tx.openQuestionDetail.update({
              where: { activity_id: activity.id },
              data: {
                config: validConfig as object,
              },
            });
            break;

          case ActivityType.speaking: {
            const spkConfig = validConfig as {
              prompt: string;
              exampleUrl?: string;
              minDurationSeconds: number;
              maxDurationSeconds: number;
            };
            await tx.speakingDetail.update({
              where: { activity_id: activity.id },
              data: {
                prompt: spkConfig.prompt,
                example_url: spkConfig.exampleUrl ?? null,
                min_duration_seconds: spkConfig.minDurationSeconds,
                max_duration_seconds: spkConfig.maxDurationSeconds,
              },
            });
            break;
          }

          case ActivityType.game:
            await tx.gameDetail.update({
              where: { activity_id: activity.id },
              data: {
                config: validConfig as object,
                answer_key: (validAnswerKey ?? {}) as object,
              },
            });
            break;

          case ActivityType.exam:
            await tx.examDetail.update({
              where: { activity_id: activity.id },
              data: {
                config: validConfig as object,
                answer_key: (validAnswerKey ?? {}) as object,
              },
            });
            break;
        }
      }
    });

    return this.getActivity(organizationId, activity.id).then((editor) => ({
      ...editor,
      weightsAdjusted,
    }));
  }

  async publishActivity(organizationId: string, id: string): Promise<ActivityEditor> {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        fill_blank_detail: { select: { config: true, answer_key: true } },
        open_question_detail: { select: { config: true } },
        speaking_detail: true,
        game_detail: { select: { mechanic: true, config: true, answer_key: true } },
        exam_detail: { select: { config: true, answer_key: true } },
      },
    });

    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    if (activity.status === ActivityStatus.archived) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_NOT_EDITABLE',
        message: 'Esta actividad está archivada',
      });
    }

    if (activity.status === ActivityStatus.published) {
      return this.toActivityEditor(activity as unknown as ActivityWithDetails, false);
    }

    const { config, answerKey } = this.extractConfigAndKey(activity as unknown as ActivityWithDetails);
    this.validateActivityContent(activity.type, config, answerKey, true);

    await this.prisma.activity.update({
      where: { id: activity.id },
      data: {
        status: ActivityStatus.published,
      },
    });

    return this.getActivity(organizationId, activity.id);
  }

  async duplicateActivity(
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<ActivityEditor> {
    const source = await this.prisma.activity.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        fill_blank_detail: { select: { config: true, answer_key: true } },
        open_question_detail: { select: { config: true } },
        speaking_detail: true,
        game_detail: { select: { mechanic: true, config: true, answer_key: true } },
        exam_detail: { select: { config: true, answer_key: true } },
      },
    });

    if (!source) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    const rawTitle = `Copia de ${source.title}`;
    const newTitle = rawTitle.slice(0, 100);

    const duplicated = await this.prisma.$transaction(async (tx) => {
      const act = await tx.activity.create({
        data: {
          organization_id: organizationId,
          title: newTitle,
          type: source.type,
          level: source.level,
          status: ActivityStatus.draft,
          version: source.version + 1,
          parent_id: source.id,
          created_by: userId,
          expected_duration_seconds: source.expected_duration_seconds,
          min_plausible_seconds: source.min_plausible_seconds,
        },
      });

      switch (source.type) {
        case ActivityType.fill_blank:
          if (source.fill_blank_detail) {
            await tx.fillBlankDetail.create({
              data: {
                organization_id: organizationId,
                activity_id: act.id,
                config: source.fill_blank_detail.config as object,
                answer_key: source.fill_blank_detail.answer_key as object,
              },
            });
          }
          break;

        case ActivityType.open_question:
          if (source.open_question_detail) {
            await tx.openQuestionDetail.create({
              data: {
                organization_id: organizationId,
                activity_id: act.id,
                config: source.open_question_detail.config as object,
              },
            });
          }
          break;

        case ActivityType.speaking:
          if (source.speaking_detail) {
            await tx.speakingDetail.create({
              data: {
                organization_id: organizationId,
                activity_id: act.id,
                prompt: source.speaking_detail.prompt,
                example_url: source.speaking_detail.example_url,
                min_duration_seconds: source.speaking_detail.min_duration_seconds,
                max_duration_seconds: source.speaking_detail.max_duration_seconds,
              },
            });
          }
          break;

        case ActivityType.game:
          if (source.game_detail) {
            await tx.gameDetail.create({
              data: {
                organization_id: organizationId,
                activity_id: act.id,
                mechanic: source.game_detail.mechanic,
                config: source.game_detail.config as object,
                answer_key: source.game_detail.answer_key as object,
              },
            });
          }
          break;

        case ActivityType.exam:
          if (source.exam_detail) {
            await tx.examDetail.create({
              data: {
                organization_id: organizationId,
                activity_id: act.id,
                config: source.exam_detail.config as object,
                answer_key: source.exam_detail.answer_key as object,
              },
            });
          }
          break;
      }

      return act;
    });

    return this.getActivity(organizationId, duplicated.id);
  }

  async archiveActivity(organizationId: string, id: string): Promise<ActivityEditor> {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
    });

    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    if (activity.status === ActivityStatus.archived) {
      return this.getActivity(organizationId, id);
    }

    await this.prisma.activity.update({
      where: { id: activity.id },
      data: {
        status: ActivityStatus.archived,
      },
    });

    return this.getActivity(organizationId, id);
  }

  async restoreActivity(organizationId: string, id: string): Promise<ActivityEditor> {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        fill_blank_detail: { select: { config: true, answer_key: true } },
        open_question_detail: { select: { config: true } },
        speaking_detail: true,
        game_detail: { select: { mechanic: true, config: true, answer_key: true } },
        exam_detail: { select: { config: true, answer_key: true } },
      },
    });

    if (!activity) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Actividad no encontrada',
      });
    }

    if (activity.status !== ActivityStatus.archived) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ACTIVITY_NOT_ARCHIVED',
        message: 'La actividad no está archivada',
      });
    }

    const { config, answerKey } = this.extractConfigAndKey(activity as unknown as ActivityWithDetails);
    this.validateActivityContent(activity.type, config, answerKey, true);

    await this.prisma.activity.update({
      where: { id: activity.id },
      data: {
        status: ActivityStatus.published,
      },
    });

    return this.getActivity(organizationId, id);
  }

  async deleteActivity(organizationId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({
        where: {
          id,
          organization_id: organizationId,
        },
        include: {
          assignments: { select: { id: true } },
          children: { select: { id: true } },
        },
      });

      if (!activity) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Actividad no encontrada',
        });
      }

      const isDraft = activity.status === ActivityStatus.draft;
      const hasAssignments = activity.assignments.length > 0;
      const hasChildren = activity.children.length > 0;

      if (!isDraft || hasAssignments || hasChildren) {
        throw new ConflictException({
          statusCode: 409,
          code: 'ACTIVITY_DELETE_NOT_ALLOWED',
          message:
            'No se puede eliminar la actividad. Solo se pueden borrar borradores sin asignaciones ni versiones derivadas.',
        });
      }

      await tx.activity.delete({
        where: { id: activity.id },
      });
    });
  }
}
