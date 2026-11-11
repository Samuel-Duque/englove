import { StudentProfileViewSchema, type SessionView, type StudentProfileView } from '@englove/shared';
import { apiFetch } from './api';
import { resumeOfflineQueueAfterAuth } from './offline-queue';
import { syncUserSegment } from './user-segment';
import { checkAppMinVersion } from './pwa-manager';

let inFlightPromise: Promise<SessionView | null> | null = null;
let cachedSession: SessionView | null = null;

let inFlightProfilePromise: Promise<StudentProfileView | null> | null = null;
let cachedProfile: { data: StudentProfileView; timestamp: number } | null = null;

let refreshPromise: Promise<boolean> | null = null;
let lastSuccessfulRefresh = 0;

const TAB_SYNC_KEY = 'englove_tab_sync_ts';
const PROFILE_CACHE_TTL_MS = 60 * 1000;

/**
 * Consulta la sesión actual de forma pasiva y de solo lectura vía GET /api/v1/auth/session (P0-03, QA-02).
 * No rota ni consume el refresh_token.
 */
export async function fetchSharedSession(force: boolean = false): Promise<SessionView | null> {
  if (!force && cachedSession) {
    return cachedSession;
  }
  if (inFlightPromise) {
    return inFlightPromise;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  inFlightPromise = (async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/session`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const minVersionSession = res.headers?.get?.('x-app-min-version');
      if (minVersionSession && typeof window !== 'undefined') {
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
      cachedSession = data;
      try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
          const segment = (data.user?.role === 'teacher' || data.user?.role === 'admin')
            ? 'teacher'
            : (data.student?.ageSegment ?? 'kids');
          syncUserSegment(segment);
        }
      } catch {
        // Ignorar si localStorage está bloqueado
      }
      return data;
    } catch (err: unknown) {
      cachedSession = null;
      if (err instanceof Error && err.message.startsWith('SERVER_ERROR_')) {
        throw err;
      }
      // If network unreachable, throw NETWORK_ERROR so UI does not enter redirect loop
      throw new Error('NETWORK_ERROR', { cause: err });
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
  const performRefresh = async (): Promise<boolean> => {
    // Si otra pestaña o llamada refrescó en los últimos 2 segundos, no rotar de nuevo
    if (Date.now() - lastSuccessfulRefresh < 2000 && cachedSession) {
      return true;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const minVersionRefresh = res.headers?.get?.('x-app-min-version');
      if (minVersionRefresh && typeof window !== 'undefined') {
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
      cachedSession = data;
      lastSuccessfulRefresh = Date.now();
      try {
        if (typeof window !== 'undefined' && 'localStorage' in window) {
          window.localStorage.setItem(TAB_SYNC_KEY, String(lastSuccessfulRefresh));
          const segment = (data.user?.role === 'teacher' || data.user?.role === 'admin')
            ? 'teacher'
            : (data.student?.ageSegment ?? 'kids');
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
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof navigator.locks?.request === 'function'
  ) {
    try {
      return await navigator.locks.request('englove_auth_refresh', async () => {
        // 1. Memoria local de esta pestaña
        if (Date.now() - lastSuccessfulRefresh < 2000 && cachedSession) {
          return true;
        }

        // 2. Coordinación inter-pestañas: si otra pestaña ya refrescó recientemente (dentro de 3 s),
        // comprobamos pasivamente con fetchSharedSession(true) sobre la nueva cookie sin volver a rotar
        try {
          if (typeof window !== 'undefined' && 'localStorage' in window) {
            const lastTabRefresh = Number(window.localStorage.getItem(TAB_SYNC_KEY) || 0);
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
  cachedSession = session;
  inFlightPromise = null;
  lastSuccessfulRefresh = Date.now();
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      window.localStorage.setItem(TAB_SYNC_KEY, String(lastSuccessfulRefresh));
      const segment = (session.user?.role === 'teacher' || session.user?.role === 'admin')
        ? 'teacher'
        : (session.student?.ageSegment ?? 'kids');
      syncUserSegment(segment);
    }
  } catch {
    // Ignorar si localStorage está bloqueado
  }
}

export function getSharedSession(): SessionView | null {
  return cachedSession;
}

/**
 * Obtiene el perfil del usuario autenticado deduplicando peticiones concurrentes
 * y reutilizando la respuesta en memoria para evitar saturar el rate limiter (ISSUE-09).
 */
export async function fetchSharedProfile(force: boolean = false): Promise<StudentProfileView | null> {
  const now = Date.now();
  if (!force && cachedProfile && now - cachedProfile.timestamp < PROFILE_CACHE_TTL_MS) {
    return cachedProfile.data;
  }
  if (inFlightProfilePromise) {
    return inFlightProfilePromise;
  }

  inFlightProfilePromise = (async () => {
    try {
      const data = await apiFetch<StudentProfileView>('/api/v1/me', {
        schema: StudentProfileViewSchema,
      });
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
  cachedProfile = { data: profile, timestamp: Date.now() };
  inFlightProfilePromise = null;
}

export function clearSharedProfile(): void {
  cachedProfile = null;
  inFlightProfilePromise = null;
}

export function clearSharedSession(): void {
  cachedSession = null;
  inFlightPromise = null;
  cachedProfile = null;
  inFlightProfilePromise = null;
  lastSuccessfulRefresh = 0;
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      window.localStorage.removeItem(TAB_SYNC_KEY);
      syncUserSegment(null);
    }
  } catch {
    // Ignorar si localStorage está bloqueado
  }
}
