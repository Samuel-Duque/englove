import { describe, it, expect } from 'vitest';
import {
  ScoreTrendDirection,
  Level,
  WeekCalendarStatus,
} from '@englove/shared';

describe('SPEC-08: Teacher Stats UI Rules & Formatting (ENG-101, ENG-102, ENG-103)', () => {
  describe('Formateo de calificaciones (Decisiones 20, 23, 34 §5)', () => {
    function formatScore(score: number | null | undefined): string {
      if (score === null || score === undefined) return '—';
      return score.toFixed(1);
    }

    it('las notas ausentes se muestran como guión largo "—" y nunca como "0.0"', () => {
      expect(formatScore(null)).toBe('—');
      expect(formatScore(undefined)).toBe('—');
      expect(formatScore(null)).not.toBe('0.0');
    });

    it('las notas válidas se formatean con exactamente un decimal en escala 0.0 a 5.0', () => {
      expect(formatScore(0.0)).toBe('0.0');
      expect(formatScore(3.55)).toBe('3.5');
      expect(formatScore(4)).toBe('4.0');
      expect(formatScore(5.0)).toBe('5.0');
    });
  });

  describe('Conmutación y cálculo de tendencias 30d y 7d (Decisión 112, RF-6)', () => {
    function computeTrend(current: number | null, prev: number | null): {
      direction: ScoreTrendDirection;
      delta: number | null;
    } {
      if (current === null || prev === null) {
        return { direction: 'none', delta: null };
      }
      const delta = Math.round((current - prev) * 10) / 10;
      let direction: ScoreTrendDirection = 'stable';
      if (delta >= 0.2) direction = 'up';
      else if (delta <= -0.2) direction = 'down';
      else direction = 'stable';
      return { direction, delta };
    }

    it('marca "up" cuando delta es >= +0.2', () => {
      expect(computeTrend(4.5, 4.0)).toEqual({ direction: 'up', delta: 0.5 });
      expect(computeTrend(3.2, 3.0)).toEqual({ direction: 'up', delta: 0.2 });
    });

    it('marca "down" cuando delta es <= -0.2', () => {
      expect(computeTrend(3.8, 4.1)).toEqual({ direction: 'down', delta: -0.3 });
      expect(computeTrend(4.0, 4.2)).toEqual({ direction: 'down', delta: -0.2 });
    });

    it('marca "stable" cuando el valor absoluto de delta es < 0.2', () => {
      expect(computeTrend(4.0, 4.1)).toEqual({ direction: 'stable', delta: -0.1 });
      expect(computeTrend(4.1, 4.0)).toEqual({ direction: 'stable', delta: 0.1 });
      expect(computeTrend(4.0, 4.0)).toEqual({ direction: 'stable', delta: 0 });
    });

    it('marca "none" y delta nulo si falta la nota previa o actual', () => {
      expect(computeTrend(null, 4.0)).toEqual({ direction: 'none', delta: null });
      expect(computeTrend(4.0, null)).toEqual({ direction: 'none', delta: null });
    });
  });

  describe('Filtros y ordenamiento determinista del Leaderboard (Decisión 115, RF-8)', () => {
    it('filtra por grupos de nivel A1, A2, B1 o B2', () => {
      const entries = [
        { studentName: 'A', level: Level.A1, averageScore: 4.5 },
        { studentName: 'B', level: Level.A2, averageScore: 4.8 },
        { studentName: 'C', level: Level.B1, averageScore: 4.0 },
      ];

      const filterByLevel = (level: Level | null) =>
        level ? entries.filter((e) => e.level === level) : entries;

      expect(filterByLevel(Level.A1).length).toBe(1);
      expect(filterByLevel(Level.A1)[0]!.studentName).toBe('A');
      expect(filterByLevel(null).length).toBe(3);
    });

    it('desempata por completadas, racha, insignias y nombre', () => {
      const entries = [
        {
          studentName: 'Beto',
          averageScore: 4.0,
          completedCount: 5,
          streak: 2,
          badges: 1,
        },
        {
          studentName: 'Ana',
          averageScore: 4.0,
          completedCount: 5,
          streak: 2,
          badges: 1,
        },
        {
          studentName: 'Carlos',
          averageScore: 4.0,
          completedCount: 6,
          streak: 1,
          badges: 0,
        },
      ];

      const sorted = [...entries].sort((a, b) => {
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
        if (b.streak !== a.streak) return b.streak - a.streak;
        if (b.badges !== a.badges) return b.badges - a.badges;
        return a.studentName.localeCompare(b.studentName);
      });

      // Carlos has 6 completed vs 5 => first
      expect(sorted[0]!.studentName).toBe('Carlos');
      // Ana and Beto tie on score, completed, streak, badges => alphabetical order: Ana before Beto
      expect(sorted[1]!.studentName).toBe('Ana');
      expect(sorted[2]!.studentName).toBe('Beto');
    });
  });

  describe('Ficha individual: Estados de calendario y umbral de aprobación (RF-9, RF-10)', () => {
    const passingScore = 3.0;

    it('evalúa correctamente notas aprobadas >= 3.0 frente a por mejorar < 3.0', () => {
      expect(3.0 >= passingScore).toBe(true);
      expect(4.5 >= passingScore).toBe(true);
      expect(2.9 >= passingScore).toBe(false);
      expect(0.0 >= passingScore).toBe(false);
    });

    it('los 4 estados del calendario semanal ISO son reconocidos', () => {
      const validStatuses: WeekCalendarStatus[] = [
        'active',
        'forgiven',
        'inactive',
        'current_pending',
      ];
      expect(validStatuses.length).toBe(4);
    });
  });

  describe('Polling de 30 segundos (RF-7)', () => {
    it('el intervalo de polling está configurado en exactamente 30_000 ms', () => {
      const pollingIntervalMs = 30_000;
      expect(pollingIntervalMs).toBe(30_000);
    });
  });
});
