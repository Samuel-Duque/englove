'use client';

import styles from '../origami-management.module.css';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StudentView,
  StudentViewSchema,
  StudentListResponse,
  StudentListResponseSchema,
  GroupListResponse,
  GroupListResponseSchema,
  Level,
  AgeSegment,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { ConfirmDialog, AccessibleModal } from '../../../components/ui/modal';

function isLevel(val: string): val is Level {
  return (
    val === Level.A1 || val === Level.A2 || val === Level.B1 || val === Level.B2
  );
}

function isAgeSegment(val: string): val is AgeSegment {
  return val === AgeSegment.kids || val === AgeSegment.teens;
}

function StudentsManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const rawTab = searchParams.get('tab');
  const initialTab: 'students' | 'requests' | 'locked' =
    rawTab === 'requests' || rawTab === 'locked' ? rawTab : 'students';

  const [activeTab, setActiveTab] = useState<
    'students' | 'requests' | 'locked'
  >(initialTab);

  // UI state
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Approve Modal state
  const [approvingStudent, setApprovingStudent] = useState<StudentView | null>(
    null,
  );
  const [selectedLevel, setSelectedLevel] = useState<Level>(Level.A1);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [ageSegment, setAgeSegment] = useState<AgeSegment>(AgeSegment.kids);
  const [rejectConfirmDialog, setRejectConfirmDialog] = useState<{
    isOpen: boolean;
    student: StudentView | null;
  }>({ isOpen: false, student: null });

  // Sync tab with URL
  const handleTabChange = (tab: 'students' | 'requests' | 'locked') => {
    setActiveTab(tab);
    setActionError(null);
    setSuccess(null);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`/alumnos?${params.toString()}`);
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
    enabled: activeTab === 'requests',
  });

  const lockedQuery = useQuery({
    queryKey: ['teacher', 'students', 'locked'],
    queryFn: () =>
      apiFetch<StudentListResponse>('/api/v1/students/locked?limit=100', {
        schema: StudentListResponseSchema,
      }),
    enabled: activeTab === 'locked',
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
  const requests = requestsQuery.data?.items || [];
  const locked = lockedQuery.data?.items || [];

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
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo aprobar al alumno',
      );
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiFetch(`/api/v1/students/${studentId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo rechazar la solicitud',
      );
    },
  });

  const unlockMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiFetch(`/api/v1/students/${studentId}/unlock`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo desbloquear la cuenta',
      );
    },
  });

  // Handle Approve button click
  const openApproveModal = (student: StudentView) => {
    setApprovingStudent(student);
    setSelectedLevel(student.level ?? Level.A1);
    setGuardianName(student.guardianName ?? '');
    setGuardianContact(student.guardianContact ?? '');
    setAgeSegment(student.ageSegment ?? AgeSegment.kids);
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0]?.id ?? '');
    }
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingStudent) return;
    if (!selectedGroupId) {
      setActionError(
        'Debes seleccionar un grupo activo para aprobar al alumno',
      );
      return;
    }

    setActionError(null);
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

  const activeQuery =
    activeTab === 'students'
      ? studentsQuery
      : activeTab === 'requests'
        ? requestsQuery
        : lockedQuery;
  const error = actionError || activeQuery.error?.message;
  const cannotLoad = activeQuery.isError && !activeQuery.data;

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div>
        <h1 className="origami-page-title text-[var(--origami-text-primary)]">
          Gestión de Alumnos
        </h1>
        <p className="text-sm text-[var(--origami-text-secondary)]">
          Administra estudiantes inscritos, solicitudes de acceso y desbloqueo
          de cuentas.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="origami-state origami-state--error flex justify-between items-center"
        >
          <span>{error}</span>
          {actionError ? (
            <button
              aria-label="Cerrar aviso"
              type="button"
              onClick={() => setActionError(null)}
              className="origami-button origami-button--text"
            >
              ✕
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void activeQuery.refetch()}
              className="origami-button origami-button--secondary"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="origami-state origami-state--success flex justify-between items-center"
        >
          <span>{success}</span>
          <button
            aria-label="Cerrar aviso"
            type="button"
            onClick={() => setSuccess(null)}
            className="origami-button origami-button--text ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--origami-border-subtle)]">
        <nav
          className="flex flex-wrap gap-2 pb-3"
          aria-label="Pestañas de alumnos"
        >
          <button
            aria-pressed={activeTab === 'students'}
            type="button"
            onClick={() => handleTabChange('students')}
            className={
              'origami-button origami-button--secondary' +
              (activeTab === 'students' ? ' origami-selected' : '')
            }
          >
            Alumnos inscritos
          </button>

          <button
            aria-pressed={activeTab === 'requests'}
            type="button"
            onClick={() => handleTabChange('requests')}
            className={
              'origami-button origami-button--secondary' +
              (activeTab === 'requests' ? ' origami-selected' : '')
            }
          >
            <span>Solicitudes de registro</span>
            {requests.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--origami-warning-bg)] text-[var(--origami-warning-text)]">
                {requests.length}
              </span>
            )}
          </button>

          <button
            aria-pressed={activeTab === 'locked'}
            type="button"
            onClick={() => handleTabChange('locked')}
            className={
              'origami-button origami-button--secondary' +
              (activeTab === 'locked' ? ' origami-selected' : '')
            }
          >
            <span>Bloqueados</span>
            {locked.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--origami-error-bg)] text-[var(--origami-error-text)]">
                {locked.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab 1: Alumnos inscritos */}
      {activeTab === 'students' && (
        <div>
          {isLoading ? (
            <div role="status" className="origami-state text-center">
              Cargando alumnos…
            </div>
          ) : cannotLoad ? null : students.length === 0 ? (
            <div className="origami-card text-center">
              <p className="text-base font-semibold text-[var(--origami-text-primary)]">
                No hay alumnos registrados
              </p>
              <p className="mt-1 text-sm text-[var(--origami-text-secondary)]">
                Los alumnos se registran desde el enlace de registro de tu
                institución y aparecen en la pestaña de Solicitudes.
              </p>
            </div>
          ) : (
            <div className="origami-card">
              <table
                role="table"
                aria-label="Alumnos aprobados"
                className={styles.operationalTable}
              >
                <thead role="rowgroup" className={styles.operationalHead}>
                  <tr role="row">
                    <th role="columnheader" scope="col">
                      Nombre
                    </th>
                    <th role="columnheader" scope="col">
                      Correo
                    </th>
                    <th role="columnheader" scope="col">
                      Nivel
                    </th>
                    <th role="columnheader" scope="col">
                      Segmento
                    </th>
                    <th role="columnheader" scope="col">
                      Ficha
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className={styles.operationalBody}>
                  {students.map((st) => (
                    <tr
                      role="row"
                      key={st.id}
                      className={
                        styles.operationalRow +
                        ' hover:bg-[var(--origami-surface-soft)]'
                      }
                    >
                      <td
                        role="cell"
                        className={styles.cardHeading + ' font-semibold'}
                      >
                        <h2 className="origami-card-title">
                          <Link
                            href={`/alumnos/${st.id}`}
                            className="hover:text-[var(--origami-info-text)] underline underline-offset-4"
                          >
                            {st.name}
                          </Link>
                        </h2>
                      </td>
                      <td
                        role="cell"
                        className={
                          styles.cardField +
                          ' text-[var(--origami-text-secondary)]'
                        }
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Correo
                        </span>
                        {st.email}
                      </td>
                      <td role="cell" className={styles.cardField}>
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Nivel
                        </span>
                        <span className="flex flex-wrap px-2 py-0.5 rounded text-xs font-bold bg-[var(--origami-surface-raised)] text-[var(--origami-text-primary)]">
                          {st.level ?? 'Sin nivel'}
                        </span>
                      </td>
                      <td
                        role="cell"
                        className={
                          styles.cardField +
                          ' text-[var(--origami-text-secondary)] capitalize'
                        }
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Segmento
                        </span>
                        {st.ageSegment}
                      </td>
                      <td
                        role="cell"
                        className={styles.cardField + ' font-semibold'}
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Ficha
                        </span>
                        <Link
                          href={`/alumnos/${st.id}`}
                          className="text-[var(--origami-info-text)] hover:text-[var(--origami-info-text)] underline underline-offset-4"
                        >
                          Ver ficha →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Solicitudes de registro */}
      {activeTab === 'requests' && (
        <div>
          {isLoading ? (
            <div role="status" className="origami-state text-center">
              Cargando solicitudes…
            </div>
          ) : cannotLoad ? null : requests.length === 0 ? (
            <div className="origami-card text-center">
              <p className="text-base font-semibold text-[var(--origami-text-primary)]">
                No tienes solicitudes pendientes
              </p>
              <p className="mt-1 text-sm text-[var(--origami-text-secondary)]">
                Aquí aparecerán los nuevos registros de alumnos para que les
                asignes nivel y grupo.
              </p>
            </div>
          ) : (
            <div className="origami-card">
              <table
                role="table"
                aria-label="Solicitudes pendientes"
                className={styles.operationalTable}
              >
                <thead role="rowgroup" className={styles.operationalHead}>
                  <tr role="row">
                    <th role="columnheader" scope="col">
                      Alumno
                    </th>
                    <th role="columnheader" scope="col">
                      Correo
                    </th>
                    <th role="columnheader" scope="col">
                      Nacimiento / Segmento
                    </th>
                    <th role="columnheader" scope="col">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className={styles.operationalBody}>
                  {requests.map((req) => (
                    <tr
                      role="row"
                      key={req.id}
                      className={
                        styles.operationalRow +
                        ' hover:bg-[var(--origami-surface-soft)]'
                      }
                    >
                      <td
                        role="cell"
                        className={styles.cardHeading + ' font-semibold'}
                      >
                        <h2 className="origami-card-title">{req.name}</h2>
                      </td>
                      <td
                        role="cell"
                        className={
                          styles.cardField +
                          ' text-[var(--origami-text-secondary)]'
                        }
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Correo
                        </span>
                        {req.email}
                      </td>
                      <td
                        role="cell"
                        className={
                          styles.cardField +
                          ' text-[var(--origami-text-secondary)]'
                        }
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Nacimiento / Segmento
                        </span>
                        {req.birthDate} ({req.ageSegment})
                      </td>
                      <td
                        role="cell"
                        className={styles.cardActions + ' font-semibold'}
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Acciones
                        </span>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            onClick={() => openApproveModal(req)}
                            className="origami-button"
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(req)}
                            className="origami-button origami-button--secondary text-[var(--origami-error-text)]"
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
          )}
        </div>
      )}

      {/* Tab 3: Bloqueados */}
      {activeTab === 'locked' && (
        <div>
          {isLoading ? (
            <div role="status" className="origami-state text-center">
              Cargando bloqueados…
            </div>
          ) : cannotLoad ? null : locked.length === 0 ? (
            <div className="origami-card text-center">
              <p className="text-base font-semibold text-[var(--origami-text-primary)]">
                No hay alumnos bloqueados
              </p>
              <p className="mt-1 text-sm text-[var(--origami-text-secondary)]">
                Las cuentas temporalmente bloqueadas por intentos fallidos
                aparecerán aquí para desbloqueo inmediato.
              </p>
            </div>
          ) : (
            <div className="origami-card">
              <table
                role="table"
                aria-label="Alumnos bloqueados"
                className={styles.operationalTable}
              >
                <thead role="rowgroup" className={styles.operationalHead}>
                  <tr role="row">
                    <th role="columnheader" scope="col">
                      Alumno
                    </th>
                    <th role="columnheader" scope="col">
                      Correo
                    </th>
                    <th role="columnheader" scope="col">
                      Bloqueado hasta
                    </th>
                    <th role="columnheader" scope="col">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup" className={styles.operationalBody}>
                  {locked.map((st) => (
                    <tr
                      role="row"
                      key={st.id}
                      className={
                        styles.operationalRow +
                        ' hover:bg-[var(--origami-surface-soft)]'
                      }
                    >
                      <td
                        role="cell"
                        className={styles.cardHeading + ' font-semibold'}
                      >
                        <h2 className="origami-card-title">{st.name}</h2>
                      </td>
                      <td
                        role="cell"
                        className={
                          styles.cardField +
                          ' text-[var(--origami-text-secondary)]'
                        }
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Correo
                        </span>
                        {st.email}
                      </td>
                      <td
                        role="cell"
                        className={
                          styles.cardField + ' text-[var(--origami-error-text)]'
                        }
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Bloqueado hasta
                        </span>
                        {st.lockedUntil
                          ? new Date(st.lockedUntil).toLocaleTimeString(
                              'es-CO',
                              { timeZone: 'America/Bogota' },
                            )
                          : 'Bloqueado'}
                      </td>
                      <td
                        role="cell"
                        className={styles.cardField + ' font-semibold'}
                      >
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Acción
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnlock(st)}
                          className="origami-button"
                        >
                          Desbloquear en 1 clic
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      <AccessibleModal
        isOpen={Boolean(approvingStudent)}
        onClose={() => setApprovingStudent(null)}
        title={`Aprobar alumno: ${approvingStudent?.name ?? ''}`}
        maxWidthClass="max-w-lg"
      >
        {groups.length === 0 ? (
          <div className="py-4 text-center space-y-3">
            <p className="text-sm text-[var(--origami-warning-text)] bg-[var(--origami-warning-bg)] p-4 rounded-lg border border-[var(--origami-border-subtle)]">
              No tienes ningún grupo activo. Debes crear un grupo antes de poder
              aprobar alumnos.
            </p>
            <Link href="/grupos" className="origami-button">
              Ir a Crear Grupo
            </Link>
          </div>
        ) : (
          <form onSubmit={handleConfirmApproval} className="space-y-4">
            {/* Level */}
            <div>
              <label
                htmlFor="approve-level"
                className="origami-label block mb-1"
              >
                Nivel pedagógico inicial *
              </label>
              <select
                id="approve-level"
                value={selectedLevel}
                onChange={(e) => {
                  if (isLevel(e.target.value)) setSelectedLevel(e.target.value);
                }}
                className="origami-field"
              >
                <option value={Level.A1}>A1</option>
                <option value={Level.A2}>A2</option>
                <option value={Level.B1}>B1</option>
                <option value={Level.B2}>B2</option>
              </select>
            </div>

            {/* Group (Strictly 1 active group per student, Decision 73) */}
            <div>
              <label
                htmlFor="approve-group"
                className="origami-label block mb-1"
              >
                Grupo asignado * (Un solo grupo vigente por alumno)
              </label>
              <select
                id="approve-group"
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="origami-field"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.activeStudentCount} miembros)
                  </option>
                ))}
              </select>
            </div>

            {/* Informacion del acudiente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="approve-guardian"
                  className="origami-label block mb-1"
                >
                  Nombre del acudiente (opcional)
                </label>
                <input
                  id="approve-guardian"
                  type="text"
                  maxLength={200}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="origami-field"
                />
              </div>

              <div>
                <label
                  htmlFor="approve-contact"
                  className="origami-label block mb-1"
                >
                  Contacto del acudiente (opcional)
                </label>
                <input
                  id="approve-contact"
                  type="text"
                  maxLength={200}
                  value={guardianContact}
                  onChange={(e) => setGuardianContact(e.target.value)}
                  className="origami-field"
                />
              </div>
            </div>

            {/* Pedagogical Segment correction */}
            <div>
              <label
                htmlFor="approve-segment"
                className="origami-label block mb-1"
              >
                Segmento pedagógico
              </label>
              <select
                id="approve-segment"
                value={ageSegment}
                onChange={(e) => {
                  if (isAgeSegment(e.target.value))
                    setAgeSegment(e.target.value);
                }}
                className="origami-field"
              >
                <option value={AgeSegment.kids}>Kids (7 a 10 años)</option>
                <option value={AgeSegment.teens}>Teens (11 a 14 años)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--origami-border-subtle)]">
              <button
                type="button"
                onClick={() => setApprovingStudent(null)}
                className="origami-button origami-button--secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingApproval || !selectedGroupId}
                className="origami-button"
              >
                {isSubmittingApproval ? 'Aprobando…' : 'Confirmar aprobación'}
              </button>
            </div>
          </form>
        )}
      </AccessibleModal>
      <ConfirmDialog
        isOpen={rejectConfirmDialog.isOpen}
        title="Rechazar solicitud"
        message={`¿Estás segura de rechazar la solicitud de "${rejectConfirmDialog.student?.name ?? ''}"? Esta acción borrará el registro y no se puede deshacer.`}
        isDestructive={true}
        confirmText="Rechazar solicitud"
        onConfirm={handleConfirmReject}
        onCancel={() =>
          setRejectConfirmDialog({ isOpen: false, student: null })
        }
      />
    </div>
  );
}

export function AlumnosClient() {
  return (
    <Suspense
      fallback={
        <div role="status" className="origami-state text-center">
          Cargando gestión de alumnos…
        </div>
      }
    >
      <StudentsManagementContent />
    </Suspense>
  );
}
