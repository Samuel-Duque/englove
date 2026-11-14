import { z } from 'zod';
import { AgeSegment, ApprovalStatus, Level } from '../enums';

export const StudentViewSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  name: z.string(),
  email: z.string().optional(),
  birthDate: z.string().optional(),
  level: z.nativeEnum(Level).nullable().optional(),
  ageSegment: z.nativeEnum(AgeSegment).optional(),
  canSwitchInterface: z.boolean().optional(),
  approvalStatus: z.nativeEnum(ApprovalStatus).optional(),
  guardianName: z.string().nullable().optional(),
  guardianContact: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  lockedUntil: z.string().nullable().optional(),
});

export type StudentView = z.infer<typeof StudentViewSchema>;

export const StudentListResponseSchema = z.object({
  items: z.array(StudentViewSchema),
  total: z.number().int().optional().default(0),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type StudentListResponse = z.infer<typeof StudentListResponseSchema>;

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

export interface ChangeStudentEmailInput {
  newEmail: string;
}
