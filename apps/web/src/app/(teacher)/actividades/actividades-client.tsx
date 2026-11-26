'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CircleAlert, CheckCircle2, Info, Plus, X } from 'lucide-react';
import {
  ActivitySummary,
  ActivitySummarySchema,
  ActivityListResponse,
  ActivityListResponseSchema,
  ActivityType,
  ActivityStatus,
  Level,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { ErrorState } from '../../../components/error-state';
import {
  EditorialConfirmDialog,
  EditorialTable,
  TeacherStatusBadge,
} from '../../../components/teacher-editorial';
import styles from './actividades.module.css';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Completar espacios',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

const statusBadgeKinds = {
  [ActivityStatus.draft]: 'activityDraft',
  [ActivityStatus.published]: 'activityPublished',
  [ActivityStatus.archived]: 'activityArchived',
} as const;

export function ActividadesClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [deletingActivity, setDeletingActivity] = useState<ActivitySummary | null>(null);

  const activitiesQuery = useQuery({
    queryKey: ['teacher', 'activities', statusFilter, typeFilter, levelFilter],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (statusFilter === 'archived') {
        params.set('status', ActivityStatus.archived);
      }
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      if (levelFilter !== 'all') {
        params.set('level', levelFilter);
      }
      params.set('limit', '100');
      return apiFetch<ActivityListResponse>(`/api/v1/activities?${params.toString()}`, {
        schema: ActivityListResponseSchema,
        signal,
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ActivitySummary>(`/api/v1/activities/${id}/duplicate`, {
        method: 'POST',
        schema: ActivitySummarySchema,
      }),
    onSuccess: (duplicated) => {
      setActionSuccess('Actividad duplicada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['teacher', 'activities'] });
      router.push(`/actividades/${duplicated.id}`);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo duplicar la actividad');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/activities/${id}/archive`, { method: 'POST' }),
    onSuccess: () => {
      setActionSuccess('Actividad archivada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['teacher', 'activities'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo archivar la actividad');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/activities/${id}/restore`, { method: 'POST' }),
    onSuccess: () => {
      setActionSuccess('Actividad restaurada al catálogo');
      queryClient.invalidateQueries({ queryKey: ['teacher', 'activities'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo restaurar la actividad');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/activities/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setActionSuccess('Borrador eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['teacher', 'activities'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'ACTIVITY_DELETE_NOT_ALLOWED') {
          setActionError('No es posible eliminar la actividad: solo se pueden eliminar borradores sin asignaciones.');
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('No se pudo eliminar la actividad');
      }
    },
    onSettled: () => {
      setDeletingActivity(null);
    },
  });

  const handleDuplicate = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    duplicateMutation.mutate(id);
  };

  const handleArchive = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    archiveMutation.mutate(id);
  };

  const handleRestore = (id: string) => {
    setActionError(null);
    setActionSuccess(null);
    restoreMutation.mutate(id);
  };

  const handleDelete = (activity: ActivitySummary) => {
    setDeletingActivity(activity);
  };

  const handleConfirmDelete = () => {
    if (!deletingActivity) return;
    setActionError(null);
    setActionSuccess(null);
    deleteMutation.mutate(deletingActivity.id);
  };

  const isLoading = activitiesQuery.isLoading;
  const isMutatingRow =
    duplicateMutation.isPending ||
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    deleteMutation.isPending;
  const activities: ActivitySummary[] = activitiesQuery.data?.items || [];
  const total = activitiesQuery.data?.total || 0;
  const hasFilters = statusFilter !== 'active' || typeFilter !== 'all' || levelFilter !== 'all';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 id="activities-catalog-heading" className={styles.title}>
            Catálogo de Actividades
          </h1>
          <p className={styles.subtitle}>
            Diseña y gestiona actividades pedagógicas y microjuegos (niveles MCER A1–B2).
          </p>
        </div>
        <Link href="/actividades/nueva" className={styles.createButton}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          Crear actividad
        </Link>
      </header>

      {actionError && (
        <div role="alert" className={styles.alertError}>
          <span className={styles.alertMessage}>
            <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{actionError}</span>
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Cerrar mensaje de error"
            className={styles.alertDismiss}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div role="status" className={styles.alertSuccess}>
          <span className={styles.alertMessage}>
            <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{actionSuccess}</span>
          </span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            aria-label="Cerrar aviso"
            className={styles.alertDismiss}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      <section aria-label="Filtros del catálogo" className={styles.filtersBar}>
        <div className={styles.filtersControls}>
          <div className={styles.segmentedWrap}>
            <span id="catalog-status-label" className={styles.filterLabel}>
              Estado
            </span>
            <div role="group" aria-labelledby="catalog-status-label" className={styles.segmented}>
              <button
                type="button"
                aria-pressed={statusFilter === 'active'}
                onClick={() => setStatusFilter('active')}
                className={styles.segmentButton}
              >
                Catálogo activo
              </button>
              <button
                type="button"
                aria-pressed={statusFilter === 'archived'}
                onClick={() => setStatusFilter('archived')}
                className={styles.segmentButton}
              >
                Archivadas
              </button>
            </div>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="filter-type" className={styles.filterLabel}>
              Tipo de actividad
            </label>
            <select
              id="filter-type"
              name="filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">Todos los tipos</option>
              <option value={ActivityType.fill_blank}>{typeLabels[ActivityType.fill_blank]}</option>
              <option value={ActivityType.open_question}>{typeLabels[ActivityType.open_question]}</option>
              <option value={ActivityType.speaking}>{typeLabels[ActivityType.speaking]}</option>
              <option value={ActivityType.game}>{typeLabels[ActivityType.game]}</option>
              <option value={ActivityType.exam}>{typeLabels[ActivityType.exam]}</option>
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="filter-level" className={styles.filterLabel}>
              Nivel MCER
            </label>
            <select
              id="filter-level"
              name="filter-level"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">Todos los niveles</option>
              <option value={Level.A1}>A1</option>
              <option value={Level.A2}>A2</option>
              <option value={Level.B1}>B1</option>
              <option value={Level.B2}>B2</option>
            </select>
          </div>
        </div>

        <p className={styles.totalCount}>
          {total} actividad{total !== 1 ? 'es' : ''}
        </p>
      </section>

      <aside className={styles.callout} aria-label="Nota sobre actividades archivadas">
        <Info size={18} strokeWidth={1.75} className={styles.calloutIcon} aria-hidden="true" />
        <p>
          Archivar una actividad la oculta del catálogo activo, pero no cancela sus asignaciones existentes ni elimina las entregas.
        </p>
      </aside>

      {isLoading ? (
        <div role="status" className={styles.skeletonCard}>
          <span className="sr-only">Cargando catálogo de actividades…</span>
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      ) : activitiesQuery.isError && !activitiesQuery.data ? (
        <ErrorState
          variant="teacher"
          editorial
          message={
            activitiesQuery.error instanceof ApiError
              ? activitiesQuery.error.message
              : 'No pudimos cargar el catálogo de actividades.'
          }
          onRetry={() => void activitiesQuery.refetch()}
        />
      ) : activities.length === 0 ? (
        <div className={styles.emptyCard}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <BookOpen size={22} strokeWidth={1.65} />
          </span>
          {!hasFilters ? (
            <>
              <h2 className={styles.emptyTitle}>Aún no tienes actividades</h2>
              <p className={styles.emptyDescription}>
                Crea tu primera actividad para empezar a armar tus clases, ejercicios y asignaciones.
              </p>
              <div className={styles.emptyActions}>
                <Link href="/actividades/nueva" className={styles.createButton}>
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                  Crear actividad
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className={styles.emptyTitle}>No hay actividades que coincidan con estos filtros.</h2>
              <p className={styles.emptyDescription}>
                Prueba cambiando los criterios de búsqueda, revisando las archivadas o creando una nueva actividad.
              </p>
              <div className={styles.emptyActions}>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('active');
                    setTypeFilter('all');
                    setLevelFilter('all');
                  }}
                  className={styles.secondaryButton}
                >
                  Limpiar filtros
                </button>
                <Link href="/actividades/nueva" className={styles.createButton}>
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                  Crear actividad
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <EditorialTable labelledBy="activities-catalog-heading">
            <thead>
              <tr>
                <th scope="col">Título</th>
                <th scope="col">Tipo</th>
                <th scope="col">Nivel</th>
                <th scope="col">Estado</th>
                <th scope="col">Versión</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <tr key={act.id}>
                  <th scope="row">
                    <span lang="en" className={styles.activityTitle}>
                      {act.title}
                    </span>
                  </th>
                  <td className={styles.activityType}>{typeLabels[act.type]}</td>
                  <td>
                    <span className={styles.levelPill}>{act.level}</span>
                  </td>
                  <td>
                    <TeacherStatusBadge kind={statusBadgeKinds[act.status]} />
                  </td>
                  <td className={styles.tabularCell}>v{act.version}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        href={`/actividades/${act.id}`}
                        aria-label={`${act.status === ActivityStatus.archived ? 'Ver' : 'Editar'} actividad: ${act.title}`}
                        className={styles.actionEdit}
                      >
                        {act.status === ActivityStatus.archived ? 'Ver' : 'Editar'}
                      </Link>
                      <button
                        type="button"
                        disabled={isMutatingRow}
                        onClick={() => handleDuplicate(act.id)}
                        aria-label={`Duplicar actividad: ${act.title}`}
                        className={styles.actionNeutral}
                      >
                        Duplicar
                      </button>
                      {act.status === ActivityStatus.archived ? (
                        <button
                          type="button"
                          disabled={isMutatingRow}
                          onClick={() => handleRestore(act.id)}
                          aria-label={`Restaurar actividad: ${act.title}`}
                          className={styles.actionRestore}
                        >
                          Restaurar
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isMutatingRow}
                          onClick={() => handleArchive(act.id)}
                          aria-label={`Archivar actividad: ${act.title}`}
                          className={styles.actionArchive}
                        >
                          Archivar
                        </button>
                      )}
                      {act.status === ActivityStatus.draft && (
                        <button
                          type="button"
                          disabled={isMutatingRow}
                          onClick={() => handleDelete(act)}
                          aria-label={`Eliminar borrador: ${act.title}`}
                          className={styles.actionDelete}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </EditorialTable>
        </div>
      )}

      <EditorialConfirmDialog
        isOpen={!!deletingActivity}
        title="Eliminar borrador"
        message={
          deletingActivity
            ? `¿Seguro que deseas eliminar el borrador "${deletingActivity.title}"? Esta acción no se puede deshacer.`
            : '¿Seguro que deseas eliminar este borrador? Esta acción no se puede deshacer.'
        }
        confirmText="Eliminar borrador"
        cancelText="Cancelar"
        isDestructive={true}
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingActivity(null)}
      />
    </div>
  );
}
