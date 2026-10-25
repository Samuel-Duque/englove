import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  FillBlankConfig,
  FillBlankAnswerKey,
  ExamConfig,
  ExamAnswerKey,
  GameConfig,
  GameAnswerKey,
  GameMechanic,
  MatchSettings,
  MatchSolution,
  OrderWordsSettings,
  OrderWordsSolution,
  DragDropSettings,
  DragDropSolution,
  MemorySettings,
  MemorySolution,
  TimedChoiceSettings,
  TimedChoiceSolution,
  calculateExamScore,
  calculateMatchScore,
  calculateOrderWordsScore,
  calculateDragDropScore,
  calculateTimedChoiceScore,
  reconstructMemoryPlays,
  scoreToStars,
} from '@englove/shared';

export interface ScoreCalculationResult {
  score: number;
  fraction: number;
  correction: Record<string, unknown>;
  flags: string[];
}

@Injectable()
export class ScoringService {
  /**
   * Calculates score for fill_blank activity.
   * RF-9: correct blanks / total blanks, rounded to 1 decimal place on scale 0.0 - 5.0.
   * Omitted blanks receive 0.
   */
  calculateFillBlank(
    config: FillBlankConfig,
    answerKey: FillBlankAnswerKey,
    userAnswers: Record<string, unknown> = {},
    durationSeconds?: number,
    minPlausibleSeconds?: number,
  ): ScoreCalculationResult {
    const correction: Record<string, Record<string, { correct: boolean }>> = {};
    const flags: string[] = [];

    let totalBlanks = 0;
    let correctBlanks = 0;

    for (const item of config.items) {
      const itemMap: Record<string, { correct: boolean }> = {};
      correction[item.id] = itemMap;
      const itemKey = answerKey.items[item.id] || {};
      const itemAnswers = (userAnswers[item.id] as Record<string, string> | undefined) || {};

      for (const blank of item.blanks) {
        totalBlanks++;
        const expected = itemKey[blank.id];
        const submitted = itemAnswers[blank.id] ?? (userAnswers[blank.id] as string | undefined);

        const isCorrect = submitted !== undefined && expected !== undefined && submitted === expected;
        if (isCorrect) {
          correctBlanks++;
        }
        itemMap[blank.id] = { correct: Boolean(isCorrect) };
      }
    }

    const fraction = totalBlanks > 0 ? correctBlanks / totalBlanks : 0;
    const score = this.fractionToScore(fraction);

    if (
      durationSeconds !== undefined &&
      minPlausibleSeconds !== undefined &&
      durationSeconds < minPlausibleSeconds
    ) {
      // guardrails-ignore G-C06: flag de negocio implausible_duration segun SPEC-05 RF-10
      flags.push('implausible_duration');
    }

    return { score, fraction, correction, flags };
  }

  /**
   * Calculates score for exam activity.
   * RF-9, Decision 102 (Q-03): Weighted average of sentences with normalized weights.
   * Items without answers receive 0.
   */
  calculateExam(
    config: ExamConfig,
    answerKey: ExamAnswerKey,
    userAnswers: Record<string, Record<string, string>> = {},
    durationSeconds?: number,
    minPlausibleSeconds?: number,
  ): ScoreCalculationResult {
    const correction: Record<string, Record<string, { correct: boolean }>> = {};
    const flags: string[] = [];

    const examItems = config.items.map((it) => ({
      id: it.id,
      weight: it.weight,
      blanksSolution: answerKey.items[it.id] || {},
    }));

    for (const item of config.items) {
      const itemMap: Record<string, { correct: boolean }> = {};
      correction[item.id] = itemMap;
      const itemKey = answerKey.items[item.id] || {};
      const itemSubmitted = userAnswers[item.id] || {};

      for (const blank of item.blanks) {
        const expected = itemKey[blank.id];
        const submitted = itemSubmitted[blank.id];
        const isCorrect = submitted !== undefined && expected !== undefined && submitted === expected;
        itemMap[blank.id] = { correct: Boolean(isCorrect) };
      }
    }

    const fraction = calculateExamScore(examItems, userAnswers);
    const score = this.fractionToScore(fraction);

    if (
      durationSeconds !== undefined &&
      minPlausibleSeconds !== undefined &&
      durationSeconds < minPlausibleSeconds
    ) {
      // guardrails-ignore G-C06: flag de negocio implausible_duration segun SPEC-05 RF-10
      flags.push('implausible_duration');
    }

    return { score, fraction, correction, flags };
  }

