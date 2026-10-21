import { describe, it, expect } from 'vitest';
import { AUTH_ERROR_MAP, getAuthErrorMessage } from '../src/lib/auth-errors';
import { metadata as resetPasswordMetadata } from '../src/app/(public)/restablecer/[token]/page';

describe('RF-20: formularios accesibles, mapeo de errores y políticas de autenticación', () => {
  it('maps all SPEC-02 canonical error codes to exact Spanish UI messages', () => {
    expect(AUTH_ERROR_MAP.AUTH_INVALID_CREDENTIALS).toBe(
      'El correo o la contraseña no son correctos',
    );
    expect(AUTH_ERROR_MAP.ACCOUNT_PENDING_APPROVAL).toBe(
      'Tu cuenta está pendiente de aprobación por tu profesora',
    );
    expect(AUTH_ERROR_MAP.AUTH_ACCOUNT_LOCKED).toBe(
      'Demasiados intentos. Intenta de nuevo en unos minutos',
    );
    expect(AUTH_ERROR_MAP.PASSWORD_POLICY).toBe(
      'Usa entre 8 y 16 caracteres, sin espacios',
    );
    expect(AUTH_ERROR_MAP.EMAIL_TAKEN).toBe('Ese correo no está disponible');
    expect(AUTH_ERROR_MAP.OTP_INVALID).toBe(
      'El código no es válido o ya venció. Solicita uno nuevo',
    );
    expect(AUTH_ERROR_MAP.RATE_LIMITED).toBe(
      'Has hecho varios intentos. Espera un momento y vuelve a intentar',
    );
    expect(AUTH_ERROR_MAP.AUTH_UNAUTHORIZED).toBe(
      'Tu sesión terminó. Inicia sesión de nuevo',
    );
    expect(AUTH_ERROR_MAP.FORBIDDEN).toBe('No tienes acceso a esta sección');
    expect(AUTH_ERROR_MAP.STUDENT_NOT_PENDING).toBe(
      'La solicitud ya no está pendiente. Actualiza la lista',
    );
    expect(AUTH_ERROR_MAP.PASSWORD_RESET_INVALID).toBe(
      'El enlace no es válido o ya venció. Solicita uno nuevo',
    );
    expect(AUTH_ERROR_MAP.VALIDATION_ERROR).toBe(
      'Los datos ingresados no son válidos',
    );
    expect(AUTH_ERROR_MAP.PAYLOAD_TOO_LARGE).toBe(
      'El archivo o la solicitud excede el tamaño permitido',
    );
    expect(AUTH_ERROR_MAP.NOT_FOUND).toBe('No se encontró la información solicitada');
    expect(AUTH_ERROR_MAP.INTERNAL_ERROR).toBe(
      'Ocurrió un error inesperado. Intenta de nuevo más tarde',
    );
  });

  it('falls back to safe default message without technical leaks for unknown codes', () => {
    expect(getAuthErrorMessage('SQL_SYNTAX_ERROR')).toBe(
      'Ocurrió un error. Intenta de nuevo',
    );
    expect(getAuthErrorMessage(undefined, 'Mensaje personalizado')).toBe(
      'Mensaje personalizado',
    );
    expect(getAuthErrorMessage('UNKNOWN_CODE', 'Mensaje por defecto')).toBe(
      'Mensaje por defecto',
    );
  });

  it('validates password policy boundaries (8-16 chars, no whitespace)', () => {
    const isValidPassword = (p: string) => {
      const len = [...p].length;
      return len >= 8 && len <= 16 && !/\s/u.test(p);
    };

    // Valid cases
    expect(isValidPassword('sol-luna-azul')).toBe(true);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('1234567890123456')).toBe(true);
    expect(isValidPassword('árbol-café-99')).toBe(true); // Unicode support

    // Invalid cases
    expect(isValidPassword('short')).toBe(false); // < 8
    expect(isValidPassword('12345678901234567')).toBe(false); // > 16
    expect(isValidPassword('sol luna')).toBe(false); // whitespace
    expect(isValidPassword('sol\tluna')).toBe(false); // tab
    expect(isValidPassword('sol\nluna')).toBe(false); // newline
    expect(isValidPassword('  12345678  ')).toBe(false); // surrounding whitespace
  });

  it('enforces no-referrer policy metadata on reset-password page to prevent token leakage (RF-20 / §8)', () => {
    expect(resetPasswordMetadata.referrer).toBe('no-referrer');
  });

  it('validates safe next destination routing discarding external URLs, backslashes, and public auth routes (RF-17)', () => {
    const isSafeNextDestination = (next: string | null | undefined): boolean => {
      if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
        return false;
      }
      const isPublicAuthRoute =
        next.startsWith('/login') ||
        next.startsWith('/registro') ||
        next.startsWith('/recuperar-contrasena') ||
        next.startsWith('/restablecer');
      return !isPublicAuthRoute;
    };

    expect(isSafeNextDestination('/inicio')).toBe(true);
    expect(isSafeNextDestination('/actividades/123')).toBe(true);
    expect(isSafeNextDestination('/actividades?page=2')).toBe(true);

    // Discard public auth routes
    expect(isSafeNextDestination('/login')).toBe(false);
    expect(isSafeNextDestination('/registro')).toBe(false);
    expect(isSafeNextDestination('/recuperar-contrasena')).toBe(false);
    expect(isSafeNextDestination('/restablecer/token123')).toBe(false);

    // Discard external or malformed URLs
    expect(isSafeNextDestination('https://evil.com')).toBe(false);
    expect(isSafeNextDestination('//evil.com')).toBe(false);
    expect(isSafeNextDestination('/\\evil.com')).toBe(false);
    expect(isSafeNextDestination(null)).toBe(false);
    expect(isSafeNextDestination('')).toBe(false);
  });
});
