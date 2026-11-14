import { z } from 'zod';
import { ActivityStatus, ActivityType, Level } from '../enums';

export const ActivitySummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.nativeEnum(ActivityType),
  level: z.nativeEnum(Level),
  status: z.nativeEnum(ActivityStatus).optional().default(ActivityStatus.published),
  version: z.number().int().optional().default(1),
  parentId: z.string().nullable().optional().default(null),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  updatedAt: z.string().optional().default(() => new Date().toISOString()),
});

export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;

export const ActivityEditorSchema = ActivitySummarySchema.extend({
  expectedDurationSeconds: z.number().nullable().optional().default(null),
  minPlausibleSeconds: z.number().nullable().optional().default(null),
  config: z.unknown().optional().default({}),
  answerKey: z.unknown().optional(),
  weightsAdjusted: z.boolean().optional().default(false),
});

export type ActivityEditor = z.infer<typeof ActivityEditorSchema>;

export const ActivityListResponseSchema = z.object({
  items: z.array(ActivitySummarySchema),
  total: z.number().int().optional().default(0),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>;

export interface ActivityListQuery {
  offset?: number;
  limit?: number;
  level?: Level;
  type?: ActivityType;
  status?: ActivityStatus;
}

export interface CreateActivityInput {
  title: string;
  type: ActivityType;
  level: Level;
  config: unknown;
  answerKey?: unknown;
  expectedDurationSeconds?: number | null;
  minPlausibleSeconds?: number | null;
}

export interface UpdateActivityInput {
  title?: string;
  level?: Level;
  config?: unknown;
  answerKey?: unknown;
  expectedDurationSeconds?: number | null;
  minPlausibleSeconds?: number | null;
}
