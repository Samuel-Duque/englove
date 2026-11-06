import { z } from 'zod';

export const OpenQuestionItemSchema = z.object({
  id: z.string().uuid(),
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((v) => !/<[^>]*>/.test(v), { message: 'El texto no puede contener HTML' }),
  rubric: z.string().trim().max(2000).optional(),
  maxLength: z.number().int().min(1).max(10000).default(2000),
});

export type OpenQuestionItem = z.infer<typeof OpenQuestionItemSchema>;

const SingleItemShape = {
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine((v) => !/<[^>]*>/.test(v), { message: 'El texto no puede contener HTML' }),
  rubric: z.string().trim().max(2000).optional(),
  maxLength: z.number().int().min(1).max(10000).default(2000),
};

export const OpenQuestionConfigSchema = z
  .object({
    instructions: z.string().trim().max(2000).optional(),
    items: z.array(OpenQuestionItemSchema).min(1).max(50).optional(),
    ...SingleItemShape,
    prompt: SingleItemShape.prompt.optional(),
  })
  .refine(
    (data) => {
      // Must have either a valid prompt (single-item) OR items array with >= 1 item (multi-item)
      const hasSinglePrompt = typeof data.prompt === 'string' && data.prompt.trim().length > 0;
      const hasItems = Array.isArray(data.items) && data.items.length > 0;
      return hasSinglePrompt || hasItems;
    },
    {
      message: 'La actividad debe incluir al menos una pregunta abierta (prompt o lista de ítems)',
    },
  );

export type OpenQuestionConfig = z.infer<typeof OpenQuestionConfigSchema>;

export const OpenQuestionAnswersSchema = z.union([
  z.object({
    text: z.string().trim().max(10000),
  }),
  z.object({
    items: z.record(z.string(), z.string().trim().max(10000)),
  }),
  z.record(z.string(), z.string().trim().max(10000)),
]);

export type OpenQuestionAnswers = z.infer<typeof OpenQuestionAnswersSchema>;

/**
 * Returns a normalized list of OpenQuestionItem, supporting both single-prompt legacy activities
 * and modern multi-item open questions (RFC-01).
 */
export function getOpenQuestionItems(
  config: unknown,
  fallbackActivityId?: string,
): OpenQuestionItem[] {
  if (!config || typeof config !== 'object') return [];
  const cfg = config as {
    instructions?: string;
    items?: OpenQuestionItem[];
    prompt?: string;
    rubric?: string;
    maxLength?: number;
  };
  if (Array.isArray(cfg.items) && cfg.items.length > 0) {
    return cfg.items;
  }
  if (typeof cfg.prompt === 'string' && cfg.prompt.length > 0) {
    return [
      {
        id: fallbackActivityId || '00000000-0000-4000-8000-000000000001',
        prompt: cfg.prompt,
        rubric: cfg.rubric,
        maxLength: cfg.maxLength ?? 2000,
      },
    ];
  }
  return [];
}
