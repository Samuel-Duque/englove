import { ActivityType } from '../enums';
import {
  FillBlankConfigSchema,
  FillBlankAnswerKeySchema,
  FillBlankConfig,
  FillBlankAnswerKey,
} from './fill-blank';
import { OpenQuestionConfigSchema, OpenQuestionConfig } from './open-question';
import { SpeakingConfigSchema, SpeakingConfig } from './speaking';
import {
  GameConfigSchema,
  GameAnswerKeySchema,
  GameConfig,
  GameAnswerKey,
} from './game';
import {
  ExamConfigSchema,
  ExamAnswerKeySchema,
  ExamPublishConfigSchema,
  ExamConfig,
  ExamAnswerKey,
  normalizeExamWeights,
} from './exam';

export class ActivityValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'VALIDATION_ERROR',
  ) {
    super(message);
    this.name = 'ActivityValidationError';
  }
}

export const ActivitySchemas = {
  [ActivityType.fill_blank]: {
    config: FillBlankConfigSchema,
    answerKey: FillBlankAnswerKeySchema,
  },
  [ActivityType.open_question]: {
    config: OpenQuestionConfigSchema,
    answerKey: null,
  },
  [ActivityType.speaking]: {
    config: SpeakingConfigSchema,
    answerKey: null,
  },
  [ActivityType.game]: {
    config: GameConfigSchema,
    answerKey: GameAnswerKeySchema,
  },
  [ActivityType.exam]: {
    config: ExamConfigSchema,
    publishConfig: ExamPublishConfigSchema,
    answerKey: ExamAnswerKeySchema,
  },
} as const;

export interface ValidatedActivityContent {
  validConfig:
    | FillBlankConfig
    | OpenQuestionConfig
    | SpeakingConfig
    | GameConfig
    | ExamConfig;
  validAnswerKey?: FillBlankAnswerKey | GameAnswerKey | ExamAnswerKey;
  weightsAdjusted: boolean;
}

/**
 * Validates and cross-checks activity config and answer key (SPEC-03 RF-2, RF-3, RF-6, RF-7, §5).
 * Enforces that:
 * 1. open_question and speaking prohibit answerKey.
 * 2. fill_blank, exam, and game require valid and matching answerKey.
 * 3. IDs and references match strictly without orphan keys or missing answers.
 */
