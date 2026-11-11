import { z } from 'zod';

export const RemindersResponseSchema = z.object({
  pendingRegistrations: z.number().int().nonnegative().optional().default(0),
  pendingApprovals: z.number().int().nonnegative().optional().default(0),
  overdueReviews: z.number().int().nonnegative().optional().default(0),
  ungradedReminderDays: z.number().int().nonnegative().optional().default(0),
  thresholdDays: z.number().int().nonnegative().optional().default(0),
});

export type RemindersResponse = z.infer<typeof RemindersResponseSchema>;
