/**
 * Englove Offline Queue & Sync Service (SPEC-09 ENG-111, RF-5, RF-10 to RF-18)
 *
 * Implements persistent queue in IndexedDB (pendingEvents, pendingUploads),
 * automatic flush with single-tab concurrency lock, exponential backoff,
 * mediaId reuse, response handling (RF-15), and user queue isolation (RF-5).
 */

import { uploadAudioBlob } from './audio-upload';

export interface PendingEventRecord {
  id?: number;
  userId: string;
  attemptId: string;
  clientEventId: string;
  eventType: 'answered' | 'completed';
  payload: Record<string, unknown>;
  attemptToken: string;
  createdAt: number; // Local FIFO only, NEVER sent to API (Decision 37)
}

export interface PendingUploadRecord {
  attemptId: string;
  userId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  mediaId: string | null; // Reused if already uploaded to R2 (RF-13)
  attemptToken?: string;
  createdAt: number;
}

export interface OfflineStatus {
  isOffline: boolean;
  pendingCount: number;
  isFlushing: boolean;
  lastSyncedAt: number | null;
  justFlushed: boolean;
}

const DB_NAME = 'englove_offline';
const DB_VERSION = 2;
const EVENTS_STORE = 'pendingEvents';
const UPLOADS_STORE = 'pendingUploads';

function createStoresIfMissing(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(EVENTS_STORE)) {
    const eventStore = db.createObjectStore(EVENTS_STORE, { keyPath: 'id', autoIncrement: true });
    eventStore.createIndex('attemptId', 'attemptId', { unique: false });
    eventStore.createIndex('userId', 'userId', { unique: false });
  }
  if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
    const uploadStore = db.createObjectStore(UPLOADS_STORE, { keyPath: 'attemptId' });
    uploadStore.createIndex('userId', 'userId', { unique: false });
  }
}

let isQueuePausedDueToAuth = false;
let isFlushingInternal = false;
let currentRetryTimeout: NodeJS.Timeout | null = null;
let flushDebounceTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0; // 0 -> 10s, 1 -> 30s, 2 -> 60s, then 60s
let lastSyncedAt: number | null = null;
let justFlushed = false;
let justFlushedTimer: NodeJS.Timeout | null = null;
let hasBeenOffline = false;

const statusListeners = new Set<(status: OfflineStatus) => void>();

function notifyStatus() {
  getPendingCount().then((count) => {
    const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    const status: OfflineStatus = {
      isOffline,
      pendingCount: count,
      isFlushing: isFlushingInternal,
      lastSyncedAt,
      justFlushed,
    };
    for (const listener of statusListeners) {
      try {
        listener(status);
      } catch {
        // Ignore subscriber error
      }
    }
  }).catch(() => {});
}

export function subscribeOfflineStatus(listener: (status: OfflineStatus) => void): () => void {
  statusListeners.add(listener);
  notifyStatus();
  return () => {
    statusListeners.delete(listener);
  };
}

// IndexedDB Helper
function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      createStoresIfMissing(request.result);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EVENTS_STORE) || !db.objectStoreNames.contains(UPLOADS_STORE)) {
        // Self-heal: database was created without stores. Delete and recreate at DB_VERSION to avoid VersionError drift (ISSUE-04)
        db.close();
        const delReq = window.indexedDB.deleteDatabase(DB_NAME);
        delReq.onsuccess = () => {
          openOfflineDb().then(resolve, reject);
        };
        delReq.onerror = () => reject(delReq.error);
        delReq.onblocked = () => reject(new Error('IndexedDB delete blocked'));
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

/**
 * Enqueues an answered event.
 * Local `createdAt` never travels to the API (Decision 37).
 */
export async function enqueueEvent(record: Omit<PendingEventRecord, 'id' | 'createdAt'>): Promise<number> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, 'readwrite');
    const store = tx.objectStore(EVENTS_STORE);
    const item: PendingEventRecord = {
      ...record,
      createdAt: Date.now(),
    };
    const req = store.add(item);
    req.onsuccess = () => {
      const generatedId = req.result as number;
      resolve(generatedId);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {
      db.close();
      notifyStatus();
      scheduleDebouncedFlush(250);
    };
  });
}

