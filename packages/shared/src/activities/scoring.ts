/**
 * Scoring formulas for all activity types and game mechanics (SPEC-03 §4, RF-6).
 * Each formula returns a fraction between 0.0 and 1.0.
 */

/**
 * Fill in the blanks:
 * Correct blanks / total blanks.
 */
export function calculateFillBlankScore(
  blanksSolution: Record<string, string>,
  userAnswers: Record<string, string> = {},
): number {
  const blankIds = Object.keys(blanksSolution);
  if (blankIds.length === 0) return 0;

  let correct = 0;
  for (const bId of blankIds) {
    if (userAnswers[bId] && userAnswers[bId] === blanksSolution[bId]) {
      correct++;
    }
  }

  return correct / blankIds.length;
}

/**
 * Exam:
 * Sum of (fraction of each sentence * weight / 100), including omitted items.
 */
export function calculateExamScore(
  items: Array<{
    id: string;
    weight: number;
    blanksSolution: Record<string, string>;
  }>,
  userAnswers: Record<string, Record<string, string>> = {},
): number {
  if (items.length === 0) return 0;

  let totalScore = 0;
  for (const item of items) {
    const itemAns = userAnswers[item.id] || {};
    const itemFraction = calculateFillBlankScore(item.blanksSolution, itemAns);
    totalScore += (itemFraction * item.weight) / 100;
  }

  return Math.min(1, Math.max(0, totalScore));
}

/**
 * Match:
 * Correct pairs / total left elements.
 */
export function calculateMatchScore(
  pairsSolution: Record<string, string>,
  userPairs: Record<string, string> = {},
): number {
  const leftIds = Object.keys(pairsSolution);
  if (leftIds.length === 0) return 0;

  let correct = 0;
  for (const lId of leftIds) {
    if (userPairs[lId] && userPairs[lId] === pairsSolution[lId]) {
      correct++;
    }
  }

  return correct / leftIds.length;
}

/**
 * Order words:
 * Tokens whose text matches expected position / total tokens.
 * "intercambiar textos idénticos no penaliza" (SPEC-03 §4, RF-6).
 */
export function calculateOrderWordsScore(
  tokens: Array<{ id: string; text: string }>,
  expectedTokenIds: string[],
  userTokenIds: string[] = [],
): number {
  if (expectedTokenIds.length === 0) return 0;

  const tokenMap = new Map<string, string>();
  for (const t of tokens) {
    tokenMap.set(t.id, t.text.trim());
  }

  let correct = 0;
  for (let i = 0; i < expectedTokenIds.length; i++) {
    const expId = expectedTokenIds[i];
    if (!expId) continue;
    const expectedText = tokenMap.get(expId);
    const userTokenId = userTokenIds[i];
    const userText = userTokenId ? tokenMap.get(userTokenId) : undefined;
    if (expectedText !== undefined && userText !== undefined && expectedText === userText) {
      correct++;
    }
  }

  return correct / expectedTokenIds.length;
}

/**
 * Drag and drop:
 * Objects in correct destination / total objects.
 */
export function calculateDragDropScore(
  placementsSolution: Record<string, string>,
  userPlacements: Record<string, string> = {},
): number {
  const objectIds = Object.keys(placementsSolution);
  if (objectIds.length === 0) return 0;

  let correct = 0;
  for (const objId of objectIds) {
    if (userPlacements[objId] && userPlacements[objId] === placementsSolution[objId]) {
      correct++;
    }
  }

  return correct / objectIds.length;
}

/**
 * Memory cards:
 * Pairs found / (total pairs + failed selections).
 * (SPEC-03 §4, RF-6: "memory: dos parejas / un fallo = 2/3")
 */
export function calculateMemoryScore(
  totalPairs: number,
  resolvedPairs: number,
  failedSelections: number = 0,
): number {
  const denominator = totalPairs + failedSelections;
  if (denominator <= 0) return 0;

  return Math.min(1, Math.max(0, resolvedPairs / denominator));
}

/**
 * Timed choice:
 * Correct questions / total questions.
 */
export function calculateTimedChoiceScore(
  choicesSolution: Record<string, string>,
  userChoices: Record<string, string | null | undefined> = {},
): number {
  const questionIds = Object.keys(choicesSolution);
  if (questionIds.length === 0) return 0;

  let correct = 0;
  for (const qId of questionIds) {
    if (userChoices[qId] && userChoices[qId] === choicesSolution[qId]) {
      correct++;
    }
  }

  return correct / questionIds.length;
}
