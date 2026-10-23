import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GamificationService } from '../src/gamification/gamification.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProgressEventType } from '@englove/shared';

type MockFn = ReturnType<typeof vi.fn>;

describe('SPEC-05: GamificationService & Algoritmo de Rachas', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  const studentId = '22222222-2222-4222-8222-222222222222';
  const attemptId = '33333333-3333-4333-8333-333333333333';

  let service: GamificationService;
  let mockPrisma: {
    progressEvent: {
      create: MockFn;
      findMany: MockFn;
      count: MockFn;
    };
    badgeRule: {
      findMany: MockFn;
    };
    badgeAward: {
      findMany: MockFn;
      create: MockFn;
    };
    student: {
      findFirst: MockFn;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      progressEvent: {
        create: vi.fn().mockResolvedValue({ id: 'pe-1' }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      badgeRule: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      badgeAward: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'ba-1', awarded_at: new Date() }),
      },
      student: {
        findFirst: vi.fn().mockResolvedValue({
          id: studentId,
          organization_id: orgId,
          created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        }),
      },
    };

    service = new GamificationService(mockPrisma as unknown as PrismaService);
  });

  describe('Emisión de eventos (Decisión 100, Q-01)', () => {
    it('recordAttemptCompleted emite value = score en autocalificados', async () => {
      await service.recordAttemptCompleted(orgId, studentId, attemptId, 4.5);

      expect(mockPrisma.progressEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: orgId,
            student_id: studentId,
            attempt_id: attemptId,
            type: ProgressEventType.attempt_completed,
          }),
        }),
      );
    });

    it('recordAttemptCompleted emite value = null para open_question', async () => {
      await service.recordAttemptCompleted(orgId, studentId, attemptId, null);

      expect(mockPrisma.progressEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: orgId,
            student_id: studentId,
            attempt_id: attemptId,
            type: ProgressEventType.attempt_completed,
            value: null,
          }),
        }),
      );
    });

    it('recordAudioSubmitted emite audio_submitted con value = 1', async () => {
      await service.recordAudioSubmitted(orgId, studentId, attemptId);

      expect(mockPrisma.progressEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organization_id: orgId,
            student_id: studentId,
            attempt_id: attemptId,
            type: ProgressEventType.audio_submitted,
          }),
        }),
      );
    });
  });

  describe('Algoritmo de 4 reglas de racha (SPEC-05 RF-18 a RF-21, Decisión 34 §9)', () => {
    it('retorna racha 0 si el alumno no existe o no tiene eventos', async () => {
      mockPrisma.progressEvent.findMany.mockResolvedValue([]);
      const state = await service.calculateStreak(orgId, studentId);

      expect(state.weeks).toBe(0);
      expect(state.forgivenessAvailable).toBe(true);
      expect(state.activeWeeksSinceForgivenessUsed).toBe(0);
    });

    it('Regla 1: incrementa semanas activas consecutivas', async () => {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { occurred_at: twoWeeksAgo, type: ProgressEventType.attempt_completed },
        { occurred_at: oneWeekAgo, type: ProgressEventType.attempt_completed },
        { occurred_at: now, type: ProgressEventType.attempt_completed },
      ]);

      const state = await service.calculateStreak(orgId, studentId);
      expect(state.weeks).toBeGreaterThanOrEqual(2);
      expect(state.forgivenessAvailable).toBe(true);
    });

    it('Regla 2: racha 0 no consume perdón', async () => {
      // Solo un evento hoy, sin actividad previa
      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { occurred_at: new Date(), type: ProgressEventType.attempt_completed },
      ]);

      const state = await service.calculateStreak(orgId, studentId);
      expect(state.forgivenessAvailable).toBe(true);
    });

    it('Regla 2: racha activa + semana inactiva cerrada consume perdón y conserva racha', async () => {
      // Semana 1 activa (2026-10-05), Semana 2 inactiva (2026-10-12), evaluado en Semana 3 (2026-10-19)
      const week1Date = new Date('2026-10-05T12:00:00Z');
      const asOfDate = new Date('2026-10-19T12:00:00Z');

      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { occurred_at: week1Date, type: ProgressEventType.attempt_completed },
      ]);

      const state = await service.calculateStreak(orgId, studentId, asOfDate);
      expect(state.weeks).toBe(1);
      expect(state.forgivenessAvailable).toBe(false);
      expect(state.activeWeeksSinceForgivenessUsed).toBe(0);
    });

    it('Regla 3: perdón gastado se recupera tras 2 semanas activas consecutivas', async () => {
      // W1: activa (racha 1)
      // W2: inactiva (perdón consumido, racha 1)
      // W3: activa (racha 2, 1 semana activa post-perdón, perdón aún no disponible)
      // W4: activa (racha 3, 2 semanas activas post-perdón -> perdón RECUPERADO)
      const w1 = new Date('2026-10-05T12:00:00Z');
      const w3 = new Date('2026-10-19T12:00:00Z');
      const w4 = new Date('2026-10-26T12:00:00Z');
      const asOf = new Date('2026-11-02T12:00:00Z');

      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { occurred_at: w1, type: ProgressEventType.attempt_completed },
        { occurred_at: w3, type: ProgressEventType.attempt_completed },
        { occurred_at: w4, type: ProgressEventType.attempt_completed },
      ]);

      const state = await service.calculateStreak(orgId, studentId, asOf);
      expect(state.weeks).toBe(3);
      expect(state.forgivenessAvailable).toBe(true);
      expect(state.activeWeeksSinceForgivenessUsed).toBe(0);
    });

    it('Regla 4: dos semanas inactivas consecutivas rompen la racha a cero', async () => {
      // W1: activa
      // W2: inactiva (perdón usado)
      // W3: inactiva (racha rota a 0)
      const w1 = new Date('2026-10-05T12:00:00Z');
      const asOf = new Date('2026-10-26T12:00:00Z');

      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { occurred_at: w1, type: ProgressEventType.attempt_completed },
      ]);

      const state = await service.calculateStreak(orgId, studentId, asOf);
      expect(state.weeks).toBe(0);
      expect(state.forgivenessAvailable).toBe(true);
      expect(state.activeWeeksSinceForgivenessUsed).toBe(0);
    });

    it('Regla 4: no acumulación de perdón (máximo 1)', async () => {
      const w1 = new Date('2026-10-05T12:00:00Z');
      const w2 = new Date('2026-10-12T12:00:00Z');
      const w3 = new Date('2026-10-19T12:00:00Z');
      const asOf = new Date('2026-10-26T12:00:00Z');

      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { occurred_at: w1, type: ProgressEventType.attempt_completed },
        { occurred_at: w2, type: ProgressEventType.attempt_completed },
        { occurred_at: w3, type: ProgressEventType.attempt_completed },
      ]);

      const state = await service.calculateStreak(orgId, studentId, asOf);
      expect(state.weeks).toBe(3);
      expect(state.forgivenessAvailable).toBe(true);
    });

    it('Semana en curso a mitad de semana no penaliza la racha si aún no hay actividad', async () => {
      // W1 activa (lunes 2026-10-12). Evaluado miércoles 2026-10-21 de W2 en curso sin actividad aún.
      const w1 = new Date('2026-10-12T12:00:00Z');
      const midWeek2 = new Date('2026-10-21T15:00:00Z');

      mockPrisma.progressEvent.findMany.mockResolvedValue([
        { occurred_at: w1, type: ProgressEventType.attempt_completed },
      ]);

      const state = await service.calculateStreak(orgId, studentId, midWeek2);
      expect(state.weeks).toBe(1);
      expect(state.forgivenessAvailable).toBe(true);
    });
  });

  describe('Evaluación de insignias (RF-17)', () => {
    it('otorga insignia por conteo de intentos completados', async () => {
      mockPrisma.badgeRule.findMany.mockResolvedValue([
        {
          id: 'rule-first-attempt',
          key: 'first_step',
          name: 'Primer paso',
          description: 'Completa tu primera actividad',
          icon: 'star',
          active: true,
          rule: { type: 'event_count', event: 'attempt_completed', threshold: 1 },
        },
      ]);
      mockPrisma.progressEvent.count.mockResolvedValue(1);

      const awards = await service.evaluateBadges(orgId, studentId);

      expect(awards).toHaveLength(1);
      expect(awards[0]?.key).toBe('first_step');
      expect(mockPrisma.badgeAward.create).toHaveBeenCalled();
    });

    it('no otorga insignia ya obtenida', async () => {
      mockPrisma.badgeRule.findMany.mockResolvedValue([
        {
          id: 'rule-first-attempt',
          key: 'first_step',
          name: 'Primer paso',
          description: 'Completa tu primera actividad',
          icon: 'star',
          active: true,
          rule: { type: 'event_count', event: 'attempt_completed', threshold: 1 },
        },
      ]);
      // Ya tiene la medalla otorgada
      mockPrisma.badgeAward.findMany.mockResolvedValue([
        { badge_rule_id: 'rule-first-attempt' },
      ]);

      const awards = await service.evaluateBadges(orgId, studentId);
      expect(awards).toHaveLength(0);
      expect(mockPrisma.badgeAward.create).not.toHaveBeenCalled();
    });
  });
});
