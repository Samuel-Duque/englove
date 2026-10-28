import { IsOptional, IsISO8601, IsIn, IsUUID, IsEnum } from 'class-validator';
import { Level, ActivityType } from '@englove/shared';

export class StatsOverviewQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class StatsGroupQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['30d', '7d'])
  trendMode?: '30d' | '7d';

  @IsOptional()
  @IsIn([
    'studentName',
    'averageScore',
    'activeWeeksInPeriod',
    'currentStreakWeeks',
    'completionRatePercent',
    'timeSpentSeconds',
    'lastActivityAt',
  ])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export class StatsLeaderboardQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;
}

export class StatsStudentQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;
}
