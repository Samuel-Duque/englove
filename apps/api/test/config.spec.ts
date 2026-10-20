import { describe, it, expect } from 'vitest';
import { validateEnvironment, AppEnv } from '../src/config/env.validation';

describe('RF-3: arranque rechaza variables inválidas sin revelar secretos', () => {
  const baseValidLocalConfig = {
    APP_ENV: 'local',
    PORT: '3001',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/englove_dev?schema=public',
    R2_ACCOUNT_ID: 'fake_r2_account_id',
    R2_ACCESS_KEY_ID: 'fake_r2_access_key',
    R2_SECRET_ACCESS_KEY: 'fake_r2_secret_key',
    R2_BUCKET_NAME: 'englove-dev',
    WEB_BASE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: 'http://localhost:3001',
    MAIL_FROM: 'Englove <notificaciones@englove.org>',
  };

  it('validates a correct local configuration without requiring RESEND_API_KEY', () => {
    const env = validateEnvironment(baseValidLocalConfig);
    expect(env.APP_ENV).toBe(AppEnv.local);
    expect(env.PORT).toBe(3001);
    expect(env.COOKIE_PREFIX).toBe('englove_');
  });

  it('requires RESEND_API_KEY in staging or production', () => {
    const stagingConfig = {
      ...baseValidLocalConfig,
      APP_ENV: 'staging',
      COOKIE_DOMAIN: '.englove.org',
    };

    expect(() => validateEnvironment(stagingConfig)).toThrowError(
      /Configuración de entorno inválida para staging\. Variables faltantes: RESEND_API_KEY/,
    );

    const validStagingConfig = {
      ...stagingConfig,
      RESEND_API_KEY: 're_test_key_placeholder',
    };
    const env = validateEnvironment(validStagingConfig);
    expect(env.APP_ENV).toBe(AppEnv.staging);
  });

  it('rejects missing mandatory variables and reports ONLY variable names, never values', () => {
    const invalidConfig = {
      APP_ENV: 'local',
      // Missing DATABASE_URL, R2_*
      R2_ACCESS_KEY_ID: 'sensitive_secret_val',
      WEB_BASE_URL: 'not-a-valid-url',
    };

    let caughtError: Error | null = null;
    try {
      validateEnvironment(invalidConfig);
    } catch (err) {
      caughtError = err as Error;
    }

    expect(caughtError).not.toBeNull();
    const msg = caughtError?.message ?? '';
    expect(msg).toContain('DATABASE_URL');
    expect(msg).toContain('WEB_BASE_URL');
    // Security check: sensitive_secret_val must NEVER be included in the error message
    expect(msg).not.toContain('sensitive_secret_val');
  });

  it('validates port range between 1 and 65535', () => {
    expect(() =>
      validateEnvironment({
        ...baseValidLocalConfig,
        PORT: '999999',
      }),
    ).toThrowError(/PORT/);

    expect(() =>
      validateEnvironment({
        ...baseValidLocalConfig,
        PORT: '-1',
      }),
    ).toThrowError(/PORT/);
  });
});
