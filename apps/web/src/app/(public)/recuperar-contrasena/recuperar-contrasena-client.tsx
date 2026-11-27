'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { getAuthErrorMessage } from '../../../lib/auth-errors';
import { AuthAlert, AuthHeading, AuthPage } from '../auth-page';
import styles from '../auth-page.module.css';

export function RecuperarContrasenaClient() {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const forgotPasswordMutation = useMutation({
    mutationFn: async (emailVal: string) => {
      const res = await fetch(`${apiUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({ email: emailVal }),
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
        throw new Error(getAuthErrorMessage(code, msg));
      }

      const message =
        data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
          ? data.message
          : 'Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.';

      return { message };
    },
    onSuccess: (data) => {
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
    if (forgotPasswordMutation.isPending) return;
    setErrorMessage(null);
    forgotPasswordMutation.mutate(email);
  };

  if (successMessage) {
    return (
      <AuthPage variant="success">
        <div className={styles.successMark} aria-hidden="true">
          <Mail size={28} strokeWidth={2.2} />
        </div>
        <h1 className={styles.title}>Revisa tu correo</h1>
        <p className={styles.subtitle}>{successMessage}</p>
        <Link href="/login" className={styles.primary}>
          Volver a iniciar sesión
        </Link>
      </AuthPage>
    );
  }

  return (
    <AuthPage variant="login">
      <AuthHeading
        title="Recuperar contraseña"
        description="Ingresa el correo asociado a tu cuenta y te enviaremos las instrucciones para restablecer tu contraseña."
      />

      {errorMessage && <AuthAlert message={errorMessage} />}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fields}>
          <div>
            <label htmlFor="email" className={styles.label}>
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="tu-correo@ejemplo.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={forgotPasswordMutation.isPending}
          aria-busy={forgotPasswordMutation.isPending}
          className={styles.primary}
        >
          {forgotPasswordMutation.isPending ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>

      <div className={styles.footer}>
        ¿Recordaste tu contraseña?
        <Link href="/login" className={styles.link}>
          Volver a iniciar sesión
        </Link>
      </div>
    </AuthPage>
  );
}
