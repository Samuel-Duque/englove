import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enqueueEvent,
  enqueueUpload,
  getPendingCount,
  hasPendingWork,
  purgeOtherUsersEntries,
  clearOfflineQueue,
  type PendingEventRecord,
  type PendingUploadRecord,
} from '../src/lib/offline-queue';

describe('SPEC-09 RF-10, RF-11, RF-15, RF-5: Offline Queue Service', () => {
  let eventsDb: PendingEventRecord[] = [];
  let uploadsDb: PendingUploadRecord[] = [];
  let autoIncId = 1;

  beforeEach(() => {
    eventsDb = [];
    uploadsDb = [];
    autoIncId = 1;

    // In-memory IndexedDB mock
    const mockDb = {
      objectStoreNames: {
        contains: (name: string) => name === 'pendingEvents' || name === 'pendingUploads',
      },
      close: vi.fn(),
      transaction: vi.fn(() => {
        let activeRequests = 0;
        const txObj = {
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
          objectStore: vi.fn((sName: string) => {
            const wrapReq = (execute: () => unknown) => {
              activeRequests++;
              const req: { result?: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
                result: undefined,
                onsuccess: null,
                onerror: null,
              };
              setTimeout(() => {
                req.result = execute();
                if (req.onsuccess) req.onsuccess();
                activeRequests--;
                if (activeRequests === 0 && txObj.oncomplete) {
                  txObj.oncomplete();
                }
              }, 0);
              return req;
            };

            if (sName === 'pendingEvents') {
              return {
                add: vi.fn((item: PendingEventRecord) => {
                  return wrapReq(() => {
                    const id = autoIncId++;
                    eventsDb.push({ ...item, id });
                    return id;
                  });
                }),
                getAll: vi.fn(() => {
                  return wrapReq(() => [...eventsDb]);
                }),
                delete: vi.fn((id: number) => {
                  return wrapReq(() => {
                    eventsDb = eventsDb.filter((e) => e.id !== id);
                  });
                }),
                clear: vi.fn(() => {
                  return wrapReq(() => {
                    eventsDb = [];
                  });
                }),
              };
            } else {
              return {
                put: vi.fn((item: PendingUploadRecord) => {
                  return wrapReq(() => {
                    uploadsDb = uploadsDb.filter((u) => u.attemptId !== item.attemptId);
                    uploadsDb.push(item);
                  });
                }),
                getAll: vi.fn(() => {
                  return wrapReq(() => [...uploadsDb]);
                }),
                delete: vi.fn((attemptId: string) => {
                  return wrapReq(() => {
                    uploadsDb = uploadsDb.filter((u) => u.attemptId !== attemptId);
                  });
                }),
                clear: vi.fn(() => {
                  return wrapReq(() => {
                    uploadsDb = [];
                  });
                }),
              };
            }
          }),
        };
        return txObj;
      }),
    };

    (globalThis as unknown as { window: unknown }).window = {
      indexedDB: {
        open: vi.fn(() => {
          const req = {
            result: mockDb,
            onsuccess: null as (() => void) | null,
            onerror: null as (() => void) | null,
            onupgradeneeded: null as (() => void) | null,
            onblocked: null as (() => void) | null,
          };
          setTimeout(() => {
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        }),
      },
    };

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: false, // offline during tests to test local storage without triggering immediate flush
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RF-10: Persistent answer queue and local storage', () => {
    it('persists answered event in pendingEvents and assigns auto-increment ID', async () => {
      const id = await enqueueEvent({
        userId: 'user-1',
        attemptId: 'att-1',
        clientEventId: 'evt-uuid-1',
        eventType: 'answered',
        payload: { itemId: 'blank-1', answer: 'cat' },
        attemptToken: 'token-abc',
      });

      expect(id).toBe(1);
      expect(eventsDb).toHaveLength(1);
      expect(eventsDb[0]).toMatchObject({
        userId: 'user-1',
        attemptId: 'att-1',
        clientEventId: 'evt-uuid-1',
        eventType: 'answered',
        attemptToken: 'token-abc',
      });
      // Ensure local createdAt is set
      expect(typeof eventsDb[0]?.createdAt).toBe('number');
    });

    it('persists audio upload in pendingUploads', async () => {
      const dummyBlob = new Blob(['audio-data'], { type: 'audio/webm' });
      await enqueueUpload({
        attemptId: 'att-1',
        userId: 'user-1',
        blob: dummyBlob,
        mimeType: 'audio/webm',
        durationMs: 3500,
        mediaId: null,
      });

      expect(uploadsDb).toHaveLength(1);
      expect(uploadsDb[0]?.attemptId).toBe('att-1');
      expect(uploadsDb[0]?.mediaId).toBeNull();
      expect(uploadsDb[0]?.durationMs).toBe(3500);
    });

    it('accurately reports pending work count and hasPendingWork', async () => {
      expect(await hasPendingWork('user-1')).toBe(false);
      expect(await getPendingCount('user-1')).toBe(0);

      await enqueueEvent({
        userId: 'user-1',
        attemptId: 'att-1',
        clientEventId: 'evt-1',
        eventType: 'answered',
        payload: {},
        attemptToken: 'tok',
      });

      expect(await hasPendingWork('user-1')).toBe(true);
      expect(await getPendingCount('user-1')).toBe(1);
    });

    it('queues both audio upload and completed delivery for speaking activity (RF-12, RF-13)', async () => {
      const dummyBlob = new Blob(['sample-audio-data'], { type: 'audio/webm' });
      await enqueueUpload({
        attemptId: 'att-speaking-1',
        userId: 'user-speaking',
        blob: dummyBlob,
        mimeType: 'audio/webm',
        durationMs: 4000,
        mediaId: null,
      });

      await enqueueEvent({
        userId: 'user-speaking',
        attemptId: 'att-speaking-1',
        clientEventId: 'evt-comp-speaking',
        eventType: 'completed',
        payload: {},
        attemptToken: 'tok-speaking',
      });

      expect(uploadsDb).toHaveLength(1);
      expect(eventsDb).toHaveLength(1);
      expect(await getPendingCount('user-speaking')).toBe(2);
      expect(await hasPendingWork('user-speaking')).toBe(true);
    });
  });

  describe('RF-5: Queue hygiene on user switch and logout', () => {
    it('purges items belonging to other users when a new user logs in (RF-5)', async () => {
      // Add items for user-old and user-new
      await enqueueEvent({
        userId: 'user-old',
        attemptId: 'att-old',
        clientEventId: 'evt-old-1',
        eventType: 'answered',
        payload: {},
        attemptToken: 'tok-old',
      });
      await enqueueEvent({
        userId: 'user-new',
        attemptId: 'att-new',
        clientEventId: 'evt-new-1',
        eventType: 'answered',
        payload: {},
        attemptToken: 'tok-new',
      });

      expect(eventsDb).toHaveLength(2);

      // Purge everything not belonging to user-new
      await purgeOtherUsersEntries('user-new');

      expect(eventsDb).toHaveLength(1);
      expect(eventsDb[0]?.userId).toBe('user-new');
    });

    it('clears all offline queues completely on logout (RF-5)', async () => {
      await enqueueEvent({
        userId: 'user-1',
        attemptId: 'att-1',
        clientEventId: 'evt-1',
        eventType: 'answered',
        payload: {},
        attemptToken: 'tok',
      });
      const dummyBlob = new Blob(['data'], { type: 'audio/webm' });
      await enqueueUpload({
        attemptId: 'att-1',
        userId: 'user-1',
        blob: dummyBlob,
        mimeType: 'audio/webm',
        durationMs: 2000,
        mediaId: null,
      });

      expect(eventsDb).toHaveLength(1);
      expect(uploadsDb).toHaveLength(1);

      await clearOfflineQueue();

      expect(eventsDb).toHaveLength(0);
      expect(uploadsDb).toHaveLength(0);
      expect(await hasPendingWork()).toBe(false);
    });
  });
});
