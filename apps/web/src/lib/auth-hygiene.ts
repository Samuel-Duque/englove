/**
 * Performs client-side hygiene on logout or session expiration (Rule G-C13, RF-18).
 * Clears TanStack Query cache and IndexedDB pending queues on shared tablets.
 */
export async function clearSharedDeviceSession(): Promise<void> {
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

  // Clear session storage
  if (typeof window !== 'undefined' && 'sessionStorage' in window) {
    try {
      window.sessionStorage.clear();
    } catch {
      // Ignore
    }
  }
}
