import { z } from 'zod';
import { ActivityType, AgeSegment, GameMechanic, Level } from '../enums';

export const ScoreTrendDirectionSchema = z.enum(['up', 'down', 'stable', 'none']);
export type ScoreTrendDirection = z.infer<typeof ScoreTrendDirectionSchema>;

export const TrendComparisonModeSchema = z.enum(['30d', '7d']);
export type TrendComparisonMode = z.infer<typeof TrendComparisonModeSchema>;

export const WeekCalendarStatusSchema = z.enum(['active', 'forgiven', 'inactive', 'current_pending']);
export type WeekCalendarStatus = z.infer<typeof WeekCalendarStatusSchema>;

export const ScoreTrendComparisonSchema = z.object({
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  currentAverageScore: z.number().nullable().optional(),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  previousAverageScore: z.number().nullable().optional(),
  delta: z.number().nullable().optional(),
  direction: ScoreTrendDirectionSchema.optional().default('none'),
});

export type ScoreTrendComparison = z.infer<typeof ScoreTrendComparisonSchema>;

export const LevelStatsSummarySchema = z.object({
  level: z.nativeEnum(Level),
  studentCount: z.number().int().optional().default(0),
  activeStudentCount: z.number().int().optional().default(0),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  averageScore: z.number().nullable().optional(),
  assignedCount: z.number().int().optional().default(0),
  completedAssignedCount: z.number().int().optional().default(0),
  completionRatePercent: z.number().nullable().optional(),
  timeSpentSeconds: z.number().int().optional().default(0),
});

export type LevelStatsSummary = z.infer<typeof LevelStatsSummarySchema>;

export const GroupStatsSummarySchema = z.object({
  groupId: z.string().optional().default(''),
  groupName: z.string().optional().default(''),
  studentCount: z.number().int().optional().default(0),
  activeStudentCount: z.number().int().optional().default(0),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  averageScore: z.number().nullable().optional(),
  assignedCount: z.number().int().optional().default(0),
  completedAssignedCount: z.number().int().optional().default(0),
  completionRatePercent: z.number().nullable().optional(),
  timeSpentSeconds: z.number().int().optional().default(0),
  totalTimeSpentSeconds: z.number().int().optional(),
}).transform((s) => ({
  ...s,
  timeSpentSeconds: s.timeSpentSeconds || s.totalTimeSpentSeconds || 0,
}));

export type GroupStatsSummary = z.infer<typeof GroupStatsSummarySchema>;

export const InactiveStudentAlertSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  level: z.nativeEnum(Level),
  ageSegment: z.nativeEnum(AgeSegment),
  groupId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  // guardrails-ignore G-C03: timestamp de solo lectura devuelto por el servidor al profesor (SPEC-09 §5)
  lastActivityAt: z.string().nullable().optional(),
  daysSinceLastActivity: z.number().int().nullable().optional(),
});

export type InactiveStudentAlert = z.infer<typeof InactiveStudentAlertSchema>;

export const StatsOverviewResponseSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }).optional(),
  organizationSummary: z.object({
    totalApprovedStudents: z.number().int().optional().default(0),
    activeStudentsInPeriod: z.number().int().optional().default(0),
    // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
    averageScore: z.number().nullable().optional(),
    completionRatePercent: z.number().nullable().optional(),
    totalTimeSpentSeconds: z.number().int().optional().default(0),
    inactiveAlertsCount: z.number().int().optional().default(0),
  }),
  byLevel: z.array(LevelStatsSummarySchema).optional().default([]),
  byGroup: z.array(GroupStatsSummarySchema).optional().default([]),
  inactiveAlerts: z.array(InactiveStudentAlertSchema).optional().default([]),
});

export type StatsOverviewResponse = z.infer<typeof StatsOverviewResponseSchema>;

export const TimeBucketItemSchema = z.object({
  bucketKey: z.string().optional().default(''),
  timeSpentSeconds: z.number().int().optional().default(0),
  completedCount: z.number().int().optional().default(0),
});

export type TimeBucketItem = z.infer<typeof TimeBucketItemSchema>;

