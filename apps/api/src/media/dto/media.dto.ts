import { IsString, IsUUID, IsInt, Min, Max, Matches } from 'class-validator';

export class MediaUploadUrlDto {
  @IsUUID('4', { message: 'attemptId debe ser un UUID v4 válido' })
  attemptId!: string;

  @IsString({ message: 'mimeType debe ser una cadena válida' })
  @Matches(/^audio\/(webm|mp4|ogg)(;codecs=[a-zA-Z0-9.,_-]+)?$/, {
    message: 'mimeType debe ser audio/webm, audio/mp4 o audio/ogg',
  })
  mimeType!: string;

  @IsInt({ message: 'sizeBytes debe ser un número entero' })
  @Min(1, { message: 'sizeBytes debe ser mayor a 0' })
  @Max(10 * 1024 * 1024, { message: 'sizeBytes no puede superar 10 MB' })
  sizeBytes!: number;
}
