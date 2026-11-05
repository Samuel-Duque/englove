import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  IsString,
  IsOptional,
  Length,
  MaxLength,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsUUID,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { isValidHttpsResourceUrl, Level } from '@englove/shared';

export function IsHttpsResourceUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isHttpsResourceUrl',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: 'URL debe ser válida y usar protocolo https://',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return isValidHttpsResourceUrl(value);
        },
      },
    });
  };
}

export class CreateResourceDto {
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 160, { message: 'El título debe tener entre 1 y 160 caracteres' })
  title!: string;

  @IsString({ message: 'La URL debe ser una cadena de texto' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 2048, { message: 'La URL no debe exceder 2048 caracteres' })
  @IsHttpsResourceUrl()
  url!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La descripción no debe exceder 500 caracteres' })
  description?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsEnum(Level, { message: 'Nivel debe ser A1, A2, B1, B2 o null' })
  level?: Level | null;
}

export class UpdateResourceDto {
  @ValidateIf((_obj, val) => val !== undefined)
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 160, { message: 'El título debe tener entre 1 y 160 caracteres' })
  title?: string;

  @ValidateIf((_obj, val) => val !== undefined)
  @IsString({ message: 'La URL debe ser una cadena de texto' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(1, 2048, { message: 'La URL no debe exceder 2048 caracteres' })
  @IsHttpsResourceUrl()
  url?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La descripción no debe exceder 500 caracteres' })
  description?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsEnum(Level, { message: 'Nivel debe ser A1, A2, B1, B2 o null' })
  level?: Level | null;
}

export class ReorderResourcesDto {
  @IsArray({ message: 'resourceIds debe ser una lista' })
  @ArrayMinSize(1, { message: 'resourceIds debe tener al menos un elemento' })
  @ArrayMaxSize(200, { message: 'resourceIds no puede exceder 200 elementos' })
  @IsUUID('4', { each: true, message: 'Cada ID en resourceIds debe ser un UUID v4 válido' })
  resourceIds!: string[];
}

export class ResourceQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsIn(['A1', 'A2', 'B1', 'B2', 'general'], {
    message: 'level debe ser A1, A2, B1, B2 o general',
  })
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'general';
}
