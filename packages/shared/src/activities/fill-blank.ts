import { z } from 'zod';

export const FillBlankItemSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  blanks: z.array(z.string()).min(1),
});

export const FillBlankConfigSchema = z.object({
  instructions: z.string().optional(),
  items: z.array(FillBlankItemSchema).min(1),
});

export type FillBlankConfig = z.infer<typeof FillBlankConfigSchema>;

export const FillBlankAnswerKeySchema = z.object({
  items: z.record(z.string(), z.array(z.string())),
});

export type FillBlankAnswerKey = z.infer<typeof FillBlankAnswerKeySchema>;

export const FillBlankAnswersSchema = z.object({
  items: z.record(z.string(), z.array(z.string())),
});

export type FillBlankAnswers = z.infer<typeof FillBlankAnswersSchema>;
