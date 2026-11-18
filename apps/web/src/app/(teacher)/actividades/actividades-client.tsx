"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivitySummary,
  ActivitySummarySchema,
  ActivityListResponse,
  ActivityListResponseSchema,
  ActivityType,
  ActivityStatus,
  Level,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";
import { ConfirmDialog } from "../../../components/ui/modal";

import { activityTypeLabels } from "./activity-labels";

const statusLabels: Record<ActivityStatus, { label: string; color: string }> = {
  [ActivityStatus.draft]: { label: "Borrador", color: "origami-state" },
  [ActivityStatus.published]: {
    label: "Publicada",
    color: "origami-state origami-state--success",
  },
  [ActivityStatus.archived]: {
    label: "Archivada",
    color: "origami-state origami-state--warning",
  },
};

export function ActividadesClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<
    "active" | "archived" | "all"
  >("active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(
    null,
  );

  const activitiesQuery = useQuery({
    queryKey: ["teacher", "activities", statusFilter, typeFilter, levelFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter === "archived") {
        params.set("status", ActivityStatus.archived);
      }
      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (levelFilter !== "all") {
        params.set("level", levelFilter);
      }
      params.set("limit", "100");
      return apiFetch<ActivityListResponse>(
        `/api/v1/activities?${params.toString()}`,
        {
          schema: ActivityListResponseSchema,
        },
      );
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<ActivitySummary>(`/api/v1/activities/${id}/duplicate`, {
        method: "POST",
        schema: ActivitySummarySchema,
      }),
    onSuccess: (duplicated) => {
      setActionSuccess("Actividad duplicada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["teacher", "activities"] });
      router.push(`/actividades/${duplicated.id}`);
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo duplicar la actividad",
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/activities/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      setActionSuccess("Actividad archivada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["teacher", "activities"] });
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo archivar la actividad",
      );
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/activities/${id}/restore`, { method: "POST" }),
    onSuccess: () => {
      setActionSuccess("Actividad restaurada al catálogo");
      queryClient.invalidateQueries({ queryKey: ["teacher", "activities"] });
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "No se pudo restaurar la actividad",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/activities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setActionSuccess("Borrador eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["teacher", "activities"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === "ACTIVITY_DELETE_NOT_ALLOWED") {
          setActionError(
            "No es posible eliminar la actividad: solo se pueden eliminar borradores sin asignaciones.",
          );
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError("No se pudo eliminar la actividad");
      }
    },
  });

  const handleDuplicate = (id: string) => {
    setActionError(null);
    duplicateMutation.mutate(id);
  };

  const handleArchive = (id: string) => {
    setActionError(null);
    archiveMutation.mutate(id);
  };

  const handleRestore = (id: string) => {
    setActionError(null);
    restoreMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    setDeletingActivityId(id);
  };

  const handleConfirmDelete = () => {
    const id = deletingActivityId;
    setDeletingActivityId(null);
    if (!id) return;
    setActionError(null);
    deleteMutation.mutate(id);
  };

  const isLoading = activitiesQuery.isLoading;
  const activities: ActivitySummary[] = activitiesQuery.data?.items || [];
  const total = activitiesQuery.data?.total || 0;
  const loadError = activitiesQuery.isError
    ? activitiesQuery.error instanceof ApiError
      ? activitiesQuery.error.message
      : "No pudimos cargar el catálogo de actividades."
    : null;

  return (
    <div className="origami-shell space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="origami-page-title">Catálogo de Actividades</h1>
          <p className="origami-meta mt-1">
            Diseña y gestiona el contenido pedagógico para tus grupos.
          </p>
        </div>
        <Link href="/actividades/nueva" className="origami-button self-start">
          Crear actividad
        </Link>
      </div>

      {/* Alerts */}
      {actionError && (
        <div
          role="alert"
          className="origami-state origami-state--error flex items-center justify-between gap-2"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="origami-button origami-button--text"
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className="origami-state origami-state--success flex items-center justify-between gap-2"
        >
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="origami-button origami-button--text"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="origami-card grid gap-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Status Tabs */}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Estado del catálogo"
          >
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              aria-pressed={statusFilter === "active"}
              className={`origami-button origami-button--secondary ${statusFilter === "active" ? "origami-selected" : ""}`}
            >
              Catálogo activo
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("archived")}
              aria-pressed={statusFilter === "archived"}
              className={`origami-button origami-button--secondary ${statusFilter === "archived" ? "origami-selected" : ""}`}
            >
              Archivadas
            </button>
          </div>

          {/* Type Filter */}
          <label
            htmlFor="filter-type"
            className="origami-label grid min-w-0 gap-1"
          >
            Tipo
            <select
              id="filter-type"
              name="filter-type"
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
              <option value={ActivityType.game}>Microjuego</option>
              <option value={ActivityType.exam}>Examen</option>
            </select>
          </label>

          {/* Level Filter */}
          <label
            htmlFor="filter-level"
            className="origami-label grid min-w-0 gap-1"
          >
            Nivel
            <select
              id="filter-level"
              name="filter-level"
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="origami-field"
            >
              <option value="all">Todos los niveles</option>
              <option value={Level.A1}>A1</option>
              <option value={Level.A2}>A2</option>
              <option value={Level.B1}>B1</option>
              <option value={Level.B2}>B2</option>
            </select>
          </label>
        </div>

        {activitiesQuery.isSuccess && (
          <p className="origami-meta" role="status">
            {total} actividad{total !== 1 ? "es" : ""}
          </p>
        )}
      </div>

      {/* Activity List / Grid */}
      {isLoading ? (
        <p className="origami-state" role="status">
          Cargando catálogo…
        </p>
      ) : loadError ? (
        <div
          className="origami-state origami-state--error space-y-3"
          role="alert"
        >
          <p>{loadError}</p>
          <button
            type="button"
            className="origami-button origami-button--secondary"
            onClick={() => void activitiesQuery.refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="origami-card text-center">
          {statusFilter === "active" &&
          typeFilter === "all" &&
          levelFilter === "all" ? (
            <div>
              <h2 className="origami-card-title">Aún no tienes actividades</h2>
              <p className="origami-meta mt-1 mb-6">
                Crea tu primera actividad para empezar a armar tus clases y
                asignaciones.
              </p>
              <Link href="/actividades/nueva" className="origami-button">
                Crear mi primera actividad
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="origami-card-title">
                No encontramos actividades con estos filtros
              </h2>
              <p className="origami-meta mt-1 mb-4">
                Prueba cambiando los criterios de búsqueda o revisa las
                archivadas.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("active");
                  setTypeFilter("all");
                  setLevelFilter("all");
                }}
                className="origami-button origami-button--secondary"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((act) => {
            const statusConfig = statusLabels[act.status];

            return (
              <article
                key={act.id}
                aria-labelledby={`catalogue-activity-${act.id}`}
                className="origami-card flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="origami-meta">Nivel {act.level}</span>
                    <span className={`${statusConfig.color} text-sm font-bold`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <h2
                    id={`catalogue-activity-${act.id}`}
                    className="origami-card-title mb-1"
                  >
                    {act.title}
                  </h2>
                  <p className="origami-meta">
                    {activityTypeLabels[act.type]} • Versión {act.version}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-(--origami-border-subtle) pt-3">
                  <Link
                    href={`/actividades/${act.id}`}
                    className="origami-button origami-button--secondary"
                  >
                    {act.status === ActivityStatus.archived ? "Ver" : "Editar"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(act.id)}
                    className="origami-button origami-button--text"
                  >
                    Duplicar
                  </button>
                  {act.status === ActivityStatus.archived ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(act.id)}
                      className="origami-button origami-button--text"
                    >
                      Restaurar al catálogo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleArchive(act.id)}
                      className="origami-button origami-button--text"
                    >
                      Archivar
                    </button>
                  )}

                  {act.status === ActivityStatus.draft && (
                    <button
                      type="button"
                      onClick={() => handleDelete(act.id)}
                      className="origami-button origami-button--text text-(--origami-error-text)"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deletingActivityId}
        title="Eliminar borrador"
        message="¿Seguro que deseas eliminar este borrador? Esta acción no se puede deshacer."
        confirmText="Eliminar borrador"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingActivityId(null)}
      />
    </div>
  );
}
