'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Download, Lock, Mic, X } from 'lucide-react';
import {
  ActivityType,
  STICKERS,
  STICKER_CODES,
  StickerCode,
  ReviewListItemView,
  ReviewListResponse,
  ReviewListResponseSchema,
  AttemptReviewDetailView,
  AttemptReviewDetailViewSchema,
  GroupView,
  GroupListResponse,
  GroupListResponseSchema,
  MediaPlaybackUrlResponse,
  MediaPlaybackUrlResponseSchema,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { formatBlankPrompt } from '../../../lib/blank-prompt';
import { POLLING_INTERVAL_MS } from '../../../lib/query-client';
import styles from './revision.module.css';

const reviewTabs = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'graded', label: 'Calificados' },
] as const;

export function RevisionClient() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pending' | 'graded'>('pending');

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const hydratedAttemptRef = useRef<string | null>(null);
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const shouldMoveFocusRef = useRef(false);

  // Filter states
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Form states in detail view
  const [scoreInput, setScoreInput] = useState<string>('');
  const [commentInput, setCommentInput] = useState<string>('');
  const [selectedStickers, setSelectedStickers] = useState<StickerCode[]>([]);
  const [allowRetry, setAllowRetry] = useState<boolean>(false);
  const [retryExtendUntil, setRetryExtendUntil] = useState<string>('');

  // Status & notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load groups for filter dropdown
  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: () =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
      }),
  });
  const groups: GroupView[] = groupsQuery.data?.items ?? [];

  // Listas con TanStack Query y polling de 30 s (SPEC-07, A2)
  const listParams = new URLSearchParams();
  if (selectedGroupId) listParams.set('groupId', selectedGroupId);
  if (selectedType) listParams.set('type', selectedType);
  if (fromDate) listParams.set('from', fromDate);
  if (toDate) listParams.set('to', toDate);
  const listQueryString = listParams.toString();

  const pendingQuery = useQuery({
    queryKey: ['reviews', 'queue', listQueryString],
    queryFn: () =>
      apiFetch<ReviewListResponse>(`/api/v1/reviews/queue?${listQueryString}`, {
        schema: ReviewListResponseSchema,
      }),
    refetchInterval: POLLING_INTERVAL_MS,
  });
  const gradedQuery = useQuery({
    queryKey: ['reviews', 'graded', listQueryString],
    queryFn: () =>
      apiFetch<ReviewListResponse>(
        `/api/v1/reviews/graded?${listQueryString}`,
        {
          schema: ReviewListResponseSchema,
        },
      ),
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const pendingItems: ReviewListItemView[] = pendingQuery.data?.items ?? [];
  const gradedItems: ReviewListItemView[] = gradedQuery.data?.items ?? [];
  const pendingTotal = pendingQuery.data?.total ?? 0;
  const gradedTotal = gradedQuery.data?.total ?? 0;
  const isLoadingList = pendingQuery.isFetching || gradedQuery.isFetching;
  const listError = pendingQuery.error ?? gradedQuery.error;
  const listErrorMessage = listError
    ? listError instanceof ApiError
      ? listError.message
      : 'Error al cargar las entregas para revisión'
    : null;
  const shownErrorMessage = errorMessage ?? listErrorMessage;

  // Auto-select first pending if none selected
  const firstPendingId = pendingItems[0]?.attempt.attemptId ?? null;
  useEffect(() => {
    if (!selectedAttemptId && firstPendingId && activeTab === 'pending') {
      setSelectedAttemptId(firstPendingId);
    }
  }, [selectedAttemptId, firstPendingId, activeTab]);

  // Load attempt detail via TanStack Query
  const detailQuery = useQuery({
    queryKey: ['teacher', 'review-detail', selectedAttemptId],
    queryFn: async () => {
      if (!selectedAttemptId) return null;
      const data = await apiFetch<AttemptReviewDetailView>(
        `/api/v1/attempts/${selectedAttemptId}/review-detail`,
        { schema: AttemptReviewDetailViewSchema },
      );
      let audio: string | null = null;
      let warning = false;
      if (
        data.activity.type === ActivityType.speaking &&
        data.mediaAsset &&
        data.mediaAsset.status !== 'deleted'
      ) {
        try {
          const mediaRes = await apiFetch<MediaPlaybackUrlResponse>(
            `/api/v1/media/${data.mediaAsset.id}/url`,
            { schema: MediaPlaybackUrlResponseSchema },
          );
          audio = mediaRes.url;
          warning = Boolean(
            mediaRes.compatibilityWarning || mediaRes.format !== 'converted',
          );
        } catch {
          // ignore audio failure
        }
      }
      return { detail: data, audioUrl: audio, audioWarning: warning };
    },
    enabled: Boolean(selectedAttemptId),
  });

  const detail = detailQuery.data?.detail ?? null;
  const audioUrl = detailQuery.data?.audioUrl ?? null;
  const audioWarning = detailQuery.data?.audioWarning ?? false;
  const isLoadingAudio =
    detailQuery.isLoading && detail?.activity.type === ActivityType.speaking;
  const isLoadingDetail = detailQuery.isLoading;

  useEffect(() => {
    if (!selectedAttemptId) {
      hydratedAttemptRef.current = null;
      return;
    }
    const data = detailQuery.data?.detail;
    if (!data || data.attempt.attemptId !== selectedAttemptId) return;
    if (hydratedAttemptRef.current === selectedAttemptId) return;

    hydratedAttemptRef.current = selectedAttemptId;
    setScoreInput(
      data.attempt.score !== null
        ? data.attempt.score.toFixed(1).replace('.', ',')
        : '',
    );
    setCommentInput(data.review?.comment || '');
    setSelectedStickers(data.review?.stickers || []);
    setAllowRetry(false);
    setRetryExtendUntil('');
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [selectedAttemptId, detailQuery.data]);

  const handleDownloadAudio = async () => {
    if (!detail?.mediaAsset?.id) return;
    try {
      const downloadRes = await apiFetch<MediaPlaybackUrlResponse>(
        `/api/v1/media/${detail.mediaAsset.id}/download-url`,
        { schema: MediaPlaybackUrlResponseSchema },
      );
      window.open(downloadRes.url, '_blank');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'Error al obtener enlace de descarga de audio',
      );
    }
  };

  const toggleSticker = (code: StickerCode) => {
    if (selectedStickers.includes(code)) {
      setSelectedStickers(selectedStickers.filter((c) => c !== code));
    } else {
      if (selectedStickers.length >= 3) {
        setErrorMessage('Solo puedes seleccionar hasta 3 stickers');
        return;
      }
      setSelectedStickers([...selectedStickers, code]);
    }
  };

  const reviewMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch<AttemptReviewDetailView>(
        `/api/v1/attempts/${selectedAttemptId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(body),
          schema: AttemptReviewDetailViewSchema,
        },
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ['teacher', 'review-detail', selectedAttemptId],
        {
          detail: updated,
          audioUrl,
          audioWarning,
        },
      );
      setSuccessMessage(
        '¡Calificación y retroalimentación guardadas exitosamente!',
      );
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({
        queryKey: ['teacher', 'reminders'],
      });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'SCORE_OUT_OF_RANGE') {
        setErrorMessage('La calificación debe estar entre 0,0 y 5,0.');
      } else {
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'Error al guardar la revisión',
        );
      }
    },
  });

  const isSubmitting = reviewMutation.isPending;

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const isPendingStatus = detail.attempt.status === 'pending_review';
    const body: {
      score?: number;
      comment?: string;
      stickers?: StickerCode[];
      allowRetry?: boolean;
      retryExtendUntil?: string | null;
    } = {
      comment: commentInput.trim(),
      stickers: selectedStickers,
      allowRetry,
      retryExtendUntil: retryExtendUntil
        ? new Date(retryExtendUntil).toISOString()
        : null,
    };

    if (isPendingStatus) {
      const trimmedScore = scoreInput.trim();
      if (!/^\d+(?:[.,]\d+)?$/.test(trimmedScore)) {
        setErrorMessage('Ingresa una calificación válida entre 0,0 y 5,0');
        return;
      }
      const normalized = trimmedScore.replace(',', '.');
      const parsedScore = parseFloat(normalized);
      if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 5) {
        setErrorMessage('Ingresa una calificación válida entre 0,0 y 5,0');
        return;
      }
      body.score = Math.round(parsedScore * 10) / 10;
    }

    reviewMutation.mutate(body);
  };

  const currentList = activeTab === 'pending' ? pendingItems : gradedItems;

  useLayoutEffect(() => {
    if (!shouldMoveFocusRef.current) return;
    shouldMoveFocusRef.current = false;

    if (detailOpen) {
      const backButton = backButtonRef.current;
      if (backButton?.getClientRects().length) backButton.focus();
    } else if (selectedRowRef.current?.isConnected) {
      selectedRowRef.current.focus();
    } else {
      queueHeadingRef.current?.focus();
    }
  }, [detailOpen]);

  function openDetail(id: string, row: HTMLButtonElement) {
    selectedRowRef.current = row;
    if (id === selectedAttemptId && detailQuery.isError)
      void detailQuery.refetch();
    setSelectedAttemptId(id);
    if (!detailOpen) {
      shouldMoveFocusRef.current = true;
      setDetailOpen(true);
    }
  }

  function returnToQueue() {
    audioRef.current?.pause();
    shouldMoveFocusRef.current = true;
    setDetailOpen(false);
  }

  return (
    <div
      className={`origami-shell ${styles.page}`}
      data-detail-open={detailOpen || undefined}
    >
      <header className={styles.heading}>
        <h1 className="origami-page-title">Revisión y Calificación Docente</h1>
        <p className="origami-reading">
          Evalúa las entregas de tus estudiantes, reproduce audios, añade
          stickers y gestiona nuevos intentos.
        </p>
      </header>

      <div className={styles.queueControls}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Estado de las entregas"
        >
          {reviewTabs.map(({ id, label }) => (
            <button
              key={id}
              id={`review-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`review-queue-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => {
                const nextTab =
                  event.key === 'Home'
                    ? 'pending'
                    : event.key === 'End'
                      ? 'graded'
                      : event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                        ? id === 'pending'
                          ? 'graded'
                          : 'pending'
                        : null;
                if (!nextTab) return;
                event.preventDefault();
                setActiveTab(nextTab);
                document.getElementById(`review-tab-${nextTab}`)?.focus();
              }}
              className={`origami-button origami-button--secondary ${styles.flatButton} ${activeTab === id ? 'origami-selected' : ''}`}
            >
              <span>{label}</span>
              <span className="origami-tabular">
                {id === 'pending' ? pendingTotal : gradedTotal}
              </span>
            </button>
          ))}
        </div>

        <div className={`origami-card ${styles.filters}`}>
          <div>
            <label htmlFor="group-filter" className="origami-label">
              Grupo
            </label>
            <select
              id="group-filter"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="origami-field"
            >
              <option value="">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="type-filter" className="origami-label">
              Tipo de Actividad
            </label>
            <select
              id="type-filter"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="origami-field"
            >
              <option value="">Todos los tipos</option>
              <option value="fill_blank">
                Espacios en blanco (fill_blank)
              </option>
              <option value="open_question">
                Pregunta abierta (open_question)
              </option>
              <option value="speaking">Expresión oral (speaking)</option>
              <option value="exam">Examen (exam)</option>
            </select>
          </div>

          <div>
            <label htmlFor="from-date" className="origami-label">
              Desde
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="origami-field"
            />
          </div>

          <div>
            <label htmlFor="to-date" className="origami-label">
              Hasta
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="origami-field"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div
          className={`origami-state origami-state--success ${styles.notice}`}
        >
          <span role="status">{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="origami-button origami-button--text"
            aria-label="Cerrar confirmación"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      {shownErrorMessage && (
        <div className={`origami-state origami-state--error ${styles.notice}`}>
          <span role="alert">{shownErrorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="origami-button origami-button--text"
            aria-label="Cerrar aviso de error"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      )}

      <div className={styles.layout}>
        <section className={styles.queue} aria-label="Cola de revisión">
          {reviewTabs.map(({ id }) => (
            <div
              key={id}
              id={`review-queue-${id}`}
              role="tabpanel"
              aria-labelledby={`review-tab-${id}`}
              hidden={activeTab !== id}
            >
              {activeTab === id && (
                <>
                  <div className={styles.queueSummary}>
                    <h2
                      ref={queueHeadingRef}
                      tabIndex={-1}
                      className="origami-section-title"
                    >
                      {activeTab === 'pending'
                        ? 'Entregas por calificar'
                        : 'Historial de calificados'}{' '}
                      ({currentList.length})
                    </h2>
                    {isLoadingList && (
                      <span className="origami-meta">Actualizando…</span>
                    )}
                  </div>

                  {currentList.length === 0 ? (
                    <p className="origami-card">
                      {activeTab === 'pending'
                        ? 'No hay actividades pendientes de revisión.'
                        : 'No se encontraron entregas calificadas con los filtros aplicados.'}
                    </p>
                  ) : (
                    <ul className={styles.rows}>
                      {currentList.map((item) => {
                        const isSelected =
                          selectedAttemptId === item.attempt.attemptId;
                        const formattedScore =
                          item.attempt.score?.toFixed(1).replace('.', ',') ??
                          null;

                        return (
                          <li key={item.attempt.attemptId}>
                            <button
                              type="button"
                              aria-current={isSelected ? 'true' : undefined}
                              onClick={(event) =>
                                openDetail(
                                  item.attempt.attemptId,
                                  event.currentTarget,
                                )
                              }
                              className={`origami-card ${styles.row} ${isSelected ? 'origami-selected' : ''}`}
                            >
                              <strong>{item.activity.title}</strong>
                              <span>{item.student.displayName}</span>
                              <span className={styles.rowMeta}>
                                {item.group.name} ·{' '}
                                {item.student.ageSegment === 'kids'
                                  ? 'Kids'
                                  : 'Teens'}
                              </span>
                              <span className={styles.rowMeta}>
                                {item.activity.type === 'fill_blank'
                                  ? 'Espacios'
                                  : item.activity.type === 'speaking'
                                    ? 'Speaking'
                                    : item.activity.type === 'exam'
                                      ? 'Examen'
                                      : item.activity.type === 'game'
                                        ? 'Minijuego'
                                        : 'Pregunta'}
                                {' · '}
                                {formattedScore !== null
                                  ? `${formattedScore} / 5,0`
                                  : 'Por revisar'}
                              </span>
                              {isSelected && (
                                <span className={styles.mark}>
                                  <Check aria-hidden="true" /> Seleccionada
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          ))}
        </section>

        <section
          className={`origami-card ${styles.detail}`}
          aria-label="Detalle de la entrega"
        >
          <button
            ref={backButtonRef}
            type="button"
            onClick={returnToQueue}
            className={`origami-button origami-button--secondary ${styles.back}`}
          >
            <ArrowLeft aria-hidden="true" /> Volver a la cola
          </button>
          {isLoadingDetail ? (
            <p role="status" className={styles.placeholder}>
              Cargando contexto de evaluación…
            </p>
          ) : !detail ? (
            <p className={styles.placeholder}>
              {detailQuery.isError
                ? 'No se pudo cargar la entrega. Vuelve a seleccionarla para intentar de nuevo.'
                : 'Selecciona una entrega de la cola para comenzar su revisión.'}
            </p>
          ) : (
            <form onSubmit={handleSubmitReview} className={styles.form}>
              {/* Header Info */}
              <header className={styles.detailHeader}>
                <p className="origami-meta">
                  Intento #{detail.attempt.attemptNumber}
                </p>
                <h2 className="origami-section-title">
                  {detail.activity.title}
                </h2>
                <p className="origami-meta">
                  Alumno: <strong>{detail.student.displayName}</strong> (
                  {detail.group.name})
                </p>
              </header>

              {/* Audio Playback for speaking */}
              {detail.activity.type === ActivityType.speaking && (
                <section
                  className={styles.submission}
                  aria-labelledby="review-audio-title"
                >
                  <div className={styles.inlineActions}>
                    <h3 id="review-audio-title" className={styles.mark}>
                      <Mic aria-hidden="true" /> Audio de la entrega
                    </h3>
                    <button
                      type="button"
                      onClick={handleDownloadAudio}
                      className="origami-button origami-button--secondary"
                    >
                      <Download aria-hidden="true" /> Descargar audio
                    </button>
                  </div>

                  {detail.mediaAsset?.status === 'deleted' ? (
                    <p className="origami-state">
                      El audio cumplió los 30 días de retención y fue eliminado
                      automáticamente de la nube.
                    </p>
                  ) : isLoadingAudio ? (
                    <p className="origami-meta">
                      Obteniendo enlace seguro de audio…
                    </p>
                  ) : audioUrl ? (
                    <>
                      <audio
                        ref={audioRef}
                        controls
                        className={styles.audio}
                        src={audioUrl}
                        aria-labelledby="review-audio-title"
                      >
                        Tu navegador no soporta el reproductor de audio. Usa el
                        botón Descargar audio.
                      </audio>
                      {audioWarning && (
                        <p className="origami-state origami-state--warning">
                          El audio original no pudo convertirse a MP4 estándar.
                          Si tu navegador no lo reproduce directamente, usa el
                          botón Descargar audio.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="origami-meta">
                      Audio no disponible para reproducción en línea.
                    </p>
                  )}
                </section>
              )}

              {/* Submission answers & rubric */}
              <div className={styles.submission}>
                <h3 className="origami-card-title">
                  Respuestas y contenido de la actividad
                </h3>

                {detail.items.length === 0 ? (
                  <p className="origami-meta">
                    Sin detalles adicionales para mostrar.
                  </p>
                ) : (
                  <div className={styles.submission}>
                    {detail.items.map((it, idx) => {
                      const isSpeaking =
                        detail.activity.type === ActivityType.speaking;
                      const isMultiItem = detail.items.length > 1;
                      const rawAnswer = isMultiItem
                        ? detail.answers[it.id]
                        : (detail.answers[it.id] ??
                          detail.answers['text'] ??
                          detail.answers[detail.activity.id]);
                      let displayAnswer: string | null = null;
                      if (rawAnswer !== undefined && rawAnswer !== null) {
                        if (
                          typeof rawAnswer === 'object' &&
                          rawAnswer !== null &&
                          'text' in rawAnswer
                        ) {
                          const textVal = Reflect.get(rawAnswer, 'text');
                          displayAnswer =
                            textVal !== null && textVal !== undefined
                              ? String(textVal)
                              : '';
                        } else if (typeof rawAnswer === 'object') {
                          displayAnswer = JSON.stringify(rawAnswer, null, 2);
                        } else {
                          displayAnswer = String(rawAnswer);
                        }
                      }

                      return (
                        <div key={it.id || idx} className={styles.answerSheet}>
                          {it.prompt && (
                            <p>
                              <strong>{formatBlankPrompt(it.prompt)}</strong>
                            </p>
                          )}
                          {it.question && (
                            <p>
                              <strong>{it.question}</strong>
                            </p>
                          )}

                          <dl>
                            <dt className="origami-meta">
                              {isSpeaking
                                ? 'Entrega de Speaking'
                                : 'Respuesta del alumno'}
                            </dt>
                            <dd className={styles.answer}>
                              {isSpeaking
                                ? 'Grabación de voz entregada (reproduce o descarga el audio arriba).'
                                : displayAnswer?.trim()
                                  ? displayAnswer
                                  : '(Sin respuesta registrada)'}
                            </dd>
                          </dl>

                          {it.rubricText && (
                            <p className="origami-state">
                              <strong>Rúbrica / Criterio:</strong>{' '}
                              {it.rubricText}
                            </p>
                          )}
                          {it.correctAnswer != null && (
                            <p className="origami-state origami-state--success">
                              <strong>Respuesta modelo / correcta:</strong>{' '}
                              {typeof it.correctAnswer === 'object'
                                ? JSON.stringify(it.correctAnswer)
                                : String(it.correctAnswer)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Score Input (only editable in pending_review) */}
              <div className={styles.fieldGroup}>
                {detail.attempt.status === 'pending_review' ? (
                  <>
                    <label htmlFor="score-input" className="origami-label">
                      Calificación (0,0 – 5,0)
                    </label>
                    <input
                      id="score-input"
                      type="text"
                      inputMode="decimal"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="Ej. 4,5"
                      required
                      className={`origami-field origami-tabular ${styles.score}`}
                    />
                  </>
                ) : (
                  <p className={`origami-tabular ${styles.mark}`}>
                    <Lock aria-hidden="true" />
                    <span>Calificación inmutable:</span>
                    <strong>
                      {detail.attempt.score !== null
                        ? detail.attempt.score.toFixed(1).replace('.', ',')
                        : '—'}{' '}
                      / 5,0
                    </strong>
                  </p>
                )}
              </div>

              {/* Feedback Comment */}
              <div className={styles.fieldGroup}>
                <label htmlFor="comment-input" className="origami-label">
                  Comentario de Retroalimentación
                  {(detail.activity.type === ActivityType.open_question ||
                    detail.activity.type === ActivityType.speaking) && (
                    <span className="origami-meta"> (obligatorio)</span>
                  )}
                </label>
                <textarea
                  id="comment-input"
                  aria-describedby="review-comment-count"
                  rows={3}
                  maxLength={2000}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Escribe palabras de aliento o correcciones específicas para el estudiante..."
                  className="origami-field"
                />
                <span id="review-comment-count" className="origami-meta">
                  {commentInput.length} / 2000 caracteres
                </span>
              </div>

              {/* Stickers Selector */}
              <fieldset className={styles.stickerField}>
                <legend className="origami-label">
                  Stickers de Celebración y Ánimo (hasta 3)
                </legend>
                <div className={styles.stickers}>
                  {STICKER_CODES.map((code) => {
                    const st = STICKERS[code];
                    const isSelected = selectedStickers.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleSticker(code)}
                        className={`origami-button origami-button--secondary ${styles.flatButton} ${styles.sticker} ${isSelected ? 'origami-selected' : ''}`}
                      >
                        <span aria-hidden="true">{st.emoji}</span>
                        <span>{st.label}</span>
                        {isSelected && (
                          <Check
                            className={styles.stickerCheck}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Retry Controls */}
              <div className={styles.retry}>
                <div>
                  <h3 className="origami-card-title">
                    Habilitar nuevo intento
                  </h3>
                  <p id="review-retry-hint" className="origami-meta">
                    Permite que el alumno tome un intento adicional (
                    {detail.attempt.attemptNumber + 1})
                  </p>
                </div>
                {detail.attempt.retryGrantedAt ? (
                  <p className="origami-state origami-state--success">
                    Reintento ya concedido
                  </p>
                ) : (
                  <label
                    htmlFor="allow-retry-toggle"
                    className={styles.retryToggle}
                  >
                    <input
                      id="allow-retry-toggle"
                      name="allowRetry"
                      aria-describedby="review-retry-hint"
                      type="checkbox"
                      checked={allowRetry}
                      onChange={(e) => setAllowRetry(e.target.checked)}
                    />
                    Permitir nuevo intento al estudiante
                  </label>
                )}

                {allowRetry && !detail.attempt.retryGrantedAt && (
                  <div className={styles.fieldGroup}>
                    <label htmlFor="extend-date" className="origami-label">
                      Extender fecha límite hasta (opcional)
                    </label>
                    <input
                      id="extend-date"
                      type="datetime-local"
                      value={retryExtendUntil}
                      onChange={(e) => setRetryExtendUntil(e.target.value)}
                      className="origami-field"
                    />

                    {/* Deadline & Warning (RF-8, Decision 61) */}
                    {new Date(detail.assignment.dueAt).getTime() < Date.now() &&
                      !retryExtendUntil && (
                        <p className="origami-state origami-state--warning">
                          La actividad ya cerró. Sin una nueva fecha, el alumno
                          no podrá empezar el intento.
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className={styles.submit}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="origami-button"
                >
                  {isSubmitting
                    ? 'Guardando…'
                    : 'Guardar Revisión y Retroalimentación'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
