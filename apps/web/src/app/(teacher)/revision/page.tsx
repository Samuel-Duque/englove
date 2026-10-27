'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  ActivityType,
  STICKERS,
  STICKER_CODES,
  StickerCode,
  ReviewListItemView,
  ReviewListResponse,
  AttemptReviewDetailView,
  GroupView,
  GroupListResponse,
  MediaPlaybackUrlResponse,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

function RevisionContent() {
  const [activeTab, setActiveTab] = useState<'pending' | 'graded'>('pending');
  const [pendingItems, setPendingItems] = useState<ReviewListItemView[]>([]);
  const [gradedItems, setGradedItems] = useState<ReviewListItemView[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [gradedTotal, setGradedTotal] = useState(0);

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AttemptReviewDetailView | null>(null);
  const [groups, setGroups] = useState<GroupView[]>([]);

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

  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioWarning, setAudioWarning] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);

  // Status & notifications
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load groups for filter dropdown
  useEffect(() => {
    apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100')
      .then((res) => setGroups(res.items))
      .catch(() => {});
  }, []);

  // Fetch list data
  const fetchList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (selectedGroupId) params.set('groupId', selectedGroupId);
      if (selectedType) params.set('type', selectedType);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const [pendingRes, gradedRes] = await Promise.all([
        apiFetch<ReviewListResponse>(`/api/v1/reviews/queue?${params.toString()}`),
        apiFetch<ReviewListResponse>(`/api/v1/reviews/graded?${params.toString()}`),
      ]);

      setPendingItems(pendingRes.items);
      setPendingTotal(pendingRes.total);
      setGradedItems(gradedRes.items);
      setGradedTotal(gradedRes.total);

      // Auto-select first pending if none selected
      if (!selectedAttemptId && pendingRes.items.length > 0 && activeTab === 'pending') {
        setSelectedAttemptId(pendingRes.items[0]?.attempt.attemptId ?? null);
      }
    } catch (err) {
      setErrorMessage((err as ApiError)?.message || 'Error al cargar las entregas para revisión');
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedGroupId, selectedType, fromDate, toDate, selectedAttemptId, activeTab]);

  useEffect(() => {
    fetchList();
    // 30s polling
    const interval = setInterval(fetchList, 30_000);
    return () => clearInterval(interval);
  }, [fetchList]);

  // Load attempt detail
  const loadDetail = useCallback(async (attemptId: string) => {
    setIsLoadingDetail(true);
    setAudioUrl(null);
    setAudioWarning(false);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const data = await apiFetch<AttemptReviewDetailView>(`/api/v1/attempts/${attemptId}/review-detail`);
      setDetail(data);

      // Initialize form fields
      setScoreInput(data.attempt.score !== null ? data.attempt.score.toFixed(1) : '');
      setCommentInput(data.review?.comment || '');
      setSelectedStickers(data.review?.stickers || []);
      setAllowRetry(false);
      setRetryExtendUntil('');

      // If speaking with ready media, load audio URL
      if (data.activity.type === ActivityType.speaking && data.mediaAsset && data.mediaAsset.status !== 'deleted') {
        setIsLoadingAudio(true);
        try {
          const mediaRes = await apiFetch<MediaPlaybackUrlResponse>(`/api/v1/media/${data.mediaAsset.id}/url`);
          setAudioUrl(mediaRes.url);
          setAudioWarning(Boolean(mediaRes.compatibilityWarning || mediaRes.format !== 'converted'));
        } catch {
          // Audio load error handled visually
        } finally {
          setIsLoadingAudio(false);
        }
      }
    } catch (err) {
      setErrorMessage((err as ApiError)?.message || 'Error al cargar el detalle del intento');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAttemptId) {
      loadDetail(selectedAttemptId);
    } else {
      setDetail(null);
    }
  }, [selectedAttemptId, loadDetail]);

  const handleDownloadAudio = async () => {
    if (!detail?.mediaAsset?.id) return;
    try {
      const downloadRes = await apiFetch<MediaPlaybackUrlResponse>(
        `/api/v1/media/${detail.mediaAsset.id}/download-url`,
      );
      window.open(downloadRes.url, '_blank');
    } catch (err) {
      setErrorMessage((err as ApiError)?.message || 'Error al obtener enlace de descarga de audio');
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

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const isPending = detail.attempt.status === 'pending_review';
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
        retryExtendUntil: retryExtendUntil ? new Date(retryExtendUntil).toISOString() : null,
      };

      if (isPending) {
        const parsedScore = parseFloat(scoreInput);
        if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 5) {
          setErrorMessage('Ingresa una calificación válida entre 0.0 y 5.0');
          setIsSubmitting(false);
          return;
        }
        body.score = parsedScore;
      }

      const updated = await apiFetch<AttemptReviewDetailView>(
        `/api/v1/attempts/${detail.attempt.attemptId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );

      setDetail(updated);
      setSuccessMessage('¡Calificación y retroalimentación guardadas exitosamente!');
      fetchList();
    } catch (err) {
      setErrorMessage((err as ApiError)?.message || 'Error al guardar la revisión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentList = activeTab === 'pending' ? pendingItems : gradedItems;

  return (
    <div className="space-y-6">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Revisión y Calificación Docente
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Evalúa las entregas de tus estudiantes, reproduce audios, añade stickers y gestiona nuevos intentos.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl self-start sm:self-center" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending'}
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pending'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span>Pendientes</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                pendingTotal > 0 ? 'bg-amber-100 text-amber-900' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              {pendingTotal}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'graded'}
            onClick={() => setActiveTab('graded')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'graded'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span>Calificados</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-zinc-200 text-zinc-700">
              {gradedTotal}
            </span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200 text-xs">
        <div>
          <label htmlFor="group-filter" className="block font-semibold text-zinc-700 mb-1">
            Grupo
          </label>
          <select
            id="group-filter"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <label htmlFor="type-filter" className="block font-semibold text-zinc-700 mb-1">
            Tipo de Actividad
          </label>
          <select
            id="type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los tipos</option>
            <option value="fill_blank">Espacios en blanco (fill_blank)</option>
            <option value="open_question">Pregunta abierta (open_question)</option>
            <option value="speaking">Expresión oral (speaking)</option>
            <option value="exam">Examen (exam)</option>
          </select>
        </div>

        <div>
          <label htmlFor="from-date" className="block font-semibold text-zinc-700 mb-1">
            Desde
          </label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="to-date" className="block font-semibold text-zinc-700 mb-1">
            Hasta
          </label>
          <input
            id="to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center justify-between">
          <span>✅ {successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-700 hover:text-rose-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Attempt Queue List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 px-1">
            <span>
              {activeTab === 'pending' ? 'Entregas por calificar' : 'Historial de calificados'} ({currentList.length})
            </span>
            {isLoadingList && <span className="text-blue-600 animate-pulse">Actualizando…</span>}
          </div>

          {currentList.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-300 bg-white text-zinc-500 space-y-2">
              <span className="text-3xl">🎉</span>
              <p className="text-sm font-bold text-zinc-700">
                {activeTab === 'pending'
                  ? 'No hay actividades pendientes de revisión.'
                  : 'No se encontraron entregas calificadas con los filtros aplicados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {currentList.map((item) => {
                const isSelected = selectedAttemptId === item.attempt.attemptId;
                const formattedScore = item.attempt.score !== null ? item.attempt.score.toFixed(1).replace('.', ',') : null;

                return (
                  <button
                    key={item.attempt.attemptId}
                    type="button"
                    onClick={() => setSelectedAttemptId(item.attempt.attemptId)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-zinc-900 block">
                          {item.student.displayName}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {item.group.name} · {item.student.ageSegment === 'kids' ? 'Kids' : 'Teens'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-zinc-100 text-zinc-800">
                        {item.activity.type === 'fill_blank'
                          ? 'Espacios'
                          : item.activity.type === 'speaking'
                            ? 'Speaking'
                            : item.activity.type === 'exam'
                              ? 'Examen'
                              : 'Pregunta'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100">
                      <span className="font-semibold text-zinc-700 truncate max-w-[200px]">
                        {item.activity.title}
                      </span>
                      {formattedScore !== null ? (
                        <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {formattedScore} / 5,0
                        </span>
                      ) : (
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[11px]">
                          Por revisar
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Review & Detail Panel */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs">
          {isLoadingDetail ? (
            <div className="py-20 text-center text-zinc-500 space-y-2">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold">Cargando contexto de evaluación…</p>
            </div>
          ) : !detail ? (
            <div className="py-20 text-center text-zinc-400 space-y-2">
              <span className="text-4xl">👉</span>
              <p className="text-sm font-semibold text-zinc-600">
                Selecciona una entrega de la lista izquierda para comenzar su revisión.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-6">
              {/* Header Info */}
              <div className="border-b border-zinc-200 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      Intento #{detail.attempt.attemptNumber}
                    </span>
                    <h2 className="text-xl font-black text-zinc-900 mt-0.5">
                      {detail.activity.title}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      Alumno: <strong className="text-zinc-800">{detail.student.displayName}</strong> ({detail.group.name})
                    </p>
                  </div>

                  {detail.attempt.status === 'graded' && detail.attempt.score !== null && (
                    <div className="text-right">
                      <span className="text-2xl font-black text-emerald-600">
                        {detail.attempt.score.toFixed(1).replace('.', ',')}
                      </span>
                      <span className="text-xs text-zinc-500 font-bold block">de 5,0</span>
                      <div className="flex gap-0.5 justify-end mt-0.5" aria-label={`Calificación: ${detail.attempt.stars} estrellas`}>
                        {[1, 2, 3].map((star) => (
                          <span key={star} className="text-sm">
                            {star <= detail.attempt.stars ? '⭐' : '☆'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Audio Playback for speaking */}
              {detail.activity.type === ActivityType.speaking && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <span>🎙️</span>
                      <span>Audio de la entrega</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadAudio}
                      className="text-xs font-bold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>📥</span>
                      <span>Descargar audio</span>
                    </button>
                  </div>

                  {detail.mediaAsset?.status === 'deleted' ? (
                    <div className="p-3 bg-zinc-100 rounded-xl text-xs text-zinc-600">
                      ℹ️ El audio cumplió los 30 días de retención y fue eliminado automáticamente de la nube.
                    </div>
                  ) : isLoadingAudio ? (
                    <div className="text-xs text-zinc-500 animate-pulse">Obteniendo enlace seguro de audio…</div>
                  ) : audioUrl ? (
                    <div className="space-y-2">
                      <audio controls className="w-full h-10 rounded-lg" src={audioUrl}>
                        Tu navegador no soporta el reproductor de audio. Usa el botón Descargar audio.
                      </audio>
                      {audioWarning && (
                        <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          ⚠️ El audio original no pudo convertirse a MP4 estándar. Si tu navegador no lo reproduce directamente, usa el botón Descargar audio.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Audio no disponible para reproducción en línea.</p>
                  )}
                </div>
              )}

              {/* Submission answers & rubric */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase text-zinc-500 tracking-wider">
                  Respuestas y Contenido de la Actividad
                </h3>

                {detail.items.length === 0 ? (
                  <p className="text-xs text-zinc-400">Sin detalles adicionales para mostrar.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.items.map((it, idx) => {
                      const isSpeaking = detail.activity.type === ActivityType.speaking;
                      const rawAnswer =
                        detail.answers[it.id] ??
                        detail.answers['text'] ??
                        detail.answers[detail.activity.id];
                      let displayAnswer: string | null = null;
                      if (rawAnswer !== undefined && rawAnswer !== null) {
                        if (
                          typeof rawAnswer === 'object' &&
                          'text' in (rawAnswer as Record<string, unknown>)
                        ) {
                          displayAnswer = String((rawAnswer as Record<string, unknown>).text);
                        } else if (typeof rawAnswer === 'object') {
                          displayAnswer = JSON.stringify(rawAnswer, null, 2);
                        } else {
                          displayAnswer = String(rawAnswer);
                        }
                      }

                      return (
                        <div
                          key={it.id || idx}
                          className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 text-xs"
                        >
                          {it.prompt && <p className="font-bold text-zinc-800">{it.prompt}</p>}
                          {it.question && <p className="font-bold text-zinc-800">{it.question}</p>}

                          <div className="pt-1">
                            <span className="font-semibold text-zinc-500 block">
                              {isSpeaking ? 'Entrega de Speaking:' : 'Respuesta del alumno:'}
                            </span>
                            <div className="mt-0.5 p-2 bg-white rounded-lg border border-zinc-200 font-mono text-zinc-900">
                              {isSpeaking ? (
                                <span className="font-sans text-blue-900 font-semibold">
                                  🎙️ Grabación de voz entregada (reproduce o descarga el audio arriba).
                                </span>
                              ) : displayAnswer !== null ? (
                                displayAnswer
                              ) : (
                                '(Sin respuesta registrada)'
                              )}
                            </div>
                          </div>

                          {it.rubricText && (
                            <p className="text-[11px] text-zinc-600 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60">
                              <strong>Rúbrica / Criterio:</strong> {it.rubricText}
                            </p>
                          )}
                          {it.correctAnswer != null && (
                            <p className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/60">
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
              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <label htmlFor="score-input" className="block text-xs font-bold text-zinc-700">
                  Calificación (0,0 – 5,0)
                </label>
                {detail.attempt.status === 'pending_review' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id="score-input"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      placeholder="Ej. 4.5"
                      required
                      className="w-32 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-zinc-500">sobre 5,0</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-black">
                    <span>🔒 Calificación inmutable:</span>
                    <span>{detail.attempt.score !== null ? detail.attempt.score.toFixed(1).replace('.', ',') : '—'} / 5,0</span>
                  </div>
                )}
              </div>

              {/* Feedback Comment */}
              <div className="space-y-2">
                <label htmlFor="comment-input" className="block text-xs font-bold text-zinc-700">
                  Comentario de Retroalimentación
                  {(detail.activity.type === ActivityType.open_question || detail.activity.type === ActivityType.speaking) && (
                    <span className="text-rose-500 ml-1">* (Obligatorio)</span>
                  )}
                </label>
                <textarea
                  id="comment-input"
                  rows={3}
                  maxLength={2000}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Escribe palabras de aliento o correcciones específicas para el estudiante..."
                  className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[11px] text-zinc-400 block text-right">
                  {commentInput.length} / 2000 caracteres
                </span>
              </div>

              {/* Stickers Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-700">
                  Stickers de Celebración y Ánimo (hasta 3)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STICKER_CODES.map((code) => {
                    const st = STICKERS[code];
                    const isSelected = selectedStickers.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleSticker(code)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-950 font-black shadow-xs ring-1 ring-indigo-500'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        <span className="text-lg">{st.emoji}</span>
                        <span className="leading-tight text-[11px]">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Retry Controls */}
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-zinc-900 block">Habilitar Nuevo Intento</span>
                    <span className="text-[11px] text-zinc-500">
                      Permite que el alumno tome un intento adicional ({detail.attempt.attemptNumber + 1})
                    </span>
                  </div>

                  {detail.attempt.retryGrantedAt ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900">
                      ✓ Reintento ya concedido
                    </span>
                  ) : (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowRetry}
                        onChange={(e) => setAllowRetry(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  )}
                </div>

                {allowRetry && !detail.attempt.retryGrantedAt && (
                  <div className="space-y-2 pt-2 border-t border-zinc-200">
                    <label htmlFor="extend-date" className="block text-xs font-semibold text-zinc-700">
                      Extender fecha límite hasta (opcional)
                    </label>
                    <input
                      id="extend-date"
                      type="datetime-local"
                      value={retryExtendUntil}
                      onChange={(e) => setRetryExtendUntil(e.target.value)}
                      className="w-full sm:w-auto rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Deadline & Warning (RF-8, Decision 61) */}
                    {new Date(detail.assignment.dueAt).getTime() < Date.now() && !retryExtendUntil && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        ⚠️ La actividad ya cerró. Sin una nueva fecha, el alumno no podrá empezar el intento.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {isSubmitting ? 'Guardando…' : 'Guardar Revisión y Retroalimentación'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RevisionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-500">Cargando consola de revisión…</div>}>
      <RevisionContent />
    </Suspense>
  );
}
