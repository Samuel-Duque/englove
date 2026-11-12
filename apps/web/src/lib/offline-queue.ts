/**
 * Englove Offline Queue & Sync Service (SPEC-09 ENG-111, RF-5, RF-10 to RF-18)
 *
 * Implements persistent queue in IndexedDB (pendingEvents, pendingUploads),
 * automatic flush with single-tab concurrency lock, exponential backoff,
 * mediaId reuse, response handling (RF-15), and user queue isolation (RF-5).
 */

import { uploadAudioBlob } from "./audio-upload";
import { isLogoutPending } from "./auth-session";

export interface PendingEventRecord {
  id?: number;
  userId: string;
  attemptId: string;
  clientEventId: string;
  eventType: "answered" | "completed";
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

const DB_NAME = "englove_offline";
const DB_VERSION = 2;
const EVENTS_STORE = "pendingEvents";
const UPLOADS_STORE = "pendingUploads";

function createStoresIfMissing(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(EVENTS_STORE)) {
    const eventStore = db.createObjectStore(EVENTS_STORE, {
      keyPath: "id",
      autoIncrement: true,
    });
    eventStore.createIndex("attemptId", "attemptId", { unique: false });
    eventStore.createIndex("userId", "userId", { unique: false });
  }
  if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
    const uploadStore = db.createObjectStore(UPLOADS_STORE, {
      keyPath: "attemptId",
    });
    uploadStore.createIndex("userId", "userId", { unique: false });
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
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
let activeQueueUserId: string | null = null;
let identityGeneration = 0;
let flushAbortController: AbortController | null = null;

export function getOfflineUserId(): string | null {
  return isLogoutPending() ? null : activeQueueUserId;
}

export function suspendOfflineQueue(): void {
  flushAbortController?.abort();
  identityGeneration++;
  activeQueueUserId = null;
  isQueuePausedDueToAuth = true;
  resetBackoff();
  if (flushDebounceTimer) clearTimeout(flushDebounceTimer);
  flushDebounceTimer = null;
}

function hasActiveIdentity(userId: string): boolean {
  return Boolean(userId && userId === getOfflineUserId());
}

const statusListeners = new Set<(status: OfflineStatus) => void>();

function notifyStatus() {
  getPendingCount(getOfflineUserId() ?? "")
    .then((count) => {
      const isOffline =
        typeof navigator !== "undefined" ? !navigator.onLine : false;
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
    })
    .catch(() => {});
}

export function subscribeOfflineStatus(
  listener: (status: OfflineStatus) => void,
): () => void {
  statusListeners.add(listener);
  notifyStatus();
  return () => {
    statusListeners.delete(listener);
  };
}

// IndexedDB Helper
export function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not supported"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      createStoresIfMissing(request.result);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (
        !db.objectStoreNames.contains(EVENTS_STORE) ||
        !db.objectStoreNames.contains(UPLOADS_STORE)
      ) {
        // Self-heal: database was created without stores. Delete and recreate at DB_VERSION to avoid VersionError drift (ISSUE-04)
        db.close();
        const delReq = window.indexedDB.deleteDatabase(DB_NAME);
        delReq.onsuccess = () => {
          openOfflineDb().then(resolve, reject);
        };
        delReq.onerror = () => reject(delReq.error);
        delReq.onblocked = () => reject(new Error("IndexedDB delete blocked"));
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

/**
 * Enqueues an answered event.
 * Local `createdAt` never travels to the API (Decision 37).
 */
export async function enqueueEvent(
  record: Omit<PendingEventRecord, "id" | "createdAt">,
): Promise<number> {
  if (!hasActiveIdentity(record.userId))
    throw new Error("OFFLINE_IDENTITY_REQUIRED");
  const generation = identityGeneration;
  const db = await openOfflineDb();
  if (generation !== identityGeneration || !hasActiveIdentity(record.userId)) {
    db.close();
    throw new Error("OFFLINE_IDENTITY_REQUIRED");
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EVENTS_STORE, "readwrite");
    const store = tx.objectStore(EVENTS_STORE);
    const item: PendingEventRecord = {
      ...record,
      createdAt: Date.now(),
    };
    const req = store.add(item);
    req.onsuccess = () => {
      const generatedId =
        typeof req.result === "number" ? req.result : Number(req.result);
      resolve(generatedId);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {
      db.close();
      notifyStatus();
      scheduleDebouncedFlush(250, record.userId);
    };
  });
}

