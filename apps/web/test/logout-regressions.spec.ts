import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  logoutSharedDevice,
  reconcilePendingLogout,
} from "../src/lib/auth-hygiene";
import {
  fetchSharedSession,
  requestSharedRefresh,
  isLogoutPending,
  getSharedSession,
} from "../src/lib/auth-session";
import { apiFetch } from "../src/lib/api";

const session = {
  user: {
    id: "student-a",
    role: "student",
    name: "Synthetic",
    email: "test@example.invalid",
  },
};

describe("SEG-01: failed logout never silently restores the previous account", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      sessionStorage: { clear: vi.fn() },
      location: { origin: "http://localhost:3000" },
    });
    vi.stubGlobal("navigator", { onLine: true });
    const cookies = new Map<string, string>();
    vi.stubGlobal("document", {
      get cookie() {
        return [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
      },
      set cookie(raw: string) {
        const [pair = ""] = raw.split(";");
        const separator = pair.indexOf("=");
        const key = pair.slice(0, separator);
        const value = pair.slice(separator + 1);
        if (/max-age=0/i.test(raw)) cookies.delete(key);
        else cookies.set(key, value);
      },
    });
  });
  afterEach(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await reconcilePendingLogout();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(["network", "500", "timeout"])(
    "keeps logout pending after %s and blocks session, refresh and private API",
    async (failure) => {
      vi.useFakeTimers();
      const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
        failure === "network"
          ? Promise.reject(new TypeError("offline"))
          : failure === "500"
            ? Promise.resolve(new Response(null, { status: 500 }))
            : new Promise<Response>((_, reject) => {
                init?.signal?.addEventListener(
                  "abort",
                  () => reject(new DOMException("Aborted", "AbortError")),
                  { once: true },
                );
              }),
      );
      vi.stubGlobal("fetch", fetchMock);
      const result = logoutSharedDevice(new QueryClient());
      await vi.advanceTimersByTimeAsync(10001);
      expect(await result).toBe(false);
      expect(isLogoutPending()).toBe(true);
      fetchMock.mockResolvedValue(new Response(JSON.stringify(session)));
      expect(await fetchSharedSession(true)).toBeNull();
      expect(await requestSharedRefresh()).toBe(false);
      await expect(apiFetch("/api/v1/me")).rejects.toMatchObject({
        code: "LOGOUT_PENDING",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(document.cookie).toContain("englove_logout_pending=1");
    },
  );

  it("clears the pending marker only after server confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );
    expect(await logoutSharedDevice(new QueryClient())).toBe(false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    expect(await reconcilePendingLogout()).toBe(true);
    expect(isLogoutPending()).toBe(false);
  });

  it("ignores a session response that arrives after logout hygiene", async () => {
    let release: (response: Response) => void = () => {};
    const response = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/session")
          ? response
          : Promise.resolve(new Response(null, { status: 204 })),
      ),
    );
    const reading = fetchSharedSession(true);
    expect(await logoutSharedDevice(new QueryClient())).toBe(true);
    release(new Response(JSON.stringify(session)));
    expect(await reading).toBeNull();
    expect(getSharedSession()).toBeNull();
  });

  it("revokes after an in-flight refresh so its late cookie response cannot undo logout", async () => {
    let release: (response: Response) => void = () => {};
    const response = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        calls.push(url);
        return url.endsWith("/refresh")
          ? response
          : Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
    const refreshing = requestSharedRefresh();
    const loggingOut = logoutSharedDevice(new QueryClient());
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    release(new Response(JSON.stringify(session)));
    expect(await refreshing).toBe(false);
    expect(await loggingOut).toBe(true);
    expect(calls.map((url) => new URL(url).pathname)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/logout",
    ]);
    expect(getSharedSession()).toBeNull();
  });
});
