import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  enqueueEvent,
  enqueueUpload,
  getPendingCount,
  hasPendingWork,
  purgeOtherUsersEntries,
  clearOfflineQueue,
  triggerFlush,
  executeFlush,
  suspendOfflineQueue,
  type PendingEventRecord,
  type PendingUploadRecord,
} from "../src/lib/offline-queue";

describe("SPEC-09 RF-10, RF-11, RF-15, RF-5: Offline Queue Service", () => {
  let eventsDb: PendingEventRecord[] = [];
  let uploadsDb: PendingUploadRecord[] = [];
  let autoIncId = 1;
  let mockDb: any;

  beforeEach(async () => {
    suspendOfflineQueue();
    eventsDb = [];
    uploadsDb = [];
    autoIncId = 1;

    // In-memory IndexedDB mock
    mockDb = {
      objectStoreNames: {
        contains: (name: string) =>
          name === "pendingEvents" || name === "pendingUploads",
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
              const req: {
                result?: unknown;
                onsuccess: (() => void) | null;
                onerror: (() => void) | null;
              } = {
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

            if (sName === "pendingEvents") {
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
                    uploadsDb = uploadsDb.filter(
                      (u) => u.attemptId !== item.attemptId,
                    );
                    uploadsDb.push(item);
                  });
                }),
                getAll: vi.fn(() => {
                  return wrapReq(() => [...uploadsDb]);
                }),
                delete: vi.fn((attemptId: string) => {
                  return wrapReq(() => {
                    uploadsDb = uploadsDb.filter(
                      (u) => u.attemptId !== attemptId,
                    );
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

    Object.defineProperty(globalThis, "navigator", {
      value: {
        onLine: false, // offline during tests to test local storage without triggering immediate flush
      },
      configurable: true,
      writable: true,
    });
    await purgeOtherUsersEntries("user-1");
  });

  afterEach(() => {
    suspendOfflineQueue();
    vi.restoreAllMocks();
  });

  describe("RF-10: Persistent answer queue and local storage", () => {
    it("persists answered event in pendingEvents and assigns auto-increment ID", async () => {
      const id = await enqueueEvent({
        userId: "user-1",
        attemptId: "att-1",
        clientEventId: "evt-uuid-1",
        eventType: "answered",
        payload: { itemId: "blank-1", answer: "cat" },
        attemptToken: "token-abc",
      });

      expect(id).toBe(1);
      expect(eventsDb).toHaveLength(1);
      expect(eventsDb[0]).toMatchObject({
        userId: "user-1",
        attemptId: "att-1",
        clientEventId: "evt-uuid-1",
        eventType: "answered",
        attemptToken: "token-abc",
      });
      // Ensure local createdAt is set
      expect(typeof eventsDb[0]?.createdAt).toBe("number");
    });

    it("persists audio upload in pendingUploads", async () => {
      const dummyBlob = new Blob(["audio-data"], { type: "audio/webm" });
      await enqueueUpload({
        attemptId: "att-1",
        userId: "user-1",
        blob: dummyBlob,
        mimeType: "audio/webm",
        durationMs: 3500,
        mediaId: null,
      });

      expect(uploadsDb).toHaveLength(1);
      expect(uploadsDb[0]?.attemptId).toBe("att-1");
      expect(uploadsDb[0]?.mediaId).toBeNull();
      expect(uploadsDb[0]?.durationMs).toBe(3500);
    });

    it("accurately reports pending work count and hasPendingWork", async () => {
      expect(await hasPendingWork("user-1")).toBe(false);
      expect(await getPendingCount("user-1")).toBe(0);

      await enqueueEvent({
        userId: "user-1",
        attemptId: "att-1",
        clientEventId: "evt-1",
        eventType: "answered",
        payload: {},
        attemptToken: "tok",
      });

      expect(await hasPendingWork("user-1")).toBe(true);
      expect(await getPendingCount("user-1")).toBe(1);
    });

    it("queues both audio upload and completed delivery for speaking activity (RF-12, RF-13)", async () => {
      await purgeOtherUsersEntries("user-speaking");
      const dummyBlob = new Blob(["sample-audio-data"], { type: "audio/webm" });
      await enqueueUpload({
        attemptId: "att-speaking-1",
        userId: "user-speaking",
        blob: dummyBlob,
        mimeType: "audio/webm",
        durationMs: 4000,
        mediaId: null,
      });

      await enqueueEvent({
        userId: "user-speaking",
        attemptId: "att-speaking-1",
        clientEventId: "evt-comp-speaking",
        eventType: "completed",
        payload: {},
        attemptToken: "tok-speaking",
      });

      expect(uploadsDb).toHaveLength(1);
      expect(eventsDb).toHaveLength(1);
      expect(await getPendingCount("user-speaking")).toBe(2);
      expect(await hasPendingWork("user-speaking")).toBe(true);
    });
  });

  describe("RF-5: Queue hygiene on user switch and logout", () => {
    it("OFF-01/audio: confirms reused uploads before completing offline speaking", async () => {
      uploadsDb.push({
        userId: "user-1",
        attemptId: "att-speaking",
        blob: new Blob(["audio"]),
        mimeType: "audio/webm",
        durationMs: 1000,
        mediaId: "media-uploaded",
        attemptToken: "attempt-token",
        createdAt: 1,
      });
      eventsDb.push({
        id: 1,
        userId: "user-1",
        attemptId: "att-speaking",
        clientEventId: "complete-speaking",
        eventType: "completed",
        payload: {},
        attemptToken: "attempt-token",
        createdAt: 1,
      });
      const calls: string[] = [];
      const fetchMock = vi.fn<typeof fetch>(async (input) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        calls.push(url);
        return new Response(null, {
          status:
            url.endsWith("/complete") &&
            !calls.some((call) => call.endsWith("/confirm"))
              ? 422
              : 204,
        });
      });
      globalThis.fetch = fetchMock;
      await executeFlush("user-1");
      expect(calls.map((url) => new URL(url).pathname)).toEqual([
        "/api/v1/media/media-uploaded/confirm",
        "/api/v1/attempts/att-speaking/complete",
      ]);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/confirm"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-attempt-token": "attempt-token",
          }),
        }),
      );
      expect(eventsDb).toHaveLength(0);
      expect(uploadsDb).toHaveLength(0);
    });

    it("OFF-01/audio: failed confirmation retains mediaId and never submits an unconfirmed recording", async () => {
      uploadsDb.push({
        userId: "user-1",
        attemptId: "att-speaking",
        blob: new Blob(["audio"]),
        mimeType: "audio/webm",
        durationMs: 1000,
        mediaId: "media-uploaded",
        attemptToken: "attempt-token",
        createdAt: 1,
      });
      eventsDb.push({
        id: 1,
        userId: "user-1",
        attemptId: "att-speaking",
        clientEventId: "complete-speaking",
        eventType: "completed",
        payload: {},
        attemptToken: "attempt-token",
        createdAt: 1,
      });
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 503 }));
      globalThis.fetch = fetchMock;
      await executeFlush("user-1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/confirm"),
        expect.anything(),
      );
      expect(eventsDb).toHaveLength(1);
      expect(uploadsDb[0]?.mediaId).toBe("media-uploaded");
    });

    it("OFF-01: active account cannot count, enqueue or forward another account records", async () => {
      eventsDb.push(
        {
          id: 1,
          userId: "user-1",
          attemptId: "active-attempt",
          clientEventId: "event-active",
          eventType: "answered",
          payload: {},
          attemptToken: "token-active",
          createdAt: 1,
        },
        {
          id: 2,
          userId: "user-other",
          attemptId: "other-attempt",
          clientEventId: "event-other",
          eventType: "answered",
          payload: {},
          attemptToken: "token-other",
          createdAt: 2,
        },
      );
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 204 }));
      globalThis.fetch = fetchMock;
      expect(await getPendingCount("user-1")).toBe(1);
      expect(await getPendingCount("user-other")).toBe(0);
      await expect(
        enqueueEvent({
          userId: "user-other",
          attemptId: "other-attempt",
          clientEventId: "forged",
          eventType: "answered",
          payload: {},
          attemptToken: "tok",
        }),
      ).rejects.toThrow("OFFLINE_IDENTITY_REQUIRED");
      await executeFlush("user-other");
      expect(fetchMock).not.toHaveBeenCalled();
      await executeFlush("user-1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/active-attempt/events"),
        expect.anything(),
      );
      expect(eventsDb.map((event) => event.userId)).toEqual(["user-other"]);
    });

    it("OFF-01: switching identity cancels an active flush before subsequent work", async () => {
      eventsDb.push(
        {
          id: 1,
          userId: "user-1",
          attemptId: "old-attempt",
          clientEventId: "event-old",
          eventType: "answered",
          payload: {},
          attemptToken: "token-old",
          createdAt: 1,
        },
        {
          id: 2,
          userId: "user-1",
          attemptId: "old-attempt",
          clientEventId: "complete-old",
          eventType: "completed",
          payload: {},
          attemptToken: "token-old",
          createdAt: 2,
        },
      );
      let release: (response: Response) => void = () => {};
      const response = new Promise<Response>((resolve) => {
        release = resolve;
      });
      const fetchMock = vi.fn().mockReturnValue(response);
      globalThis.fetch = fetchMock;
      const flushing = executeFlush("user-1");
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await purgeOtherUsersEntries("user-new");
      release(new Response(null, { status: 204 }));
      await flushing;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const options: RequestInit = fetchMock.mock.calls[0]?.[1];
      expect(options.signal?.aborted).toBe(true);
      expect(eventsDb).toHaveLength(0);
    });

    it("OFF-01: unresolved identity cannot count or flush records belonging to any user", async () => {
      eventsDb.push({
        id: 1,
        userId: "user-a",
        attemptId: "att-a",
        clientEventId: "event-a",
        eventType: "answered",
        payload: {},
        attemptToken: "token-a",
        createdAt: 1,
      });
      suspendOfflineQueue();
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock;
      expect(await getPendingCount("")).toBe(0);
      await executeFlush("");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(eventsDb).toHaveLength(1);
      await expect(
        enqueueEvent({
          userId: "",
          attemptId: "att-a",
          clientEventId: "unknown",
          eventType: "answered",
          payload: {},
          attemptToken: "token",
        }),
      ).rejects.toThrow("OFFLINE_IDENTITY_REQUIRED");
    });
    it("purges items belonging to other users when a new user logs in (RF-5)", async () => {
      eventsDb.push(
        {
          id: 1,
          userId: "user-old",
          attemptId: "att-old",
          clientEventId: "evt-old",
          eventType: "answered",
          payload: {},
          attemptToken: "tok",
          createdAt: 1,
        },
        {
          id: 2,
          userId: "user-new",
          attemptId: "att-new",
          clientEventId: "evt-new",
          eventType: "answered",
          payload: {},
          attemptToken: "tok",
          createdAt: 2,
        },
      );
      expect(eventsDb).toHaveLength(2);

      // Purge everything not belonging to user-new
      await purgeOtherUsersEntries("user-new");

      expect(eventsDb).toHaveLength(1);
      expect(eventsDb[0]?.userId).toBe("user-new");
    });

    it("purges orphaned events and uploads with missing or different userId (P0-05)", async () => {
      eventsDb.push(
        {
          id: 1,
          userId: "",
          attemptId: "att-orphan",
          clientEventId: "evt-orphan",
          eventType: "answered",
          payload: {},
          attemptToken: "tok",
          createdAt: 1,
        },
        {
          id: 2,
          userId: "user-current",
          attemptId: "att-current",
          clientEventId: "evt-current",
          eventType: "answered",
          payload: {},
          attemptToken: "tok",
          createdAt: 2,
        },
      );
      uploadsDb.push(
        {
          userId: "",
          attemptId: "att-orphan-upload",
          blob: new Blob(["a"]),
          mimeType: "audio/webm",
          durationMs: 1,
          mediaId: null,
          createdAt: 1,
        },
        {
          userId: "user-current",
          attemptId: "att-current-upload",
          blob: new Blob(["b"]),
          mimeType: "audio/webm",
          durationMs: 1,
          mediaId: null,
          createdAt: 2,
        },
      );
      expect(eventsDb).toHaveLength(2);
      expect(uploadsDb).toHaveLength(2);

      await purgeOtherUsersEntries("user-current");

      expect(eventsDb).toHaveLength(1);
      expect(eventsDb[0]?.userId).toBe("user-current");
      expect(uploadsDb).toHaveLength(1);
      expect(uploadsDb[0]?.userId).toBe("user-current");
    });

    it("clears all offline queues completely on logout (RF-5)", async () => {
      await enqueueEvent({
        userId: "user-1",
        attemptId: "att-1",
        clientEventId: "evt-1",
        eventType: "answered",
        payload: {},
        attemptToken: "tok",
      });
      const dummyBlob = new Blob(["data"], { type: "audio/webm" });
      await enqueueUpload({
        attemptId: "att-1",
        userId: "user-1",
        blob: dummyBlob,
        mimeType: "audio/webm",
        durationMs: 2000,
        mediaId: null,
      });

      expect(eventsDb).toHaveLength(1);
      expect(uploadsDb).toHaveLength(1);

      await clearOfflineQueue();

      expect(eventsDb).toHaveLength(0);
      expect(uploadsDb).toHaveLength(0);
      expect(await hasPendingWork("user-1")).toBe(false);
    });

    it("forwards answers in completionEvent payload to POST /complete during flush (ISSUE-05)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
      globalThis.fetch = mockFetch;

      // Enqueue offline first (matching real student offline completion)
      await enqueueEvent({
        userId: "user-1",
        attemptId: "att-1",
        clientEventId: "comp-1",
        eventType: "completed",
        payload: {
          answers: { pair1: "a", pair2: "b" },
        },
        attemptToken: "valid-token",
      });

      // Now come back online and flush
      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      await triggerFlush("user-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/attempts/att-1/complete"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            answers: { pair1: "a", pair2: "b" },
          }),
        }),
      );
    });

    it("self-heals by deleting empty database and recreating stores cleanly when stores are missing (ISSUE-04)", async () => {
      let openedCount = 0;
      const mockClose = vi.fn();
      const mockDeleteDatabase = vi.fn().mockImplementation(() => {
        const req = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      });

      const emptyDb = {
        objectStoreNames: {
          contains: () => false,
        },
        close: mockClose,
      };

      const validDb = {
        objectStoreNames: {
          contains: (name: string) =>
            name === "pendingEvents" || name === "pendingUploads",
        },
        close: vi.fn(),
        transaction: mockDb.transaction,
      };

      (globalThis as unknown as { window: unknown }).window = {
        indexedDB: {
          open: vi.fn(() => {
            openedCount++;
            const req = {
              result: openedCount === 1 ? emptyDb : validDb,
              onsuccess: null as (() => void) | null,
              onerror: null as (() => void) | null,
              onupgradeneeded: null as (() => void) | null,
            };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
            }, 0);
            return req;
          }),
          deleteDatabase: mockDeleteDatabase,
        },
      };

      const eventId = await enqueueEvent({
        userId: "user-1",
        attemptId: "att-heal",
        clientEventId: "heal-1",
        eventType: "answered",
        payload: { item: "1" },
        attemptToken: "tok",
      });

      expect(mockClose).toHaveBeenCalled();
      expect(mockDeleteDatabase).toHaveBeenCalledWith("englove_offline");
      expect(openedCount).toBeGreaterThanOrEqual(2);
      expect(eventId).toBeDefined();
    });

    it("ISSUE-09: batches rapid answered events and flushes combined payload", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });
      globalThis.fetch = mockFetch;

      Object.defineProperty(globalThis, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      // Enqueue 2 events rapidly
      await enqueueEvent({
        userId: "user-1",
        attemptId: "att-debounce",
        clientEventId: "deb-1",
        eventType: "answered",
        payload: { item: "1" },
        attemptToken: "tok",
      });
      await enqueueEvent({
        userId: "user-1",
        attemptId: "att-debounce",
        clientEventId: "deb-2",
        eventType: "answered",
        payload: { item: "2" },
        attemptToken: "tok",
      });

      // Immediately after enqueuing, debounce is waiting (fetch not yet called)
      expect(mockFetch).not.toHaveBeenCalled();

      // Wait 350ms for debounce timer to fire
      await new Promise((resolve) => setTimeout(resolve, 350));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/attempts/att-debounce/events"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            events: [
              {
                clientEventId: "deb-1",
                eventType: "answer_changed",
                item: "1",
              },
              {
                clientEventId: "deb-2",
                eventType: "answer_changed",
                item: "2",
              },
            ],
          }),
        }),
      );
    });
  });
});
