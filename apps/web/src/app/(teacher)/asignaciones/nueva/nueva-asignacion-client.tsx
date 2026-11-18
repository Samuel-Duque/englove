"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivityListResponse,
  ActivityListResponseSchema,
  ActivityType,
  ActivityStatus,
  Level,
  GroupListResponse,
  GroupListResponseSchema,
  CreateAssignmentResponse,
  CreateAssignmentResponseSchema,
  formatBogotaDateTime,
  getExtendedDueAt,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../../lib/api";

import { activityTypeLabels } from "../../actividades/activity-labels";

export function NuevaAsignacionClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const activitiesQuery = useQuery({
    queryKey: ["teacher", "activities", "published"],
    queryFn: () =>
      apiFetch<ActivityListResponse>(
        `/api/v1/activities?status=${ActivityStatus.published}&limit=100`,
        { schema: ActivityListResponseSchema },
      ),
  });

  const groupsQuery = useQuery({
    queryKey: ["teacher", "groups", "active"],
    queryFn: () =>
      apiFetch<GroupListResponse>("/api/v1/groups?archived=false&limit=100", {
        schema: GroupListResponseSchema,
      }),
  });

  const activities = useMemo(() => {
    return (activitiesQuery.data?.items ?? []).filter(
      (a) => a.type !== ActivityType.game,
    );
  }, [activitiesQuery.data]);

  const groups = groupsQuery.data?.items ?? [];
  const isLoading = activitiesQuery.isLoading || groupsQuery.isLoading;
  const loadError =
    (activitiesQuery.error instanceof ApiError
      ? activitiesQuery.error.message
      : activitiesQuery.error instanceof Error
        ? activitiesQuery.error.message
        : null) ||
    (groupsQuery.error instanceof ApiError
      ? groupsQuery.error.message
      : groupsQuery.error instanceof Error
        ? groupsQuery.error.message
        : null);

  // Form selection state
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [opensAtInput, setOpensAtInput] = useState<string>("");
  const [dueAtInput, setDueAtInput] = useState<string>("");

  // Filters for activity selector
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Submit & Error states
  const [formError, setFormError] = useState<string | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);

  const showError = (msg: string) => {
    setFormError(msg);
    setTimeout(() => {
      errorAlertRef.current?.focus();
    }, 50);
  };

  useEffect(() => {
    // Default dates: opens tomorrow at 08:00, due in 7 days at 18:00 (Bogota time)
    const now = new Date();
    const bogotaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const tomorrow = new Date(bogotaNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(bogotaNow);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const y1 = tomorrow.getUTCFullYear();
    const m1 = String(tomorrow.getUTCMonth() + 1).padStart(2, "0");
    const d1 = String(tomorrow.getUTCDate()).padStart(2, "0");
    setOpensAtInput(`${y1}-${m1}-${d1}T08:00`);

    const y2 = nextWeek.getUTCFullYear();
    const m2 = String(nextWeek.getUTCMonth() + 1).padStart(2, "0");
    const d2 = String(nextWeek.getUTCDate()).padStart(2, "0");
    setDueAtInput(`${y2}-${m2}-${d2}T18:00`);
  }, []);

  const createMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<CreateAssignmentResponse>("/api/v1/assignments", {
        method: "POST",
        body: JSON.stringify(body),
        schema: CreateAssignmentResponseSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "assignments"] });
      const count = selectedGroupIds.length;
      const msg =
        count === 1
          ? "Asignación creada"
          : `Asignaciones creadas en ${count} grupos`;
      router.push(`/asignaciones?notice=${encodeURIComponent(msg)}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === "ASSIGNMENT_ALREADY_ACTIVE") {
          showError(
            "La actividad ya tiene una asignación activa en uno de los grupos seleccionados",
          );
        } else if (err.code === "ACTIVITY_NOT_ASSIGNABLE") {
          showError("Solo puedes asignar actividades publicadas");
        } else if (err.code === "GROUP_ARCHIVED") {
          showError("Uno de los grupos fue archivado. Elige un grupo activo");
        } else if (err.statusCode === 403) {
          showError("No tienes acceso a esta sección");
        } else if (err.statusCode === 404) {
          showError(
            "No encontramos esta asignación o alguno de los recursos seleccionados",
          );
        } else if (err.statusCode === 429) {
          showError("Espera un momento antes de volver a intentarlo");
        } else {
          showError(
            err.message ||
              "No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo",
          );
        }
      } else {
        showError(
          "No pudimos guardar. Revisa las asignaciones antes de volver a intentarlo",
        );
      }
    },
  });

  const isSubmitting = createMutation.isPending;

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (levelFilter !== "all" && act.level !== levelFilter) return false;
      if (typeFilter !== "all" && act.type !== typeFilter) return false;
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
    if (!val) return "";
    const parts = val.split(":");
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
      showError("Por favor selecciona una actividad");
      return;
    }

    if (selectedGroupIds.length === 0) {
      showError("Por favor selecciona al menos un grupo");
      return;
    }

    if (!opensAtInput || !dueAtInput) {
      showError("Revisa la fecha y la hora");
      return;
    }

    const opensAtIso = getIsoBogota(opensAtInput);
    const dueAtIso = getIsoBogota(dueAtInput);

    const opensDate = new Date(opensAtIso);
    const dueDate = new Date(dueAtIso);

    if (opensDate.getTime() >= dueDate.getTime()) {
      showError("La apertura debe ser anterior al cierre");
      return;
    }

    createMutation.mutate({
      activityId: selectedActivityId,
      groupIds: selectedGroupIds,
      opensAt: opensAtIso,
      dueAt: dueAtIso,
    });
  };

  if (isLoading) {
    return (
      <div className="origami-state" role="status">
        Cargando opciones…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="origami-state origami-state--error space-y-3 mx-auto mt-8 max-w-xl"
      >
        <p className="font-medium">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            void activitiesQuery.refetch();
            void groupsQuery.refetch();
          }}
          className="origami-button"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Empty state: no published activities
  if (activities.length === 0) {
    return (
      <div className="origami-card mx-auto mt-8 max-w-xl space-y-3 text-center">
        <h1 className="origami-page-title">
          Publica una actividad para poder asignarla
        </h1>
        <p className="text-xs text-(--origami-text-secondary) mt-2">
          Solo las actividades con estado publicada pueden asignarse a los
          estudiantes.
        </p>
        <div className="mt-4">
          <Link href="/actividades" className="origami-button">
            Ir al catálogo de actividades
          </Link>
        </div>
      </div>
    );
  }

  // Empty state: no active groups
  if (groups.length === 0) {
    return (
      <div className="origami-card mx-auto mt-8 max-w-xl space-y-3 text-center">
        <h1 className="origami-page-title">
          Crea un grupo activo para poder asignar
        </h1>
        <p className="text-xs text-(--origami-text-secondary) mt-2">
          Necesitas al menos un grupo activo de estudiantes para poder asignar
          una actividad.
        </p>
        <div className="mt-4">
          <Link href="/grupos" className="origami-button">
            Ir a gestión de grupos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="origami-shell mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="origami-meta flex flex-wrap items-center gap-2">
        <Link
          href="/asignaciones"
          className="origami-button origami-button--text"
        >
          Asignaciones
        </Link>
        <span>/</span>
        <span className="text-(--origami-text-primary) font-medium">
          Nueva asignación
        </span>
      </div>

      <div className="border-b border-(--origami-border-subtle) pb-4">
        <h1 className="origami-page-title">Nueva asignación</h1>
        <p className="text-sm text-(--origami-text-secondary) mt-1">
          Selecciona una actividad publicada, uno o varios grupos y define las
          fechas de apertura y cierre.
        </p>
      </div>

      {formError && (
        <div
          ref={errorAlertRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="origami-state origami-state--error flex items-center justify-between gap-2"
        >
          <span>{formError}</span>
          <button
            type="button"
            onClick={() => setFormError(null)}
            className="origami-button origami-button--text"
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Select Activity */}
        <section className="origami-card space-y-4">
          <div className="grid gap-3">
            <div>
              <h2 id="assignment-activity-label" className="origami-card-title">
                1. Selecciona la actividad
              </h2>
              <p className="text-xs text-(--origami-text-secondary)">
                Solo se muestran actividades publicadas.
              </p>
            </div>

            {/* Activity Filters */}
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                id="new-assignment-filter-level"
                name="new-assignment-filter-level"
                aria-label="Filtrar por nivel"
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="origami-field"
              >
                <option value="all">Todos los niveles</option>
                <option value={Level.A1}>Nivel A1</option>
                <option value={Level.A2}>Nivel A2</option>
                <option value={Level.B1}>Nivel B1</option>
                <option value={Level.B2}>Nivel B2</option>
              </select>

              <select
                id="new-assignment-filter-type"
                name="new-assignment-filter-type"
                aria-label="Filtrar por tipo"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="origami-field"
              >
                <option value="all">Todos los tipos</option>
                <option value={ActivityType.fill_blank}>Rellenar huecos</option>
                <option value={ActivityType.open_question}>
                  Pregunta abierta
                </option>
                <option value={ActivityType.speaking}>Speaking</option>
                <option value={ActivityType.exam}>Examen</option>
              </select>
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <p className="text-xs text-(--origami-text-secondary) italic py-4">
              No hay actividades publicadas que coincidan con los filtros.
            </p>
          ) : (
            <div
              className="grid max-h-80 gap-2 overflow-y-auto p-1.5 sm:grid-cols-2"
              role="radiogroup"
              aria-labelledby="assignment-activity-label"
            >
              {filteredActivities.map((act) => {
                const isSelected = act.id === selectedActivityId;
                return (
                  <label
                    key={act.id}
                    className={`flex items-start gap-3 min-h-12 min-w-0 rounded-xl border p-3 cursor-pointer ${
                      isSelected
                        ? "border-(--origami-border-control) bg-(--origami-surface-soft)"
                        : "border-(--origami-border-subtle) hover:bg-(--origami-surface-soft)"
                    }`}
                  >
                    <input
                      type="radio"
                      name="activity"
                      value={act.id}
                      checked={isSelected}
                      onChange={() => setSelectedActivityId(act.id)}
                      className="size-5 shrink-0 accent-(--origami-primary) mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-(--origami-text-primary)">
                        {act.title}
                      </p>
                      <p className="text-xs text-(--origami-text-secondary) mt-0.5">
                        {activityTypeLabels[act.type]} · Nivel {act.level} · v
                        {act.version}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2: Multi-Group Selection */}
        <section className="origami-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="assignment-groups-label" className="origami-card-title">
                2. Selecciona los grupos destinatarios
              </h2>
              <p className="text-xs text-(--origami-text-secondary)">
                Puedes asignar a uno o varios grupos activos a la vez.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSelectAllGroups}
              className="origami-button origami-button--text"
            >
              {selectedGroupIds.length === groups.length
                ? "Deseleccionar todos"
                : "Seleccionar todos"}
            </button>
          </div>

          <div
            className="grid gap-2 sm:grid-cols-3 p-1"
            role="group"
            aria-labelledby="assignment-groups-label"
          >
            {groups.map((group) => {
              const isChecked = selectedGroupIds.includes(group.id);
              return (
                <label
                  key={group.id}
                  className={`flex items-center gap-3 min-h-12 min-w-0 rounded-xl border p-3 cursor-pointer ${
                    isChecked
                      ? "border-(--origami-border-control) bg-(--origami-surface-soft)"
                      : "border-(--origami-border-subtle) hover:bg-(--origami-surface-soft)"
                  }`}
                >
                  <input
                    type="checkbox"
                    value={group.id}
                    checked={isChecked}
                    onChange={() => handleGroupToggle(group.id)}
                    className="size-5 shrink-0 accent-(--origami-primary)"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-(--origami-text-primary)">
                      {group.name}
                    </p>
                    <p className="text-xs text-(--origami-text-secondary)">
                      {group.activeStudentCount} alumno
                      {group.activeStudentCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Step 3: Dates & Policy */}
        <section className="origami-card space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="origami-card-title">3. Fechas y plazos</h2>
              <span className="text-xs font-semibold text-(--origami-text-secondary) bg-(--origami-surface-soft) px-2 py-1 rounded-md">
                Hora de Colombia (America/Bogota)
              </span>
            </div>
            <p className="text-xs text-(--origami-text-secondary) mt-1">
              Establece el momento a partir del cual los alumnos pueden ver la
              actividad y el límite para iniciarla.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="opens-at" className="origami-label block">
                Apertura
              </label>
              <input
                id="opens-at"
                type="datetime-local"
                value={opensAtInput}
                onChange={(e) => setOpensAtInput(e.target.value)}
                className="origami-field mt-1"
              />
              <span className="text-[11px] text-(--origami-text-secondary) mt-1 block">
                Los alumnos verán la actividad disponible desde esta fecha y
                hora.
              </span>
            </div>

            <div>
              <label htmlFor="due-at" className="origami-label block">
                Cierre para empezar
              </label>
              <input
                id="due-at"
                type="datetime-local"
                value={dueAtInput}
                onChange={(e) => setDueAtInput(e.target.value)}
                className="origami-field mt-1"
              />
              {/* Mandatory text next to closure (SPEC-04 RF-7, §7) */}
              <p className="origami-state origami-state--warning mt-2">
                <span className="font-semibold">Regla de entrega:</span> los
                alumnos pueden empezar hasta esta hora; quien haya empezado
                tendrá hasta 24 horas más para terminar.
              </p>
            </div>
          </div>
        </section>

        {/* Step 4: Summary Before Saving */}
        <section className="rounded-xl border border-(--origami-border-subtle) bg-(--origami-surface-soft) p-5 space-y-3">
          <h2 className="origami-card-title">Resumen previo a guardar</h2>
          <div className="text-xs text-(--origami-text-primary) space-y-1.5">
            <div>
              <span className="font-semibold">Actividad:</span>{" "}
              {selectedActivity
                ? `${selectedActivity.title} (Nivel ${selectedActivity.level}, v${selectedActivity.version})`
                : "Ninguna seleccionada"}
            </div>
            <div>
              <span className="font-semibold">
                Grupos seleccionados ({selectedGroups.length}):
              </span>{" "}
              {selectedGroups.length > 0
                ? selectedGroups.map((g) => g.name).join(", ")
                : "Ninguno seleccionado"}
            </div>
            <div>
              <span className="font-semibold">Apertura:</span>{" "}
              {opensAtInput
                ? formatBogotaDateTime(getIsoBogota(opensAtInput))
                : "—"}
            </div>
            <div>
              <span className="font-semibold">Cierre para empezar:</span>{" "}
              {dueAtInput
                ? formatBogotaDateTime(getIsoBogota(dueAtInput))
                : "—"}
            </div>
            {extendedDueAtText && (
              <div className="pt-2 border-t border-(--origami-border-subtle) font-medium text-(--origami-info-text)">
                Última hora para terminar si empezó a tiempo:{" "}
                <span className="font-bold">{extendedDueAtText}</span>
              </div>
            )}
          </div>
        </section>

        {/* Submit Actions */}
        <div className="flex items-center flex-wrap justify-end gap-3 pt-4 border-t border-(--origami-border-subtle)">
          <Link
            href="/asignaciones"
            className="origami-button origami-button--secondary"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="origami-button"
          >
            {isSubmitting ? "Guardando…" : "Crear asignación"}
          </button>
        </div>
      </form>
    </div>
  );
}