export const GamePracticeSessionItemSchema = z.object({
  attemptId: z.string(),
  activityId: z.string(),
  activityTitle: z.string(),
  mechanic: z.nativeEnum(GameMechanic),
  level: z.nativeEnum(Level),
  stars: z.number().int().optional().default(0),
  durationSeconds: z.number().int().optional().default(0),
  playedAtBogota: z.string().optional().default(''),
  // guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros
  implausibleDuration: z.boolean().optional().default(false),
});

export type GamePracticeSessionItem = z.infer<typeof GamePracticeSessionItemSchema>;

export const GamesPracticeSummarySchema = z.object({
  totalSessions: z.number().int().optional().default(0),
  uniqueGamesPlayed: z.number().int().optional().default(0),
  totalPracticeTimeSeconds: z.number().int().optional().default(0),
  byMechanic: z.array(
    z.object({
      mechanic: z.nativeEnum(GameMechanic),
      sessionsCount: z.number().int().optional().default(0),
      uniqueGamesCount: z.number().int().optional().default(0),
      practiceTimeSeconds: z.number().int().optional().default(0),
    }),
  ).optional().default([]),
  dailySummary: z.array(TimeBucketItemSchema).optional().default([]),
  weeklySummary: z.array(TimeBucketItemSchema).optional().default([]),
  sessions: z.array(GamePracticeSessionItemSchema).optional(),
});

export type GamesPracticeSummary = z.infer<typeof GamesPracticeSummarySchema>;

export const GroupStudentStatsRowSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  level: z.nativeEnum(Level),
  ageSegment: z.nativeEnum(AgeSegment),
  isCurrentMember: z.boolean().optional().default(true),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  averageScore: z.number().nullable().optional(),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  previousAverageScore: z.number().nullable().optional(),
  scoreTrendDelta: z.number().nullable().optional(),
  scoreTrend: ScoreTrendDirectionSchema.optional().default('none'),
  trend30d: ScoreTrendComparisonSchema.optional(),
  trend7d: ScoreTrendComparisonSchema.optional(),
  activeWeeksInPeriod: z.number().int().optional().default(0),
  currentStreakWeeks: z.number().int().optional().default(0),
  streakWeeks: z.number().int().optional(),
  forgivenessAvailable: z.boolean().optional().default(false),
  assignedCount: z.number().int().optional().default(0),
  completedAssignedCount: z.number().int().optional().default(0),
  completionRatePercent: z.number().nullable().optional(),
  timeSpentSeconds: z.number().int().optional().default(0),
  totalTimeSpentSeconds: z.number().int().optional(),
  // guardrails-ignore G-C03: timestamp de solo lectura devuelto por el servidor al profesor (SPEC-09 §5)
  lastActivityAt: z.string().nullable().optional(),
}).transform((row) => ({
  ...row,
  currentStreakWeeks: row.currentStreakWeeks || row.streakWeeks || 0,
  timeSpentSeconds: row.timeSpentSeconds || row.totalTimeSpentSeconds || 0,
  trend30d: row.trend30d ?? {
    currentAverageScore: row.averageScore ?? null,
    previousAverageScore: row.previousAverageScore ?? null,
    delta: row.scoreTrendDelta ?? null,
    direction: row.scoreTrend,
  },
  trend7d: row.trend7d ?? {
    currentAverageScore: row.averageScore ?? null,
    previousAverageScore: row.previousAverageScore ?? null,
    delta: row.scoreTrendDelta ?? null,
    direction: row.scoreTrend,
  },
}));

export type GroupStudentStatsRow = z.infer<typeof GroupStudentStatsRowSchema>;

export const GroupStatsResponseSchema = z.object({
  group: z.object({ id: z.string(), name: z.string(), level: z.string().optional() }),
  period: z.object({
    from: z.string(),
    to: z.string(),
    previousFrom: z.string().optional(),
    previousTo: z.string().optional(),
  }).optional(),
  trendMode: TrendComparisonModeSchema.optional().default('30d'),
  summary: GroupStatsSummarySchema,
  students: z.array(GroupStudentStatsRowSchema).optional().default([]),
  gamesPractice: GamesPracticeSummarySchema.optional(),
});

