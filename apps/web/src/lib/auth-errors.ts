export const AUTH_ERROR_MAP: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'El correo o la contraseña no son correctos',
  ACCOUNT_PENDING_APPROVAL: 'Tu cuenta está pendiente de aprobación por tu profesora',
  AUTH_ACCOUNT_LOCKED: 'Demasiados intentos. Intenta de nuevo en unos minutos',
  PASSWORD_POLICY: 'Usa entre 8 y 16 caracteres, sin espacios',
  EMAIL_TAKEN: 'Ese correo no está disponible',
  OTP_INVALID: 'El código no es válido o ya venció. Solicita uno nuevo',
  RATE_LIMITED: 'Has hecho varios intentos. Espera un momento y vuelve a intentar',
  AUTH_UNAUTHORIZED: 'Tu sesión terminó. Inicia sesión de nuevo',
  FORBIDDEN: 'No tienes acceso a esta sección',
  STUDENT_NOT_PENDING: 'La solicitud ya no está pendiente. Actualiza la lista',
  PASSWORD_RESET_INVALID: 'El enlace no es válido o ya venció. Solicita uno nuevo',
  VALIDATION_ERROR: 'Los datos ingresados no son válidos',
  PAYLOAD_TOO_LARGE: 'El archivo o la solicitud excede el tamaño permitido',
  NOT_FOUND: 'No se encontró la información solicitada',
  INTERNAL_ERROR: 'Ocurrió un error inesperado. Intenta de nuevo más tarde',
};

export function getAuthErrorMessage(code?: string, defaultMessage = 'Ocurrió un error. Intenta de nuevo'): string {
  if (!code) {
    return defaultMessage;
  }
  return AUTH_ERROR_MAP[code] || defaultMessage;
}
