import {
  IsEnum,
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Level,
  AgeSegment,
  ApproveStudentInput,
  UpdateStudentInput,
  StudentListQuery,
} from '@englove/shared';

export class ApproveStudentDto implements ApproveStudentInput {
  @IsEnum(Level, { message: 'El nivel debe ser A1, A2, B1 o B2' })
  level!: Level;

  @IsUUID('4', { message: 'groupId debe ser un UUID válido' })
  groupId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsEnum(AgeSegment, { message: 'El segmento debe ser kids o teens' })
  ageSegment?: AgeSegment;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El nombre del acudiente no puede exceder 200 caracteres' })
  guardianName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El contacto del acudiente no puede exceder 200 caracteres' })
  guardianContact?: string;
}

export class UpdateStudentDto implements UpdateStudentInput {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsEnum(Level, { message: 'El nivel debe ser A1, A2, B1 o B2' })
  level?: Level;

  @IsOptional()
  @IsEnum(AgeSegment, { message: 'El segmento debe ser kids o teens' })
  ageSegment?: AgeSegment;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El nombre del acudiente no puede exceder 200 caracteres' })
  guardianName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El contacto del acudiente no puede exceder 200 caracteres' })
  guardianContact?: string;
}

export class StudentQueryDto implements StudentListQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un entero' })
  @Min(0, { message: 'offset debe ser mayor o igual a 0' })
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser como mínimo 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number = 20;
}
