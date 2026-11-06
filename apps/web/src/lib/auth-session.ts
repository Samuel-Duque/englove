import type { SessionView, StudentProfileView } from '@englove/shared';
import { apiFetch } from './api';

let inFlightPromise: Promise<SessionView | null> | null = null;
let cachedSession: SessionView | null = null;

let inFlightProfilePromise: Promise<StudentProfileView | null> | null = null;
let cachedProfile: { data: StudentProfileView; timestamp: number } | null = null;

const PROFILE_CACHE_TTL_MS = 60 * 1000;

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
      const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        cachedSession = null;
        return null;
      }
      const data: SessionView = await res.json();
      cachedSession = data;
      return data;
    } catch {
      cachedSession = null;
      return null;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function setSharedSession(session: SessionView): void {
  cachedSession = session;
  inFlightPromise = null;
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
      const data = await apiFetch<StudentProfileView>('/api/v1/me');
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
}
