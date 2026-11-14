import { FeatureFlagsResponseSchema, type FeatureFlagsResponse } from '@englove/shared';
import { apiFetch } from './api';

export type { FeatureFlagsResponse };

let cachedFeatureFlags: { data: FeatureFlagsResponse; timestamp: number } | null = null;
let inflightFeatureFlagsPromise: Promise<FeatureFlagsResponse | null> | null = null;

const CACHE_TTL_MS = 60 * 1000; // 60 segundos de caché en memoria de cliente

/**
 * Obtiene las feature flags compartidas deduplicando peticiones en vuelo y
 * reutilizando la caché en memoria durante 60 segundos para evitar agotar
 * el rate limiter de la API (ISSUE-09).
 */
export async function fetchSharedFeatureFlags(force = false): Promise<FeatureFlagsResponse | null> {
  const now = Date.now();
  if (!force && cachedFeatureFlags && now - cachedFeatureFlags.timestamp < CACHE_TTL_MS) {
    return cachedFeatureFlags.data;
  }

  if (inflightFeatureFlagsPromise) {
    return inflightFeatureFlagsPromise;
  }

  inflightFeatureFlagsPromise = (async () => {
    try {
      const data = await apiFetch<FeatureFlagsResponse>('/api/v1/feature-flags', {
        schema: FeatureFlagsResponseSchema,
      });
      cachedFeatureFlags = { data, timestamp: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      inflightFeatureFlagsPromise = null;
    }
  })();

  return inflightFeatureFlagsPromise;
}

/**
 * Invalida la caché de feature flags (ej. al cambiar de usuario o cerrar sesión).
 */
export function clearSharedFeatureFlags(): void {
  cachedFeatureFlags = null;
  inflightFeatureFlagsPromise = null;
}