/**
 * Enqueues an audio recording for background upload.
 */
export async function enqueueUpload(
  record: Omit<PendingUploadRecord, "createdAt">,
): Promise<void> {
  if (!hasActiveIdentity(record.userId))
    throw new Error("OFFLINE_IDENTITY_REQUIRED");
  const generation = identityGeneration;
  const db = await openOfflineDb();
  if (generation !== identityGeneration || !hasActiveIdentity(record.userId)) {
    db.close();
    throw new Error("OFFLINE_IDENTITY_REQUIRED");
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(UPLOADS_STORE, "readwrite");
    const store = tx.objectStore(UPLOADS_STORE);
    const item: PendingUploadRecord = {
      ...record,
      createdAt: Date.now(),
    };
    store.put(item);
    tx.oncomplete = () => {
      db.close();
      notifyStatus();
      void triggerFlush(record.userId);
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Recupera la última respuesta pendiente por ítem para el usuario y el intento activos. */
export async function getPendingAttemptAnswers(userId: string, attemptId: string): Promise<Record<string, unknown>> {
  if (!hasActiveIdentity(userId)) return {};
  const generation = identityGeneration;
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(EVENTS_STORE, "readonly");
      const request = tx.objectStore(EVENTS_STORE).getAll();
      let answers: Record<string, unknown> = {};
      request.onsuccess = () => {
        const events: PendingEventRecord[] = request.result || [];
        for (const event of events) {
          if (event.userId !== userId || event.attemptId !== attemptId || event.eventType !== "answered") continue;
          const itemId = event.payload.itemId;
          if (typeof itemId === "string" && ["pairs", "tokenIds", "placements", "selections", "choices"].includes(itemId)) {
            answers[itemId] = event.payload.answer;
          }
        }
      };
      tx.oncomplete = () => {
        db.close();
        if (generation !== identityGeneration || !hasActiveIdentity(userId)) answers = {};
        resolve(answers);
      };
      tx.onerror = () => { db.close(); resolve({}); };
    });
  } catch {
    return {};
  }
}

/**
 * Gets total pending items (events + uploads)
 */
