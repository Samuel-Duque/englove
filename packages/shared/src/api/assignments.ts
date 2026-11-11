import { z } from 'zod';
import { ActivityStatus, ActivityType, Level, AssignmentAvailability } from '../enums';

export const AssignmentActivitySummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.nativeEnum(ActivityType),
  level: z.nativeEnum(Level),
  version: z.number().int(),
  status: z.nativeEnum(ActivityStatus),
});

export type AssignmentActivitySummary = z.infer<typeof AssignmentActivitySummarySchema>;

export const AssignmentGroupSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  archivedAt: z.string().nullable(),
});

export type AssignmentGroupSummary = z.infer<typeof AssignmentGroupSummarySchema>;

export const AssignmentViewSchema = z.object({
  id: z.string(),
  activity: AssignmentActivitySummarySchema,
  group: AssignmentGroupSummarySchema,
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  opensAt: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  dueAt: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  cancelledAt: z.string().nullable(),
  historicalStudentCount: z.number().int().nullable().optional(),
  availability: z.nativeEnum(AssignmentAvailability),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  createdAt: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  updatedAt: z.string(),
});

export type AssignmentView = z.infer<typeof AssignmentViewSchema>;

export interface CreateAssignmentInput {
  activityId: string;
  groupIds: string[];
  opensAt: string;
  dueAt: string;
}

export const CreateAssignmentResponseSchema = z.object({
  items: z.array(AssignmentViewSchema),
});

export type CreateAssignmentResponse = z.infer<typeof CreateAssignmentResponseSchema>;

export const AssignmentListResponseSchema = z.object({
  items: z.array(AssignmentViewSchema),
  total: z.number().int(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type AssignmentListResponse = z.infer<typeof AssignmentListResponseSchema>;

export interface AssignmentListQuery {
  offset?: number;
  limit?: number;
  groupId?: string;
  availability?: AssignmentAvailability;
}

export function deriveAssignmentAvailability(
  now: Date,
  opensAt: Date | string,
  dueAt: Date | string,
  cancelledAt?: Date | string | null,
): AssignmentAvailability {
  if (cancelledAt != null) {
    return AssignmentAvailability.cancelled;
  }
  const t = now.getTime();
  const openTime = typeof opensAt === 'string' ? new Date(opensAt).getTime() : opensAt.getTime();
  const dueTime = typeof dueAt === 'string' ? new Date(dueAt).getTime() : dueAt.getTime();

  if (t < openTime) {
    return AssignmentAvailability.scheduled;
  }
  if (t <= dueTime) {
    return AssignmentAvailability.open;
  }
  return AssignmentAvailability.closed;
}

export function getExtendedDueAt(dueAt: Date | string): Date {
  const d = typeof dueAt === 'string' ? new Date(dueAt) : new Date(dueAt.getTime());
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
}

const bogotaDateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatBogotaDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return bogotaDateTimeFormatter.format(d);
}
