"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  StudentFeedbackListResponse,
  StudentFeedbackListResponseSchema,
  StudentFeedbackItemView,
  RuntimeView,
  RuntimeViewSchema,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";
import Link from "next/link";
import { AccessibleModal } from "../../../components/ui/modal";

const TYPE_LABELS: Record<string, string> = {
  fill_blank: "✍️ Espacios en blanco",
  speaking: "🎙️ Expresión oral (Speaking)",
  open_question: "📄 Pregunta abierta",
  exam: "📝 Examen",
  game: "🎮 Juego",
};

export function FeedbackClient() {
  const router = useRouter();
  const [retryError, setRetryError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<
    Record<string, boolean>
  >({});
  const [startingAssignmentId, setStartingAssignmentId] = useState<
    string | null
  >(null);

  const {
    data: feedbackData,
    isLoading,
    error: queryError,
    refetch: loadFeedback,
  } = useQuery({
    queryKey: ["student", "feedback"],
    queryFn: () =>
      apiFetch<StudentFeedbackListResponse>("/api/v1/student/feedback", {
        schema: StudentFeedbackListResponseSchema,
      }),
  });

  const items: StudentFeedbackItemView[] = feedbackData?.items || [];
  const error =
    queryError instanceof ApiError
      ? queryError.message
      : queryError instanceof Error
        ? queryError.message
        : null;

  const toggleHistory = (assignmentId: string) => {
    setExpandedHistory((prev) => ({
      ...prev,
      [assignmentId]: !prev[assignmentId],
    }));
  };

  const retryMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch<RuntimeView>(`/api/v1/assignments/${assignmentId}/attempts`, {
        method: "POST",
        schema: RuntimeViewSchema,
      }),
    onSuccess: (runtime) => {
      router.push(`/actividad/${runtime.attempt.id}`);
    },
    onError: (err: unknown) => {
      setRetryError(
        err instanceof ApiError
          ? err.message
          : "No fue posible iniciar el nuevo intento.",
      );
      setStartingAssignmentId(null);
    },
  });

  const handleStartRetry = (assignmentId: string) => {
    setStartingAssignmentId(assignmentId);
    setRetryError(null);
    retryMutation.mutate(assignmentId);
  };

  const isStartingAttempt = retryMutation.isPending;

  if (isLoading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm font-semibold text-[var(--origami-text-secondary)]">
          Cargando tus comentarios y notas…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="origami-card space-y-4">
        <span className="text-4xl" aria-hidden="true">
          ⚠️
        </span>
        <h2 className="origami-card-title">
          No pudimos cargar tu retroalimentación
        </h2>
        <p className="text-xs text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => {
            void loadFeedback();
          }}
          className="mt-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 max-w-5xl mx-auto">
      {/* Modal for retry errors */}
      <AccessibleModal
        isOpen={!!retryError}
        onClose={() => setRetryError(null)}
        title="Aviso de Intento"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--origami-text-secondary)]">
            {retryError}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setRetryError(null)}
              className="origami-button"
            >
              Entendido
            </button>
          </div>
        </div>
      </AccessibleModal>

      {/* Header */}
      <div>
        <h1 className="origami-page-title">
          Tus Calificaciones y Retroalimentación
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--origami-text-secondary)]">
          Revisa las notas, los comentarios de tu profesora y los stickers que
          recibiste.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="origami-card space-y-4">
          <span className="text-4xl" aria-hidden="true">
            📚
          </span>
          <h2 className="origami-card-title">
            Aún no tienes actividades calificadas
          </h2>
          <p className="text-xs text-[var(--origami-text-secondary)] max-w-md mx-auto">
            Cuando tu profesora revise tus entregas, podrás leer su mensaje y
            consultar la nota.
          </p>
          <Link
            href="/inicio"
            className="origami-button origami-button--secondary"
          >
            Ver mis actividades
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => {
            const latest = item.latestAttempt;
            const scoreFormatted = latest.score.toFixed(1).replace(".", ",");
            const isHistoryOpen = Boolean(expandedHistory[item.assignmentId]);
            const isRetrying =
              isStartingAttempt && startingAssignmentId === item.assignmentId;

            return (
              <div key={item.assignmentId} className="origami-card space-y-4">
                {/* Type and academic grade */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--origami-border-subtle)] pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-[var(--origami-text-secondary)] uppercase tracking-wider block">
                      {TYPE_LABELS[item.activityType] || item.activityType}
                    </span>
                    <h2 className="origami-card-title">{item.activityTitle}</h2>
                  </div>

                  <div className="origami-state space-y-2">
                    <div>
                      <span className="origami-label block">Nota</span>
                      <span className="text-xl font-black">
                        {scoreFormatted}
                      </span>
                      <span className="text-xs font-semibold text-[var(--origami-text-secondary)]">
                        {" "}
                        / 5,0
                      </span>
                    </div>
                  </div>
                </div>

                {/* Teacher Comment */}
                {latest.comment ? (
                  <div className="origami-state space-y-2">
                    <span className="text-xs font-black text-[var(--origami-text-secondary)] flex items-center gap-1.5">
                      <span aria-hidden="true">👩‍🏫</span>
                      <span>Mensaje de tu profesora:</span>
                    </span>
                    <p className="text-xs sm:text-sm text-[var(--origami-text-secondary)] leading-relaxed font-medium">
                      {latest.comment}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--origami-text-secondary)] italic">
                    Sin comentario personalizado para esta entrega.
                  </p>
                )}

                {/* Stickers Awarded */}
                {latest.stickers.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[var(--origami-text-secondary)] uppercase tracking-wider block">
                      Stickers recibidos
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {latest.stickers.map((st) => (
                        <div key={st.code} className="origami-state space-y-2">
                          <span className="text-base" aria-hidden="true">
                            {st.emoji}
                          </span>
                          <span>{st.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Retry Banner if available (RF-9, RF-10) */}
                {item.hasAvailableRetry && (
                  <div className="origami-state origami-state--success flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-[var(--origami-text-secondary)] flex items-center gap-1.5">
                        <span aria-hidden="true">🔄</span>
                        <span>¡Tu profesora te habilitó un nuevo intento!</span>
                      </span>
                      <p className="text-[11px] text-[var(--origami-text-secondary)]">
                        Tienes plazo hasta el{" "}
                        <strong>
                          {new Date(item.effectiveDueAt).toLocaleDateString(
                            "es-CO",
                            {
                              timeZone: "America/Bogota",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartRetry(item.assignmentId)}
                      disabled={isRetrying}
                      className="origami-button"
                    >
                      {isRetrying ? "Iniciando…" : "Intentar de nuevo"}
                    </button>
                  </div>
                )}

                {/* Attempt History Accordion */}
                {item.attempts.length > 1 && (
                  <div className="pt-2 border-t border-[var(--origami-border-subtle)]">
                    <button
                      type="button"
                      onClick={() => toggleHistory(item.assignmentId)}
                      aria-expanded={isHistoryOpen}
                      className="origami-button origami-button--text"
                    >
                      <span>{isHistoryOpen ? "▲" : "▼"}</span>
                      <span>
                        {isHistoryOpen
                          ? "Ocultar historial de intentos"
                          : `Ver historial de intentos anteriores (${item.attempts.length})`}
                      </span>
                    </button>

                    {isHistoryOpen && (
                      <div className="mt-3 space-y-3 pl-3 border-l-2 border-[var(--origami-border-subtle)]">
                        {item.attempts.map((att) => (
                          <div key={att.id} className="origami-state space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                              <span>Intento #{att.attemptNumber}</span>
                              <span className="text-[var(--origami-text-secondary)] text-[11px]">
                                {new Date(att.gradedAt).toLocaleDateString(
                                  "es-CO",
                                  {
                                    timeZone: "America/Bogota",
                                    day: "numeric",
                                    month: "short",
                                  },
                                )}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-black">
                                {att.score.toFixed(1).replace(".", ",")} / 5,0
                              </span>
                            </div>

                            {att.comment && (
                              <p className="text-[11px] text-[var(--origami-text-secondary)] italic">
                                &ldquo;{att.comment}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
