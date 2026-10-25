import { describe, it, expect } from 'vitest';
import { ScoringService } from '../src/scoring/scoring.service';
import {
  FillBlankConfig,
  FillBlankAnswerKey,
  ExamConfig,
  ExamAnswerKey,
  scoreToStars,
} from '@englove/shared';

describe('SPEC-05: ScoringService & Algoritmos de Calificación', () => {
  const scoringService = new ScoringService();

  describe('scoreToStars (Decisión 101, Q-02)', () => {
    it('asigna 0 estrellas si score = 0.0 o nulo', () => {
      expect(scoreToStars(0.0)).toBe(0);
      expect(scoreToStars(null)).toBe(0);
      expect(scoreToStars(undefined)).toBe(0);
    });

    it('asigna 1 estrella si 0.0 < score < 3.0', () => {
      expect(scoreToStars(0.1)).toBe(1);
      expect(scoreToStars(1.5)).toBe(1);
      expect(scoreToStars(2.9)).toBe(1);
    });

    it('asigna 2 estrellas si 3.0 <= score < 4.5', () => {
      expect(scoreToStars(3.0)).toBe(2);
      expect(scoreToStars(3.8)).toBe(2);
      expect(scoreToStars(4.4)).toBe(2);
    });

    it('asigna 3 estrellas si score >= 4.5', () => {
      expect(scoreToStars(4.5)).toBe(3);
      expect(scoreToStars(4.9)).toBe(3);
      expect(scoreToStars(5.0)).toBe(3);
    });
  });

  describe('calculateFillBlank (RF-9, RF-10)', () => {
    const config: FillBlankConfig = {
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          prompt: 'The {{22222222-2222-4222-8222-222222222222}} is sleeping.',
          blanks: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              options: [
                { id: '33333333-3333-4333-8333-333333333333', text: 'cat' },
                { id: '44444444-4444-4444-8444-444444444444', text: 'dog' },
              ],
            },
          ],
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          prompt: 'The {{66666666-6666-4666-8666-666666666666}} is barking.',
          blanks: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              options: [
                { id: '77777777-7777-4777-8777-777777777777', text: 'cat' },
                { id: '88888888-8888-4888-8888-888888888888', text: 'dog' },
              ],
            },
          ],
        },
      ],
    };

    const answerKey: FillBlankAnswerKey = {
      items: {
        '11111111-1111-4111-8111-111111111111': {
          '22222222-2222-4222-8222-222222222222': 'cat',
        },
        '55555555-5555-4555-8555-555555555555': {
          '66666666-6666-4666-8666-666666666666': 'dog',
        },
      },
    };

    it('califica 5.0 con todas las respuestas correctas', () => {
      const result = scoringService.calculateFillBlank(
        config,
        answerKey,
        {
          '22222222-2222-4222-8222-222222222222': 'cat',
          '66666666-6666-4666-8666-666666666666': 'dog',
        },
        60,
        10,
      );

      expect(result.score).toBe(5.0);
      expect(result.fraction).toBe(1);
      expect(result.flags).toHaveLength(0);
      const corr1 = result.correction as Record<string, Record<string, { correct: boolean }>>;
      expect(corr1['11111111-1111-4111-8111-111111111111']?.['22222222-2222-4222-8222-222222222222']?.correct).toBe(true);
      expect(corr1['55555555-5555-4555-8555-555555555555']?.['66666666-6666-4666-8666-666666666666']?.correct).toBe(true);
    });

    it('califica 2.5 con la mitad de respuestas correctas', () => {
      const result = scoringService.calculateFillBlank(
        config,
        answerKey,
        {
          '22222222-2222-4222-8222-222222222222': 'cat',
          '66666666-6666-4666-8666-666666666666': 'wrong',
        },
        60,
        10,
      );

      expect(result.score).toBe(2.5);
      expect(result.fraction).toBe(0.5);
      const corr2 = result.correction as Record<string, Record<string, { correct: boolean }>>;
      expect(corr2['55555555-5555-4555-8555-555555555555']?.['66666666-6666-4666-8666-666666666666']?.correct).toBe(false);
    });

    it('califica correctamente con respuestas anidadas por itemId', () => {
      const result = scoringService.calculateFillBlank(
        config,
        answerKey,
        {
          '11111111-1111-4111-8111-111111111111': {
            '22222222-2222-4222-8222-222222222222': 'cat',
          },
          '55555555-5555-4555-8555-555555555555': {
            '66666666-6666-4666-8666-666666666666': 'dog',
          },
        },
        60,
        10,
      );

      expect(result.score).toBe(5.0);
      expect(result.fraction).toBe(1);
      const corr3 = result.correction as Record<string, Record<string, { correct: boolean }>>;
      expect(corr3['11111111-1111-4111-8111-111111111111']?.['22222222-2222-4222-8222-222222222222']?.correct).toBe(true);
      expect(corr3['55555555-5555-4555-8555-555555555555']?.['66666666-6666-4666-8666-666666666666']?.correct).toBe(true);
    });

    // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10
    it('detecta y marca flag implausible_duration si duró menos que el umbral', () => {
      const result = scoringService.calculateFillBlank(
        config,
        answerKey,
        {
          '22222222-2222-4222-8222-222222222222': 'cat',
        },
        3, // 3 seconds
        // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10
        15, // minimum plausible: 15 seconds
      );

      // guardrails-ignore G-C06: prueba de flag de negocio implausible_duration segun SPEC-05 RF-10
      expect(result.flags).toContain('implausible_duration');
    });
  });

  describe('calculateExam (RF-9, Decisión 102, Q-03)', () => {
    const examConfig: ExamConfig = {
      items: [
        {
          id: 'item-1',
          weight: 40,
          prompt: 'I {{b1}} an apple.',
          blanks: [
            {
              id: 'b1',
              options: [
                { id: 'o1', text: 'eat' },
                { id: 'o2', text: 'eats' },
              ],
            },
          ],
        },
        {
          id: 'item-2',
          weight: 60,
          prompt: 'She {{b2}} milk.',
          blanks: [
            {
              id: 'b2',
              options: [
                { id: 'o3', text: 'drinks' },
                { id: 'o4', text: 'drink' },
              ],
            },
          ],
        },
      ],
    };

    const examKey: ExamAnswerKey = {
      items: {
        'item-1': { b1: 'eat' },
        'item-2': { b2: 'drinks' },
      },
    };

    it('calcula media ponderada con pesos normalizados', () => {
      // If item-1 is wrong (0) and item-2 is correct (weight 60/100 -> 0.6)
      // 0.6 * 5.0 = 3.0
      const result = scoringService.calculateExam(examConfig, examKey, {
        'item-1': { b1: 'wrong' },
        'item-2': { b2: 'drinks' },
      });

      expect(result.fraction).toBe(0.6);
      expect(result.score).toBe(3.0);
    });

    it('asigna 0 a ítems sin respuesta', () => {
      const result = scoringService.calculateExam(examConfig, examKey, {});
      expect(result.fraction).toBe(0);
      expect(result.score).toBe(0.0);
    });
  });
});
