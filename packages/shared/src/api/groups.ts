import { z } from 'zod';

export const GroupViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  archivedAt: z.string().nullable().optional(),
  activeStudentCount: z.number().int().nonnegative().default(0),
});

export type GroupView = z.infer<typeof GroupViewSchema>;

export const GroupListResponseSchema = z.object({
  items: z.array(GroupViewSchema),
  total: z.number().int(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type GroupListResponse = z.infer<typeof GroupListResponseSchema>;

export interface GroupListQuery {
  offset?: number;
  limit?: number;
  archived?: boolean;
}

export interface CreateGroupInput {
  name: string;
}

export interface UpdateGroupInput {
  name: string;
}

export const MembershipViewSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  joinedAt: z.string(),
  // guardrails-ignore G-C03: timestamps de solo lectura devueltos por el servidor
  leftAt: z.string().nullable(),
});

export type MembershipView = z.infer<typeof MembershipViewSchema>;

export const MembershipListResponseSchema = z.object({
  items: z.array(MembershipViewSchema),
  total: z.number().int(),
  offset: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type MembershipListResponse = z.infer<typeof MembershipListResponseSchema>;

export interface TransferStudentGroupInput {
  groupId: string;
}
