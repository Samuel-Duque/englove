import React from 'react';

export type ErrorVariant = 'kids' | 'teens' | 'teacher';

export interface ErrorStateProps {
  code?: string | number;
  message?: string;
  variant?: ErrorVariant;
  onRetry?: () => void;
  onBack?: () => void;
}

export function getErrorMessage(code?: string | number, variant: ErrorVariant = 'kids'): string {
  const codeStr = String(code || '').toUpperCase();

  // ATTEMPT_CLOSED uses exact canonical text across all audiences (Architecture §3.6)
  if (codeStr === 'ATTEMPT_CLOSED' || codeStr === '409_CLOSED') {
    return 'No fue posible tomar tu intento porque la actividad ya cerró. Comunícate con tu maestra para ver si hay opción de volver a habilitarla.';
  }

  // Network / Server (500, 502, 503, 504, NETWORK_ERROR)
  if (
    codeStr === '500' ||
    codeStr === '502' ||
    codeStr === '503' ||
    codeStr === '504' ||
    codeStr === 'NETWORK_ERROR' ||
    codeStr === 'HEALTH_UNAVAILABLE'
  ) {
    return variant === 'kids'
      ? 'No pudimos conectar. Vamos a intentarlo otra vez'
      : 'No pudimos conectar. Intenta de nuevo';
  }

  // Unauthorized / Forbidden
  if (codeStr === '401' || codeStr === '403' || codeStr === 'UNAUTHORIZED' || codeStr === 'FORBIDDEN') {
    return 'No tienes acceso a esta sección';
  }

  // Not Found
  if (codeStr === '404' || codeStr === 'NOT_FOUND') {
    return variant === 'kids'
      ? 'No encontramos lo que buscas'
      : 'No encontramos este recurso';
  }

  // Already attempted
  if (codeStr === 'ATTEMPT_ALREADY_EXISTS') {
    return variant === 'kids'
      ? 'Ya hiciste esta actividad. Habla con tu maestra'
      : 'Ya tienes un intento. Consulta con tu maestra si puedes repetirlo';
  }

  // Upload failed
  if (codeStr === 'UPLOAD_FAILED' || codeStr === 'MEDIA_UPLOAD_FAILED') {
    return variant === 'kids'
      ? 'Tu audio no se pudo enviar. Intenta otra vez'
      : 'No se pudo subir el audio. Intenta de nuevo';
  }

  // Unknown / generic render error
  return variant === 'kids'
    ? 'Algo no salió bien. Intenta otra vez'
    : 'Ocurrió un problema. Intenta de nuevo';
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  code,
  message,
  variant = 'kids',
  onRetry,
  onBack,
}) => {
  const displayMessage = message || getErrorMessage(code, variant);

  const isKids = variant === 'kids';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={
        isKids
          ? 'flex flex-col items-center justify-center p-8 text-center bg-amber-50 rounded-3xl border-4 border-amber-200 max-w-lg mx-auto my-8 shadow-lg'
          : 'flex flex-col items-center justify-center p-6 text-center bg-zinc-50 rounded-xl border border-zinc-200 max-w-md mx-auto my-6'
      }
    >
      <div className={isKids ? 'text-5xl mb-4' : 'text-3xl mb-3'} aria-hidden="true">
        {isKids ? '🌟' : '⚠️'}
      </div>

      <h2
        className={
          isKids
            ? 'text-2xl font-black text-amber-900 mb-2 font-comic'
            : 'text-xl font-semibold text-zinc-900 mb-2'
        }
      >
        {isKids ? '¡Ups!' : 'Atención'}
      </h2>

      <p
        className={
          isKids
            ? 'text-lg font-medium text-amber-800 mb-6 leading-relaxed'
            : 'text-sm text-zinc-600 mb-5 leading-normal'
        }
      >
        {displayMessage}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={
              isKids
                ? 'min-w-[48px] min-h-[48px] px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-md transition-transform active:scale-95 focus:ring-4 focus:ring-amber-300'
                : 'min-w-[40px] min-h-[40px] px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-sm rounded-lg transition-colors focus:ring-2 focus:ring-zinc-400'
            }
          >
            Reintentar
          </button>
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={
              isKids
                ? 'min-w-[48px] min-h-[48px] px-6 py-3 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-2xl transition-transform active:scale-95 focus:ring-4 focus:ring-amber-300'
                : 'min-w-[40px] min-h-[40px] px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-medium text-sm rounded-lg transition-colors focus:ring-2 focus:ring-zinc-400'
            }
          >
            Volver
          </button>
        )}
      </div>
    </div>
  );
};