/**
 * Enqueues an audio recording for background upload.
 */
export async function enqueueUpload(record: Omit<PendingUploadRecord, 'createdAt'>): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(UPLOADS_STORE, 'readwrite');
    const store = tx.objectStore(UPLOADS_STORE);
    const item: PendingUploadRecord = {
      ...record,
      createdAt: Date.now(),
    };
    store.put(item);
    tx.oncomplete = () => {
      db.close();
      notifyStatus();
      void triggerFlush();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Gets total pending items (events + uploads)
 */
export async function getPendingCount(userId?: string): Promise<number> {
  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) => db.objectStoreNames.contains(s));
    if (existingStores.length === 0) {
      db.close();
      return 0;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(existingStores, 'readonly');
      let count = 0;

      if (existingStores.includes(EVENTS_STORE)) {
        const eventsReq = tx.objectStore(EVENTS_STORE).getAll();
        eventsReq.onsuccess = () => {
          const events: PendingEventRecord[] = eventsReq.result || [];
          if (userId) {
            count += events.filter((e) => e.userId === userId).length;
          } else {
            count += events.length;
          }
        };
      }

      if (existingStores.includes(UPLOADS_STORE)) {
        const uploadsReq = tx.objectStore(UPLOADS_STORE).getAll();
        uploadsReq.onsuccess = () => {
          const uploads: PendingUploadRecord[] = uploadsReq.result || [];
          if (userId) {
            count += uploads.filter((u) => u.userId === userId).length;
          } else {
            count += uploads.length;
          }
        };
      }

      tx.oncomplete = () => {
        db.close();
        resolve(count);
      };
      tx.onerror = () => {
        db.close();
        resolve(0);
      };
    });
  } catch {
    return 0;
  }
}

/**
 * Checks if there is pending work for a user or generally.
 */
export async function hasPendingWork(userId?: string): Promise<boolean> {
  const count = await getPendingCount(userId);
  return count > 0;
}

/**
 * Purges entries of other users before showing current user portal (RF-5).
 */
export async function purgeOtherUsersEntries(currentUserId: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) => db.objectStoreNames.contains(s));
    if (existingStores.length === 0) {
      db.close();
      return;
    }
    const tx = db.transaction(existingStores, 'readwrite');

    if (existingStores.includes(EVENTS_STORE)) {
      const eventsStore = tx.objectStore(EVENTS_STORE);
      const eventsReq = eventsStore.getAll();
      eventsReq.onsuccess = () => {
        const events: PendingEventRecord[] = eventsReq.result || [];
        for (const ev of events) {
          if (ev.userId && ev.userId !== currentUserId && ev.id !== undefined) {
            eventsStore.delete(ev.id);
          }
        }
      };
    }

    if (existingStores.includes(UPLOADS_STORE)) {
      const uploadsStore = tx.objectStore(UPLOADS_STORE);
      const uploadsReq = uploadsStore.getAll();
      uploadsReq.onsuccess = () => {
        const uploads: PendingUploadRecord[] = uploadsReq.result || [];
        for (const up of uploads) {
          if (up.userId && up.userId !== currentUserId) {
            uploadsStore.delete(up.attemptId);
          }
        }
      };
    }

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
    notifyStatus();
  } catch {
    // Ignore error
  }
}

/**
 * Clears all pending events and uploads on logout (RF-5).
 */
export async function clearOfflineQueue(): Promise<void> {
  if (flushDebounceTimer) {
    clearTimeout(flushDebounceTimer);
    flushDebounceTimer = null;
  }
  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) => db.objectStoreNames.contains(s));
    if (existingStores.length === 0) {
      db.close();
      return;
    }
    const tx = db.transaction(existingStores, 'readwrite');
    for (const store of existingStores) {
      tx.objectStore(store).clear();
    }
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
    notifyStatus();
  } catch {
    // Ignore error
  }
}

