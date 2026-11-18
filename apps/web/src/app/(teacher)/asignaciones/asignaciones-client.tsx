"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AssignmentListResponse,
  AssignmentListResponseSchema,
  AssignmentAvailability,
  GroupListResponse,
  GroupListResponseSchema,
  formatBogotaDateTime,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";

import { activityTypeLabels } from "../actividades/activity-labels";

import { availabilityBadges } from "./assignment-labels";

export function AsignacionesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const notice = searchParams.get("notice");
  const initialGroupId = searchParams.get("groupId") || "all";
  const initialAvailability = searchParams.get("availability") || "all";

  const [selectedGroup, setSelectedGroup] = useState<string>(initialGroupId);
  const [selectedAvailability, setSelectedAvailability] =
    useState<string>(initialAvailability);

  // Sync state if query params change externally (browser navigation, direct links)
  useEffect(() => {
    const g = searchParams.get("groupId") || "all";
    const a = searchParams.get("availability") || "all";
    setSelectedGroup(g);
    setSelectedAvailability(a);
  }, [searchParams]);

  // Load all groups (including archived ones for historical filter, SPEC-04 RF-9)
  const groupsQuery = useQuery({
    queryKey: ["teacher", "groups", "all"],
    queryFn: () =>
      apiFetch<GroupListResponse>("/api/v1/groups?limit=100", {
        schema: GroupListResponseSchema,
      }),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["teacher", "assignments", selectedGroup, selectedAvailability],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedGroup !== "all") {
        params.set("groupId", selectedGroup);
      }
      if (selectedAvailability !== "all") {
        params.set("availability", selectedAvailability);
      }
      params.set("limit", "100");
      return apiFetch<AssignmentListResponse>(
        `/api/v1/assignments?${params.toString()}`,
        {
          schema: AssignmentListResponseSchema,
        },
      );
    },
  });

  const groups = groupsQuery.data?.items ?? [];
  const assignments = assignmentsQuery.data?.items ?? [];
  const total = assignmentsQuery.data?.total ?? 0;
  const isLoading = assignmentsQuery.isLoading;

  const getErrorMessage = () => {
    if (!assignmentsQuery.error) return null;
    const err = assignmentsQuery.error;
    if (err instanceof ApiError) {
      if (err.statusCode === 404) {
        return "No encontramos esta asignación o alguno de los recursos seleccionados";
      } else if (err.statusCode === 403) {
        return "No tienes acceso a esta sección";
      } else if (err.statusCode === 429) {
        return "Espera un momento antes de volver a intentarlo";
      }
      return err.message || "No pudimos cargar las asignaciones";
    }
    return "No pudimos cargar las asignaciones";
  };

  const error = getErrorMessage();

  const handleGroupFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedGroup(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val === "all") params.delete("groupId");
    else params.set("groupId", val);
    router.replace(`/asignaciones?${params.toString()}`);
  };

  const handleAvailabilityFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const val = e.target.value;
    setSelectedAvailability(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val === "all") params.delete("availability");
    else params.set("availability", val);
    router.replace(`/asignaciones?${params.toString()}`);
  };

  const handleDismissNotice = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("notice");
    const query = params.toString();
    router.replace(`/asignaciones${query ? "?" + query : ""}`);
  };

  const isFiltered = selectedGroup !== "all" || selectedAvailability !== "all";

  return (
    <div className="origami-shell mx-auto max-w-7xl space-y-6">
      {/* Success notice banner (SPEC-04 RF-15, §7) */}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="origami-state origami-state--success flex items-center justify-between gap-2"
        >
          <span className="font-semibold">{notice}</span>
          <button
            type="button"
            onClick={handleDismissNotice}
            className="origami-button origami-button--text"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="origami-page-title">Asignaciones</h1>
          <p className="origami-meta mt-1">
            Gestiona las actividades asignadas a tus grupos de estudiantes.
          </p>
        </div>
        <div>
          <Link href="/asignaciones/nueva" className="origami-button">
            + Nueva asignación
          </Link>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="origami-card grid items-end gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="group-filter" className="origami-label mb-1 block">
            Grupo:
          </label>
          <select
            id="group-filter"
            value={selectedGroup}
            onChange={handleGroupFilterChange}
            className="origami-field"
            disabled={groupsQuery.isPending || groupsQuery.isError}
          >
            <option value="all">Todos los grupos</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} {g.archivedAt ? "(Archivado)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="availability-filter"
            className="origami-label mb-1 block"
          >
            Disponibilidad:
          </label>
          <select
            id="availability-filter"
            value={selectedAvailability}
            onChange={handleAvailabilityFilterChange}
            className="origami-field"
          >
            <option value="all">Todas</option>
            <option value={AssignmentAvailability.scheduled}>
              Programadas
            </option>
            <option value={AssignmentAvailability.open}>Abiertas</option>
            <option value={AssignmentAvailability.closed}>Cerradas</option>
            <option value={AssignmentAvailability.cancelled}>Canceladas</option>
          </select>
        </div>

        {groupsQuery.isError && (
          <div
            className="origami-state origami-state--error space-y-3 sm:col-span-2"
            role="alert"
          >
            <p>No pudimos cargar los grupos para el filtro.</p>
            <button
              type="button"
              className="origami-button origami-button--secondary"
              onClick={() => void groupsQuery.refetch()}
            >
              Volver a cargar grupos
            </button>
          </div>
        )}
        {assignmentsQuery.isSuccess && (
          <p className="origami-meta sm:col-span-2" role="status">
            {total} asignaci{total === 1 ? "ón" : "ones"}
          </p>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <p className="origami-state" role="status">
          Cargando asignaciones…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="origami-state origami-state--error space-y-3"
        >
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={() => {
              void assignmentsQuery.refetch();
            }}
            className="origami-button origami-button--secondary"
          >
            Reintentar
          </button>
        </div>
      ) : assignments.length === 0 ? (
        <div className="origami-card space-y-3 text-center">
          <h2 className="origami-card-title">
            {isFiltered
              ? "No hay asignaciones con estos filtros"
              : "Aún no tienes asignaciones"}
          </h2>
          <p className="origami-meta">
            {isFiltered
              ? "Prueba cambiando los filtros de grupo o disponibilidad para ver más resultados."
              : "Asigna actividades a tus grupos para que los estudiantes comiencen a practicar."}
          </p>
          {isFiltered ? (
            <button
              type="button"
              className="origami-button origami-button--secondary"
              onClick={() => {
                setSelectedGroup("all");
                setSelectedAvailability("all");
                const params = new URLSearchParams(searchParams.toString());
                params.delete("groupId");
                params.delete("availability");
                const query = params.toString();
                router.replace(
                  query ? "/asignaciones?" + query : "/asignaciones",
                );
              }}
            >
              Limpiar filtros
            </button>
          ) : (
            <div className="mt-4">
              <Link href="/asignaciones/nueva" className="origami-button">
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
              <article
                key={assignment.id}
                aria-labelledby={"assignment-title-" + assignment.id}
                className="origami-card flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`origami-state text-sm font-bold ${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                    <span className="origami-meta">
                      Versión {assignment.activity.version}
                    </span>
                  </div>

                  <div>
                    <h2
                      id={"assignment-title-" + assignment.id}
                      className="origami-card-title"
                    >
                      {assignment.activity.title}
                    </h2>
                    <p className="origami-meta mt-0.5">
                      {activityTypeLabels[assignment.activity.type]} · Nivel{" "}
                      {assignment.activity.level}
                    </p>
                  </div>

                  <dl className="space-y-2 rounded-xl bg-(--origami-surface-soft) p-3">
                    <div>
                      <dt className="origami-meta">Grupo</dt>
                      <dd className="font-semibold">
                        {assignment.group.name}
                        {assignment.group.archivedAt && (
                          <span> (Archivado)</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="origami-meta">Apertura</dt>
                      <dd className="origami-tabular">
                        <time dateTime={assignment.opensAt}>
                          {formatBogotaDateTime(assignment.opensAt)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt className="origami-meta">Cierre</dt>
                      <dd className="origami-tabular">
                        <time dateTime={assignment.dueAt}>
                          {formatBogotaDateTime(assignment.dueAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--origami-border-subtle) pt-3">
                  <span className="origami-meta">Hora de Colombia</span>
                  <Link
                    href={`/asignaciones/${assignment.id}`}
                    className="origami-button origami-button--secondary"
                  >
                    Ver detalles
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
