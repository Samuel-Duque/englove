'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { ActivityEditor, ActivityEditorSchema } from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../../lib/api';
import { ActivityEditorComponent } from '../activity-editor';
import styles from '../activity-editor.module.css';

export function ActividadDetailSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/actividades" className={styles.backLink}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Volver a actividades
        </Link>
        <nav aria-label="Migas de pan de la actividad" className={styles.breadcrumbNav}>
          <Link href="/actividades" className={styles.breadcrumbLink}>
            Actividades
          </Link>
          <span aria-hidden="true">/</span>
          <span className={styles.breadcrumbCurrent}>Detalle y edición</span>
        </nav>
      </div>

      <div role="status" className={styles.skeletonWrap}>
        <span className="sr-only">Cargando actividad…</span>
        <div className={styles.skeletonHeader} />
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
      </div>
    </div>
  );
}

export function ActividadDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const {
    data: activity,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['teacher', 'activity', id],
    queryFn: ({ signal }) =>
      apiFetch<ActivityEditor>(`/api/v1/activities/${id}`, {
        schema: ActivityEditorSchema,
        signal,
      }),
  });

  const isNotFound = queryError instanceof ApiError && queryError.statusCode === 404;
  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError instanceof Error
        ? queryError.message
        : null;

  if (isLoading) {
    return <ActividadDetailSkeleton />;
  }

  if (error || !activity) {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <Link href="/actividades" className={styles.backLink}>
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            Volver a actividades
          </Link>
          <nav aria-label="Migas de pan de la actividad" className={styles.breadcrumbNav}>
            <Link href="/actividades" className={styles.breadcrumbLink}>
              Actividades
            </Link>
            <span aria-hidden="true">/</span>
            <span className={styles.breadcrumbCurrent}>Detalle y edición</span>
          </nav>
        </div>

        <section role="alert" className={styles.errorCard}>
          <div className={styles.errorCardHeader}>
            <CircleAlert size={22} strokeWidth={1.75} aria-hidden="true" />
            <h1>{isNotFound ? 'Actividad no encontrada' : 'No se pudo cargar la actividad'}</h1>
          </div>
          <p className={styles.errorCardBody}>
            {error || 'La actividad solicitada no existe o no pertenece a tu organización.'}
          </p>
          <div className={styles.errorCardActions}>
            <Link href="/actividades" className={styles.primaryButton}>
              Volver al catálogo
            </Link>
            {!isNotFound && (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? 'Reintentando…' : 'Reintentar'}
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <ActivityEditorComponent
      key={activity.id}
      initialActivity={activity}
      onActivityUpdated={(updated) => {
        queryClient.setQueryData(['teacher', 'activity', id], updated);
      }}
    />
  );
}
