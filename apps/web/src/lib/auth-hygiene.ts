import type { QueryClient } from '@tanstack/react-query';
import { getQueryClient } from './query-client';

/**
 * Performs client-side hygiene on logout or session expiration (Rule G-C13, RF-18).
 * Clears TanStack Query cache and IndexedDB pending queues on shared tablets.
 */
export async function clearSharedDeviceSession(
  queryClient: QueryClient = getQueryClient(),
): Promise<void> {
  // Cancel in-flight queries and drop every cached response of the previous account
  await queryClient.cancelQueries();
  queryClient.clear();

  // Clear IndexedDB pending queues if running in browser
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    try {
      const dbNames = ['englove_offline', 'englove_storage'];
      await Promise.allSettled(
        dbNames.map(
          (name) =>
            new Promise<void>((resolve) => {
              try {
                const req = window.indexedDB.open(name);
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
                req.onsuccess = () => {
                  try {
                    const db = req.result;
                    const storeNames = ['pendingEvents', 'pendingUploads'];
                    for (const sName of storeNames) {
                      if (db.objectStoreNames.contains(sName)) {
                        const tx = db.transaction(sName, 'readwrite');
                        tx.objectStore(sName).clear();
                      }
                    }
                    db.close();
                  } catch {
                    // Ignore errors during store clearing
                  }
                  resolve();
                };
              } catch {
                resolve();
              }
            }),
        ),
      );
    } catch {
      // Ignore errors if database not initialized
    }
  }

  // Clear non-static entries from Cache Storage (RF-5)
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(async (key) => {
          if (!key.startsWith('englove-static-')) {
            await caches.delete(key);
          }
        }),
      );
    } catch {
      // Ignore
    }
  }

  // Clear session storage & session indicators
  if (typeof window !== 'undefined') {
    try {
      if ('sessionStorage' in window) window.sessionStorage.clear();
      if (typeof document !== 'undefined') {
        document.cookie = 'englove_user_logged=; path=/; max-age=0; SameSite=Lax';
      }
    } catch {
      // Ignore
    }
  }
}
