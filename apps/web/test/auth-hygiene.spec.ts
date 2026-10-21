import { describe, it, expect, vi, afterEach } from 'vitest';
import { clearSharedDeviceSession } from '../src/lib/auth-hygiene';

describe('RF-18: client-side storage hygiene on shared devices', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    // Restore global window
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      globalThis.window = originalWindow;
    }
    vi.restoreAllMocks();
  });

  it('runs safely in SSR / Node environment where window is undefined', async () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    await expect(clearSharedDeviceSession()).resolves.toBeUndefined();
  });

  it('clears sessionStorage when available on logout', async () => {
    const mockClear = vi.fn();
    (globalThis as unknown as { window: unknown }).window = {
      sessionStorage: {
        clear: mockClear,
      },
    };

    await clearSharedDeviceSession();
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('clears pendingEvents and pendingUploads in IndexedDB offline stores and awaits completion', async () => {
    const mockStoreClear1 = vi.fn();
    const mockStoreClear2 = vi.fn();
    const mockClose = vi.fn();

    const mockDb = {
      objectStoreNames: {
        contains: (name: string) => name === 'pendingEvents' || name === 'pendingUploads',
      },
      transaction: vi.fn((storeName: string) => ({
        objectStore: () => ({
          clear: storeName === 'pendingEvents' ? mockStoreClear1 : mockStoreClear2,
        }),
      })),
      close: mockClose,
    };

    const mockOpen = vi.fn().mockImplementation(() => {
      const req: {
        result: typeof mockDb;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        onblocked: (() => void) | null;
      } = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      // Trigger onsuccess asynchronously
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
      }, 5);
      return req;
    });

    (globalThis as unknown as { window: unknown }).window = {
      indexedDB: {
        open: mockOpen,
      },
      sessionStorage: {
        clear: vi.fn(),
      },
    };

    // Await genuinely completes the purge without hacky external sleep
    await clearSharedDeviceSession();

    expect(mockOpen).toHaveBeenCalledWith('englove_offline');
    expect(mockOpen).toHaveBeenCalledWith('englove_storage');
    expect(mockStoreClear1).toHaveBeenCalled();
    expect(mockStoreClear2).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('handles IndexedDB onerror safely when browser private browsing blocks storage access', async () => {
    const mockOpen = vi.fn().mockImplementation(() => {
      const req: {
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
      } = {
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => {
        if (req.onerror) req.onerror();
      }, 5);
      return req;
    });

    (globalThis as unknown as { window: unknown }).window = {
      indexedDB: {
        open: mockOpen,
      },
      sessionStorage: {
        clear: vi.fn(),
      },
    };

    await expect(clearSharedDeviceSession()).resolves.toBeUndefined();
    expect(mockOpen).toHaveBeenCalled();
  });

  it('gracefully catches exceptions when sessionStorage or indexedDB throw synchronous errors', async () => {
    (globalThis as unknown as { window: unknown }).window = {
      indexedDB: {
        open: () => {
          throw new Error('IndexedDB blocked by security policy');
        },
      },
      sessionStorage: {
        clear: () => {
          throw new Error('QuotaExceeded or SecurityError');
        },
      },
    };

    await expect(clearSharedDeviceSession()).resolves.toBeUndefined();
  });
});
