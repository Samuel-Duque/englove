'use client';

import React, { useState, useEffect, use, Suspense } from 'react';
import { ActivityEditorComponent } from '../activity-editor';
import { ActivityEditor } from '@englove/shared';
import { apiFetch, ApiError } from '../../../../lib/api';

function EditarActividadContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activity, setActivity] = useState<ActivityEditor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivity() {
      try {
        const data = await apiFetch<ActivityEditor>(`/api/v1/activities/${id}`);
        setActivity(data);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError('Error al cargar la actividad');
      } finally {
        setIsLoading(false);
      }
    }
    loadActivity();
  }, [id]);

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

  return <ActivityEditorComponent initialActivity={activity} />;
}

export default function EditarActividadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando actividad…</div>}>
      <EditarActividadContent params={params} />
    </Suspense>
  );
}
