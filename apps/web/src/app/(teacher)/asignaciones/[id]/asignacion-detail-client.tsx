'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityStatus,
  ActivityType,
  AgeSegment,
  AssignmentAvailability,
  AssignmentView,
  AssignmentViewSchema,
  AttemptStatus,
  ReviewListItemView,
  ReviewListResponse,
  ReviewListResponseSchema,
  StudentListResponse,
  StudentListResponseSchema,
  formatBogotaDateTime,
  getExtendedDueAt,
} from '@upward-english/shared';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { EditorialBadge, TeacherStatusBadge } from '../../../../components/teacher-editorial';
import { AccessibleModal } from '../../../../components/ui/modal';
import { ApiError, apiFetch } from '../../../../lib/api';
import styles from './asignacion-detail.module.css';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Completar espacios',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

const availabilityBadgeKinds: Record<
  AssignmentAvailability,
  'assignmentScheduled' | 'assignmentOpen' | 'assignmentClosed' | 'assignmentCancelled'
> = {
  [AssignmentAvailability.scheduled]: 'assignmentScheduled',
  [AssignmentAvailability.open]: 'assignmentOpen',
  [AssignmentAvailability.closed]: 'assignmentClosed',
  [AssignmentAvailability.cancelled]: 'assignmentCancelled',
};

const activityStatusBadgeKinds: Record<
  ActivityStatus,
  'activityPublished' | 'activityDraft' | 'activityArchived'
> = {
  [ActivityStatus.published]: 'activityPublished',
  [ActivityStatus.draft]: 'activityDraft',
  [ActivityStatus.archived]: 'activityArchived',
};

const segmentLabels: Record<AgeSegment, string> = {
  [AgeSegment.kids]: 'Kids',
  [AgeSegment.teens]: 'Teens',
};

const scoreFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface StudentSubmissionRow {
  studentId: string;
  studentName: string;
  levelLabel: string | null;
  segmentLabel: string | null;
  status: 'pending_review' | 'graded' | 'not_submitted';
  attemptId: string | null;
  attemptNumber: number | null;
  score: number | null;
  submittedAt: string | null;
  isFormerMember: boolean;
}

interface SubmissionsSummary {
  studentRows: StudentSubmissionRow[];
  submittedCount: number;
  pendingReviewCount: number;
  gradedCount: number;
  obligatedCount: number | null;
  compliancePercent: number | null;
}

function getAssignmentLoadErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.statusCode === 404) {
      return 'No encontramos esta asignación o alguno de los recursos seleccionados';
    }
    if (error.statusCode === 403) {
      return 'No tienes acceso a esta sección';
    }
    if (error.statusCode === 429) {
      return 'Espera un momento antes de volver a intentarlo';
    }
    return error.message || 'No pudimos cargar la asignación';
  }
  return 'No pudimos cargar la asignación';
}

