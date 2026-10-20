import { z } from 'zod';
import { GameMechanic } from '../enums';

export const GameConfigSchema = z.object({
  mechanic: z.nativeEnum(GameMechanic),
  instructions: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

export const GameAnswerKeySchema = z.object({
  solution: z.record(z.string(), z.unknown()),
});

export type GameAnswerKey = z.infer<typeof GameAnswerKeySchema>;
