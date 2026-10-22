import { describe, it, expect } from 'vitest';
import {
  AssignmentAvailability,
  deriveAssignmentAvailability,
  getExtendedDueAt,
  formatBogotaDateTime,
} from '../src';

describe('SPEC-04: Asignación — Shared contracts & helpers', () => {
  it('AssignmentAvailability contains scheduled, open, closed, cancelled', () => {
    expect(Object.values(AssignmentAvailability).sort()).toEqual([
      'cancelled',
      'closed',
      'open',
      'scheduled',
    ]);
  });

  describe('deriveAssignmentAvailability (RF-6, RF-11, Section 4)', () => {
    const opensAt = new Date('2026-11-01T10:00:00.000Z');
    const dueAt = new Date('2026-11-05T18:00:00.000Z');

    it('returns scheduled when current time is strictly before opensAt', () => {
      const now = new Date('2026-11-01T09:59:59.999Z');
      expect(deriveAssignmentAvailability(now, opensAt, dueAt)).toBe('scheduled');
    });

    it('returns open at the exact instant of opensAt', () => {
      const now = new Date('2026-11-01T10:00:00.000Z');
      expect(deriveAssignmentAvailability(now, opensAt, dueAt)).toBe('open');
    });

    it('returns open within the window', () => {
      const now = new Date('2026-11-03T12:00:00.000Z');
      expect(deriveAssignmentAvailability(now, opensAt, dueAt)).toBe('open');
    });

    it('returns open at the exact instant of dueAt', () => {
      const now = new Date('2026-11-05T18:00:00.000Z');
      expect(deriveAssignmentAvailability(now, opensAt, dueAt)).toBe('open');
    });

    it('returns closed when current time is strictly after dueAt', () => {
      const now = new Date('2026-11-05T18:00:00.001Z');
      expect(deriveAssignmentAvailability(now, opensAt, dueAt)).toBe('closed');
    });

    it('returns cancelled when cancelledAt is set, having highest priority (decision 98)', () => {
      const cancelledAt = new Date('2026-10-30T10:00:00.000Z');

      // Before opensAt
      expect(
        deriveAssignmentAvailability(new Date('2026-10-31T00:00:00.000Z'), opensAt, dueAt, cancelledAt),
      ).toBe('cancelled');

      // During open window
      expect(
        deriveAssignmentAvailability(new Date('2026-11-02T00:00:00.000Z'), opensAt, dueAt, cancelledAt),
      ).toBe('cancelled');

      // After dueAt
      expect(
        deriveAssignmentAvailability(new Date('2026-11-06T00:00:00.000Z'), opensAt, dueAt, cancelledAt),
      ).toBe('cancelled');
    });

    it('works with ISO strings as inputs', () => {
      const now = new Date('2026-11-02T00:00:00.000Z');
      expect(
        deriveAssignmentAvailability(
          now,
          '2026-11-01T10:00:00.000Z',
          '2026-11-05T18:00:00.000Z',
        ),
      ).toBe('open');
    });
  });

  describe('getExtendedDueAt (RF-7, decision 60)', () => {
    it('adds exactly 24 hours to dueAt', () => {
      const dueAt = new Date('2026-11-04T23:00:00.000Z');
      const extended = getExtendedDueAt(dueAt);
      expect(extended.getTime() - dueAt.getTime()).toBe(24 * 60 * 60 * 1000);
      expect(extended.toISOString()).toBe('2026-11-05T23:00:00.000Z');
    });
  });

  describe('formatBogotaDateTime (RF-7, architecture §13)', () => {
    it('formats UTC time in America/Bogota (UTC-5)', () => {
      // 2026-11-04T23:00:00.000Z -> 2026-11-04 18:00 in Colombia
      const formatted = formatBogotaDateTime('2026-11-04T23:00:00.000Z');
      expect(formatted).toContain('4');
      expect(formatted).toContain('noviembre');
      expect(formatted).toMatch(/6:00/);
    });
  });
});
