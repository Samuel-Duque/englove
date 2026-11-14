import {
  StudentProfileViewSchema,
  type SessionView,
  type StudentProfileView,
} from "@englove/shared";
import { apiFetch } from "./api";
import {
  resumeOfflineQueueAfterAuth,
  purgeOtherUsersEntries,
  suspendOfflineQueue,
} from "./offline-queue";
import { syncUserSegment } from "./user-segment";
import { checkAppMinVersion } from "./pwa-manager";
import { getQueryClient } from "./query-client";

let inFlightPromise: Promise<SessionView | null> | null = null;
let cachedSession: SessionView | null = null;

let inFlightProfilePromise: Promise<StudentProfileView | null> | null = null;
let cachedProfile: { data: StudentProfileView; timestamp: number } | null =
  null;

let refreshPromise: Promise<boolean> | null = null;
let lastSuccessfulRefresh = 0;

const TAB_SYNC_KEY = "englove_tab_sync_ts";
const PROFILE_CACHE_TTL_MS = 60 * 1000;
const LOGOUT_PENDING_KEY = "englove_logout_pending";
export const SESSION_EPOCH_KEY = "englove_session_epoch";
export const AUTH_SYNC_CHANNEL = "englove_auth_sync";

export interface SessionEpoch {
  gen: number;
  state: "active" | "logged_out";
  uid: string | null;
}

const TAB_INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

let logoutPendingInMemory = false;
let sessionGeneration = 0;
let tabBoundEpoch: SessionEpoch | null = null;
let currentEpochSnapshot = "0:unknown:none";
const epochListeners = new Set<() => void>();

export function getTabInstanceId(): string {
  return TAB_INSTANCE_ID;
}

function formatEpochSnapshot(epoch: SessionEpoch | null): string {
  return epoch
    ? `${epoch.gen}:${epoch.state}:${epoch.uid ?? "none"}`
    : "0:unknown:none";
}

function setBoundEpoch(next: SessionEpoch | null): void {
  tabBoundEpoch = next;
  const formatted = formatEpochSnapshot(next);
  if (formatted !== currentEpochSnapshot) {
    currentEpochSnapshot = formatted;
    for (const listener of epochListeners) {
      try {
        listener();
      } catch {
        // Ignore subscriber errors during state sync
      }
    }
  }
}

export function subscribeSessionEpoch(listener: () => void): () => void {
  epochListeners.add(listener);
  return () => {
    epochListeners.delete(listener);
  };
}

export function getSessionEpochSnapshot(): string {
  return currentEpochSnapshot;
}

export function getTabBoundEpoch(): SessionEpoch | null {
  return tabBoundEpoch;
}

export function isLogoutInitiatedLocally(): boolean {
  return logoutPendingInMemory;
}

export function parseSessionEpoch(raw: unknown): SessionEpoch | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const gen = Reflect.get(value, "gen");
  const state = Reflect.get(value, "state");
  const uid = Reflect.get(value, "uid");
  if (typeof gen !== "number" || !Number.isInteger(gen) || gen < 0) {
    return null;
  }
  if (state !== "active" && state !== "logged_out") {
    return null;
  }
  if (uid !== null && typeof uid !== "string") {
    return null;
  }
  return { gen, state, uid };
}

export function readPersistedSessionEpoch(): SessionEpoch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage?.getItem(SESSION_EPOCH_KEY);
    return raw ? parseSessionEpoch(raw) : null;
  } catch {
    return null;
  }
}

function broadcastEpochOverChannel(epoch: SessionEpoch): void {
  if (typeof BroadcastChannel !== "function") return;
  try {
    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    channel.postMessage({
      type: "session_epoch",
      sender: TAB_INSTANCE_ID,
      epoch,
    });
    channel.close();
  } catch {
    // Ignore when BroadcastChannel is unavailable or restricted
  }
}

export function publishSessionEpoch(
  state: "active" | "logged_out",
  uid: string | null,
  options?: { broadcast?: boolean },
): SessionEpoch {
  const persisted = readPersistedSessionEpoch();
  const baseGen = Math.max(persisted?.gen ?? 0, tabBoundEpoch?.gen ?? 0);
  const nextEpoch: SessionEpoch = {
    gen: baseGen + 1,
    state,
    uid,
  };
  setBoundEpoch(nextEpoch);
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.setItem(
        SESSION_EPOCH_KEY,
        JSON.stringify(nextEpoch),
      );
    }
  } catch {
    // Ignore when localStorage is blocked
  }
  if (options?.broadcast !== false) {
    broadcastEpochOverChannel(nextEpoch);
  }
  return nextEpoch;
}

