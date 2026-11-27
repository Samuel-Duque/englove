'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, Info, Users, X } from 'lucide-react';
import {
  StudentView,
  StudentViewSchema,
  StudentListResponse,
  StudentListResponseSchema,
  GroupListResponse,
  GroupListResponseSchema,
  Level,
  AgeSegment,
  ApprovalStatus,
  formatBogotaDateTime,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { ErrorState } from '../../../components/error-state';
import { EditorialConfirmDialog, TeacherStatusBadge } from '../../../components/teacher-editorial';
import { AccessibleModal } from '../../../components/ui/modal';
import styles from './alumnos.module.css';
import requestStyles from './solicitudes/solicitudes.module.css';

type StudentsTab = 'students' | 'requests' | 'locked';

const tabOrder: readonly StudentsTab[] = ['students', 'requests', 'locked'];
const skeletonRows = [0, 1, 2, 3, 4, 5] as const;
const birthDateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeZone: 'America/Bogota',
});

function parseStudentsTab(rawTab: string | null): StudentsTab {
  return rawTab === 'requests' || rawTab === 'locked' ? rawTab : 'students';
}

function isLevel(val: string): val is Level {
  return val === Level.A1 || val === Level.A2 || val === Level.B1 || val === Level.B2;
}

function isAgeSegment(val: string): val is AgeSegment {
  return val === AgeSegment.kids || val === AgeSegment.teens;
}

function formatAgeSegment(segment?: AgeSegment): string {
  if (segment === AgeSegment.kids) return 'Kids';
  if (segment === AgeSegment.teens) return 'Teens';
  return 'Sin segmento';
}

