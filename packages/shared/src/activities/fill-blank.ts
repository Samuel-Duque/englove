import { z } from 'zod';

export const FillBlankOptionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(200),
});

export type FillBlankOption = z.infer<typeof FillBlankOptionSchema>;

export const FillBlankBlankSchema = z
  .object({
    id: z.string().uuid(),
    options: z.array(FillBlankOptionSchema).min(2).max(20),
  })
  .refine(
    (val) => {
      const texts = val.options.map((o) => o.text.trim().toLowerCase());
      return new Set(texts).size === texts.length;
    },
    {
      message: 'Las opciones de un hueco deben tener textos distintos tras recortar',
      path: ['options'],
    },
  );

export type FillBlankBlank = z.infer<typeof FillBlankBlankSchema>;

export const FillBlankItemSchema = z
  .object({
    id: z.string().uuid(),
    prompt: z
      .string()
      .trim()
      .min(1)
      .max(5000)
      .refine((v) => !/<[^>]*>/.test(v), { message: 'El texto no puede contener HTML' }),
    blanks: z.array(FillBlankBlankSchema).min(1).max(20),
  })
  .superRefine((val, ctx) => {
    const blankIds = new Set(val.blanks.map((b) => b.id));
    const markers = val.prompt.match(/\{\{([^}]+)\}\}/g) || [];
    const foundIds = markers.map((m) => m.slice(2, -2));

    for (const blank of val.blanks) {
      const count = foundIds.filter((id) => id === blank.id).length;
      if (count === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El prompt debe contener el marcador {{${blank.id}}} exactamente una vez`,
          path: ['prompt'],
        });
      } else if (count > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `El marcador {{${blank.id}}} aparece más de una vez en el prompt`,
          path: ['prompt'],
        });
      }
    }

    for (const foundId of foundIds) {
      if (!blankIds.has(foundId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Marcador huérfano {{${foundId}}} en el prompt no corresponde a ningún hueco`,
          path: ['prompt'],
        });
      }
    }
  });

export type FillBlankItem = z.infer<typeof FillBlankItemSchema>;

export const FillBlankConfigSchema = z.object({
  instructions: z.string().trim().max(2000).optional(),
  items: z.array(FillBlankItemSchema).min(1).max(100),
});

export type FillBlankConfig = z.infer<typeof FillBlankConfigSchema>;

export const FillBlankAnswerKeySchema = z.object({
  items: z.record(z.string().uuid(), z.record(z.string().uuid(), z.string().uuid())),
});

export type FillBlankAnswerKey = z.infer<typeof FillBlankAnswerKeySchema>;

export const FillBlankAnswersSchema = z.object({
  items: z.record(z.string(), z.record(z.string(), z.string())),
});

export type FillBlankAnswers = z.infer<typeof FillBlankAnswersSchema>;

/**
 * Helper to parse syntax `[correct|distractor1|distractor2]` into FillBlankItem components.
 */
function defaultUuid(): string {
  const globalObj = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (globalObj.crypto && typeof globalObj.crypto.randomUUID === 'function') {
    return globalObj.crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padStart(12, '0');
}

export function parseFillBlankSimpleSyntax(
  rawPrompt: string,
  generateUuid: () => string = defaultUuid,
): {
  prompt: string;
  blanks: FillBlankBlank[];
  answerKey: Record<string, string>;
} {
  const blanks: FillBlankBlank[] = [];
  const answerKey: Record<string, string> = {};

  const regex = /\[([^\]]+)\]/g;
  const prompt = rawPrompt.replace(regex, (_match, group: string) => {
    const parts = group.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      return group;
    }
    const blankId = generateUuid();
    const options: FillBlankOption[] = parts.map((text) => ({
      id: generateUuid(),
      text,
    }));
    blanks.push({
      id: blankId,
      options,
    });
    // First option is correct
    const firstOption = options[0];
    if (firstOption) {
      answerKey[blankId] = firstOption.id;
    }
    return `{{${blankId}}}`;
  });

  return { prompt, blanks, answerKey };
}
