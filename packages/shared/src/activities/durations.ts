import { ActivityType } from '../enums';

export interface ActivityDurations {
  expectedDurationSeconds: number;
  minPlausibleSeconds: number;
}

export interface ActivityDurationOverrides {
  expectedDurationSeconds?: number | null;
  minPlausibleSeconds?: number | null;
}

/**
 * Resolves expected and min_plausible activity durations according to SPEC-03 §4 and Decisión 79.
 * Validates that minPlausibleSeconds <= expectedDurationSeconds after defaults and overrides.
 */
export function resolveActivityDurations(
  type: ActivityType,
  config: unknown,
  overrides?: ActivityDurationOverrides,
): ActivityDurations {
  let defaultExpected = 60;
  let defaultMinPlausible = 3;

  switch (type) {
    case ActivityType.fill_blank:
      defaultExpected = 60;
      defaultMinPlausible = 3;
      break;

    case ActivityType.open_question: {
      const items =
        typeof config === 'object' && config !== null && 'items' in config && Array.isArray(config.items)
          ? config.items
          : undefined;
      const count = items ? Math.max(1, items.length) : 1;
      defaultExpected = 180 * count;
      defaultMinPlausible = 3 * count;
      break;
    }

    case ActivityType.speaking: {
      const maxSec =
        typeof config === 'object' &&
        config !== null &&
        'maxDurationSeconds' in config &&
        typeof config.maxDurationSeconds === 'number'
          ? config.maxDurationSeconds
          : 120;
      defaultExpected = Math.max(2, maxSec);
      defaultMinPlausible = 2;
      break;
    }

    case ActivityType.game:
      defaultExpected = 120;
      defaultMinPlausible = 3;
      break;

    case ActivityType.exam: {
      const items =
        typeof config === 'object' && config !== null && 'items' in config && Array.isArray(config.items)
          ? config.items
          : undefined;
      const itemCount = items ? Math.max(1, items.length) : 1;
      defaultExpected = 60 * itemCount;
      defaultMinPlausible = 3 * itemCount;
      break;
    }
  }

  const expected =
    typeof overrides?.expectedDurationSeconds === 'number' && overrides.expectedDurationSeconds > 0
      ? overrides.expectedDurationSeconds
      : defaultExpected;

  const minPlausible =
    typeof overrides?.minPlausibleSeconds === 'number' && overrides.minPlausibleSeconds > 0
      ? overrides.minPlausibleSeconds
      : defaultMinPlausible;

  if (minPlausible > expected) {
    throw new Error(
      `minPlausibleSeconds (${minPlausible}) no puede ser mayor que expectedDurationSeconds (${expected})`,
    );
  }

  return {
    expectedDurationSeconds: expected,
    minPlausibleSeconds: minPlausible,
  };
}
