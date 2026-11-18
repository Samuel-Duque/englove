'use client';

import styles from '../../origami-management.module.css';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StudentView,
  StudentViewSchema,
  GroupListResponse,
  GroupListResponseSchema,
  MembershipListResponse,
  MembershipListResponseSchema,
  Level,
  MessageResponse,
  MessageResponseSchema,
  z,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../../lib/api';
import {
  ConfirmDialog,
  AccessibleModal,
} from '../../../../components/ui/modal';

const retryWarningSchema = z.object({
  affectedActivities: z
    .array(
      z.union([
        z.string(),
        z.object({
          assignmentId: z.string(),
          activityId: z.string(),
          activityTitle: z.string(),
          effectiveDueAt: z.string(),
          attemptNumber: z.number(),
        }),
      ]),
    )
    .optional(),
});

function isLevel(val: string): val is Level {
  return (
    val === Level.A1 || val === Level.A2 || val === Level.B1 || val === Level.B2
  );
}

export function AlumnoDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const studentQuery = useQuery({
    queryKey: ['teacher', 'student', id],
    queryFn: () =>
      apiFetch<StudentView>(`/api/v1/students/${id}`, {
        schema: StudentViewSchema,
      }),
  });

  const membershipsQuery = useQuery({
    queryKey: ['teacher', 'student', id, 'memberships'],
    queryFn: () =>
      apiFetch<MembershipListResponse>(
        `/api/v1/students/${id}/memberships?limit=100`,
        {
          schema: MembershipListResponseSchema,
        },
      ),
  });

  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', 'active'],
    queryFn: () =>
      apiFetch<GroupListResponse>('/api/v1/groups?archived=false&limit=100', {
        schema: GroupListResponseSchema,
      }),
  });

  const student = studentQuery.data ?? null;
  const memberships = membershipsQuery.data?.items ?? [];
  const activeGroups = groupsQuery.data?.items ?? [];

  const isLoading =
    studentQuery.isLoading ||
    membershipsQuery.isLoading ||
    groupsQuery.isLoading;

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Group transfer state
  const [selectedDestinationGroup, setSelectedDestinationGroup] =
    useState<string>('');
  const syncedGroupIdRef = useRef<string | null>(null);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editLevel, setEditLevel] = useState<Level>(Level.A1);
  const [editGuardianName, setEditGuardianName] = useState('');
  const [editGuardianContact, setEditGuardianContact] = useState('');

  // Change Email Modal state (RF-18, RF-19, Decision 63)
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);

  // Delete Student state (ENG-070, Decision 103)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // UNCONSUMED_RETRY_WARNING Modal state (P0-09, QA-07, Decision 131)
  const [retryWarningModalOpen, setRetryWarningModalOpen] = useState(false);
  const [affectedActivities, setAffectedActivities] = useState<
    Array<
      | string
      | {
          assignmentId: string;
          activityId: string;
          activityTitle: string;
          effectiveDueAt: string;
          attemptNumber: number;
        }
    >
  >([]);

  useEffect(() => {
    const data = studentQuery.data;
    if (!data) return;

    if (!isEditingProfile) {
      setEditName(data.name);
      setEditBirthDate(data.birthDate ?? '');
      setEditLevel(data.level ?? Level.A1);
      setEditGuardianName(data.guardianName ?? '');
      setEditGuardianContact(data.guardianContact ?? '');
    }

    if (data.groupId && syncedGroupIdRef.current !== data.groupId) {
      syncedGroupIdRef.current = data.groupId;
      setSelectedDestinationGroup(data.groupId);
    }
  }, [studentQuery.data, isEditingProfile]);

  const deleteStudentMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/v1/students/${id}`, {
        method: 'DELETE',
        headers: {
          Origin: window.location.origin,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      window.location.href = '/alumnos';
    },
    onError: (err: unknown) => {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo dar de baja al estudiante',
      );
    },
  });
  const isDeletingStudent = deleteStudentMutation.isPending;

  const handleDeleteStudent = () => {
    setDeleteError(null);
    deleteStudentMutation.mutate();
  };

  // Group transfer handler (P0-09, QA-07, RF-9, Decision 131)
  const transferGroupMutation = useMutation({
    mutationFn: ({
      groupId,
      confirmLostRetries,
    }: {
      groupId: string;
      confirmLostRetries: boolean;
    }) =>
      apiFetch<StudentView>(`/api/v1/students/${id}/group`, {
        method: 'PUT',
        body: JSON.stringify({
          groupId,
          confirmLostRetries,
        }),
        schema: StudentViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'student', id], updated);
      void queryClient.invalidateQueries({
        queryKey: ['teacher', 'student', id, 'memberships'],
      });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'group'] });
      setSuccess('Grupo actualizado exitosamente.');
      setRetryWarningModalOpen(false);
      setAffectedActivities([]);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'UNCONSUMED_RETRY_WARNING') {
          const parsed = retryWarningSchema.safeParse(err.details);
          const acts =
            parsed.success && parsed.data.affectedActivities
              ? parsed.data.affectedActivities
              : [];
          setAffectedActivities(acts);
          setRetryWarningModalOpen(true);
        } else if (err.code === 'GROUP_ARCHIVED') {
          setError('El grupo de destino está archivado y no acepta alumnos.');
        } else if (err.code === 'STUDENT_NOT_APPROVED') {
          setError('El alumno debe estar aprobado para ser trasladado.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo trasladar de grupo al alumno');
      }
    },
  });
  const isTransferringGroup = transferGroupMutation.isPending;

  const handleGroupTransfer = (confirmLostRetries = false) => {
    if (
      !selectedDestinationGroup ||
      selectedDestinationGroup === student?.groupId
    )
      return;

    setError(null);
    setSuccess(null);
    transferGroupMutation.mutate({
      groupId: selectedDestinationGroup,
      confirmLostRetries,
    });
  };

  // Profile update handler
  const saveProfileMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch<StudentView>(`/api/v1/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        schema: StudentViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'student', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      setIsEditingProfile(false);
      setSuccess('Ficha del alumno actualizada.');
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo guardar la información del alumno',
      );
    },
  });
  const isSavingProfile = saveProfileMutation.isPending;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      name: editName.trim(),
      birthDate: editBirthDate || undefined,
      guardianName: editGuardianName.trim() || undefined,
      guardianContact: editGuardianContact.trim() || undefined,
    };
    if (student?.approvalStatus === 'approved') {
      payload.level = editLevel;
    }

    saveProfileMutation.mutate(payload);
  };

  // Password reset handler
  const handleSendPasswordReset = () => {
    setShowResetConfirm(true);
  };

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      apiFetch<MessageResponse>(`/api/v1/students/${id}/reset-password`, {
        method: 'POST',
        schema: MessageResponseSchema,
      }),
    onSuccess: (res) => {
      setSuccess(
        res.message || 'Enlace de recuperación enviado al correo del alumno.',
      );
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo solicitar la recuperación de contraseña',
      );
    },
  });

  const handleConfirmSendPasswordReset = () => {
    setShowResetConfirm(false);
    setError(null);
    setSuccess(null);
    resetPasswordMutation.mutate();
  };

  // Change Email handler (RF-18, RF-19, Decision 63)
  const changeEmailMutation = useMutation({
    mutationFn: (email: string) =>
      apiFetch<MessageResponse>(`/api/v1/students/${id}/change-email`, {
        method: 'POST',
        body: JSON.stringify({ newEmail: email }),
        schema: MessageResponseSchema,
      }),
    onSuccess: (res) => {
      setSuccess(res.message);
      setIsChangeEmailOpen(false);
      setNewEmail('');
      setIdentityConfirmed(false);
      void queryClient.invalidateQueries({
        queryKey: ['teacher', 'student', id],
      });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_TAKEN') {
          setChangeEmailError('Ese correo no está disponible');
        } else {
          setChangeEmailError(err.message);
        }
      } else {
        setChangeEmailError('Error al cambiar el correo');
      }
    },
  });
  const isSubmittingEmail = changeEmailMutation.isPending;

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityConfirmed) {
      setChangeEmailError(
        'Debes confirmar que verificaste la identidad del alumno.',
      );
      return;
    }

    setChangeEmailError(null);
    setError(null);
    setSuccess(null);
    changeEmailMutation.mutate(newEmail.trim());
  };

  if (isLoading) {
    return (
      <div role="status" className="origami-state text-center">
        Cargando ficha del alumno…
      </div>
    );
  }

  if (!student) {
    const isMissing =
      studentQuery.error instanceof ApiError &&
      studentQuery.error.statusCode === 404;
    return (
      <div className="origami-state origami-state--error space-y-4">
        <h1 className="origami-page-title">
          {isMissing
            ? 'Alumno no encontrado'
            : 'No se pudo cargar la ficha del alumno'}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/alumnos"
            className="origami-button origami-button--secondary"
          >
            Volver a alumnos
          </Link>
          {!isMissing && (
            <button
              type="button"
              className="origami-button origami-button--secondary"
              onClick={() => void studentQuery.refetch()}
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeMembership = memberships.find((m) => m.leftAt === null);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--origami-text-secondary)]">
        <Link
          href="/alumnos"
          className="hover:text-[var(--origami-text-primary)] underline underline-offset-4"
        >
          Alumnos
        </Link>
        <span>/</span>
        <span className="text-[var(--origami-text-primary)] font-medium">
          {student.name}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--origami-border-subtle)] pb-5">
        <div>
          <h1 className="origami-page-title text-[var(--origami-text-primary)]">
            {student.name}
          </h1>
          <p className="text-sm text-[var(--origami-text-secondary)]">
            {student.email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendPasswordReset}
            className="origami-button origami-button--secondary"
          >
            Enviar enlace de recuperación
          </button>

          <button
            type="button"
            onClick={() => {
              setIsChangeEmailOpen(true);
              setChangeEmailError(null);
              setIdentityConfirmed(false);
              setNewEmail('');
            }}
            className="origami-button"
          >
            Cambiar correo de acceso
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="origami-state origami-state--error flex justify-between items-center"
        >
          <span>{error}</span>
          <button
            aria-label="Cerrar aviso"
            type="button"
            onClick={() => setError(null)}
            className="origami-button origami-button--text ml-4 text-[var(--origami-error-text)]"
          >
            ✕
          </button>
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

      {/* Profile Details Card */}
      <div className="origami-card space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--origami-border-subtle)] pb-3">
          <h2 className="origami-section-title text-[var(--origami-text-primary)]">
            Datos personales y pedagógicos
          </h2>
          {!isEditingProfile && (
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="origami-button origami-button--text"
            >
              Editar datos
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-name" className="origami-label block mb-1">
                  Nombre completo *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="origami-field"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-bdate"
                  className="origami-label block mb-1"
                >
                  Fecha de nacimiento (YYYY-MM-DD)
                </label>
                <input
                  id="edit-bdate"
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="origami-field"
                />
              </div>

              <div>
                <label htmlFor="edit-lvl" className="origami-label block mb-1">
                  Nivel pedagógico{' '}
                  {student?.approvalStatus === 'approved'
                    ? '*'
                    : '(no asignado aún)'}
                </label>
                {student?.approvalStatus === 'approved' ? (
                  <select
                    id="edit-lvl"
                    value={editLevel}
                    onChange={(e) => {
                      if (isLevel(e.target.value)) setEditLevel(e.target.value);
                    }}
                    className="origami-field"
                  >
                    <option value={Level.A1}>A1</option>
                    <option value={Level.A2}>A2</option>
                    <option value={Level.B1}>B1</option>
                    <option value={Level.B2}>B2</option>
                  </select>
                ) : (
                  <p className="text-xs text-[var(--origami-text-secondary)] py-2">
                    El nivel pedagógico se asigna automáticamente al aprobar la
                    solicitud del alumno.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="edit-gname"
                  className="origami-label block mb-1"
                >
                  Nombre del acudiente
                </label>
                <input
                  id="edit-gname"
                  type="text"
                  maxLength={200}
                  value={editGuardianName}
                  onChange={(e) => setEditGuardianName(e.target.value)}
                  className="origami-field"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="edit-gcontact"
                  className="origami-label block mb-1"
                >
                  Contacto del acudiente (teléfono / correo)
                </label>
                <input
                  id="edit-gcontact"
                  type="text"
                  maxLength={200}
                  value={editGuardianContact}
                  onChange={(e) => setEditGuardianContact(e.target.value)}
                  className="origami-field"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="origami-button origami-button--secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="origami-button"
              >
                {isSavingProfile ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="block text-xs font-medium text-[var(--origami-text-secondary)]">
                Nivel actual
              </span>
              <span className="font-bold text-[var(--origami-text-primary)]">
                {student.level ?? 'Sin nivel'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--origami-text-secondary)]">
                Segmento
              </span>
              <span className="font-semibold text-[var(--origami-text-primary)] capitalize">
                {student.ageSegment}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--origami-text-secondary)]">
                Nacimiento
              </span>
              <span className="font-medium text-[var(--origami-text-primary)]">
                {student.birthDate}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--origami-text-secondary)]">
                Acudiente
              </span>
              <span className="font-medium text-[var(--origami-text-primary)]">
                {student.guardianName || 'No registrado'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Group Transfer Card (Atomic, 1 active group per student, Decision 73 & 90) */}
      <div className="origami-card space-y-4">
        <h2 className="origami-section-title text-[var(--origami-text-primary)] border-b border-[var(--origami-border-subtle)] pb-2">
          Grupo asignado
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs text-[var(--origami-text-secondary)]">
              Grupo actual:
            </span>
            <p className="text-base font-semibold text-[var(--origami-text-primary)]">
              {activeMembership?.groupName || 'Sin grupo activo'}
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label
              htmlFor="destination-group-select"
              className="origami-label sr-only"
            >
              Seleccionar grupo de destino
            </label>
            <select
              id="destination-group-select"
              name="destinationGroupId"
              aria-label="Seleccionar grupo de destino"
              value={selectedDestinationGroup}
              onChange={(e) => setSelectedDestinationGroup(e.target.value)}
              className="origami-field"
            >
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleGroupTransfer(false)}
              disabled={
                isTransferringGroup ||
                selectedDestinationGroup === student.groupId
              }
              className="origami-button"
            >
              {isTransferringGroup ? 'Trasladando…' : 'Cambiar de grupo'}
            </button>
          </div>
        </div>
      </div>

      {/* Membership History Table (RF-12) */}
      <div className="origami-card space-y-4">
        <h2 className="origami-section-title text-[var(--origami-text-primary)] border-b border-[var(--origami-border-subtle)] pb-2">
          Historial de membresías
        </h2>

        {memberships.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--origami-text-secondary)]">
            No registra historial de grupos.
          </p>
        ) : (
          <table
            role="table"
            aria-label="Extensiones de plazo"
            className={styles.operationalTable}
          >
            <thead role="rowgroup" className={styles.operationalHead}>
              <tr role="row">
                <th role="columnheader" scope="col">
                  Grupo
                </th>
                <th role="columnheader" scope="col">
                  Fecha de ingreso
                </th>
                <th role="columnheader" scope="col">
                  Fecha de salida
                </th>
                <th role="columnheader" scope="col">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className={styles.operationalBody}>
              {memberships.map((m) => {
                const isCurrent = m.leftAt === null;
                return (
                  <tr
                    role="row"
                    key={m.id}
                    className={
                      styles.operationalRow +
                      ' hover:bg-[var(--origami-surface-soft)]'
                    }
                  >
                    <td
                      role="cell"
                      className={styles.cardHeading + ' font-semibold'}
                    >
                      <h3 className="origami-card-title">{m.groupName}</h3>
                    </td>
                    <td
                      role="cell"
                      className={
                        styles.cardField +
                        ' text-[var(--origami-text-secondary)]'
                      }
                    >
                      <span className={styles.mobileLabel} aria-hidden="true">
                        Fecha de ingreso
                      </span>
                      {new Date(m.joinedAt).toLocaleDateString('es-CO', {
                        timeZone: 'America/Bogota',
                      })}
                    </td>
                    <td
                      role="cell"
                      className={
                        styles.cardField +
                        ' text-[var(--origami-text-secondary)]'
                      }
                    >
                      <span className={styles.mobileLabel} aria-hidden="true">
                        Fecha de salida
                      </span>
                      {m.leftAt
                        ? new Date(m.leftAt).toLocaleDateString('es-CO', {
                            timeZone: 'America/Bogota',
                          })
                        : '—'}
                    </td>
                    <td role="cell" className={styles.cardField}>
                      <span className={styles.mobileLabel} aria-hidden="true">
                        Estado
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                          isCurrent
                            ? 'bg-[var(--origami-success-bg)] text-[var(--origami-success-text)]'
                            : 'bg-[var(--origami-surface-raised)] text-[var(--origami-text-secondary)]'
                        }`}
                      >
                        {isCurrent ? 'Vigente' : 'Finalizada'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger Zone: Delete Student (ENG-070, Decision 103) */}
      <div className="rounded-2xl border border-[var(--origami-border-control)] bg-[var(--origami-error-bg)] p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="origami-section-title text-[var(--origami-error-text)]">
              Zona de peligro — Dar de baja al estudiante
            </h2>
            <p className="text-xs text-[var(--origami-error-text)] mt-1 max-w-xl">
              Esta acción congela los denominadores históricos en asignaciones
              anteriores, anonimiza registros de auditoría eliminando
              referencias de correo, borra los audios en almacenamiento y retira
              al estudiante de forma definitiva.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
            className="origami-button"
          >
            Dar de baja al estudiante
          </button>
        </div>
      </div>

      {/* Change Email Dialog (RF-18, RF-19, Decision 63) */}
      <AccessibleModal
        isOpen={isChangeEmailOpen}
        onClose={() => setIsChangeEmailOpen(false)}
        title="Cambiar correo de acceso"
      >
        {changeEmailError && (
          <div role="alert" className="origami-state origami-state--error">
            {changeEmailError}
          </div>
        )}

        <form onSubmit={handleChangeEmail} className="space-y-4">
          <div>
            <span className="block text-xs font-medium text-[var(--origami-text-secondary)] mb-1">
              Correo actual:
            </span>
            <p className="text-sm font-semibold text-[var(--origami-text-primary)] bg-[var(--origami-surface-soft)] p-2.5 rounded-lg border border-[var(--origami-border-subtle)]">
              {student.email}
            </p>
          </div>

          <div>
            <label
              htmlFor="change-new-email"
              className="origami-label block mb-1"
            >
              Nuevo correo electrónico *
            </label>
            <input
              id="change-new-email"
              type="email"
              required
              maxLength={255}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nuevo.correo@example.com"
              className="origami-field"
            />
          </div>

          {/* Mandatory unchecked verification checkbox (RF-18) */}
          <div className="pt-2">
            <label className="origami-label flex items-start gap-2.5 font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={identityConfirmed}
                onChange={(e) => setIdentityConfirmed(e.target.checked)}
                className="h-6 w-6 shrink-0 accent-[var(--origami-primary)]"
              />
              <span>Confirmo que verifiqué la identidad del alumno.</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--origami-border-subtle)]">
            <button
              type="button"
              onClick={() => setIsChangeEmailOpen(false)}
              className="origami-button origami-button--secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                isSubmittingEmail || !identityConfirmed || !newEmail.trim()
              }
              className="origami-button"
            >
              {isSubmittingEmail ? 'Actualizando…' : 'Confirmar cambio'}
            </button>
          </div>
        </form>
      </AccessibleModal>

      {/* Delete Student Confirmation Modal (ENG-070, Decision 103) */}
      <AccessibleModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="⚠️ Confirmar baja definitiva"
        maxWidthClass="max-w-lg"
      >
        <div className="text-xs text-[var(--origami-text-secondary)] space-y-2 leading-relaxed">
          <p className="font-semibold text-[var(--origami-text-primary)]">
            ¿Estás segura/o de dar de baja a{' '}
            <span className="font-bold text-[var(--origami-error-text)]">
              {student?.name}
            </span>
            ?
          </p>
          <p className="font-bold text-[var(--origami-error-text)] bg-[var(--origami-error-bg)] p-2.5 rounded-xl border border-[var(--origami-border-subtle)]">
            Se eliminarán la cuenta, las respuestas y los audios. Esta acción no
            se puede deshacer.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[var(--origami-text-secondary)]">
            <li>
              Congelación del denominador histórico en asignaciones abiertas y
              cerradas.
            </li>
            <li>
              Anonimización y redacción de direcciones de correo en registros de
              auditoría.
            </li>
            <li>Eliminación de archivos multimedia de voz en Cloudflare R2.</li>
            <li>
              Eliminación en cascada limpia de membresías, intentos y usuario.
            </li>
          </ul>
          <label
            htmlFor="delete-confirm-input"
            className="origami-label block pt-2 font-bold"
          >
            Para confirmar, escribe{' '}
            <span className="text-[var(--origami-error-text)] font-mono font-bold">
              ELIMINAR
            </span>{' '}
            a continuación:
          </label>
        </div>

        {deleteError && (
          <div className="p-3 rounded-xl bg-[var(--origami-error-bg)] border border-[var(--origami-border-subtle)] text-xs font-bold text-[var(--origami-error-text)]">
            {deleteError}
          </div>
        )}

        <input
          id="delete-confirm-input"
          type="text"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="ELIMINAR"
          aria-label="Escribe ELIMINAR para confirmar la baja"
          className="origami-field"
        />

        <div className="flex justify-end gap-3 pt-3 border-t border-[var(--origami-border-subtle)]">
          <button
            type="button"
            disabled={isDeletingStudent}
            onClick={() => setIsDeleteModalOpen(false)}
            className="origami-button origami-button--secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeletingStudent || deleteConfirmText !== 'ELIMINAR'}
            onClick={handleDeleteStudent}
            className="origami-button"
          >
            {isDeletingStudent ? 'Dando de baja…' : 'Confirmar baja definitiva'}
          </button>
        </div>
      </AccessibleModal>

      {/* Confirm Lost Retries Modal (P0-09, QA-07, RF-9, Decision 131) */}
      <AccessibleModal
        isOpen={retryWarningModalOpen}
        onClose={() => {
          if (!isTransferringGroup) {
            setRetryWarningModalOpen(false);
            setAffectedActivities([]);
          }
        }}
        title="⚠️ Pérdida definitiva de reintentos"
        maxWidthClass="max-w-lg"
      >
        <div className="text-xs text-[var(--origami-text-secondary)] space-y-3 leading-relaxed">
          <p className="font-semibold text-[var(--origami-text-primary)]">
            El alumno tiene reintentos concedidos pendientes en este grupo. Si
            confirmas el traslado,
            <span className="text-[var(--origami-error-text)] font-bold">
              {' '}
              la pérdida de los reintentos concedidos será definitiva e
              irreversible
            </span>
            , incluso si el alumno es trasladado de vuelta a este grupo en el
            futuro (QA-07).
          </p>

          {affectedActivities.length > 0 && (
            <div className="border border-[var(--origami-border-subtle)] bg-[var(--origami-warning-bg)] rounded-xl p-3 space-y-1.5">
              <p className="font-bold text-[var(--origami-warning-text)]">
                Actividades con reintentos que se revocarán:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[var(--origami-text-primary)]">
                {affectedActivities.map((act, actIdx) => {
                  if (typeof act === 'string') {
                    return (
                      <li key={String(actIdx)}>
                        <span className="font-semibold">{act}</span>
                      </li>
                    );
                  }
                  const key = act.assignmentId || String(actIdx);
                  const title = act.activityTitle || 'Actividad';
                  const attemptNum = act.attemptNumber
                    ? ` (Intento #${act.attemptNumber})`
                    : '';
                  return (
                    <li key={key}>
                      <span className="font-semibold">{title}</span>
                      {attemptNum}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-[var(--origami-text-secondary)]">
            ¿Confirmas el traslado de grupo asumiendo la revocación permanente
            de estos reintentos?
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--origami-border-subtle)]">
          <button
            type="button"
            disabled={isTransferringGroup}
            onClick={() => {
              setRetryWarningModalOpen(false);
              setAffectedActivities([]);
            }}
            className="origami-button origami-button--secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isTransferringGroup}
            onClick={() => handleGroupTransfer(true)}
            className="origami-button"
          >
            {isTransferringGroup
              ? 'Trasladando…'
              : 'Confirmar traslado definitivo'}
          </button>
        </div>
      </AccessibleModal>
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Recuperación de contraseña"
        message="¿Deseas enviar un enlace de recuperación de contraseña al correo del alumno?"
        confirmText="Enviar enlace"
        onConfirm={handleConfirmSendPasswordReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
