import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../src/components/error-state';

describe('RF-2: boundary y ErrorState muestran fallback seguro en tres variantes', () => {
  it('displays correct messages for network/server errors across variants', () => {
    expect(getErrorMessage(500, 'kids')).toBe('No pudimos conectar. Vamos a intentarlo otra vez');
    expect(getErrorMessage(503, 'kids')).toBe('No pudimos conectar. Vamos a intentarlo otra vez');
    expect(getErrorMessage(500, 'teens')).toBe('No pudimos conectar. Intenta de nuevo');
    expect(getErrorMessage(500, 'teacher')).toBe('No pudimos conectar. Intenta de nuevo');
  });

  it('displays correct messages for unauthorized/forbidden', () => {
    expect(getErrorMessage(401, 'kids')).toBe('No tienes acceso a esta sección');
    expect(getErrorMessage(403, 'teens')).toBe('No tienes acceso a esta sección');
    expect(getErrorMessage('FORBIDDEN', 'teacher')).toBe('No tienes acceso a esta sección');
  });

  it('displays correct messages for not found 404', () => {
    expect(getErrorMessage(404, 'kids')).toBe('No encontramos lo que buscas');
    expect(getErrorMessage(404, 'teens')).toBe('No encontramos este recurso');
    expect(getErrorMessage('NOT_FOUND', 'teacher')).toBe('No encontramos este recurso');
  });

  it('displays correct messages for ATTEMPT_ALREADY_EXISTS', () => {
    expect(getErrorMessage('ATTEMPT_ALREADY_EXISTS', 'kids')).toBe(
      'Ya hiciste esta actividad. Habla con tu maestra',
    );
    expect(getErrorMessage('ATTEMPT_ALREADY_EXISTS', 'teens')).toBe(
      'Ya tienes un intento. Consulta con tu maestra si puedes repetirlo',
    );
  });

  it('displays correct messages for upload failed', () => {
    expect(getErrorMessage('UPLOAD_FAILED', 'kids')).toBe(
      'Tu audio no se pudo enviar. Intenta otra vez',
    );
    expect(getErrorMessage('UPLOAD_FAILED', 'teens')).toBe(
      'No se pudo subir el audio. Intenta de nuevo',
    );
  });

  it('displays exact canonical text for ATTEMPT_CLOSED', () => {
    const closedExpected =
      'No fue posible tomar tu intento porque la actividad ya cerró. Comunícate con tu maestra para ver si hay opción de volver a habilitarla.';
    expect(getErrorMessage('ATTEMPT_CLOSED', 'kids')).toBe(closedExpected);
    expect(getErrorMessage('ATTEMPT_CLOSED', 'teens')).toBe(closedExpected);
  });

  it('falls back to generic error message for unknown codes without technical leak', () => {
    expect(getErrorMessage('SOME_RANDOM_CODE_123', 'kids')).toBe(
      'Algo no salió bien. Intenta otra vez',
    );
    expect(getErrorMessage('SOME_RANDOM_CODE_123', 'teens')).toBe(
      'Ocurrió un problema. Intenta de nuevo',
    );
  });
});
