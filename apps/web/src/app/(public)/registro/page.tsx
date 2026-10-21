'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { getAuthErrorMessage } from '../../../lib/auth-errors';

export default function RegistroPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

    startTransition(async () => {
      try {
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

        const res = await fetch(`${apiUrl}/api/v1/auth/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: window.location.origin,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          const msg = getAuthErrorMessage(data?.code, data?.message);
          setErrorMessage(msg);
          return;
        }

        // RF-6, RF-7: Uniform success message
        setSuccessMessage(data?.message || 'Recibimos tu solicitud. Revisa tu correo.');
      } catch {
        setErrorMessage('No fue posible conectar con el servidor. Verifica tu conexión.');
      }
    });
  };

  if (successMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Solicitud recibida</h1>
          <p className="text-sm text-zinc-600 mb-6">{successMessage}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-base min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 my-8">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2 text-center">Crear cuenta</h1>
        <p className="text-sm text-zinc-600 mb-6 text-center">
          Ingresa tus datos para registrarte como estudiante. Tu profesora aprobará tu solicitud.
        </p>

        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
              Nombre completo
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Usa entre 8 y 16 caracteres, sin espacios. Puedes usar palabras fáciles de recordar (ej. sol-luna-azul).
            </p>
          </div>

          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium text-zinc-700 mb-1">
              Fecha de nacimiento
            </label>
            <input
              id="birthDate"
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
          </div>

          <div className="pt-2 border-t border-zinc-100">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Datos de tu acudiente (opcional)
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="guardianName" className="block text-sm font-medium text-zinc-700 mb-1">
                  Nombre del acudiente
                </label>
                <input
                  id="guardianName"
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                />
              </div>

              <div>
                <label htmlFor="guardianContact" className="block text-sm font-medium text-zinc-700 mb-1">
                  Contacto del acudiente (teléfono o correo)
                </label>
                <input
                  id="guardianContact"
                  type="text"
                  value={guardianContact}
                  onChange={(e) => setGuardianContact(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-600">
                Acepto los términos y condiciones de la plataforma y el tratamiento de datos para fines educativos.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-base transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isPending ? 'Enviando…' : 'Enviar solicitud'}
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
