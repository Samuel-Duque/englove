import { z } from 'zod';
import { Level } from '../enums';

declare const URL: {
  new (url: string, base?: string): {
    protocol: string;
    hostname: string;
    username: string;
    password: string;
  };
};

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
    if (typeof URL === 'undefined') return false;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname || parsed.hostname.trim() === '') return false;
    if (parsed.username !== '' || parsed.password !== '') return false;
    return true;
  } catch {
    return false;
  }
}

export const ExternalResourceItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  level: z.nativeEnum(Level).nullable(),
  position: z.number().int(),
  createdBy: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  createdAt: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  updatedAt: z.string(),
});

export type ExternalResourceItem = z.infer<typeof ExternalResourceItemSchema>;

export const ExternalResourceListResponseSchema = z.object({
  items: z.array(ExternalResourceItemSchema),
  total: z.number().int().optional(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type ExternalResourceListResponse = z.infer<typeof ExternalResourceListResponseSchema>;

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
