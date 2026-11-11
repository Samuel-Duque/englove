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
  description: z.string().nullable().optional().default(null),
  level: z.nativeEnum(Level).nullable().optional().default(null),
  position: z.number().int().optional().default(0),
  createdBy: z.string().optional().default(''),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  updatedAt: z.string().optional().default(() => new Date().toISOString()),
});

export type ExternalResourceItem = z.infer<typeof ExternalResourceItemSchema>;

export const ExternalResourceListResponseSchema = z.object({
  items: z.array(ExternalResourceItemSchema),
  total: z.number().int().optional().default(0),
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