export function validateActivityPayload(
  type: ActivityType,
  config: unknown,
  answerKey: unknown,
  isPublishing: boolean = false,
): ValidatedActivityContent {
  let weightsAdjusted = false;

  switch (type) {
    case ActivityType.open_question: {
      if (answerKey !== undefined && answerKey !== null) {
        throw new ActivityValidationError(
          'Las actividades de pregunta abierta no admiten clave de respuestas',
        );
      }
      const parsedConfig = OpenQuestionConfigSchema.safeParse(config);
      if (!parsedConfig.success) {
        throw new ActivityValidationError(
          parsedConfig.error.errors[0]?.message ??
            'Configuración de pregunta abierta inválida',
        );
      }
      return { validConfig: parsedConfig.data, weightsAdjusted };
    }

    case ActivityType.speaking: {
      if (answerKey !== undefined && answerKey !== null) {
        throw new ActivityValidationError(
          'Las actividades de speaking no admiten clave de respuestas',
        );
      }
      const parsedConfig = SpeakingConfigSchema.safeParse(config);
      if (!parsedConfig.success) {
        throw new ActivityValidationError(
          parsedConfig.error.errors[0]?.message ??
            'Configuración de speaking inválida',
        );
      }
      return { validConfig: parsedConfig.data, weightsAdjusted };
    }

    case ActivityType.fill_blank: {
      if (answerKey === undefined || answerKey === null) {
        throw new ActivityValidationError(
          'La clave de respuestas es obligatoria para fill_blank',
        );
      }
      const parsedConfig = FillBlankConfigSchema.safeParse(config);
      if (!parsedConfig.success) {
        throw new ActivityValidationError(
          parsedConfig.error.errors[0]?.message ??
            'Configuración de fill_blank inválida',
        );
      }
      const parsedKey = FillBlankAnswerKeySchema.safeParse(answerKey);
      if (!parsedKey.success) {
        throw new ActivityValidationError(
          parsedKey.error.errors[0]?.message ?? 'Clave de fill_blank inválida',
        );
      }

      const configItemIds = new Set(parsedConfig.data.items.map((it) => it.id));
      const keyItemIds = Object.keys(parsedKey.data.items);

      for (const kId of keyItemIds) {
        if (!configItemIds.has(kId)) {
          throw new ActivityValidationError(
            `La clave contiene un ítem sobrante que no existe en el contenido: ${kId}`,
          );
        }
      }

      for (const item of parsedConfig.data.items) {
        const itemKey = parsedKey.data.items[item.id];
        if (!itemKey) {
          throw new ActivityValidationError(
            `Falta la clave de respuestas para el ítem ${item.id}`,
          );
        }
        const blankIds = new Set(item.blanks.map((b) => b.id));
        for (const bId of Object.keys(itemKey)) {
          if (!blankIds.has(bId)) {
            throw new ActivityValidationError(
              `La clave contiene un hueco sobrante: ${bId}`,
            );
          }
        }
        for (const blank of item.blanks) {
          const selectedOptId = itemKey[blank.id];
          if (!selectedOptId) {
            throw new ActivityValidationError(
              `Falta la opción correcta para el hueco ${blank.id}`,
            );
          }
          const optIds = new Set(blank.options.map((o) => o.id));
          if (!optIds.has(selectedOptId)) {
            throw new ActivityValidationError(
              `La opción elegida en la clave no pertenece a las opciones del hueco ${blank.id}`,
            );
          }
        }
      }

      return {
        validConfig: parsedConfig.data,
        validAnswerKey: parsedKey.data,
        weightsAdjusted,
      };
    }

    case ActivityType.exam: {
      const schema = isPublishing ? ExamPublishConfigSchema : ExamConfigSchema;
      const parsedConfig = schema.safeParse(config);
      if (!parsedConfig.success) {
        if (
          isPublishing &&
          parsedConfig.error.errors.some((e) => e.code === 'too_small')
        ) {
          throw new ActivityValidationError(
            'Agrega al menos dos ítems para publicar',
            'EXAM_MIN_ITEMS',
          );
        }
        throw new ActivityValidationError(
          parsedConfig.error.errors[0]?.message ??
            'Configuración de examen inválida',
        );
      }

      const items = parsedConfig.data.items;
      let normalizedItems = items;
      if (items.length > 0) {
        const normResult = normalizeExamWeights(items);
        normalizedItems = normResult.items;
        weightsAdjusted = normResult.weightsAdjusted;
      }

      let validAnswerKey: ExamAnswerKey | undefined;
      if (isPublishing && (answerKey === undefined || answerKey === null)) {
        throw new ActivityValidationError(
          'La clave de respuestas es obligatoria para publicar un examen',
        );
      }

      if (answerKey !== undefined && answerKey !== null) {
        const parsedKey = ExamAnswerKeySchema.safeParse(answerKey);
        if (!parsedKey.success) {
          throw new ActivityValidationError(
            parsedKey.error.errors[0]?.message ?? 'Clave de examen inválida',
          );
        }
        validAnswerKey = parsedKey.data;

        const configItemIds = new Set(normalizedItems.map((it) => it.id));
        for (const kId of Object.keys(validAnswerKey.items)) {
          if (!configItemIds.has(kId)) {
            throw new ActivityValidationError(
              `La clave contiene un ítem sobrante: ${kId}`,
            );
          }
        }

        for (const item of normalizedItems) {
          const itemKey = validAnswerKey.items[item.id];
          if (!itemKey) {
            throw new ActivityValidationError(
              `Falta la clave de respuestas para el ítem ${item.id}`,
            );
          }
          const blankIds = new Set(item.blanks.map((b) => b.id));
          for (const bId of Object.keys(itemKey)) {
            if (!blankIds.has(bId)) {
              throw new ActivityValidationError(
                `La clave contiene un hueco sobrante: ${bId}`,
              );
            }
          }
          for (const blank of item.blanks) {
            const selectedOptId = itemKey[blank.id];
            if (!selectedOptId) {
              throw new ActivityValidationError(
                `Falta la opción correcta para el hueco ${blank.id}`,
              );
            }
            const optIds = new Set(blank.options.map((o) => o.id));
            if (!optIds.has(selectedOptId)) {
              throw new ActivityValidationError(
                `La opción elegida en la clave no pertenece a las opciones del hueco ${blank.id}`,
              );
            }
          }
        }
      } else if (normalizedItems.length === 0) {
        validAnswerKey = { items: {} };
      } else {
        throw new ActivityValidationError(
          'La clave de respuestas es obligatoria para un examen con ítems',
        );
      }

      return {
        validConfig: {
          ...parsedConfig.data,
          items: normalizedItems,
        },
        validAnswerKey,
        weightsAdjusted,
      };
    }

    case ActivityType.game: {
      if (answerKey === undefined || answerKey === null) {
        throw new ActivityValidationError(
          'La clave de respuestas es obligatoria para microjuegos',
        );
      }
      const parsedConfig = GameConfigSchema.safeParse(config);
      if (!parsedConfig.success) {
        throw new ActivityValidationError(
          parsedConfig.error.errors[0]?.message ??
            'Configuración de microjuego inválida',
        );
      }
      const parsedKey = GameAnswerKeySchema.safeParse(answerKey);
      if (!parsedKey.success) {
        throw new ActivityValidationError(
          parsedKey.error.errors[0]?.message ?? 'Clave de microjuego inválida',
        );
      }

      const mechanic = parsedConfig.data.mechanic;
      const solution = parsedKey.data.solution;

      if (mechanic === 'match') {
        if (!('pairs' in solution) || Array.isArray(solution.pairs)) {
          throw new ActivityValidationError(
            'La clave para match debe contener solution.pairs como diccionario',
          );
        }
        const pairs = solution.pairs as Record<string, string>;
        const leftIds = new Set(parsedConfig.data.settings.left.map((l) => l.id));
        const rightIds = new Set(
          parsedConfig.data.settings.right.map((r) => r.id),
        );
        const pairLeftKeys = Object.keys(pairs);

        if (pairLeftKeys.length !== leftIds.size) {
          throw new ActivityValidationError(
            'Cada elemento izquierdo debe estar emparejado',
          );
        }

        const matchedRightIds = new Set<string>();
        for (const lId of pairLeftKeys) {
          if (!leftIds.has(lId)) {
            throw new ActivityValidationError(
              `Elemento izquierdo desconocido en la clave: ${lId}`,
            );
          }
          const rId = pairs[lId];
          if (!rId || !rightIds.has(rId)) {
            throw new ActivityValidationError(
              `Elemento derecho inválido o inexistente en la clave para ${lId}`,
            );
          }
          if (matchedRightIds.has(rId)) {
            throw new ActivityValidationError(
              `La correspondencia en match debe ser biyectiva (elemento derecho ${rId} emparejado más de una vez)`,
            );
          }
          matchedRightIds.add(rId);
        }

        if (matchedRightIds.size !== rightIds.size) {
          throw new ActivityValidationError(
            'La correspondencia en match debe cubrir todos los elementos de la derecha',
          );
        }
      } else if (mechanic === 'order_words') {
        if (!('tokenIds' in solution) || !Array.isArray(solution.tokenIds)) {
          throw new ActivityValidationError(
            'La clave para order_words debe contener solution.tokenIds como array',
          );
        }
        const tokenIds = solution.tokenIds;
        const configTokenIds = parsedConfig.data.settings.tokens.map(
          (t) => t.id,
        );

        if (tokenIds.length !== configTokenIds.length) {
          throw new ActivityValidationError(
            'La clave debe incluir todos los tokens exactamente una vez',
          );
        }
        const configSet = new Set(configTokenIds);
        const solSet = new Set(tokenIds);
        if (solSet.size !== tokenIds.length || solSet.size !== configSet.size) {
          throw new ActivityValidationError(
            'La solución de order_words debe ser una permutación completa sin duplicados',
          );
        }
        for (const tId of tokenIds) {
          if (!configSet.has(tId)) {
            throw new ActivityValidationError(
              `Token desconocido en la clave: ${tId}`,
            );
          }
        }
      } else if (mechanic === 'drag_drop') {
        if (!('placements' in solution) || Array.isArray(solution.placements)) {
          throw new ActivityValidationError(
            'La clave para drag_drop debe contener solution.placements',
          );
        }
        const placements = solution.placements as Record<string, string>;
        const objectIds = new Set(
          parsedConfig.data.settings.objects.map((o) => o.id),
        );
        const targetIds = new Set(
          parsedConfig.data.settings.targets.map((t) => t.id),
        );

        for (const objId of Object.keys(placements)) {
          if (!objectIds.has(objId)) {
            throw new ActivityValidationError(
              `Objeto desconocido en la clave: ${objId}`,
            );
          }
        }

        for (const obj of parsedConfig.data.settings.objects) {
          const tId = placements[obj.id];
          if (!tId || !targetIds.has(tId)) {
            throw new ActivityValidationError(
              `Cada objeto debe tener un destino válido asignado en la clave (${obj.id})`,
            );
          }
        }
      } else if (mechanic === 'memory') {
        if (!('pairs' in solution) || !Array.isArray(solution.pairs)) {
          throw new ActivityValidationError(
            'La clave para memory debe contener solution.pairs como array',
          );
        }
        const pairs = solution.pairs as [string, string][];
        const cardIds = new Set(
          parsedConfig.data.settings.cards.map((c) => c.id),
        );
        const seenCards = new Set<string>();

        for (const pair of pairs) {
          if (!Array.isArray(pair) || pair.length !== 2) {
            throw new ActivityValidationError(
              'Cada elemento de pairs en memory debe ser una tupla de dos IDs',
            );
          }
          const [c1, c2] = pair;
          if (c1 === c2) {
            throw new ActivityValidationError(
              'Una tarjeta no puede emparejarse consigo misma',
            );
          }
          if (!cardIds.has(c1) || !cardIds.has(c2)) {
            throw new ActivityValidationError(
              'Tarjeta desconocida en las parejas de memoria',
            );
          }
          if (seenCards.has(c1) || seenCards.has(c2)) {
            throw new ActivityValidationError(
              'Cada tarjeta debe pertenecer exactamente a una pareja (partición completa)',
            );
          }
          seenCards.add(c1);
          seenCards.add(c2);
        }

        if (seenCards.size !== cardIds.size) {
          throw new ActivityValidationError(
            'Todas las tarjetas deben estar agrupadas en parejas',
          );
        }
      } else if (mechanic === 'timed_choice') {
        if (!('choices' in solution) || Array.isArray(solution.choices)) {
          throw new ActivityValidationError(
            'La clave para timed_choice debe contener solution.choices',
          );
        }
        const choices = solution.choices as Record<string, string>;
        const questionIds = new Set(
          parsedConfig.data.settings.questions.map((q) => q.id),
        );

        for (const qId of Object.keys(choices)) {
          if (!questionIds.has(qId)) {
            throw new ActivityValidationError(
              `Pregunta desconocida en la clave: ${qId}`,
            );
          }
        }

        for (const question of parsedConfig.data.settings.questions) {
          const choice = choices[question.id];
          if (!choice) {
            throw new ActivityValidationError(
              `Falta la opción seleccionada para la pregunta ${question.id}`,
            );
          }
          const optIds = new Set(question.options.map((o) => o.id));
          if (!optIds.has(choice)) {
            throw new ActivityValidationError(
              `La opción elegida en la clave no pertenece a las opciones de la pregunta ${question.id}`,
            );
          }
        }
      }

      return {
        validConfig: parsedConfig.data,
        validAnswerKey: parsedKey.data,
        weightsAdjusted,
      };
    }
  }
}

/**
 * Strips answer keys for graded activities (fill_blank, exam, open_question, speaking)
 * before sending configuration to the student (Rule G-C04, Decision 75, Architecture §5.3).
 * In microgames, key may accompany client for low-risk immediate feedback.
 * Projections are schema-validated without blind assertions (SPEC-03 §5).
 */
export function toPublicConfig<T = unknown>(
  type: ActivityType,
  config: unknown,
  answerKey?: unknown,
): T {
  switch (type) {
    case ActivityType.fill_blank:
    case ActivityType.exam:
    case ActivityType.open_question:
    case ActivityType.speaking: {
      const cloned = JSON.parse(JSON.stringify(config ?? {}));
      if (cloned && typeof cloned === 'object') {
        delete (cloned as Record<string, unknown>).answerKey;
        delete (cloned as Record<string, unknown>).answer_key;
      }
      return cloned as T;
    }

    case ActivityType.game: {
      const cloned = JSON.parse(JSON.stringify(config ?? {}));
      if (answerKey && cloned && typeof cloned === 'object') {
        (cloned as Record<string, unknown>).answerKey = answerKey;
      }
      return cloned as T;
    }

    default:
      return JSON.parse(JSON.stringify(config ?? {})) as T;
  }
}
