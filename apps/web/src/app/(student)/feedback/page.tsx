'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  StudentFeedbackListResponse,
  StudentFeedbackItemView,
  RuntimeView,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

const TYPE_LABELS: Record<string, string> = {
  fill_blank: '✍️ Espacios en blanco',
  speaking: '🎙️ Expresión oral (Speaking)',
  open_question: '📄 Pregunta abierta',
  exam: '📝 Examen',
  game: '🎮 Juego',
};

export default function StudentFeedbackPage() {
  const router = useRouter();
  const [items, setItems] = useState<StudentFeedbackItemView[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [isStartingAttempt, startStartingAttempt] = useTransition();
  const [startingAssignmentId, setStartingAssignmentId] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StudentFeedbackListResponse>('/api/v1/student/feedback');
      setItems(data.items || []);
    } catch (err) {
      setError((err as ApiError)?.message || 'No pudimos cargar tus calificaciones y comentarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const toggleHistory = (assignmentId: string) => {
    setExpandedHistory((prev) => ({
      ...prev,
      [assignmentId]: !prev[assignmentId],
    }));
  };

  const handleStartRetry = (assignmentId: string) => {
    setStartingAssignmentId(assignmentId);
    startStartingAttempt(async () => {
      try {
        const runtime = await apiFetch<RuntimeView>(
          `/api/v1/assignments/${assignmentId}/attempts`,
          { method: 'POST' },
        );
        router.push(`/actividad/${runtime.attempt.id}`);
      } catch (err) {
        alert((err as ApiError)?.message || 'No fue posible iniciar el nuevo intento.');
        setStartingAssignmentId(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm font-semibold text-zinc-600">Cargando tus comentarios y notas…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 max-w-lg mx-auto bg-white p-8 rounded-3xl border border-rose-200 shadow-xs text-center space-y-3">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-base font-extrabold text-rose-950">No pudimos cargar tu retroalimentación</h2>
        <p className="text-xs text-rose-700">{error}</p>
        <button
          type="button"
          onClick={loadFeedback}
          className="mt-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950">
          💬 Tus Calificaciones y Retroalimentación
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-600">
          Revisa las notas, los comentarios de tu profesora y los stickers que ganaste en cada actividad.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-amber-200 bg-white p-12 text-center space-y-3 shadow-2xs">
          <span className="text-4xl">📚</span>
          <h2 className="text-base font-extrabold text-amber-950">
            Aún no tienes actividades calificadas
          </h2>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            En cuanto tu profesora revise y califique tus entregas de ejercicios y speaking, verás aquí su mensaje y tus estrellas.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => {
            const latest = item.latestAttempt;
            const scoreFormatted = latest.score.toFixed(1).replace('.', ',');
            const isHistoryOpen = Boolean(expandedHistory[item.assignmentId]);
            const isRetrying = isStartingAttempt && startingAssignmentId === item.assignmentId;

            return (
              <div
                key={item.assignmentId}
                className="rounded-3xl border border-amber-200/90 bg-white p-6 shadow-xs space-y-5 hover:shadow-md transition-all"
              >
                {/* Top bar: Type & Stars */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                      {TYPE_LABELS[item.activityType] || item.activityType}
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-amber-950 leading-snug">
                      {item.activityTitle}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto bg-amber-50/80 px-4 py-2 rounded-2xl border border-amber-200/60">
                    <div>
                      <span className="text-xs text-zinc-500 font-bold block text-right">Nota</span>
                      <span className="text-xl font-black text-amber-950">
                        {scoreFormatted}
                      </span>
                      <span className="text-xs font-semibold text-zinc-500"> / 5,0</span>
                    </div>

                    <div className="flex gap-0.5" aria-label={`Calificación: ${latest.stars} estrellas`}>
                      {[1, 2, 3].map((star) => (
                        <span key={star} className="text-lg">
                          {star <= latest.stars ? '⭐' : '☆'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Teacher Comment */}
                {latest.comment ? (
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/50 space-y-1">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <span>👩‍🏫</span>
                      <span>Mensaje de tu profesora:</span>
                    </span>
                    <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed font-medium">
                      {latest.comment}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">
                    Sin comentario personalizado para esta entrega.
                  </p>
                )}

                {/* Stickers Awarded */}
                {latest.stickers.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Stickers recibidos
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {latest.stickers.map((st) => (
                        <div
                          key={st.code}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-bold shadow-2xs"
                        >
                          <span className="text-base">{st.emoji}</span>
                          <span>{st.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Retry Banner if available (RF-9, RF-10) */}
                {item.hasAvailableRetry && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                        <span>🔄</span>
                        <span>¡Tu profesora te habilitó un nuevo intento!</span>
                      </span>
                      <p className="text-[11px] text-emerald-800">
                        Tienes plazo hasta el{' '}
                        <strong>
                          {new Date(item.effectiveDueAt).toLocaleDateString('es-CO', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartRetry(item.assignmentId)}
                      disabled={isRetrying}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs transition-colors shadow-xs shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      {isRetrying ? 'Iniciando…' : 'Intentar de nuevo'}
                    </button>
                  </div>
                )}

                {/* Attempt History Accordion */}
                {item.attempts.length > 1 && (
                  <div className="pt-2 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => toggleHistory(item.assignmentId)}
                      className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1.5 transition-colors focus:outline-none"
                    >
                      <span>{isHistoryOpen ? '▲' : '▼'}</span>
                      <span>
                        {isHistoryOpen
                          ? 'Ocultar historial de intentos'
                          : `Ver historial de intentos anteriores (${item.attempts.length})`}
                      </span>
                    </button>

                    {isHistoryOpen && (
                      <div className="mt-3 space-y-3 pl-3 border-l-2 border-amber-200">
                        {item.attempts.map((att) => (
                          <div
                            key={att.id}
                            className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between font-bold text-zinc-700">
                              <span>Intento #{att.attemptNumber}</span>
                              <span className="text-zinc-500 text-[11px]">
                                {new Date(att.gradedAt).toLocaleDateString('es-CO', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-black text-zinc-900">
                                {att.score.toFixed(1).replace('.', ',')} / 5,0
                              </span>
                              <span>
                                {[1, 2, 3].map((s) => (
                                  <span key={s} className="text-xs">
                                    {s <= att.stars ? '⭐' : '☆'}
                                  </span>
                                ))}
                              </span>
                            </div>

                            {att.comment && (
                              <p className="text-[11px] text-zinc-600 italic">
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
