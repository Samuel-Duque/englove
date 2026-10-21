'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { getAuthErrorMessage } from '../../../lib/auth-errors';

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/forgot-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: window.location.origin,
          },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();

        if (!res.ok) {
          const msg = getAuthErrorMessage(data?.code, data?.message);
          setErrorMessage(msg);
          return;
        }

        // RF-11: Uniform success message
        setSuccessMessage(
          data?.message ||
            'Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña.',
        );
      } catch {
        setErrorMessage('No fue posible conectar con el servidor. Verifica tu conexión.');
      }
    });
  };

  if (successMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
            ✉
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Revisa tu correo</h1>
          <p className="text-sm text-zinc-600 mb-6">{successMessage}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-base min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2 text-center">Recuperar contraseña</h1>
        <p className="text-sm text-zinc-600 mb-6 text-center">
          Ingresa el correo asociado a tu cuenta y te enviaremos las instrucciones para restablecer tu contraseña.
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

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-base transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600">
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
