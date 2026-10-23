import {
  IsString,
  IsDefined,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsOptional,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitAnswerEventDto {
  @IsString({ message: 'itemId debe ser una cadena válida' })
  itemId!: string;

  @IsDefined({ message: 'answer es obligatorio' })
  answer!: unknown;

  @IsString({ message: 'clientEventId debe ser una cadena válida' })
  clientEventId!: string;
}

export class SubmitEventsDto {
  @IsArray({ message: 'events debe ser una lista' })
  @ArrayMinSize(1, { message: 'El lote de eventos no puede estar vacío' })
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerEventDto)
  events!: SubmitAnswerEventDto[];
}

export class CompleteAttemptDto {
  @IsOptional()
  @IsUUID('4', { message: 'mediaId debe ser un UUID v4 válido' })
  mediaId?: string;
}

export class AssignmentCardQueryDto {
  @IsOptional()
  @IsIn(['available', 'continuity'], {
    message: "scope debe ser 'available' o 'continuity'",
  })
  scope?: 'available' | 'continuity' = 'available';

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset debe ser un entero' })
  @Min(0, { message: 'offset no puede ser negativo' })
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(100, { message: 'limit no puede superar 100' })
  limit?: number = 20;
}