export function syncBoundSessionEpoch(uid: string): {
  epoch: SessionEpoch;
  accountChanged: boolean;
} {
  const previousUid = tabBoundEpoch?.state === "active" ? tabBoundEpoch.uid : null;
  const accountChanged = Boolean(previousUid && previousUid !== uid);
  const persisted = readPersistedSessionEpoch();
  if (persisted && persisted.state === "active" && persisted.uid === uid) {
    setBoundEpoch(persisted);
    return { epoch: persisted, accountChanged };
  }
  const nextEpoch = publishSessionEpoch("active", uid, {
    broadcast: accountChanged || persisted?.uid !== undefined,
  });
  return { epoch: nextEpoch, accountChanged };
}

/** A UI lock only: revocation and authorization remain server responsibilities. */
export function isLogoutPending(): boolean {
  if (typeof window === "undefined") return false;
  if (logoutPendingInMemory) return true;
  try {
    if (window.localStorage?.getItem(LOGOUT_PENDING_KEY) === "1") return true;
  } catch {
    /* The host cookie remains available when storage is blocked. */
  }
  return (
    typeof document !== "undefined" &&
    (document.cookie ?? "")
      .split(";")
      .some((cookie) => cookie.trim() === `${LOGOUT_PENDING_KEY}=1`)
  );
}

