'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthErrorMessage } from '../../../lib/auth-errors';

function isSafeNextDestination(next: string | null | undefined): boolean {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return false;
  }
  const isPublicAuthRoute =
    next.startsWith('/login') ||
    next.startsWith('/registro') ||
    next.startsWith('/recuperar-contrasena') ||
    next.startsWith('/restablecer');
  return !isPublicAuthRoute;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isPending, startTransition] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Silent refresh check on load (RF-17, §7)
  useEffect(() => {
    let isMounted = true;

    async function trySilentRefresh() {
      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (res.ok && isMounted) {
          const destination = isSafeNextDestination(nextParam) ? nextParam! : '/inicio';
          router.replace(destination);
          return;
        }
      } catch {
        // Fall through to show login form
      }

      if (isMounted) {
        setIsCheckingSession(false);
      }
    }

    trySilentRefresh();

    return () => {
      isMounted = false;
    };
  }, [apiUrl, nextParam, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: window.location.origin,
          },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          const msg = getAuthErrorMessage(data?.code, data?.message);
          setErrorMessage(msg);
          return;
        }

        const destination = isSafeNextDestination(nextParam) ? nextParam! : '/inicio';
        router.push(destination);
      } catch {
        setErrorMessage('No fue posible conectar con el servidor. Verifica tu conexión.');
      }
    });
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-zinc-600 text-lg">Comprobando tu sesión…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2 text-center">Iniciar sesión</h1>
        <p className="text-sm text-zinc-600 mb-6 text-center">
          Ingresa con tu correo y contraseña para acceder a tus actividades.
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition disabled:opacity-50 min-h-[48px] text-base"
          >
            {isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-100 flex flex-col gap-2 text-center text-sm">
          <Link
            href="/recuperar-contrasena"
            className="text-blue-600 hover:underline min-h-[32px] inline-flex items-center justify-center"
          >
            Olvidé mi contraseña
          </Link>
          <Link
            href="/registro"
            className="text-zinc-600 hover:underline min-h-[32px] inline-flex items-center justify-center"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6 text-center">
          <p className="text-zinc-600 text-lg">Comprobando tu sesión…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
