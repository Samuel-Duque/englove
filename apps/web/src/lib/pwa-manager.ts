/**
 * PWA Service Worker & Update Manager (SPEC-09 ENG-110, RF-2, RF-6, RF-7, RF-8, RF-9)
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.1';

export function isVersionOlder(currentVersion: string, minRequiredVersion: string): boolean {
  const current = currentVersion.split('.').map((p) => parseInt(p, 10) || 0);
  const min = minRequiredVersion.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const c = current[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

export interface PwaUpdateState {
  isWaitingSwAvailable: boolean;
  isMinVersionRequired: boolean;
  isDismissedByUser: boolean;
  isInActiveAttempt: boolean;
  shouldShowBanner: boolean;
  isMandatory: boolean;
}

let swRegistration: ServiceWorkerRegistration | null = null;
let isWaitingSwAvailable = false;
let isMinVersionRequired = false;
let isDismissedByUser = false;
let isInActiveAttempt = false;
let updateIntervalId: NodeJS.Timeout | null = null;
let isControllerChangeListening = false;
let updateRequested = false;
let reloadPending = false;
let hasReloaded = false;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

function reloadRequestedUpdate(): void {
  if (!updateRequested || hasReloaded || typeof window === 'undefined') return;
  if (isInActiveAttempt) {
    reloadPending = true;
    return;
  }
  hasReloaded = true;
  reloadPending = false;
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = null;
  window.location.reload();
}

const listeners = new Set<() => void>();

function computeSnapshot(): PwaUpdateState {
  const isMandatory = isMinVersionRequired;
  const updateAvailable = isWaitingSwAvailable || isMinVersionRequired;
  const shouldShowBanner =
    updateAvailable &&
    !isInActiveAttempt &&
    (isMandatory || !isDismissedByUser);

  return {
    isWaitingSwAvailable,
    isMinVersionRequired,
    isDismissedByUser,
    isInActiveAttempt,
    shouldShowBanner,
    isMandatory,
  };
}

let cachedSnapshot: PwaUpdateState = computeSnapshot();

function updateSnapshotAndNotify() {
  cachedSnapshot = computeSnapshot();
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function getPwaUpdateState(): PwaUpdateState {
  return cachedSnapshot;
}

export function subscribePwaUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setActiveAttemptState(active: boolean): void {
  if (isInActiveAttempt !== active) {
    isInActiveAttempt = active;
    updateSnapshotAndNotify();
    if (!active && reloadPending) reloadRequestedUpdate();
  }
}

export function dismissUpdateNotice(): void {
  if (!isMinVersionRequired) {
    isDismissedByUser = true;
    updateSnapshotAndNotify();
  }
}

export function checkAppMinVersion(minVersion: string | null): void {
  if (!minVersion) return;
  if (isVersionOlder(APP_VERSION, minVersion)) {
    if (!isMinVersionRequired) {
      isMinVersionRequired = true;
      updateSnapshotAndNotify();
    }
  }
}

export function applyUpdate(): void {
  if (isInActiveAttempt || updateRequested) return;
  updateRequested = true;

  // Fallback reload after 10 seconds (RF-8)
  reloadTimer = setTimeout(reloadRequestedUpdate, 10000);

  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else if (swRegistration) {
    swRegistration.update().catch(() => {});
  }
}

export function registerServiceWorker(): void {
  // RF-2: Register only in production builds in browser
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    process.env.NODE_ENV !== 'production'
  ) {
    return;
  }

  // Prevent multiple registrations
  if (swRegistration) return;

  const startRegistration = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        swRegistration = registration;

        // Check if there is already a waiting worker
        if (registration.waiting) {
          isWaitingSwAvailable = true;
          updateSnapshotAndNotify();
        }

        // Listen for new worker installed and waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                isWaitingSwAvailable = true;
                updateSnapshotAndNotify();
              }
            });
          }
        });

        // RF-2: Check for updates every 60 minutes
        if (!updateIntervalId) {
          updateIntervalId = setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        }
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });

    // RF-8: Reload only once when new SW takes control
    if (!isControllerChangeListening) {
      isControllerChangeListening = true;
      navigator.serviceWorker.addEventListener('controllerchange', reloadRequestedUpdate);
    }
  };

  if (typeof document !== 'undefined' && document.readyState === 'complete') {
    startRegistration();
  } else {
    window.addEventListener('load', startRegistration);
  }
}

// For testing purposes
export function _resetPwaManagerState(): void {
  swRegistration = null;
  isWaitingSwAvailable = false;
  isMinVersionRequired = false;
  isDismissedByUser = false;
  isInActiveAttempt = false;
  isControllerChangeListening = false;
  updateRequested = false;
  reloadPending = false;
  hasReloaded = false;
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = null;
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
  listeners.clear();
  cachedSnapshot = computeSnapshot();
}
