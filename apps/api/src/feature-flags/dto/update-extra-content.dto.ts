import { IsBoolean } from 'class-validator';

export class UpdateExtraContentDto {
  @IsBoolean({ message: 'enabled debe ser un valor booleano' })
  enabled!: boolean;
}
