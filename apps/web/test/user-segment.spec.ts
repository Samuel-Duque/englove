import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveUserSegment,
  isUserSegment,
  isTeensOrTeacherSegment,
  syncUserSegment,
  USER_SEGMENT_KEY,
} from '../src/lib/user-segment';
import {
  setSharedSession,
  clearSharedSession,
} from '../src/lib/auth-session';
import { Role, AgeSegment } from '@englove/shared';

describe('User Segment Resolution (SPEC-09 §7, RF-7, P2-10)', () => {
  let mockStorage: Record<string, string> = {};
  let mockAttrs: Record<string, string> = {};
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    mockStorage = {};
    mockAttrs = {};

    globalThis.window = {
      localStorage: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => {
          mockStorage[key] = String(val);
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      },
    } as unknown as Window & typeof globalThis;

    globalThis.document = {
      documentElement: {
        getAttribute: (attr: string) => mockAttrs[attr] ?? null,
        setAttribute: (attr: string, val: string) => {
          mockAttrs[attr] = String(val);
        },
        removeAttribute: (attr: string) => {
          delete mockAttrs[attr];
        },
      },
    } as unknown as Document;

    clearSharedSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      globalThis.window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (globalThis as unknown as { document?: unknown }).document;
    } else {
      globalThis.document = originalDocument;
    }
    vi.restoreAllMocks();
  });

  describe('isUserSegment', () => {
    it('returns true for valid UserSegment values', () => {
      expect(isUserSegment('kids')).toBe(true);
      expect(isUserSegment('teens')).toBe(true);
      expect(isUserSegment('teacher')).toBe(true);
    });

    it('returns false for invalid values', () => {
      expect(isUserSegment('admin')).toBe(false);
      expect(isUserSegment('')).toBe(false);
      expect(isUserSegment(null)).toBe(false);
      expect(isUserSegment(undefined)).toBe(false);
      expect(isUserSegment(123)).toBe(false);
    });
  });

  describe('isTeensOrTeacherSegment', () => {
    it('returns true for teens and teacher', () => {
      expect(isTeensOrTeacherSegment('teens')).toBe(true);
      expect(isTeensOrTeacherSegment('teacher')).toBe(true);
    });

    it('returns false for kids, null, or undefined', () => {
      expect(isTeensOrTeacherSegment('kids')).toBe(false);
      expect(isTeensOrTeacherSegment(null)).toBe(false);
      expect(isTeensOrTeacherSegment(undefined)).toBe(false);
      expect(isTeensOrTeacherSegment('unknown')).toBe(false);
    });
  });

  describe('syncUserSegment', () => {
    it('stores the segment in localStorage', () => {
      syncUserSegment('teens');
      expect(window.localStorage.getItem(USER_SEGMENT_KEY)).toBe('teens');

      syncUserSegment('teacher');
      expect(window.localStorage.getItem(USER_SEGMENT_KEY)).toBe('teacher');
    });

    it('dispatches USER_SEGMENT_EVENT on window when segment changes', () => {
      const dispatchSpy = vi.fn();
      (window as unknown as { dispatchEvent: (ev: Event) => boolean }).dispatchEvent = dispatchSpy;

      syncUserSegment('teens');
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const eventArg = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
      expect(eventArg.type).toBe('englove_segment_change');
      expect(eventArg.detail).toBe('teens');
    });

    it('removes the segment from localStorage when null', () => {
      syncUserSegment('kids');
      expect(window.localStorage.getItem(USER_SEGMENT_KEY)).toBe('kids');

      syncUserSegment(null);
      expect(window.localStorage.getItem(USER_SEGMENT_KEY)).toBeNull();
    });
  });

  describe('resolveUserSegment priority', () => {
    it('defaults to kids when unauthenticated and empty', () => {
      expect(resolveUserSegment()).toBe('kids');
    });

    it('resolves teacher from active session user.role', () => {
      setSharedSession({
        user: {
          id: 'u-1',
          name: 'Teacher One',
          email: 'teacher@englove.edu',
          role: Role.teacher,
        },
        student: null,
      });

      expect(resolveUserSegment()).toBe('teacher');
    });

    it('resolves teens from active student session ageSegment', () => {
      setSharedSession({
        user: {
          id: 'u-2',
          name: 'Teen Student',
          email: 'teen@englove.edu',
          role: Role.student,
        },
        student: {
          id: 's-2',
          ageSegment: AgeSegment.teens,
          canSwitchInterface: true,
        },
      });

      expect(resolveUserSegment()).toBe('teens');
    });

    it('resolves kids from active student session ageSegment', () => {
      setSharedSession({
        user: {
          id: 'u-3',
          name: 'Kid Student',
          email: 'kid@englove.edu',
          role: Role.student,
        },
        student: {
          id: 's-3',
          ageSegment: AgeSegment.kids,
          canSwitchInterface: false,
        },
      });

      expect(resolveUserSegment()).toBe('kids');
    });

    it('resolves from localStorage englove_segment when no in-memory session', () => {
      mockStorage[USER_SEGMENT_KEY] = 'teacher';
      expect(resolveUserSegment()).toBe('teacher');

      mockStorage[USER_SEGMENT_KEY] = 'teens';
      expect(resolveUserSegment()).toBe('teens');
    });

    it('resolves from document data-theme attribute as fallback', () => {
      mockAttrs['data-theme'] = 'teens';
      expect(resolveUserSegment()).toBe('teens');

      mockAttrs['data-theme'] = 'teacher';
      expect(resolveUserSegment()).toBe('teacher');
    });

    it('resolves teacher from active admin session role', () => {
      setSharedSession({
        user: {
          id: 'u-admin',
          name: 'Admin User',
          email: 'admin@englove.edu',
          role: Role.admin,
        },
        student: null,
      });

      expect(resolveUserSegment()).toBe('teacher');
    });

    it('resolves teacher from panel route pathname when session is empty', () => {
      (globalThis.window as unknown as { location: { pathname: string } }).location = {
        pathname: '/alumnos/123',
      };
      expect(resolveUserSegment()).toBe('teacher');

      (globalThis.window as unknown as { location: { pathname: string } }).location = {
        pathname: '/estadisticas',
      };
      expect(resolveUserSegment()).toBe('teacher');
    });

    it('clearSharedSession cleans englove_segment from localStorage', () => {
      setSharedSession({
        user: {
          id: 'u-1',
          name: 'Teacher',
          email: 't@englove.edu',
          role: Role.teacher,
        },
        student: null,
      });
      expect(mockStorage[USER_SEGMENT_KEY]).toBe('teacher');

      clearSharedSession();
      expect(mockStorage[USER_SEGMENT_KEY]).toBeUndefined();
      expect(resolveUserSegment()).toBe('kids');
    });
  });
});
