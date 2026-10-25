import { ActivityType, AttemptStatus, Level, Role, AgeSegment, GameMechanic } from '../enums';

export interface AttemptView {
  id: string;
  assignmentId: string;
  attemptNumber: number;
  previousAttemptId: string | null;
  status: AttemptStatus;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  startedAt: string;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  finishedAt: string | null;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  gradedAt: string | null;
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: number | null;
  flags: string[];
  effectiveDueAt: string;
  completeUntil: string;
}

export interface RuntimeView {
  attempt: AttemptView;
  activity: {
    id: string;
    title: string;
    type: ActivityType;
    level: Level;
    config: unknown;
  };
  answers: Record<string, unknown>;
  mediaId: string | null;
  correction: Record<string, unknown> | null;
  attemptToken: string | null;
}

export interface BadgeAwardView {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  // guardrails-ignore G-C03: timestamp de solo lectura asignado por el servidor en medalla otorgada
  awardedAt: string;
}

export interface CompletionView {
  attempt: AttemptView;
  correction: Record<string, unknown> | null;
  newBadges: BadgeAwardView[];
}

export interface AssignmentCard {
  id: string;
  activity: {
    id: string;
    title: string;
    type: ActivityType;
    level: Level;
    version?: number;
    mechanic?: GameMechanic;
  };
  opensAt: string;
  dueAt: string;
  cancelledAt: string | null;
  effectiveDueAt: string;
  latestAttempt: AttemptView | null;
  canStart: boolean;
  canContinue: boolean;
  retryAvailable: boolean;
}

export interface AssignmentCardListResponse {
  items: AssignmentCard[];
  total: number;
  offset: number;
  limit: number;
}

export interface StartAttemptInput {
  assignmentId?: string;
}

export interface SubmitAnswerEventItem {
  itemId: string;
  answer: unknown;
  clientEventId: string;
}

export interface SubmitEventsInput {
  events: SubmitAnswerEventItem[];
}

export interface SubmitEventsResponse {
  acceptedEventIds: string[];
}

export interface CompleteAttemptInput {
  mediaId?: string;
  clientFinishedNotice?: boolean;
}

export interface AttemptResponse {
  id: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  status: AttemptStatus;
}

export interface StudentProgressActivityItem {
  assignmentId: string;
  attemptId: string;
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: number;
  stars: number;
}

export interface StudentProgressView {
  activities: StudentProgressActivityItem[];
  badges: BadgeAwardView[];
  streak: {
    weeks: number;
    forgivenessAvailable: boolean;
    activeWeeksSinceForgivenessUsed: number;
    periodKey: string | null;
  };
}

export interface StudentProfileView {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
  student: {
    id: string;
    ageSegment: AgeSegment;
    canSwitchInterface: boolean;
    level?: Level | null;
    birthDate?: string | null;
  };
}

export interface UpdateInterfaceInput {
  ageSegment: AgeSegment;
}

export interface MediaUploadUrlInput {
  attemptId: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MediaUploadUrlResponse {
  mediaId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface MediaPlaybackUrlResponse {
  url: string;
  expiresAt: string;
  format: 'converted' | 'raw';
  compatibilityWarning: boolean;
}
