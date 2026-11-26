'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  AssignmentCardListResponseSchema,
  RuntimeViewSchema,
  type SessionView,
  type AssignmentCard,
  type AssignmentCardListResponse,
  type RuntimeView,
  type StudentProfileView,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../lib/api';
import { fetchSharedSession, fetchSharedProfile, requestSharedRefresh, clearSharedSession } from '../../lib/auth-session';
import { TeacherHome } from './teacher-home';
import { StudentShell } from '../../components/student-shell';
import { KidsInicio, type AssignmentFilter } from './kids-inicio';
import { TeensInicio } from './teens-inicio';
import { InicioLoading } from './inicio-loading';
import { AccessibleModal } from '../../components/ui/modal';

export function InicioClient() {
  const router = useRouter();
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<AssignmentFilter>('all');
  const [startingCardId, setStartingCardId] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async (): Promise<SessionView | null> => {
      let sessionData = await fetchSharedSession();
      if (!sessionData) {
        const refreshed = await requestSharedRefresh().catch(() => false);
        if (refreshed) {
          sessionData = await fetchSharedSession();
        }
      }
      if (!sessionData) {
        clearSharedSession();
        router.replace('/login');
        return null;
      }
      return sessionData;
    },
  });

  const session = sessionQuery.data ?? null;
  const activeUserId = session?.user.id ?? null;

  const cardsQuery = useQuery({
    queryKey: ['student', 'assignments', activeUserId],
    queryFn: () =>
      apiFetch<AssignmentCardListResponse>('/api/v1/me/assignments', {
        schema: AssignmentCardListResponseSchema,
      }),
    enabled: session?.user.role === 'student',
  });

  const profileQuery = useQuery({
    queryKey: ['student', 'profile', activeUserId],
    queryFn: () => fetchSharedProfile(),
    enabled: session?.user.role === 'student',
  });

  const startAttemptMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch<RuntimeView>(`/api/v1/assignments/${assignmentId}/attempts`, {
        method: 'POST',
        schema: RuntimeViewSchema,
      }),
    onSuccess: (data) => {
      router.push(`/actividad/${data.attempt.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setAttemptError(err.message || 'No se pudo iniciar el intento de la actividad.');
      } else {
        setAttemptError('Error de conexión al iniciar el intento. Verifica tu red y reintenta.');
      }
      setStartingCardId(null);
    },
  });

  const handleStartAttempt = (assignmentId: string) => {
    setStartingCardId(assignmentId);
    setAttemptError(null);
    startAttemptMutation.mutate(assignmentId);
  };

  const isNetworkError = sessionQuery.isError && sessionQuery.error instanceof Error &&
    (sessionQuery.error.message === 'NETWORK_ERROR' || sessionQuery.error.message.startsWith('SERVER_ERROR_'));

  const networkError = isNetworkError
    ? 'Hubo un problema de conexión con el servidor. Por favor, reintenta en unos instantes.'
    : null;

  const isLoading = sessionQuery.isLoading;

  const assignmentCards: AssignmentCard[] = cardsQuery.data?.items ?? [];
  const profile: StudentProfileView | null = profileQuery.data ?? null;

  if (networkError) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-6 text-center bg-zinc-50 outline-none">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm space-y-4">
          <span className="text-4xl" aria-hidden="true">⚠️</span>
          <h1 className="text-xl font-bold text-zinc-900">Error de conexión</h1>
          <p className="text-sm text-zinc-600">{networkError}</p>
          <button
            type="button"
            onClick={() => {
              void sessionQuery.refetch();
            }}
            className="w-full min-h-[48px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Reintentar conexión
          </button>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return <InicioLoading />;
  }

  if (session?.user.role === 'teacher') {
    return <TeacherHome user={session.user} />;
  }

  const studentTheme = profile?.student?.ageSegment ?? session?.student?.ageSegment ?? 'kids';
  if (session?.user.role === 'student' && studentTheme === 'kids') {
    return (
      <StudentShell profile={profile} ageSegment={studentTheme} studentName={session.user.name}>
        <AccessibleModal
          isOpen={!!attemptError}
          onClose={() => setAttemptError(null)}
          title="Aviso de actividad"
        >
          <div className="space-y-4">
            <p>{attemptError}</p>
            <div className="flex justify-end">
              <button type="button" className="kids-button" data-tone="orange" onClick={() => setAttemptError(null)}>
                Entendido
              </button>
            </div>
          </div>
        </AccessibleModal>
        <KidsInicio
          userId={session.user.id}
          name={session.user.name}
          level={profile?.student?.level ?? session.student?.level}
          cards={assignmentCards}
          activeFilter={activeFilter}
          setFilter={setActiveFilter}
          startingCardId={startAttemptMutation.isPending ? startingCardId : null}
          onStart={handleStartAttempt}
          isLoading={cardsQuery.isLoading}
          hasError={cardsQuery.isError && !cardsQuery.data}
          onRetry={() => void cardsQuery.refetch()}
        />
      </StudentShell>
    );
  }

  // Student Experience (Teens)
  return (
    <StudentShell
      profile={profile}
      ageSegment="teens"
      studentName={session?.user.name}
    >
      <AccessibleModal
        isOpen={!!attemptError}
        onClose={() => setAttemptError(null)}
        title="Aviso de actividad"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">{attemptError}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAttemptError(null)}
              className="teens-button"
              data-tone="orange"
            >
              Entendido
            </button>
          </div>
        </div>
      </AccessibleModal>

      {session?.user && (
        <TeensInicio
          userId={session.user.id}
          name={session.user.name}
          level={profile?.student?.level ?? session.student?.level}
          cards={assignmentCards}
          activeFilter={activeFilter}
          setFilter={setActiveFilter}
          startingCardId={startAttemptMutation.isPending ? startingCardId : null}
          onStart={handleStartAttempt}
          isLoading={cardsQuery.isLoading}
          hasError={cardsQuery.isError && !cardsQuery.data}
          onRetry={() => void cardsQuery.refetch()}
        />
      )}
    </StudentShell>
  );
}
