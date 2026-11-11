'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAuthErrorMessage } from '../../../lib/auth-errors';
import {
  setSharedSession,
  requestSharedRefresh,
  clearSharedProfile,
} from '../../../lib/auth-session';
import { clearSharedFeatureFlags } from '../../../lib/feature-flags-client';
import { purgeOtherUsersEntries } from '../../../lib/offline-queue';
import { getQueryClient } from '../../../lib/query-client';
import type { SessionView } from '@englove/shared';

function isSafeNextDestination(next: string | null | undefined): boolean {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return false;
  }
  const hasControlChars = Array.from(next).some((c) => {
    const code = c.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (hasControlChars) {
    return false;
  }
  const isPublicAuthRoute =
    next.startsWith('/login') ||
    next.startsWith('/registro') ||
    next.startsWith('/recuperar-contrasena') ||
    next.startsWith('/restablecer');
  return !isPublicAuthRoute;
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Silent refresh check on load via useQuery (RF-17, §7, H12, QA-04)
  const { isLoading: isCheckingSession } = useQuery({
    queryKey: ['auth', 'silent-refresh', nextParam],
    queryFn: async () => {
      // Only attempt silent refresh if there is an active session hint (QA-02, P0-02)
      const hasSessionHint =
        typeof window !== 'undefined' &&
        document.cookie
          .split(';')
          .some((c) => {
            const [key, val] = c.split('=').map((s) => s.trim());
            return (
              (key === 'session_hint' || key?.endsWith('_session_hint') || key?.includes('session_hint')) &&
              val === '1'
            );
          });

      if (!hasSessionHint) {
        return false;
      }

      try {
        const refreshed = await requestSharedRefresh();
        if (refreshed) {
          const destination =
            nextParam && isSafeNextDestination(nextParam) ? nextParam : '/inicio';
          router.replace(destination);
          return true;
        }
      } catch {
        // Fallback: stay on login page
      }

      return false;
    },
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ emailVal, passwordVal }: { emailVal: string; passwordVal: string }) => {
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
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

      const session: SessionView = await res.json();
      return session;
    },
    onSuccess: async (data) => {
      // RF-5 / ISSUE-09 hygiene: Purge offline queue events from any other user
      if (data.user?.id) {
        await purgeOtherUsersEntries(data.user.id).catch((purgeErr) => {
          console.warn('[Login] Offline queue purge notice:', purgeErr);
        });
      }

      setSharedSession(data);
      clearSharedProfile();
      clearSharedFeatureFlags();

      // Reset query cache to avoid showing stale data from previous user
      getQueryClient().clear();

      // Redirection
      const destination =
        nextParam && isSafeNextDestination(nextParam) ? nextParam : '/inicio';
      router.push(destination);
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || 'Ocurrió un error inesperado. Intenta de nuevo más tarde');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    loginMutation.mutate({ emailVal: email, passwordVal: password });
  };

  if (isCheckingSession) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-6 text-center outline-none">
        <p className="text-zinc-600 text-lg">Comprobando tu sesión…</p>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-6 bg-zinc-50 outline-none">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-zinc-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">Englove</h1>
          <p className="text-sm text-zinc-600 mt-2">
            Aprende inglés jugando con tu profesora y compañeros.
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
            <label
              htmlFor="email-input"
              className="block text-sm font-medium text-zinc-700 mb-1"
            >
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
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
              placeholder="tu-correo@ejemplo.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password-input"
                className="block text-sm font-medium text-zinc-700"
              >
                Contraseña
              </label>
              <Link
                href="/recuperar-contrasena"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              id="password-input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg text-base text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[48px]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-base transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600">
          ¿No tienes una cuenta de estudiante?{' '}
          <Link href="/registro" className="text-blue-600 hover:text-blue-700 font-medium">
            Regístrate aquí
          </Link>
        </div>

        {/* Development Quick Credentials Picker (P2-02, T2.1) */}
        {(process.env.NEXT_PUBLIC_APP_ENV === 'local' ||
          process.env.APP_ENV === 'local') && (
          <div className="mt-8 pt-6 border-t border-zinc-200">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Credenciales de prueba (Dev)
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setEmail('profesora@englove.org');
                  setPassword('Englove2026!');
                  setErrorMessage(null);
                }}
                className="p-2 text-left rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition cursor-pointer"
              >
                <div className="font-bold">👩‍🏫 Docente Principal</div>
                <div className="text-[11px] text-blue-700 truncate">profesora@englove.org</div>
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