  /**
   * Calculates score for game activity across all 5 mechanics (SPEC-06 §4, RF-7, RF-8).
   * Generates fraction in [0.0, 1.0], converts to score in [0.0, 5.0],
   * formats correction object, and checks duracion plausible (minPlausibleSeconds).
   */
  calculateGame(
    config: GameConfig,
    answerKey: GameAnswerKey,
    userAnswers: Record<string, unknown> = {},
    durationSeconds?: number,
    minPlausibleSeconds?: number,
  ): ScoreCalculationResult {
    let fraction = 0;
    let correction: Record<string, unknown> = {};
    const flags: string[] = [];

    const mechanic = config.mechanic;

    switch (mechanic) {
      case GameMechanic.match: {
        const settings = config.settings as MatchSettings;
        const solution = answerKey.solution as MatchSolution;
        const userPairs =
          userAnswers.pairs && typeof userAnswers.pairs === 'object'
            ? (userAnswers.pairs as Record<string, string>)
            : typeof userAnswers === 'object' && userAnswers !== null && !Array.isArray(userAnswers)
              ? (userAnswers as Record<string, string>)
              : {};
        fraction = calculateMatchScore(solution?.pairs || {}, userPairs);

        const usedRightIds = new Set<string>();
        const matchCorrection: Record<string, unknown> = {};
        for (const item of settings.left) {
          const expected = solution.pairs[item.id];
          const submitted = userPairs[item.id] || null;
          const isCorrect =
            submitted !== null && submitted === expected && !usedRightIds.has(submitted);
          if (isCorrect && submitted) usedRightIds.add(submitted);
          matchCorrection[item.id] = {
            correct: isCorrect,
            expected,
            submitted,
          };
        }
        correction = matchCorrection;
        break;
      }

      case GameMechanic.order_words: {
        const settings = config.settings as OrderWordsSettings;
        const solution = answerKey.solution as OrderWordsSolution;
        const userTokenIds = (
          Array.isArray(userAnswers.tokenIds)
            ? userAnswers.tokenIds
            : Array.isArray(userAnswers)
              ? (userAnswers as unknown as string[])
              : []
        ) as string[];
        fraction = calculateOrderWordsScore(settings.tokens, solution.tokenIds, userTokenIds);

        const tokenMap = new Map<string, string>();
        for (const t of settings.tokens) tokenMap.set(t.id, t.text.trim());
        const seenTokens = new Set<string>();
        const orderCorrection: Record<string, unknown> = {};

        for (let i = 0; i < solution.tokenIds.length; i++) {
          const expId = solution.tokenIds[i]!;
          const expectedText = tokenMap.get(expId) || '';
          const userTokenId = userTokenIds[i];
          let isCorrect = false;
          let submittedText: string | null = null;
          if (userTokenId && tokenMap.has(userTokenId) && !seenTokens.has(userTokenId)) {
            seenTokens.add(userTokenId);
            submittedText = tokenMap.get(userTokenId) || null;
            if (submittedText === expectedText) isCorrect = true;
          }
          orderCorrection[`pos_${i}`] = {
            correct: isCorrect,
            expected: expectedText,
            submitted: submittedText,
          };
        }
        correction = orderCorrection;
        break;
      }

      case GameMechanic.drag_drop: {
        const settings = config.settings as DragDropSettings;
        const solution = answerKey.solution as DragDropSolution;
        const userPlacements =
          userAnswers.placements && typeof userAnswers.placements === 'object'
            ? (userAnswers.placements as Record<string, string>)
            : typeof userAnswers === 'object' && userAnswers !== null && !Array.isArray(userAnswers)
              ? (userAnswers as Record<string, string>)
              : {};
        fraction = calculateDragDropScore(solution?.placements || {}, userPlacements);

        const dragCorrection: Record<string, unknown> = {};
        for (const obj of settings.objects) {
          const expected = solution.placements[obj.id];
          const submitted = userPlacements[obj.id] || null;
          dragCorrection[obj.id] = {
            correct: submitted === expected,
            expected,
            submitted,
          };
        }
        correction = dragCorrection;
        break;
      }

      case GameMechanic.memory: {
        const settings = config.settings as MemorySettings;
        const solution = answerKey.solution as MemorySolution;
        const rawSelections = userAnswers.selections || userAnswers;
        const userSelections = Array.isArray(rawSelections)
          ? (rawSelections as Array<[string, string]>)
          : [];
        const recon = reconstructMemoryPlays(
          settings?.cards || [],
          solution?.pairs || [],
          userSelections,
        );
        fraction = recon.fraction;
        correction = {
          summary: {
            foundPairs: recon.foundPairs,
            totalPairs: recon.totalPairs,
            failedSelections: recon.failedSelections,
          },
          pairs: recon.resolvedPairs,
        };
        break;
      }

      case GameMechanic.timed_choice: {
        const settings = config.settings as TimedChoiceSettings;
        const solution = answerKey.solution as TimedChoiceSolution;
        const userChoices =
          userAnswers.choices && typeof userAnswers.choices === 'object'
            ? (userAnswers.choices as Record<string, string | null>)
            : typeof userAnswers === 'object' && userAnswers !== null && !Array.isArray(userAnswers)
              ? (userAnswers as Record<string, string | null>)
              : {};
        fraction = calculateTimedChoiceScore(solution?.choices || {}, userChoices);

        const timedCorrection: Record<string, unknown> = {};
        for (const q of settings.questions) {
          const expected = solution.choices[q.id];
          const submitted = userChoices[q.id] ?? null;
          timedCorrection[q.id] = {
            correct: submitted !== null && submitted === expected,
            expected,
            submitted,
          };
        }
        correction = timedCorrection;
        break;
      }
    }

    const score = this.fractionToScore(fraction);

    if (
      durationSeconds !== undefined &&
      minPlausibleSeconds !== undefined &&
      durationSeconds < minPlausibleSeconds
    ) {
      // guardrails-ignore G-C06: flag de negocio implausible_duration segun SPEC-05 RF-10 y SPEC-06 RF-8
      flags.push('implausible_duration');
    }

    return { score, fraction, correction, flags };
  }

  /**
   * Converts a fraction [0.0, 1.0] to a score in [0.0, 5.0] scale with 1 decimal.
   * Throws 500 SCORE_OUT_OF_RANGE if out of bounds or not finite.
   */
  fractionToScore(fraction: number): number {
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
      throw new HttpException(
        {
          statusCode: 500,
          code: 'SCORE_OUT_OF_RANGE',
          message: 'La fracción de puntaje está fuera de los límites permitidos [0, 1]',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const score = Math.round(fraction * 5 * 10) / 10;

    if (score < 0 || score > 5.0) {
      throw new HttpException(
        {
          statusCode: 500,
          code: 'SCORE_OUT_OF_RANGE',
          message: 'El puntaje calculado está fuera de la escala 0.0 - 5.0',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return score;
  }

  /**
   * Converts score to star rating (Decision 101 / Q-02):
   * 0 stars: score === 0.0 or null/undefined
   * 1 star: 0 < score < 3.0
   * 2 stars: 3.0 <= score < 4.5
   * 3 stars: score >= 4.5
   */
  scoreToStars(score: number | null | undefined): number {
    return scoreToStars(score);
  }
}