export type GroupStatsResponse = z.infer<typeof GroupStatsResponseSchema>;

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().optional().default(1),
  studentId: z.string(),
  studentName: z.string(),
  level: z.nativeEnum(Level).optional().default(Level.A1),
  ageSegment: z.nativeEnum(AgeSegment).optional().default(AgeSegment.kids),
  groupId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  averageScore: z.number().nullable(),
  completedActivitiesCount: z.number().int().optional().default(0),
  currentStreakWeeks: z.number().int().optional().default(0),
  badgesCount: z.number().int().optional().default(0),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardResponseSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }).optional(),
  filters: z.object({
    groupId: z.string().nullable().optional(),
    level: z.nativeEnum(Level).nullable().optional(),
  }).optional(),
  entries: z.array(LeaderboardEntrySchema).optional().default([]),
});

export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const StudentScorePointSchema = z.object({
  attemptId: z.string().optional(),
  assignmentId: z.string().optional(),
  activityId: z.string().optional(),
  activityTitle: z.string().optional().default(''),
  activityType: z.nativeEnum(ActivityType).optional().default(ActivityType.fill_blank),
  gameMechanic: z.nativeEnum(GameMechanic).nullable().optional(),
  level: z.nativeEnum(Level).optional().default(Level.A1),
  attemptNumber: z.number().int().optional().default(1),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  score: z.number().optional().default(0),
  passed: z.boolean().optional().default(false),
  // guardrails-ignore G-C03: timestamp de solo lectura devuelto por el servidor al profesor (SPEC-09 §5)
  gradedAt: z.string().optional().default(''),
  usedExtendedDeadline: z.boolean().optional().default(false),
  // guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros
  implausibleDuration: z.boolean().optional().default(false),
});

export type StudentScorePoint = z.infer<typeof StudentScorePointSchema>;

export const StudentTypeBreakdownSchema = z.object({
  type: z.nativeEnum(ActivityType),
  gradedCount: z.number().int().optional().default(0),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  averageScore: z.number().nullable().optional(),
  passedCount: z.number().int().optional().default(0),
  needsImprovementCount: z.number().int().optional().default(0),
});

export type StudentTypeBreakdown = z.infer<typeof StudentTypeBreakdownSchema>;

export const StudentGameMechanicBreakdownSchema = z.object({
  mechanic: z.nativeEnum(GameMechanic),
  attemptsCount: z.number().int().optional().default(0),
  uniqueGamesCount: z.number().int().optional().default(0),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  averageScore: z.number().nullable().optional(),
});

export type StudentGameMechanicBreakdown = z.infer<typeof StudentGameMechanicBreakdownSchema>;

export const StudentLevelBreakdownSchema = z.object({
  level: z.nativeEnum(Level),
  gradedCount: z.number().int().optional().default(0),
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  averageScore: z.number().nullable().optional(),
});

export type StudentLevelBreakdown = z.infer<typeof StudentLevelBreakdownSchema>;

export const StudentWeekCalendarItemSchema = z.object({
  weekKey: z.string().optional().default(''),
  weekStart: z.string().optional().default(''),
  status: WeekCalendarStatusSchema.optional().default('current_pending'),
  completedCount: z.number().int().optional().default(0),
});

export type StudentWeekCalendarItem = z.infer<typeof StudentWeekCalendarItemSchema>;

export const StudentOfflineUndeliveredAttemptSchema = z.object({
  attemptId: z.string(),
  assignmentId: z.string().nullable().optional(),
  activityTitle: z.string().optional().default(''),
  activityType: z.nativeEnum(ActivityType).optional().default(ActivityType.fill_blank),
  // guardrails-ignore G-C03: timestamp de solo lectura devuelto por el servidor al profesor (SPEC-09 §5)
  startedAt: z.string().optional().default(''),
  // guardrails-ignore G-C03: timestamp de solo lectura devuelto por el servidor al profesor (SPEC-09 §5)
  completeUntil: z.string().optional().default(''),
});

export type StudentOfflineUndeliveredAttempt = z.infer<typeof StudentOfflineUndeliveredAttemptSchema>;

