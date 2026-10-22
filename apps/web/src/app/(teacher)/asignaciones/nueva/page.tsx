'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActivitySummary,
  ActivityListResponse,
  ActivityType,
  ActivityStatus,
  Level,
  GroupView,
  GroupListResponse,
  CreateAssignmentResponse,
  formatBogotaDateTime,
  getExtendedDueAt,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../../lib/api';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Rellenar huecos',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

export default function NewAssignmentPage() {
  const router = useRouter();

  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form selection state
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [opensAtInput, setOpensAtInput] = useState<string>('');
  const [dueAtInput, setDueAtInput] = useState<string>('');

  // Filters for activity selector
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Submit & Error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);

  const showError = (msg: string) => {
    setFormError(msg);
    setTimeout(() => {
      errorAlertRef.current?.focus();
    }, 50);
  };

  const fetchOptions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [actData, grpData] = await Promise.all([
        apiFetch<ActivityListResponse>(
          `/api/v1/activities?status=${ActivityStatus.published}&limit=100`,
        ),
        apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100'),
      ]);
      setActivities(actData.items);
      setGroups(grpData.items);

      // Default dates: opens tomorrow at 08:00, due in 7 days at 18:00 (Bogota time)
      const now = new Date();
      const bogotaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const tomorrow = new Date(bogotaNow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(bogotaNow);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const y1 = tomorrow.getUTCFullYear();
      const m1 = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
      const d1 = String(tomorrow.getUTCDate()).padStart(2, '0');
      setOpensAtInput(`${y1}-${m1}-${d1}T08:00`);

      const y2 = nextWeek.getUTCFullYear();
      const m2 = String(nextWeek.getUTCMonth() + 1).padStart(2, '0');
      const d2 = String(nextWeek.getUTCDate()).padStart(2, '0');
      setDueAtInput(`${y2}-${m2}-${d2}T18:00`);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(err.message);
      } else {
        setLoadError('No pudimos cargar las opciones');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (levelFilter !== 'all' && act.level !== levelFilter) return false;
      if (typeFilter !== 'all' && act.type !== typeFilter) return false;
      return true;
    });
  }, [activities, levelFilter, typeFilter]);

  const selectedActivity = useMemo(() => {
    return activities.find((a) => a.id === selectedActivityId) || null;
  }, [activities, selectedActivityId]);

  const selectedGroups = useMemo(() => {
    return groups.filter((g) => selectedGroupIds.includes(g.id));
  }, [groups, selectedGroupIds]);

  const handleGroupToggle = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const handleSelectAllGroups = () => {
    if (selectedGroupIds.length === groups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(groups.map((g) => g.id));
    }
  };

  // Convert datetime-local (Bogota time) to ISO-8601 string with -05:00 offset
  const getIsoBogota = (val: string): string => {
    if (!val) return '';
    const parts = val.split(':');
    if (parts.length === 2) {
      return `${val}:00-05:00`;
    }
    return `${val}-05:00`;
  };

  const extendedDueAtText = useMemo(() => {
    if (!dueAtInput) return null;
    const iso = getIsoBogota(dueAtInput);
    try {
      const ext = getExtendedDueAt(iso);
      return formatBogotaDateTime(ext);
    } catch {
      return null;
    }
  }, [dueAtInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);

    if (!selectedActivityId) {
      showError('Por favor selecciona una actividad');
      return;
    }

    if (selectedGroupIds.length === 0) {
      showError('Por favor selecciona al menos un grupo');
      return;
    }

    if (!opensAtInput || !dueAtInput) {
      showError('Revisa la fecha y la hora');
      return;
    }

    const opensAtIso = getIsoBogota(opensAtInput);
    const dueAtIso = getIsoBogota(dueAtInput);

    const opensDate = new Date(opensAtIso);
    const dueDate = new Date(dueAtIso);

    if (opensDate.getTime() >= dueDate.getTime()) {
      showError('La apertura debe ser anterior al cierre');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch<CreateAssignmentResponse>('/api/v1/assignments', {
        method: 'POST',
        body: JSON.stringify({
          activityId: selectedActivityId,
          groupIds: selectedGroupIds,
          opensAt: opensAtIso,
          dueAt: dueAtIso,
        }),
      });

      const count = selectedGroupIds.length;
      const msg =
        count === 1
          ? 'Asignación creada'
          : `Asignaciones creadas en ${count} grupos`;
      // Pass message via query param or session notification
      router.push(`/asignaciones?notice=${encodeURIComponent(msg)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ASSIGNMENT_ALREADY_ACTIVE') {
          showError(
            'La actividad ya tiene una asignación activa en uno de los grupos seleccionados',
          );
        } else if (err.code === 'ACTIVITY_NOT_ASSIGNABLE') {
          showError('Solo puedes asignar actividades publicadas');
        } else if (err.code === 'GROUP_ARCHIVED') {
          showError('Uno de los grupos fue archivado. Elige un grupo activo');
        } else if (err.statusCode === 403) {
          showError('No tienes acceso a esta sección');
        } else if (err.statusCode === 404) {
          showError(
            'No encontramos esta asignación o alguno de los recursos seleccionados',
          );
        } else if (err.statusCode === 429) {
          showError('Espera un momento antes de volver a intentarlo');
        } else {
          showError(
            err.message ||
              'No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo',
          );
        }
      } else {
        showError(
          'No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-zinc-500 text-sm">
        Cargando opciones…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 max-w-xl mx-auto mt-8"
      >
        <p className="font-medium">{loadError}</p>
        <button
          type="button"
          onClick={fetchOptions}
          className="mt-3 inline-flex items-center rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Empty state: no published activities
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center max-w-xl mx-auto mt-8">
        <h2 className="text-base font-semibold text-zinc-900">
          Publica una actividad para poder asignarla
        </h2>
        <p className="text-xs text-zinc-500 mt-2">
          Solo las actividades con estado publicada pueden asignarse a los estudiantes.
        </p>
        <div className="mt-4">
          <Link
            href="/actividades"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Ir al catálogo de actividades
          </Link>
        </div>
      </div>
    );
  }

  // Empty state: no active groups
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center max-w-xl mx-auto mt-8">
        <h2 className="text-base font-semibold text-zinc-900">
          Crea un grupo activo para poder asignar
        </h2>
        <p className="text-xs text-zinc-500 mt-2">
          Necesitas al menos un grupo activo de estudiantes para poder asignar una actividad.
        </p>
        <div className="mt-4">
          <Link
            href="/grupos"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Ir a gestión de grupos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/asignaciones" className="hover:text-zinc-900">
          Asignaciones
        </Link>
        <span>/</span>
        <span className="text-zinc-800 font-medium">Nueva asignación</span>
      </div>

      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Nueva asignación
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Selecciona una actividad publicada, uno o varios grupos y define las fechas de apertura y cierre.
        </p>
      </div>

      {formError && (
        <div
          ref={errorAlertRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-rose-500"
        >
          <span>{formError}</span>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="text-rose-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Select Activity */}
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                1. Selecciona la actividad
              </h2>
              <p className="text-xs text-zinc-500">
                Solo se muestran actividades publicadas.
              </p>
            </div>

            {/* Activity Filters */}
            <div className="flex items-center gap-2">
              <select
                aria-label="Filtrar por nivel"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los niveles</option>
                <option value={Level.A1}>Nivel A1</option>
                <option value={Level.A2}>Nivel A2</option>
                <option value={Level.B1}>Nivel B1</option>
                <option value={Level.B2}>Nivel B2</option>
              </select>

              <select
                aria-label="Filtrar por tipo"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos los tipos</option>
                <option value={ActivityType.fill_blank}>Rellenar huecos</option>
                <option value={ActivityType.open_question}>Pregunta abierta</option>
                <option value={ActivityType.speaking}>Speaking</option>
                <option value={ActivityType.game}>Microjuego</option>
                <option value={ActivityType.exam}>Examen</option>
              </select>
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-4">
              No hay actividades publicadas que coincidan con los filtros.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 max-h-60 overflow-y-auto p-1">
              {filteredActivities.map((act) => {
                const isSelected = act.id === selectedActivityId;
                return (
                  <label
                    key={act.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activity"
                      value={act.id}
                      checked={isSelected}
                      onChange={() => setSelectedActivityId(act.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {act.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {typeLabels[act.type]} · Nivel {act.level} · v{act.version}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2: Multi-Group Selection */}
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                2. Selecciona los grupos destinatarios
              </h2>
              <p className="text-xs text-zinc-500">
                Puedes asignar a uno o varios grupos activos a la vez.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSelectAllGroups}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              {selectedGroupIds.length === groups.length
                ? 'Deseleccionar todos'
                : 'Seleccionar todos'}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 p-1">
            {groups.map((group) => {
              const isChecked = selectedGroupIds.includes(group.id);
              return (
                <label
                  key={group.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                      : 'border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={group.id}
                    checked={isChecked}
                    onChange={() => handleGroupToggle(group.id)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {group.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {group.activeStudentCount} alumno{group.activeStudentCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Step 3: Dates & Policy */}
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900">
                3. Fechas y plazos
              </h2>
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                Hora de Colombia (America/Bogota)
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Establece el momento a partir del cual los alumnos pueden ver la actividad y el límite para iniciarla.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="opens-at"
                className="block text-xs font-semibold text-zinc-700"
              >
                Apertura
              </label>
              <input
                id="opens-at"
                type="datetime-local"
                value={opensAtInput}
                onChange={(e) => setOpensAtInput(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Los alumnos verán la actividad disponible desde esta fecha y hora.
              </span>
            </div>

            <div>
              <label
                htmlFor="due-at"
                className="block text-xs font-semibold text-zinc-700"
              >
                Cierre para empezar
              </label>
              <input
                id="due-at"
                type="datetime-local"
                value={dueAtInput}
                onChange={(e) => setDueAtInput(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {/* Mandatory text next to closure (SPEC-04 RF-7, §7) */}
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 leading-relaxed">
                <span className="font-semibold">Regla de entrega:</span> los alumnos pueden empezar hasta esta hora; quien haya empezado tendrá hasta 24 horas más para terminar.
              </p>
            </div>
          </div>
        </section>

        {/* Step 4: Summary Before Saving */}
        <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 space-y-3">
          <h2 className="text-sm font-bold text-zinc-900">
            Resumen previo a guardar
          </h2>
          <div className="text-xs text-zinc-700 space-y-1.5">
            <div>
              <span className="font-semibold">Actividad:</span>{' '}
              {selectedActivity
                ? `${selectedActivity.title} (Nivel ${selectedActivity.level}, v${selectedActivity.version})`
                : 'Ninguna seleccionada'}
            </div>
            <div>
              <span className="font-semibold">Grupos seleccionados ({selectedGroups.length}):</span>{' '}
              {selectedGroups.length > 0
                ? selectedGroups.map((g) => g.name).join(', ')
                : 'Ninguno seleccionado'}
            </div>
            <div>
              <span className="font-semibold">Apertura:</span>{' '}
              {opensAtInput
                ? formatBogotaDateTime(getIsoBogota(opensAtInput))
                : '—'}
            </div>
            <div>
              <span className="font-semibold">Cierre para empezar:</span>{' '}
              {dueAtInput
                ? formatBogotaDateTime(getIsoBogota(dueAtInput))
                : '—'}
            </div>
            {extendedDueAtText && (
              <div className="pt-2 border-t border-zinc-200 font-medium text-blue-900">
                Última hora para terminar si empezó a tiempo:{' '}
                <span className="font-bold">{extendedDueAtText}</span>
              </div>
            )}
          </div>
        </section>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
          <Link
            href="/asignaciones"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Guardando…' : 'Crear asignación'}
          </button>
        </div>
      </form>
    </div>
  );
}
