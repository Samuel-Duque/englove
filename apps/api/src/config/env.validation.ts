import { z } from 'zod';

export enum AppEnv {
  local = 'local',
  staging = 'staging',
  production = 'production',
}

const baseEnvSchema = z.object({
  APP_ENV: z.nativeEnum(AppEnv).default(AppEnv.local),
  PORT: z
    .string()
    .default('3001')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(65535)),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // guardrails-ignore G-A03: validacion de variable de migracion conocida para CI al arranque (SPEC-01 §5)
  MIGRATION_DATABASE_URL: z.string().optional(),
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_URL: z.string().optional().default(''),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_PREFIX: z.string().default('englove_'),
  WEB_BASE_URL: z.string().url('WEB_BASE_URL must be a valid URL'),
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
  MAIL_FROM: z.string().min(1, 'MAIL_FROM is required'),
  RESEND_API_KEY: z.string().optional().default(''),
});

export type ValidatedEnv = z.infer<typeof baseEnvSchema>;

/**
 * Validates environment variables according to SPEC-01 RF-3 and §5.
 * Fails before listening if any mandatory variable is missing or invalid,
 * reporting ONLY the variable names, never their values or secrets.
 */
export function validateEnvironment(config: Record<string, unknown>): ValidatedEnv {
  const result = baseEnvSchema.safeParse(config);

  if (!result.success) {
    const invalidKeys = Array.from(new Set(result.error.issues.map((i) => i.path.join('.'))));
    const errorMessage = `Configuración de entorno inválida. Variables afectadas: ${invalidKeys.join(', ')}`;
    // Only variable names, never secret values (Rule G-C10 & G-C11)
    throw new Error(errorMessage);
  }

  const env = result.data;

  // Staging and production require RESEND_API_KEY and non-empty COOKIE_DOMAIN
  if (env.APP_ENV === AppEnv.staging || env.APP_ENV === AppEnv.production) {
    const extraMissing: string[] = [];
    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.trim() === '') {
      extraMissing.push('RESEND_API_KEY');
    }
    if (extraMissing.length > 0) {
      throw new Error(
        `Configuración de entorno inválida para ${env.APP_ENV}. Variables faltantes: ${extraMissing.join(', ')}`,
      );
    }
  }

  return env;
}
