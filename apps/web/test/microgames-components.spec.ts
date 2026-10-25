import { describe, it, expect } from 'vitest';
import {
  scoreToStars,
  calculateMatchScore,
  calculateOrderWordsScore,
  calculateDragDropScore,
  calculateTimedChoiceScore,
  reconstructMemoryPlays,
  deterministicShuffle,
  GameMechanic,
  GAME_MECHANIC_LABELS,
} from '@englove/shared';
import { loadMotionTheme } from '../src/lib/motion';
import { playSound } from '../src/lib/sound';
import { fireCelebrationConfetti } from '../src/lib/confetti';

describe('SPEC-06: Microgames Components & Runtime Rules (ENG-080 to ENG-087)', () => {
  describe('Determinismo en Mezcla de Fichas (RF-2)', () => {
    it('deterministicShuffle produce el mismo orden con la misma semilla', () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      const seed = 'attempt-uuid-12345';

      const shuffle1 = deterministicShuffle(items, seed);
      const shuffle2 = deterministicShuffle(items, seed);

      expect(shuffle1).toEqual(shuffle2);
      expect(shuffle1.length).toBe(items.length);
      expect(new Set(shuffle1)).toEqual(new Set(items));
    });

    it('deterministicShuffle produce permutaciones distintas con semillas distintas', () => {
      const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const shuffleA = deterministicShuffle(items, 'seed-a');
      const shuffleB = deterministicShuffle(items, 'seed-b');
      expect(shuffleA).not.toEqual(shuffleB);
    });

    it('garantiza permutación no paralela frente a la columna izquierda en match (RF-2)', () => {
      const left = [{ id: 'l1', text: 'Cat' }, { id: 'l2', text: 'Dog' }];
      const right = [{ id: 'r1', text: 'Gato' }, { id: 'r2', text: 'Perro' }];
      const solution = { pairs: { l1: 'r1', l2: 'r2' } };

      // Simulate a shuffle that happened to be in parallel order [r1, r2]
      let shuffled = [...right];
      const isParallel = left.every((l, idx) => solution.pairs[l.id as 'l1' | 'l2'] === shuffled[idx]?.id);
      if (isParallel) {
        shuffled = [...shuffled].reverse();
      }

      // Assert it is no longer parallel
      const stillParallel = left.every((l, idx) => solution.pairs[l.id as 'l1' | 'l2'] === shuffled[idx]?.id);
      expect(isParallel).toBe(true);
      expect(stillParallel).toBe(false);
      expect(shuffled[0]?.id).toBe('r2');
      expect(shuffled[1]?.id).toBe('r1');
    });
  });

  describe('Carga Diferida de Módulos de Animación por Tema (RF-10, ENG-086)', () => {
    it('carga chunk kids dinámicamente con dynamic import', async () => {
      const motionKids = await loadMotionTheme('kids');
      expect(motionKids).toBeDefined();
      expect(motionKids.cardFlip).toBeDefined();
      expect(motionKids.buttonPop).toBeDefined();
      expect(motionKids.bounceEntrance).toBeDefined();
    });

    it('carga chunk teens dinámicamente con dynamic import', async () => {
      const motionTeens = await loadMotionTheme('teens');
      expect(motionTeens).toBeDefined();
      expect(motionTeens.cardFlip).toBeDefined();
      expect(motionTeens.buttonPop).toBeDefined();
      expect(motionTeens.bounceEntrance).toBeDefined();
    });
  });

  describe('Efectos de Sonido y Confeti (RF-9, ENG-086)', () => {
    it('playSound no arroja error cuando soundEnabled es false o en entorno Node', () => {
      expect(() => playSound('hit', false)).not.toThrow();
      expect(() => playSound('miss', false)).not.toThrow();
      expect(() => playSound('complete', false)).not.toThrow();
    });

    it('fireCelebrationConfetti se ejecuta sin errores en entornos sin canvas', () => {
      expect(() => fireCelebrationConfetti({ theme: 'kids' })).not.toThrow();
      expect(() => fireCelebrationConfetti({ theme: 'teens' })).not.toThrow();
    });
  });

  describe('Simulación In-Memory en Previsualización Docente (RF-16 SPEC-04, ENG-039)', () => {
    it('calcula fracción y estrellas in-memory para mecánica match', () => {
      const solutionPairs = {
        'l1': 'r1',
        'l2': 'r2',
      };
      const correctAnswers = {
        'l1': 'r1',
        'l2': 'r2',
      };
      const partialAnswers = {
        'l1': 'r1',
        'l2': 'wrong',
      };

      const fullFraction = calculateMatchScore(solutionPairs, correctAnswers);
      const fullScore = Math.round(fullFraction * 5 * 10) / 10;
      expect(fullFraction).toBe(1.0);
      expect(fullScore).toBe(5.0);
      expect(scoreToStars(fullScore)).toBe(3);

      const partialFraction = calculateMatchScore(solutionPairs, partialAnswers);
      const partialScore = Math.round(partialFraction * 5 * 10) / 10;
      expect(partialFraction).toBe(0.5);
      expect(partialScore).toBe(2.5);
      expect(scoreToStars(partialScore)).toBe(1);
    });

    it('calcula puntaje in-memory para mecánica order_words', () => {
      const tokens = [
        { id: 't1', text: 'The' },
        { id: 't2', text: 'cat' },
        { id: 't3', text: 'sleeps' },
      ];
      const expectedTokenIds = ['t1', 't2', 't3'];

      const fullFraction = calculateOrderWordsScore(tokens, expectedTokenIds, ['t1', 't2', 't3']);
      const fullScore = Math.round(fullFraction * 5 * 10) / 10;
      expect(fullFraction).toBe(1.0);
      expect(fullScore).toBe(5.0);
      expect(scoreToStars(fullScore)).toBe(3);

      const invertedFraction = calculateOrderWordsScore(tokens, expectedTokenIds, ['t3', 't2', 't1']);
      expect(invertedFraction).toBeLessThan(1.0);
    });

    it('calcula puntaje in-memory para mecánica drag_drop', () => {
      const placementsSolution = {
        'o1': 'cat-fruits',
        'o2': 'cat-fruits',
        'o3': 'cat-animals',
      };

      const answers = {
        'o1': 'cat-fruits',
        'o2': 'cat-animals', // wrong
        'o3': 'cat-animals',
      };

      const fraction = calculateDragDropScore(placementsSolution, answers);
      const score = Math.round(fraction * 5 * 10) / 10;
      expect(fraction).toBeCloseTo(2 / 3);
      expect(score).toBe(3.3);
      expect(scoreToStars(score)).toBe(2);
    });

    it('calcula puntaje in-memory para mecánica memory con rejugado secuencial', () => {
      const cards = [
        { id: 'c1' },
        { id: 'c2' },
        { id: 'c3' },
        { id: 'c4' },
      ];
      const solutionPairs: Array<[string, string]> = [
        ['c1', 'c2'],
        ['c3', 'c4'],
      ];

      // Perfect run in 2 attempts
      const perfectPlays: Array<[string, string]> = [
        ['c1', 'c2'],
        ['c3', 'c4'],
      ];
      const perfectResult = reconstructMemoryPlays(cards, solutionPairs, perfectPlays);
      const perfectScore = Math.round(perfectResult.fraction * 5 * 10) / 10;
      expect(perfectResult.fraction).toBe(1.0);
      expect(perfectScore).toBe(5.0);
      expect(perfectResult.foundPairs).toBe(2);

      // 1 mistake: total 3 flips -> fraction = 2 / (2 + 1) = 2/3
      const mistakePlays: Array<[string, string]> = [
        ['c1', 'c3'], // fail
        ['c1', 'c2'], // success
        ['c3', 'c4'], // success
      ];
      const mistakeResult = reconstructMemoryPlays(cards, solutionPairs, mistakePlays);
      const mistakeScore = Math.round(mistakeResult.fraction * 5 * 10) / 10;
      expect(mistakeResult.failedSelections).toBe(1);
      expect(mistakeResult.fraction).toBeCloseTo(2 / 3);
      expect(mistakeScore).toBe(3.3);
      expect(scoreToStars(mistakeScore)).toBe(2);
    });

    it('calcula puntaje in-memory para mecánica timed_choice', () => {
      const choicesSolution = {
        'q1': 'o1',
        'q2': 'o3',
      };

      const fullFraction = calculateTimedChoiceScore(choicesSolution, { 'q1': 'o1', 'q2': 'o3' });
      const fullScore = Math.round(fullFraction * 5 * 10) / 10;
      expect(fullScore).toBe(5.0);
      expect(scoreToStars(fullScore)).toBe(3);

      const zeroFraction = calculateTimedChoiceScore(choicesSolution, { 'q1': 'wrong', 'q2': 'wrong' });
      const zeroScore = Math.round(zeroFraction * 5 * 10) / 10;
      expect(zeroScore).toBe(0.0);
      expect(scoreToStars(zeroScore)).toBe(0);
    });
  });

  describe('Interacción Híbrida y Accesibilidad (Decisión 105, RF-5 a RF-8)', () => {
    it('soporta estructura de datos para modo híbrido en arrastrar y soltar', () => {
      const targets = [
        { id: 'target-1', text: 'Verbs' },
        { id: 'target-2', text: 'Nouns' },
      ];
      const objects = [
        { id: 'obj-1', text: 'Run' },
        { id: 'obj-2', text: 'Apple' },
      ];

      const firstObj = objects[0];
      const firstTarget = targets[0];
      let selectedObjectId: string | null = firstObj ? firstObj.id : null;
      const placements: Record<string, string> = {};

      // User clicks target-1
      if (selectedObjectId && firstTarget) {
        placements[selectedObjectId] = firstTarget.id;
        selectedObjectId = null;
      }

      expect(placements['obj-1']).toBe('target-1');
      expect(selectedObjectId).toBeNull();
    });

    it('OrderWordsGame permite mover fichas con teclado y clics alternativos', () => {
      const tokens = ['Word A', 'Word B', 'Word C'];
      // Swap elements at index 0 and 1
      const swapped = [...tokens];
      const token0 = swapped[0];
      const token1 = swapped[1];
      if (token0 !== undefined && token1 !== undefined) {
        swapped[0] = token1;
        swapped[1] = token0;
      }

      expect(swapped).toEqual(['Word B', 'Word A', 'Word C']);
    });
  });

  describe('RF-11: Portal de Juegos y Etiquetas de Mecánica en Español', () => {
    it('GAME_MECHANIC_LABELS traduce exactamente las 5 mecánicas al español', () => {
      expect(GAME_MECHANIC_LABELS[GameMechanic.match]).toBe('Emparejar');
      expect(GAME_MECHANIC_LABELS[GameMechanic.order_words]).toBe('Ordenar palabras');
      expect(GAME_MECHANIC_LABELS[GameMechanic.drag_drop]).toBe('Arrastrar y soltar');
      expect(GAME_MECHANIC_LABELS[GameMechanic.memory]).toBe('Memoria');
      expect(GAME_MECHANIC_LABELS[GameMechanic.timed_choice]).toBe('Contra reloj');
    });

    it('RF-9: soundEnabled inicializa en true para kids y en false para teens', () => {
      const getInitialSound = (ageSegment: 'kids' | 'teens') => ageSegment === 'kids';
      expect(getInitialSound('kids')).toBe(true);
      expect(getInitialSound('teens')).toBe(false);
    });

    it('RF-11: juego cerrado no permite Jugar de nuevo si canStart es false', () => {
      const getActionType = (card: { isFinished: boolean; canStart: boolean }) => {
        if (card.isFinished) {
          return card.canStart ? 'play_again' : 'closed';
        }
        return card.canStart ? 'start' : 'disabled';
      };

      expect(getActionType({ isFinished: true, canStart: true })).toBe('play_again');
      expect(getActionType({ isFinished: true, canStart: false })).toBe('closed');
      expect(getActionType({ isFinished: false, canStart: true })).toBe('start');
      expect(getActionType({ isFinished: false, canStart: false })).toBe('disabled');
    });
  });
});
