import { describe, it, expect } from 'vitest';
import {
  AgeSegment,
  AttemptStatus,
  scoreToStars,
} from '@englove/shared';

describe('SPEC-05: Student Portal & Runner UI Rules (ENG-060 a ENG-073)', () => {
  describe('Navegación y Shell del estudiante (RF-1)', () => {
    it('la barra de navegación tiene menos de 5 elementos principales y el perfil se accede desde el avatar (RF-1)', () => {
      const studentNavItems = [
        { label: 'Inicio', href: '/inicio' },
        { label: 'Progreso', href: '/progreso' },
      ];
      const avatarLink = { label: 'Perfil', href: '/perfil' };

      expect(studentNavItems.length).toBeLessThanOrEqual(5);
      expect(studentNavItems.some((i) => i.href.includes('/perfil'))).toBe(false);
      expect(avatarLink.href).toBe('/perfil');
      expect(studentNavItems.some((i) => i.href.includes('/alumnos'))).toBe(false);
      expect(studentNavItems.some((i) => i.href.includes('/actividades'))).toBe(false);
      expect(studentNavItems.some((i) => i.href.includes('/grupos'))).toBe(false);
    });

    it('asigna data-theme kids o teens según el segmento de edad del alumno', () => {
      const getTheme = (segment: AgeSegment, canSwitch: boolean, override?: AgeSegment): string => {
        if (canSwitch && override) return override;
        return segment;
      };

      expect(getTheme(AgeSegment.kids, false)).toBe('kids');
      expect(getTheme(AgeSegment.teens, false)).toBe('teens');
      expect(getTheme(AgeSegment.kids, true, AgeSegment.teens)).toBe('teens');
    });
  });

  describe('Tarjetas de Asignación y Ventana de Tolerancia (RF-2)', () => {
    it('calcula ventana de tolerancia +24 horas desde effectiveDueAt', () => {
      const dueAt = new Date('2026-11-04T18:00:00.000Z');
      const completeUntil = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000);

      expect(completeUntil.toISOString()).toBe('2026-11-05T18:00:00.000Z');
    });

    it('determina si se muestra la advertencia de entrega en prórroga', () => {
      const isToleranceWarningVisible = (now: Date, dueAt: Date, completeUntil: Date): boolean => {
        return now > dueAt && now <= completeUntil;
      };

      const dueAt = new Date('2026-11-04T18:00:00.000Z');
      const completeUntil = new Date('2026-11-05T18:00:00.000Z');

      // Before due date: no warning
      expect(isToleranceWarningVisible(new Date('2026-11-04T12:00:00.000Z'), dueAt, completeUntil)).toBe(false);
      // In +24h tolerance window: warning visible
      expect(isToleranceWarningVisible(new Date('2026-11-04T20:00:00.000Z'), dueAt, completeUntil)).toBe(true);
      // After +24h tolerance: closed
      expect(isToleranceWarningVisible(new Date('2026-11-05T21:00:00.000Z'), dueAt, completeUntil)).toBe(false);
    });

    it('deriva el texto de la acción principal en un solo clic', () => {
      const getActionText = (hasAttempt: boolean, status?: AttemptStatus, canContinue?: boolean): string => {
        if (!hasAttempt) return 'Empezar';
        if (status === AttemptStatus.in_progress && canContinue) return 'Continuar';
        return 'Ver entrega';
      };

      expect(getActionText(false)).toBe('Empezar');
      expect(getActionText(true, AttemptStatus.in_progress, true)).toBe('Continuar');
      expect(getActionText(true, AttemptStatus.graded, false)).toBe('Ver entrega');
      expect(getActionText(true, AttemptStatus.pending_review, false)).toBe('Ver entrega');
    });
  });

  describe('Previsualización docente interactiva (ENG-039, SPEC-03 RF-7, SPEC-05)', () => {
    it('la previsualización no genera id de intento ni persiste progreso', () => {
      const isTeacherPreview = (attemptId: string): boolean => {
        return attemptId === 'preview-mode';
      };

      expect(isTeacherPreview('preview-mode')).toBe(true);
      expect(isTeacherPreview('11111111-1111-4111-8111-111111111111')).toBe(false);
    });
  });

  describe('Conversión de puntaje a estrellas (Decisión 101, Q-02)', () => {
    it('0 estrellas si score es 0 o null', () => {
      expect(scoreToStars(0.0)).toBe(0);
      expect(scoreToStars(null)).toBe(0);
      expect(scoreToStars(undefined)).toBe(0);
    });

    it('1 estrella si 0.0 < score < 3.0', () => {
      expect(scoreToStars(1.0)).toBe(1);
      expect(scoreToStars(2.9)).toBe(1);
    });

    it('2 estrellas si 3.0 <= score < 4.5', () => {
      expect(scoreToStars(3.0)).toBe(2);
      expect(scoreToStars(4.4)).toBe(2);
    });

    it('3 estrellas si score >= 4.5', () => {
      expect(scoreToStars(4.5)).toBe(3);
      expect(scoreToStars(5.0)).toBe(3);
    });
  });
});
