'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { getAuthErrorMessage } from '../../../../lib/auth-errors';
import { AuthAlert, AuthHeading, AuthPage } from '../../auth-page';
import styles from '../../auth-page.module.css';

export function ResetPasswordForm() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ tokenVal, newPasswordVal }: { tokenVal: string; newPasswordVal: string }) => {
      const res = await fetch(`${apiUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          token: tokenVal,
          newPassword: newPasswordVal,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const code =
          data && typeof data === 'object' && 'code' in data && typeof data.code === 'string'
            ? data.code
            : undefined;
        const msg =
          data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
            ? data.message
            : undefined;
        if (code === 'PASSWORD_RESET_INVALID') {
          setIsTokenInvalid(true);
        }
        throw new Error(getAuthErrorMessage(code, msg));
      }

      const message =
        data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
          ? data.message
          : 'Contraseña actualizada. Inicia sesión.';

      return { message };
    },
    onSuccess: (data) => {
      // RF-12: Uniform success message
      setSuccessMessage(data.message);
    },
    onError: (err: Error) => {
      setErrorMessage(
        err.message || 'No fue posible conectar con el servidor. Verifica tu conexión.',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPasswordMutation.isPending) return;
    setErrorMessage(null);

    // Local validation check
    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden');
      return;
    }

    const unicodeLen = [...newPassword].length;
    if (unicodeLen < 8 || unicodeLen > 16 || /\s/u.test(newPassword)) {
      setErrorMessage('Usa entre 8 y 16 caracteres, sin espacios');
      return;
    }

    resetPasswordMutation.mutate({ tokenVal: token, newPasswordVal: newPassword });
  };

  if (successMessage) {
    return (
      <AuthPage variant="success">
        <div className={styles.successMark} aria-hidden="true">
          <Check size={28} strokeWidth={2.5} />
        </div>
        <h1 className={styles.title}>Contraseña actualizada</h1>
        <p className={styles.subtitle}>{successMessage}</p>
        <Link href="/login" className={styles.primary}>
          Iniciar sesión
        </Link>
      </AuthPage>
    );
  }

  return (
    <AuthPage variant="login">
      <AuthHeading
        title="Crear nueva contraseña"
        description="Ingresa y confirma tu nueva contraseña de acceso."
      />

      {errorMessage && <AuthAlert message={errorMessage} />}

      {isTokenInvalid ? (
        <Link href="/recuperar-contrasena" className={styles.primary}>
          Solicitar un nuevo enlace
        </Link>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fields}>
            <div>
              <label htmlFor="newPassword" className={styles.label}>
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
              />
              <p className={styles.help}>
                Usa entre 8 y 16 caracteres, sin espacios.
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={resetPasswordMutation.isPending}
            aria-busy={resetPasswordMutation.isPending}
            className={styles.primary}
          >
            {resetPasswordMutation.isPending ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}

      <div className={styles.footer}>
        <Link href="/login" className={styles.link}>
          Volver a iniciar sesión
        </Link>
      </div>
    </AuthPage>
  );
}
