import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import {
  LoginInput,
  SignupInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  EmailChangeInput,
  EmailChangeConfirmInput,
} from '@englove/shared';

export class LoginDto implements LoginInput {
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;
}

export class SignupDto implements SignupInput {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento debe tener formato YYYY-MM-DD' })
  birthDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El nombre del acudiente no puede exceder 200 caracteres' })
  guardianName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El contacto del acudiente no puede exceder 200 caracteres' })
  guardianContact?: string | null;

  @IsBoolean({ message: 'acceptTerms debe ser booleano' })
  acceptTerms!: boolean;
}

export class ForgotPasswordDto implements ForgotPasswordInput {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email!: string;
}

export class ResetPasswordDto implements ResetPasswordInput {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio' })
  token!: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  newPassword!: string;
}

export class EmailChangeDto implements EmailChangeInput {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El nuevo correo es obligatorio' })
  newEmail!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  password!: string;
}

export class EmailChangeConfirmDto implements EmailChangeConfirmInput {
  @IsString()
  @IsNotEmpty({ message: 'El código OTP es obligatorio' })
  @Matches(/^\d{6}$/, { message: 'El código OTP debe ser de 6 dígitos numéricos' })
  otp!: string;
}
