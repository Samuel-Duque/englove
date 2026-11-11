'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { getAuthErrorMessage } from '../../../lib/auth-errors';

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
          : '¡Solicitud enviada con éxito! Tu cuenta está en revisión. Tu docente la aprobará pronto para que puedas ingresar.';
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
    setErrorMessage(null);

    // Client-side password policy check (RF-8)
    if (password.length < 8 || password.length > 16 || /\s/.test(password)) {
      setErrorMessage('Usa entre 8 y 16 caracteres, sin espacios');
      return;
    }

    if (!acceptTerms) {
      setErrorMessage('Debes aceptar los términos y condiciones para continuar');
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
      <main className="flex min-h-screen items-center justify-center p-6 bg-zinc-50">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🎉
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Solicitud de registro enviada</h1>
          <p className="text-sm text-zinc-600 mb-6">{successMessage}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-base transition-colors min-h-[48px]"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-zinc-50">
      <div className="w-full max-w-lg bg-white p-8 rounded-2xl shadow-sm border border-zinc-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Crea tu cuenta</h1>
          <p className="text-sm text-zinc-600 mt-2">
            Registro de estudiante para aprender inglés en Englove.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name-input" className="block text-sm font-medium text-zinc-700 mb-1">
              Nombre completo del alumno
            </label>
            <input
              id="name-input"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              placeholder="Ej. Lucas Gómez"
            />
          </div>

          <div>
            <label htmlFor="email-input" className="block text-sm font-medium text-zinc-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email-input"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              placeholder="lucas@ejemplo.com"
            />
          </div>

          <div>
            <label htmlFor="birthdate-input" className="block text-sm font-medium text-zinc-700 mb-1">
              Fecha de nacimiento
            </label>
            <input
              id="birthdate-input"
              name="birthDate"
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
            <p className="text-xs text-zinc-500 mt-1">
              La edad determina el segmento pedagógico (Kids: 7-10 años, Teens: 11-14 años).
            </p>
          </div>

          <div>
            <label htmlFor="password-input" className="block text-sm font-medium text-zinc-700 mb-1">
              Contraseña
            </label>
            <input
              id="password-input"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
              placeholder="Entre 8 y 16 caracteres, sin espacios"
            />
          </div>

          <div className="pt-2 border-t border-zinc-200">
            <h2 className="text-sm font-semibold text-zinc-800 mb-2">
              Datos del Acudiente / Tutor (Opcional)
            </h2>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="guardian-name-input"
                  className="block text-xs font-medium text-zinc-600 mb-1"
                >
                  Nombre del acudiente
                </label>
                <input
                  id="guardian-name-input"
                  name="guardianName"
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                  placeholder="Ej. María Gómez"
                />
              </div>

              <div>
                <label
                  htmlFor="guardian-contact-input"
                  className="block text-xs font-medium text-zinc-600 mb-1"
                >
                  Teléfono o correo del acudiente
                </label>
                <input
                  id="guardian-contact-input"
                  name="guardianContact"
                  type="text"
                  value={guardianContact}
                  onChange={(e) => setGuardianContact(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
                  placeholder="Ej. 300 123 4567 o maria@ejemplo.com"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label htmlFor="accept-terms-checkbox" className="flex items-start gap-3 cursor-pointer">
              <input
                id="accept-terms-checkbox"
                name="acceptTerms"
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-600">
                Acepto los{' '}
                <Link
                  href="/terminos"
                  target="_blank"
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                >
                  términos y condiciones
                </Link>{' '}
                de la plataforma y el tratamiento de datos para fines educativos.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-base transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {registerMutation.isPending ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600">
          ¿Ya tienes una cuenta?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Inicia sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
