import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
  FillBlankConfig,
  FillBlankAnswerKey,
  ExamConfig,
  ExamAnswerKey,
  calculateExamScore,
  scoreToStars,
} from '@englove/shared';

export interface ScoreCalculationResult {
  score: number;
  fraction: number;
  correction: Record<string, Record<string, { correct: boolean }>>;
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