export function AsignacionDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const successBannerRef = useRef<HTMLDivElement | null>(null);

  const assignmentQuery = useQuery({
    queryKey: ['teacher', 'assignment', id],
    queryFn: ({ signal }) =>
      apiFetch<AssignmentView>(`/api/v1/assignments/${id}`, {
        schema: AssignmentViewSchema,
        signal,
      }),
  });

  const assignment = assignmentQuery.data ?? null;
  const groupId = assignment?.group.id ?? '';
  const hasGroupId = Boolean(groupId);

  const membersQuery = useQuery({
    queryKey: ['teacher', 'group', groupId, 'members'],
    enabled: hasGroupId,
    retry: false,
    queryFn: ({ signal }) =>
      apiFetch<StudentListResponse>(`/api/v1/groups/${groupId}/members?limit=100`, {
        schema: StudentListResponseSchema,
        signal,
      }),
  });

  const pendingReviewsQuery = useQuery({
    queryKey: ['teacher', 'assignment', id, 'reviews-queue', groupId],
    enabled: hasGroupId,
    retry: false,
    queryFn: ({ signal }) =>
      apiFetch<ReviewListResponse>(
        `/api/v1/reviews/queue?groupId=${encodeURIComponent(groupId)}&limit=100`,
        { schema: ReviewListResponseSchema, signal },
      ),
  });

  const gradedReviewsQuery = useQuery({
    queryKey: ['teacher', 'assignment', id, 'reviews-graded', groupId],
    enabled: hasGroupId,
    retry: false,
    queryFn: ({ signal }) =>
      apiFetch<ReviewListResponse>(
        `/api/v1/reviews/graded?groupId=${encodeURIComponent(groupId)}&limit=100`,
        { schema: ReviewListResponseSchema, signal },
      ),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetch<AssignmentView>(`/api/v1/assignments/${id}/cancel`, {
        method: 'POST',
        schema: AssignmentViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'assignment', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'assignments'] });
      setShowCancelModal(false);
      setSuccessNotice('Asignación cancelada');
      setTimeout(() => {
        successBannerRef.current?.focus();
      }, 70);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setCancelError('Esta asignación no se puede cancelar porque ya está cerrada o cancelada');
        } else {
          setCancelError(err.message || 'No se pudo cancelar la asignación');
        }
      } else {
        setCancelError('No se pudo cancelar la asignación');
      }
    },
  });

  const isCancelling = cancelMutation.isPending;

  const handleOpenCancelModal = () => {
    setCancelError(null);
    setShowCancelModal(true);
  };

  const handleCloseCancelModal = () => {
    if (isCancelling) return;
    setShowCancelModal(false);
    setCancelError(null);
    setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);
  };

  const handleConfirmCancel = () => {
    setCancelError(null);
    cancelMutation.mutate();
  };

  const {
    studentRows,
    submittedCount,
    pendingReviewCount,
    gradedCount,
    obligatedCount,
    compliancePercent,
  } = useMemo<SubmissionsSummary>(() => {
    if (!assignment) {
      return {
        studentRows: [],
        submittedCount: 0,
        pendingReviewCount: 0,
        gradedCount: 0,
        obligatedCount: null,
        compliancePercent: null,
      };
    }

    const latestByStudent = new Map<string, ReviewListItemView>();
    const allReviews = [
      ...(pendingReviewsQuery.data?.items ?? []),
      ...(gradedReviewsQuery.data?.items ?? []),
    ];

    for (const item of allReviews) {
      if (item.assignment.id !== assignment.id) continue;
      const existing = latestByStudent.get(item.student.id);
      if (!existing || item.attempt.attemptNumber >= existing.attempt.attemptNumber) {
        latestByStudent.set(item.student.id, item);
      }
    }

    const rows: StudentSubmissionRow[] = [];
    const seenStudentIds = new Set<string>();

    for (const member of membersQuery.data?.items ?? []) {
      seenStudentIds.add(member.id);
      const submission = latestByStudent.get(member.id);
      const isPendingReview = submission?.attempt.status === AttemptStatus.pending_review;
      const isGraded = submission?.attempt.status === AttemptStatus.graded;
      const status: StudentSubmissionRow['status'] = isPendingReview
        ? 'pending_review'
        : isGraded
          ? 'graded'
          : 'not_submitted';

      rows.push({
        studentId: member.id,
        studentName: member.name,
        levelLabel: member.level ?? null,
        segmentLabel: member.ageSegment ? segmentLabels[member.ageSegment] : null,
        status,
        attemptId: submission?.attempt.attemptId ?? null,
        attemptNumber: submission?.attempt.attemptNumber ?? null,
        score: submission?.attempt.score ?? null,
        submittedAt:
          submission?.attempt.finishedAt ?? submission?.attempt.gradedAt ?? null,
        isFormerMember: false,
      });
    }

    for (const [studentId, submission] of latestByStudent.entries()) {
      if (seenStudentIds.has(studentId)) continue;
      const status: StudentSubmissionRow['status'] =
        submission.attempt.status === AttemptStatus.pending_review
          ? 'pending_review'
          : 'graded';

      rows.push({
        studentId,
        studentName: submission.student.displayName,
        levelLabel: null,
        segmentLabel: segmentLabels[submission.student.ageSegment],
        status,
        attemptId: submission.attempt.attemptId,
        attemptNumber: submission.attempt.attemptNumber,
        score: submission.attempt.score ?? null,
        submittedAt: submission.attempt.finishedAt ?? submission.attempt.gradedAt ?? null,
        isFormerMember: true,
      });
    }

    const statusPriority: Record<StudentSubmissionRow['status'], number> = {
      pending_review: 0,
      graded: 1,
      not_submitted: 2,
    };

    rows.sort((a, b) => {
      const diff = statusPriority[a.status] - statusPriority[b.status];
      if (diff !== 0) return diff;
      return a.studentName.localeCompare(b.studentName, 'es-CO');
    });

    const reviewsLoaded = Boolean(pendingReviewsQuery.data || gradedReviewsQuery.data);
    const pendingCount = rows.filter((r) => r.status === 'pending_review').length;
    const doneGradedCount = rows.filter((r) => r.status === 'graded').length;
    const liveSubmitted = pendingCount + doneGradedCount;
    const submitted = reviewsLoaded
      ? liveSubmitted
      : (assignment.submittedAttempts ?? liveSubmitted);

    const activeMembersCount = membersQuery.data
      ? Math.max(membersQuery.data.total ?? membersQuery.data.items.length, submitted)
      : null;

    const obligated =
      assignment.historicalStudentCount !== null
        ? assignment.historicalStudentCount
        : activeMembersCount !== null
          ? activeMembersCount
          : (assignment.totalAttempts ?? null);

    const percent =
      obligated !== null && obligated > 0
        ? Math.min(100, Math.round((submitted / obligated) * 100))
        : obligated === 0
          ? 0
          : null;

    return {
      studentRows: rows,
      submittedCount: submitted,
      pendingReviewCount: pendingCount,
      gradedCount: doneGradedCount,
      obligatedCount: obligated,
      compliancePercent: percent,
    };
  }, [assignment, membersQuery.data, pendingReviewsQuery.data, gradedReviewsQuery.data]);

  const isLoading = assignmentQuery.isLoading;
  const loadError = getAssignmentLoadErrorMessage(assignmentQuery.error);

  if (isLoading) {
    return (
      <div className={styles.page} role="status">
        <span className="sr-only">Cargando detalle de la asignación…</span>
        <div className={`${styles.skeletonBlock} ${styles.skeletonHeader}`} aria-hidden="true" />
        <div className={styles.kpiGrid} aria-hidden="true">
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
        </div>
        <div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} aria-hidden="true" />
      </div>
    );
  }

  if (loadError || !assignment) {
    const canRetry =
      !(assignmentQuery.error instanceof ApiError) ||
      (assignmentQuery.error.statusCode !== 404 && assignmentQuery.error.statusCode !== 403);

    return (
      <div className={styles.page}>
        <nav aria-label="Ubicación de la asignación" className={styles.breadcrumb}>
          <Link href="/asignaciones" className={styles.breadcrumbLink}>
            Asignaciones
          </Link>
          <span aria-hidden="true">/</span>
          <span className={styles.breadcrumbCurrent} aria-current="page">
            No disponible
          </span>
        </nav>

        <div role="alert" className={styles.errorCard}>
          <p className={styles.errorTitle}>
            <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>
              {loadError || 'No encontramos esta asignación o alguno de los recursos seleccionados'}
            </span>
          </p>
          <div className={styles.errorActions}>
            {canRetry && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void assignmentQuery.refetch()}
              >
                <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
                Reintentar
              </button>
            )}
            <Link href="/asignaciones" className={styles.primaryLink}>
              Volver a asignaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCancelled = assignment.cancelledAt !== null;
  const extendedDue = getExtendedDueAt(assignment.dueAt);
  const availabilityKind =
    availabilityBadgeKinds[assignment.availability] ?? 'assignmentOpen';
  const activityStatusKind =
    activityStatusBadgeKinds[assignment.activity.status] ?? 'activityPublished';

  const isSubmissionsLoading =
    membersQuery.isLoading || pendingReviewsQuery.isLoading || gradedReviewsQuery.isLoading;
  const hasSubmissionsError =
    membersQuery.isError || pendingReviewsQuery.isError || gradedReviewsQuery.isError;

  const refetchSecondary = () => {
    void membersQuery.refetch();
    void pendingReviewsQuery.refetch();
    void gradedReviewsQuery.refetch();
  };

  return (
    <div className={styles.page}>
      <nav aria-label="Ubicación de la asignación" className={styles.breadcrumb}>
        <Link href="/asignaciones" className={styles.breadcrumbLink}>
          Asignaciones
        </Link>
        <span aria-hidden="true">/</span>
        <span className={styles.breadcrumbCurrent} lang="en" aria-current="page">
          {assignment.activity.title}
        </span>
      </nav>

      {successNotice && (
        <div
          ref={successBannerRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={styles.successBanner}
        >
          <span className={styles.successMessage}>
            <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{successNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className={styles.bannerClose}
            aria-label="Cerrar aviso"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.metaRow}>
            <TeacherStatusBadge kind={availabilityKind} />
            <span className={styles.versionPill}>v{assignment.activity.version}</span>
          </div>
          <h1 className={styles.title} lang="en">
            {assignment.activity.title}
          </h1>
          <p className={styles.subtitle}>
            {typeLabels[assignment.activity.type]} · Nivel {assignment.activity.level} · Grupo{' '}
            {assignment.group.name}
          </p>
        </div>

        <div className={styles.headerAction}>
          {!isCancelled ? (
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={handleOpenCancelModal}
              className={styles.dangerButton}
            >
              Cancelar asignación
            </button>
          ) : (
            <span className={styles.cancelledSeal}>
              <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Cancelada el {formatBogotaDateTime(assignment.cancelledAt!)}</span>
            </span>
          )}
        </div>
      </header>

      <section aria-labelledby="assignment-summary-heading">
        <h2 id="assignment-summary-heading" className="sr-only">
          Resumen de la asignación
        </h2>
        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>
              <Users size={16} strokeWidth={1.75} aria-hidden="true" />
              Cumplimiento
            </span>
            {isCancelled ? (
              <>
                <p className={styles.kpiValueLarge}>Excluida</p>
                <p className={styles.kpiHint}>
                  No cuenta en el denominador de cumplimiento tras la cancelación.
                </p>
              </>
            ) : (
              <>
                <p className={styles.kpiValueLarge}>
                  {obligatedCount !== null
                    ? `${submittedCount} / ${obligatedCount}`
                    : `${submittedCount} entregas`}
                </p>
                {compliancePercent !== null && (
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label="Porcentaje de cumplimiento"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={compliancePercent}
                  >
                    <div
                      className={styles.progressFill}
                      data-complete={compliancePercent >= 100 ? 'true' : 'false'}
                      style={{ width: `${compliancePercent}%` }}
                    />
                  </div>
                )}
                <p className={styles.kpiHint}>
                  {compliancePercent !== null
                    ? `${compliancePercent} % de estudiantes del grupo`
                    : 'Base histórica calculada al cierre'}
                </p>
              </>
            )}
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>
              <CalendarClock size={16} strokeWidth={1.75} aria-hidden="true" />
              Apertura
            </span>
            <p className={styles.kpiValue}>{formatBogotaDateTime(assignment.opensAt)}</p>
            <p className={styles.kpiHint}>Instante en que se habilita para los alumnos.</p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>
              <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
              Cierre para empezar
            </span>
            <p className={styles.kpiValue}>{formatBogotaDateTime(assignment.dueAt)}</p>
            <p className={styles.kpiHint}>Límite para iniciar el primer intento.</p>
          </article>

          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>
              <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
              Cierre con tolerancia (+24 h)
            </span>
            <p className={styles.kpiValue}>{formatBogotaDateTime(extendedDue)}</p>
            <p className={styles.kpiHint}>Última hora para concluir si inició a tiempo.</p>
          </article>
        </div>
      </section>

      <section className={styles.policyCallout} aria-labelledby="policy-callout-heading">
        <div className={styles.policyHeader}>
          <h2 id="policy-callout-heading" className={styles.policyTitle}>
            <Clock size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>Regla de entrega y tolerancia</span>
          </h2>
          <span className={styles.timezonePill}>Hora de Colombia (America/Bogota)</span>
        </div>
        <p className={styles.policyText}>
          Los alumnos pueden empezar hasta esta hora; quien haya empezado tendrá hasta 24 horas más
          para terminar.
        </p>
        <p className={styles.policyDeadline}>
          Última hora para terminar si empezó a tiempo:{' '}
          <strong>{formatBogotaDateTime(extendedDue)}</strong>
        </p>
      </section>

      <div className={styles.contextGrid}>
        <section className={styles.surfaceCard} aria-labelledby="group-context-heading">
          <h2 id="group-context-heading" className={styles.cardTitle}>
            Grupo destinatario
          </h2>
          <dl className={styles.metaList}>
            <div className={styles.metaItem}>
              <dt>Nombre</dt>
              <dd>{assignment.group.name}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Estado del grupo</dt>
              <dd>
                {assignment.group.archivedAt ? (
                  <EditorialBadge tone="warm">Archivado</EditorialBadge>
                ) : (
                  <EditorialBadge tone="ok">Activo</EditorialBadge>
                )}
              </dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Base de cumplimiento</dt>
              <dd>
                {assignment.historicalStudentCount !== null
                  ? `${assignment.historicalStudentCount} alumnos (cierre)`
                  : obligatedCount !== null
                    ? `${obligatedCount} alumnos vigentes`
                    : 'Pendiente de cierre'}
              </dd>
            </div>
          </dl>
          <Link
            href={`/grupos/${encodeURIComponent(assignment.group.id)}`}
            className={styles.cardLink}
          >
            <span>Ver ficha del grupo</span>
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </section>

        <section className={styles.surfaceCard} aria-labelledby="activity-context-heading">
          <h2 id="activity-context-heading" className={styles.cardTitle}>
            Actividad en catálogo
          </h2>
          <dl className={styles.metaList}>
            <div className={styles.metaItem}>
              <dt>Tipo</dt>
              <dd>{typeLabels[assignment.activity.type]}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Nivel MCER</dt>
              <dd>{assignment.activity.level}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt>Estado en catálogo</dt>
              <dd>
                <TeacherStatusBadge kind={activityStatusKind} />
              </dd>
            </div>
          </dl>
          <Link
            href={`/actividades/${encodeURIComponent(assignment.activity.id)}`}
            className={styles.cardLink}
          >
            <span>Ver editor de actividad</span>
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </section>
      </div>

      <section
        className={styles.submissionsSection}
        aria-labelledby="assignment-submissions-heading"
      >
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeadingGroup}>
            <h2 id="assignment-submissions-heading" className={styles.sectionTitle}>
              Entregas de estudiantes
            </h2>
            <p className={styles.sectionSummary}>
              {submittedCount} entregada{submittedCount === 1 ? '' : 's'} · {pendingReviewCount} por
              revisar · {gradedCount} calificada{gradedCount === 1 ? '' : 's'}
            </p>
          </div>
          <Link href="/revision" className={styles.actionLink}>
            <span>Ir a revisión</span>
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>

        {isSubmissionsLoading && studentRows.length === 0 ? (
          <div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} role="status">
            <span className="sr-only">Cargando entregas de estudiantes…</span>
          </div>
        ) : hasSubmissionsError && studentRows.length === 0 ? (
          <div className={styles.partialNotice} role="status">
            <span>
              No pudimos cargar el detalle por estudiante en este momento. Puedes consultarlo en
              la cola de revisión o reintentar.
            </span>
            <button type="button" className={styles.secondaryButton} onClick={refetchSecondary}>
              <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : studentRows.length === 0 ? (
          <div className={styles.emptyCard}>
            <p className={styles.emptyTitle}>Sin estudiantes registrados en este seguimiento</p>
            <p className={styles.emptyText}>
              El grupo no tiene integrantes activos o aún no registra entregas para esta asignación.
            </p>
            <Link
              href={`/grupos/${encodeURIComponent(assignment.group.id)}`}
              className={styles.actionLink}
            >
              <span>Revisar integrantes del grupo</span>
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div
            className={styles.tableRegion}
            role="region"
            aria-labelledby="assignment-submissions-heading"
            tabIndex={0}
          >
            <table className={styles.submissionsTable}>
              <thead>
                <tr>
                  <th scope="col">Estudiante</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Calificación</th>
                  <th scope="col">Fecha de entrega</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((row) => (
                  <tr key={row.studentId}>
                    <th scope="row">
                      <div className={styles.studentCell}>
                        <Link
                          href={`/alumnos/${encodeURIComponent(row.studentId)}`}
                          className={styles.studentLink}
                        >
                          {row.studentName}
                        </Link>
                        {(row.levelLabel || row.segmentLabel || row.isFormerMember) && (
                          <span className={styles.studentMeta}>
                            {[
                              row.levelLabel,
                              row.segmentLabel,
                              row.isFormerMember ? 'Trasladado' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                    </th>
                    <td>
                      <div className={styles.statusCell}>
                        {row.status === 'graded' ? (
                          <TeacherStatusBadge kind="reviewGraded" />
                        ) : row.status === 'pending_review' ? (
                          <TeacherStatusBadge kind="reviewPending" />
                        ) : (
                          <EditorialBadge tone="neutral">Sin entregar</EditorialBadge>
                        )}
                        {row.attemptNumber !== null && (
                          <span className={styles.attemptMeta}>Intento #{row.attemptNumber}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {row.score !== null ? (
                        <span className={styles.scoreValue}>
                          {scoreFormatter.format(row.score)} / 5,0
                        </span>
                      ) : row.status === 'pending_review' ? (
                        <span className={styles.mutedCell}>Pendiente</span>
                      ) : (
                        <span className={styles.mutedCell}>—</span>
                      )}
                    </td>
                    <td>
                      {row.submittedAt ? (
                        <time dateTime={row.submittedAt}>
                          {formatBogotaDateTime(row.submittedAt)}
                        </time>
                      ) : (
                        <span className={styles.mutedCell}>—</span>
                      )}
                    </td>
                    <td>
                      {row.status === 'not_submitted' ? (
                        <Link
                          href={`/alumnos/${encodeURIComponent(row.studentId)}`}
                          className={styles.actionLink}
                        >
                          <span>Ver ficha</span>
                          <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
                        </Link>
                      ) : (
                        <Link href="/revision" className={styles.actionLink}>
                          <span>
                            {row.status === 'pending_review'
                              ? 'Revisar entrega'
                              : 'Ver en revisión'}
                          </span>
                          <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AccessibleModal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        dismissible={!isCancelling}
        title="¿Cancelar esta asignación?"
        dialogClassName={styles.cancelDialog}
      >
        <div className={styles.modalBody}>
          <p className={styles.modalIntro}>
            Vas a cancelar definitivamente la asignación de{' '}
            <strong lang="en">{assignment.activity.title}</strong> para el grupo{' '}
            <strong>{assignment.group.name}</strong>.
          </p>

          <div className={styles.consequencesBox}>
            <p className={styles.consequencesTitle}>
              <AlertTriangle size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>Esta acción es irreversible y tiene estos efectos:</span>
            </p>
            <ul className={styles.consequencesList}>
              <li>No borra la asignación: queda registrada como Cancelada en el historial.</li>
              <li>Bloquea nuevos inicios y revoca habilitaciones de reintento pendientes.</li>
              <li>
                Quienes ya iniciaron un intento podrán concluirlo dentro de su ventana (cierre
                efectivo + 24 h).
              </li>
              <li>
                Se conservan las notas, retroalimentación y audios existentes, y la asignación se
                excluye del denominador de cumplimiento.
              </li>
            </ul>
          </div>

          {cancelError && (
            <div role="alert" className={styles.modalError}>
              {cancelError}
            </div>
          )}

          <div className={styles.modalActions}>
            <button
              data-initial-focus
              type="button"
              onClick={handleCloseCancelModal}
              disabled={isCancelling}
              className={styles.secondaryButton}
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className={styles.dangerButton}
            >
              {isCancelling ? 'Cancelando…' : 'Cancelar asignación'}
            </button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  );
}
