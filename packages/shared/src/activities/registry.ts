import { ActivityType } from '../enums';
import { FillBlankConfigSchema, FillBlankAnswerKeySchema } from './fill-blank';
import { OpenQuestionConfigSchema } from './open-question';
import { SpeakingConfigSchema } from './speaking';
import { GameConfigSchema, GameAnswerKeySchema } from './game';
import { ExamConfigSchema, ExamAnswerKeySchema } from './exam';

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
    answerKey: ExamAnswerKeySchema,
  },
} as const;

/**
 * Strips answer keys for graded activities (fill_blank, exam) before sending configuration
 * to the student (Rule G-C04, Decision 75, Architecture §5.3).
 * In microgames, key may accompany client for low-risk immediate feedback.
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
    case ActivityType.speaking:
      // Answer key is never sent to student
      return JSON.parse(JSON.stringify(config)) as T;

    case ActivityType.game:
      // For games, solution may be embedded into game config for client-side feedback
      if (answerKey && typeof config === 'object' && config !== null) {
        return {
          ...config,
          answerKey,
        } as T;
      }
      return JSON.parse(JSON.stringify(config)) as T;

    default:
      return JSON.parse(JSON.stringify(config)) as T;
  }
}
