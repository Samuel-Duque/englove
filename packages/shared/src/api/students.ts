import { AgeSegment, ApprovalStatus, Level } from '../enums';

export interface StudentView {
  id: string;
  userId: string;
  name: string;
  email: string;
  birthDate: string;
  level: Level | null;
  ageSegment: AgeSegment;
  canSwitchInterface: boolean;
  approvalStatus: ApprovalStatus;
  guardianName: string | null;
  guardianContact: string | null;
  groupId: string | null;
  lockedUntil: string | null;
}

export interface StudentListResponse {
  items: StudentView[];
  total: number;
  offset: number;
  limit: number;
}

export interface ApproveStudentInput {
  level: Level;
  groupId: string;
  birthDate?: string;
  ageSegment?: AgeSegment;
  guardianName?: string;
  guardianContact?: string;
}

export interface UpdateStudentInput {
  name?: string;
  birthDate?: string;
  level?: Level;
  ageSegment?: AgeSegment;
  guardianName?: string;
  guardianContact?: string;
}

export interface StudentListQuery {
  offset?: number;
  limit?: number;
}
