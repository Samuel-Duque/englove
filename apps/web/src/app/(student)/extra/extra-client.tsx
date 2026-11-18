"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalResourceItem,
  ExternalResourceListResponse,
  ExternalResourceListResponseSchema,
  StudentProfileView,
  StudentProfileViewSchema,
  FeatureFlagsResponse,
  FeatureFlagsResponseSchema,
  isValidHttpsResourceUrl,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";

export function ExtraClient() {
  // Offline detection (T-05, RF-8)
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== "undefined") return navigator.onLine;
    return true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Speech synthesis state (kids TTS, RF-9)
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [hasSpeechSupport, setHasSpeechSupport] = useState<boolean>(false);

  useEffect(() => {
    setHasSpeechSupport(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = (item: ExternalResourceItem) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (speakingId === item.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = item.description
      ? `${item.title}. ${item.description}`
      : item.title;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "es-CO";

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(item.id);
    window.speechSynthesis.speak(utterance);
  };

  // Queries
  const flagsQuery = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () =>
      apiFetch<FeatureFlagsResponse>("/api/v1/feature-flags", {
        schema: FeatureFlagsResponseSchema,
      }),
  });

  const meQuery = useQuery({
    queryKey: ["student", "profile"],
    queryFn: () =>
      apiFetch<StudentProfileView>("/api/v1/me", {
        schema: StudentProfileViewSchema,
      }),
  });

  const isExtraContentEnabled = Boolean(flagsQuery.data?.flags?.extra_content);

  const resourcesQuery = useQuery({
    queryKey: ["resources"],
    queryFn: () =>
      apiFetch<ExternalResourceListResponse>("/api/v1/resources", {
        schema: ExternalResourceListResponseSchema,
      }),
    enabled: isExtraContentEnabled,
  });

  // Level & Theme detection
  const ageSegment = meQuery.data?.student?.ageSegment ?? "kids";
  const isKids = ageSegment === "kids";
  const studentLevel = meQuery.data?.student?.level ?? null;

  // Local filter pill state
  const [filterPill, setFilterPill] = useState<"todos" | "nivel" | "generales">(
    "todos",
  );

  const filteredItems = useMemo(() => {
    const all = resourcesQuery.data?.items ?? [];
    if (filterPill === "generales") {
      return all.filter((item) => item.level === null);
    }
    if (filterPill === "nivel" && studentLevel) {
      return all.filter((item) => item.level === studentLevel);
    }
    return all;
  }, [resourcesQuery.data?.items, filterPill, studentLevel]);

  const getHostname = (rawUrl: string): string => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return "enlace externo";
    }
  };

  if (
    flagsQuery.isLoading ||
    (isExtraContentEnabled && resourcesQuery.isLoading)
  ) {
    return (
      <p role="status" className="origami-state">
        Cargando contenido extra…
      </p>
    );
  }

  const isForbiddenError =
    resourcesQuery.error instanceof ApiError &&
    (resourcesQuery.error.code === "EXTRA_CONTENT_DISABLED" ||
      resourcesQuery.error.statusCode === 403);

  if (flagsQuery.isError || (resourcesQuery.isError && !isForbiddenError)) {
    return (
      <section
        role="alert"
        className="origami-state origami-state--error space-y-3"
      >
        <h1 className="origami-page-title">
          No pudimos cargar el contenido extra
        </h1>
        <p>
          {isOnline
            ? "Vuelve a intentar para consultar los recursos."
            : "Conéctate a internet para consultar los recursos."}
        </p>
        <button
          type="button"
          disabled={!isOnline}
          onClick={() =>
            void (flagsQuery.isError
              ? flagsQuery.refetch()
              : resourcesQuery.refetch())
          }
          className="origami-button origami-button--secondary"
        >
          Reintentar
        </button>
        <Link href="/inicio" className="origami-button origami-button--text">
          Volver al inicio
        </Link>
      </section>
    );
  }

  if (!isExtraContentEnabled || isForbiddenError) {
    return (
      <section className="origami-card space-y-3">
        <h1 className="origami-page-title">Contenido extra no disponible</h1>
        <p>El contenido extra no está habilitado en este momento.</p>
        <Link
          href="/inicio"
          className="origami-button origami-button--secondary"
        >
          Volver al inicio
        </Link>
      </section>
    );
  }

  const filters = [
    { id: "todos", label: "Todos" },
    ...(studentLevel
      ? [{ id: "nivel" as const, label: `Nivel ${studentLevel}` }]
      : []),
    { id: "generales", label: "Generales" },
  ] as const;

  return (
    <div className="space-y-6 [overflow-wrap:anywhere]">
      <header className="space-y-2">
        <h1 className="origami-page-title">Contenido extra</h1>
        <p className="origami-reading">
          {isKids
            ? "Explora juegos, videos y lecturas para practicar inglés."
            : "Encuentra recursos para practicar en tu nivel de inglés."}
        </p>
        {studentLevel && (
          <p className="origami-label">Tu nivel: {studentLevel}</p>
        )}
      </header>

      {!isOnline && (
        <p role="status" className="origami-state origami-state--warning">
          Necesitas conexión a internet para abrir enlaces externos.
        </p>
      )}

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar contenido por nivel"
      >
        {filters.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            onClick={() => setFilterPill(id)}
            aria-pressed={filterPill === id}
            className={`origami-button origami-button--secondary ${filterPill === id ? "origami-selected" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <section className="origami-state space-y-3">
          <h2 className="origami-section-title">
            No hay recursos para este filtro
          </h2>
          {filterPill !== "todos" ? (
            <button
              type="button"
              onClick={() => setFilterPill("todos")}
              className="origami-button origami-button--secondary"
            >
              Mostrar todos los recursos
            </button>
          ) : (
            <Link
              href="/inicio"
              className="origami-button origami-button--secondary"
            >
              Volver al inicio
            </Link>
          )}
        </section>
      ) : (
        <ul
          className="grid gap-4 sm:grid-cols-2"
          aria-label="Tarjetas de contenido extra"
        >
          {filteredItems.map((item) => {
            const isSpeakingThis = speakingId === item.id;
            return (
              <li
                key={item.id}
                className="origami-card flex min-w-0 flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <p className="origami-meta">
                    {item.level ? `Nivel ${item.level}` : "General"} · Enlace
                    externo
                  </p>
                  <h2 className="origami-card-title">{item.title}</h2>
                  <p className="origami-meta">{getHostname(item.url)}</p>
                  {item.description && <p>{item.description}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isKids && hasSpeechSupport && (
                    <button
                      type="button"
                      onClick={() => handleSpeak(item)}
                      aria-label={
                        isSpeakingThis
                          ? `Detener locución de ${item.title}`
                          : `Escuchar descripción de ${item.title}`
                      }
                      className="origami-button origami-button--secondary"
                    >
                      {isSpeakingThis ? "Detener" : "Escuchar"}
                    </button>
                  )}
                  {!isValidHttpsResourceUrl(item.url) ? (
                    <p className="origami-meta">Enlace no seguro o inválido</p>
                  ) : isOnline ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="origami-button"
                    >
                      Abrir en pestaña nueva <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <p className="origami-meta">No disponible sin conexión</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
