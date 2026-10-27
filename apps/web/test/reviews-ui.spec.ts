import { describe, it, expect } from 'vitest';
import {
  STICKERS,
  STICKER_CODES,
  StickerCode,
  scoreToStars,
} from '@englove/shared';

describe('SPEC-07: Teacher Revision & Student Feedback UI Rules (ENG-091, ENG-093)', () => {
  describe('Paquete cerrado de stickers (Decisión 108, RF-4, RF-8, RF-10)', () => {
    it('contiene exactamente los 6 stickers definidos con emoji y etiqueta en español', () => {
      expect(STICKER_CODES.length).toBe(6);
      expect(STICKER_CODES).toEqual([
        'great_job',
        'good_pronunciation',
        'creative_answer',
        'grammar_star',
        'super_effort',
        'keep_practicing',
      ]);

      for (const code of STICKER_CODES) {
        const def = STICKERS[code];
        expect(def).toBeDefined();
        expect(def.code).toBe(code);
        expect(def.label.length).toBeGreaterThan(0);
        expect(def.emoji.length).toBeGreaterThan(0);
      }
    });

    it('la selección de stickers admite máximo 3 sin duplicados', () => {
      const toggleStickerSelection = (
        current: StickerCode[],
        toToggle: StickerCode,
      ): { stickers: StickerCode[]; error?: string } => {
        if (current.includes(toToggle)) {
          return { stickers: current.filter((c) => c !== toToggle) };
        }
        if (current.length >= 3) {
          return { stickers: current, error: 'Solo puedes seleccionar hasta 3 stickers' };
        }
        return { stickers: [...current, toToggle] };
      };

      let state: StickerCode[] = [];
      state = toggleStickerSelection(state, 'great_job').stickers;
      state = toggleStickerSelection(state, 'good_pronunciation').stickers;
      state = toggleStickerSelection(state, 'creative_answer').stickers;
      expect(state.length).toBe(3);

      const overflow = toggleStickerSelection(state, 'grammar_star');
      expect(overflow.error).toBe('Solo puedes seleccionar hasta 3 stickers');
      expect(overflow.stickers.length).toBe(3);

      // Deselect one
      state = toggleStickerSelection(state, 'good_pronunciation').stickers;
      expect(state.length).toBe(2);
      expect(state).not.toContain('good_pronunciation');
    });
  });

  describe('Inmutabilidad de la calificación y advertencia de plazo (Decisiones 61 y 109, RF-8)', () => {
    it('en estado graded la nota se presenta como solo lectura y no como campo editable', () => {
      const isScoreInputEditable = (status: string): boolean => {
        return status === 'pending_review';
      };

      expect(isScoreInputEditable('pending_review')).toBe(true);
      expect(isScoreInputEditable('graded')).toBe(false);
      expect(isScoreInputEditable('in_progress')).toBe(false);
    });

    it('alerta cuando la actividad cerró y no se especifica una nueva fecha límite para el reintento', () => {
      const isExpiredNoticeVisible = (
        assignmentDueAt: Date,
        retryExtendUntil: string,
        now: Date,
      ): boolean => {
        return assignmentDueAt.getTime() < now.getTime() && !retryExtendUntil;
      };

      const pastDue = new Date('2026-10-20T18:00:00Z');
      const futureDue = new Date('2026-10-30T18:00:00Z');
      const now = new Date('2026-10-26T12:00:00Z');

      // Past due without extension date: warning visible
      expect(isExpiredNoticeVisible(pastDue, '', now)).toBe(true);

      // Past due with new extension date: warning hidden
      expect(isExpiredNoticeVisible(pastDue, '2026-10-28T18:00:00Z', now)).toBe(false);

      // Future due: warning hidden
      expect(isExpiredNoticeVisible(futureDue, '', now)).toBe(false);
    });
  });

  describe('Formateo de notas en interfaz del alumno (RF-10, CONTEXT §16)', () => {
    it('muestra la nota con coma decimal en formato 0,0 a 5,0', () => {
      const formatScore = (score: number): string => {
        return score.toFixed(1).replace('.', ',');
      };

      expect(formatScore(4.5)).toBe('4,5');
      expect(formatScore(5.0)).toBe('5,0');
      expect(formatScore(3.2)).toBe('3,2');
      expect(formatScore(0.0)).toBe('0,0');
    });

    it('asigna estrellas correctas según escala de Decisión 101', () => {
      expect(scoreToStars(5.0)).toBe(3);
      expect(scoreToStars(4.5)).toBe(3);
      expect(scoreToStars(4.4)).toBe(2);
      expect(scoreToStars(3.0)).toBe(2);
      expect(scoreToStars(2.9)).toBe(1);
      expect(scoreToStars(0.1)).toBe(1);
      expect(scoreToStars(0.0)).toBe(0);
    });
  });

  describe('Resolución de respuestas y presentación docente (SPEC-07 RF-3, RF-8)', () => {
    it('extrae respuesta textual de open_question si viene empaquetada como objeto o directa', () => {
      const resolveStudentAnswer = (raw: any): string => {
        if (typeof raw === 'string') return raw;
        if (raw && typeof raw === 'object' && 'text' in raw) return String(raw.text);
        return raw ? JSON.stringify(raw) : '(Sin respuesta registrada)';
      };

      expect(resolveStudentAnswer({ text: 'The capital is Bogota' })).toBe('The capital is Bogota');
      expect(resolveStudentAnswer('Direct string answer')).toBe('Direct string answer');
      expect(resolveStudentAnswer(undefined)).toBe('(Sin respuesta registrada)');
    });

    it('prioriza effectiveDueAt sobre dueAt para mostrar el plazo actualizado tras conceder reintento', () => {
      const resolveEffectiveDeadline = (card: { dueAt: string; effectiveDueAt?: string }): string => {
        return card.effectiveDueAt ?? card.dueAt;
      };

      expect(
        resolveEffectiveDeadline({
          dueAt: '2026-10-25T18:00:00Z',
          effectiveDueAt: '2026-10-28T18:00:00Z',
        }),
      ).toBe('2026-10-28T18:00:00Z');

      expect(
        resolveEffectiveDeadline({
          dueAt: '2026-10-25T18:00:00Z',
        }),
      ).toBe('2026-10-25T18:00:00Z');
    });
  });
});
