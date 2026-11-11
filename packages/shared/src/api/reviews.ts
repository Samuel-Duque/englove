import { z } from 'zod';
import { ActivityType, AttemptStatus, AgeSegment, MediaAssetStatus } from '../enums';

export const STICKER_CODES = [
  'great_job',
  'good_pronunciation',
  'creative_answer',
  'grammar_star',
  'super_effort',
  'keep_practicing',
] as const;

export type StickerCode = (typeof STICKER_CODES)[number];

export const StickerCodeSchema = z.enum(STICKER_CODES);

export interface StickerDefinition {
  code: StickerCode;
  label: string;
  emoji: string;
}

export const STICKERS: Readonly<Record<StickerCode, StickerDefinition>> = {
  great_job: { code: 'great_job', label: '¡Excelente trabajo!', emoji: '🌟' },
  good_pronunciation: { code: 'good_pronunciation', label: '¡Muy buena pronunciación!', emoji: '🎙️' },
  creative_answer: { code: 'creative_answer', label: '¡Respuesta muy creativa!', emoji: '💡' },
  grammar_star: { code: 'grammar_star', label: '¡Estrella de la gramática!', emoji: '📚' },
  super_effort: { code: 'super_effort', label: '¡Súper esfuerzo!', emoji: '🚀' },
  keep_practicing: { code: 'keep_practicing', label: '¡Sigue practicando!', emoji: '💪' },
};

export const ReviewStudentViewSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  ageSegment: z.nativeEnum(AgeSegment),
});

export type ReviewStudentView = z.infer<typeof ReviewStudentViewSchema>;

export const ReviewGroupViewSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type ReviewGroupView = z.infer<typeof ReviewGroupViewSchema>;

export const ReviewActivityViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.nativeEnum(ActivityType),
});

export type ReviewActivityView = z.infer<typeof ReviewActivityViewSchema>;

export const ReviewAssignmentViewSchema = z.object({
  id: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  dueAt: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  cancelledAt: z.string().nullable(),
});

export type ReviewAssignmentView = z.infer<typeof ReviewAssignmentViewSchema>;

export const ReviewAttemptSummaryViewSchema = z.object({
  attemptId: z.string(),
  attemptNumber: z.number().int(),
  status: z.nativeEnum(AttemptStatus),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: z.number().nullable(),
  stars: z.number().int(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  finishedAt: z.string().nullable(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  gradedAt: z.string().nullable(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryGrantedAt: z.string().nullable(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryExtendUntil: z.string().nullable(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  effectiveDueAt: z.string(),
  canGrantRetry: z.boolean(),
});

export type ReviewAttemptSummaryView = z.infer<typeof ReviewAttemptSummaryViewSchema>;

export const ReviewFeedbackViewSchema = z.object({
  id: z.string(),
  comment: z.string().nullable(),
  stickers: z.array(StickerCodeSchema),
  reviewerId: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  createdAt: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  updatedAt: z.string(),
});

export type ReviewFeedbackView = z.infer<typeof ReviewFeedbackViewSchema>;

export const ReviewMediaAssetViewSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(MediaAssetStatus),
  durationSeconds: z.number().nullable(),
  isConverted: z.boolean(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retentionUntil: z.string().nullable(),
});

export type ReviewMediaAssetView = z.infer<typeof ReviewMediaAssetViewSchema>;

export const ReviewListItemViewSchema = z.object({
  student: ReviewStudentViewSchema,
  group: ReviewGroupViewSchema,
  activity: ReviewActivityViewSchema,
  assignment: ReviewAssignmentViewSchema,
  attempt: ReviewAttemptSummaryViewSchema,
  review: ReviewFeedbackViewSchema.nullable(),
  mediaAsset: ReviewMediaAssetViewSchema.nullable(),
});

export type ReviewListItemView = z.infer<typeof ReviewListItemViewSchema>;

export const ReviewListResponseSchema = z.object({
  items: z.array(ReviewListItemViewSchema),
  total: z.number().int(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type ReviewListResponse = z.infer<typeof ReviewListResponseSchema>;

export const ReviewItemDetailViewSchema = z.object({
  id: z.string(),
  question: z.string().optional(),
  prompt: z.string().optional(),
  correctAnswer: z.unknown().optional(),
  explanation: z.string().nullable().optional(),
  rubricText: z.string().nullable().optional(),
  maxDurationSeconds: z.number().optional(),
  weight: z.number().optional(),
});

export type ReviewItemDetailView = z.infer<typeof ReviewItemDetailViewSchema>;

export const AttemptHistoryItemViewSchema = z.object({
  attemptId: z.string(),
  attemptNumber: z.number().int(),
  status: z.nativeEnum(AttemptStatus),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: z.number().nullable(),
  stars: z.number().int(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  finishedAt: z.string().nullable(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  gradedAt: z.string().nullable(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryGrantedAt: z.string().nullable(),
  review: z
    .object({
      comment: z.string().nullable(),
      stickers: z.array(StickerCodeSchema),
    })
    .nullable(),
});

export type AttemptHistoryItemView = z.infer<typeof AttemptHistoryItemViewSchema>;

export const AttemptReviewDetailViewSchema = ReviewListItemViewSchema.extend({
  items: z.array(ReviewItemDetailViewSchema).optional().default([]),
  answers: z.record(z.string(), z.unknown()).optional().default({}),
  attemptHistory: z.array(AttemptHistoryItemViewSchema).optional().default([]),
});

export type AttemptReviewDetailView = z.infer<typeof AttemptReviewDetailViewSchema>;

export interface ReviewInput {
  // guardrails-ignore G-C02: calificacion manual exclusiva del profesor en revision
  score?: number;
  comment?: string;
  stickers?: StickerCode[];
  allowRetry?: boolean;
  retryExtendUntil?: string | null;
}

export interface GrantRetryInput {
  retryExtendUntil?: string | null;
}

export const GrantRetryResponseSchema = z.object({
  attemptId: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryGrantedAt: z.string(),
  retryGrantedBy: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryExtendUntil: z.string().nullable(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  effectiveDueAt: z.string(),
});

export type GrantRetryResponse = z.infer<typeof GrantRetryResponseSchema>;

export const StudentFeedbackAttemptViewSchema = z.object({
  id: z.string(),
  attemptNumber: z.number().int(),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: z.number(),
  stars: z.number().int(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  gradedAt: z.string(),
  comment: z.string().nullable(),
  stickers: z
    .array(
      z.object({
        code: StickerCodeSchema,
        label: z.string(),
        emoji: z.string(),
      }),
    )
    .default([]),
});

export type StudentFeedbackAttemptView = z.infer<typeof StudentFeedbackAttemptViewSchema>;

export const StudentFeedbackItemViewSchema = z.object({
  assignmentId: z.string(),
  activityTitle: z.string(),
  activityType: z.nativeEnum(ActivityType),
  latestAttempt: StudentFeedbackAttemptViewSchema,
  hasAvailableRetry: z.boolean(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  effectiveDueAt: z.string(),
  attempts: z.array(StudentFeedbackAttemptViewSchema).default([]),
});

export type StudentFeedbackItemView = z.infer<typeof StudentFeedbackItemViewSchema>;

export const StudentFeedbackListResponseSchema = z.object({
  items: z.array(StudentFeedbackItemViewSchema),
});

export type StudentFeedbackListResponse = z.infer<typeof StudentFeedbackListResponseSchema>;
