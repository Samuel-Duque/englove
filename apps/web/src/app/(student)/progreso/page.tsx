'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StudentProgressView, BadgeAwardView } from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

export default function StudentProgresoPage() {
  const [progress, setProgress] = useState<StudentProgressView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProgress() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch<StudentProgressView>('/api/v1/me/progress');
        if (isMounted) setProgress(data);
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError) setError(err.message);
          else setError('Error al cargar tu progreso');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadProgress();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="mt-3 text-sm font-semibold opacity-70">Cargando tus logros…</p>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="py-12 text-center bg-white p-8 rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-lg font-bold text-rose-900 mt-2">No pudimos cargar tu progreso</h2>
        <p className="text-sm text-rose-700 mt-1">{error || 'Intenta de nuevo más tarde'}</p>
      </div>
    );
  }

  const { streak, badges, activities } = progress;

  return (
    <div className="space-y-8 py-4">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950">
          Tu Progreso y Logros ⭐
        </h1>
        <p className="text-sm font-medium opacity-80 mt-1">
          ¡Revisa tus semanas activas, insignias y el historial de tus actividades entregadas!
        </p>
      </div>

      {/* Streak and Forgiveness Card */}
      <div className="rounded-3xl border border-amber-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
              🔥
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
                Racha Semanal
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-950">
                {streak.weeks} {streak.weeks === 1 ? 'semana' : 'semanas'} consecutivas
              </h2>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold border ${
              streak.forgivenessAvailable
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
          >
            <span>{streak.forgivenessAvailable ? '🛡️' : '⏳'}</span>
            <span>
              {streak.forgivenessAvailable
                ? 'Escudo de perdón activo'
                : `Recuperando escudo (${streak.activeWeeksSinceForgivenessUsed}/2 semanas)`}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed pt-2 border-t border-amber-100">
          {streak.forgivenessAvailable
            ? '¡Tienes tu escudo de perdón listo! Si una semana no realizas ninguna actividad, tu racha se mantendrá intacta.'
            : 'Has utilizado tu escudo de perdón. Completa al menos una actividad durante 2 semanas consecutivas para activarlo nuevamente.'}
        </p>
      </div>

      {/* Badges Gallery */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-black text-amber-950">
            Tus Insignias ({badges.length}) 🏅
          </h2>
        </div>

        {badges.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 p-8 text-center text-amber-900">
            <span className="text-3xl">🎯</span>
            <h3 className="font-bold text-sm mt-2">Aún no tienes insignias</h3>
            <p className="text-xs opacity-80 mt-1">
              Completa tu primera actividad o mantén tu racha para desbloquearlas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {badges.map((b: BadgeAwardView) => (
              <div
                key={b.id}
                className="rounded-2xl border border-amber-200/90 bg-white p-5 shadow-xs flex items-start gap-3.5 hover:shadow-md transition-shadow"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-2xl">
                  {b.icon || '🏅'}
                </span>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-amber-950 leading-snug">
                    {b.name}
                  </h3>
                  <p className="text-xs text-zinc-600 line-clamp-2">{b.description}</p>
                  <p className="text-[10px] font-semibold text-amber-700">
                    Ganada el {new Date(b.awardedAt).toLocaleDateString('es-CO')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity History */}
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-black text-amber-950">
          Historial de Actividades Entregadas 📚
        </h2>

        {(!activities || activities.length === 0) ? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-white p-8 text-center text-zinc-500 text-sm">
            No has completado actividades aún. ¡Empieza una desde la página de Inicio!
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden shadow-xs">
            <ul className="divide-y divide-amber-100">
              {activities.map((act) => {
                return (
                  <li
                    key={act.attemptId}
                    className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 hover:bg-amber-50/40 transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-extrabold text-amber-950">
                        Intento #{act.attemptId.slice(0, 8)}
                      </h4>
                      <p className="text-xs text-zinc-500 mt-0.5">Actividad calificada</p>
                    </div>

                    <div className="flex items-center gap-4">
                      {act.score !== null ? (
                        <div className="text-right">
                          <div className="text-sm text-amber-400 font-bold" title={`${act.stars} estrellas`}>
                            {'★'.repeat(act.stars) + '☆'.repeat(3 - act.stars)}
                          </div>
                          <span className="text-xs font-black text-amber-950">
                            {Number(act.score).toFixed(1)} / 5.0
                          </span>
                        </div>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                          En revisión
                        </span>
                      )}

                      <Link
                        href={`/actividad/${act.attemptId}`}
                        className="rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors"
                      >
                        Ver detalles
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
