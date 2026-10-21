'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionView } from '@englove/shared';
import { clearSharedDeviceSession } from '../../lib/auth-hygiene';

export default function InicioPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, startLogout] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let isMounted = true;

    async function fetchSession() {
      try {
        const res = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (res.ok && isMounted) {
          const data: SessionView = await res.json();
          setSession(data);
        } else if (isMounted) {
          // If unauthenticated or expired, redirect to login
          router.replace('/login');
          return;
        }
      } catch {
        // Network error, redirect to login
        router.replace('/login');
        return;
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    fetchSession();

    return () => {
      isMounted = false;
    };
  }, [apiUrl, router]);

  const handleLogout = () => {
    startLogout(async () => {
      try {
        await fetch(`${apiUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: window.location.origin,
          },
          credentials: 'include',
        });
      } catch {
        // Even on network failure, clear client session (RF-18)
      } finally {
        await clearSharedDeviceSession();
        window.location.href = '/login';
      }
    });
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center bg-zinc-50">
        <p className="text-zinc-600 text-lg">Cargando tu espacio…</p>
      </main>
    );
  }

  const roleLabel = session?.user.role === 'teacher' ? 'Profesora' : 'Estudiante';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-4">
          Sesión activa — {roleLabel}
        </div>

        <h1 className="text-2xl font-bold text-zinc-900 mb-2">
          ¡Hola, {session?.user.name}!
        </h1>
        <p className="text-sm text-zinc-600 mb-6">
          Has ingresado exitosamente a Englove.
        </p>

        {session?.user.role === 'teacher' ? (
          <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-xl mb-6 text-left">
            <h2 className="text-base font-semibold text-zinc-800 mb-1">Panel de Profesora</h2>
            <p className="text-sm text-zinc-600">
              La gestión de grupos y asignaciones se habilitará en la siguiente etapa (SPEC-03).
            </p>
          </div>
        ) : (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl mb-6 text-left">
            <h2 className="text-base font-semibold text-amber-900 mb-1">Portal del Estudiante</h2>
            <p className="text-sm text-amber-800">
              Tus actividades y misiones estarán disponibles tan pronto tu profesora las asigne (SPEC-04).
            </p>
            {session?.student && (
              <p className="text-xs text-amber-700 mt-2">
                Segmento pedagógico: <span className="font-semibold">{session.student.ageSegment.toUpperCase()}</span>
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white font-medium rounded-lg text-base transition-colors min-h-[48px] focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>
    </main>
  );
}
