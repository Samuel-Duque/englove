import { checkAppMinVersion } from "./pwa-manager";
import { requestSharedRefresh, isLogoutPending } from "./auth-session";

export interface ApiErrorResponse {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  }
  return process.env.API_URL || "http://localhost:3001";
};

export { requestSharedRefresh };

export interface ApiFetchOptions<T = unknown> extends RequestInit {
  schema?: { parse: (val: unknown) => T };
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions<T> = {},
  isRetry: boolean = false,
): Promise<T> {
  if (isLogoutPending() && !path.startsWith("/api/v1/auth/")) {
    throw new ApiError(
      401,
      "LOGOUT_PENDING",
      "No se pudo confirmar el cierre de sesión. Reintenta cuando haya conexión.",
    );
  }
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(options.headers);
  if (
    !headers.has("Content-Type") &&
    options.body &&
    typeof options.body === "string"
  ) {
    headers.set("Content-Type", "application/json");
  }

  const { schema, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include",
  });

  if (isLogoutPending() && !path.startsWith("/api/v1/auth/")) {
    throw new ApiError(401, "LOGOUT_PENDING", "Cierre de sesión pendiente.");
  }

  // Check minimum required version header from API (RF-7)
  const minVersion = response.headers.get("x-app-min-version");
  if (minVersion && typeof window !== "undefined") {
    checkAppMinVersion(minVersion);
  }

  // Single-flight refresh on 401 (RF-2)
  const isAuthRoute =
    path.includes("/auth/login") ||
    path.includes("/auth/refresh") ||
    path.includes("/auth/logout") ||
    path.includes("/auth/signup") ||
    path.includes("/auth/session");

  if (
    response.status === 401 &&
    !isRetry &&
    !isAuthRoute &&
    typeof window !== "undefined"
  ) {
    const refreshed = await requestSharedRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
  }

  if (response.status === 204) {
    // guardrails-ignore G-C12: frontera genérica HTTP de apiFetch<T> para respuesta 204 No Content
    return undefined as unknown as T;
  }

  let data: unknown;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let errorCode = "ERROR";
    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    let errorDetails: unknown;
    if (typeof data === "object" && data !== null) {
      const code = Reflect.get(data, "code");
      if (typeof code === "string") errorCode = code;
      const message = Reflect.get(data, "message");
      if (Array.isArray(message)) {
        errorMessage = message
          .filter((m): m is string => typeof m === "string")
          .join(", ");
      } else if (typeof message === "string") {
        errorMessage = message;
      }
      errorDetails = Reflect.get(data, "details");
    }
    throw new ApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  if (schema) {
    return schema.parse(data);
  }

  // guardrails-ignore G-C12: frontera genérica HTTP de apiFetch<T> cuando se invoca sin schema Zod explícito
  return data as T;
}
