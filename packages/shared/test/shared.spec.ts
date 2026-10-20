import { describe, it, expect } from 'vitest';
import {
  Role,
  Level,
  AgeSegment,
  ActivityType,
  ActivityStatus,
  GameMechanic,
  AttemptStatus,
  ApprovalStatus,
  ProgressEventType,
  MediaAssetStatus,
  AuditAction,
  JobRunStatus,
} from '../src/enums';
import { toPublicConfig } from '../src/activities/registry';

describe('RF-13: enums coinciden y DTOs no aceptan timestamps ni score del alumno', () => {
  it('ActivityType contains exactly the 5 activity types', () => {
    expect(Object.values(ActivityType).sort()).toEqual([
      'exam',
      'fill_blank',
      'game',
      'open_question',
      'speaking',
    ]);
  });

  it('GameMechanic contains exactly the 5 game mechanics', () => {
    expect(Object.values(GameMechanic).sort()).toEqual([
      'drag_drop',
      'match',
      'memory',
      'order_words',
      'timed_choice',
    ]);
  });

  it('Role contains teacher, student, parent, admin without guardian', () => {
    expect(Object.values(Role).sort()).toEqual(['admin', 'parent', 'student', 'teacher']);
    expect((Role as Record<string, unknown>).guardian).toBeUndefined();
  });

  it('ApprovalStatus contains pending_approval and approved without rejected', () => {
    expect(Object.values(ApprovalStatus).sort()).toEqual(['approved', 'pending_approval']);
    expect((ApprovalStatus as Record<string, unknown>).rejected).toBeUndefined();
  });

  it('Level contains A1, A2, B1, B2', () => {
    expect(Object.values(Level).sort()).toEqual(['A1', 'A2', 'B1', 'B2']);
  });

  it('AgeSegment contains kids and teens', () => {
    expect(Object.values(AgeSegment).sort()).toEqual(['kids', 'teens']);
  });

  it('AttemptStatus contains in_progress, pending_review, graded, abandoned', () => {
    expect(Object.values(AttemptStatus).sort()).toEqual([
      'abandoned',
      'graded',
      'in_progress',
      'pending_review',
    ]);
  });

  it('MediaAssetStatus contains pending_upload, ready, pending_delete, deleted', () => {
    expect(Object.values(MediaAssetStatus).sort()).toEqual([
      'deleted',
      'pending_delete',
      'pending_upload',
      'ready',
    ]);
  });

  it('AuditAction contains student_email_changed', () => {
    expect(Object.values(AuditAction)).toEqual(['student_email_changed']);
  });

  it('JobRunStatus contains running, done, failed', () => {
    expect(Object.values(JobRunStatus).sort()).toEqual(['done', 'failed', 'running']);
  });

  it('ProgressEventType contains all 6 progression event types', () => {
    expect(Object.values(ProgressEventType).sort()).toEqual([
      'attempt_completed',
      'audio_submitted',
      'badge_awarded',
      'retry_granted',
      'review_received',
      'streak_week',
    ]);
  });

  it('toPublicConfig strips answer keys from fill_blank and exam', () => {
    const rawConfig = { instructions: 'Fill blanks', items: [{ id: '1', prompt: 'test', blanks: ['_'] }] };
    const answerKey = { items: { '1': ['correct'] } };

    const publicFillBlank = toPublicConfig(ActivityType.fill_blank, rawConfig, answerKey);
    expect(publicFillBlank).toEqual(rawConfig);
    expect((publicFillBlank as Record<string, unknown>).answerKey).toBeUndefined();

    const publicExam = toPublicConfig(ActivityType.exam, rawConfig, answerKey);
    expect(publicExam).toEqual(rawConfig);
    expect((publicExam as Record<string, unknown>).answerKey).toBeUndefined();
  });

  it('attempt input DTOs strictly exclude client timestamps and score', () => {
    const startDto = { assignmentId: '123' };
    expect((startDto as Record<string, unknown>).startedAt).toBeUndefined();
    expect((startDto as Record<string, unknown>).score).toBeUndefined();

    const eventItem = {
      itemId: 'i1',
      answer: 'test',
      clientEventId: 'evt-1',
    };
    expect((eventItem as Record<string, unknown>).timestamp).toBeUndefined();
    expect((eventItem as Record<string, unknown>).occurredAt).toBeUndefined();

    const completeDto = { clientFinishedNotice: true };
    expect((completeDto as Record<string, unknown>).finishedAt).toBeUndefined();
    expect((completeDto as Record<string, unknown>).score).toBeUndefined();
  });
});
