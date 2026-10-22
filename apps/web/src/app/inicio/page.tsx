'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SessionView, RemindersResponse } from '@englove/shared';
import { clearSharedDeviceSession } from '../../lib/auth-hygiene';
import { TeacherNav } from '../../components/teacher-nav';

export default function InicioPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [reminders, setReminders] = useState<RemindersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, startLogout] = useTransition();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const sessionRes = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!sessionRes.ok) {
          if (isMounted) router.replace('/login');
          return;
        }

        const sessionData: SessionView = await sessionRes.json();
        if (isMounted) setSession(sessionData);

        // If teacher, fetch reminders from PendingSummaryService (RF-17)
        if (sessionData.user.role === 'teacher') {
          try {
            const remindersRes = await fetch(`${apiUrl}/api/v1/dashboard/reminders`, {
              credentials: 'include',
            });
            if (remindersRes.ok && isMounted) {
              const remindersData: RemindersResponse = await remindersRes.json();
              setReminders(remindersData);
            }
          } catch {
            // Reminders load failure is non-blocking
          }
        }
      } catch {
        if (isMounted) router.replace('/login');
        return;
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    loadData();

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
        // Even on network failure, clear client session
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

  // Teacher Experience
  if (session?.user.role === 'teacher') {
    const pendingCount = reminders?.pendingRegistrations ?? 0;
    const reminderDays = reminders?.ungradedReminderDays ?? 3;

    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
        <Suspense fallback={<header className="h-16 border-b border-zinc-200 bg-white" />}>
          <TeacherNav teacherName={session.user.name} />
        </Suspense>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              ¡Hola, {session.user.name}!
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Bienvenida al panel docente de Englove. Gestiona tus actividades, grupos y alumnos.
            </p>
          </div>

          {/* Reminders & Notification Cards (RF-17) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Card 1: Solicitudes de Registro */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Solicitudes de registro
                  </h2>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      pendingCount > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {pendingCount > 0 ? `${pendingCount} pendiente(s)` : 'Al día'}
                  </span>
                </div>
                <p className="text-sm text-zinc-600">
                  {pendingCount > 0
                    ? `Tienes ${pendingCount} alumno(s) esperando aprobación para ingresar a tu institución.`
                    : 'No tienes solicitudes pendientes.'}
                </p>
              </div>

              <div className="mt-6">
                {pendingCount > 0 ? (
                  <Link
                    href="/alumnos?tab=requests"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  >
                    Revisar solicitudes ({pendingCount})
                  </Link>
                ) : (
                  <Link
                    href="/alumnos"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Ver lista de alumnos →
                  </Link>
                )}
              </div>
            </div>

            {/* Card 2: Revisión de Actividades (Estado reservado RF-17) */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Revisión de actividades
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
                    Próximamente
                  </span>
                </div>
                <p className="text-sm text-zinc-600">
                  Revisión disponible próximamente.
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Umbral de recordatorio configurado a {reminderDays} días. En SPEC-07 podrás calificar actividades abiertas y grabaciones.
                </p>
              </div>

              <div className="mt-6">
                <span
                  aria-disabled="true"
                  className="inline-block text-sm text-zinc-400 cursor-not-allowed select-none font-medium"
                >
                  Bandeja de revisión (inactiva)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Access Grid (Section 7: 1-click access) */}
          <h2 className="text-xl font-bold text-zinc-900 mb-4">Accesos rápidos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link
              href="/actividades"
              className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-4 font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                📚
              </div>
              <h3 className="text-base font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors">
                Catálogo de Actividades
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Crea, edita y organiza tus ejercicios, juegos y exámenes.
              </p>
            </Link>

            <Link
              href="/grupos"
              className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 mb-4 font-bold text-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                👥
              </div>
              <h3 className="text-base font-semibold text-zinc-900 group-hover:text-purple-600 transition-colors">
                Gestión de Grupos
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Organiza a tus estudiantes en grupos y aulas temáticas.
              </p>
            </Link>

            <Link
              href="/alumnos"
              className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mb-4 font-bold text-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                🎓
              </div>
              <h3 className="text-base font-semibold text-zinc-900 group-hover:text-emerald-600 transition-colors">
                Gestión de Alumnos
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Consulta fichas, aprueba solicitudes y desbloquea accesos.
              </p>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Student Experience
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-4">
          Sesión activa — Estudiante
        </div>

        <h1 className="text-2xl font-bold text-zinc-900 mb-2">
          ¡Hola, {session?.user.name}!
        </h1>
        <p className="text-sm text-zinc-600 mb-6">
          Has ingresado exitosamente a Englove.
        </p>

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
