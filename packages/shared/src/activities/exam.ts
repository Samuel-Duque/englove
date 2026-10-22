import { z } from 'zod';
import { FillBlankBlankSchema } from './fill-blank';

export const ExamItemSchema = z
  .object({
    id: z.string().uuid(),
    weight: z.number().min(0).max(100),
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

export type ExamItem = z.infer<typeof ExamItemSchema>;

export const ExamConfigSchema = z.object({
  instructions: z.string().trim().max(2000).optional(),
  items: z.array(ExamItemSchema).max(100),
});

export type ExamConfig = z.infer<typeof ExamConfigSchema>;

export const ExamPublishConfigSchema = z.object({
  instructions: z.string().trim().max(2000).optional(),
  items: z.array(ExamItemSchema).min(2).max(100),
});

export const ExamAnswerKeySchema = z.object({
  items: z.record(z.string().uuid(), z.record(z.string().uuid(), z.string().uuid())),
});

export type ExamAnswerKey = z.infer<typeof ExamAnswerKeySchema>;

export interface NormalizedWeightsResult<T extends { id: string; weight: number }> {
  items: T[];
  weightsAdjusted: boolean;
}

/**
 * Normalizes exam weights so they sum exactly to 100.0% using the Largest Remainder Method in tenths
 * (Decisión 97, Architecture §4.4, RF-8).
 * Ties are broken from the last item.
 */
export function normalizeExamWeights<T extends { id: string; weight: number }>(
  items: T[],
): NormalizedWeightsResult<T> {
  if (items.length === 0) {
    return { items: [], weightsAdjusted: false };
  }

  for (const item of items) {
    if (typeof item.weight !== 'number' || !Number.isFinite(item.weight) || item.weight < 0) {
      throw new Error('Los pesos deben ser números finitos mayores o iguales a 0');
    }
  }

  const sum = items.reduce((acc, it) => acc + it.weight, 0);
  if (sum <= 0) {
    throw new Error('La suma de pesos debe ser mayor a 0');
  }

  const tenthsFloors: number[] = [];
  const remainders: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const idealPercentage = (item.weight * 100) / sum;
    const idealTenths = idealPercentage * 10;
    const floorTenths = Math.floor(idealTenths);
    tenthsFloors.push(floorTenths);
    remainders.push(idealTenths - floorTenths);
  }

  const currentSumTenths = tenthsFloors.reduce((acc, t) => acc + t, 0);
  const targetTenths = 1000; // 100.0%
  const deficit = targetTenths - currentSumTenths;

  const indices = items.map((_, i) => i);
  indices.sort((a, b) => {
    const remB = remainders[b] ?? 0;
    const remA = remainders[a] ?? 0;
    const diff = remB - remA;
    if (Math.abs(diff) > 1e-9) {
      return diff;
    }
    // Decision 97: "el empate se rompe desde el último ítem"
    return b - a;
  });

  const finalTenths = [...tenthsFloors];
  for (let k = 0; k < deficit; k++) {
    const idx = indices[k];
    if (idx !== undefined && finalTenths[idx] !== undefined) {
      finalTenths[idx] += 1;
    }
  }

  const resultWeights = finalTenths.map((t) => Math.round(t) / 10);

  const weightsAdjusted = items.some((item, idx) => {
    const resW = resultWeights[idx] ?? 0;
    return Math.abs(item.weight - resW) > 1e-4;
  });

  const updatedItems = items.map((item, idx) => ({
    ...item,
    weight: resultWeights[idx] ?? item.weight,
  }));

  return {
    items: updatedItems,
    weightsAdjusted,
  };
}
