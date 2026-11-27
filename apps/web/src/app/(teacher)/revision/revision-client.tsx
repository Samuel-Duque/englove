'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  CircleAlert,
  ClipboardCheck,
  Download,
  Lock,
  Mic,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import {
  ActivityType,
  AttemptReviewDetailView,
  AttemptReviewDetailViewSchema,
  GroupListResponse,
  GroupListResponseSchema,
  GroupView,
  MediaPlaybackUrlResponse,
  MediaPlaybackUrlResponseSchema,
  ReviewListItemView,
  ReviewListResponse,
  ReviewListResponseSchema,
  STICKERS,
  STICKER_CODES,
  StickerCode,
} from '@upward-english/shared';
import { ErrorState } from '../../../components/error-state';
import { apiFetch, ApiError } from '../../../lib/api';
import { formatBlankPrompt } from '../../../lib/blank-prompt';
import { POLLING_INTERVAL_MS } from '../../../lib/query-client';
import styles from './revision.module.css';

const BOGOTA_TIME_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'America/Bogota',
});

const BOGOTA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Bogota',
});

const OVERDUE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

const ACTIVITY_TYPE_BADGE_LABELS: Readonly<Record<string, string>> = {
  fill_blank: 'Espacios',
  open_question: 'Pregunta abierta',
  speaking: 'Speaking',
  exam: 'Examen',
  game: 'Minijuego',
};

function formatScore(score: number): string {
  return score.toFixed(1).replace('.', ',');
}

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatBogotaDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return BOGOTA_DATE_TIME_FORMATTER.format(date);
}

function parseBogotaDateTimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const parsed = new Date(`${withSeconds}-05:00`);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
  }
  return parsed.toISOString();
}

function isPendingOverdue(item: ReviewListItemView): boolean {
  if (item.attempt.status !== 'pending_review') return false;
  const deadline = item.attempt.effectiveDueAt || item.assignment.dueAt;
  if (!deadline) return false;
  const deadlineMs = new Date(deadline).getTime();
  if (Number.isNaN(deadlineMs)) return false;
  return Date.now() - deadlineMs > OVERDUE_THRESHOLD_MS;
}

function parseScoreValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
  const normalized = trimmed.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 5) return null;
  return Math.round(parsed * 10) / 10;
}

interface DetailQueryResult {
  detail: AttemptReviewDetailView;
  audioUrl: string | null;
  audioWarning: boolean;
  audioFormat: 'converted' | 'raw' | null;
  audioDurationSeconds: number | null;
}

