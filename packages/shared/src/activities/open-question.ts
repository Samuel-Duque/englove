import { z } from 'zod';

export const OpenQuestionConfigSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((v) => !/<[^>]*>/.test(v), { message: 'El texto no puede contener HTML' }),
  rubric: z.string().trim().max(2000).optional(),
  maxLength: z.number().int().min(1).max(10000).default(2000),
});

export type OpenQuestionConfig = z.infer<typeof OpenQuestionConfigSchema>;

export const OpenQuestionAnswersSchema = z.object({
  text: z.string().trim().max(10000),
});

export type OpenQuestionAnswers = z.infer<typeof OpenQuestionAnswersSchema>;
