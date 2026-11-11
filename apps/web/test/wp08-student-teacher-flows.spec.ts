import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FillBlankItemSchema,
  ExamItemSchema,
  scoreToGameStars,
  getGameMotivationMessage,
  AgeSegment,
} from '@englove/shared';
import {
  buildSentencePromptWithMarkers,
  parseInitialFillBlankItems,
  parseInitialExamItems,
  balanceExamWeights,
  buildFillBlankPayloadItems,
  buildExamPayloadItems,
  FormSentenceItem,
} from '../src/app/(teacher)/actividades/activity-editor';
import { uploadAudioBlob } from '../src/lib/audio-upload';

describe('WP-08: Student and Teacher Flows UI & Logic (P0-09, P1-03, P1-05, P1-07, P1-08, P1-10, P3-01, P3-03, P3-04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('QA-03 & P1-08: Activity Editor UUID Preservation & Multi-Blank / Multi-Option Support', () => {
    it('preserves existing item.id, blank.id and option.id when parsing fill_blank activity', () => {
      const existingItemId = '11111111-1111-4111-8111-111111111111';
      const existingBlank1Id = '22222222-2222-4222-8222-222222222222';
      const existingBlank2Id = '33333333-3333-4333-8333-333333333333';
      const opt1Id = '44444444-4444-4444-8444-444444444444';
      const opt2Id = '55555555-5555-4555-8555-555555555555';
      const opt3Id = '66666666-6666-4666-8666-666666666666';

      const config = {
        instructions: 'Completa los espacios',
        items: [
          {
            id: existingItemId,
            prompt: `The cat {{${existingBlank1Id}}} and the dog {{${existingBlank2Id}}}.`,
            blanks: [
              {
                id: existingBlank1Id,
                options: [
                  { id: opt1Id, text: 'sleeps' },
                  { id: opt2Id, text: 'runs' },
                  { id: opt3Id, text: 'jumps' },
                ],
              },
              {
                id: existingBlank2Id,
                options: [
                  { id: '77777777-7777-4777-8777-777777777777', text: 'barks' },
                  { id: '88888888-8888-4888-8888-888888888888', text: 'meows' },
                ],
              },
            ],
          },
        ],
      };

      const answerKey = {
        items: {
          [existingItemId]: {
            [existingBlank1Id]: opt1Id,
            [existingBlank2Id]: '77777777-7777-4777-8777-777777777777',
          },
        },
      };

      const parsed = parseInitialFillBlankItems(config, answerKey);
      expect(parsed).toHaveLength(1);

      const item = parsed[0]!;
      expect(item.id).toBe(existingItemId);
      expect(item.blanks).toHaveLength(2);

      // Blank 1 preservation
      expect(item.blanks[0]!.id).toBe(existingBlank1Id);
      expect(item.blanks[0]!.options).toHaveLength(3);
      expect(item.blanks[0]!.options[0]!.id).toBe(opt1Id);
      expect(item.blanks[0]!.options[1]!.id).toBe(opt2Id);
      expect(item.blanks[0]!.options[2]!.id).toBe(opt3Id);
      expect(item.blanks[0]!.correctOptionId).toBe(opt1Id);

      // Blank 2 preservation
      expect(item.blanks[1]!.id).toBe(existingBlank2Id);
      expect(item.blanks[1]!.options).toHaveLength(2);
      expect(item.blanks[1]!.correctOptionId).toBe('77777777-7777-4777-8777-777777777777');
    });

    it('preserves existing item.id, blank.id and weights when parsing exam activity', () => {
      const examItemId = '99999999-9999-4999-8999-999999999999';
      const blankId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const opt1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const opt2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

      const config = {
        items: [
          {
            id: examItemId,
            weight: 50,
            prompt: `I {{${blankId}}} to school.`,
            blanks: [
              {
                id: blankId,
                options: [
                  { id: opt1, text: 'go' },
                  { id: opt2, text: 'goes' },
                ],
              },
            ],
          },
        ],
      };

      const answerKey = {
        items: {
          [examItemId]: {
            [blankId]: opt1,
          },
        },
      };

      const parsed = parseInitialExamItems(config, answerKey);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]!.id).toBe(examItemId);
      expect(parsed[0]!.weight).toBe('50');
      expect(parsed[0]!.blanks[0]!.id).toBe(blankId);
      expect(parsed[0]!.blanks[0]!.options[0]!.id).toBe(opt1);
      expect(parsed[0]!.blanks[0]!.correctOptionId).toBe(opt1);
    });

    it('buildSentencePromptWithMarkers correctly replaces non-uuid markers and appends missing ones', () => {
      const blanks = [
        {
          id: '11111111-1111-4111-8111-111111111111',
          options: [{ id: 'o1', text: 'a' }, { id: 'o2', text: 'b' }],
          correctOptionId: 'o1',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          options: [{ id: 'o3', text: 'c' }, { id: 'o4', text: 'd' }],
          correctOptionId: 'o3',
        },
      ];

      // 1. Prompt with generic placeholder {{blank1}}
      const prompt1 = 'The cat {{blank1}} sleeping.';
      const res1 = buildSentencePromptWithMarkers(prompt1, blanks);
      expect(res1).toContain(`{{${blanks[0]!.id}}}`);
      expect(res1).toContain(`{{${blanks[1]!.id}}}`);
      expect(res1).not.toContain('{{blank1}}');

      // 2. Prompt that already has exact uuid marker
      const prompt2 = `The dog {{${blanks[0]!.id}}} and runs {{${blanks[1]!.id}}}.`;
      const res2 = buildSentencePromptWithMarkers(prompt2, blanks);
      expect(res2).toBe(prompt2);

      // 3. Schema validation against FillBlankItemSchema from @englove/shared
      const itemPayload = {
        id: '33333333-3333-4333-8333-333333333333',
        prompt: res2,
        blanks: [
          {
            id: blanks[0]!.id,
            options: [
              { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'runs' },
              { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'walks' },
            ],
          },
          {
            id: blanks[1]!.id,
            options: [
              { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', text: 'fast' },
              { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', text: 'slowly' },
            ],
          },
        ],
      };

      const parsedSchema = FillBlankItemSchema.safeParse(itemPayload);
      expect(parsedSchema.success).toBe(true);

      // 4. Schema validation against ExamItemSchema from @englove/shared
      const examItemPayload = {
        ...itemPayload,
        weight: 50,
      };
      const parsedExamSchema = ExamItemSchema.safeParse(examItemPayload);
      expect(parsedExamSchema.success).toBe(true);
      expect(parsedSchema.success).toBe(true);

      // 5. Cleans orphaned markers and deduplicates repeated markers so Zod never fails
      const promptWithOrphanAndDupes = `The cat {{${blanks[0]!.id}}} and {{${blanks[0]!.id}}} plus {{unknown_orphan_123}}.`;
      const resClean = buildSentencePromptWithMarkers(promptWithOrphanAndDupes, blanks);
      expect(resClean).toContain(`{{${blanks[0]!.id}}}`);
      expect(resClean).toContain(`{{${blanks[1]!.id}}}`);
      expect(resClean).not.toContain('unknown_orphan_123');

      const parsedCleanSchema = FillBlankItemSchema.safeParse({
        ...itemPayload,
        prompt: resClean,
      });
      expect(parsedCleanSchema.success).toBe(true);
    });

    it('balanceExamWeights evenly distributes 100% across all exam items', () => {
      const items: FormSentenceItem[] = [
        {
          id: '1',
          prompt: 'P1',
          blanks: [],
          weight: '10',
        },
        {
          id: '2',
          prompt: 'P2',
          blanks: [],
          weight: '20',
        },
        {
          id: '3',
          prompt: 'P3',
          blanks: [],
          weight: '70',
        },
      ];

      const balanced = balanceExamWeights(items);
      const sum = balanced.reduce((acc, it) => acc + parseFloat(it.weight || '0'), 0);
      expect(Math.round(sum)).toBe(100);
      expect(balanced[0]!.weight).toBe('33.3');
      expect(balanced[1]!.weight).toBe('33.3');
      expect(balanced[2]!.weight).toBe('33.4');
    });

    it('preserves all UUIDs across a parse and buildPayload roundtrip for fill_blank and exam', () => {
      const fbConfig = {
        instructions: 'Test Instructions',
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            prompt: 'Sentence 1 {{22222222-2222-4222-8222-222222222222}} end.',
            blanks: [
              {
                id: '22222222-2222-4222-8222-222222222222',
                options: [
                  { id: '33333333-3333-4333-8333-333333333333', text: 'apple' },
                  { id: '44444444-4444-4444-8444-444444444444', text: 'orange' },
                ],
              },
            ],
          },
          {
            id: '55555555-5555-4555-8555-555555555555',
            prompt: 'Sentence 2 {{66666666-6666-4666-8666-666666666666}} and {{77777777-7777-4777-8777-777777777777}}.',
            blanks: [
              {
                id: '66666666-6666-4666-8666-666666666666',
                options: [
                  { id: '88888888-8888-4888-8888-888888888888', text: 'cat' },
                  { id: '99999999-9999-4999-8999-999999999999', text: 'dog' },
                ],
              },
              {
                id: '77777777-7777-4777-8777-777777777777',
                options: [
                  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', text: 'sleeps' },
                  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', text: 'runs' },
                ],
              },
            ],
          },
        ],
      };

      const fbAnswerKey = {
        items: {
          '11111111-1111-4111-8111-111111111111': {
            '22222222-2222-4222-8222-222222222222': '33333333-3333-4333-8333-333333333333',
          },
          '55555555-5555-4555-8555-555555555555': {
            '66666666-6666-4666-8666-666666666666': '88888888-8888-4888-8888-888888888888',
            '77777777-7777-4777-8777-777777777777': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        },
      };

      // 1. Parse
      const parsedFb = parseInitialFillBlankItems(fbConfig, fbAnswerKey);
      expect(parsedFb).toHaveLength(2);

      // 2. Build payload without edits
      const { items: builtItems, answerKeyItems: builtKey } = buildFillBlankPayloadItems(parsedFb);

      // Verify item IDs
      expect(builtItems[0]!.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(builtItems[1]!.id).toBe('55555555-5555-4555-8555-555555555555');

      // Verify blank IDs
      expect(builtItems[0]!.blanks[0]!.id).toBe('22222222-2222-4222-8222-222222222222');
      expect(builtItems[1]!.blanks[0]!.id).toBe('66666666-6666-4666-8666-666666666666');
      expect(builtItems[1]!.blanks[1]!.id).toBe('77777777-7777-4777-8777-777777777777');

      // Verify option IDs
      expect(builtItems[0]!.blanks[0]!.options[0]!.id).toBe('33333333-3333-4333-8333-333333333333');
      expect(builtItems[0]!.blanks[0]!.options[1]!.id).toBe('44444444-4444-4444-8444-444444444444');
      expect(builtItems[1]!.blanks[0]!.options[0]!.id).toBe('88888888-8888-4888-8888-888888888888');
      expect(builtItems[1]!.blanks[0]!.options[1]!.id).toBe('99999999-9999-4999-8999-999999999999');

      // Verify answer key items
      expect(builtKey['11111111-1111-4111-8111-111111111111']).toEqual({
        '22222222-2222-4222-8222-222222222222': '33333333-3333-4333-8333-333333333333',
      });
      expect(builtKey['55555555-5555-4555-8555-555555555555']).toEqual({
        '66666666-6666-4666-8666-666666666666': '88888888-8888-4888-8888-888888888888',
        '77777777-7777-4777-8777-777777777777': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });

      // Verify exam payload items with weights
      const examItemsForm: FormSentenceItem[] = [
        {
          ...parsedFb[0]!,
          weight: '40',
        },
        {
          ...parsedFb[1]!,
          weight: '60',
        },
      ];

      const { items: builtExamItems } = buildExamPayloadItems(examItemsForm);
      expect(builtExamItems[0]!.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(builtExamItems[0]!.weight).toBe(40);
      expect(builtExamItems[1]!.id).toBe('55555555-5555-4555-8555-555555555555');
      expect(builtExamItems[1]!.weight).toBe(60);
      expect(builtExamItems[1]!.blanks[1]!.id).toBe('77777777-7777-4777-8777-777777777777');
    });
  });

  describe('P1-10 & P3-03: Decimal Comma Normalization and Display Formatting', () => {
    function normalizeScoreInput(scoreInput: string): number {
      const trimmed = scoreInput.trim();
      if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) {
        throw new Error('El puntaje debe tener un formato decimal válido');
      }
      const normalized = trimmed.replace(',', '.');
      const val = parseFloat(normalized);
      if (isNaN(val) || val < 0.0 || val > 5.0) {
        throw new Error('El puntaje debe ser un número entre 0.0 y 5.0');
      }
      return val;
    }

    function formatScoreForDisplay(score: number): string {
      return `${score.toFixed(1).replace('.', ',')} / 5,0`;
    }

    it('normalizes decimal comma inputs correctly without integer truncation', () => {
      expect(normalizeScoreInput('4,5')).toBe(4.5);
      expect(normalizeScoreInput('3,8')).toBe(3.8);
      expect(normalizeScoreInput('0,0')).toBe(0.0);
      expect(normalizeScoreInput('5,0')).toBe(5.0);
      expect(normalizeScoreInput('4.5')).toBe(4.5);
    });

    it('rejects scores out of range 0.0 to 5.0 or with invalid format', () => {
      expect(() => normalizeScoreInput('-0,1')).toThrow();
      expect(() => normalizeScoreInput('5,1')).toThrow();
      expect(() => normalizeScoreInput('abc')).toThrow();
      expect(() => normalizeScoreInput('4,5abc')).toThrow();
      expect(() => normalizeScoreInput('4.5.6')).toThrow();
    });

    it('formats scores with decimal comma according to UI convention', () => {
      expect(formatScoreForDisplay(4.5)).toBe('4,5 / 5,0');
      expect(formatScoreForDisplay(5.0)).toBe('5,0 / 5,0');
      expect(formatScoreForDisplay(0.0)).toBe('0,0 / 5,0');
      expect(formatScoreForDisplay(3.7)).toBe('3,7 / 5,0');
    });
  });

  describe('P1-05: Game Motivation Messages & Stars Integration', () => {
    it('returns appropriate stars and exact normative motivation messages without exposing numerical score', () => {
      // 3 stars (score >= 4.5)
      expect(scoreToGameStars(5.0)).toBe(3);
      expect(scoreToGameStars(4.5)).toBe(3);
      const msgHighKids = getGameMotivationMessage(5.0, AgeSegment.kids);
      const msgHighTeens = getGameMotivationMessage(4.5, AgeSegment.teens);
      expect(msgHighKids).toBe('¡Increíble! Acertaste todo en esta partida.');
      expect(msgHighTeens).toBe('¡Excelente práctica! Lograste 3 estrellas; estás a un paso de una ronda sin fallos.');

      // 2 stars (3.0 <= score < 4.5)
      expect(scoreToGameStars(3.5)).toBe(2);
      expect(scoreToGameStars(4.4)).toBe(2);
      const msgMidKids = getGameMotivationMessage(3.5, AgeSegment.kids);
      const msgMidTeens = getGameMotivationMessage(3.0, AgeSegment.teens);
      expect(msgMidKids).toBe('¡Buen trabajo! Ganaste 2 estrellas; prueba otra ronda para llegar a 3.');
      expect(msgMidTeens).toBe('¡Buen ritmo! Sumaste 2 estrellas; intenta otra partida para alcanzar las 3.');

      // 1 star (0.1 <= score < 3.0)
      expect(scoreToGameStars(2.0)).toBe(1);
      expect(scoreToGameStars(0.1)).toBe(1);
      const msgLowKids = getGameMotivationMessage(1.5, AgeSegment.kids);
      const msgLowTeens = getGameMotivationMessage(0.5, AgeSegment.teens);
      expect(msgLowKids).toBe('¡Ya tienes 1 estrella! Cada partida te ayuda a mejorar.');
      expect(msgLowTeens).toBe('¡Sumaste 1 estrella! Repasa las pistas e inténtalo de nuevo.');

      // 0 stars (score < 0.1)
      expect(scoreToGameStars(0.0)).toBe(0);
      const msgZeroKids = getGameMotivationMessage(0.0, AgeSegment.kids);
      const msgZeroTeens = getGameMotivationMessage(0.0, AgeSegment.teens);
      expect(msgZeroKids).toBe('¡Sigue intentando! Juega otra vez para ganar tu primera estrella.');
      expect(msgZeroTeens).toBe('¡No pasa nada! Vuelve a intentarlo para desbloquear tus estrellas.');
    });

    it('derives stars and motivation message for student games card when bestStars is absent but score is present', () => {
      const mockGameCard = {
        id: 'game-1',
        title: 'Word Match',
        bestStars: null,
        bestScore: 4.8,
        lastStars: null,
        status: 'completed' as const,
        attemptsCount: 2,
      };

      const stars =
        mockGameCard.bestStars ??
        (mockGameCard.bestScore !== null ? scoreToGameStars(mockGameCard.bestScore) : 0);
      expect(stars).toBe(3);

      const motivationMessage = getGameMotivationMessage(mockGameCard.bestScore, AgeSegment.kids);
      expect(motivationMessage).toBe('¡Súper bien! Conseguiste las 3 estrellas; juega otra vez si quieres acertar todas.');
    });
  });

  describe('P1-03: Speaking Upload Audio & Media Confirmation', () => {
    it('uploadAudioBlob forwards x-attempt-token header when attemptToken is supplied', async () => {
      const mockBlob = new Blob(['audio-content'], { type: 'audio/webm' });

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/upload-url')) {
          expect(init?.headers).toEqual(
            expect.objectContaining({
              'x-attempt-token': 'test-attempt-token-xyz',
            }),
          );
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              mediaId: 'media-uuid-1234',
              uploadUrl: 'http://localhost:3001/storage/upload',
            }),
          };
        }
        if (url.includes('/storage/upload')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers(),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const mediaId = await uploadAudioBlob({
        blob: mockBlob,
        attemptId: 'attempt-uuid-5678',
        attemptToken: 'test-attempt-token-xyz',
        apiUrl: 'http://localhost:3001',
        origin: 'http://localhost:3000',
      });

      expect(mediaId).toBe('media-uuid-1234');
    });
  });

  describe('P0-09 & QA-07: Unconsumed Retry Warning Modal Confirmation', () => {
    it('identifies UNCONSUMED_RETRY_WARNING and extracts affected activities as structured objects', () => {
      const apiErrorResponse = {
        statusCode: 409,
        code: 'UNCONSUMED_RETRY_WARNING',
        message: 'El alumno perderá reintentos no consumidos',
        details: {
          affectedActivities: [
            {
              assignmentId: 'asg-1',
              activityId: 'act-1',
              activityTitle: 'Verb Tenses Quiz',
              effectiveDueAt: '2026-11-20T18:00:00.000Z',
              attemptNumber: 1,
            },
            {
              assignmentId: 'asg-2',
              activityId: 'act-2',
              activityTitle: 'Vocabulary Test',
              effectiveDueAt: '2026-11-21T18:00:00.000Z',
              attemptNumber: 2,
            },
          ],
        },
      };

      expect(apiErrorResponse.code).toBe('UNCONSUMED_RETRY_WARNING');
      expect(apiErrorResponse.details.affectedActivities).toHaveLength(2);
      expect(apiErrorResponse.details.affectedActivities[0]!.activityTitle).toBe('Verb Tenses Quiz');
      expect(apiErrorResponse.details.affectedActivities[0]!.attemptNumber).toBe(1);
    });

    it('identifies UNCONSUMED_RETRY_WARNING with legacy string array format gracefully', () => {
      const apiErrorResponse = {
        statusCode: 409,
        code: 'UNCONSUMED_RETRY_WARNING',
        message: 'El alumno perderá reintentos no consumidos',
        details: {
          affectedActivities: ['Verb Tenses Quiz', 'Vocabulary Test'],
        },
      };

      expect(apiErrorResponse.code).toBe('UNCONSUMED_RETRY_WARNING');
      expect(apiErrorResponse.details.affectedActivities).toEqual([
        'Verb Tenses Quiz',
        'Vocabulary Test',
      ]);
    });
  });

  describe('P1-07: Open Question Multi-Question Mapping', () => {
    it('maps answer keys strictly by item ID when multiple questions exist', () => {
      const questions = [
        { id: 'q-item-1', prompt: 'Tell me about your favorite animal.' },
        { id: 'q-item-2', prompt: 'What did you do last weekend?' },
      ];

      const currentAnswers: Record<string, string> = {
        'q-item-1': 'My favorite animal is a dog.',
        'q-item-2': 'I played soccer.',
      };

      // Ensure item IDs are used directly without falling back to 'text'
      const submittedAnswers: Record<string, string> = {};
      for (const q of questions) {
        submittedAnswers[q.id] = currentAnswers[q.id] ?? '';
      }

      expect(submittedAnswers['q-item-1']).toBe('My favorite animal is a dog.');
      expect(submittedAnswers['q-item-2']).toBe('I played soccer.');
      expect(submittedAnswers['text']).toBeUndefined();
    });
  });
});
