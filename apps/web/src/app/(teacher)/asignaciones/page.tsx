'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AssignmentView,
  AssignmentListResponse,
  AssignmentAvailability,
  GroupView,
  GroupListResponse,
  ActivityType,
  formatBogotaDateTime,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Rellenar huecos',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

const availabilityBadges: Record<
  AssignmentAvailability,
  { label: string; bg: string; text: string }
> = {
  [AssignmentAvailability.scheduled]: {
    label: 'Programada',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  [AssignmentAvailability.open]: {
    label: 'Abierta',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
  [AssignmentAvailability.closed]: {
    label: 'Cerrada',
    bg: 'bg-zinc-100 border-zinc-200',
    text: 'text-zinc-600',
  },
  [AssignmentAvailability.cancelled]: {
    label: 'Cancelada',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
  },
};

function AssignmentsListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const notice = searchParams.get('notice');
  const initialGroupId = searchParams.get('groupId') || 'all';
  const initialAvailability = searchParams.get('availability') || 'all';

  const [assignments, setAssignments] = useState<AssignmentView[]>([]);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroup, setSelectedGroup] = useState<string>(initialGroupId);
  const [selectedAvailability, setSelectedAvailability] =
    useState<string>(initialAvailability);

  // Sync state if query params change externally (browser navigation, direct links)
  useEffect(() => {
    const g = searchParams.get('groupId') || 'all';
    const a = searchParams.get('availability') || 'all';
    setSelectedGroup(g);
    setSelectedAvailability(a);
  }, [searchParams]);

  // Load all groups (including archived ones for historical filter, SPEC-04 RF-9)
  const fetchGroups = useCallback(async () => {
    try {
      const data = await apiFetch<GroupListResponse>('/api/v1/groups?limit=100');
      setGroups(data.items);
    } catch {
      // Ignore group list error here, main error handled in fetchAssignments
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedGroup !== 'all') {
        params.set('groupId', selectedGroup);
      }
      if (selectedAvailability !== 'all') {
        params.set('availability', selectedAvailability);
      }
      params.set('limit', '100');

      const data = await apiFetch<AssignmentListResponse>(
        `/api/v1/assignments?${params.toString()}`,
      );
      setAssignments(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setError('No encontramos esta asignación o alguno de los recursos seleccionados');
        } else if (err.statusCode === 403) {
          setError('No tienes acceso a esta sección');
        } else if (err.statusCode === 429) {
          setError('Espera un momento antes de volver a intentarlo');
        } else {
          setError(err.message || 'No pudimos cargar las asignaciones');
        }
      } else {
        setError('No pudimos cargar las asignaciones');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedGroup, selectedAvailability]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleGroupFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedGroup(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') params.delete('groupId');
    else params.set('groupId', val);
    router.replace(`/asignaciones?${params.toString()}`);
  };

  const handleAvailabilityFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const val = e.target.value;
    setSelectedAvailability(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val === 'all') params.delete('availability');
    else params.set('availability', val);
    router.replace(`/asignaciones?${params.toString()}`);
  };

  const handleDismissNotice = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('notice');
    const query = params.toString();
    router.replace(`/asignaciones${query ? '?' + query : ''}`);
  };

  const isFiltered = selectedGroup !== 'all' || selectedAvailability !== 'all';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Success notice banner (SPEC-04 RF-15, §7) */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex justify-between items-center shadow-xs"
        >
          <span className="font-semibold">{notice}</span>
          <button
            type="button"
            onClick={handleDismissNotice}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Asignaciones
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Gestiona las actividades asignadas a tus grupos de estudiantes.
          </p>
        </div>
        <div>
          <Link
            href="/asignaciones/nueva"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            + Nueva asignación
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <label
            htmlFor="group-filter"
            className="text-xs font-semibold text-zinc-700"
          >
            Grupo:
          </label>
          <select
            id="group-filter"
            value={selectedGroup}
            onChange={handleGroupFilterChange}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los grupos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.archivedAt ? '(Archivado)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="availability-filter"
            className="text-xs font-semibold text-zinc-700"
          >
            Disponibilidad:
          </label>
          <select
            id="availability-filter"
            value={selectedAvailability}
            onChange={handleAvailabilityFilterChange}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas</option>
            <option value={AssignmentAvailability.scheduled}>Programadas</option>
            <option value={AssignmentAvailability.open}>Abiertas</option>
            <option value={AssignmentAvailability.closed}>Cerradas</option>
            <option value={AssignmentAvailability.cancelled}>Canceladas</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-zinc-500 font-medium">
          {total} asignaci{total === 1 ? 'ón' : 'ones'}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 text-center text-zinc-500 text-sm">
          Cargando asignaciones…
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800"
        >
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={fetchAssignments}
            className="mt-3 inline-flex items-center rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Reintentar
          </button>
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
          <p className="text-base font-semibold text-zinc-800">
            {isFiltered
              ? 'No hay asignaciones con estos filtros'
              : 'Aún no tienes asignaciones'}
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {isFiltered
              ? 'Prueba cambiando los filtros de grupo o disponibilidad para ver más resultados.'
              : 'Asigna actividades a tus grupos para que los estudiantes comiencen a practicar.'}
          </p>
          {!isFiltered && (
            <div className="mt-4">
              <Link
                href="/asignaciones/nueva"
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                + Nueva asignación
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => {
            const badge =
              availabilityBadges[assignment.availability] ||
              availabilityBadges[AssignmentAvailability.open];

            return (
              <div
                key={assignment.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs text-zinc-500 font-medium">
                      v{assignment.activity.version}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-zinc-900 line-clamp-2">
                      {assignment.activity.title}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {typeLabels[assignment.activity.type]} · Nivel{' '}
                      {assignment.activity.level}
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-700 font-medium">
                      <span>Grupo:</span>
                      <span className="font-semibold text-zinc-900 truncate max-w-[150px]">
                        {assignment.group.name}
                        {assignment.group.archivedAt && (
                          <span className="text-amber-600 ml-1 font-normal">
                            (Archivado)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Apertura:</span>
                      <span className="font-mono text-[11px]">
                        {formatBogotaDateTime(assignment.opensAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>Cierre:</span>
                      <span className="font-mono text-[11px]">
                        {formatBogotaDateTime(assignment.dueAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">
                    Hora de Colombia
                  </span>
                  <Link
                    href={`/asignaciones/${assignment.id}`}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Ver detalles →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-zinc-500 text-sm">
          Cargando asignaciones…
        </div>
      }
    >
      <AssignmentsListContent />
    </Suspense>
  );
}
