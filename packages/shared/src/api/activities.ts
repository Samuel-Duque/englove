import { ActivityStatus, ActivityType, Level } from '../enums';

export interface ActivitySummary {
  id: string;
  title: string;
  type: ActivityType;
  level: Level;
  status: ActivityStatus;
  version: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEditor extends ActivitySummary {
  expectedDurationSeconds: number | null;
  minPlausibleSeconds: number | null;
  config: unknown;
  answerKey?: unknown;
  weightsAdjusted: boolean;
}

export interface ActivityListResponse {
  items: ActivitySummary[];
  total: number;
  offset: number;
  limit: number;
}

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
