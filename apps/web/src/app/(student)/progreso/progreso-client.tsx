'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { StudentProgressView, StudentProgressViewSchema } from '@upward-english/shared';
import { apiFetch } from '../../../lib/api';
import { fetchSharedProfile } from '../../../lib/auth-session';
import { ProgresoKids, ProgresoKidsError, ProgresoKidsLoading } from './progreso-kids';
import { ProgresoTeens, ProgresoTeensError, ProgresoTeensLoading } from './progreso-teens';

export function ProgresoClient() {
  const profileQuery = useQuery({
    queryKey: ['student', 'profile', 'shell'],
    queryFn: () => fetchSharedProfile(),
  });
  const ageSegment = profileQuery.data?.student?.ageSegment ?? 'kids';
  const isKids = ageSegment === 'kids';

  const { data: progress, isLoading, isFetching, error: queryError, refetch } = useQuery({
    queryKey: ['student', 'progress'],
    queryFn: () =>
      apiFetch<StudentProgressView>('/api/v1/me/progress', {
        schema: StudentProgressViewSchema,
      }),
  });

  if (isKids) {
    if (isLoading || (isFetching && !progress)) return <ProgresoKidsLoading />;
    if (queryError || !progress) {
      return <ProgresoKidsError onRetry={() => { void refetch(); }} />;
    }
    return <ProgresoKids progress={progress} />;
  }

  if (isLoading || (isFetching && !progress)) return <ProgresoTeensLoading />;
  if (queryError || !progress) {
    return <ProgresoTeensError onRetry={() => { void refetch(); }} />;
  }

  return <ProgresoTeens progress={progress} />;
}