/**
 * Deletes an attempt completely from the queue (RF-15 on 409 ATTEMPT_CLOSED).
 */
async function purgeAttemptFromQueue(attemptId: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) => db.objectStoreNames.contains(s));
    if (existingStores.length === 0) {
      db.close();
      return;
    }
    const tx = db.transaction(existingStores, 'readwrite');

    if (existingStores.includes(EVENTS_STORE)) {
      const eventStore = tx.objectStore(EVENTS_STORE);
      const eventReq = eventStore.getAll();
      eventReq.onsuccess = () => {
        const events: PendingEventRecord[] = eventReq.result || [];
        for (const ev of events) {
          if (ev.attemptId === attemptId && ev.id !== undefined) {
            eventStore.delete(ev.id);
          }
        }
      };
    }

    if (existingStores.includes(UPLOADS_STORE)) {
      tx.objectStore(UPLOADS_STORE).delete(attemptId);
    }

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
    notifyStatus();
  } catch {
    // Ignore
  }
}

/**
 * Discards audio blob from pending uploads (RF-15 on 413 or 422).
 */
async function discardAudioBlob(attemptId: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
      db.close();
      return;
    }
    const tx = db.transaction(UPLOADS_STORE, 'readwrite');
    tx.objectStore(UPLOADS_STORE).delete(attemptId);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
    notifyStatus();
  } catch {
    // Ignore
  }
}

/**
 * Schedules next retry following backoff (10s, 30s, 60s, then 60s) (RF-11).
 */
function scheduleBackoffRetry() {
  hasBeenOffline = true;
  if (currentRetryTimeout) {
    clearTimeout(currentRetryTimeout);
    currentRetryTimeout = null;
  }
  const delays = [10000, 30000, 60000];
  const delay = retryAttempt < delays.length ? delays[retryAttempt] : 60000;
  retryAttempt++;

  currentRetryTimeout = setTimeout(() => {
    void triggerFlush();
  }, delay);
}

/**
 * Resets backoff counter upon successful network progress.
 */
function resetBackoff() {
  retryAttempt = 0;
  if (currentRetryTimeout) {
    clearTimeout(currentRetryTimeout);
    currentRetryTimeout = null;
  }
}

/**
 * Single-tab concurrency lock wrapper (RF-11).
 * Uses navigator.locks when available; falls back to internal flag.
 */

/**
 * Schedules a debounced flush (micro-batching) to avoid flooding the API
 * with individual HTTP requests on every rapid user interaction (ISSUE-09).
 */
export function scheduleDebouncedFlush(delayMs = 250): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  if (flushDebounceTimer) {
    clearTimeout(flushDebounceTimer);
  }
  flushDebounceTimer = setTimeout(() => {
    flushDebounceTimer = null;
    void triggerFlush();
  }, delayMs);
}

export async function triggerFlush(): Promise<void> {
  if (flushDebounceTimer) {
    clearTimeout(flushDebounceTimer);
    flushDebounceTimer = null;
  }
  if (typeof window === 'undefined') return;
  if (isQueuePausedDueToAuth) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyStatus();
    return;
  }

  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks.request) {
    try {
      await navigator.locks.request('englove_offline_flush', { ifAvailable: true }, async (lock) => {
        if (!lock) return; // Another tab is flushing
        await executeFlush();
      });
      return;
    } catch {
      // Fallback to internal mutex
    }
  }

  await executeFlush();
}

/**
 * Flushes events and uploads in order:
 * 1. Batches of up to 50 events per attempt.
 * 2. Upload audio (with mediaId reuse).
 * 3. Complete attempt delivery.
 */
