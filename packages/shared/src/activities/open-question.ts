import { z } from 'zod';

export const OpenQuestionConfigSchema = z.object({
  prompt: z.string().min(1),
  rubric: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
});

export type OpenQuestionConfig = z.infer<typeof OpenQuestionConfigSchema>;
