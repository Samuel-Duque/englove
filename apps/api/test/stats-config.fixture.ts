import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';

export function mockStatsConfiguration(passingScore = 3): FeatureFlagsService {
  return {
    getConfiguration: async () => ({
      flags: { games: false, extra_content: false },
      config: { passing_score: passingScore, retention_days: 30, pending_upload_ttl_days: 7, ungraded_reminder_days: 3 },
    }),
  } as unknown as FeatureFlagsService;
}
