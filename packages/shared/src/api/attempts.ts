import { AttemptStatus } from '../enums';

export interface StartAttemptInput {
  assignmentId: string;
}

export interface SubmitAnswerEventItem {
  itemId: string;
  answer: unknown;
  clientEventId: string;
}

export interface SubmitEventsInput {
  events: SubmitAnswerEventItem[];
}

export interface CompleteAttemptInput {
  clientFinishedNotice?: boolean;
}

export interface AttemptResponse {
  id: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  status: AttemptStatus;
}
