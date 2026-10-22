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
