'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  StudentGameCard,
  StudentGamesListResponse,
  GAME_MECHANIC_LABELS,
  scoreToGameStars,
  getGameMotivationMessage,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { fetchSharedFeatureFlags } from '../../../lib/feature-flags-client';

export function JuegosClient() {
  const router = useRouter();

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [startingGameId, setStartingGameId] = useState<string | null>(null);
  const [speakingGameId, setSpeakingGameId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const flagRes = await fetchSharedFeatureFlags();
      if (!flagRes) throw new Error('No se pudieron obtener las feature flags');
      return flagRes;
    },
  });

  const gamesEnabled = Boolean(flagsQuery.data?.flags?.games);

  const gamesQuery = useQuery({
    queryKey: ['student', 'games'],
    queryFn: () => apiFetch<StudentGamesListResponse>('/api/v1/me/games'),
    enabled: gamesEnabled,
  });

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startGameMutation = useMutation({
    mutationFn: (gameId: string) =>
      apiFetch<{ attempt: { id: string } }>(`/api/v1/activities/${gameId}/attempts`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      router.push(`/actividad/${res.attempt.id}`);
    },
    onError: (err: unknown, gameId: string) => {
      const game = games.find((g) => g.id === gameId);
      if (err instanceof ApiError) {
        if (err.code === 'ATTEMPT_ALREADY_EXISTS' && game?.inProgressAttemptId) {
          router.push(`/actividad/${game.inProgressAttemptId}`);
          return;
        }
        setActionError(err.message);
      } else {
        setActionError('No se pudo iniciar el juego');
      }
      setStartingGameId(null);
    },
  });

  const isLoading = flagsQuery.isLoading || (gamesEnabled && gamesQuery.isLoading);
  const games: StudentGameCard[] = gamesQuery.data?.items || [];
  const error = actionError || (flagsQuery.error instanceof Error ? flagsQuery.error.message : null) || (gamesQuery.error instanceof Error ? gamesQuery.error.message : null);

  const handleSpeak = (game: StudentGameCard) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speakingGameId === game.id) {
      window.speechSynthesis.cancel();
      setSpeakingGameId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const text = game.title;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.onend = () => setSpeakingGameId(null);
    utterance.onerror = () => setSpeakingGameId(null);
    setSpeakingGameId(game.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleStartGame = (game: StudentGameCard) => {
    // If there is already an in-progress attempt, navigate directly to it
    if (game.status === 'in_progress' && game.inProgressAttemptId) {
      router.push(`/actividad/${game.inProgressAttemptId}`);
      return;
    }

    setStartingGameId(game.id);
    setActionError(null);
    startGameMutation.mutate(game.id);
  };

  // Filtered cards
  const filteredGames = games.filter((game) => {
    if (filter === 'pending') return game.status !== 'completed';
    if (filter === 'completed') return game.status === 'completed';
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

  // Feature flag check (SPEC-06 RF-11)
  if (!gamesEnabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <div className="text-5xl" aria-hidden="true">🎮</div>
        <h1 className="text-2xl font-black text-amber-950">Microjuegos no disponibles</h1>
        <p className="text-sm text-zinc-600">
          La zona de juegos interactivos no está habilitada en este momento. Por favor, consulta más tarde con tu profesora.
        </p>
        <div className="pt-4">
          <Link
            href="/inicio"
            className="inline-flex items-center px-4 py-2.5 rounded-2xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-amber-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl" aria-hidden="true">🎮</span>
            <h1 className="text-3xl font-black tracking-tight text-amber-950">
              Zona de Microjuegos
            </h1>
          </div>
          <p className="text-sm font-medium text-amber-900/80 mt-1">
            Practica inglés jugando de forma autónoma. ¡Gana estrellas y repasa todas las veces que quieras!
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-amber-100/60 p-1.5 rounded-2xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
              filter === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-900 hover:bg-amber-200/60'
            }`}
          >
            Todos ({games.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
              filter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-900 hover:bg-amber-200/60'
            }`}
          >
            Por practicar ({games.filter((g) => g.status !== 'completed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
              filter === 'completed'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-900 hover:bg-amber-200/60'
            }`}
          >
            Jugados ({games.filter((g) => g.status === 'completed').length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-bold underline hover:no-underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Games Grid or Empty State */}
      {filteredGames.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-amber-50/50 border border-dashed border-amber-300 space-y-3">
          <span className="text-4xl block" aria-hidden="true">🎲</span>
          <p className="text-base font-bold text-amber-950">
            Todavía no hay juegos publicados para practicar. ¡Vuelve pronto!
          </p>
          <p className="text-xs text-amber-900/70 max-w-sm mx-auto">
            Cuando tu profesora publique microjuegos interactivos, aparecerán aquí para que practiques cuantas veces quieras.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map((game) => {
            const isCompleted = game.status === 'completed';
            const isInProgress = game.status === 'in_progress';
            const stars =
              game.bestStars ??
              (game.bestScore !== undefined && game.bestScore !== null
                ? scoreToGameStars(game.bestScore)
                : (game.lastStars ?? 0));
            const motivationMessage =
              game.bestScore !== undefined && game.bestScore !== null
                ? getGameMotivationMessage(game.bestScore)
                : stars > 0
                  ? getGameMotivationMessage(stars === 3 ? 5.0 : stars === 2 ? 3.5 : 1.5)
                  : null;
            const isStarting = startingGameId === game.id;
            const isSpeaking = speakingGameId === game.id;

            return (
              <div
                key={game.id}
                className="rounded-3xl bg-white border-2 border-amber-200/80 p-5 shadow-xs hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                      Nivel {game.level}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                      🎮 {game.mechanic ? GAME_MECHANIC_LABELS[game.mechanic] : 'Microjuego'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-black text-amber-950 leading-snug line-clamp-2">
                      {game.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleSpeak(game)}
                      aria-label={isSpeaking ? `Detener lectura de ${game.title}` : `Escuchar ${game.title}`}
                      className="shrink-0 inline-flex items-center justify-center min-h-[48px] min-w-[48px] p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition-colors cursor-pointer"
                    >
                      {isSpeaking ? '⏹' : '🔊'}
                    </button>
                  </div>

                  {/* Stars and Practice Info */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1" aria-label={`Estrellas de práctica: ${stars} de 3`}>
                        {[1, 2, 3].map((star) => (
                          <span
                            key={star}
                            className={`text-base ${
                              star <= stars ? 'opacity-100 scale-110' : 'opacity-25 grayscale'
                            }`}
                            aria-hidden="true"
                          >
                            ⭐
                          </span>
                        ))}
                      </div>

                      {game.attemptsCount > 0 && (
                        <span className="text-xs font-bold text-zinc-500">
                          {game.attemptsCount} {game.attemptsCount === 1 ? 'partida' : 'partidas'}
                        </span>
                      )}
                    </div>

                    {motivationMessage && (
                      <p className="text-xs font-semibold text-amber-900/80 leading-snug">
                        {motivationMessage}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons (SPEC-11 §7.1) */}
                <div className="pt-3 border-t border-amber-100 space-y-2">
                  {isInProgress && game.inProgressAttemptId ? (
                    <Link
                      href={`/actividad/${game.inProgressAttemptId}`}
                      className="w-full min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                    >
                      <span aria-hidden="true">▶️</span>
                      <span>Reanudar partida</span>
                    </Link>
                  ) : isCompleted ? (
                    <button
                      type="button"
                      disabled={isStarting}
                      onClick={() => handleStartGame(game)}
                      className="w-full min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
                    >
                      <span aria-hidden="true">🔄</span>
                      <span>{isStarting ? 'Iniciando…' : 'Jugar de nuevo'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isStarting}
                      onClick={() => handleStartGame(game)}
                      className="w-full min-h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
                    >
                      <span aria-hidden="true">🎮</span>
                      <span>{isStarting ? 'Iniciando…' : 'Jugar'}</span>
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
