import type { Level } from '../enums';

interface ParsedUrlLike {
  protocol: string;
  hostname: string;
  username: string;
  password: string;
}

interface UrlConstructorLike {
  new (url: string): ParsedUrlLike;
}

/**
 * Validador puro para URLs de recursos externos en https:// (decisión 79, G-C13).
 * Compartido entre formularios web y decorador de clase en NestJS.
 */
export function isValidHttpsResourceUrl(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 2048) return false;
  if (/\s/.test(trimmed)) return false;
  try {
    const UrlCtor = (globalThis as unknown as { URL?: UrlConstructorLike }).URL;
    if (!UrlCtor) return false;
    const parsed = new UrlCtor(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname || parsed.hostname.trim() === '') return false;
    if (parsed.username !== '' || parsed.password !== '') return false;
    return true;
  } catch {
    return false;
  }
}

export interface ExternalResourceItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  level: Level | null;
  position: number;
  createdBy: string;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  createdAt: string;
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  updatedAt: string;
}

export interface ExternalResourceListResponse {
  items: ExternalResourceItem[];
  total: number;
}

export interface CreateExternalResourceRequest {
  title: string;
  url: string;
  description?: string | null;
  level?: Level | null;
}

export interface UpdateExternalResourceRequest {
  title?: string;
  url?: string;
  description?: string | null;
  level?: Level | null;
}

export interface ReorderExternalResourcesRequest {
  resourceIds: string[];
}

export interface UpdateExtraContentFlagRequest {
  enabled: boolean;
}
