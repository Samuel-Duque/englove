import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSharedSession,
  requestSharedRefresh,
  setSharedSession,
  getSharedSession,
  clearSharedSession,
  fetchSharedProfile,
  clearSharedProfile,
} from '../src/lib/auth-session';
import type { SessionView, StudentProfileView } from '@englove/shared';
import { Role, AgeSegment, Level } from '@englove/shared';

describe('P0-02, P0-03, QA-02: auth-session continuous session and refresh coordination', () => {
  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;

  const mockSession: SessionView = {
    user: {
      id: 'usr-1111-2222',
      name: 'Sofia Alumna',
      email: 'sofia@escuela.co',
      role: Role.student,
    },
    student: {
      id: 'std-1111-2222',
      ageSegment: AgeSegment.kids,
      canSwitchInterface: false,
    },
  };

  const mockProfile: StudentProfileView = {
    user: mockSession.user,
    student: {
      ...mockSession.student!,
      level: Level.A1,
    },
  };

  beforeEach(() => {
    clearSharedSession();
    clearSharedProfile();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe('fetchSharedSession (P0-03, QA-02)', () => {
    it('queries GET /api/v1/auth/session and caches the result', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSession,
      });
      globalThis.fetch = mockFetch;

      const session1 = await fetchSharedSession();
      expect(session1).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/session'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );

      // Second call without force reuses cache
      const session2 = await fetchSharedSession();
      expect(session2).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('clears cachedSession and returns null when endpoint returns 401', async () => {
      setSharedSession(mockSession);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const session = await fetchSharedSession(true);
      expect(session).toBeNull();
      expect(getSharedSession()).toBeNull();
    });

    it('throws SERVER_ERROR when endpoint returns 500', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(fetchSharedSession(true)).rejects.toThrow('SERVER_ERROR_500');
    });

    it('throws NETWORK_ERROR on connection failure so UI does not loop redirect', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      await expect(fetchSharedSession(true)).rejects.toThrow('NETWORK_ERROR');
    });

    it('deduplicates concurrent in-flight fetchSharedSession calls', async () => {
      let resolvePromise: (val: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const mockFetch = vi.fn().mockReturnValue(
        delayedPromise.then(() => ({
          ok: true,
          status: 200,
          json: async () => mockSession,
        })),
      );
      globalThis.fetch = mockFetch;

      const call1 = fetchSharedSession(true);
      const call2 = fetchSharedSession(true);

      resolvePromise!(true);

      const [res1, res2] = await Promise.all([call1, call2]);
      expect(res1).toEqual(mockSession);
      expect(res2).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestSharedRefresh (P0-03, QA-02)', () => {
    it('executes POST /api/v1/auth/refresh and updates cached session', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSession,
      });
      globalThis.fetch = mockFetch;

      const success = await requestSharedRefresh();
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/refresh'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      expect(getSharedSession()).toEqual(mockSession);
    });

    it('returns false when refresh endpoint responds with 401', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const success = await requestSharedRefresh();
      expect(success).toBe(false);
      expect(getSharedSession()).toBeNull();
    });

    it('returns true without HTTP request if refreshed within last 2 seconds and session is present', async () => {
      setSharedSession(mockSession);

      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      const refreshed = await requestSharedRefresh();
      expect(refreshed).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('deduplicates concurrent calls in memory via single-flight refreshPromise', async () => {
      let resolvePromise: (val: unknown) => void;
      const delayed = new Promise((res) => {
        resolvePromise = res;
      });

      const mockFetch = vi.fn().mockReturnValue(
        delayed.then(() => ({
          ok: true,
          status: 200,
          json: async () => mockSession,
        })),
      );
      globalThis.fetch = mockFetch;

      // Ensure lastSuccessfulRefresh is stale
      clearSharedSession();

      const call1 = requestSharedRefresh();
      const call2 = requestSharedRefresh();

      resolvePromise!(true);

      const [res1, res2] = await Promise.all([call1, call2]);
      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('coordinates refresh using navigator.locks when available', async () => {
      const mockLockRequest = vi.fn().mockImplementation(async (lockName: string, callback: () => Promise<boolean>) => {
        expect(lockName).toBe('englove_auth_refresh');
        return callback();
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          locks: {
            request: mockLockRequest,
          },
        },
        configurable: true,
        writable: true,
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSession,
      });

      const success = await requestSharedRefresh();
      expect(success).toBe(true);
      expect(mockLockRequest).toHaveBeenCalledTimes(1);
    });

    it('when another tab refreshed within last 3 seconds, verifies session via GET /auth/session without double-rotating (P0-03, QA-02)', async () => {
      // Simulate another tab having completed a refresh 500ms ago and storing timestamp in localStorage
      const mockStorage: Record<string, string> = {
        englove_tab_sync_ts: String(Date.now() - 500),
      };
      const mockWindow = {
        localStorage: {
          getItem: (key: string) => mockStorage[key] ?? null,
          setItem: (key: string, val: string) => { mockStorage[key] = val; },
          removeItem: (key: string) => { delete mockStorage[key]; },
        },
      };
      (globalThis as unknown as { window: unknown }).window = mockWindow;

      const mockLockRequest = vi.fn().mockImplementation(async (_lockName: string, callback: () => Promise<boolean>) => {
        return callback();
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          locks: {
            request: mockLockRequest,
          },
        },
        configurable: true,
        writable: true,
      });

      // GET /api/v1/auth/session returns 200 with the active session
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSession,
      });
      globalThis.fetch = mockFetch;

      const success = await requestSharedRefresh();
      expect(success).toBe(true);
      // Confirmed: queried GET /auth/session instead of POST /auth/refresh
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/session'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/refresh'),
        expect.anything(),
      );
      expect(getSharedSession()).toEqual(mockSession);

      delete (globalThis as unknown as { window?: unknown }).window;
    });
  });

  describe('fetchSharedProfile', () => {
    it('caches student profile within TTL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockProfile,
      });

      const p1 = await fetchSharedProfile();
      expect(p1).toEqual(mockProfile);

      const p2 = await fetchSharedProfile();
      expect(p2).toEqual(mockProfile);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('clearSharedProfile invalidates the cached profile', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockProfile,
      });

      await fetchSharedProfile();
      clearSharedProfile();
      await fetchSharedProfile();

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
