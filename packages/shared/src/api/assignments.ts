import { ActivityStatus, ActivityType, Level, AssignmentAvailability } from '../enums';

export interface AssignmentActivitySummary {
  id: string;
  title: string;
  type: ActivityType;
  level: Level;
  version: number;
  status: ActivityStatus;
}

export interface AssignmentGroupSummary {
  id: string;
  name: string;
  archivedAt: string | null;
}

export interface AssignmentView {
  id: string;
  activity: AssignmentActivitySummary;
  group: AssignmentGroupSummary;
  opensAt: string;
  dueAt: string;
  cancelledAt: string | null;
  historicalStudentCount: number | null;
  availability: AssignmentAvailability;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentInput {
  activityId: string;
  groupIds: string[];
  opensAt: string;
  dueAt: string;
}

export interface CreateAssignmentResponse {
  items: AssignmentView[];
}

export interface AssignmentListResponse {
  items: AssignmentView[];
  total: number;
  offset: number;
  limit: number;
}

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

export function formatBogotaDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}