async function executeFlush(): Promise<void> {
  if (isFlushingInternal) return;
  isFlushingInternal = true;
  notifyStatus();

  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) => db.objectStoreNames.contains(s));
    if (existingStores.length === 0) {
      db.close();
      isFlushingInternal = false;
      notifyStatus();
      return;
    }

    const tx = db.transaction(existingStores, 'readonly');
    let eventsReq: IDBRequest<PendingEventRecord[]> | undefined;
    let uploadsReq: IDBRequest<PendingUploadRecord[]> | undefined;

    if (existingStores.includes(EVENTS_STORE)) {
      eventsReq = tx.objectStore(EVENTS_STORE).getAll();
    }
    if (existingStores.includes(UPLOADS_STORE)) {
      uploadsReq = tx.objectStore(UPLOADS_STORE).getAll();
    }

    const [events, uploads] = await new Promise<[PendingEventRecord[], PendingUploadRecord[]]>((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve([eventsReq?.result || [], uploadsReq?.result || []]);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });

    if (events.length === 0 && uploads.length === 0) {
      isFlushingInternal = false;
      notifyStatus();
      return;
    }

    // Group items by attemptId
    const attemptIds = Array.from(
      new Set([...events.map((e) => e.attemptId), ...uploads.map((u) => u.attemptId)]),
    );

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    let hadSuccess = false;
    let hadError = false;

    for (const attemptId of attemptIds) {
      const attemptEvents = events
        .filter((e) => e.attemptId === attemptId)
        .sort((a, b) => a.createdAt - b.createdAt);
      const attemptUpload = uploads.find((u) => u.attemptId === attemptId);

      // Separate answered events from completed event
      const answeredEvents = attemptEvents.filter((e) => e.eventType === 'answered');
      const completionEvent = attemptEvents.find((e) => e.eventType === 'completed');

      // 1. Send answered events in batches of up to 50 (RF-11, RF-14)
      while (answeredEvents.length > 0) {
        const batch = answeredEvents.splice(0, 50);
        const first = batch[0];
        if (!first) break;
        const attemptToken = first.attemptToken;

        try {
          const res = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-attempt-token': attemptToken,
              Origin: (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost:3000',
            },
            credentials: 'include',
            body: JSON.stringify({
              events: batch.map((ev) => ({
                clientEventId: ev.clientEventId,
                eventType: 'answer_changed',
                ...ev.payload,
              })),
            }),
          });

          if (res.ok) {
            // Success: remove these events from IndexedDB
            const delDb = await openOfflineDb();
            if (delDb.objectStoreNames.contains(EVENTS_STORE)) {
              const delTx = delDb.transaction(EVENTS_STORE, 'readwrite');
              const delStore = delTx.objectStore(EVENTS_STORE);
              for (const ev of batch) {
                if (ev.id !== undefined) delStore.delete(ev.id);
              }
              await new Promise<void>((resDel) => {
                delTx.oncomplete = () => { delDb.close(); resDel(); };
                delTx.onerror = () => { delDb.close(); resDel(); };
              });
            } else {
              delDb.close();
            }
            hadSuccess = true;
          } else {
            const status = res.status;
            if (status === 401) {
              isQueuePausedDueToAuth = true;
              return;
            } else if (status === 409) {
              const errBody = await res.json().catch(() => ({}));
              if (errBody.code === 'ATTEMPT_CLOSED') {
                await purgeAttemptFromQueue(attemptId);
              } else {
                // 409 ATTEMPT_NOT_IN_PROGRESS: discard batch
                const delDb = await openOfflineDb();
                if (delDb.objectStoreNames.contains(EVENTS_STORE)) {
                  const delTx = delDb.transaction(EVENTS_STORE, 'readwrite');
                  for (const ev of batch) {
                    if (ev.id !== undefined) delTx.objectStore(EVENTS_STORE).delete(ev.id);
                  }
                  delTx.oncomplete = () => delDb.close();
                } else {
                  delDb.close();
                }
              }
            } else if (status === 400 || status === 404) {
              // Discard affected entries
              const delDb = await openOfflineDb();
              if (delDb.objectStoreNames.contains(EVENTS_STORE)) {
                const delTx = delDb.transaction(EVENTS_STORE, 'readwrite');
                for (const ev of batch) {
                  if (ev.id !== undefined) delTx.objectStore(EVENTS_STORE).delete(ev.id);
                }
                delTx.oncomplete = () => delDb.close();
              } else {
                delDb.close();
              }
            } else if (status >= 500 || status === 429) {
              hadError = true;
              scheduleBackoffRetry();
              return;
            }
          }
        } catch {
          hadError = true;
          scheduleBackoffRetry();
          return;
        }
      }

      // 2. Upload Audio if pending (RF-13)
      let resolvedMediaId: string | null = attemptUpload?.mediaId || null;
      if (attemptUpload && !resolvedMediaId) {
        try {
          resolvedMediaId = await uploadAudioBlob({
            apiUrl,
            origin: window.location.origin,
            attemptId,
            blob: attemptUpload.blob,
          });

          // Save mediaId to upload record for reuse
          const updateDb = await openOfflineDb();
          const updateTx = updateDb.transaction(UPLOADS_STORE, 'readwrite');
          updateTx.objectStore(UPLOADS_STORE).put({
            ...attemptUpload,
            mediaId: resolvedMediaId,
          });
          await new Promise<void>((resUp) => {
            updateTx.oncomplete = () => { updateDb.close(); resUp(); };
            updateTx.onerror = () => { updateDb.close(); resUp(); };
          });
          hadSuccess = true;
        } catch (uploadErr: unknown) {
          const errMsg = String(uploadErr);
          if (
            // guardrails-ignore G-C06: constante de error de duracion de audio de SPEC-05/SPEC-09
            errMsg.includes('AUDIO_IMPLAUSIBLE_DURATION') ||
            // guardrails-ignore G-C06: constante de error de duracion de audio de SPEC-05/SPEC-09
            errMsg.includes('AUDIO_EXCEEDS_MAX_DURATION') ||
            errMsg.includes('413') ||
            errMsg.includes('422')
          ) {
            await discardAudioBlob(attemptId);
          } else if (errMsg.includes('ATTEMPT_CLOSED') || errMsg.includes('409')) {
            await purgeAttemptFromQueue(attemptId);
          } else {
            hadError = true;
            scheduleBackoffRetry();
            return;
          }
        }
      }

      // 3. Complete Attempt if completed event is queued (RF-12)
      if (completionEvent) {
        try {
          const compPayload = (completionEvent.payload || {}) as {
            answers?: Record<string, unknown>;
          };
          const compAnswers = compPayload.answers;
          const completeBody: Record<string, unknown> = {
            ...(resolvedMediaId ? { mediaId: resolvedMediaId } : {}),
            ...(compAnswers && Object.keys(compAnswers).length > 0 ? { answers: compAnswers } : {}),
          };

          const completeRes = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-attempt-token': completionEvent.attemptToken,
              Origin: (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost:3000',
            },
            credentials: 'include',
            body: JSON.stringify(completeBody),
          });

          if (completeRes.ok) {
            // Successfully completed: purge events & upload
            await purgeAttemptFromQueue(attemptId);
            hadSuccess = true;
          } else {
            const status = completeRes.status;
            if (status === 401) {
              isQueuePausedDueToAuth = true;
              return;
            } else if (status === 409) {
              await purgeAttemptFromQueue(attemptId);
            } else if (status >= 500 || status === 429) {
              hadError = true;
              scheduleBackoffRetry();
              return;
            }
          }
        } catch {
          hadError = true;
          scheduleBackoffRetry();
          return;
        }
      }
    }

    if (hadSuccess && !hadError) {
      resetBackoff();
      lastSyncedAt = Date.now();
      const remaining = await getPendingCount();
      if (remaining === 0 && hasBeenOffline) {
        hasBeenOffline = false;
        justFlushed = true;
        if (justFlushedTimer) clearTimeout(justFlushedTimer);
        justFlushedTimer = setTimeout(() => {
          justFlushed = false;
          notifyStatus();
        }, 4000);
      }
    }
  } catch {
    scheduleBackoffRetry();
  } finally {
    isFlushingInternal = false;
    notifyStatus();
  }
}

// Global window event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isQueuePausedDueToAuth = false;
    resetBackoff();
    void triggerFlush();
  });
  window.addEventListener('offline', () => {
    notifyStatus();
  });
}
