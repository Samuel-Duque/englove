export const Role = {
  teacher: 'teacher',
  student: 'student',
  parent: 'parent',
  admin: 'admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Level = {
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  B2: 'B2',
} as const;
export type Level = (typeof Level)[keyof typeof Level];

export const AgeSegment = {
  kids: 'kids',
  teens: 'teens',
} as const;
export type AgeSegment = (typeof AgeSegment)[keyof typeof AgeSegment];

export const ActivityType = {
  fill_blank: 'fill_blank',
  open_question: 'open_question',
  speaking: 'speaking',
  game: 'game',
  exam: 'exam',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const ActivityStatus = {
  draft: 'draft',
  published: 'published',
  archived: 'archived',
} as const;
export type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus];

export const GameMechanic = {
  match: 'match',
  order_words: 'order_words',
  drag_drop: 'drag_drop',
  memory: 'memory',
  timed_choice: 'timed_choice',
} as const;
export type GameMechanic = (typeof GameMechanic)[keyof typeof GameMechanic];

export const AttemptStatus = {
  in_progress: 'in_progress',
  pending_review: 'pending_review',
  graded: 'graded',
  abandoned: 'abandoned',
} as const;
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export const ApprovalStatus = {
  pending_approval: 'pending_approval',
  approved: 'approved',
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const ProgressEventType = {
  attempt_completed: 'attempt_completed',
  audio_submitted: 'audio_submitted',
  review_received: 'review_received',
  retry_granted: 'retry_granted',
  streak_week: 'streak_week',
  badge_awarded: 'badge_awarded',
} as const;
export type ProgressEventType = (typeof ProgressEventType)[keyof typeof ProgressEventType];

export const MediaAssetStatus = {
  pending_upload: 'pending_upload',
  ready: 'ready',
  pending_delete: 'pending_delete',
  deleted: 'deleted',
} as const;
export type MediaAssetStatus = (typeof MediaAssetStatus)[keyof typeof MediaAssetStatus];

export const AuditAction = {
  student_email_changed: 'student_email_changed',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const JobRunStatus = {
  running: 'running',
  done: 'done',
  failed: 'failed',
} as const;
export type JobRunStatus = (typeof JobRunStatus)[keyof typeof JobRunStatus];

export const AssignmentAvailability = {
  scheduled: 'scheduled',
  open: 'open',
  closed: 'closed',
  cancelled: 'cancelled',
} as const;
export type AssignmentAvailability =
  (typeof AssignmentAvailability)[keyof typeof AssignmentAvailability];