function formatLockRemaining(expiration: number, now: number): string {
  const seconds = Math.ceil((expiration - now) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${remainder} restantes`;
}

function getQueryErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'No pudimos cargar los datos.';
}

function getFriendlyErrorProps(err: unknown, fallbackMessage: string): {
  code?: string | number;
  message?: string;
} {
  if (err instanceof ApiError) {
    const code = err.code !== 'ERROR' ? err.code : err.statusCode;
    const isRawHttpFallback = /^Error \d{3}:/i.test(err.message);
    return {
      code,
      message: isRawHttpFallback ? undefined : err.message,
    };
  }
  return { message: getQueryErrorMessage(err) ?? fallbackMessage };
}

function StudentsManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const urlTab = parseStudentsTab(searchParams.get('tab'));
  const [prevUrlTab, setPrevUrlTab] = useState<StudentsTab>(urlTab);
  const [activeTab, setActiveTab] = useState<StudentsTab>(urlTab);

  if (urlTab !== prevUrlTab) {
    setPrevUrlTab(urlTab);
    setActiveTab(urlTab);
  }

  const tabRefs = useRef<Record<StudentsTab, HTMLButtonElement | null>>({
    students: null,
    requests: null,
    locked: null,
  });

  // UI state
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Approve Modal state
  const [approvingStudent, setApprovingStudent] = useState<StudentView | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Level | ''>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [ageSegment, setAgeSegment] = useState<AgeSegment>(AgeSegment.kids);
  const [rejectConfirmDialog, setRejectConfirmDialog] = useState<{
    isOpen: boolean;
    student: StudentView | null;
  }>({ isOpen: false, student: null });

  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Sync tab with URL
  const handleTabChange = (tab: StudentsTab) => {
    setActiveTab(tab);
    setActionError(null);
    setSuccess(null);
    tabRefs.current[tab]?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/alumnos?${params.toString()}`);
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: StudentsTab,
  ) => {
    const currentIndex = tabOrder.indexOf(currentTab);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabOrder.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabOrder.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabOrder[nextIndex];
    if (nextTab) {
      tabRefs.current[nextTab]?.focus();
    }
  };

  const studentsQuery = useQuery({
    queryKey: ['teacher', 'students', 'all'],
    queryFn: () =>
      apiFetch<StudentListResponse>('/api/v1/students?limit=100', {
        schema: StudentListResponseSchema,
      }),
    enabled: activeTab === 'students',
  });

  const requestsQuery = useQuery({
    queryKey: ['teacher', 'students', 'requests'],
    queryFn: () =>
      apiFetch<StudentListResponse>('/api/v1/students/requests?limit=100', {
        schema: StudentListResponseSchema,
      }),
    enabled: activeTab === 'students' || activeTab === 'requests',
  });

  const lockedQuery = useQuery({
    queryKey: ['teacher', 'students', 'locked'],
    queryFn: () =>
      apiFetch<StudentListResponse>('/api/v1/students/locked?limit=100', {
        schema: StudentListResponseSchema,
      }),
    enabled: activeTab === 'students' || activeTab === 'locked',
  });

  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: () =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
      }),
  });

  const groups = groupsQuery.data?.items || [];
  const students = studentsQuery.data?.items || [];
  const activeStudents = students.filter(
    (st) => st.approvalStatus !== ApprovalStatus.pending_approval,
  );
  const requests = requestsQuery.data?.items || [];
  const activeGroups = groups.filter((group) => !group.archivedAt);
  const locked = lockedQuery.data?.items || [];
  const hasVisibleLocks = activeTab === 'locked' && locked.length > 0;
  const [lockClock, setLockClock] = useState(() => Date.now());

  useEffect(() => {
    if (!hasVisibleLocks) return;
    const clock = window.setInterval(() => setLockClock(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, [hasVisibleLocks]);

  const requestsCount = Math.max(requestsQuery.data?.total ?? 0, requests.length);
  const lockedCount = Math.max(lockedQuery.data?.total ?? 0, locked.length);

  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const isLoading =
    (activeTab === 'students' && studentsQuery.isLoading) ||
    (activeTab === 'requests' && requestsQuery.isLoading) ||
    (activeTab === 'locked' && lockedQuery.isLoading);

  const approveMutation = useMutation({
    mutationFn: (body: {
      studentId: string;
      level: Level;
      groupId: string;
      guardianName?: string;
      guardianContact?: string;
      ageSegment: AgeSegment;
    }) =>
      apiFetch<StudentView>(`/api/v1/students/${body.studentId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          level: body.level,
          groupId: body.groupId,
          guardianName: body.guardianName,
          guardianContact: body.guardianContact,
          ageSegment: body.ageSegment,
        }),
        schema: StudentViewSchema,
      }),
    onSuccess: (_, variables) => {
      const studentName = approvingStudent?.name || variables.studentId;
      setSuccess(`Alumno "${studentName}" aprobado exitosamente.`);
      setApprovingStudent(null);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'reminders'] });
    },
    onError: (err: unknown) => {
      setApprovalError(err instanceof ApiError ? err.message : 'No se pudo aprobar al alumno.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiFetch(`/api/v1/students/${studentId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'reminders'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo rechazar la solicitud');
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiFetch(`/api/v1/students/${studentId}/unlock`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] }),
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo desbloquear la cuenta');
    },
  });

  // Handle Approve button click
  const openApproveModal = (student: StudentView) => {
    setApprovingStudent(student);
    setSelectedLevel(student.level ?? '');
    setSelectedGroupId('');
    setGuardianName(student.guardianName ?? '');
    setGuardianContact(student.guardianContact ?? '');
    setAgeSegment(student.ageSegment ?? AgeSegment.kids);
    setActionError(null);
    setApprovalError(null);
  };

  const canApprove =
    Boolean(selectedLevel) &&
    !groupsQuery.isError &&
    activeGroups.some((group) => group.id === selectedGroupId);

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingStudent || !selectedLevel || !canApprove || approveMutation.isPending) return;

    setApprovalError(null);
    setSuccess(null);

    approveMutation.mutate({
      studentId: approvingStudent.id,
      level: selectedLevel,
      groupId: selectedGroupId,
      guardianName: guardianName.trim() || undefined,
      guardianContact: guardianContact.trim() || undefined,
      ageSegment,
    });
  };

  const isSubmittingApproval = approveMutation.isPending;

  const handleReject = (student: StudentView) => {
    setActionError(null);
    setRejectConfirmDialog({ isOpen: true, student });
  };

  const handleConfirmReject = () => {
    const student = rejectConfirmDialog.student;
    setRejectConfirmDialog({ isOpen: false, student: null });
    if (!student) return;

    setActionError(null);
    setSuccess(null);
    rejectMutation.mutate(student.id, {
      onSuccess: () => {
        setSuccess(`Solicitud de "${student.name}" rechazada.`);
      },
    });
  };

  const handleUnlock = (student: StudentView) => {
    setActionError(null);
    setSuccess(null);
    unlockMutation.mutate(student.id, {
      onSuccess: () => {
        setSuccess(`Cuenta de "${student.name}" desbloqueada exitosamente.`);
      },
    });
  };

  const showLockedLoadError = activeTab === 'locked' && lockedQuery.isError && !lockedQuery.data;
  const lockedRefreshError =
    activeTab === 'locked' && lockedQuery.data ? getQueryErrorMessage(lockedQuery.error) : null;
  const bannerError = actionError || lockedRefreshError;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Alumnos</h1>
        <p className={styles.subtitle}>
          Directorio de alumnos activos, solicitudes de registro y cuentas bloqueadas.
        </p>
      </header>

      <aside
        className={styles.callout}
        aria-label={
          activeTab === 'locked' ? 'Regla de bloqueo automático' : 'Regla de ingreso de estudiantes'
        }
      >
        <Info size={18} strokeWidth={1.75} className={styles.calloutIcon} aria-hidden="true" />
        {activeTab === 'locked' ? (
          <p>
            Tras <strong>10 intentos fallidos consecutivos</strong>, la cuenta se bloquea durante{' '}
            <strong>10 minutos</strong>. El desbloqueo manual restablece el acceso de inmediato.
          </p>
        ) : (
          <p>
            Los estudiantes ingresan mediante auto-registro y aprobación docente en la pestaña{' '}
            <strong>Solicitudes</strong>. Cada alumno activo pertenece a un único grupo vigente.
          </p>
        )}
      </aside>

      {bannerError && (
        <div role="alert" className={styles.alertError}>
          <span>{bannerError}</span>
          {actionError && (
            <button
              type="button"
              onClick={() => setActionError(null)}
              className={styles.alertDismiss}
              aria-label="Cerrar aviso de error"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {success && (
        <div role="status" className={styles.alertSuccess}>
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className={styles.alertDismiss}
            aria-label="Cerrar aviso"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className={styles.tabBar}>
        <div className={styles.tablist} role="tablist" aria-label="Pestañas de alumnos">
          <button
            ref={(el) => {
              tabRefs.current.students = el;
            }}
            id="tab-students"
            type="button"
            role="tab"
            aria-selected={activeTab === 'students'}
            tabIndex={activeTab === 'students' ? 0 : -1}
            onClick={() => handleTabChange('students')}
            onKeyDown={(e) => handleTabKeyDown(e, 'students')}
            className={styles.tab}
          >
            <span>Alumnos activos</span>
          </button>

          <button
            ref={(el) => {
              tabRefs.current.requests = el;
            }}
            id="tab-requests"
            type="button"
            role="tab"
            aria-selected={activeTab === 'requests'}
            tabIndex={activeTab === 'requests' ? 0 : -1}
            onClick={() => handleTabChange('requests')}
            onKeyDown={(e) => handleTabKeyDown(e, 'requests')}
            className={styles.tab}
          >
            <span>Solicitudes de registro</span>
            {requestsCount > 0 && (
              <span className={styles.tabCount} data-tone="warm">
                {requestsCount}
              </span>
            )}
          </button>

          <button
            ref={(el) => {
              tabRefs.current.locked = el;
            }}
            id="tab-locked"
            type="button"
            role="tab"
            aria-selected={activeTab === 'locked'}
            aria-controls={activeTab === 'locked' ? 'panel-locked' : undefined}
            tabIndex={activeTab === 'locked' ? 0 : -1}
            onClick={() => handleTabChange('locked')}
            onKeyDown={(e) => handleTabKeyDown(e, 'locked')}
            className={styles.tab}
          >
            <span>Bloqueados</span>
            {lockedCount > 0 && (
              <span className={styles.tabCount} data-tone="danger">
                {lockedCount}
              </span>
            )}
          </button>
        </div>

        <Link href="/grupos" className={styles.groupsLink}>
          <span>Gestionar grupos</span>
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>

      {/* Tab 1: Alumnos activos */}
      {activeTab === 'students' && (
        <div
          id="panel-students"
          role="tabpanel"
          aria-labelledby="tab-students"
          className={styles.panel}
        >
          {isLoading ? (
            <div className={styles.skeletonCard} role="status">
              <span className="sr-only">Cargando alumnos activos…</span>
              <div className={styles.skeletonHeader} aria-hidden="true" />
              <div className={styles.skeletonRows} aria-hidden="true">
                {skeletonRows.map((row) => (
                  <div key={row} data-skeleton-row="" className={styles.skeletonRow}>
                    <div className={styles.skeletonBar} />
                    <div className={styles.skeletonBar} />
                    <div className={styles.skeletonBar} />
                    <div className={styles.skeletonBar} />
                    <div className={styles.skeletonBar} />
                    <div className={styles.skeletonBar} />
                    <div className={styles.skeletonBar} />
                  </div>
                ))}
              </div>
            </div>
          ) : studentsQuery.isError && !studentsQuery.data ? (
            <ErrorState
              variant="teacher"
              editorial
              {...getFriendlyErrorProps(
                studentsQuery.error,
                'No pudimos cargar el directorio de alumnos.',
              )}
              onRetry={() => void studentsQuery.refetch()}
            />
          ) : activeStudents.length === 0 ? (
            <div className={styles.emptyCard}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <Users size={22} strokeWidth={1.75} />
              </span>
              <h2>Aún no hay alumnos activos</h2>
              <p>
                Cuando los estudiantes completen su auto-registro, sus solicitudes aparecerán en{' '}
                <strong>Solicitudes de registro</strong> para que les asignes nivel y grupo.
              </p>
              <button
                type="button"
                onClick={() => handleTabChange('requests')}
                className={styles.emptyAction}
              >
                <span>Ir a Solicitudes de registro</span>
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <div
                className={styles.tableWrap}
                role="region"
                aria-label="Alumnos activos"
                tabIndex={0}
              >
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Correo</th>
                      <th scope="col">Nivel MCER</th>
                      <th scope="col">Grupo vigente</th>
                      <th scope="col">Segmento</th>
                      <th scope="col">Contacto acudiente</th>
                      <th scope="col">
                        <span className="sr-only">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStudents.map((st) => {
                      const groupName = st.groupId ? groupNameById.get(st.groupId) : undefined;
                      const hasGuardianInfo = Boolean(st.guardianName || st.guardianContact);

                      return (
                        <tr key={st.id}>
                          <th scope="row">
                            <Link
                              href={`/alumnos/${encodeURIComponent(st.id)}`}
                              className={styles.studentNameLink}
                            >
                              {st.name}
                            </Link>
                          </th>
                          <td data-label="Correo">
                            <span className={styles.emailText} title={st.email ?? undefined}>
                              {st.email ?? 'Sin correo'}
                            </span>
                          </td>
                          <td data-label="Nivel MCER">
                            <span className={st.level ? styles.levelBadge : styles.segmentBadge}>
                              {st.level ?? 'Sin nivel'}
                            </span>
                          </td>
                          <td data-label="Grupo vigente">
                            {st.groupId && groupName ? (
                              <Link
                                href={`/grupos/${encodeURIComponent(st.groupId)}`}
                                className={styles.groupLink}
                              >
                                {groupName}
                              </Link>
                            ) : (
                              <span className={styles.mutedText}>Sin grupo</span>
                            )}
                          </td>
                          <td data-label="Segmento">
                            <span className={styles.segmentBadge}>
                              {formatAgeSegment(st.ageSegment)}
                            </span>
                          </td>
                          <td data-label="Contacto acudiente">
                            {hasGuardianInfo ? (
                              <div className={styles.guardianCell}>
                                {st.guardianName && (
                                  <span className={styles.guardianName}>{st.guardianName}</span>
                                )}
                                {st.guardianContact && (
                                  <span className={styles.guardianContact}>
                                    {st.guardianContact}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className={styles.mutedText}>Sin registrar</span>
                            )}
                          </td>
                          <td className={styles.actionCell}>
                            <Link
                              href={`/alumnos/${encodeURIComponent(st.id)}`}
                              className={styles.detailLink}
                              aria-label={`Ver ficha de ${st.name}`}
                            >
                              <span>Ver ficha</span>
                              <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Solicitudes de registro */}
      {activeTab === 'requests' && (
        <div
          id="panel-requests"
          role="tabpanel"
          aria-labelledby="tab-requests"
          className={styles.panel}
        >
          {isLoading ? (
            <p className={requestStyles.loading} role="status">Cargando solicitudes…</p>
          ) : requestsQuery.isError ? (
            <ErrorState
              variant="teacher"
              editorial
              {...getFriendlyErrorProps(requestsQuery.error, 'No pudimos cargar las solicitudes.')}
              onRetry={() => void requestsQuery.refetch()}
            />
          ) : requests.length === 0 ? (
            <div className={styles.emptyCard}>
              <span className={requestStyles.emptyIcon} aria-hidden="true">
                <CircleCheck size={22} strokeWidth={1.75} />
              </span>
              <h2>No hay solicitudes pendientes de aprobación.</h2>
              <p>Los nuevos registros aparecerán aquí para que les asignes nivel y grupo.</p>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <div
                className={`${styles.tableWrap} ${requestStyles.tableWrap}`}
                role="region"
                aria-label="Solicitudes pendientes"
                tabIndex={0}
              >
                <table className={`${styles.table} ${requestStyles.table}`} role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">Alumno</th>
                      <th scope="col" role="columnheader">Correo</th>
                      <th scope="col" role="columnheader">Nacimiento y segmento</th>
                      <th scope="col" role="columnheader">Contacto del acudiente</th>
                      <th scope="col" role="columnheader">Estado</th>
                      <th scope="col" role="columnheader">Acciones</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {requests.map((req) => (
                      <tr key={req.id} role="row">
                        <th scope="row" role="rowheader">{req.name}</th>
                        <td role="cell" data-label="Correo">{req.email ?? 'Sin correo'}</td>
                        <td role="cell" data-label="Nacimiento y segmento">
                          <div className={requestStyles.cellDetails}>
                            {req.birthDate && (
                              <time dateTime={req.birthDate}>
                                {birthDateFormatter.format(new Date(`${req.birthDate}T12:00:00-05:00`))}
                              </time>
                            )}
                            <span>{formatAgeSegment(req.ageSegment)}</span>
                          </div>
                        </td>
                        <td role="cell" data-label="Contacto del acudiente">
                          <div className={requestStyles.cellDetails}>
                            {req.guardianName && <strong>{req.guardianName}</strong>}
                            {req.guardianContact && <span>{req.guardianContact}</span>}
                            {!req.guardianName && !req.guardianContact && 'Sin registrar'}
                          </div>
                        </td>
                        <td role="cell" data-label="Estado">
                          <TeacherStatusBadge kind="studentPendingApproval" />
                        </td>
                        <td role="cell" className={styles.actionCell}>
                          <div className={requestStyles.rowActions}>
                            <button
                              type="button"
                              onClick={() => openApproveModal(req)}
                              className={requestStyles.primary}
                              disabled={rejectMutation.isPending}
                              aria-label={`Aprobar a ${req.name}`}
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(req)}
                              className={requestStyles.reject}
                              disabled={rejectMutation.isPending}
                              aria-label={`Rechazar solicitud de ${req.name}`}
                            >
                              Rechazar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Bloqueados */}
      {activeTab === 'locked' && (
        <div
          id="panel-locked"
          role="tabpanel"
          aria-labelledby="tab-locked"
          className={styles.panel}
        >
          {isLoading ? (
            <div className={styles.emptyCard} role="status">
              <p>Cargando cuentas bloqueadas…</p>
            </div>
          ) : showLockedLoadError ? (
            <ErrorState
              variant="teacher"
              editorial
              {...getFriendlyErrorProps(lockedQuery.error, 'No pudimos cargar las cuentas bloqueadas.')}
              onRetry={() => void lockedQuery.refetch()}
            />
          ) : locked.length === 0 ? (
            <div className={styles.emptyCard}>
              <span className={styles.lockedEmptyIcon} aria-hidden="true">
                <CircleCheck size={22} strokeWidth={1.75} />
              </span>
              <h2>No hay cuentas bloqueadas en este momento.</h2>
            </div>
          ) : (
            <div className={styles.tableCard}>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.lockedTable}`} role="table">
                  <caption className="sr-only">Cuentas bloqueadas · Hora de Colombia</caption>
                  <thead role="rowgroup">
                    <tr role="row">
                      <th role="columnheader" scope="col">
                        Alumno
                      </th>
                      <th role="columnheader" scope="col">
                        Estado
                      </th>
                      <th role="columnheader" scope="col">
                        Bloqueada hasta
                      </th>
                      <th role="columnheader" scope="col">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {locked.map((student) => {
                      const expiration = Date.parse(student.lockedUntil ?? '');
                      const hasExpiration = Number.isFinite(expiration);
                      const expired = hasExpiration && expiration <= lockClock;
                      const isUnlocking =
                        unlockMutation.isPending && unlockMutation.variables === student.id;
                      const unlockLabel = isUnlocking ? 'Desbloqueando…' : 'Desbloquear cuenta';

                      return (
                        <tr key={student.id} role="row">
                          <th role="rowheader" scope="row">
                            <span>{student.name}</span>
                            <span className={styles.lockedEmail}>{student.email}</span>
                          </th>
                          <td role="cell" data-label="Estado">
                            {expired ? 'Plazo cumplido' : <TeacherStatusBadge kind="studentLocked" />}
                          </td>
                          <td role="cell" data-label="Bloqueada hasta">
                            {hasExpiration ? (
                              <div className={styles.lockedExpiration}>
                                <time dateTime={student.lockedUntil ?? undefined}>
                                  {formatBogotaDateTime(new Date(expiration))}
                                </time>
                                {!expired && (
                                  <span>{formatLockRemaining(expiration, lockClock)}</span>
                                )}
                              </div>
                            ) : (
                              <span>Hora no disponible</span>
                            )}
                          </td>
                          <td role="cell" className={styles.actionCell}>
                            <button
                              type="button"
                              onClick={() => handleUnlock(student)}
                              disabled={unlockMutation.isPending}
                              className={styles.unlockButton}
                              aria-label={`${unlockLabel} (${student.name})`}
                            >
                              {unlockLabel}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <AccessibleModal
        isOpen={Boolean(approvingStudent)}
        onClose={() => setApprovingStudent(null)}
        title={`Aprobar alumno: ${approvingStudent?.name ?? ''}`}
        maxWidthClass="max-w-[540px]"
        dialogClassName={requestStyles.dialog}
        dismissible={!isSubmittingApproval}
      >
        {groupsQuery.isError ? (
          <ErrorState
            variant="teacher"
            editorial
            {...getFriendlyErrorProps(groupsQuery.error, 'No pudimos cargar los grupos activos.')}
            onRetry={() => void groupsQuery.refetch()}
          />
        ) : groupsQuery.isPending ? (
          <p role="status">Cargando grupos activos…</p>
        ) : activeGroups.length === 0 ? (
          <div className={requestStyles.noGroups}>
            <p>Debes crear un grupo activo antes de poder aprobar la solicitud.</p>
            <Link href="/grupos" className={requestStyles.primary}>Gestionar grupos</Link>
          </div>
        ) : (
          <form onSubmit={handleConfirmApproval} className={requestStyles.form}>
            <div className={requestStyles.formGrid}>
              <label htmlFor="approve-level">
                Nivel MCER
                <select
                  id="approve-level"
                  required
                  value={selectedLevel}
                  onChange={(e) => {
                    if (isLevel(e.target.value)) setSelectedLevel(e.target.value);
                  }}
                >
                  <option value="" disabled>Selecciona un nivel</option>
                  <option value={Level.A1}>A1</option>
                  <option value={Level.A2}>A2</option>
                  <option value={Level.B1}>B1</option>
                  <option value={Level.B2}>B2</option>
                </select>
              </label>
              <label htmlFor="approve-segment">
                Segmento pedagógico
                <select
                  id="approve-segment"
                  value={ageSegment}
                  onChange={(e) => {
                    if (isAgeSegment(e.target.value)) setAgeSegment(e.target.value);
                  }}
                >
                  <option value={AgeSegment.kids}>Kids (7 a 10 años)</option>
                  <option value={AgeSegment.teens}>Teens (11 a 14 años)</option>
                </select>
              </label>
            </div>

            <label htmlFor="approve-group">
              Grupo inicial
              <select
                id="approve-group"
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="" disabled>Selecciona un grupo activo</option>
                {activeGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>

            <div className={requestStyles.formGrid}>
              <label htmlFor="approve-guardian">
                Nombre del acudiente (opcional)
                <input
                  id="approve-guardian"
                  type="text"
                  maxLength={200}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
              </label>
              <label htmlFor="approve-contact">
                Contacto del acudiente (opcional)
                <input
                  id="approve-contact"
                  type="text"
                  maxLength={200}
                  value={guardianContact}
                  onChange={(e) => setGuardianContact(e.target.value)}
                />
              </label>
            </div>

            <p className={requestStyles.note}>Al aprobar la solicitud, se enviará un correo de bienvenida al alumno.</p>
            {approvalError && (
              <p role="alert" className={styles.alertError}>{approvalError}</p>
            )}
            <div className={requestStyles.dialogActions}>
              <button
                type="button"
                onClick={() => { if (!isSubmittingApproval) setApprovingStudent(null); }}
                aria-disabled={isSubmittingApproval || undefined}
                className={requestStyles.secondary}
              >
                Cancelar
              </button>
              <button
                type="submit"
                aria-disabled={isSubmittingApproval || !canApprove}
                className={requestStyles.primary}
              >
                {isSubmittingApproval ? 'Aprobando…' : 'Confirmar aprobación'}
              </button>
            </div>
          </form>
        )}
      </AccessibleModal>
      <EditorialConfirmDialog
        isOpen={rejectConfirmDialog.isOpen}
        title="Rechazar solicitud"
        message={`Se eliminará la solicitud de ${rejectConfirmDialog.student?.name ?? ''} sin activar su cuenta. Esta acción es definitiva.`}
        isDestructive
        confirmText="Rechazar solicitud"
        onConfirm={handleConfirmReject}
        onCancel={() => setRejectConfirmDialog({ isOpen: false, student: null })}
      />
    </div>
  );
}

export function AlumnosClient() {
  return (
    <Suspense
      fallback={
        <div role="status" className="py-12 text-center text-sm text-[#5E3E2C]">
          Cargando gestión de alumnos…
        </div>
      }
    >
      <StudentsManagementContent />
    </Suspense>
  );
}
