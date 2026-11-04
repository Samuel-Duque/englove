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

  // Silent refresh check on load (RF-17, §7, H12)
  useEffect(() => {
    let isMounted = true;

    async function trySilentRefresh() {
      // Only attempt silent refresh if there is a session hint (H12)
      const hasSessionHint =
        typeof window !== 'undefined' &&
        (document.cookie.includes('englove_session') ||
          document.cookie.includes('access_token') ||
          document.cookie.includes('englove_user_logged=1'));

      if (!hasSessionHint) {
        if (isMounted) setIsCheckingSession(false);
        return;
      }

      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (res.ok && isMounted) {
          document.cookie = 'englove_user_logged=1; path=/; SameSite=Lax';
          const destination = isSafeNextDestination(nextParam) ? nextParam! : '/inicio';
          router.replace(destination);
          return;
        } else {
          document.cookie = 'englove_user_logged=; path=/; max-age=0; SameSite=Lax';
        }
      } catch {
        document.cookie = 'englove_user_logged=; path=/; max-age=0; SameSite=Lax';
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

        if (typeof document !== 'undefined') {
          document.cookie = 'englove_user_logged=1; path=/; SameSite=Lax';
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

        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-6 pt-4 border-t border-dashed border-zinc-200">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 text-center">
              Credenciales de prueba (Clic para rellenar)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmail('profesora@englove.org');
                  setPassword('Englove2026!');
                  setErrorMessage(null);
                }}
                className="p-2 text-left rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition cursor-pointer"
              >
                <div className="font-bold">👩‍🏫 Docente</div>
                <div className="text-[11px] text-blue-700 truncate">profesora@englove.org</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('sofia.kids@englove.org');
                  setPassword('Estudiante2026!');
                  setErrorMessage(null);
                }}
                className="p-2 text-left rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition cursor-pointer"
              >
                <div className="font-bold">👧 Alumna (Kids)</div>
                <div className="text-[11px] text-emerald-700 truncate">sofia.kids@englove.org</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('lucas.kids@englove.org');
                  setPassword('Estudiante2026!');
                  setErrorMessage(null);
                }}
                className="p-2 text-left rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
              >
                <div className="font-bold">👦 Alumno (Kids)</div>
                <div className="text-[11px] text-amber-700 truncate">lucas.kids@englove.org</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('camila.teens@englove.org');
                  setPassword('Estudiante2026!');
                  setErrorMessage(null);
                }}
                className="p-2 text-left rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition cursor-pointer"
              >
                <div className="font-bold">🧑 Alumna (Teens)</div>
                <div className="text-[11px] text-purple-700 truncate">camila.teens@englove.org</div>
              </button>
            </div>
          </div>
        )}
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
