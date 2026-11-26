'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  StudentFeedbackListResponse,
  StudentFeedbackListResponseSchema,
  StudentFeedbackItemView,
  RuntimeView,
  RuntimeViewSchema,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { fetchSharedProfile } from '../../../lib/auth-session';
import { ErrorState } from '../../../components/error-state';
import { FeedbackKids } from './feedback-kids';
import { FeedbackKidsLoading, FeedbackTeensLoading } from './feedback-loading';
import { FeedbackTeens } from './feedback-teens';

export function FeedbackClient() {
  const router = useRouter();
  const [retryError, setRetryError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [startingAssignmentId, setStartingAssignmentId] = useState<string | null>(null);
  const { data: profile, isPending: isProfileLoading } = useQuery({
    queryKey: ['student', 'profile', 'shell'],
    queryFn: () => fetchSharedProfile(),
    retry: false,
  });
  const isKids = (profile?.student?.ageSegment ?? 'kids') === 'kids';

  const { data: feedbackData, isLoading, isFetching, error: queryError, refetch: loadFeedback } = useQuery({
    queryKey: ['student', 'feedback'],
    queryFn: () =>
      apiFetch<StudentFeedbackListResponse>('/api/v1/student/feedback', {
        schema: StudentFeedbackListResponseSchema,
      }),
  });

  const items: StudentFeedbackItemView[] = feedbackData?.items || [];

  const toggleHistory = (assignmentId: string) => {
    setExpandedHistory((prev) => ({
      ...prev,
      [assignmentId]: !prev[assignmentId],
    }));
  };

  const retryMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch<RuntimeView>(`/api/v1/assignments/${assignmentId}/attempts`, {
        method: 'POST',
        schema: RuntimeViewSchema,
      }),
    onSuccess: (runtime) => {
      router.push(`/actividad/${runtime.attempt.id}`);
    },
    onError: (err: unknown) => {
      setRetryError(err instanceof ApiError ? err.message : 'No fue posible iniciar el nuevo intento.');
      setStartingAssignmentId(null);
    },
  });

  const handleStartRetry = (assignmentId: string) => {
    setStartingAssignmentId(assignmentId);
    setRetryError(null);
    retryMutation.mutate(assignmentId);
  };

  if (isProfileLoading) return <FeedbackKidsLoading />;

  if (isKids) {
    if (isLoading || (isFetching && !feedbackData)) return <FeedbackKidsLoading />;
    if (queryError && !feedbackData) {
      return (
        <ErrorState
          variant="kids"
          message="No pudimos cargar tus comentarios. Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => { void loadFeedback(); }}
        />
      );
    }

    return (
      <FeedbackKids
        items={items}
        expandedHistory={expandedHistory}
        onToggleHistory={toggleHistory}
        onStartRetry={handleStartRetry}
        startingAssignmentId={startingAssignmentId}
        retryError={retryError}
        onDismissRetryError={() => setRetryError(null)}
      />
    );
  }

  if (isLoading || (isFetching && !feedbackData)) return <FeedbackTeensLoading />;
  if (queryError && !feedbackData) {
    return (
      <ErrorState
        variant="teens"
        message="No pudimos cargar tu retroalimentación. Revisa tu conexión e inténtalo de nuevo."
        onRetry={() => { void loadFeedback(); }}
      />
    );
  }

  return (
    <FeedbackTeens
      items={items}
      expandedHistory={expandedHistory}
      onToggleHistory={toggleHistory}
      onStartRetry={handleStartRetry}
      startingAssignmentId={startingAssignmentId}
      retryError={retryError}
      onDismissRetryError={() => setRetryError(null)}
    />
  );
}
