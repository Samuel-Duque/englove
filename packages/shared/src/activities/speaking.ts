import { z } from 'zod';

export const SpeakingConfigSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((v) => !/<[^>]*>/.test(v), { message: 'El texto no puede contener HTML' }),
  exampleUrl: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'), { message: 'URL de ejemplo debe ser HTTPS' })
    .optional(),
  minDurationSeconds: z.literal(2).default(2),
  maxDurationSeconds: z.number().int().min(2).max(300).default(120),
});

export type SpeakingConfig = z.infer<typeof SpeakingConfigSchema>;
