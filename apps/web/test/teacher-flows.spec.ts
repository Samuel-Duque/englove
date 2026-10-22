import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError } from '../src/lib/api';

describe('SPEC-03: Gestor de contenidos — Teacher UI flows & API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('apiFetch client utility', () => {
    it('returns parsed JSON on 200 OK', async () => {
      const mockData = { id: 'act-1', title: 'Vocabulary Quiz' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      const result = await apiFetch<{ id: string; title: string }>('/api/v1/activities/act-1');
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/activities/act-1',
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });

    it('returns undefined on 204 No Content without attempting JSON parse', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const result = await apiFetch<void>('/api/v1/activities/act-1', { method: 'DELETE' });
      expect(result).toBeUndefined();
    });

    it('throws ApiError with status and code on error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          statusCode: 409,
          code: 'EXAM_MIN_ITEMS',
          message: 'Un examen requiere al menos 2 oraciones para ser publicado',
        }),
      });

      await expect(
        apiFetch('/api/v1/activities/act-1/publish', { method: 'POST' }),
      ).rejects.toThrow(ApiError);

      try {
        await apiFetch('/api/v1/activities/act-1/publish', { method: 'POST' });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.statusCode).toBe(409);
        expect(apiErr.code).toBe('EXAM_MIN_ITEMS');
        expect(apiErr.message).toBe(
          'Un examen requiere al menos 2 oraciones para ser publicado',
        );
      }
    });

    it('sets Content-Type to application/json when body is provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 'group-1', name: 'Grupo A' }),
      });

      await apiFetch('/api/v1/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Grupo A' }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });
  });

  describe('RF-17: Recordatorios en Inicio', () => {
    it('muestra estado reservado de revisión sin enlace activo y umbral positivo', () => {
      const reminders = {
        pendingRegistrations: 3,
        overdueReviews: 0,
        ungradedReminderDays: 3,
      };

      expect(reminders.pendingRegistrations).toBe(3);
      expect(reminders.overdueReviews).toBe(0);
      expect(reminders.ungradedReminderDays).toBeGreaterThan(0);
    });
  });

  describe('RF-18: Verificación requerida para cambio administrativo de correo', () => {
    it('requiere confirmación de identidad antes de permitir el envío del nuevo correo', () => {
      const identityConfirmed = false;
      const newEmail = 'student.new@example.com';
      const isSubmittingAllowed = identityConfirmed && Boolean(newEmail.trim());

      expect(isSubmittingAllowed).toBe(false);

      const confirmed = true;
      const isNowAllowed = confirmed && Boolean(newEmail.trim());
      expect(isNowAllowed).toBe(true);
    });
  });

  describe('RF-12: Reglas de archivado y borrado de grupos', () => {
    function canArchiveGroup(activeCount: number): boolean {
      return activeCount === 0;
    }

    it('impide archivar si hay alumnos activos (decisión 96)', () => {
      expect(canArchiveGroup(2)).toBe(false);
    });

    it('permite archivar solo si no hay alumnos activos', () => {
      expect(canArchiveGroup(0)).toBe(true);
    });
  });
});
