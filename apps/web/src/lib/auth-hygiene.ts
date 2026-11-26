import type { QueryClient } from "@tanstack/react-query";
import { getQueryClient } from "./query-client";
import {
  AUTH_SYNC_CHANNEL,
  SESSION_EPOCH_KEY,
  clearSharedSession,
  confirmLogoutComplete,
  getTabBoundEpoch,
  getTabInstanceId,
  isLogoutInitiatedLocally,
  isLogoutPending,
  markLogoutPending,
  parseSessionEpoch,
  publishSessionEpoch,
  readPersistedSessionEpoch,
  settleSharedRefresh,
} from "./auth-session";
import { clearSharedFeatureFlags } from "./feature-flags-client";

export interface ClearSharedDeviceOptions {
  broadcast?: boolean;
}

/**
 * Performs client-side hygiene on logout or session expiration (Rule G-C13, RF-18).
 * Clears TanStack Query cache, in-memory caches, and IndexedDB pending queues on shared tablets.
 */
export async function clearSharedDeviceSession(
  queryClient: QueryClient = getQueryClient(),
  options?: ClearSharedDeviceOptions,
): Promise<void> {
  // Drop in-memory session, flags, and cached responses synchronously before awaiting async cleanup
  clearSharedSession();
  clearSharedFeatureFlags();
  queryClient.clear();
  if (options?.broadcast !== false && !isLogoutInitiatedLocally()) {
    const persisted = readPersistedSessionEpoch();
    if (persisted?.state !== "logged_out") {
      publishSessionEpoch("logged_out", null);
    }
  }
  await queryClient.cancelQueries();
  queryClient.clear();

  // Clear IndexedDB pending queues if running in browser (RF-6, ISSUE-04)
  if (typeof window !== "undefined" && "indexedDB" in window) {
    try {
      const dbNames = ["upward_english_offline", "upward_english_storage"];
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
  // Preserves static precache (serwist precache or upward-english-static)
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cacheStorage = window.caches;
      const keys = await cacheStorage.keys();
      await Promise.all(
        keys.map(async (key) => {
          const isPrecache =
            key.includes("-precache-") ||
            key.startsWith("serwist-precache") ||
            key.startsWith("upward-english-precache") ||
            key.startsWith("upward-english-static-");
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
        expireClientCookie("upward_english_user_logged");
        const expiredHintNames = new Set<string>();
        const cookies = document.cookie.split(";");
        for (const c of cookies) {
          const eqIdx = c.indexOf("=");
          if (eqIdx <= 0) continue;
          const name = c.slice(0, eqIdx).trim();
          if (
            name &&
            !expiredHintNames.has(name) &&
            (name === "session_hint" ||
              name.endsWith("_session_hint") ||
              name.includes("session_hint"))
          ) {
            expiredHintNames.add(name);
            expireClientCookie(name);
          }
        }
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Dominios candidatos (`.app.example.org`, `.example.org`) donde la API pudo emitir la cookie con
 * `Domain=` (COOKIE_DOMAIN, decisión 58). Sin dominios para localhost, IPs u hosts de una etiqueta.
 * Los sufijos públicos que el navegador rechace (p. ej. `.edu.co`) se ignoran sin efecto.
 */
export function getCookieDomainCandidates(hostname: string): string[] {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (
    host === "" ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  ) {
    return [];
  }
  const labels = host.split(".");
  if (labels.some((label) => label === "")) return [];
  const candidates: string[] = [];
  for (let i = 0; i <= labels.length - 2; i += 1) {
    candidates.push(`.${labels.slice(i).join(".")}`);
  }
  return candidates;
}

function resolveLocationOriginParts(
  location: Partial<Location> | undefined,
): { hostname: string; protocol: string } {
  let hostname = typeof location?.hostname === "string" ? location.hostname : "";
  let protocol = typeof location?.protocol === "string" ? location.protocol : "";
  if ((!hostname || !protocol) && typeof location?.origin === "string" && location.origin !== "") {
    try {
      const parsed = new URL(location.origin);
      if (!hostname) hostname = parsed.hostname;
      if (!protocol) protocol = parsed.protocol;
    } catch {
      // Ignore malformed origin
    }
  }
  return { hostname, protocol };
}

/**
 * SEC-LOGOUT-01: expira la cookie tanto host-only como con cada `Domain=` candidato; una escritura
 * sin `Domain` no reemplaza una cookie emitida con `Domain=.dominio` (RFC 6265 §5.3).
 */
function expireClientCookie(name: string): void {
  const location = typeof window !== "undefined" ? window.location : undefined;
  const { hostname, protocol } = resolveLocationOriginParts(location);
  const secure = protocol === "https:" ? "; Secure" : "";
  const base = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`;
  document.cookie = base;
  for (const domain of getCookieDomainCandidates(hostname)) {
    document.cookie = `${base}; domain=${domain}`;
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
              "upward_english_auth_refresh",
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
  await clearSharedDeviceSession(queryClient, { broadcast: false });
  return reconcilePendingLogout();
}

export function isPublicAppRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/offline" ||
    pathname === "/terminos" ||
    pathname.startsWith("/terminos/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/registro" ||
    pathname.startsWith("/registro/") ||
    pathname.startsWith("/recuperar") ||
    pathname === "/restablecer" ||
    pathname.startsWith("/restablecer/")
  );
}

export type CrossTabInvalidationReason = "logout" | "account_switch";

export interface CrossTabSessionSyncOptions {
  queryClient?: QueryClient;
  getPathname?: () => string;
  onInvalidate: (reason: CrossTabInvalidationReason) => void;
}

export function startCrossTabSessionSync(
  options: CrossTabSessionSyncOptions,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const queryClient = options.queryClient ?? getQueryClient();
  const getPathname =
    options.getPathname ?? (() => window.location?.pathname ?? "/");
  const initialEpoch = readPersistedSessionEpoch();
  const baselineGen = initialEpoch?.gen ?? 0;
  const baselineUid =
    initialEpoch?.state === "active" ? initialEpoch.uid : null;
  let invalidated = false;

  const resolveBoundUid = (
    bound: ReturnType<typeof getTabBoundEpoch>,
  ): string | null => {
    if (bound?.state === "active") {
      return bound.uid;
    }
    return !isPublicAppRoute(getPathname()) ? baselineUid : null;
  };

  const triggerInvalidation = (reason: CrossTabInvalidationReason): void => {
    if (invalidated) return;
    if (!isPublicAppRoute(getPathname())) {
      invalidated = true;
    }
    clearSharedSession();
    clearSharedFeatureFlags();
    queryClient.clear();
    void queryClient.cancelQueries();
    options.onInvalidate(reason);
  };

  const evaluate = (storageCleared = false): void => {
    if (invalidated || isLogoutInitiatedLocally()) return;

    const bound = getTabBoundEpoch();
    const boundUid = resolveBoundUid(bound);
    const persisted = readPersistedSessionEpoch();
    const isProtectedRoute = !isPublicAppRoute(getPathname());

    if (isLogoutPending()) {
      triggerInvalidation("logout");
      return;
    }

    if (
      storageCleared &&
      (bound?.state === "active" || (isProtectedRoute && baselineUid !== null))
    ) {
      triggerInvalidation("logout");
      return;
    }

    if (persisted?.state === "logged_out") {
      if (bound?.state === "active" || persisted.gen > baselineGen) {
        triggerInvalidation("logout");
      }
      return;
    }

    if (
      boundUid !== null &&
      persisted?.state === "active" &&
      persisted.uid !== null &&
      persisted.uid !== boundUid
    ) {
      triggerInvalidation("account_switch");
    }
  };

  const onStorage = (event: StorageEvent): void => {
    if (event.key === null) {
      evaluate(true);
      return;
    }
    if (event.key === SESSION_EPOCH_KEY) {
      evaluate(event.newValue === null);
      return;
    }
    if (event.key === "upward_english_logout_pending") {
      evaluate(false);
    }
  };

  const onFocusOrVisible = (): void => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }
    evaluate(false);
  };

  let channel: BroadcastChannel | null = null;
  const onChannelMessage = (event: MessageEvent): void => {
    const data: unknown = event.data;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return;
    }
    const type = Reflect.get(data, "type");
    const sender = Reflect.get(data, "sender");
    if (type !== "session_epoch" || sender === getTabInstanceId()) {
      return;
    }
    const epoch = parseSessionEpoch(Reflect.get(data, "epoch"));
    if (!epoch) return;
    const bound = getTabBoundEpoch();
    const boundUid = resolveBoundUid(bound);
    if (epoch.state === "logged_out") {
      if (
        !isLogoutInitiatedLocally() &&
        (bound?.state === "active" || epoch.gen > baselineGen)
      ) {
        triggerInvalidation("logout");
      }
      return;
    }
    if (boundUid !== null && epoch.uid !== null && epoch.uid !== boundUid) {
      triggerInvalidation("account_switch");
    }
  };

  if (typeof BroadcastChannel === "function") {
    try {
      channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
      channel.addEventListener("message", onChannelMessage);
    } catch {
      channel = null;
    }
  }

  window.addEventListener?.("storage", onStorage);
  window.addEventListener?.("focus", onFocusOrVisible);
  window.addEventListener?.("pageshow", onFocusOrVisible);
  if (typeof document !== "undefined") {
    document.addEventListener?.("visibilitychange", onFocusOrVisible);
  }

  // Run an immediate check in case another tab logged out during hydration
  evaluate(false);

  return () => {
    window.removeEventListener?.("storage", onStorage);
    window.removeEventListener?.("focus", onFocusOrVisible);
    window.removeEventListener?.("pageshow", onFocusOrVisible);
    if (typeof document !== "undefined") {
      document.removeEventListener?.("visibilitychange", onFocusOrVisible);
    }
    if (channel) {
      try {
        channel.removeEventListener("message", onChannelMessage);
        channel.close();
      } catch {
        // Ignore close errors
      }
    }
  };
}
