import { z } from 'zod';
import { FillBlankItemSchema } from './fill-blank';

export const ExamItemSchema = z.object({
  id: z.string(),
  weight: z.number().min(0).max(100),
  item: FillBlankItemSchema,
});

export const ExamConfigSchema = z.object({
  title: z.string().optional(),
  instructions: z.string().optional(),
  items: z.array(ExamItemSchema).min(2),
});

export type ExamConfig = z.infer<typeof ExamConfigSchema>;

export const ExamAnswerKeySchema = z.object({
  items: z.record(z.string(), z.array(z.string())),
});

export type ExamAnswerKey = z.infer<typeof ExamAnswerKeySchema>;
