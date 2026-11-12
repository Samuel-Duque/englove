import type { QueryClient } from "@tanstack/react-query";
import { getQueryClient } from "./query-client";
import {
  clearSharedSession,
  markLogoutPending,
  isLogoutPending,
  confirmLogoutComplete,
  settleSharedRefresh,
} from "./auth-session";
import { clearSharedFeatureFlags } from "./feature-flags-client";

/**
 * Performs client-side hygiene on logout or session expiration (Rule G-C13, RF-18).
 * Clears TanStack Query cache, in-memory caches, and IndexedDB pending queues on shared tablets.
 */
export async function clearSharedDeviceSession(
  queryClient: QueryClient = getQueryClient(),
): Promise<void> {
  // Cancel in-flight queries and drop every cached response of the previous account
  await queryClient.cancelQueries();
  queryClient.clear();
  clearSharedSession();
  clearSharedFeatureFlags();

  // Clear IndexedDB pending queues if running in browser (RF-6, ISSUE-04)
  if (typeof window !== "undefined" && "indexedDB" in window) {
    try {
      const dbNames = ["englove_offline", "englove_storage"];
      let targetDbs = dbNames;

      // Check if databases() API exists so we do NOT prematurely create empty DBs (ISSUE-04)
      if (
        "databases" in window.indexedDB &&
        typeof window.indexedDB.databases === "function"
      ) {
        try {
          const existing = await window.indexedDB.databases();
          const existingNames = new Set(existing.map((d) => d.name));
          targetDbs = dbNames.filter((name) => existingNames.has(name));
        } catch {
          targetDbs = dbNames;
        }
      }

      await Promise.allSettled(
        targetDbs.map(
          (name) =>
            new Promise<void>((resolve) => {
              try {
                const req = window.indexedDB.open(name);
                req.onupgradeneeded = (event) => {
                  if (event.oldVersion === 0) {
                    if (req.transaction) {
                      req.transaction.abort();
                    }
                  }
                };
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
                req.onsuccess = async () => {
                  try {
                    const db = req.result;
                    // If the database has 0 stores (created empty or corrupt), close and delete it immediately (ISSUE-04)
                    if (
                      db.objectStoreNames &&
                      "length" in db.objectStoreNames &&
                      db.objectStoreNames.length === 0
                    ) {
                      db.close();
                      if (
                        typeof window.indexedDB.deleteDatabase === "function"
                      ) {
                        window.indexedDB.deleteDatabase(name);
                      }
                      resolve();
                      return;
                    }
                    const storeNames = ["pendingEvents", "pendingUploads"];
                    const clearPromises: Promise<void>[] = [];
                    for (const sName of storeNames) {
                      if (db.objectStoreNames.contains(sName)) {
                        const tx = db.transaction(sName, "readwrite");
                        tx.objectStore(sName).clear();
                        if (tx && "oncomplete" in tx) {
                          clearPromises.push(
                            new Promise<void>((resTx) => {
                              tx.oncomplete = () => resTx();
                              tx.onerror = () => resTx();
                              tx.onabort = () => resTx();
                            }),
                          );
                        }
                      }
                    }
                    if (clearPromises.length > 0) {
                      await Promise.allSettled(clearPromises);
                    }
                    db.close();

                    if (typeof window.indexedDB.deleteDatabase === "function") {
                      await new Promise<void>((delRes) => {
                        try {
                          const delReq = window.indexedDB.deleteDatabase(name);
                          if (delReq && "onsuccess" in delReq) {
                            delReq.onsuccess = () => delRes();
                            delReq.onerror = () => delRes();
                            delReq.onblocked = () => delRes();
                          } else {
                            delRes();
                          }
                        } catch {
                          delRes();
                        }
                      });
                    }
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

  // Clear non-static entries from Cache Storage (RF-5, RF-18, Decisión 135)
  // Preserves static precache (serwist precache or englove-static)
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cacheStorage = window.caches;
      const keys = await cacheStorage.keys();
      await Promise.all(
        keys.map(async (key) => {
          const isPrecache =
            key.includes("-precache-") ||
            key.startsWith("serwist-precache") ||
            key.startsWith("englove-precache") ||
            key.startsWith("englove-static-");
          if (!isPrecache) {
            await cacheStorage.delete(key);
          }
        }),
      );
    } catch {
      // Ignore
    }
  }

  // Clear session storage & session indicators (RF-5, RF-18, P0-05)
  if (typeof window !== "undefined") {
    try {
      if ("sessionStorage" in window) window.sessionStorage.clear();
      if (typeof document !== "undefined") {
        document.cookie =
          "englove_user_logged=; path=/; max-age=0; SameSite=Lax";
        const cookies = document.cookie.split(";");
        for (const c of cookies) {
          const name = c.split("=")[0]?.trim();
          if (
            name &&
            (name === "session_hint" ||
              name.endsWith("_session_hint") ||
              name.includes("session_hint"))
          ) {
            document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
          }
        }
      }
    } catch {
      // Ignore
    }
  }
}

let logoutRequest: Promise<boolean> | null = null;

/** Revoke the old family before allowing another account or silent refresh. */
export function reconcilePendingLogout(): Promise<boolean> {
  if (!isLogoutPending()) return Promise.resolve(true);
  if (logoutRequest) return logoutRequest;
  logoutRequest = (async () => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("LOGOUT_TIMEOUT"));
        }, 10000);
      });
      const revoke = async () => {
        await settleSharedRefresh();
        controller.signal.throwIfAborted();
        return fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/auth/logout`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
          },
        );
      };
      // A refresh already in flight may still set HttpOnly cookies. Revoke after it,
      // under the same cross-tab lock, instead of letting its response restore them.
      const revocation =
        typeof navigator !== "undefined" &&
        typeof navigator.locks?.request === "function"
          ? navigator.locks.request(
              "englove_auth_refresh",
              { signal: controller.signal },
              revoke,
            )
          : revoke();
      const response = await Promise.race([revocation, timeout]);
      if (!response.ok) return false;
      confirmLogoutComplete();
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
      logoutRequest = null;
    }
  })();
  return logoutRequest;
}

export async function logoutSharedDevice(
  queryClient: QueryClient = getQueryClient(),
): Promise<boolean> {
  markLogoutPending();
  await clearSharedDeviceSession(queryClient);
  return reconcilePendingLogout();
}
