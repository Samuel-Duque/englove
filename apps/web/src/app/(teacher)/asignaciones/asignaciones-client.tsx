'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, Info, Plus, X } from 'lucide-react';
import {
  AssignmentListResponse,
  AssignmentListResponseSchema,
  AssignmentAvailability,
  AssignmentView,
  GroupListResponse,
  GroupListResponseSchema,
  ActivityType,
  formatBogotaDateTime,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { ErrorState } from '../../../components/error-state';
import { TeacherStatusBadge } from '../../../components/teacher-editorial';
import styles from './asignaciones.module.css';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Completar espacios',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

const availabilityBadgeKinds: Record<
  AssignmentAvailability,
  'assignmentOpen' | 'assignmentScheduled' | 'assignmentClosed' | 'assignmentCancelled'
> = {
  [AssignmentAvailability.open]: 'assignmentOpen',
  [AssignmentAvailability.scheduled]: 'assignmentScheduled',
  [AssignmentAvailability.closed]: 'assignmentClosed',
  [AssignmentAvailability.cancelled]: 'assignmentCancelled',
};

type ComplianceState =
  | { kind: 'cancelled' }
  | { kind: 'progress'; completed: number; denominator: number; percent: number; isComplete: boolean }
  | { kind: 'pendingSummary'; obligated: number }
  | { kind: 'unavailable' };

function resolveCompliance(
  assignment: AssignmentView,
  groupActiveCount: number | undefined,
): ComplianceState {
  if (assignment.availability === AssignmentAvailability.cancelled) {
    return { kind: 'cancelled' };
  }

  const obligated =
    assignment.historicalStudentCount ??
    (typeof assignment.totalAttempts === 'number'
      ? assignment.totalAttempts
      : typeof groupActiveCount === 'number'
        ? groupActiveCount
        : null);

  if (typeof assignment.submittedAttempts === 'number') {
    const completed = assignment.submittedAttempts;
    const denominator = obligated ?? 0;
    const percent =
      denominator > 0 ? Math.min(100, Math.round((completed / denominator) * 100)) : 0;
    const isComplete = denominator > 0 && completed >= denominator;
    return { kind: 'progress', completed, denominator, percent, isComplete };
  }

  if (obligated !== null) {
    return { kind: 'pendingSummary', obligated };
  }

  return { kind: 'unavailable' };
}

function getAssignmentsErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof ApiError) {
    if (err.statusCode === 404) {
      return 'No encontramos esta asignación o alguno de los recursos seleccionados';
    }
    if (err.statusCode === 403) {
      return 'No tienes acceso a esta sección';
    }
    if (err.statusCode === 429) {
      return 'Espera un momento antes de volver a intentarlo';
    }
    return err.message || 'No pudimos cargar las asignaciones';
  }
  return 'No pudimos cargar las asignaciones';
}

