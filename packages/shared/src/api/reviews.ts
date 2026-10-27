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

export interface ReviewStudentView {
  id: string;
  displayName: string;
  ageSegment: AgeSegment;
}

export interface ReviewGroupView {
  id: string;
  name: string;
}

export interface ReviewActivityView {
  id: string;
  title: string;
  type: ActivityType;
}

export interface ReviewAssignmentView {
  id: string;
  dueAt: string;
  cancelledAt: string | null;
}

export interface ReviewAttemptSummaryView {
  attemptId: string;
  attemptNumber: number;
  status: AttemptStatus;
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: number | null;
  stars: number;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  finishedAt: string | null;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  gradedAt: string | null;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryGrantedAt: string | null;
  retryExtendUntil: string | null;
  effectiveDueAt: string;
  canGrantRetry: boolean;
}

export interface ReviewFeedbackView {
  id: string;
  comment: string | null;
  stickers: StickerCode[];
  reviewerId: string;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  createdAt: string;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  updatedAt: string;
}

export interface ReviewMediaAssetView {
  id: string;
  status: MediaAssetStatus;
  durationSeconds: number | null;
  isConverted: boolean;
  retentionUntil: string | null;
}

export interface ReviewListItemView {
  student: ReviewStudentView;
  group: ReviewGroupView;
  activity: ReviewActivityView;
  assignment: ReviewAssignmentView;
  attempt: ReviewAttemptSummaryView;
  review: ReviewFeedbackView | null;
  mediaAsset: ReviewMediaAssetView | null;
}

export interface ReviewListResponse {
  items: ReviewListItemView[];
  total: number;
  offset: number;
  limit: number;
}

export interface ReviewItemDetailView {
  id: string;
  question?: string;
  prompt?: string;
  correctAnswer?: unknown;
  explanation?: string | null;
  rubricText?: string | null;
  maxDurationSeconds?: number;
  weight?: number;
}

export interface AttemptHistoryItemView {
  attemptId: string;
  attemptNumber: number;
  status: AttemptStatus;
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: number | null;
  stars: number;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  finishedAt: string | null;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  gradedAt: string | null;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryGrantedAt: string | null;
  review: {
    comment: string | null;
    stickers: StickerCode[];
  } | null;
}

export interface AttemptReviewDetailView extends ReviewListItemView {
  items: ReviewItemDetailView[];
  answers: Record<string, unknown>;
  attemptHistory: AttemptHistoryItemView[];
}

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

export interface GrantRetryResponse {
  attemptId: string;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  retryGrantedAt: string;
  retryGrantedBy: string;
  retryExtendUntil: string | null;
  effectiveDueAt: string;
}

export interface StudentFeedbackAttemptView {
  id: string;
  attemptNumber: number;
  // guardrails-ignore G-C02: campo de solo lectura en respuesta devuelta por el servidor
  score: number;
  stars: number;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  gradedAt: string;
  comment: string | null;
  stickers: StickerDefinition[];
}

export interface StudentFeedbackItemView {
  assignmentId: string;
  activityTitle: string;
  activityType: ActivityType;
  latestAttempt: StudentFeedbackAttemptView;
  hasAvailableRetry: boolean;
  effectiveDueAt: string;
  attempts: StudentFeedbackAttemptView[];
}

export interface StudentFeedbackListResponse {
  items: StudentFeedbackItemView[];
}