export async function getPendingCount(userId: string): Promise<number> {
  if (!hasActiveIdentity(userId)) return 0;
  const generation = identityGeneration;
  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) =>
      db.objectStoreNames.contains(s),
    );
    if (existingStores.length === 0) {
      db.close();
      return 0;
    }
    return new Promise((resolve) => {
      const tx = db.transaction(existingStores, "readonly");
      let count = 0;

      if (existingStores.includes(EVENTS_STORE)) {
        const eventsReq = tx.objectStore(EVENTS_STORE).getAll();
        eventsReq.onsuccess = () => {
          const events: PendingEventRecord[] = eventsReq.result || [];
          count += events.filter((e) => e.userId === userId).length;
        };
      }

      if (existingStores.includes(UPLOADS_STORE)) {
        const uploadsReq = tx.objectStore(UPLOADS_STORE).getAll();
        uploadsReq.onsuccess = () => {
          const uploads: PendingUploadRecord[] = uploadsReq.result || [];
          count += uploads.filter((u) => u.userId === userId).length;
        };
      }

      tx.oncomplete = () => {
        db.close();
        resolve(
          generation === identityGeneration && hasActiveIdentity(userId)
            ? count
            : 0,
        );
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
export async function hasPendingWork(userId: string): Promise<boolean> {
  const count = await getPendingCount(userId);
  return count > 0;
}

/**
 * Purges entries of other users before showing current user portal (RF-5).
 */
export async function purgeOtherUsersEntries(
  currentUserId: string,
): Promise<void> {
  if (!currentUserId || isLogoutPending()) return;
  if (activeQueueUserId === currentUserId) return;
  const generation = ++identityGeneration;
  flushAbortController?.abort();
  activeQueueUserId = null;
  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) =>
      db.objectStoreNames.contains(s),
    );
    if (existingStores.length === 0) {
      db.close();
      return;
    }
    const tx = db.transaction(existingStores, "readwrite");

    if (existingStores.includes(EVENTS_STORE)) {
      const eventsStore = tx.objectStore(EVENTS_STORE);
      const eventsReq = eventsStore.getAll();
      eventsReq.onsuccess = () => {
        const events: PendingEventRecord[] = eventsReq.result || [];
        for (const ev of events) {
          if (
            (!ev.userId || ev.userId !== currentUserId) &&
            ev.id !== undefined
          ) {
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
          if (!up.userId || up.userId !== currentUserId) {
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
  } finally {
    if (generation === identityGeneration && !isLogoutPending()) {
      activeQueueUserId = currentUserId;
      isQueuePausedDueToAuth = false;
      notifyStatus();
    }
  }
}

/**
 * Clears all pending events and uploads on logout (RF-5).
 */
export async function clearOfflineQueue(): Promise<void> {
  suspendOfflineQueue();
  if (flushDebounceTimer) {
    clearTimeout(flushDebounceTimer);
    flushDebounceTimer = null;
  }
  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) =>
      db.objectStoreNames.contains(s),
    );
    if (existingStores.length === 0) {
      db.close();
      return;
    }
    const tx = db.transaction(existingStores, "readwrite");
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
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) =>
      db.objectStoreNames.contains(s),
    );
    if (existingStores.length === 0) {
      db.close();
      return;
    }
    const tx = db.transaction(existingStores, "readwrite");

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
    const tx = db.transaction(UPLOADS_STORE, "readwrite");
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
    void triggerFlush(getOfflineUserId() ?? "");
  }, delay);
}

/**
 * Resumes the offline queue after successful authentication/token refresh (P0-03).
 */
export function resumeOfflineQueueAfterAuth(): void {
  if (!getOfflineUserId()) return;
  isQueuePausedDueToAuth = false;
  resetBackoff();
  void triggerFlush(getOfflineUserId() ?? "");
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
export function scheduleDebouncedFlush(
  delayMs = 250,
  activeUserId: string,
): void {
  if (!hasActiveIdentity(activeUserId)) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  if (flushDebounceTimer) {
    clearTimeout(flushDebounceTimer);
  }
  flushDebounceTimer = setTimeout(() => {
    flushDebounceTimer = null;
    void triggerFlush(activeUserId);
  }, delayMs);
}

export async function triggerFlush(activeUserId: string): Promise<void> {
  if (!hasActiveIdentity(activeUserId)) return;
  if (flushDebounceTimer) {
    clearTimeout(flushDebounceTimer);
    flushDebounceTimer = null;
  }
  if (typeof window === "undefined") return;
  if (isQueuePausedDueToAuth) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    notifyStatus();
    return;
  }

  if (
    typeof navigator !== "undefined" &&
    "locks" in navigator &&
    navigator.locks.request
  ) {
    try {
      await navigator.locks.request(
        "englove_offline_flush",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) return; // Another tab is flushing
          await executeFlush(activeUserId);
        },
      );
      return;
    } catch {
      // Fallback to internal mutex
    }
  }

  await executeFlush(activeUserId);
}

/**
 * Flushes events and uploads in order:
 * 1. Batches of up to 50 events per attempt.
 * 2. Upload audio (with mediaId reuse).
 * 3. Complete attempt delivery.
 * Filters strictly by activeUserId when specified (RF-6).
 */