export function markLogoutPending(): void {
  logoutPendingInMemory = true;
  clearSharedSession();
  publishSessionEpoch("logged_out", null);
  try {
    window.localStorage?.setItem(LOGOUT_PENDING_KEY, "1");
  } catch {
    /* Cookie fallback. */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${LOGOUT_PENDING_KEY}=1; path=/; max-age=31536000; SameSite=Lax${window.location?.protocol === "https:" ? "; Secure" : ""}`;
  }
}

export function confirmLogoutComplete(): void {
  logoutPendingInMemory = false;
  try {
    window.localStorage?.removeItem(LOGOUT_PENDING_KEY);
  } catch {
    /* Cookie fallback. */
  }
  if (typeof document !== "undefined")
    document.cookie = `${LOGOUT_PENDING_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

export async function settleSharedRefresh(): Promise<void> {
  await refreshPromise;
}

/**
 * Consulta la sesión actual de forma pasiva y de solo lectura vía GET /api/v1/auth/session (P0-03, QA-02).
 * No rota ni consume el refresh_token.
 */
function hasEpochInvalidationSince(startEpoch: SessionEpoch | null): boolean {
  const latest = readPersistedSessionEpoch();
  if (!latest) return false;
  if (latest.gen <= (startEpoch?.gen ?? 0)) return false;
  if (latest.state === "logged_out") return true;
  if (startEpoch?.uid && latest.uid !== startEpoch.uid) return true;
  return false;
}

export async function fetchSharedSession(
  force: boolean = false,
): Promise<SessionView | null> {
  if (isLogoutPending()) return null;
  const generation = sessionGeneration;
  const startEpoch = readPersistedSessionEpoch();
  if (!force && cachedSession) {
    return cachedSession;
  }
  if (inFlightPromise) {
    return inFlightPromise;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  inFlightPromise = (async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/session`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const minVersionSession = res.headers?.get?.("x-app-min-version");
      if (minVersionSession && typeof window !== "undefined") {
        checkAppMinVersion(minVersionSession);
      }
      if (res.status === 401) {
        cachedSession = null;
        return null;
      }
      if (!res.ok) {
        cachedSession = null;
        throw new Error(`SERVER_ERROR_${res.status}`);
      }
      const data: SessionView = await res.json();
      if (
        generation !== sessionGeneration ||
        isLogoutPending() ||
        hasEpochInvalidationSince(startEpoch)
      ) {
        return null;
      }
      await purgeOtherUsersEntries(data.user.id);
      if (
        generation !== sessionGeneration ||
        isLogoutPending() ||
        hasEpochInvalidationSince(startEpoch)
      ) {
        return null;
      }
      const { accountChanged } = syncBoundSessionEpoch(data.user.id);
      if (accountChanged) {
        cachedProfile = null;
        inFlightProfilePromise = null;
        getQueryClient().clear();
      }
      cachedSession = data;
      try {
        if (typeof window !== "undefined" && "localStorage" in window) {
          const segment =
            data.user?.role === "teacher" || data.user?.role === "admin"
              ? "teacher"
              : (data.student?.ageSegment ?? "kids");
          syncUserSegment(segment);
        }
      } catch {
        // Ignorar si localStorage está bloqueado
      }
      return data;
    } catch (err: unknown) {
      cachedSession = null;
      if (err instanceof Error && err.message.startsWith("SERVER_ERROR_")) {
        throw err;
      }
      // If network unreachable, throw NETWORK_ERROR so UI does not enter redirect loop
      throw new Error("NETWORK_ERROR", { cause: err });
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Coordina la rotación activa del token vía POST /api/v1/auth/refresh (P0-03, QA-02).
 * Utiliza navigator.locks si está disponible para evitar colisiones multi-pestaña,
 * con fallback single-flight en memoria.
 */
export async function requestSharedRefresh(): Promise<boolean> {
  if (isLogoutPending()) return false;
  const generation = sessionGeneration;
  const startEpoch = readPersistedSessionEpoch();
  const performRefresh = async (): Promise<boolean> => {
    if (
      isLogoutPending() ||
      generation !== sessionGeneration ||
      hasEpochInvalidationSince(startEpoch)
    ) {
      return false;
    }
    // Si otra pestaña o llamada refrescó en los últimos 2 segundos, no rotar de nuevo
    if (Date.now() - lastSuccessfulRefresh < 2000 && cachedSession) {
      return true;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const minVersionRefresh = res.headers?.get?.("x-app-min-version");
      if (minVersionRefresh && typeof window !== "undefined") {
        checkAppMinVersion(minVersionRefresh);
      }

      if (res.status === 401) {
        cachedSession = null;
        return false;
      }

      if (!res.ok) {
        cachedSession = null;
        return false;
      }

      const data: SessionView = await res.json();
      if (
        generation !== sessionGeneration ||
        isLogoutPending() ||
        hasEpochInvalidationSince(startEpoch)
      ) {
        return false;
      }
      await purgeOtherUsersEntries(data.user.id);
      if (
        generation !== sessionGeneration ||
        isLogoutPending() ||
        hasEpochInvalidationSince(startEpoch)
      ) {
        return false;
      }
      const { accountChanged } = syncBoundSessionEpoch(data.user.id);
      if (accountChanged) {
        cachedProfile = null;
        inFlightProfilePromise = null;
        getQueryClient().clear();
      }
      cachedSession = data;
      lastSuccessfulRefresh = Date.now();
      try {
        if (typeof window !== "undefined" && "localStorage" in window) {
          window.localStorage.setItem(
            TAB_SYNC_KEY,
            String(lastSuccessfulRefresh),
          );
          const segment =
            data.user?.role === "teacher" || data.user?.role === "admin"
              ? "teacher"
              : (data.student?.ageSegment ?? "kids");
          syncUserSegment(segment);
        }
      } catch {
        // Ignorar si localStorage está bloqueado
      }
      try {
        resumeOfflineQueueAfterAuth();
      } catch {
        // Ignorar si offline queue no está inicializada
      }
      return true;
    } catch {
      return false;
    }
  };

  if (
    typeof navigator !== "undefined" &&
    "locks" in navigator &&
    typeof navigator.locks?.request === "function"
  ) {
    try {
      return await navigator.locks.request("englove_auth_refresh", async () => {
        if (
          isLogoutPending() ||
          generation !== sessionGeneration ||
          hasEpochInvalidationSince(startEpoch)
        ) {
          return false;
        }
        // 1. Memoria local de esta pestaña
        if (Date.now() - lastSuccessfulRefresh < 2000 && cachedSession) {
          return true;
        }

        // 2. Coordinación inter-pestañas: si otra pestaña ya refrescó recientemente (dentro de 3 s),
        // comprobamos pasivamente con fetchSharedSession(true) sobre la nueva cookie sin volver a rotar
        try {
          if (typeof window !== "undefined" && "localStorage" in window) {
            const lastTabRefresh = Number(
              window.localStorage.getItem(TAB_SYNC_KEY) || 0,
            );
            if (Date.now() - lastTabRefresh < 3000) {
              const freshSession = await fetchSharedSession(true);
              if (freshSession) {
                lastSuccessfulRefresh = Date.now();
                return true;
              }
            }
          }
        } catch {
          // Ignorar si localStorage falla y continuar con refresco activo
        }

        return performRefresh();
      });
    } catch {
      // Fallback a ejecución en memoria si navigator.locks falla
    }
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      return await performRefresh();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setSharedSession(session: SessionView): void {
  if (isLogoutPending()) return;
  const previousUid =
    tabBoundEpoch?.state === "active"
      ? tabBoundEpoch.uid
      : (cachedSession?.user.id ?? null);
  if (previousUid && previousUid !== session.user.id) {
    cachedProfile = null;
    inFlightProfilePromise = null;
    getQueryClient().clear();
  }
  void purgeOtherUsersEntries(session.user.id);
  cachedSession = session;
  inFlightPromise = null;
  lastSuccessfulRefresh = Date.now();
  publishSessionEpoch("active", session.user.id);
  try {
    if (typeof window !== "undefined" && "localStorage" in window) {
      window.localStorage.setItem(TAB_SYNC_KEY, String(lastSuccessfulRefresh));
      const segment =
        session.user?.role === "teacher" || session.user?.role === "admin"
          ? "teacher"
          : (session.student?.ageSegment ?? "kids");
      syncUserSegment(segment);
    }
  } catch {
    // Ignorar si localStorage está bloqueado
  }
}

export function getSharedSession(): SessionView | null {
  return isLogoutPending() ? null : cachedSession;
}

/**
 * Obtiene el perfil del usuario autenticado deduplicando peticiones concurrentes
 * y reutilizando la respuesta en memoria para evitar saturar el rate limiter (ISSUE-09).
 */
export async function fetchSharedProfile(
  force: boolean = false,
): Promise<StudentProfileView | null> {
  if (isLogoutPending()) return null;
  const generation = sessionGeneration;
  const startEpoch = readPersistedSessionEpoch();
  const now = Date.now();
  if (
    !force &&
    cachedProfile &&
    now - cachedProfile.timestamp < PROFILE_CACHE_TTL_MS
  ) {
    return cachedProfile.data;
  }
  if (inFlightProfilePromise) {
    return inFlightProfilePromise;
  }

  inFlightProfilePromise = (async () => {
    try {
      const data = await apiFetch<StudentProfileView>("/api/v1/me", {
        schema: StudentProfileViewSchema,
      });
      if (
        isLogoutPending() ||
        generation !== sessionGeneration ||
        hasEpochInvalidationSince(startEpoch)
      ) {
        return null;
      }
      await purgeOtherUsersEntries(data.user.id);
      if (
        isLogoutPending() ||
        generation !== sessionGeneration ||
        hasEpochInvalidationSince(startEpoch)
      ) {
        return null;
      }
      const { accountChanged } = syncBoundSessionEpoch(data.user.id);
      if (accountChanged) {
        cachedSession = null;
        inFlightPromise = null;
        lastSuccessfulRefresh = 0;
        getQueryClient().clear();
      }
      cachedProfile = { data, timestamp: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      inFlightProfilePromise = null;
    }
  })();

  return inFlightProfilePromise;
}

export function setSharedProfile(profile: StudentProfileView): void {
  if (isLogoutPending()) return;
  cachedProfile = { data: profile, timestamp: Date.now() };
  inFlightProfilePromise = null;
}

export function clearSharedProfile(): void {
  cachedProfile = null;
  inFlightProfilePromise = null;
}

export function clearSharedSession(): void {
  sessionGeneration++;
  setBoundEpoch(null);
  suspendOfflineQueue();
  cachedSession = null;
  inFlightPromise = null;
  cachedProfile = null;
  inFlightProfilePromise = null;
  lastSuccessfulRefresh = 0;
  try {
    if (typeof window !== "undefined" && "localStorage" in window) {
      window.localStorage.removeItem(TAB_SYNC_KEY);
      syncUserSegment(null);
    }
  } catch {
    // Ignorar si localStorage está bloqueado
  }
}
