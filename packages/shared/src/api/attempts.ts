import { z } from 'zod';
import { ActivityType, AttemptStatus, Level, Role, AgeSegment, GameMechanic } from '../enums';

export const AttemptViewSchema = z.object({
  id: z.string(),
  assignmentId: z.string().nullable().optional(),
  activityId: z.string().nullable().optional(),
  attemptNumber: z.number().int().optional(),
  previousAttemptId: z.string().nullable().optional(),
  status: z.nativeEnum(AttemptStatus).optional(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  startedAt: z.string().optional(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  finishedAt: z.string().nullable().optional(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  gradedAt: z.string().nullable().optional(),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: z.number().nullable().optional(),
  stars: z.number().nullable().optional(),
  motivationMessage: z.string().nullable().optional(),
  flags: z.array(z.string()).optional(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  effectiveDueAt: z.string().optional(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  completeUntil: z.string().optional(),
});

export type AttemptView = z.infer<typeof AttemptViewSchema>;

export const StudentGameCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  mechanic: z.nativeEnum(GameMechanic),
  level: z.nativeEnum(Level),
  expectedDurationSeconds: z.number().int().nullable().optional(),
  minPlausibleSeconds: z.number().int().nullable().optional(),
  bestStars: z.number().nullable().optional(),
  lastStars: z.number().nullable().optional(),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  bestScore: z.number().nullable().optional(),
  bestMaxScore: z.number().nullable().optional(),
  attemptsCount: z.number().int().nonnegative().default(0),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  lastPlayedAt: z.string().nullable().optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).default('not_started'),
  inProgressAttemptId: z.string().nullable().optional(),
});

export type StudentGameCard = z.infer<typeof StudentGameCardSchema>;

export const StudentGamesListResponseSchema = z.object({
  items: z.array(StudentGameCardSchema),
  total: z.number().int().optional().default(0),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type StudentGamesListResponse = z.infer<typeof StudentGamesListResponseSchema>;

export const RuntimeViewSchema = z.object({
  attempt: AttemptViewSchema,
  activity: z.object({
    id: z.string(),
    title: z.string(),
    type: z.nativeEnum(ActivityType),
    level: z.nativeEnum(Level),
    config: z.unknown().optional(),
  }),
  answers: z.record(z.string(), z.unknown()).optional().default({}),
  mediaId: z.string().nullable().optional(),
  correction: z.record(z.string(), z.unknown()).nullable().optional(),
  attemptToken: z.string().nullable().optional(),
});

export type RuntimeView = z.infer<typeof RuntimeViewSchema>;

export const BadgeAwardViewSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  // guardrails-ignore G-C03: timestamp de solo lectura asignado por el servidor en medalla otorgada
  awardedAt: z.string(),
});

export type BadgeAwardView = z.infer<typeof BadgeAwardViewSchema>;

export const CompletionViewSchema = z.object({
  attempt: AttemptViewSchema,
  correction: z.record(z.string(), z.unknown()).nullable().optional().default(null),
  newBadges: z.array(BadgeAwardViewSchema).optional().default([]),
});

export type CompletionView = z.infer<typeof CompletionViewSchema>;

export const AssignmentCardSchema = z.object({
  id: z.string(),
  activity: z.object({
    id: z.string(),
    title: z.string(),
    type: z.nativeEnum(ActivityType),
    level: z.nativeEnum(Level),
    version: z.number().int().optional(),
    mechanic: z.nativeEnum(GameMechanic).optional(),
  }),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  opensAt: z.string().default(''),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  dueAt: z.string().default(''),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  cancelledAt: z.string().nullable().default(null),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  effectiveDueAt: z.string().default(''),
  latestAttempt: AttemptViewSchema.nullable().default(null),
  canStart: z.boolean().default(true),
  canContinue: z.boolean().default(false),
  retryAvailable: z.boolean().default(false),
});

export type AssignmentCard = z.infer<typeof AssignmentCardSchema>;

export const AssignmentCardListResponseSchema = z.object({
  items: z.array(AssignmentCardSchema),
  total: z.number().int().optional().default(0),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type AssignmentCardListResponse = z.infer<typeof AssignmentCardListResponseSchema>;

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
  answers?: Record<string, unknown>;
}

export interface AttemptResponse {
  id: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  status: AttemptStatus;
}

export const StudentProgressActivityItemSchema = z.object({
  assignmentId: z.string().nullable().optional(),
  attemptId: z.string(),
  activityTitle: z.string().optional(),
  attemptNumber: z.number().int().optional(),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: z.number().nullable().optional().default(0),
  stars: z.number().int().optional().default(0),
});

export type StudentProgressActivityItem = z.infer<typeof StudentProgressActivityItemSchema>;

export const StudentProgressViewSchema = z.object({
  activities: z.array(StudentProgressActivityItemSchema).default([]),
  badges: z.array(BadgeAwardViewSchema).default([]),
  streak: z
    .object({
      weeks: z.number().int().optional().default(0),
      forgivenessAvailable: z.boolean().optional().default(false),
      activeWeeksSinceForgivenessUsed: z.number().int().optional().default(0),
      periodKey: z.string().nullable().optional().default(null),
    })
    .optional()
    .default({
      weeks: 0,
      forgivenessAvailable: false,
      activeWeeksSinceForgivenessUsed: 0,
      periodKey: null,
    }),
});

export type StudentProgressView = z.infer<typeof StudentProgressViewSchema>;

export const StudentProfileViewSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.nativeEnum(Role),
  }),
  student: z.object({
    id: z.string(),
    ageSegment: z.nativeEnum(AgeSegment),
    canSwitchInterface: z.boolean(),
    level: z.nativeEnum(Level).nullable().optional(),
    birthDate: z.string().nullable().optional(),
  }),
});

export type StudentProfileView = z.infer<typeof StudentProfileViewSchema>;

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
  id?: string;
}

export const MediaUploadUrlResponseSchema: z.ZodType<MediaUploadUrlResponse> = z
  .object({
    mediaId: z.string().optional(),
    id: z.string().optional(),
    uploadUrl: z.string(),
    // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
    expiresAt: z.string().optional().default(''),
  })
  .transform((data): MediaUploadUrlResponse => ({
    mediaId: data.mediaId ?? data.id ?? '',
    id: data.id ?? data.mediaId ?? '',
    uploadUrl: data.uploadUrl,
    expiresAt: data.expiresAt,
  }));

export const MediaPlaybackUrlResponseSchema = z.object({
  url: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor en respuesta de intento
  expiresAt: z.string(),
  expiresIn: z.number().optional(),
  isConverted: z.boolean().optional(),
  durationSeconds: z.number().nullable().optional(),
  format: z.enum(['converted', 'raw']),
  compatibilityWarning: z.boolean(),
});

export type MediaPlaybackUrlResponse = z.infer<typeof MediaPlaybackUrlResponseSchema>;

export interface MediaConfirmResponse {
  mediaId: string;
  status: string;
  durationSeconds: number;
  id?: string;
}

export const MediaConfirmResponseSchema: z.ZodType<MediaConfirmResponse> = z
  .object({
    mediaId: z.string().optional(),
    id: z.string().optional(),
    status: z.string().optional().default('ready'),
    durationSeconds: z.number().optional().default(0),
  })
  .transform((data): MediaConfirmResponse => ({
    mediaId: data.mediaId ?? data.id ?? '',
    id: data.id ?? data.mediaId ?? '',
    status: data.status,
    durationSeconds: data.durationSeconds,
  }));
