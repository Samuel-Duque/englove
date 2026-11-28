'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  StudentGameCard,
  StudentGamesListResponse,
  StudentGamesListResponseSchema,
  z,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { fetchSharedFeatureFlags } from '../../../lib/feature-flags-client';
import { fetchSharedProfile } from '../../../lib/auth-session';
import { GamesCampLoading } from './games-camp-loading';
import { KidsGamesCamp } from './kids-games-camp';
import { TeensGamesLoading } from './teens-games-loading';
import { TeensGamesZone } from './teens-games-zone';

const flagsUnavailableError = new Error(
  'No se pudo cargar el campamento. Recarga la página para intentarlo de nuevo.',
);

export function JuegosClient() {
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ['student', 'profile', 'shell'],
    queryFn: () => fetchSharedProfile(),
  });
  const ageSegment = profileQuery.data?.student?.ageSegment ?? 'kids';
  const isKids = ageSegment === 'kids';

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [startingGameId, setStartingGameId] = useState<string | null>(null);
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
    queryFn: () =>
      apiFetch<StudentGamesListResponse>('/api/v1/me/games', {
        schema: StudentGamesListResponseSchema,
      }),
    enabled: gamesEnabled,
  });

  const startGameMutation = useMutation({
    mutationFn: (gameId: string) =>
      apiFetch<{ attempt: { id: string } }>(`/api/v1/activities/${gameId}/attempts`, {
        method: 'POST',
        schema: z.object({ attempt: z.object({ id: z.string() }) }),
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

  // La navegación comparte esta consulta y devuelve null si falla al cargar las opciones.
  const flagsError = flagsQuery.isError || flagsQuery.data === null ? flagsUnavailableError : null;
  const queryError = flagsError ?? (gamesEnabled ? gamesQuery.error : null);
  const isWaitingForNetwork =
    (!flagsQuery.data && flagsQuery.isPaused) ||
    (gamesEnabled && !gamesQuery.data && gamesQuery.isPaused);

  if (isKids) {
    if (isLoading) return <GamesCampLoading />;

    return (
      <KidsGamesCamp
        games={games}
        filteredGames={filteredGames}
        filter={filter}
        onFilterChange={setFilter}
        gamesEnabled={gamesEnabled}
        catalogAvailable={gamesQuery.data !== undefined}
        queryError={queryError}
        isWaitingForNetwork={isWaitingForNetwork}
        actionError={actionError}
        onDismissActionError={() => setActionError(null)}
        startingGameId={startingGameId}
        onStart={handleStartGame}
      />
    );
  }

  if (isLoading) return <TeensGamesLoading />;

  return (
    <TeensGamesZone
      games={games}
      filteredGames={filteredGames}
      filter={filter}
      onFilterChange={setFilter}
      gamesEnabled={gamesEnabled}
      catalogAvailable={gamesQuery.data !== undefined}
      queryError={queryError}
      isWaitingForNetwork={isWaitingForNetwork}
      actionError={actionError}
      onDismissActionError={() => setActionError(null)}
      startingGameId={startingGameId}
      onStart={handleStartGame}
    />
  );
}
