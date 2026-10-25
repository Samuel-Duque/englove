import { AttemptStatus } from './enums';

/**
 * ActivityEvent represents events emitted locally by the activity runtime.
 * Note: the `at` timestamp is strictly internal to client-side ordering and offline queue.
 * It is never sent in HTTP API DTOs (Decision 34 §3, Rule G-C03).
 */
export type ActivityEvent =
  | { type: 'started'; at: string }
  | {
      type: 'answered';
      at: string;
      itemId: string;
      answer: unknown;
      clientEventId: string;
    }
  | { type: 'completed'; at: string };

/**
 * Properties supplied to any activity component rendered on the student portal or preview.
 */
export interface ActivityRuntimeProps<TConfig = unknown, TAnswer = unknown> {
  config: TConfig;
  initialState?: TAnswer;
  theme?: 'kids' | 'teens';
  soundEnabled?: boolean;
  previewMode?: boolean;
  attemptToken?: string;
  onEvent?: (event: ActivityEvent | { itemId: string; answer: unknown }) => void;
  onComplete?: (answer: TAnswer) => void;
}

/**
 * Summary result returned when completing an attempt.
 */
export interface AttemptResult {
  attemptId: string;
  status: AttemptStatus;
  score?: number | null;
}