export const StudentStatsResponseSchema = z.object({
  student: z.object({
    id: z.string(),
    name: z.string(),
    level: z.nativeEnum(Level).optional().default(Level.A1),
    ageSegment: z.nativeEnum(AgeSegment).optional().default(AgeSegment.kids),
    groupId: z.string().nullable().optional(),
    groupName: z.string().nullable().optional(),
    // guardrails-ignore G-C03: timestamp de solo lectura devuelto por el servidor al profesor (SPEC-09 §5)
    joinedAt: z.string().optional().default(''),
  }),
  period: z.object({ from: z.string().optional(), to: z.string().optional() }).optional(),
  filters: z.object({
    type: z.nativeEnum(ActivityType).nullable().optional(),
    level: z.nativeEnum(Level).nullable().optional(),
  }).optional(),
  performance: z.object({
    // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
    passingScore: z.number().optional().default(3.0),
    // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
    studentAverageScore: z.number().nullable().optional(),
    // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
    groupAverageScore: z.number().nullable().optional(),
    totalGradedActivities: z.number().int().optional().default(0),
    passedCount: z.number().int().optional().default(0),
    needsImprovementCount: z.number().int().optional().default(0),
    passRatePercent: z.number().nullable().optional(),
    scoreSeries: z.array(StudentScorePointSchema).optional().default([]),
    byActivityType: z.array(StudentTypeBreakdownSchema).optional().default([]),
    byGameMechanic: z.array(StudentGameMechanicBreakdownSchema).optional().default([]),
    byLevel: z.array(StudentLevelBreakdownSchema).optional().default([]),
  }),
  consistency: z.object({
    currentStreakWeeks: z.number().int().optional().default(0),
    bestStreakWeeks: z.number().int().optional().default(0),
    forgivenessAvailable: z.boolean().optional().default(false),
    activeWeeksInPeriod: z.number().int().optional().default(0),
    completedActivitiesInPeriod: z.number().int().optional().default(0),
    assignedCount: z.number().int().optional().default(0),
    completedAssignedCount: z.number().int().optional().default(0),
    completionRatePercent: z.number().nullable().optional(),
    totalTimeSpentSeconds: z.number().int().optional().default(0),
    weeklyCalendar: z.array(StudentWeekCalendarItemSchema).optional().default([]),
    dailyTime: z.array(TimeBucketItemSchema).optional().default([]),
    weeklyTime: z.array(TimeBucketItemSchema).optional().default([]),
    monthlyTime: z.array(TimeBucketItemSchema).optional().default([]),
    offlineUndeliveredAttempts: z.array(StudentOfflineUndeliveredAttemptSchema).optional().default([]),
  }),
  gamesPractice: GamesPracticeSummarySchema.optional(),
});

export type StudentStatsResponse = z.infer<typeof StudentStatsResponseSchema>;

export const GamesLeaderboardItemSchema = z.object({
  rank: z.number().int().optional().default(1),
  studentId: z.string(),
  studentName: z.string(),
  groupId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  level: z.nativeEnum(Level).optional().default(Level.A1),
  gamePoints: z.number().int().optional().default(0),
  totalStars: z.number().int().optional().default(0),
  gamesPlayedCount: z.number().int().optional().default(0),
  uniqueGamesPlayed: z.number().int().optional().default(0),
  practiceTimeSeconds: z.number().int().optional().default(0),
  // guardrails-ignore G-C03: timestamp de solo lectura devuelto por el servidor al profesor (SPEC-09 §5)
  lastPlayedAt: z.string().nullable().optional(),
});

export type GamesLeaderboardItem = z.infer<typeof GamesLeaderboardItemSchema>;

export const GamesLeaderboardResponseSchema = z.object({
  period: z.object({ from: z.string().optional(), to: z.string().optional() }).optional(),
  filters: z.object({
    groupId: z.string().nullable().optional(),
    level: z.nativeEnum(Level).nullable().optional(),
  }).optional(),
  items: z.array(GamesLeaderboardItemSchema).optional().default([]),
});

export type GamesLeaderboardResponse = z.infer<typeof GamesLeaderboardResponseSchema>;