export async function executeFlush(activeUserId: string): Promise<void> {
  if (!hasActiveIdentity(activeUserId) || isQueuePausedDueToAuth) return;
  const generation = identityGeneration;
  const isCurrent = () =>
    generation === identityGeneration && hasActiveIdentity(activeUserId);
  if (isFlushingInternal) return;
  const controller = new AbortController();
  flushAbortController = controller;
  isFlushingInternal = true;
  notifyStatus();

  try {
    const db = await openOfflineDb();
    const existingStores = [EVENTS_STORE, UPLOADS_STORE].filter((s) =>
      db.objectStoreNames.contains(s),
    );
    if (existingStores.length === 0) {
      db.close();
      isFlushingInternal = false;
      notifyStatus();
      return;
    }

    const tx = db.transaction(existingStores, "readonly");
    let eventsReq: IDBRequest<PendingEventRecord[]> | undefined;
    let uploadsReq: IDBRequest<PendingUploadRecord[]> | undefined;

    if (existingStores.includes(EVENTS_STORE)) {
      eventsReq = tx.objectStore(EVENTS_STORE).getAll();
    }
    if (existingStores.includes(UPLOADS_STORE)) {
      uploadsReq = tx.objectStore(UPLOADS_STORE).getAll();
    }

    const [rawEvents, rawUploads] = await new Promise<
      [PendingEventRecord[], PendingUploadRecord[]]
    >((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve([eventsReq?.result || [], uploadsReq?.result || []]);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });

    if (!isCurrent()) return;
    const events = rawEvents.filter((e) => e.userId === activeUserId);
    const uploads = rawUploads.filter((u) => u.userId === activeUserId);

    if (events.length === 0 && uploads.length === 0) {
      isFlushingInternal = false;
      notifyStatus();
      return;
    }

    // Group items by attemptId
    const attemptIds = Array.from(
      new Set([
        ...events.map((e) => e.attemptId),
        ...uploads.map((u) => u.attemptId),
      ]),
    );

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    let hadSuccess = false;
    let hadError = false;

    for (const attemptId of attemptIds) {
      if (!isCurrent()) return;
      const attemptEvents = events
        .filter((e) => e.attemptId === attemptId)
        .sort((a, b) => a.createdAt - b.createdAt);
      const attemptUpload = uploads.find((u) => u.attemptId === attemptId);

      // Separate answered events from completed event
      const answeredEvents = attemptEvents.filter(
        (e) => e.eventType === "answered",
      );
      const completionEvent = attemptEvents.find(
        (e) => e.eventType === "completed",
      );

      // 1. Send answered events in batches of up to 50 (RF-11, RF-14)
      while (answeredEvents.length > 0) {
        if (!isCurrent()) return;
        const batch = answeredEvents.splice(0, 50);
        const first = batch[0];
        if (!first) break;
        const attemptToken = first.attemptToken;

        try {
          let res = await fetch(
            `${apiUrl}/api/v1/attempts/${attemptId}/events`,
            {
              signal: controller.signal,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-attempt-token": attemptToken,
                Origin:
                  (typeof window !== "undefined" && window.location?.origin) ||
                  "http://localhost:3000",
              },
              credentials: "include",
              body: JSON.stringify({
                events: batch.map((ev) => ({
                  clientEventId: ev.clientEventId,
                  eventType: "answer_changed",
                  ...ev.payload,
                })),
              }),
            },
          );

          if (!isCurrent()) return;
          if (!res.ok && res.status === 401) {
            try {
              const { requestSharedRefresh } = await import("./auth-session");
              const refreshed = await requestSharedRefresh();
              if (refreshed && isCurrent()) {
                res = await fetch(
                  `${apiUrl}/api/v1/attempts/${attemptId}/events`,
                  {
                    signal: controller.signal,
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-attempt-token": attemptToken,
                      Origin:
                        (typeof window !== "undefined" &&
                          window.location?.origin) ||
                        "http://localhost:3000",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                      events: batch.map((ev) => ({
                        clientEventId: ev.clientEventId,
                        eventType: "answer_changed",
                        ...ev.payload,
                      })),
                    }),
                  },
                );
              }
            } catch {
              // Ignore refresh error
            }
          }

          if (!isCurrent()) return;
          if (res.ok) {
            // Success: remove these events from IndexedDB
            const delDb = await openOfflineDb();
            if (delDb.objectStoreNames.contains(EVENTS_STORE)) {
              const delTx = delDb.transaction(EVENTS_STORE, "readwrite");
              const delStore = delTx.objectStore(EVENTS_STORE);
              for (const ev of batch) {
                if (ev.id !== undefined) delStore.delete(ev.id);
              }
              await new Promise<void>((resDel) => {
                delTx.oncomplete = () => {
                  delDb.close();
                  resDel();
                };
                delTx.onerror = () => {
                  delDb.close();
                  resDel();
                };
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
              if (errBody.code === "ATTEMPT_CLOSED") {
                await purgeAttemptFromQueue(attemptId);
              } else {
                // 409 ATTEMPT_NOT_IN_PROGRESS: discard batch
                const delDb = await openOfflineDb();
                if (delDb.objectStoreNames.contains(EVENTS_STORE)) {
                  const delTx = delDb.transaction(EVENTS_STORE, "readwrite");
                  for (const ev of batch) {
                    if (ev.id !== undefined)
                      delTx.objectStore(EVENTS_STORE).delete(ev.id);
                  }
                  delTx.oncomplete = () => delDb.close();
                } else {
                  delDb.close();
                }
              }
            } else if (
              status === 400 ||
              status === 404 ||
              status === 413 ||
              status === 422
            ) {
              // Discard affected entries on 4xx validation errors (RF-6)
              const delDb = await openOfflineDb();
              if (delDb.objectStoreNames.contains(EVENTS_STORE)) {
                const delTx = delDb.transaction(EVENTS_STORE, "readwrite");
                for (const ev of batch) {
                  if (ev.id !== undefined)
                    delTx.objectStore(EVENTS_STORE).delete(ev.id);
                }
                delTx.oncomplete = () => delDb.close();
              } else {
                delDb.close();
              }
            } else if (status >= 500 || status === 429) {
              hadError = true;
              if (isCurrent()) scheduleBackoffRetry();
              return;
            }
          }
        } catch {
          hadError = true;
          if (isCurrent()) scheduleBackoffRetry();
          return;
        }
      }

      // 2. Upload Audio if pending (RF-13)
      let resolvedMediaId: string | null = attemptUpload?.mediaId || null;
      if (attemptUpload && !resolvedMediaId) {
        if (!isCurrent()) return;
        try {
          resolvedMediaId = await uploadAudioBlob({
            signal: controller.signal,
            attemptToken:
              attemptUpload.attemptToken ?? completionEvent?.attemptToken,
            apiUrl,
            origin: window.location.origin,
            attemptId,
            blob: attemptUpload.blob,
          });

          if (!isCurrent()) return;
          // Save mediaId to upload record for reuse
          const updateDb = await openOfflineDb();
          const updateTx = updateDb.transaction(UPLOADS_STORE, "readwrite");
          updateTx.objectStore(UPLOADS_STORE).put({
            ...attemptUpload,
            mediaId: resolvedMediaId,
          });
          await new Promise<void>((resUp) => {
            updateTx.oncomplete = () => {
              updateDb.close();
              resUp();
            };
            updateTx.onerror = () => {
              updateDb.close();
              resUp();
            };
          });
          hadSuccess = true;
        } catch (uploadErr: unknown) {
          const errMsg = String(uploadErr);
          if (
            // guardrails-ignore G-C06: constante de error de duracion de audio de SPEC-05/SPEC-09
            errMsg.includes("AUDIO_IMPLAUSIBLE_DURATION") ||
            // guardrails-ignore G-C06: constante de error de duracion de audio de SPEC-05/SPEC-09
            errMsg.includes("AUDIO_EXCEEDS_MAX_DURATION") ||
            errMsg.includes("413") ||
            errMsg.includes("422") ||
            errMsg.includes("400")
          ) {
            await discardAudioBlob(attemptId);
          } else if (
            errMsg.includes("ATTEMPT_CLOSED") ||
            errMsg.includes("409")
          ) {
            await purgeAttemptFromQueue(attemptId);
          } else {
            hadError = true;
            if (isCurrent()) scheduleBackoffRetry();
            return;
          }
        }
      }

      // Uploaded bytes are not trusted until the server validates them with ffprobe.
      // Confirm reused media too: a prior confirmation may have failed transiently.
      if (attemptUpload && resolvedMediaId) {
        if (!isCurrent()) return;
        const token =
          attemptUpload.attemptToken ?? completionEvent?.attemptToken;
        const confirm = await fetch(
          `${apiUrl}/api/v1/media/${resolvedMediaId}/confirm`,
          {
            method: "POST",
            credentials: "include",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "x-attempt-token": token ?? "",
            },
          },
        );
        if (!isCurrent()) return;
        if (!confirm.ok) {
          if (confirm.status === 401) isQueuePausedDueToAuth = true;
          else if (confirm.status >= 500 || confirm.status === 429)
            scheduleBackoffRetry();
          else if (confirm.status === 409)
            await purgeAttemptFromQueue(attemptId);
          else if ([400, 404, 413, 422].includes(confirm.status))
            await discardAudioBlob(attemptId);
          return;
        }
      }

      // 3. Complete Attempt if completed event is queued (RF-12, RF-6)
      if (completionEvent) {
        if (!isCurrent()) return;
        // If audio upload is required but unresolved, omit /complete (RF-6)
        if (attemptUpload && !resolvedMediaId) {
          continue;
        }

        try {
          const compPayload = isRecord(completionEvent.payload)
            ? completionEvent.payload
            : {};
          const answersVal = compPayload.answers;
          const compAnswers = isRecord(answersVal) ? answersVal : undefined;
          const completeBody: Record<string, unknown> = {
            ...(resolvedMediaId ? { mediaId: resolvedMediaId } : {}),
            ...(compAnswers && Object.keys(compAnswers).length > 0
              ? { answers: compAnswers }
              : {}),
          };

          let completeRes = await fetch(
            `${apiUrl}/api/v1/attempts/${attemptId}/complete`,
            {
              signal: controller.signal,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-attempt-token": completionEvent.attemptToken,
                Origin:
                  (typeof window !== "undefined" && window.location?.origin) ||
                  "http://localhost:3000",
              },
              credentials: "include",
              body: JSON.stringify(completeBody),
            },
          );

          if (!isCurrent()) return;
          if (!completeRes.ok && completeRes.status === 401) {
            try {
              const { requestSharedRefresh } = await import("./auth-session");
              const refreshed = await requestSharedRefresh();
              if (refreshed && isCurrent()) {
                completeRes = await fetch(
                  `${apiUrl}/api/v1/attempts/${attemptId}/complete`,
                  {
                    signal: controller.signal,
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-attempt-token": completionEvent.attemptToken,
                      Origin:
                        (typeof window !== "undefined" &&
                          window.location?.origin) ||
                        "http://localhost:3000",
                    },
                    credentials: "include",
                    body: JSON.stringify(completeBody),
                  },
                );
              }
            } catch {
              // Ignore refresh error
            }
          }

          if (!isCurrent()) return;
          if (completeRes.ok) {
            // Successfully completed: purge events & upload
            await purgeAttemptFromQueue(attemptId);
            hadSuccess = true;
          } else {
            const status = completeRes.status;
            if (status === 401) {
              isQueuePausedDueToAuth = true;
              return;
            } else if (
              status === 409 ||
              status === 400 ||
              status === 404 ||
              status === 413 ||
              status === 422
            ) {
              // 4xx client errors: purge attempt from queue without retrying (RF-6)
              await purgeAttemptFromQueue(attemptId);
            } else if (status >= 500 || status === 429) {
              hadError = true;
              if (isCurrent()) scheduleBackoffRetry();
              return;
            }
          }
        } catch {
          hadError = true;
          if (isCurrent()) scheduleBackoffRetry();
          return;
        }
      }
    }

    if (hadSuccess && !hadError) {
      resetBackoff();
      lastSyncedAt = Date.now();
      const remaining = await getPendingCount(activeUserId);
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
    if (flushAbortController === controller) flushAbortController = null;
    isFlushingInternal = false;
    notifyStatus();
  }
}

// Global window event listeners
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    isQueuePausedDueToAuth = false;
    resetBackoff();
    void triggerFlush(getOfflineUserId() ?? "");
  });
  window.addEventListener("offline", () => {
    notifyStatus();
  });
}
