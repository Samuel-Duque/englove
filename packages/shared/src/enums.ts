export enum Role {
  teacher = 'teacher',
  student = 'student',
  parent = 'parent',
  admin = 'admin',
}

export enum Level {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
}

export enum AgeSegment {
  kids = 'kids',
  teens = 'teens',
}

export enum ActivityType {
  fill_blank = 'fill_blank',
  open_question = 'open_question',
  speaking = 'speaking',
  game = 'game',
  exam = 'exam',
}

export enum ActivityStatus {
  draft = 'draft',
  published = 'published',
  archived = 'archived',
}

export enum GameMechanic {
  match = 'match',
  order_words = 'order_words',
  drag_drop = 'drag_drop',
  memory = 'memory',
  timed_choice = 'timed_choice',
}

export enum AttemptStatus {
  in_progress = 'in_progress',
  pending_review = 'pending_review',
  graded = 'graded',
  abandoned = 'abandoned',
}

export enum ApprovalStatus {
  pending_approval = 'pending_approval',
  approved = 'approved',
}

export enum ProgressEventType {
  attempt_completed = 'attempt_completed',
  audio_submitted = 'audio_submitted',
  review_received = 'review_received',
  retry_granted = 'retry_granted',
  streak_week = 'streak_week',
  badge_awarded = 'badge_awarded',
}

export enum MediaAssetStatus {
  pending_upload = 'pending_upload',
  ready = 'ready',
  pending_delete = 'pending_delete',
  deleted = 'deleted',
}

export enum AuditAction {
  student_email_changed = 'student_email_changed',
}

export enum JobRunStatus {
  running = 'running',
  done = 'done',
  failed = 'failed',
}
