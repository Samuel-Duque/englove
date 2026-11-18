"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityEditorComponent } from "../activity-editor";
import { ActivityEditor, ActivityEditorSchema } from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../../lib/api";

export function ActividadDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const {
    data: activity,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["teacher", "activity", id],
    queryFn: () =>
      apiFetch<ActivityEditor>(`/api/v1/activities/${id}`, {
        schema: ActivityEditorSchema,
      }),
  });

  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError instanceof Error
        ? queryError.message
        : null;

  if (isLoading) {
    return (
      <div className="origami-state" role="status">
        Cargando actividad…
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div
        role="alert"
        className="origami-state origami-state--error space-y-3"
      >
        <p className="font-semibold">No se pudo cargar la actividad</p>
        <p>{error || "Actividad no encontrada"}</p>
        <div className="flex flex-wrap gap-2">
          {!(
            queryError instanceof ApiError &&
            [403, 404].includes(queryError.statusCode)
          ) && (
            <button
              type="button"
              className="origami-button origami-button--secondary"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          )}
          <Link
            href="/actividades"
            className="origami-button origami-button--text"
          >
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ActivityEditorComponent
      initialActivity={activity}
      onActivityUpdated={(updated) => {
        queryClient.setQueryData(["teacher", "activity", id], updated);
      }}
    />
  );
}
