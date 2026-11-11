import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from '@englove/shared';
import { ApiError, apiFetch, getApiBaseUrl } from '../src/lib/api';

describe('T1.1 / P0-09: apiFetch Zod validation and ApiError details preservation', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it('ApiError constructor preserves details, code, and statusCode', () => {
    const detailsObj = { attemptId: 'att-123', remainingRetries: 1 };
    const err = new ApiError(409, 'UNCONSUMED_RETRY_WARNING', 'Ya tienes un intento activo', detailsObj);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('UNCONSUMED_RETRY_WARNING');
    expect(err.message).toBe('Ya tienes un intento activo');
    expect(err.details).toEqual(detailsObj);
  });

  it('apiFetch extracts and attaches details to ApiError from error responses (P0-09, T1.1)', async () => {
    const errorBody = {
      statusCode: 409,
      code: 'UNCONSUMED_RETRY_WARNING',
      message: 'Tienes un intento en curso',
      details: { existingAttemptId: 'att-999', retryCount: 2 },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorBody,
    });

    try {
      await apiFetch('/api/v1/assignments/asg-1/attempts', { method: 'POST' });
      expect.fail('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBe(409);
      expect(apiErr.code).toBe('UNCONSUMED_RETRY_WARNING');
      expect(apiErr.details).toEqual({ existingAttemptId: 'att-999', retryCount: 2 });
    }
  });

  it('apiFetch validates response against provided Zod schema (T1.1)', async () => {
    const sampleSchema = z.object({
      id: z.string().uuid(),
      score: z.number().min(0).max(5),
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        score: 4.5,
      }),
    });

    const validated = await apiFetch('/api/v1/attempts/att-1', {
      schema: sampleSchema,
    });

    expect(validated).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      score: 4.5,
    });
  });

  it('apiFetch throws ZodError when response does not match the schema (T1.1)', async () => {
    const sampleSchema = z.object({
      id: z.string().uuid(),
      score: z.number().min(0).max(5),
    });

    // Server returns invalid data (invalid score > 5, invalid uuid)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        id: 'not-a-uuid',
        score: 10,
      }),
    });

    await expect(
      apiFetch('/api/v1/attempts/att-1', {
        schema: sampleSchema,
      }),
    ).rejects.toThrow();
  });

  it('handles 204 No Content gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const result = await apiFetch<void>('/api/v1/logout', { method: 'POST' });
    expect(result).toBeUndefined();
  });

  it('resolves getApiBaseUrl correctly in SSR and browser', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(getApiBaseUrl()).toBe('http://localhost:3001');

    (globalThis as unknown as { window: unknown }).window = {};
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });
});
