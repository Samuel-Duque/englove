'use client';

import { fetchSharedSession } from '../../lib/auth-session';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  SessionView,
  RemindersResponse,
  AssignmentCard,
  AssignmentCardListResponse,
  RuntimeView,
} from '@englove/shared';
import { TeacherNav } from '../../components/teacher-nav';
import { StudentNav } from '../../components/student-nav';

export default function InicioPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionView | null>(null);
  const [reminders, setReminders] = useState<RemindersResponse | null>(null);
  const [assignmentCards, setAssignmentCards] = useState<AssignmentCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [startingCardId, setStartingCardId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const sessionData = await fetchSharedSession();

        if (!sessionData) {
          if (isMounted) router.replace('/login');
          return;
        }
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
        } else if (sessionData.user.role === 'student') {
          // If student, fetch student assignments cards
          try {
            const cardsRes = await fetch(`${apiUrl}/api/v1/me/assignments`, {
              credentials: 'include',
            });
            if (cardsRes.ok && isMounted) {
              const cardsData: AssignmentCardListResponse = await cardsRes.json();
              setAssignmentCards(cardsData.items || []);
            }
          } catch {
            // Non-blocking
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

  const handleStartAttempt = async (assignmentId: string) => {
    setStartingCardId(assignmentId);
    try {
      const res = await fetch(`${apiUrl}/api/v1/assignments/${assignmentId}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'No se pudo iniciar el intento');
        return;
      }

      const data: RuntimeView = await res.json();
      router.push(`/actividad/${data.attempt.id}`);
    } catch {
      alert('Error de conexión al iniciar el intento');
    } finally {
      setStartingCardId(null);
    }
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
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        <Suspense fallback={<header className="h-16 border-b border-zinc-200 bg-white" />}>
          <TeacherNav teacherName={session.user.name} />
        </Suspense>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              Panel Docente — Inicio
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Bienvenida/o, {session.user.name}. Aquí tienes un resumen operativo de tu aula y accesos rápidos.
            </p>
          </div>

          <section aria-label="Avisos prioritarios y recordatorios">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={`rounded-xl border p-5 transition-all ${
                  pendingCount > 0
                    ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                    : 'border-zinc-200 bg-white text-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {pendingCount > 0 ? '⚠️' : '✅'}
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">Solicitudes de Registro</h2>
                      <p className="text-sm opacity-90">
                        {pendingCount === 0
                          ? 'No hay alumnos pendientes de aprobación.'
                          : pendingCount === 1
                            ? 'Hay 1 alumno esperando aprobación de cuenta.'
                            : `Hay ${pendingCount} alumnos esperando aprobación de cuenta.`}
                      </p>
                    </div>
                  </div>
                  {pendingCount > 0 && (
                    <Link
                      href="/alumnos/solicitudes"
                      className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                    >
                      Revisar
                    </Link>
                  )}
                </div>
              </div>

              <div
                className={`rounded-xl border p-5 transition-all ${
                  (reminders?.overdueReviews ?? 0) > 0
                    ? 'border-amber-300 bg-amber-50/70 text-amber-900'
                    : 'border-zinc-200 bg-white text-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      📋
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">Entregas sin Calificar</h2>
                      <p className="text-sm opacity-90">
                        {(reminders?.overdueReviews ?? 0) === 0
                          ? `No hay entregas pendientes con más de ${reminderDays} días desde su cierre.`
                          : (reminders?.overdueReviews ?? 0) === 1
                            ? `Hay 1 entrega pendiente de calificar hace más de ${reminderDays} días.`
                            : `Hay ${reminders?.overdueReviews} entregas pendientes de calificar hace más de ${reminderDays} días.`}
                      </p>
                    </div>
                  </div>
                  {(reminders?.overdueReviews ?? 0) > 0 && (
                    <Link
                      href="/revision"
                      className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                    >
                      Revisar
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/asignaciones"
              className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-4 font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                📅
              </div>
              <h3 className="text-base font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors">
                Asignaciones
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Crea tareas, programa fechas de entrega y revisa el progreso del grupo.
              </p>
            </Link>

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

            <Link
              href="/revision"
              className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-amber-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 mb-4 font-bold text-lg group-hover:bg-amber-600 group-hover:text-white transition-colors">
                ✍️
              </div>
              <h3 className="text-base font-semibold text-zinc-900 group-hover:text-amber-600 transition-colors">
                Revisión y Calificación
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Califica entregas de speaking y respuestas, envía stickers y concede nuevos intentos.
              </p>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Student Experience
  const ageSegment = session?.student?.ageSegment ?? 'kids';
  const isKids = ageSegment === 'kids';

  const filteredCards = assignmentCards.filter((card) => {
    if (activeFilter === 'pending') {
      return card.canStart || card.canContinue;
    }
    if (activeFilter === 'completed') {
      return (
        card.latestAttempt?.status === 'graded' ||
        card.latestAttempt?.status === 'pending_review'
      );
    }
    return true;
  });

  return (
    <div
      data-theme={ageSegment}
      className={`min-h-screen flex flex-col transition-colors ${
        isKids
          ? 'bg-amber-50/40 text-amber-950 font-sans'
          : 'bg-zinc-950 text-zinc-100 font-sans'
      }`}
    >
      <StudentNav
        studentName={session?.user.name}
        ageSegment={ageSegment}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Banner Greeting */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-amber-200/80 shadow-xs">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-950">
              ¡Hola, {session?.user.name}! 🌟
            </h1>
            <p className="text-sm font-medium text-zinc-600 mt-1">
              Aquí tienes tus misiones y actividades de inglés asignadas por tu profesora.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/feedback"
              className="rounded-2xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 text-xs font-black text-indigo-900 transition-colors shadow-xs"
            >
              💬 Ver mi feedback
            </Link>
            <Link
              href="/progreso"
              className="rounded-2xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-4 py-2.5 text-xs font-black text-amber-900 transition-colors shadow-xs"
            >
              ⭐ Ver mi progreso
            </Link>
            <Link
              href="/perfil"
              className="rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2.5 text-xs font-bold text-zinc-700 transition-colors"
            >
              👤 Mi Perfil
            </Link>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition-all ${
              activeFilter === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-amber-200 text-amber-950 hover:bg-amber-50'
            }`}
          >
            Todas ({assignmentCards.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition-all ${
              activeFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-amber-200 text-amber-950 hover:bg-amber-50'
            }`}
          >
            Por hacer (
            {assignmentCards.filter((c) => c.canStart || c.canContinue).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition-all ${
              activeFilter === 'completed'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-amber-200 text-amber-950 hover:bg-amber-50'
            }`}
          >
            Entregadas (
            {
              assignmentCards.filter(
                (c) =>
                  c.latestAttempt?.status === 'graded' ||
                  c.latestAttempt?.status === 'pending_review',
              ).length
            }
            )
          </button>
        </div>

        {/* Cards Grid */}
        {filteredCards.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-amber-200 bg-white p-12 text-center space-y-3">
            <span className="text-4xl">🎉</span>
            <h3 className="text-base font-extrabold text-amber-950">
              {activeFilter === 'pending'
                ? '¡Genial! No tienes misiones pendientes por hacer.'
                : 'No hay actividades disponibles en este momento.'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Tu profesora asignará nuevas actividades y ejercicios para tu grupo próximamente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCards.map((card) => {
              const now = new Date();
              const due = new Date(card.effectiveDueAt);
              const completeUntil = new Date(due.getTime() + 24 * 60 * 60 * 1000);
              const isGracePeriod = now > due && now <= completeUntil;

              // Stars (Decisión 101)
              const score = card.latestAttempt?.score;
              let stars = 0;
              if (score !== null && score !== undefined) {
                if (score >= 4.5) stars = 3;
                else if (score >= 3.0) stars = 2;
                else if (score > 0) stars = 1;
              }

              return (
                <div
                  key={card.id}
                  className="rounded-3xl border border-amber-200/90 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-all space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-amber-100 text-amber-900">
                        Nivel {card.activity.level}
                      </span>
                      <span className="text-xs font-bold text-zinc-500">
                        {card.activity.type === 'fill_blank'
                          ? '✍️ Espacios'
                          : card.activity.type === 'speaking'
                            ? '🎙️ Speaking'
                            : card.activity.type === 'exam'
                              ? '📝 Examen'
                              : '📄 Pregunta'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-amber-950 leading-snug">
                        {card.activity.title}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Límite:{' '}
                        {new Date(card.effectiveDueAt ?? card.dueAt).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {card.retryAvailable && (
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-bold text-indigo-900">
                        <span>🔄</span>
                        <span>
                          Tu profesora te habilitó un nuevo intento
                          {card.effectiveDueAt && (
                            <span className="font-normal text-indigo-700 ml-1">
                              (hasta el{' '}
                              {new Date(card.effectiveDueAt).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              )
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {isGracePeriod ? (
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100/80 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                        <span>⏰</span>
                        <span>
                          Puedes terminar hasta{' '}
                          {completeUntil.toLocaleDateString('es-CO', {
                            timeZone: 'America/Bogota',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          (Colombia)
                        </span>
                      </div>
                    ) : (
                      card.canStart && (
                        <p className="text-[11px] text-zinc-500 italic">
                          Si empiezas antes del cierre, tendrás hasta 24 horas más para terminar.
                        </p>
                      )
                    )}

                    {card.latestAttempt && card.latestAttempt.status === 'graded' && (
                      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                        <span className="text-xs font-bold text-amber-900">
                          Nota: {Number(card.latestAttempt.score).toFixed(1).replace('.', ',')} / 5,0
                        </span>
                        <span className="text-amber-400 font-bold text-sm tracking-widest">
                          {'★'.repeat(stars) + '☆'.repeat(3 - stars)}
                        </span>
                      </div>
                    )}

                    {card.latestAttempt && card.latestAttempt.status === 'pending_review' && (
                      <div className="p-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-semibold text-center">
                        ⏳ En revisión por tu profe
                      </div>
                    )}
                  </div>

                  {/* 1-Click Action Buttons */}
                  <div>
                    {card.canContinue && card.latestAttempt ? (
                      <Link
                        href={`/actividad/${card.latestAttempt.id}`}
                        className="w-full flex items-center justify-center rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-4 py-3 text-sm shadow-xs transition-colors"
                      >
                        Continuar actividad 🚀
                      </Link>
                    ) : card.canStart ? (
                      <button
                        type="button"
                        disabled={startingCardId === card.id}
                        onClick={() => handleStartAttempt(card.id)}
                        className="w-full rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-4 py-3 text-sm shadow-xs transition-colors disabled:opacity-50"
                      >
                        {startingCardId === card.id ? 'Iniciando…' : 'Empezar actividad ✨'}
                      </button>
                    ) : card.latestAttempt ? (
                      <Link
                        href={`/actividad/${card.latestAttempt.id}`}
                        className="w-full flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-amber-950 font-bold px-4 py-2.5 text-xs transition-colors"
                      >
                        Ver detalles de entrega
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="w-full rounded-2xl bg-zinc-100 text-zinc-400 font-semibold px-4 py-2.5 text-xs cursor-not-allowed"
                      >
                        Actividad no disponible
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