export function RevisionClient() {
  const queryClient = useQueryClient();

  const pendingTabId = useId();
  const gradedTabId = useId();
  const listPanelId = useId();
  const scoreHintId = useId();
  const scoreErrorId = useId();
  const commentErrorId = useId();

  const pendingTabRef = useRef<HTMLButtonElement>(null);
  const gradedTabRef = useRef<HTMLButtonElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const hydratedAttemptRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<'pending' | 'graded'>('pending');
  const [mobilePane, setMobilePane] = useState<'list' | 'inspector'>('list');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  // Filtros
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Estado del formulario de evaluación
  const [scoreInput, setScoreInput] = useState<string>('');
  const [commentInput, setCommentInput] = useState<string>('');
  const [selectedStickers, setSelectedStickers] = useState<StickerCode[]>([]);
  const [allowRetry, setAllowRetry] = useState<boolean>(false);
  const [retryExtendUntil, setRetryExtendUntil] = useState<string>('');

  // Avisos, errores de campo y región aria-live para stickers
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scoreFieldError, setScoreFieldError] = useState<string | null>(null);
  const [commentFieldError, setCommentFieldError] = useState<string | null>(null);
  const [stickerLimitNotice, setStickerLimitNotice] = useState<string>('');

  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: ({ signal }) =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
        signal,
      }),
  });
  const groups: GroupView[] = groupsQuery.data?.items ?? [];

  const listParams = new URLSearchParams();
  if (selectedGroupId) listParams.set('groupId', selectedGroupId);
  if (selectedType) listParams.set('type', selectedType);
  if (fromDate) listParams.set('from', fromDate);
  if (toDate) listParams.set('to', toDate);
  const listQueryString = listParams.toString();

  const pendingQuery = useQuery({
    queryKey: ['reviews', 'queue', listQueryString],
    queryFn: ({ signal }) =>
      apiFetch<ReviewListResponse>(`/api/v1/reviews/queue?${listQueryString}`, {
        schema: ReviewListResponseSchema,
        signal,
      }),
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const gradedQuery = useQuery({
    queryKey: ['reviews', 'graded', listQueryString],
    queryFn: ({ signal }) =>
      apiFetch<ReviewListResponse>(`/api/v1/reviews/graded?${listQueryString}`, {
        schema: ReviewListResponseSchema,
        signal,
      }),
    refetchInterval: POLLING_INTERVAL_MS,
  });

  const pendingItems: ReviewListItemView[] = pendingQuery.data?.items ?? [];
  const gradedItems: ReviewListItemView[] = gradedQuery.data?.items ?? [];
  const pendingTotal = pendingQuery.data?.total ?? 0;
  const gradedTotal = gradedQuery.data?.total ?? 0;

  const isFetchingLists = pendingQuery.isFetching || gradedQuery.isFetching;
  const isInitialLoadingList =
    activeTab === 'pending' ? pendingQuery.isPending : gradedQuery.isPending;
  const listError = activeTab === 'pending' ? pendingQuery.error : gradedQuery.error;
  const listErrorMessage = listError
    ? listError instanceof ApiError
      ? listError.message
      : 'Error al cargar las entregas para revisión.'
    : null;
  const shownErrorMessage = errorMessage ?? listErrorMessage;

  const currentList = activeTab === 'pending' ? pendingItems : gradedItems;

  const lastUpdatedAt = Math.max(
    pendingQuery.dataUpdatedAt ?? 0,
    gradedQuery.dataUpdatedAt ?? 0,
  );
  const pollingHasError = Boolean(pendingQuery.isError || gradedQuery.isError);

  // Autoseleccionar primera entrega disponible cuando cambia la pestaña o la lista
  useEffect(() => {
    if (currentList.length === 0) {
      if (selectedAttemptId !== null) {
        setSelectedAttemptId(null);
      }
      return;
    }
    const stillVisible = currentList.some(
      (item) => item.attempt.attemptId === selectedAttemptId,
    );
    if (!stillVisible) {
      const firstId = currentList[0]?.attempt.attemptId ?? null;
      setSelectedAttemptId(firstId);
    }
  }, [currentList, selectedAttemptId]);

  const detailQuery = useQuery<DetailQueryResult | null>({
    queryKey: ['teacher', 'review-detail', selectedAttemptId],
    queryFn: async ({ signal }) => {
      if (!selectedAttemptId) return null;
      const data = await apiFetch<AttemptReviewDetailView>(
        `/api/v1/attempts/${selectedAttemptId}/review-detail`,
        { schema: AttemptReviewDetailViewSchema, signal },
      );

      let audioUrl: string | null = null;
      let audioWarning = false;
      let audioFormat: 'converted' | 'raw' | null = null;
      let audioDurationSeconds: number | null = data.mediaAsset?.durationSeconds ?? null;

      if (
        data.activity.type === ActivityType.speaking &&
        data.mediaAsset &&
        data.mediaAsset.status !== 'deleted'
      ) {
        try {
          const mediaRes = await apiFetch<MediaPlaybackUrlResponse>(
            `/api/v1/media/${data.mediaAsset.id}/url`,
            { schema: MediaPlaybackUrlResponseSchema, signal },
          );
          audioUrl = mediaRes.url;
          audioFormat = mediaRes.format;
          audioWarning = Boolean(mediaRes.compatibilityWarning || mediaRes.format !== 'converted');
          if (mediaRes.durationSeconds !== undefined && mediaRes.durationSeconds !== null) {
            audioDurationSeconds = mediaRes.durationSeconds;
          }
        } catch {
          // Mantiene tolerancia si el audio aún no está disponible o el mock de pruebas omite campos opcionales
        }
      }

      return {
        detail: data,
        audioUrl,
        audioWarning,
        audioFormat,
        audioDurationSeconds,
      };
    },
    enabled: Boolean(selectedAttemptId),
  });

  const detail = detailQuery.data?.detail ?? null;
  const audioUrl = detailQuery.data?.audioUrl ?? null;
  const audioWarning = detailQuery.data?.audioWarning ?? false;
  const audioFormat = detailQuery.data?.audioFormat ?? null;
  const audioDurationSeconds =
    detailQuery.data?.audioDurationSeconds ?? detail?.mediaAsset?.durationSeconds ?? null;
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
      data.attempt.score !== null ? formatScore(data.attempt.score) : '',
    );
    setCommentInput(data.review?.comment ?? '');
    setSelectedStickers(data.review?.stickers ?? []);
    setAllowRetry(false);
    setRetryExtendUntil('');
    setSuccessMessage(null);
    setErrorMessage(null);
    setScoreFieldError(null);
    setCommentFieldError(null);
    setStickerLimitNotice('');
  }, [selectedAttemptId, detailQuery.data]);

  const handleManualRefresh = () => {
    void pendingQuery.refetch();
    void gradedQuery.refetch();
    if (selectedAttemptId) {
      void detailQuery.refetch();
    }
  };

  const handleTabChange = (nextTab: 'pending' | 'graded') => {
    setActiveTab(nextTab);
    setMobilePane('list');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = activeTab === 'pending' ? 'graded' : 'pending';
      handleTabChange(next);
      if (next === 'pending') {
        pendingTabRef.current?.focus();
      } else {
        gradedTabRef.current?.focus();
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      handleTabChange('pending');
      pendingTabRef.current?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      handleTabChange('graded');
      gradedTabRef.current?.focus();
    }
  };

  const handleSelectAttempt = (attemptId: string) => {
    hydratedAttemptRef.current = null;
    setSelectedAttemptId(attemptId);
    setMobilePane('inspector');
  };

  const handleClearFilters = () => {
    setSelectedGroupId('');
    setSelectedType('');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters = Boolean(selectedGroupId || selectedType || fromDate || toDate);

  const handleDownloadAudio = async () => {
    if (!detail?.mediaAsset?.id || detail.mediaAsset.status === 'deleted') return;
    try {
      const downloadRes = await apiFetch<MediaPlaybackUrlResponse>(
        `/api/v1/media/${detail.mediaAsset.id}/download-url`,
        { schema: MediaPlaybackUrlResponseSchema },
      );
      window.open(downloadRes.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'Error al obtener enlace de descarga de audio.',
      );
    }
  };

  const toggleSticker = (code: StickerCode) => {
    if (selectedStickers.includes(code)) {
      setSelectedStickers(selectedStickers.filter((c) => c !== code));
      setStickerLimitNotice('');
      return;
    }
    if (selectedStickers.length >= 3) {
      setStickerLimitNotice('Puedes seleccionar hasta 3 stickers por revisión.');
      return;
    }
    const next = [...selectedStickers, code];
    setSelectedStickers(next);
    if (next.length === 3) {
      setStickerLimitNotice('Has alcanzado el máximo de 3 stickers seleccionados.');
    } else {
      setStickerLimitNotice('');
    }
  };

  const reviewMutation = useMutation({
    mutationFn: (body: {
      // guardrails-ignore G-C02: payload tipado de calificación manual exclusiva del docente (SPEC-07)
      score?: number;
      comment?: string;
      stickers?: StickerCode[];
      allowRetry?: boolean;
      retryExtendUntil?: string | null;
    }) =>
      apiFetch<AttemptReviewDetailView>(
        `/api/v1/attempts/${selectedAttemptId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(body),
          schema: AttemptReviewDetailViewSchema,
        },
      ),
    onSuccess: (updated) => {
      const nextCache: DetailQueryResult = {
        detail: updated,
        audioUrl,
        audioWarning,
        audioFormat,
        audioDurationSeconds,
      };
      queryClient.setQueryData<DetailQueryResult | null>(
        ['teacher', 'review-detail', selectedAttemptId],
        () => nextCache,
      );
      setScoreInput(
        updated.attempt.score !== null ? formatScore(updated.attempt.score) : '',
      );
      setAllowRetry(false);
      setRetryExtendUntil('');
      setScoreFieldError(null);
      setCommentFieldError(null);
      setErrorMessage(null);
      setSuccessMessage('¡Calificación y retroalimentación guardadas exitosamente!');
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'reminders'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === 'SCORE_OUT_OF_RANGE') {
        const msg = 'La calificación debe estar entre 0,0 y 5,0.';
        setScoreFieldError(msg);
        setErrorMessage(msg);
        scoreInputRef.current?.focus();
      } else if (err instanceof ApiError && err.code === 'COMMENT_REQUIRED') {
        const msg = 'El comentario es obligatorio para actividades de Speaking o Pregunta abierta.';
        setCommentFieldError(msg);
        setErrorMessage(msg);
        commentInputRef.current?.focus();
      } else {
        setErrorMessage(
          err instanceof ApiError ? err.message : 'Error al guardar la revisión.',
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
    setScoreFieldError(null);
    setCommentFieldError(null);

    const isPendingStatus = detail.attempt.status === 'pending_review';
    const isManualActivity =
      detail.activity.type === ActivityType.speaking ||
      detail.activity.type === ActivityType.open_question;
    const trimmedComment = commentInput.trim();

    let validatedScore: number | undefined;
    if (isPendingStatus) {
      const parsed = parseScoreValue(scoreInput);
      if (parsed === null) {
        const msg = 'Ingresa una calificación válida entre 0,0 y 5,0.';
        setScoreFieldError(msg);
        setErrorMessage(msg);
        scoreInputRef.current?.focus();
        return;
      }
      validatedScore = parsed;
    }

    if (isManualActivity && trimmedComment.length === 0) {
      const msg =
        'El comentario de retroalimentación es obligatorio para Speaking y Pregunta abierta.';
      setCommentFieldError(msg);
      setErrorMessage(msg);
      commentInputRef.current?.focus();
      return;
    }

    if (!isPendingStatus && !isManualActivity && trimmedComment.length === 0 && selectedStickers.length === 0) {
      const msg =
        'Debes ingresar un comentario o elegir al menos un sticker para guardar la retroalimentación.';
      setCommentFieldError(msg);
      setErrorMessage(msg);
      commentInputRef.current?.focus();
      return;
    }

    const body: {
      // guardrails-ignore G-C02: calificación manual enviada por docente en POST /attempts/:id/review
      score?: number;
      comment?: string;
      stickers?: StickerCode[];
      allowRetry?: boolean;
      retryExtendUntil?: string | null;
    } = {
      comment: trimmedComment,
      stickers: selectedStickers,
      allowRetry,
      retryExtendUntil: allowRetry
        ? parseBogotaDateTimeLocalToIso(retryExtendUntil)
        : null,
    };

    if (validatedScore !== undefined) {
      body.score = validatedScore;
    }

    reviewMutation.mutate(body);
  };

  const parsedScorePreview = parseScoreValue(scoreInput);
  const isManualActivity =
    detail?.activity.type === ActivityType.speaking ||
    detail?.activity.type === ActivityType.open_question;
  const maxDurationSec =
    detail?.items.find((it) => typeof it.maxDurationSeconds === 'number')
      ?.maxDurationSeconds ?? null;
  const isRetryExpiredWithoutDate = Boolean(
    detail &&
      allowRetry &&
      !detail.attempt.retryGrantedAt &&
      new Date(detail.assignment.dueAt).getTime() < Date.now() &&
      !retryExtendUntil,
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Revisión y Retroalimentación</h1>
          <p className={styles.subtitle}>
            Evalúa entregas de Speaking y Pregunta abierta, consulta actividades autocalificadas y habilita nuevos intentos.
          </p>
        </div>

        <div className={styles.headerTools}>
          <p
            role="status"
            className={styles.pollingPill}
            data-error={pollingHasError ? 'true' : undefined}
          >
            <span className={styles.pollingDot} aria-hidden="true" />
            {pollingHasError ? (
              <span>No se pudo actualizar la cola</span>
            ) : lastUpdatedAt ? (
              <span>
                Actualizado{' '}
                <time dateTime={new Date(lastUpdatedAt).toISOString()}>
                  {BOGOTA_TIME_FORMATTER.format(lastUpdatedAt)}
                </time>{' '}
                · cada 30 s
              </span>
            ) : (
              <span>Actualización cada 30 s</span>
            )}
          </p>

          <button
            type="button"
            className={styles.refreshButton}
            disabled={isFetchingLists}
            onClick={handleManualRefresh}
          >
            <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>{isFetchingLists ? 'Actualizando…' : 'Refrescar'}</span>
          </button>
        </div>
      </header>

      <section className={styles.controlsRow} aria-label="Filtros y estado de la cola">
        <div role="tablist" aria-label="Estado de revisiones" className={styles.tablist}>
          <button
            ref={pendingTabRef}
            id={pendingTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === 'pending'}
            tabIndex={activeTab === 'pending' ? 0 : -1}
            onClick={() => handleTabChange('pending')}
            onKeyDown={handleTabKeyDown}
            className={styles.tab}
          >
            <span>Pendientes</span>
            <span
              className={styles.tabCount}
              data-urgent={pendingTotal > 0 ? 'true' : undefined}
            >
              {pendingTotal}
            </span>
          </button>

          <button
            ref={gradedTabRef}
            id={gradedTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === 'graded'}
            tabIndex={activeTab === 'graded' ? 0 : -1}
            onClick={() => handleTabChange('graded')}
            onKeyDown={handleTabKeyDown}
            className={styles.tab}
          >
            <span>Calificados</span>
            <span className={styles.tabCount}>{gradedTotal}</span>
          </button>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterField}>
            <label htmlFor="group-filter" className={styles.filterLabel}>
              Grupo
            </label>
            <select
              id="group-filter"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className={styles.control}
            >
              <option value="">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="type-filter" className={styles.filterLabel}>
              Tipo de actividad
            </label>
            <select
              id="type-filter"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className={styles.control}
            >
              <option value="">Todos los tipos evaluables</option>
              <option value="speaking">Expresión oral (Speaking)</option>
              <option value="open_question">Pregunta abierta</option>
              <option value="fill_blank">Completar espacios</option>
              <option value="exam">Examen</option>
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="from-date" className={styles.filterLabel}>
              Desde
            </label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`${styles.control} ${styles.tabular}`}
            />
          </div>

          <div className={styles.filterField}>
            <label htmlFor="to-date" className={styles.filterLabel}>
              Hasta
            </label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`${styles.control} ${styles.tabular}`}
            />
          </div>

          {hasActiveFilters && (
            <div className={styles.filterFooter}>
              <button
                type="button"
                className={styles.clearFiltersBtn}
                onClick={handleClearFilters}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </section>

      {successMessage && (
        <div role="status" className={styles.bannerSuccess}>
          <span className={styles.bannerContent}>
            <Check size={18} strokeWidth={2} aria-hidden="true" />
            <span>{successMessage}</span>
          </span>
          <button
            type="button"
            aria-label="Cerrar aviso de confirmación"
            onClick={() => setSuccessMessage(null)}
            className={styles.bannerDismiss}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {shownErrorMessage && (
        <div role="alert" className={styles.bannerError}>
          <span className={styles.bannerContent}>
            <CircleAlert size={18} strokeWidth={2} aria-hidden="true" />
            <span>{shownErrorMessage}</span>
          </span>
          {errorMessage && (
            <button
              type="button"
              aria-label="Cerrar mensaje de error"
              onClick={() => setErrorMessage(null)}
              className={styles.bannerDismiss}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className={styles.paneSwitcher} role="group" aria-label="Vista en pantalla compacta">
        <button
          type="button"
          className={styles.paneSwitchBtn}
          aria-pressed={mobilePane === 'list'}
          onClick={() => setMobilePane('list')}
        >
          <span>Lista de entregas</span>
          <span className={styles.tabular}>({currentList.length})</span>
        </button>
        <button
          type="button"
          className={styles.paneSwitchBtn}
          aria-pressed={mobilePane === 'inspector'}
          onClick={() => setMobilePane('inspector')}
        >
          <span>Inspector</span>
        </button>
      </div>

      <div
        id={listPanelId}
        role="tabpanel"
        aria-labelledby={activeTab === 'pending' ? pendingTabId : gradedTabId}
        className={styles.splitLayout}
      >
        <section
          aria-label="Cola de entregas"
          className={`${styles.queueColumn} ${mobilePane === 'inspector' ? styles.paneHiddenOnMobile : ''}`}
        >
          <div className={styles.queueHeader}>
            <span className={styles.tabular}>
              {activeTab === 'pending' ? 'Entregas por calificar' : 'Historial de calificados'} (
              {currentList.length})
            </span>
            {isFetchingLists && <span>Sincronizando…</span>}
          </div>

          {isInitialLoadingList ? (
            <div className={styles.skeletonStack} role="status">
              <span className="sr-only">Cargando entregas…</span>
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
            </div>
          ) : listError && currentList.length === 0 ? (
            <ErrorState
              variant="teacher"
              editorial
              message="No pudimos cargar las entregas de revisión."
              onRetry={handleManualRefresh}
            />
          ) : currentList.length === 0 ? (
            <div className={styles.emptyCard}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <ClipboardCheck size={22} strokeWidth={1.75} />
              </span>
              <h2 className={styles.emptyTitle}>
                {activeTab === 'pending'
                  ? 'No hay entregas pendientes'
                  : 'No hay entregas calificadas'}
              </h2>
              <p className={styles.emptyDesc}>
                {hasActiveFilters
                  ? 'No encontramos entregas que coincidan con los filtros seleccionados.'
                  : activeTab === 'pending'
                    ? 'Todas las entregas de Speaking y Pregunta abierta están al día.'
                    : 'Cuando califiques entregas o tus alumnos completen actividades autocalificadas aparecerán aquí.'}
              </p>
            </div>
          ) : (
            <ul className={styles.queueList}>
              {currentList.map((item) => {
                const isSelected = selectedAttemptId === item.attempt.attemptId;
                const overdue = isPendingOverdue(item);
                const submittedDate =
                  formatBogotaDateTime(item.attempt.finishedAt ?? item.attempt.gradedAt) ??
                  'Sin fecha';
                const formattedScore =
                  item.attempt.score !== null ? formatScore(item.attempt.score) : null;
                const typeLabel =
                  ACTIVITY_TYPE_BADGE_LABELS[item.activity.type] ?? item.activity.type;

                return (
                  <li key={item.attempt.attemptId}>
                    <button
                      type="button"
                      onClick={() => handleSelectAttempt(item.attempt.attemptId)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={styles.queueCard}
                    >
                      <div className={styles.queueCardTop}>
                        <div>
                          <span className={styles.queueStudent}>{item.student.displayName}</span>
                          <div className={styles.queueGroup}>
                            {item.group.name} ·{' '}
                            {item.student.ageSegment === 'kids' ? 'Kids' : 'Teens'}
                          </div>
                        </div>
                        <span className={styles.typePill}>{typeLabel}</span>
                      </div>

                      <div className={styles.queueTitle} lang="en">
                        {item.activity.title}
                      </div>

                      <div className={styles.queueCardBottom}>
                        <span className={styles.tabular}>{submittedDate}</span>
                        {formattedScore !== null ? (
                          <span className={styles.statusBadge} data-tone="ok">
                            {formattedScore} / 5,0
                          </span>
                        ) : overdue ? (
                          <span className={styles.statusBadge} data-tone="danger">
                            Atrasada
                          </span>
                        ) : (
                          <span className={styles.statusBadge} data-tone="danger">
                            Por revisar
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-label="Inspector de evaluación"
          className={`${styles.inspectorColumn} ${mobilePane === 'list' ? styles.paneHiddenOnMobile : ''}`}
        >
          {isLoadingDetail ? (
            <div className={styles.inspectorCard} role="status">
              <span className="sr-only">Cargando detalle del intento…</span>
              <div className={styles.skeletonStack}>
                <div className={styles.skeleton} />
                <div className={`${styles.skeleton} ${styles.skeletonTall}`} />
              </div>
            </div>
          ) : detailQuery.isError && !detail ? (
            <ErrorState
              variant="teacher"
              editorial
              message="No pudimos cargar el detalle de esta entrega."
              onRetry={() => void detailQuery.refetch()}
            />
          ) : !detail ? (
            <div className={styles.emptyCard}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <ClipboardCheck size={22} strokeWidth={1.75} />
              </span>
              <h2 className={styles.emptyTitle}>Selecciona una entrega</h2>
              <p className={styles.emptyDesc}>
                Elige un intento de la lista para escuchar o leer la respuesta del estudiante y registrar tu calificación.
              </p>
            </div>
          ) : (
            <div className={styles.inspectorCard}>
              <form onSubmit={handleSubmitReview} className={styles.form} noValidate>
                <div className={styles.inspectorHead}>
                  <div className={styles.inspectorHeadLeft}>
                    <div className={styles.attemptEyebrow}>
                      <span className={styles.tabular}>
                        Intento #{detail.attempt.attemptNumber}
                      </span>
                      <span className={styles.typePill}>
                        {ACTIVITY_TYPE_BADGE_LABELS[detail.activity.type] ??
                          detail.activity.type}
                      </span>
                    </div>
                    <h2 className={styles.inspectorTitle} lang="en">
                      {detail.activity.title}
                    </h2>
                    <p className={styles.inspectorMeta}>
                      Estudiante: <strong>{detail.student.displayName}</strong> ·{' '}
                      {detail.group.name} ·{' '}
                      {detail.student.ageSegment === 'kids' ? 'Kids' : 'Teens'}
                    </p>
                  </div>

                  {detail.attempt.status === 'graded' && detail.attempt.score !== null && (
                    <div className={styles.scoreSummaryBox}>
                      <span className={styles.scoreSummaryValue}>
                        {formatScore(detail.attempt.score)}
                      </span>
                      <span className={styles.scoreSummaryScale}>de 5,0</span>
                      <div
                        className={styles.starsRow}
                        aria-label={`Calificación: ${detail.attempt.stars} estrellas`}
                      >
                        {[1, 2, 3].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            strokeWidth={1.75}
                            fill={star <= detail.attempt.stars ? 'currentColor' : 'none'}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {detail.activity.type === ActivityType.speaking && (
                  <div className={styles.audioCard}>
                    <div className={styles.audioHead}>
                      <div className={styles.audioTitleGroup}>
                        <span className={styles.audioTitle}>
                          <Mic size={17} strokeWidth={1.75} aria-hidden="true" />
                          <span>Grabación de Speaking</span>
                        </span>
                        <span className={styles.audioMeta}>
                          Duración: {formatDurationSeconds(audioDurationSeconds)}
                          {maxDurationSec ? ` / ${formatDurationSeconds(maxDurationSec)}` : ''} ·{' '}
                          {audioFormat === 'raw' ? 'Audio original' : 'MP4/AAC'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadAudio}
                        disabled={
                          !detail.mediaAsset || detail.mediaAsset.status === 'deleted'
                        }
                        className={styles.downloadButton}
                      >
                        <Download size={16} strokeWidth={1.75} aria-hidden="true" />
                        <span>Descargar audio</span>
                      </button>
                    </div>

                    {detail.mediaAsset?.status === 'deleted' ? (
                      <div className={styles.audioDeletedNote}>
                        El audio cumplió los 30 días de retención tras la calificación y fue eliminado automáticamente de la nube. La calificación y el comentario se conservan.
                      </div>
                    ) : audioUrl ? (
                      <>
                        <audio controls className={styles.audioElement} src={audioUrl}>
                          Tu navegador no soporta el reproductor de audio. Usa el botón Descargar audio.
                        </audio>
                        {audioWarning && (
                          <div className={styles.warningCallout} role="status">
                            <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
                            <span>
                              El audio original no pudo convertirse a MP4 estándar. Si tu navegador no lo reproduce directamente, usa el botón Descargar audio.
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className={styles.audioDeletedNote}>
                        Audio no disponible para reproducción en línea. Puedes usar Descargar audio si el archivo sigue vigente.
                      </p>
                    )}

                    <p className={styles.retentionNote}>
                      Retención en la nube: disponible hasta 30 días después de calificar
                      {detail.mediaAsset?.retentionUntil
                        ? ` (expira el ${formatBogotaDateTime(detail.mediaAsset.retentionUntil) ?? detail.mediaAsset.retentionUntil})`
                        : ''}
                      . La nota y el comentario se conservan tras la eliminación del archivo.
                    </p>
                  </div>
                )}

                <div className={styles.itemsSection}>
                  <h3 className={styles.sectionHeading}>
                    Respuestas del estudiante y guía docente
                  </h3>

                  {detail.items.length === 0 ? (
                    <p className={styles.scoreHint}>
                      Sin ítems adicionales para mostrar en este intento.
                    </p>
                  ) : (
                    detail.items.map((it, idx) => {
                      const isSpeakingItem = detail.activity.type === ActivityType.speaking;
                      const isMultiItem = detail.items.length > 1;
                      const rawAnswer = isMultiItem
                        ? detail.answers[it.id]
                        : (detail.answers[it.id] ??
                          detail.answers['text'] ??
                          detail.answers[detail.activity.id]);

                      let displayAnswer: string | null = null;
                      if (rawAnswer !== undefined && rawAnswer !== null) {
                        if (typeof rawAnswer === 'object' && 'text' in rawAnswer) {
                          const textVal = Reflect.get(rawAnswer, 'text');
                          displayAnswer =
                            textVal !== null && textVal !== undefined ? String(textVal) : '';
                        } else if (typeof rawAnswer === 'object') {
                          displayAnswer = JSON.stringify(rawAnswer, null, 2);
                        } else {
                          displayAnswer = String(rawAnswer);
                        }
                      }

                      const promptText = it.prompt
                        ? formatBlankPrompt(it.prompt)
                        : it.question ?? null;

                      return (
                        <div key={it.id || idx} className={styles.itemCard}>
                          {promptText && (
                            <p className={styles.itemPrompt} lang="en">
                              {promptText}
                            </p>
                          )}

                          <div>
                            <span className={styles.answerBlockLabel}>
                              {isSpeakingItem ? 'Entrega de Speaking:' : 'Respuesta del alumno:'}
                            </span>
                            <div
                              className={styles.answerBox}
                              lang={
                                !isSpeakingItem &&
                                displayAnswer !== null &&
                                displayAnswer.trim().length > 0
                                  ? 'en'
                                  : undefined
                              }
                            >
                              {isSpeakingItem
                                ? 'Grabación de voz entregada (reproduce o descarga el audio en el reproductor superior).'
                                : displayAnswer !== null && displayAnswer.trim().length > 0
                                  ? displayAnswer
                                  : '(Sin respuesta registrada)'}
                            </div>
                          </div>

                          {it.rubricText && (
                            <div className={styles.rubricBox}>
                              <strong>Rúbrica / Criterio:</strong> {it.rubricText}
                            </div>
                          )}

                          {it.correctAnswer != null && (
                            <div className={styles.modelAnswerBox}>
                              <strong>Respuesta modelo / correcta:</strong>{' '}
                              <span lang="en">
                                {typeof it.correctAnswer === 'object'
                                  ? JSON.stringify(it.correctAnswer)
                                  : String(it.correctAnswer)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {detail.attemptHistory.length > 1 && (
                  <details className={styles.historyDetails}>
                    <summary className={styles.tabular}>
                      Historial de intentos ({detail.attemptHistory.length})
                    </summary>
                    <ul className={styles.historyList}>
                      {detail.attemptHistory.map((h) => (
                        <li key={h.attemptId} className={styles.tabular}>
                          Intento #{h.attemptNumber}:{' '}
                          {h.score !== null ? `${formatScore(h.score)} / 5,0` : 'Por revisar'}
                          {h.gradedAt
                            ? ` · calificado el ${formatBogotaDateTime(h.gradedAt) ?? h.gradedAt}`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className={styles.fieldGroup}>
                  <label htmlFor="score-input" className={styles.fieldLabel}>
                    Calificación (0,0 – 5,0)
                  </label>

                  {detail.attempt.status === 'pending_review' ? (
                    <>
                      <div className={styles.scoreRow}>
                        <input
                          ref={scoreInputRef}
                          id="score-input"
                          type="text"
                          inputMode="decimal"
                          value={scoreInput}
                          onChange={(e) => {
                            setScoreInput(e.target.value);
                            if (scoreFieldError) setScoreFieldError(null);
                          }}
                          placeholder="Ej. 4,5"
                          required
                          aria-invalid={scoreFieldError ? 'true' : 'false'}
                          aria-describedby={
                            scoreFieldError ? `${scoreHintId} ${scoreErrorId}` : scoreHintId
                          }
                          className={styles.scoreInput}
                        />
                        <span className={styles.scoreHint}>sobre 5,0</span>
                        {parsedScorePreview !== null && (
                          <span
                            className={styles.statusBadge}
                            data-tone={parsedScorePreview >= 3 ? 'ok' : 'warm'}
                          >
                            {parsedScorePreview >= 3
                              ? 'Aprobado (≥ 3,0)'
                              : 'Por debajo del umbral (< 3,0)'}
                          </span>
                        )}
                      </div>
                      <p id={scoreHintId} className={styles.scoreHint}>
                        Acepta un decimal (ej. 4,5). Umbral de aprobación: 3,0.
                      </p>
                      {scoreFieldError && (
                        <p id={scoreErrorId} className={styles.fieldError}>
                          <CircleAlert size={15} aria-hidden="true" />
                          <span>{scoreFieldError}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <div className={styles.immutableScoreBox}>
                      <span className={styles.immutableScoreBadge}>
                        <Lock size={15} strokeWidth={1.75} aria-hidden="true" />
                        <span>🔒 Calificación inmutable:</span>
                        <span>
                          {detail.attempt.score !== null
                            ? formatScore(detail.attempt.score)
                            : '—'}{' '}
                          / 5,0
                        </span>
                      </span>
                      <p className={styles.immutableScoreNote}>
                        Calificación bloqueada tras la primera revisión. Puedes actualizar el comentario y los stickers en cualquier momento.
                      </p>
                    </div>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabelRow}>
                    <label htmlFor="comment-input" className={styles.fieldLabel}>
                      <span>Comentario de retroalimentación</span>
                      <span
                        className={styles.requirementBadge}
                        data-required={isManualActivity ? 'true' : undefined}
                      >
                        {isManualActivity ? 'Obligatorio' : 'Opcional'}
                      </span>
                    </label>
                  </div>

                  <textarea
                    ref={commentInputRef}
                    id="comment-input"
                    rows={4}
                    maxLength={2000}
                    value={commentInput}
                    onChange={(e) => {
                      setCommentInput(e.target.value);
                      if (commentFieldError) setCommentFieldError(null);
                    }}
                    aria-invalid={commentFieldError ? 'true' : 'false'}
                    aria-describedby={commentFieldError ? commentErrorId : undefined}
                    placeholder="Escribe palabras de aliento o correcciones específicas para el estudiante..."
                    className={`${styles.control} ${styles.textarea}`}
                  />

                  <div className={styles.counterRow}>
                    {commentFieldError ? (
                      <p id={commentErrorId} className={styles.fieldError}>
                        <CircleAlert size={15} aria-hidden="true" />
                        <span>{commentFieldError}</span>
                      </p>
                    ) : (
                      <span />
                    )}
                    <span className={styles.tabular}>
                      {commentInput.length} / 2000 caracteres
                    </span>
                  </div>
                </div>

                <fieldset className={styles.stickerFieldset}>
                  <div className={styles.stickerLegendRow}>
                    <legend className={styles.stickerLegend}>
                      Stickers de celebración y ánimo (hasta 3)
                    </legend>
                    <span className={styles.stickerCounter}>
                      Seleccionados: {selectedStickers.length} / 3
                    </span>
                  </div>

                  <div className={styles.stickerGrid}>
                    {STICKER_CODES.map((code) => {
                      const st = STICKERS[code];
                      const isSelected = selectedStickers.includes(code);
                      const isDimmed = !isSelected && selectedStickers.length >= 3;

                      return (
                        <button
                          key={code}
                          type="button"
                          aria-pressed={isSelected}
                          data-dimmed={isDimmed ? 'true' : undefined}
                          onClick={() => toggleSticker(code)}
                          className={styles.stickerBtn}
                        >
                          <span className={styles.stickerEmoji} aria-hidden="true">
                            {st.emoji}
                          </span>
                          <span className={styles.stickerLabel}>{st.label}</span>
                          {isSelected && (
                            <Check
                              size={16}
                              strokeWidth={2.25}
                              className={styles.stickerCheck}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p role="status" aria-live="polite" className={styles.stickerLive}>
                    {stickerLimitNotice}
                  </p>
                </fieldset>

                {detail.activity.type !== ActivityType.game && (
                  <div className={styles.retryCard}>
                    <div className={styles.retryHeader}>
                      <div className={styles.retryText}>
                        <span className={styles.retryTitle}>Habilitar nuevo intento</span>
                        <span className={styles.retrySubtitle}>
                          Autoriza un intento adicional (#{detail.attempt.attemptNumber + 1}) para este estudiante en esta asignación.
                        </span>
                      </div>

                      {detail.attempt.retryGrantedAt ? (
                        <span className={styles.retryGrantedPill}>
                          <Check size={15} strokeWidth={2.25} aria-hidden="true" />
                          <span>
                            Nuevo intento habilitado
                            {detail.attempt.effectiveDueAt
                              ? ` · límite efectivo: ${formatBogotaDateTime(detail.attempt.effectiveDueAt) ?? detail.attempt.effectiveDueAt}`
                              : ''}
                          </span>
                        </span>
                      ) : (
                        <label htmlFor="allow-retry-toggle" className={styles.switchWrap}>
                          <input
                            id="allow-retry-toggle"
                            name="allowRetry"
                            role="switch"
                            aria-label="Permitir nuevo intento al estudiante"
                            type="checkbox"
                            checked={allowRetry}
                            onChange={(e) => setAllowRetry(e.target.checked)}
                            className={styles.switchInput}
                          />
                          <span className={styles.switchTrack} aria-hidden="true" />
                        </label>
                      )}
                    </div>

                    {allowRetry && !detail.attempt.retryGrantedAt && (
                      <div className={styles.retryExtendBlock}>
                        <label htmlFor="extend-date" className={styles.filterLabel}>
                          Extender fecha límite hasta (hora Colombia, opcional)
                        </label>
                        <input
                          id="extend-date"
                          type="datetime-local"
                          value={retryExtendUntil}
                          onChange={(e) => setRetryExtendUntil(e.target.value)}
                          className={`${styles.control} ${styles.dateInput} ${styles.tabular}`}
                        />

                        {isRetryExpiredWithoutDate && (
                          <div className={styles.warningCallout} role="status">
                            <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
                            <span>
                              La asignación ya cerró. Si no defines una nueva fecha límite, el estudiante no podrá iniciar este nuevo intento.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.submitFooter}>
                  <p className={styles.privacyNote}>
                    Al guardar la primera calificación, enviaremos un correo al alumno avisando que su revisión está lista (sin incluir la nota ni el texto del comentario).
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={styles.submitButton}
                  >
                    {isSubmitting ? 'Guardando…' : 'Guardar revisión y retroalimentación'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
