import { z } from 'zod';

export const FeatureFlagsResponseSchema = z
  .object({
    organizationId: z.string().optional(),
    flags: z
      .object({
        games: z.boolean().optional(),
        extra_content: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    config: z
      .object({
        passing_score: z.number().optional(),
        retention_days: z.number().optional(),
        pending_upload_ttl_days: z.number().optional(),
        ungraded_reminder_days: z.number().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type FeatureFlagsResponse = z.infer<typeof FeatureFlagsResponseSchema>;
