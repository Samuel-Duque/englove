"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  StudentProgressView,
  StudentProgressViewSchema,
  BadgeAwardView,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";
import { fetchSharedFeatureFlags } from "../../../lib/feature-flags-client";
import { renderBadgeIcon } from "../../../lib/badges";

export function ProgresoClient() {
  const { data: features } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => fetchSharedFeatureFlags(),
    retry: false,
  });

  const {
    data: progress,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["student", "progress"],
    queryFn: () =>
      apiFetch<StudentProgressView>("/api/v1/me/progress", {
        schema: StudentProgressViewSchema,
      }),
  });

  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError instanceof Error
        ? queryError.message
        : null;

  if (isLoading)
    return (
      <p role="status" className="origami-state">
        Cargando tus logros…
      </p>
    );

  if (error || !progress) {
    return (
      <section
        role="alert"
        className="origami-state origami-state--error space-y-3"
      >
        <h1 className="origami-page-title">No pudimos cargar tu progreso</h1>
        <p>{error ?? "Los datos no están disponibles."}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="origami-button origami-button--secondary"
        >
          Reintentar
        </button>
      </section>
    );
  }

  const { streak, badges, activities } = progress;
  return (
    <div className="space-y-6 [overflow-wrap:anywhere]">
      <header className="space-y-2">
        <h1 className="origami-page-title">Tu Progreso y Logros</h1>
        <p className="origami-reading">
          Consulta tu racha, tus insignias y tus actividades entregadas.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section
          className="origami-card space-y-2"
          aria-labelledby="progress-streak"
        >
          <h2 id="progress-streak" className="origami-card-title">
            Racha Semanal
          </h2>
          <p className="origami-section-title origami-tabular">
            {streak.weeks}{" "}
            {streak.weeks === 1 ? "semana consecutiva" : "semanas consecutivas"}
          </p>
        </section>
        <section
          className="origami-card space-y-2"
          aria-labelledby="progress-shield"
        >
          <h2 id="progress-shield" className="origami-card-title">
            {streak.forgivenessAvailable
              ? "Escudo de perdón activo"
              : `Recuperando escudo (${streak.activeWeeksSinceForgivenessUsed}/2 semanas)`}
          </h2>
          <p className="origami-meta">
            {streak.forgivenessAvailable
              ? "Si una semana no realizas ninguna actividad, tu racha se mantendrá."
              : "Completa al menos una actividad durante dos semanas consecutivas para recuperar tu escudo."}
          </p>
        </section>
      </div>

      <section className="space-y-3" aria-labelledby="progress-badges">
        <h2 id="progress-badges" className="origami-section-title">
          Tus Insignias ({badges.length})
        </h2>
        {badges.length === 0 ? (
          <div className="origami-state space-y-2">
            <h3 className="origami-card-title">Aún no tienes insignias</h3>
            <p>
              Completa tu primera actividad o mantén tu racha para
              desbloquearlas.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge: BadgeAwardView) => (
              <li
                key={badge.id}
                className="origami-card flex items-start gap-3"
              >
                <span aria-hidden="true" className="shrink-0 text-2xl">
                  {renderBadgeIcon(badge.icon)}
                </span>
                <div className="space-y-1">
                  <h3 className="origami-card-title">{badge.name}</h3>
                  <p>{badge.description}</p>
                  <p className="origami-meta">
                    Ganada el{" "}
                    {new Date(badge.awardedAt).toLocaleDateString("es-CO", {
                      timeZone: "America/Bogota",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="progress-history">
        <h2 id="progress-history" className="origami-section-title">
          Historial de Actividades Entregadas
        </h2>
        {activities.length === 0 ? (
          <div className="origami-state space-y-3">
            <p>Aún no has completado actividades.</p>
            <Link
              href="/inicio"
              className="origami-button origami-button--secondary"
            >
              Ver mis actividades
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {activities.map((activity) => (
              <li
                key={activity.attemptId}
                className="origami-card flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <h3 className="origami-card-title">
                    {activity.activityTitle ||
                      `Actividad #${activity.attemptNumber ?? activity.attemptId.slice(0, 8)}`}
                  </h3>
                  {activity.attemptNumber && (
                    <p className="origami-meta">
                      Intento #{activity.attemptNumber}
                    </p>
                  )}
                  <p className="origami-meta origami-tabular">
                    {activity.score !== null
                      ? `Nota: ${Number(activity.score).toFixed(1).replace(".", ",")} / 5,0`
                      : "En revisión"}
                  </p>
                </div>
                <Link
                  href={`/actividad/${activity.attemptId}`}
                  className="origami-button origami-button--secondary"
                >
                  Ver detalles
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {features?.flags?.games && (
        <section
          className="origami-card space-y-3"
          aria-labelledby="progress-practice"
        >
          <h2 id="progress-practice" className="origami-section-title">
            Práctica en juegos
          </h2>
          <p>
            Las estrellas de práctica no cuentan como notas del historial
            académico.
          </p>
          <Link
            href="/juegos"
            className="origami-button origami-button--secondary"
          >
            Ver mis juegos
          </Link>
        </section>
      )}
    </div>
  );
}