export function AsignacionesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const notice = searchParams.get('notice');
  const selectedGroup = searchParams.get('groupId') || 'all';
  const selectedAvailability = searchParams.get('availability') || 'all';

  // Load all groups (including archived ones for historical filter, SPEC-04 RF-9)
  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'all'],
    queryFn: ({ signal }) =>
      apiFetch<GroupListResponse>('/api/v1/groups?limit=100', {
        schema: GroupListResponseSchema,
        signal,
      }),
  });

  const assignmentsQuery = useQuery({
    queryKey: ['teacher', 'assignments', selectedGroup, selectedAvailability],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (selectedGroup !== 'all') {
        params.set('groupId', selectedGroup);
      }
      if (selectedAvailability !== 'all') {
        params.set('availability', selectedAvailability);
      }
      params.set('limit', '100');
      return apiFetch<AssignmentListResponse>(`/api/v1/assignments?${params.toString()}`, {
        schema: AssignmentListResponseSchema,
        signal,
      });
    },
  });

  const groups = groupsQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.items ?? [];
  const total = assignmentsQuery.data?.total ?? 0;
  const isLoading = assignmentsQuery.isLoading;
  const error = getAssignmentsErrorMessage(assignmentsQuery.error);

  const groupCountById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.activeStudentCount])),
    [groups],
  );

  const replaceParams = (params: URLSearchParams) => {
    const query = params.toString();
    router.replace(query ? `/asignaciones?${query}` : '/asignaciones');
  };

  const handleGroupFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') params.delete('groupId');
    else params.set('groupId', val);
    replaceParams(params);
  };

  const handleAvailabilityFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') params.delete('availability');
    else params.set('availability', val);
    replaceParams(params);
  };

  const handleResetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('groupId');
    params.delete('availability');
    replaceParams(params);
  };

  const handleDismissNotice = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('notice');
    replaceParams(params);
  };

  const isFiltered = selectedGroup !== 'all' || selectedAvailability !== 'all';

  return (
    <div className={styles.page}>
      {notice && (
        <div role="status" aria-live="polite" className={styles.notice}>
          <span className={styles.noticeContent}>
            <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{notice}</span>
          </span>
          <button
            type="button"
            onClick={handleDismissNotice}
            className={styles.noticeClose}
            aria-label="Cerrar aviso"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Asignaciones</h1>
          <p className={styles.subtitle}>
            Gestiona las actividades asignadas a tus grupos y haz seguimiento al cumplimiento.
          </p>
        </div>
        <Link href="/asignaciones/nueva" className={styles.primaryCta}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          Nueva asignación
        </Link>
      </header>

      <div className={styles.callout} role="note" aria-label="Regla sobre microjuegos">
        <Info size={18} strokeWidth={1.75} className={styles.calloutIcon} aria-hidden="true" />
        <p>
          Solo se asignan actividades evaluables (Completar espacios, Pregunta abierta, Speaking y
          Examen). Los <strong>microjuegos</strong> nunca requieren asignación: al publicarse quedan
          disponibles 24/7 en el portal del estudiante para práctica autónoma.
        </p>
      </div>

      <section aria-label="Filtros de asignaciones" className={styles.filtersBar}>
        <div className={styles.filterField}>
          <label htmlFor="group-filter" className={styles.filterLabel}>
            Grupo
          </label>
          <select
            id="group-filter"
            value={selectedGroup}
            onChange={handleGroupFilterChange}
            className={styles.select}
          >
            <option value="all">Todos los grupos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.archivedAt ? ' (Archivado)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterField}>
          <label htmlFor="availability-filter" className={styles.filterLabel}>
            Disponibilidad
          </label>
          <select
            id="availability-filter"
            value={selectedAvailability}
            onChange={handleAvailabilityFilterChange}
            className={styles.select}
          >
            <option value="all">Todas</option>
            <option value={AssignmentAvailability.scheduled}>Programadas</option>
            <option value={AssignmentAvailability.open}>Abiertas</option>
            <option value={AssignmentAvailability.closed}>Cerradas</option>
            <option value={AssignmentAvailability.cancelled}>Canceladas</option>
          </select>
        </div>

        <div className={styles.summaryWrap}>
          <span className={styles.countPill}>
            {total} asignaci{total === 1 ? 'ón' : 'ones'}
          </span>
        </div>
      </section>

      {groupsQuery.isError && (
        <div role="status" className={styles.inlineWarning}>
          <Info size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>No pudimos cargar el filtro de grupos; mostramos las asignaciones disponibles.</span>
        </div>
      )}

      <div className={styles.listSection}>
        <h2 id="assignments-list-heading" className="sr-only">
          Listado de asignaciones
        </h2>

        {isLoading ? (
          <div role="status" className={styles.skeletonCard}>
            <span className="sr-only">Cargando asignaciones…</span>
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
            <div className={styles.skeletonRow} />
          </div>
        ) : error ? (
          <ErrorState
            variant="teacher"
            editorial
            message={error}
            onRetry={() => {
              void assignmentsQuery.refetch();
            }}
          />
        ) : assignments.length === 0 ? (
          <div className={styles.emptyCard}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <ClipboardList size={22} strokeWidth={1.65} />
            </span>
            <h3 className={styles.emptyTitle}>
              {isFiltered
                ? 'No hay asignaciones con estos filtros'
                : 'Aún no tienes asignaciones'}
            </h3>
            <p className={styles.emptyDescription}>
              {isFiltered
                ? 'Prueba cambiando los filtros de grupo o disponibilidad para consultar otros resultados.'
                : 'Asigna actividades evaluables a tus grupos para que los estudiantes comiencen a practicar.'}
            </p>
            <div className={styles.emptyActions}>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={styles.secondaryButton}
                >
                  Limpiar filtros
                </button>
              )}
              <Link href="/asignaciones/nueva" className={styles.primaryCta}>
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                Nueva asignación
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.timezoneNote}>
              Horarios mostrados en hora de Colombia (America/Bogota).
            </p>
            <div
              className={styles.tableWrapper}
              role="region"
              aria-labelledby="assignments-list-heading"
              tabIndex={0}
            >
              <table className={styles.table}>
                <caption className="sr-only">
                  Asignaciones registradas con grupo, ventana de disponibilidad y cumplimiento
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Actividad</th>
                    <th scope="col">Grupo</th>
                    <th scope="col">Apertura</th>
                    <th scope="col">Cierre</th>
                    <th scope="col">Disponibilidad</th>
                    <th scope="col">Cumplimiento</th>
                    <th scope="col">
                      <span className="sr-only">Acción</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => {
                    const badgeKind =
                      availabilityBadgeKinds[assignment.availability] ?? 'assignmentOpen';
                    const compliance = resolveCompliance(
                      assignment,
                      groupCountById.get(assignment.group.id),
                    );

                    return (
                      <tr key={assignment.id}>
                        <th scope="row" className={styles.activityCell}>
                          <span lang="en" className={styles.activityTitle}>
                            {assignment.activity.title}
                          </span>
                          <span className={styles.activityMeta}>
                            {typeLabels[assignment.activity.type]} · Nivel {assignment.activity.level}{' '}
                            · v{assignment.activity.version}
                          </span>
                        </th>

                        <td data-label="Grupo" className={styles.groupCell}>
                          <span className={styles.groupName}>{assignment.group.name}</span>
                          {assignment.group.archivedAt && (
                            <span className={styles.archivedTag}>(Archivado)</span>
                          )}
                        </td>

                        <td data-label="Apertura">
                          <time dateTime={assignment.opensAt} className={styles.dateValue}>
                            {formatBogotaDateTime(assignment.opensAt)}
                          </time>
                        </td>

                        <td data-label="Cierre">
                          <time dateTime={assignment.dueAt} className={styles.dateValue}>
                            {formatBogotaDateTime(assignment.dueAt)}
                          </time>
                        </td>

                        <td data-label="Disponibilidad">
                          <TeacherStatusBadge kind={badgeKind} />
                        </td>

                        <td data-label="Cumplimiento">
                          {compliance.kind === 'progress' ? (
                            <div className={styles.complianceStack}>
                              <div
                                className={styles.progressTrack}
                                role="progressbar"
                                aria-valuenow={compliance.completed}
                                aria-valuemin={0}
                                aria-valuemax={compliance.denominator}
                                aria-label={`Cumplimiento: ${compliance.completed} de ${compliance.denominator} estudiantes`}
                              >
                                <div
                                  className={styles.progressFill}
                                  data-complete={compliance.isComplete ? 'true' : undefined}
                                  style={{ width: `${compliance.percent}%` }}
                                />
                              </div>
                              <span className={styles.complianceFraction}>
                                {compliance.completed} / {compliance.denominator}
                              </span>
                            </div>
                          ) : compliance.kind === 'pendingSummary' ? (
                            <div className={styles.complianceStack}>
                              <div className={styles.progressTrack} aria-hidden="true" />
                              <span className={styles.complianceMuted}>
                                — / {compliance.obligated}
                                <span className="sr-only">
                                  {' '}
                                  estudiantes en el grupo (detalle de entregas en ficha)
                                </span>
                              </span>
                            </div>
                          ) : compliance.kind === 'cancelled' ? (
                            <span
                              className={styles.complianceMuted}
                              aria-label="No aplica, asignación cancelada"
                            >
                              —
                            </span>
                          ) : (
                            <span className={styles.complianceMuted}>—</span>
                          )}
                        </td>

                        <td className={styles.actionCell}>
                          <Link
                            href={`/asignaciones/${encodeURIComponent(assignment.id)}`}
                            className={styles.detailLink}
                            aria-label={`Ver detalle de asignación: ${assignment.activity.title} para ${assignment.group.name}`}
                          >
                            Ver detalle
                            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
