import { z } from 'zod';

export const SpeakingConfigSchema = z.object({
  prompt: z.string().min(1),
  exampleUrl: z.string().url().optional(),
  minDurationSeconds: z.literal(2).default(2),
  maxDurationSeconds: z.number().int().min(2).max(300).default(120),
});

export type SpeakingConfig = z.infer<typeof SpeakingConfigSchema>;
