import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  IsInt,
  IsUUID,
  IsISO8601,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityType, STICKER_CODES, StickerCode } from '@englove/shared';

export class ReviewQueryDto {
  @IsOptional()
  @IsUUID('4')
  groupId?: string;

  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class SubmitReviewDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  // guardrails-ignore G-C02: calificacion manual exclusiva del profesor en revision
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(STICKER_CODES, { each: true })
  @ArrayMaxSize(3)
  stickers?: StickerCode[];

  @IsOptional()
  @IsBoolean()
  allowRetry?: boolean;

  @IsOptional()
  @IsString()
  retryExtendUntil?: string | null;
}

export class GrantRetryDto {
  @IsOptional()
  @IsString()
  retryExtendUntil?: string | null;
}
