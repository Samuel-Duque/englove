import type { SessionView } from '@englove/shared';

let inFlightPromise: Promise<SessionView | null> | null = null;
let cachedSession: SessionView | null = null;

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

export function clearSharedSession(): void {
  cachedSession = null;
  inFlightPromise = null;
}
