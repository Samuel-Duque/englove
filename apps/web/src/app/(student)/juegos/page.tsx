'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActivityType,
  AttemptStatus,
  AssignmentCard,
  AssignmentCardListResponse,
  scoreToStars,
  GAME_MECHANIC_LABELS,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

interface FeatureFlagsResponse {
  flags: {
    games: boolean;
    extra_content: boolean;
  };
}

export default function JuegosPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [gamesEnabled, setGamesEnabled] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentCard[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [startingAssignmentId, setStartingAssignmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Check feature flags
        const flagRes = await apiFetch<FeatureFlagsResponse>('/api/v1/feature-flags');
        if (!isMounted) return;

        const isGamesOn = Boolean(flagRes.flags?.games);
        setGamesEnabled(isGamesOn);

        if (isGamesOn) {
          // 2. Fetch available & continuity assignment cards
          const [availRes, contRes] = await Promise.all([
            apiFetch<AssignmentCardListResponse>('/api/v1/me/assignments?scope=available'),
            apiFetch<AssignmentCardListResponse>('/api/v1/me/assignments?scope=continuity').catch(() => ({
              items: [],
              total: 0,
              offset: 0,
              limit: 0,
            })),
          ]);

          if (!isMounted) return;

          // Merge and filter only game activities (availRes takes precedence)
          const combinedMap = new Map<string, AssignmentCard>();
          for (const card of [...contRes.items, ...availRes.items]) {
            if (card.activity.type === ActivityType.game) {
              combinedMap.set(card.id, card);
            }
          }
          setAssignments(Array.from(combinedMap.values()));
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiError) setError(err.message);
          else setError('No se pudieron cargar los juegos.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartGame = async (assignmentId: string) => {
    setStartingAssignmentId(assignmentId);
    setError(null);
    try {
      const res = await apiFetch<{ attempt: { id: string } }>(
        `/api/v1/assignments/${assignmentId}/attempts`,
        {
          method: 'POST',
        },
      );
      router.push(`/actividad/${res.attempt.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo iniciar el juego');
      setStartingAssignmentId(null);
    }
  };

  // Filtered cards
  const filteredAssignments = assignments.filter((card) => {
    const latest = card.latestAttempt;
    const isCompleted = latest && latest.status === AttemptStatus.graded;

    if (filter === 'pending') return !isCompleted;
    if (filter === 'completed') return isCompleted;
    return true;
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm font-bold text-amber-900">Cargando la zona de juegos…</p>
      </div>
    );
  }

  // Feature Flag disabled state (SPEC-06 RF-11)
  if (!gamesEnabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100 text-4xl shadow-xs">
          🎮
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-amber-950">Zona de Juegos en preparación</h2>
          <p className="text-sm font-medium text-amber-900/80 max-w-md mx-auto leading-relaxed">
            La zona de juegos no está habilitada en este momento por la administración de tu institución.
          </p>
        </div>
        <div>
          <Link
            href="/inicio"
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-6 py-3 text-sm shadow-md transition-all min-h-12"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-amber-200/80 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🎮</span>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-950">Zona de Juegos</h1>
          </div>
          <p className="text-sm font-medium text-amber-900/80">
            Aprende y practica inglés divirtiéndote con microjuegos interactivos.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-amber-200/50 border border-amber-300/60 self-start sm:self-auto">
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'pending', label: 'Por jugar' },
              { key: 'completed', label: 'Completados' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all min-h-9 ${
                filter === tab.key
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-950/70 hover:bg-amber-200/80 hover:text-amber-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold text-center">
          {error}
        </div>
      )}

      {/* Games Grid */}
      {filteredAssignments.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-amber-50/50 border border-dashed border-amber-300 space-y-3">
          <span className="text-4xl block">🎲</span>
          <p className="text-base font-bold text-amber-950">Aún no tienes juegos asignados</p>
          <p className="text-xs text-amber-900/70 max-w-sm mx-auto">
            Cuando tu profesora te asigne actividades lúdicas, aparecerán aquí para que juegues cuantas veces quieras.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((card) => {
            const latest = card.latestAttempt;
            const isFinished = latest && latest.status === AttemptStatus.graded;
            const isInProgress = latest && latest.status === AttemptStatus.in_progress;
            const stars = latest ? scoreToStars(latest.score) : 0;
            const isStarting = startingAssignmentId === card.id;

            // Guess mechanic label from title or fallback
            return (
              <div
                key={card.id}
                className="rounded-3xl bg-white border-2 border-amber-200/80 p-5 shadow-xs hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                      Nivel {card.activity.level}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                      🎮 {card.activity.mechanic ? GAME_MECHANIC_LABELS[card.activity.mechanic] : 'Microjuego'}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-amber-950 leading-snug line-clamp-2">
                    {card.activity.title}
                  </h3>

                  {/* Stars and Attempt Info */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((star) => (
                        <span
                          key={star}
                          className={`text-base ${
                            star <= stars ? 'opacity-100 scale-110' : 'opacity-25 grayscale'
                          }`}
                        >
                          ⭐
                        </span>
                      ))}
                      {latest?.score !== null && latest?.score !== undefined && (
                        <span className="text-xs font-extrabold text-amber-900 ml-1.5">
                          {Number(latest.score).toFixed(1)}
                        </span>
                      )}
                    </div>

                    {latest && (
                      <span className="text-xs font-bold text-zinc-500">
                        Intento #{latest.attemptNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons (<= 3 clicks from /inicio) */}
                <div className="pt-3 border-t border-amber-100 space-y-2">
                  {isInProgress ? (
                    <Link
                      href={`/actividad/${latest!.id}`}
                      className="w-full min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                    >
                      <span>▶️</span>
                      <span>Continuar juego</span>
                    </Link>
                  ) : isFinished ? (
                    <div className="flex flex-col gap-2">
                      {card.canStart ? (
                        <button
                          type="button"
                          disabled={isStarting}
                          onClick={() => handleStartGame(card.id)}
                          className="w-full min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span>🔄</span>
                          <span>{isStarting ? 'Iniciando…' : 'Jugar de nuevo'}</span>
                        </button>
                      ) : (
                        <div className="text-center py-2.5 text-xs font-bold text-zinc-500 bg-zinc-100 rounded-xl border border-zinc-200">
                          🔒 Juego cerrado (plazo finalizado)
                        </div>
                      )}

                      <Link
                        href={`/actividad/${latest!.id}`}
                        className="w-full min-h-10 rounded-xl bg-amber-100/70 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>👀 Ver último resultado</span>
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isStarting}
                      onClick={() => handleStartGame(card.id)}
                      className="w-full min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <span>🎮</span>
                      <span>{isStarting ? 'Iniciando…' : 'Empezar juego'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
