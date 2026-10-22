import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityStatus, ActivityType, Level } from '@englove/shared';

export class CreateActivityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsEnum(Level)
  level!: Level;

  @IsDefined()
  config!: unknown;

  @IsOptional()
  answerKey?: unknown;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  expectedDurationSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  minPlausibleSeconds?: number | null;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  answerKey?: unknown;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  expectedDurationSeconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  minPlausibleSeconds?: number | null;
}

export class ActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(Level)
  level?: Level;

  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;
}
