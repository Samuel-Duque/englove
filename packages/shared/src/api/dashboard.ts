import { z } from 'zod';

export const RemindersResponseSchema = z.object({
  pendingRegistrations: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative().optional(),
  overdueReviews: z.number().int().nonnegative(),
  ungradedReminderDays: z.number().int().nonnegative(),
  thresholdDays: z.number().int().nonnegative().optional(),
});

export type RemindersResponse = z.infer<typeof RemindersResponseSchema>;
