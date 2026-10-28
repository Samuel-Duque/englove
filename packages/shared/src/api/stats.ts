import { ActivityType, AgeSegment, GameMechanic, Level } from '../enums';

export type ScoreTrendDirection = 'up' | 'down' | 'stable' | 'none';
export type TrendComparisonMode = '30d' | '7d';
export type WeekCalendarStatus = 'active' | 'forgiven' | 'inactive' | 'current_pending';

export interface ScoreTrendComparison {
  currentAverageScore: number | null;
  previousAverageScore: number | null;
  delta: number | null;
  direction: ScoreTrendDirection;
}

export interface LevelStatsSummary {
  level: Level;
  studentCount: number;
  activeStudentCount: number;
  averageScore: number | null;
  assignedCount: number;
  completedAssignedCount: number;
  completionRatePercent: number | null;
  timeSpentSeconds: number;
}

export interface GroupStatsSummary {
  groupId: string;
  groupName: string;
  studentCount: number;
  activeStudentCount: number;
  averageScore: number | null;
  assignedCount: number;
  completedAssignedCount: number;
  completionRatePercent: number | null;
  timeSpentSeconds: number;
}

export interface InactiveStudentAlert {
  studentId: string;
  studentName: string;
  level: Level;
  ageSegment: AgeSegment;
  groupId: string | null;
  groupName: string | null;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
}

export interface StatsOverviewResponse {
  period: { from: string; to: string };
  organizationSummary: {
    totalApprovedStudents: number;
    activeStudentsInPeriod: number;
    averageScore: number | null;
    completionRatePercent: number | null;
    totalTimeSpentSeconds: number;
    inactiveAlertsCount: number;
  };
  byLevel: LevelStatsSummary[];
  byGroup: GroupStatsSummary[];
  inactiveAlerts: InactiveStudentAlert[];
}

export interface GroupStudentStatsRow {
  studentId: string;
  studentName: string;
  level: Level;
  ageSegment: AgeSegment;
  isCurrentMember: boolean;
  averageScore: number | null;
  previousAverageScore: number | null;
  scoreTrendDelta: number | null;
  scoreTrend: ScoreTrendDirection;
  trend30d: ScoreTrendComparison;
  trend7d: ScoreTrendComparison;
  activeWeeksInPeriod: number;
  currentStreakWeeks: number;
  forgivenessAvailable: boolean;
  assignedCount: number;
  completedAssignedCount: number;
  completionRatePercent: number | null;
  timeSpentSeconds: number;
  lastActivityAt: string | null;
}

export interface GroupStatsResponse {
  group: { id: string; name: string };
  period: { from: string; to: string; previousFrom: string; previousTo: string };
  trendMode: TrendComparisonMode;
  summary: GroupStatsSummary;
  students: GroupStudentStatsRow[];
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  level: Level;
  ageSegment: AgeSegment;
  groupId: string | null;
  groupName: string | null;
  averageScore: number | null;
  completedActivitiesCount: number;
  currentStreakWeeks: number;
  badgesCount: number;
}

export interface LeaderboardResponse {
  period: { from: string; to: string };
  filters: { groupId: string | null; level: Level | null };
  entries: LeaderboardEntry[];
}

export interface StudentScorePoint {
  attemptId: string;
  assignmentId: string;
  activityId: string;
  activityTitle: string;
  activityType: ActivityType;
  gameMechanic: GameMechanic | null;
  level: Level;
  attemptNumber: number;
  // guardrails-ignore G-C02: campo de solo lectura en respuesta del servidor al profesor
  score: number;
  passed: boolean;
  gradedAt: string;
  usedExtendedDeadline: boolean;
  // guardrails-ignore G-C06: bandera de duracion calculada en servidor, no telemetria de terceros
  implausibleDuration: boolean;
}

export interface StudentTypeBreakdown {
  type: ActivityType;
  gradedCount: number;
  averageScore: number | null;
  passedCount: number;
  needsImprovementCount: number;
}

export interface StudentGameMechanicBreakdown {
  mechanic: GameMechanic;
  attemptsCount: number;
  uniqueGamesCount: number;
  averageScore: number | null;
}

export interface StudentLevelBreakdown {
  level: Level;
  gradedCount: number;
  averageScore: number | null;
}

export interface StudentWeekCalendarItem {
  weekKey: string;
  weekStart: string;
  status: WeekCalendarStatus;
  completedCount: number;
}

export interface TimeBucketItem {
  bucketKey: string;
  timeSpentSeconds: number;
  completedCount: number;
}

export interface StudentStatsResponse {
  student: {
    id: string;
    name: string;
    level: Level;
    ageSegment: AgeSegment;
    groupId: string | null;
    groupName: string | null;
    joinedAt: string;
  };
  period: { from: string; to: string };
  filters: { type: ActivityType | null; level: Level | null };
  performance: {
    passingScore: number;
    studentAverageScore: number | null;
    groupAverageScore: number | null;
    totalGradedActivities: number;
    passedCount: number;
    needsImprovementCount: number;
    passRatePercent: number | null;
    scoreSeries: StudentScorePoint[];
    byActivityType: StudentTypeBreakdown[];
    byGameMechanic: StudentGameMechanicBreakdown[];
    byLevel: StudentLevelBreakdown[];
  };
  consistency: {
    currentStreakWeeks: number;
    bestStreakWeeks: number;
    forgivenessAvailable: boolean;
    activeWeeksInPeriod: number;
    completedActivitiesInPeriod: number;
    assignedCount: number;
    completedAssignedCount: number;
    completionRatePercent: number | null;
    totalTimeSpentSeconds: number;
    weeklyCalendar: StudentWeekCalendarItem[];
    dailyTime: TimeBucketItem[];
    weeklyTime: TimeBucketItem[];
    monthlyTime: TimeBucketItem[];
  };
}
