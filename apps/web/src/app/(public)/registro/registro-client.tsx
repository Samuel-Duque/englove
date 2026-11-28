'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { getAuthErrorMessage } from '../../../lib/auth-errors';
import { AuthAlert, AuthHeading, AuthPage } from '../auth-page';
import styles from '../auth-page.module.css';

const termsError = 'Debes aceptar los términos y condiciones para continuar';

function focusSuccessTitle(title: HTMLHeadingElement | null) {
  title?.focus();
}

export function RegistroClient() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const registerMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`${apiUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      }).catch(() => {
        throw new Error('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const code =
          data && typeof data === 'object' && 'code' in data && typeof data.code === 'string'
            ? data.code
            : undefined;
        throw new Error(getAuthErrorMessage(code));
      }

      const data = await res.json().catch(() => null);
      const message =
        data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
          ? data.message
          : 'Recibimos tu solicitud.';
      return { message };
    },
    onSuccess: (data) => {
      setSuccessMessage(data.message);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Ocurrió un error inesperado. Intenta de nuevo más tarde');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerMutation.isPending) return;
    setErrorMessage(null);

    // Client-side password policy check (RF-8)
    if (password.length < 8 || password.length > 16 || /\s/.test(password)) {
      setErrorMessage('Usa entre 8 y 16 caracteres, sin espacios');
      return;
    }

    if (!acceptTerms) {
      setErrorMessage(termsError);
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      email,
      password,
      birthDate,
      acceptTerms: true,
    };

    if (guardianName.trim()) {
      payload.guardianName = guardianName.trim();
    }
    if (guardianContact.trim()) {
      payload.guardianContact = guardianContact.trim();
    }

    registerMutation.mutate(payload);
  };

  if (successMessage) {
    return (
      <AuthPage variant="success">
        <div className={styles.successMark} aria-hidden="true">
          <Check size={32} strokeWidth={2.5} />
        </div>
        <h1 ref={focusSuccessTitle} tabIndex={-1} className={styles.title}>
          Solicitud de registro enviada
        </h1>
        <div className={styles.subtitle}>
          <p>{successMessage}</p>
          <p>Tu profesora revisará tu solicitud. Podrás iniciar sesión cuando apruebe tu cuenta.</p>
        </div>
        <Link href="/login" className={styles.primary}>
          Ir al inicio de sesión
        </Link>
      </AuthPage>
    );
  }

  return (
    <AuthPage variant="signup">
      <AuthHeading
        title="Crea tu cuenta"
        description="Regístrate para aprender inglés jugando y practicando con tu profesora."
      />

      {errorMessage && <AuthAlert message={errorMessage} />}

      <form onSubmit={handleSubmit} className={styles.form}>
        <section aria-labelledby="student-details" className={styles.fields}>
          <h2 id="student-details" className={styles.sectionTitle}>Datos del estudiante</h2>
          <div>
            <label htmlFor="name-input" className={styles.label}>Nombre completo del alumno</label>
            <input
              id="name-input"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder="Ej. Lucas Gómez"
            />
          </div>
          <div>
            <label htmlFor="email-input" className={styles.label}>Correo electrónico</label>
            <input
              id="email-input"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="lucas@ejemplo.com"
            />
          </div>
          <div>
            <label htmlFor="birthdate-input" className={styles.label}>Fecha de nacimiento</label>
            <input
              id="birthdate-input"
              name="birthDate"
              type="date"
              autoComplete="bday"
              aria-describedby="birthdate-help"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={styles.input}
            />
            <p id="birthdate-help" className={styles.help}>
              Tu fecha de nacimiento ayuda a preparar tu espacio según tu edad.
            </p>
          </div>
          <div>
            <label htmlFor="password-input" className={styles.label}>Contraseña</label>
            <input
              id="password-input"
              name="password"
              type="password"
              autoComplete="new-password"
              aria-describedby="password-help"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
            />
            <p id="password-help" className={styles.help}>Usa entre 8 y 16 caracteres, sin espacios.</p>
          </div>
        </section>

        <section aria-labelledby="guardian-details" className={styles.guardian}>
          <h2 id="guardian-details" className={styles.sectionTitle}>
            Contacto del acudiente (opcional)
          </h2>
          <div className={styles.guardianFields}>
            <div>
              <label htmlFor="guardian-name-input" className={styles.label}>Nombre del acudiente</label>
              <input
                id="guardian-name-input"
                name="guardianName"
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className={styles.input}
                placeholder="Ej. María Gómez"
              />
            </div>
            <div>
              <label htmlFor="guardian-contact-input" className={styles.label}>Teléfono o correo</label>
              <input
                id="guardian-contact-input"
                name="guardianContact"
                type="text"
                value={guardianContact}
                onChange={(e) => setGuardianContact(e.target.value)}
                className={styles.input}
                placeholder="Ej. 300 123 4567"
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="signup-confirmation" className={styles.confirmation}>
          <h2 id="signup-confirmation" className={styles.sectionTitle}>Confirmación</h2>
          <div className={styles.terms}>
            <span className={styles.checkboxTarget}>
              <input
                id="accept-terms-checkbox"
                name="acceptTerms"
                type="checkbox"
                required
                aria-labelledby="terms-copy"
                checked={acceptTerms}
                onInvalid={() => setErrorMessage(termsError)}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (e.target.checked && errorMessage === termsError) setErrorMessage(null);
                }}
              />
              <span className={styles.checkboxMark} aria-hidden="true">
                <Check size={16} strokeWidth={3} />
              </span>
            </span>
            <span id="terms-copy" className={styles.termsText}>
              <label htmlFor="accept-terms-checkbox">Acepto los</label>{' '}
              <Link href="/terminos" target="_blank" rel="noopener noreferrer" className={styles.link}>
                términos y condiciones
              </Link>{' '}
              <label htmlFor="accept-terms-checkbox">
                de la plataforma y el tratamiento de datos para fines educativos.
              </label>
            </span>
          </div>
        </section>

        <button
          type="submit"
          disabled={registerMutation.isPending}
          aria-busy={registerMutation.isPending}
          className={styles.primary}
        >
          {registerMutation.isPending ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </form>

      <div className={styles.footer}>
        ¿Ya tienes una cuenta?
        <Link href="/login" className={styles.link}>Inicia sesión</Link>
      </div>
    </AuthPage>
  );
}
