import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isVersionOlder,
  getPwaUpdateState,
  checkAppMinVersion,
  setActiveAttemptState,
  dismissUpdateNotice,
  applyUpdate,
  registerServiceWorker,
  _resetPwaManagerState,
} from '../src/lib/pwa-manager';

describe('SPEC-09 RF-6, RF-7, RF-8, RF-9: PWA Update Manager', () => {
  beforeEach(() => {
    _resetPwaManagerState();
    vi.restoreAllMocks();
  });

  describe('SemVer comparison (RF-7)', () => {
    it('correctly compares SemVer versions component by component', () => {
      expect(isVersionOlder('0.0.1', '0.0.2')).toBe(true);
      expect(isVersionOlder('0.0.2', '0.0.1')).toBe(false);
      expect(isVersionOlder('0.1.0', '1.0.0')).toBe(true);
      expect(isVersionOlder('1.0.0', '0.9.9')).toBe(false);
      expect(isVersionOlder('1.2.3', '1.2.4')).toBe(true);
      expect(isVersionOlder('1.2.4', '1.2.3')).toBe(false);
      expect(isVersionOlder('1.2.3', '1.2.3')).toBe(false);
    });

    it('handles missing minor/patch components safely', () => {
      expect(isVersionOlder('1.0', '1.0.1')).toBe(true);
      expect(isVersionOlder('1.0.1', '1.0')).toBe(false);
    });
  });

  describe('RF-6 & RF-7: Banner visibility and dismissal rules', () => {
    it('maintains referential stability for useSyncExternalStore', () => {
      const state1 = getPwaUpdateState();
      const state2 = getPwaUpdateState();
      expect(state1).toBe(state2); // Same object reference
    });

    it('banner is hidden by default when no update is available', () => {
      const state = getPwaUpdateState();
      expect(state.shouldShowBanner).toBe(false);
      expect(state.isMandatory).toBe(false);
    });

    it('shows mandatory banner when API reports higher X-App-Min-Version (RF-7)', () => {
      checkAppMinVersion('99.0.0');
      const state = getPwaUpdateState();
      expect(state.isMinVersionRequired).toBe(true);
      expect(state.isMandatory).toBe(true);
      expect(state.shouldShowBanner).toBe(true);
    });

    it('mandatory update cannot be dismissed with Ahora no (RF-7)', () => {
      checkAppMinVersion('99.0.0');
      dismissUpdateNotice(); // Attempt to dismiss
      const state = getPwaUpdateState();
      expect(state.isDismissedByUser).toBe(false);
      expect(state.shouldShowBanner).toBe(true);
    });

    it('does not trigger mandatory update if API version is equal or lower', () => {
      checkAppMinVersion('0.0.1');
      const state = getPwaUpdateState();
      expect(state.isMinVersionRequired).toBe(false);
      expect(state.shouldShowBanner).toBe(false);
    });
  });

  describe('RF-9: Deferral during active attempt', () => {
    it('defers update banner when student is inside an active attempt', () => {
      // Trigger an update
      checkAppMinVersion('99.0.0');
      expect(getPwaUpdateState().shouldShowBanner).toBe(true);

      // Student enters active attempt
      setActiveAttemptState(true);
      const inAttemptState = getPwaUpdateState();
      expect(inAttemptState.isInActiveAttempt).toBe(true);
      expect(inAttemptState.shouldShowBanner).toBe(false); // Banner hidden!

      // Student completes or exits attempt
      setActiveAttemptState(false);
      const exitedState = getPwaUpdateState();
      expect(exitedState.isInActiveAttempt).toBe(false);
      expect(exitedState.shouldShowBanner).toBe(true); // Banner reappears!
    });
  });

  describe('RF-8: Applying the update', () => {
    it('triggers reload fallback after timeout if no controllerchange occurs', () => {
      vi.useFakeTimers();
      const reloadMock = vi.fn();
      const prevWindow = (globalThis as unknown as { window?: unknown }).window;
      (globalThis as unknown as { window: unknown }).window = {
        location: { reload: reloadMock },
      };

      applyUpdate();
      expect(reloadMock).not.toHaveBeenCalled();

      // Advance 10 seconds (RF-8 fallback)
      vi.advanceTimersByTime(10000);
      expect(reloadMock).toHaveBeenCalledTimes(1);

      // Restore
      if (prevWindow === undefined) {
        delete (globalThis as unknown as { window?: unknown }).window;
      } else {
        (globalThis as unknown as { window: unknown }).window = prevWindow;
      }
      vi.useRealTimers();
    });
  });

  describe('registerServiceWorker lifecycle', () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    afterEach(() => {
      vi.unstubAllEnvs();
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
      if (originalNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
      }
    });

    it('does not register in non-production environments', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const registerSpy = vi.fn().mockResolvedValue({} as ServiceWorkerRegistration);
      globalThis.window = {} as unknown as Window & typeof globalThis;
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: { register: registerSpy },
        },
        configurable: true,
        writable: true,
      });

      registerServiceWorker();
      expect(registerSpy).not.toHaveBeenCalled();
    });

    it('registers immediately if document.readyState is already complete in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const registerSpy = vi.fn().mockReturnValue(new Promise(() => {}));
      const addEventListenerSpy = vi.fn();

      globalThis.window = {
        addEventListener: addEventListenerSpy,
      } as unknown as Window & typeof globalThis;

      globalThis.document = {
        readyState: 'complete',
      } as unknown as Document;

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            register: registerSpy,
            addEventListener: vi.fn(),
          },
        },
        configurable: true,
        writable: true,
      });

      registerServiceWorker();
      expect(registerSpy).toHaveBeenCalledWith('/sw.js', { scope: '/' });
      expect(addEventListenerSpy).not.toHaveBeenCalledWith('load', expect.any(Function));
    });

    it('waits for window load event if document is still loading in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const registerSpy = vi.fn().mockReturnValue(new Promise(() => {}));
      let loadCallback: (() => void) | undefined;
      const addEventListenerSpy = vi.fn().mockImplementation((ev, cb) => {
        if (ev === 'load') loadCallback = cb;
      });

      globalThis.window = {
        addEventListener: addEventListenerSpy,
      } as unknown as Window & typeof globalThis;

      globalThis.document = {
        readyState: 'loading',
      } as unknown as Document;

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            register: registerSpy,
            addEventListener: vi.fn(),
          },
        },
        configurable: true,
        writable: true,
      });

      registerServiceWorker();
      expect(registerSpy).not.toHaveBeenCalled();
      expect(loadCallback).toBeDefined();

      loadCallback?.();
      expect(registerSpy).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    });
  });
});
