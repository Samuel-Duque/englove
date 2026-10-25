import { describe, it, expect } from 'vitest';
import {
  ActivityType,
  GameMechanic,
  FillBlankConfigSchema,
  FillBlankBlankSchema,
  FillBlankItemSchema,
  parseFillBlankSimpleSyntax,
  OpenQuestionConfigSchema,
  SpeakingConfigSchema,
  MatchSettingsSchema,
  OrderWordsSettingsSchema,
  DragDropSettingsSchema,
  MemorySettingsSchema,
  TimedChoiceSettingsSchema,
  ExamConfigSchema,
  ExamPublishConfigSchema,
  normalizeExamWeights,
  calculateFillBlankScore,
  calculateExamScore,
  calculateMatchScore,
  calculateOrderWordsScore,
  calculateDragDropScore,
  calculateMemoryScore,
  calculateTimedChoiceScore,
  resolveActivityDurations,
  toPublicConfig,
  validateActivityPayload,
  ActivityValidationError,
} from '../src';

describe('ENG-030 / SPEC-03: Activity schemas, scoring, weights and durations', () => {
  const uuid1 = '11111111-1111-4111-8111-111111111111';
  const uuid2 = '22222222-2222-4222-8222-222222222222';
  const uuid3 = '33333333-3333-4333-8333-333333333333';
  const uuid4 = '44444444-4444-4444-8444-444444444444';

  describe('RF-3: Fill in the blanks', () => {
    it('accepts valid fill_blank config with markers and distinct options', () => {
      const validConfig = {
        instructions: 'Complete the sentences',
        items: [
          {
            id: uuid1,
            prompt: `She {{${uuid2}}} to school every day.`,
            blanks: [
              {
                id: uuid2,
                options: [
                  { id: uuid3, text: 'goes' },
                  { id: uuid4, text: 'go' },
                ],
              },
            ],
          },
        ],
      };
      const result = FillBlankConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('rejects duplicate option text in a blank after trimming', () => {
      const blank = {
        id: uuid2,
        options: [
          { id: uuid3, text: 'goes' },
          { id: uuid4, text: ' goes ' },
        ],
      };
      const result = FillBlankBlankSchema.safeParse(blank);
      expect(result.success).toBe(false);
    });

    it('rejects orphan marker in prompt', () => {
      const item = {
        id: uuid1,
        prompt: `She {{${uuid2}}} to {{${uuid3}}} school.`,
        blanks: [
          {
            id: uuid2,
            options: [
              { id: uuid3, text: 'goes' },
              { id: uuid4, text: 'go' },
            ],
          },
        ],
      };
      const result = FillBlankItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('rejects HTML tags in prompt', () => {
      const item = {
        id: uuid1,
        prompt: `She <b>{{${uuid2}}}</b> to school.`,
        blanks: [
          {
            id: uuid2,
            options: [
              { id: uuid3, text: 'goes' },
              { id: uuid4, text: 'go' },
            ],
          },
        ],
      };
      const result = FillBlankItemSchema.safeParse(item);
      expect(result.success).toBe(false);
    });

    it('parseFillBlankSimpleSyntax converts [correct|distractor] into blanks and key', () => {
      const raw = 'The cat [is|are|am] sleeping on the [mat|bed].';
      const parsed = parseFillBlankSimpleSyntax(raw);
      expect(parsed.blanks.length).toBe(2);
      expect(parsed.prompt).toContain('{{');
      expect(Object.keys(parsed.answerKey).length).toBe(2);
      // Correct answer is the first option
      expect(parsed.blanks[0].options[0].text).toBe('is');
      expect(parsed.answerKey[parsed.blanks[0].id]).toBe(parsed.blanks[0].options[0].id);
    });
  });

  describe('RF-4: Open Question', () => {
    it('accepts valid open question config', () => {
      const cfg = {
        prompt: 'Describe your favorite animal and why you like it.',
        rubric: 'Grammar and vocabulary',
        maxLength: 500,
      };
      const parsed = OpenQuestionConfigSchema.safeParse(cfg);
      expect(parsed.success).toBe(true);
    });

    it('rejects HTML in prompt', () => {
      const parsed = OpenQuestionConfigSchema.safeParse({
        prompt: '<script>alert(1)</script> Describe your pet',
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('RF-5: Speaking', () => {
    it('validates bounds 2, 120, 300 and HTTPS exampleUrl', () => {
      expect(
        SpeakingConfigSchema.safeParse({
          prompt: 'Talk about your weekend',
          minDurationSeconds: 2,
          maxDurationSeconds: 120,
          exampleUrl: 'https://example.com/audio.mp3',
        }).success,
      ).toBe(true);

      expect(
        SpeakingConfigSchema.safeParse({
          prompt: 'Talk about your weekend',
          minDurationSeconds: 2,
          maxDurationSeconds: 300,
        }).success,
      ).toBe(true);

      // Rejects HTTP (must be HTTPS)
      expect(
        SpeakingConfigSchema.safeParse({
          prompt: 'Talk about your weekend',
          exampleUrl: 'http://insecure.com/audio.mp3',
        }).success,
      ).toBe(false);

      // Rejects max duration < 2 or > 300
      expect(
        SpeakingConfigSchema.safeParse({
          prompt: 'Talk about your weekend',
          maxDurationSeconds: 1,
        }).success,
      ).toBe(false);

      expect(
        SpeakingConfigSchema.safeParse({
          prompt: 'Talk about your weekend',
          maxDurationSeconds: 301,
        }).success,
      ).toBe(false);
    });
  });

  describe('RF-6: Game mechanics schemas', () => {
    it('validates match requires equal sizes >= 2', () => {
      expect(
        MatchSettingsSchema.safeParse({
          left: [
            { id: uuid1, text: 'cat' },
            { id: uuid2, text: 'dog' },
          ],
          right: [
            { id: uuid3, text: 'gato' },
            { id: uuid4, text: 'perro' },
          ],
        }).success,
      ).toBe(true);

      expect(
        MatchSettingsSchema.safeParse({
          left: [
            { id: uuid1, text: 'cat' },
            { id: uuid2, text: 'dog' },
          ],
          right: [{ id: uuid3, text: 'gato' }],
        }).success,
      ).toBe(false);
    });

    it('validates order_words requires at least 2 tokens', () => {
      expect(
        OrderWordsSettingsSchema.safeParse({
          tokens: [
            { id: uuid1, text: 'I' },
            { id: uuid2, text: 'read' },
          ],
        }).success,
      ).toBe(true);

      expect(
        OrderWordsSettingsSchema.safeParse({
          tokens: [{ id: uuid1, text: 'I' }],
        }).success,
      ).toBe(false);
    });

    it('validates drag_drop requires objects and targets >= 2', () => {
      expect(
        DragDropSettingsSchema.safeParse({
          objects: [
            { id: uuid1, text: 'Apple' },
            { id: uuid2, text: 'Carrot' },
          ],
          targets: [
            { id: uuid3, text: 'Fruit' },
            { id: uuid4, text: 'Vegetable' },
          ],
        }).success,
      ).toBe(true);
    });

    it('validates memory requires even count >= 4', () => {
      expect(
        MemorySettingsSchema.safeParse({
          cards: [
            { id: uuid1, text: 'A' },
            { id: uuid2, text: 'A' },
            { id: uuid3, text: 'B' },
            { id: uuid4, text: 'B' },
          ],
        }).success,
      ).toBe(true);

      // Odd count rejected
      expect(
        MemorySettingsSchema.safeParse({
          cards: [
            { id: uuid1, text: 'A' },
            { id: uuid2, text: 'A' },
            { id: uuid3, text: 'B' },
          ],
        }).success,
      ).toBe(false);
    });

    it('validates timed_choice questions and timeLimitSeconds', () => {
      expect(
        TimedChoiceSettingsSchema.safeParse({
          timeLimitSeconds: 20,
          questions: [
            {
              id: uuid1,
              prompt: 'What color is the sky?',
              options: [
                { id: uuid2, text: 'Blue' },
                { id: uuid3, text: 'Green' },
              ],
            },
          ],
        }).success,
      ).toBe(true);

      // timeLimit < 5 rejected
      expect(
        TimedChoiceSettingsSchema.safeParse({
          timeLimitSeconds: 4,
          questions: [],
        }).success,
      ).toBe(false);
    });
  });

  describe('RF-7 & RF-8: Exam and weight normalization', () => {
    it('draft allows 0 or 1 item, publish requires >= 2 items', () => {
      expect(ExamConfigSchema.safeParse({ items: [] }).success).toBe(true);

      const oneItem = {
        id: uuid1,
        weight: 100,
        prompt: `Hello {{${uuid2}}}`,
        blanks: [
          {
            id: uuid2,
            options: [
              { id: uuid3, text: 'world' },
              { id: uuid4, text: 'earth' },
            ],
          },
        ],
      };

      expect(ExamConfigSchema.safeParse({ items: [oneItem] }).success).toBe(true);
      expect(ExamPublishConfigSchema.safeParse({ items: [oneItem] }).success).toBe(false);
    });

    it('normalizes 30/30/30 to 33.3, 33.3, 33.4 with tie broken from last item (Decisión 97, RF-8)', () => {
      const items = [
        { id: '1', weight: 30 },
        { id: '2', weight: 30 },
        { id: '3', weight: 30 },
      ];
      const result = normalizeExamWeights(items);
      expect(result.weightsAdjusted).toBe(true);
      expect(result.items.map((it) => it.weight)).toEqual([33.3, 33.3, 33.4]);
      const sum = result.items.reduce((acc, it) => acc + it.weight, 0);
      expect(Math.round(sum * 10) / 10).toBe(100.0);
    });

    it('normalizes 33.36/33.36/33.26/0.01 to 33.4/33.4/33.2/0.0 (Decisión 97, RF-8)', () => {
      const items = [
        { id: '1', weight: 33.36 },
        { id: '2', weight: 33.36 },
        { id: '3', weight: 33.26 },
        { id: '4', weight: 0.01 },
      ];
      const result = normalizeExamWeights(items);
      expect(result.weightsAdjusted).toBe(true);
      expect(result.items.map((it) => it.weight)).toEqual([33.4, 33.4, 33.2, 0.0]);
      const sum = result.items.reduce((acc, it) => acc + it.weight, 0);
      expect(Math.round(sum * 10) / 10).toBe(100.0);
    });

    it('handles empty items and already normalized weights', () => {
      expect(normalizeExamWeights([])).toEqual({ items: [], weightsAdjusted: false });

      const normalized = [
        { id: '1', weight: 50.0 },
        { id: '2', weight: 50.0 },
      ];
      const res = normalizeExamWeights(normalized);
      expect(res.weightsAdjusted).toBe(false);
      expect(res.items.map((it) => it.weight)).toEqual([50.0, 50.0]);
    });
  });

  describe('RF-6 & §4: Scoring formulas', () => {
    it('calculates fill_blank score correctly', () => {
      const sol = { b1: 'opt1', b2: 'opt2' };
      expect(calculateFillBlankScore(sol, { b1: 'opt1', b2: 'opt2' })).toBe(1.0);
      expect(calculateFillBlankScore(sol, { b1: 'opt1', b2: 'optWrong' })).toBe(0.5);
      expect(calculateFillBlankScore(sol, {})).toBe(0.0);
    });

    it('calculates exam score with weighted sentences and counts omitted as zero', () => {
      const items = [
        { id: 'i1', weight: 60, blanksSolution: { b1: 'opt1' } },
        { id: 'i2', weight: 40, blanksSolution: { b2: 'opt2' } },
      ];
      // Full marks
      expect(calculateExamScore(items, { i1: { b1: 'opt1' }, i2: { b2: 'opt2' } })).toBe(1.0);
      // Item 2 omitted (0 marks for item 2, 60% of total)
      expect(calculateExamScore(items, { i1: { b1: 'opt1' } })).toBe(0.6);
      // Both omitted
      expect(calculateExamScore(items, {})).toBe(0.0);
    });

    it('order_words: swapping identical text tokens does not penalize (I had had enough -> 4/4)', () => {
      const tokens = [
        { id: 't1', text: 'I' },
        { id: 't2', text: 'had' },
        { id: 't3', text: 'had' },
        { id: 't4', text: 'enough' },
      ];
      const expected = ['t1', 't2', 't3', 't4'];
      // User swapped t2 and t3 (both have text "had")
      const userSubmission = ['t1', 't3', 't2', 't4'];
      expect(calculateOrderWordsScore(tokens, expected, userSubmission)).toBe(1.0);
    });

    it('memory: two pairs found and one failed selection gives 2/3 (SPEC-03 §4)', () => {
      expect(calculateMemoryScore(2, 2, 1)).toBeCloseTo(2 / 3);
    });

    it('match: calculates fraction and prevents right reuse', () => {
      const sol = { l1: 'r1', l2: 'r2', l3: 'r3' };
      expect(calculateMatchScore(sol, { l1: 'r1', l2: 'r2', l3: 'r3' })).toBe(1.0);
      expect(calculateMatchScore(sol, { l1: 'r1', l2: 'r1', l3: 'r3' })).toBeCloseTo(2 / 3);
      expect(calculateMatchScore(sol, {})).toBe(0.0);
      expect(calculateMatchScore({} as Record<string, string>, {})).toBe(0.0);
    });

    it('drag_drop: calculates fraction across targets', () => {
      const sol = { o1: 't1', o2: 't1', o3: 't2' };
      expect(calculateDragDropScore(sol, { o1: 't1', o2: 't1', o3: 't2' })).toBe(1.0);
      expect(calculateDragDropScore(sol, { o1: 't1', o2: 't2', o3: 't2' })).toBeCloseTo(2 / 3);
      expect(calculateDragDropScore(sol, {})).toBe(0.0);
      expect(calculateDragDropScore({} as Record<string, string>, {})).toBe(0.0);
    });

    it('timed_choice: calculates fraction across questions', () => {
      const sol = { q1: 'opt1', q2: 'opt2' };
      expect(calculateTimedChoiceScore(sol, { q1: 'opt1', q2: 'opt2' })).toBe(1.0);
      expect(calculateTimedChoiceScore(sol, { q1: 'opt1', q2: null })).toBe(0.5);
      expect(calculateTimedChoiceScore(sol, {})).toBe(0.0);
      expect(calculateTimedChoiceScore({} as Record<string, string>, {})).toBe(0.0);
    });

    it('order_words: handles empty or missing expected tokens gracefully', () => {
      expect(calculateOrderWordsScore([], [], [])).toBe(0.0);
    });
  });

  describe('Activity durations and public projection', () => {
    it('resolves expected durations and defaults', () => {
      const fillBlankDurations = resolveActivityDurations(ActivityType.fill_blank, {});
      expect(fillBlankDurations.expectedDurationSeconds).toBe(60);
      expect(fillBlankDurations.minPlausibleSeconds).toBe(3);

      const examDurations = resolveActivityDurations(ActivityType.exam, {
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
      });
      expect(examDurations.expectedDurationSeconds).toBe(180);
      expect(examDurations.minPlausibleSeconds).toBe(9);
    });

    it('rejects minPlausibleSeconds greater than expectedDurationSeconds', () => {
      expect(() =>
        resolveActivityDurations(ActivityType.fill_blank, {}, {
          expectedDurationSeconds: 10,
          minPlausibleSeconds: 20,
        }),
      ).toThrow();
    });

    it('toPublicConfig strips answer keys and does not leak solution', () => {
      const config = { instructions: 'Test', items: [] };
      const answerKey = { items: { '1': 'secret' } };

      const pub = toPublicConfig(ActivityType.fill_blank, config, answerKey);
      expect((pub as Record<string, unknown>).answerKey).toBeUndefined();
      expect((pub as Record<string, unknown>).answer_key).toBeUndefined();
    });
  });

  describe('RF-2, RF-3, RF-6, RF-7: validateActivityPayload and cross-validation', () => {
    const itemId = '11111111-1111-4111-8111-111111111111';
    const blankId = '22222222-2222-4222-8222-222222222222';
    const optId1 = '33333333-3333-4333-8333-333333333331';
    const optId2 = '33333333-3333-4333-8333-333333333332';

    it('rejects answerKey on open_question and speaking', () => {
      expect(() =>
        validateActivityPayload(
          ActivityType.open_question,
          { prompt: 'Tell me about yourself.' },
          { answer: 'something' },
        ),
      ).toThrow(ActivityValidationError);

      expect(() =>
        validateActivityPayload(
          ActivityType.speaking,
          { prompt: 'Say hello.', minDurationSeconds: 2, maxDurationSeconds: 60 },
          { key: 'something' },
        ),
      ).toThrow(ActivityValidationError);
    });

    it('rejects fill_blank if answerKey is missing, has orphan items or invalid options', () => {
      const validConfig = {
        items: [
          {
            id: itemId,
            prompt: `I have a {{${blankId}}}.`,
            blanks: [
              {
                id: blankId,
                options: [
                  { id: optId1, text: 'cat' },
                  { id: optId2, text: 'dog' },
                ],
              },
            ],
          },
        ],
      };

      // Missing answerKey
      expect(() =>
        validateActivityPayload(ActivityType.fill_blank, validConfig, undefined),
      ).toThrow(ActivityValidationError);

      // Orphan item in answerKey
      expect(() =>
        validateActivityPayload(ActivityType.fill_blank, validConfig, {
          items: {
            [itemId]: { [blankId]: optId1 },
            '99999999-9999-4999-8999-999999999999': { [blankId]: optId1 },
          },
        }),
      ).toThrow(ActivityValidationError);

      // Invalid option ID in answerKey
      expect(() =>
        validateActivityPayload(ActivityType.fill_blank, validConfig, {
          items: {
            [itemId]: { [blankId]: '99999999-9999-4999-8999-999999999999' },
          },
        }),
      ).toThrow(ActivityValidationError);

      // Valid case passes
      const res = validateActivityPayload(ActivityType.fill_blank, validConfig, {
        items: { [itemId]: { [blankId]: optId1 } },
      });
      expect(res.validConfig).toBeDefined();
    });

    it('rejects normalizeExamWeights when weight is Infinity', () => {
      expect(() =>
        normalizeExamWeights([
          { id: '1', weight: Infinity },
          { id: '2', weight: 10 },
        ]),
      ).toThrow('Los pesos deben ser números finitos mayores o iguales a 0');
    });

    it('rejects non-bijective match solution in games', () => {
      const matchConfig = {
        mechanic: GameMechanic.match,
        settings: {
          left: [
            { id: '11111111-1111-4111-8111-111111111101', text: 'cat' },
            { id: '11111111-1111-4111-8111-111111111102', text: 'dog' },
          ],
          right: [
            { id: '22222222-2222-4222-8222-222222222201', text: 'gato' },
            { id: '22222222-2222-4222-8222-222222222202', text: 'perro' },
          ],
        },
      };

      // Non-bijective: both left elements map to the same right element
      expect(() =>
        validateActivityPayload(ActivityType.game, matchConfig, {
          solution: {
            pairs: {
              '11111111-1111-4111-8111-111111111101': '22222222-2222-4222-8222-222222222201',
              '11111111-1111-4111-8111-111111111102': '22222222-2222-4222-8222-222222222201',
            },
          },
        }),
      ).toThrow(ActivityValidationError);
    });

    it('rejects order_words solution that is not a full permutation', () => {
      const orderConfig = {
        mechanic: GameMechanic.order_words,
        settings: {
          tokens: [
            { id: '11111111-1111-4111-8111-111111111101', text: 'hello' },
            { id: '11111111-1111-4111-8111-111111111102', text: 'world' },
          ],
        },
      };

      // Missing a token
      expect(() =>
        validateActivityPayload(ActivityType.game, orderConfig, {
          solution: {
            tokenIds: ['11111111-1111-4111-8111-111111111101'],
          },
        }),
      ).toThrow();
    });

    it('rejects memory solution when cards are not a complete partition', () => {
      const memoryConfig = {
        mechanic: GameMechanic.memory,
        settings: {
          cards: [
            { id: '11111111-1111-4111-8111-111111111101', text: 'sun' },
            { id: '11111111-1111-4111-8111-111111111102', text: 'sol' },
            { id: '11111111-1111-4111-8111-111111111103', text: 'moon' },
            { id: '11111111-1111-4111-8111-111111111104', text: 'luna' },
          ],
        },
      };

      // Card paired with itself
      expect(() =>
        validateActivityPayload(ActivityType.game, memoryConfig, {
          solution: {
            pairs: [
              ['11111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111101'],
              ['11111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111104'],
            ],
          },
        }),
      ).toThrow('Una tarjeta no puede emparejarse consigo misma');
    });

    it('validates exam payload and answerKey correctly for drafts and published states', () => {
      const examItem1 = '11111111-1111-4111-8111-111111111111';
      const examItem2 = '11111111-1111-4111-8111-111111111112';
      const examBlank1 = '22222222-2222-4222-8222-222222222221';
      const examBlank2 = '22222222-2222-4222-8222-222222222222';
      const examOpt1 = '33333333-3333-4333-8333-333333333331';
      const examOpt2 = '33333333-3333-4333-8333-333333333332';

      const singleItemDraft = {
        title: 'Single Item Draft Exam',
        instructions: 'Answer question',
        items: [
          {
            id: examItem1,
            prompt: `Water {{${examBlank1}}} at 100 degrees.`,
            weight: 50,
            blanks: [
              {
                id: examBlank1,
                options: [
                  { id: examOpt1, text: 'boils' },
                  { id: examOpt2, text: 'boil' },
                ],
              },
            ],
          },
        ],
      };

      // 1. Publishing with fewer than 2 items throws EXAM_MIN_ITEMS
      expect(() =>
        validateActivityPayload(ActivityType.exam, singleItemDraft, undefined, true),
      ).toThrow('Agrega al menos dos ítems para publicar');

      const examConfigWith2Items = {
        title: 'Midterm Exam',
        instructions: 'Answer all questions',
        items: [
          {
            id: examItem1,
            prompt: `Water {{${examBlank1}}} at 100 degrees.`,
            weight: 30,
            blanks: [
              {
                id: examBlank1,
                options: [
                  { id: examOpt1, text: 'boils' },
                  { id: examOpt2, text: 'boil' },
                ],
              },
            ],
          },
          {
            id: examItem2,
            prompt: `Ice {{${examBlank2}}} at 0 degrees.`,
            weight: 30,
            blanks: [
              {
                id: examBlank2,
                options: [
                  { id: examOpt1, text: 'melts' },
                  { id: examOpt2, text: 'melt' },
                ],
              },
            ],
          },
        ],
      };

      // 2. Publishing 2 items without answerKey throws
      expect(() =>
        validateActivityPayload(ActivityType.exam, examConfigWith2Items, undefined, true),
      ).toThrow('La clave de respuestas es obligatoria para publicar un examen');

      // 3. Draft with items without answerKey throws
      expect(() =>
        validateActivityPayload(ActivityType.exam, singleItemDraft, undefined, false),
      ).toThrow('La clave de respuestas es obligatoria para un examen con ítems');

      // 4. Draft with 0 items without answerKey sets empty items answerKey
      const emptyExamConfig = {
        title: 'Empty Draft Exam',
        instructions: 'None',
        items: [],
      };
      const emptyResult = validateActivityPayload(
        ActivityType.exam,
        emptyExamConfig,
        undefined,
        false,
      );
      expect(emptyResult.validAnswerKey).toEqual({ items: {} });

      const validExamKey = {
        items: {
          [examItem1]: { [examBlank1]: examOpt1 },
          [examItem2]: { [examBlank2]: examOpt1 },
        },
      };

      // 5. Valid exam with items and answerKey succeeds and normalizes weights (30/30 -> 50/50)
      const validResult = validateActivityPayload(
        ActivityType.exam,
        examConfigWith2Items,
        validExamKey,
        true,
      );
      expect(validResult.validAnswerKey).toEqual(validExamKey);
      expect(validResult.weightsAdjusted).toBe(true);
      if ('items' in validResult.validConfig) {
        expect(validResult.validConfig.items[0]?.weight).toBe(50);
        expect(validResult.validConfig.items[1]?.weight).toBe(50);
      } else {
        expect.unreachable('Exam config must have items');
      }

      // 6. Exam with orphan item in answerKey throws
      expect(() =>
        validateActivityPayload(
          ActivityType.exam,
          examConfigWith2Items,
          {
            items: {
              ...validExamKey.items,
              '99999999-9999-4999-8999-999999999999': { [examBlank1]: examOpt1 },
            },
          },
          false,
        ),
      ).toThrow('La clave contiene un ítem sobrante: 99999999-9999-4999-8999-999999999999');
    });
  });
});


