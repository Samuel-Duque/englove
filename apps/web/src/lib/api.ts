import { checkAppMinVersion } from './pwa-manager';
import { fetchSharedSession } from './auth-session';

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string | string[];
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  return process.env.API_URL || 'http://localhost:3001';
};

let refreshPromise: Promise<boolean> | null = null;

export async function requestSharedRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    try {
      const session = await fetchSharedSession(true);
      return session !== null;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry: boolean = false,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Check minimum required version header from API (RF-7)
  const minVersion = response.headers.get('x-app-min-version');
  if (minVersion && typeof window !== 'undefined') {
    checkAppMinVersion(minVersion);
  }

  // Single-flight refresh on 401 (RF-2)
  const isAuthRoute =
    path.includes('/auth/login') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/logout') ||
    path.includes('/auth/signup');

  if (response.status === 401 && !isRetry && !isAuthRoute && typeof window !== 'undefined') {
    const refreshed = await requestSharedRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse | null;
    const msg = Array.isArray(errorData?.message)
      ? errorData?.message.join(', ')
      : errorData?.message || `Error ${response.status}: ${response.statusText}`;
    throw new ApiError(response.status, errorData?.code || 'ERROR', msg);
  }

  return data as T;
}
