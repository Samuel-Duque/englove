import {
  registerDecorator,
  ValidationOptions,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssignmentAvailability } from '@englove/shared';

export function isValidIsoWithTimezone(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) return false;

  const yearStr = match[1];
  const monthStr = match[2];
  const dayStr = match[3];
  const hourStr = match[4];
  const minuteStr = match[5];
  const secondStr = match[6];
  if (!yearStr || !monthStr || !dayStr || !hourStr || !minuteStr) return false;

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const second = secondStr ? parseInt(secondStr, 10) : 0;

  if (month < 1 || month > 12) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDays = daysInMonth[month - 1];
  if (maxDays === undefined || day < 1 || day > maxDays) return false;

  const tzStr = match[match.length - 1];
  if (tzStr && tzStr !== 'Z') {
    const tzMatch = tzStr.match(/^([+-])(\d{2}):(\d{2})$/);
    if (tzMatch) {
      const tzHours = parseInt(tzMatch[2]!, 10);
      const tzMinutes = parseInt(tzMatch[3]!, 10);
      if (tzHours > 14 || tzMinutes > 59) return false;
    }
  }

  const date = new Date(value);
  return !isNaN(date.getTime());
}

export function IsIsoWithTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIsoWithTimezone',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: 'Revisa la fecha y la hora',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return isValidIsoWithTimezone(value);
        },
      },
    });
  };
}

export function ArrayUniqueValues(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'arrayUniqueValues',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: 'Selecciona cada grupo una sola vez',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (!Array.isArray(value)) return false;
          return new Set(value).size === value.length;
        },
      },
    });
  };
}

export class CreateAssignmentDto {
  @IsUUID()
  activityId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  @ArrayUniqueValues()
  groupIds!: string[];

  @IsIsoWithTimezone()
  opensAt!: string;

  @IsIsoWithTimezone()
  dueAt!: string;
}

export class AssignmentQueryDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsEnum(AssignmentAvailability)
  availability?: AssignmentAvailability;

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
}
