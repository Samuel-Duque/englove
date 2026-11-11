'use client';

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityEditorComponent } from '../activity-editor';
import { ActivityEditor } from '@englove/shared';
import { apiFetch, ApiError } from '../../../../lib/api';

export function ActividadDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const { data: activity, isLoading, error: queryError } = useQuery({
    queryKey: ['teacher', 'activity', id],
    queryFn: () => apiFetch<ActivityEditor>(`/api/v1/activities/${id}`),
  });

  const error = queryError instanceof ApiError
    ? queryError.message
    : queryError instanceof Error
      ? queryError.message
      : null;

  if (isLoading) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm">
        Cargando actividad…
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div
        role="alert"
        className="rounded-lg bg-rose-50 border border-rose-200 p-6 text-center text-rose-800"
      >
        <p className="font-semibold text-base mb-1">No se pudo cargar la actividad</p>
        <p className="text-sm">{error || 'Actividad no encontrada'}</p>
      </div>
    );
  }

  return (
    <ActivityEditorComponent
      initialActivity={activity}
      onActivityUpdated={(updated) => {
        queryClient.setQueryData(['teacher', 'activity', id], updated);
      }}
    />
  );
}
