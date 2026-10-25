import { z } from 'zod';
import { GameMechanic } from '../enums';

// 1. Match
export const MatchItemSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(200),
});

export const MatchSettingsSchema = z
  .object({
    left: z.array(MatchItemSchema).min(2).max(100),
    right: z.array(MatchItemSchema).min(2).max(100),
  })
  .refine((val) => val.left.length === val.right.length, {
    message: 'La cantidad de elementos a la izquierda y a la derecha debe ser igual',
    path: ['right'],
  });

export const MatchSolutionSchema = z.object({
  pairs: z.record(z.string().uuid(), z.string().uuid()),
});

// 2. Order Words
export const OrderWordsTokenSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(200),
});

export const OrderWordsSettingsSchema = z.object({
  tokens: z.array(OrderWordsTokenSchema).min(2).max(100),
});

export const OrderWordsSolutionSchema = z.object({
  tokenIds: z.array(z.string().uuid()).min(2),
});

// 3. Drag and Drop
export const DragDropObjectSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(200),
});

export const DragDropTargetSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(200),
});

export const DragDropSettingsSchema = z.object({
  objects: z.array(DragDropObjectSchema).min(2).max(100),
  targets: z.array(DragDropTargetSchema).min(2).max(100),
});

export const DragDropSolutionSchema = z.object({
  placements: z.record(z.string().uuid(), z.string().uuid()),
});

// 4. Memory Cards
export const MemoryCardSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(200),
});

export const MemorySettingsSchema = z
  .object({
    cards: z.array(MemoryCardSchema).min(4).max(100),
  })
  .refine((val) => val.cards.length % 2 === 0, {
    message: 'La cantidad de tarjetas para memoria debe ser un número par (mínimo 4)',
    path: ['cards'],
  });

export const MemorySolutionSchema = z.object({
  pairs: z.array(z.tuple([z.string().uuid(), z.string().uuid()])).min(2),
});

// 5. Timed Choice
export const TimedChoiceQuestionSchema = z.object({
  id: z.string().uuid(),
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((v) => !/<[^>]*>/.test(v), { message: 'El texto no puede contener HTML' }),
  options: z
    .array(
      z.object({
        id: z.string().uuid(),
        text: z.string().trim().min(1).max(200),
      }),
    )
    .min(2)
    .max(20)
    .refine(
      (opts) => {
        const texts = opts.map((o) => o.text.trim().toLowerCase());
        return new Set(texts).size === texts.length;
      },
      { message: 'Las opciones deben tener textos distintos tras recortar', path: ['options'] },
    ),
});

export const TimedChoiceSettingsSchema = z.object({
  timeLimitSeconds: z.number().int().min(5).max(120).default(20),
  questions: z.array(TimedChoiceQuestionSchema).min(1).max(100),
});

export const TimedChoiceSolutionSchema = z.object({
  choices: z.record(z.string().uuid(), z.string().uuid()),
});

// Union Configuration for Games
export const GameConfigSchema = z.discriminatedUnion('mechanic', [
  z.object({
    mechanic: z.literal(GameMechanic.match),
    instructions: z.string().trim().max(2000).optional(),
    settings: MatchSettingsSchema,
  }),
  z.object({
    mechanic: z.literal(GameMechanic.order_words),
    instructions: z.string().trim().max(2000).optional(),
    settings: OrderWordsSettingsSchema,
  }),
  z.object({
    mechanic: z.literal(GameMechanic.drag_drop),
    instructions: z.string().trim().max(2000).optional(),
    settings: DragDropSettingsSchema,
  }),
  z.object({
    mechanic: z.literal(GameMechanic.memory),
    instructions: z.string().trim().max(2000).optional(),
    settings: MemorySettingsSchema,
  }),
  z.object({
    mechanic: z.literal(GameMechanic.timed_choice),
    instructions: z.string().trim().max(2000).optional(),
    settings: TimedChoiceSettingsSchema,
  }),
]);

export type GameConfig = z.infer<typeof GameConfigSchema>;

export type MatchSettings = z.infer<typeof MatchSettingsSchema>;
export type MatchSolution = z.infer<typeof MatchSolutionSchema>;

export type OrderWordsSettings = z.infer<typeof OrderWordsSettingsSchema>;
export type OrderWordsSolution = z.infer<typeof OrderWordsSolutionSchema>;

export type DragDropSettings = z.infer<typeof DragDropSettingsSchema>;
export type DragDropSolution = z.infer<typeof DragDropSolutionSchema>;

export type MemorySettings = z.infer<typeof MemorySettingsSchema>;
export type MemorySolution = z.infer<typeof MemorySolutionSchema>;

export type TimedChoiceSettings = z.infer<typeof TimedChoiceSettingsSchema>;
export type TimedChoiceSolution = z.infer<typeof TimedChoiceSolutionSchema>;

export const GameAnswerKeySchema = z.object({
  solution: z.union([
    MatchSolutionSchema,
    OrderWordsSolutionSchema,
    DragDropSolutionSchema,
    MemorySolutionSchema,
    TimedChoiceSolutionSchema,
  ]),
});

export type GameAnswerKey = z.infer<typeof GameAnswerKeySchema>;

export interface GamePublicConfig {
  mechanic: GameMechanic;
  instructions?: string;
  settings: unknown;
  answerKey: GameAnswerKey;
}

export interface GameAnswers {
  pairs?: Record<string, string>;
  tokenIds?: string[];
  placements?: Record<string, string>;
  selections?: Array<[string, string]>;
  choices?: Record<string, string | null>;
}

export const GAME_MECHANIC_LABELS: Record<GameMechanic, string> = {
  [GameMechanic.match]: 'Emparejar',
  [GameMechanic.order_words]: 'Ordenar palabras',
  [GameMechanic.drag_drop]: 'Arrastrar y soltar',
  [GameMechanic.memory]: 'Memoria',
  [GameMechanic.timed_choice]: 'Contra reloj',
};

/**
 * Seeded pseudo-random number generator for deterministic shuffling (SPEC-06 §4 Rule 5).
 */
export function seededRandom(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Pure deterministic Fisher-Yates shuffle using a string seed (e.g. attemptId).
 */
export function deterministicShuffle<T>(array: T[], seedStr: string): T[] {
  const result = [...array];
  if (result.length <= 1) return result;
  const rand = seededRandom(seedStr);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}
