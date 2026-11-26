"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../../lib/api";
import {
  ConfirmDialog,
  AccessibleModal,
} from "../../../../components/ui/modal";
import styles from "./student-detail.module.css";

const membershipDate = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "short",
  timeZone: "America/Bogota",
});
const emailFormat = z.string().email();

export function StudentDetailSkeleton() {
  return (
    <div className={styles.page} role="status">
      <span className="sr-only">Cargando ficha del alumno…</span>
      <div className={styles.cards} aria-hidden="true">
        {[1, 2, 3, 4].map((card) => (
          <div key={card} className={`${styles.card} ${styles.skeleton}`} />
        ))}
      </div>
    </div>
  );
}

function wrapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab" || !(event.target instanceof HTMLElement)) return;
  const dialog = event.target.closest('[role="dialog"]');
  if (!dialog) return;
  // Native disabled controls are skipped by Tab, including gated confirmations.
  const focusable = dialog.querySelectorAll<HTMLElement>(
    "button:not(:disabled), input:not(:disabled)",
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.target === (event.shiftKey ? first : last)) {
    event.preventDefault();
    event.stopPropagation();
    (event.shiftKey ? last : first)?.focus();
  }
}

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
    queryKey: ["teacher", "student", id],
    queryFn: () =>
      apiFetch<StudentView>(`/api/v1/students/${id}`, {
        schema: StudentViewSchema,
      }),
  });

  const membershipsQuery = useQuery({
    queryKey: ["teacher", "student", id, "memberships"],
    queryFn: () =>
      apiFetch<MembershipListResponse>(
        `/api/v1/students/${id}/memberships?limit=100`,
        {
          schema: MembershipListResponseSchema,
        },
      ),
  });

  const groupsQuery = useQuery({
    queryKey: ["teacher", "groups", "active"],
    queryFn: () =>
      apiFetch<GroupListResponse>("/api/v1/groups?archived=false&limit=100", {
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
    useState<string>("");
  const syncedGroupIdRef = useRef<string | null>(null);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editLevel, setEditLevel] = useState<Level>(Level.A1);
  const [editGuardianName, setEditGuardianName] = useState("");
  const [editGuardianContact, setEditGuardianContact] = useState("");

  // Change Email Modal state (RF-18, RF-19, Decision 63)
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);

  // Delete Student state (ENG-070, Decision 103)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
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
      setEditBirthDate(data.birthDate ?? "");
      setEditLevel(data.level ?? Level.A1);
      setEditGuardianName(data.guardianName ?? "");
      setEditGuardianContact(data.guardianContact ?? "");
    }

    if (data.groupId && syncedGroupIdRef.current !== data.groupId) {
      syncedGroupIdRef.current = data.groupId;
      setSelectedDestinationGroup(data.groupId);
    }
  }, [studentQuery.data, isEditingProfile]);

  const deleteStudentMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/v1/students/${id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacher", "students"] });
      window.location.href = "/alumnos";
    },
    onError: (err: unknown) => {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "No se pudo dar de baja al estudiante",
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
        method: "PUT",
        body: JSON.stringify({
          groupId,
          confirmLostRetries,
        }),
        schema: StudentViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["teacher", "student", id], updated);
      void queryClient.invalidateQueries({
        queryKey: ["teacher", "student", id, "memberships"],
      });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "students"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "groups"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "group"] });
      setSuccess("Grupo actualizado exitosamente.");
      setRetryWarningModalOpen(false);
      setAffectedActivities([]);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === "UNCONSUMED_RETRY_WARNING") {
          const parsed = retryWarningSchema.safeParse(err.details);
          const acts =
            parsed.success && parsed.data.affectedActivities
              ? parsed.data.affectedActivities
              : [];
          setAffectedActivities(acts);
          setRetryWarningModalOpen(true);
        } else if (err.code === "GROUP_ARCHIVED") {
          setError("El grupo de destino está archivado y no acepta alumnos.");
        } else if (err.code === "STUDENT_NOT_APPROVED") {
          setError("El alumno debe estar aprobado para ser trasladado.");
        } else {
          setError(err.message);
        }
      } else {
        setError("No se pudo trasladar de grupo al alumno");
      }
    },
  });
  const isTransferringGroup = transferGroupMutation.isPending;

  const closeRetryWarning = () => {
    setRetryWarningModalOpen(false);
    setAffectedActivities([]);
  };

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
        method: "PATCH",
        body: JSON.stringify(payload),
        schema: StudentViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["teacher", "student", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["teacher", "students"] });
      setIsEditingProfile(false);
      setSuccess("Ficha del alumno actualizada.");
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar la información del alumno",
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
    if (student?.approvalStatus === "approved") {
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
        method: "POST",
        schema: MessageResponseSchema,
      }),
    onSuccess: (res) => {
      setSuccess(
        res.message || "Enlace de recuperación enviado al correo del alumno.",
      );
    },
    onError: (err: unknown) => {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo solicitar la recuperación de contraseña",
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
        method: "POST",
        body: JSON.stringify({ newEmail: email }),
        schema: MessageResponseSchema,
      }),
    onSuccess: (res) => {
      setSuccess(res.message);
      setIsChangeEmailOpen(false);
      setNewEmail("");
      setIdentityConfirmed(false);
      void queryClient.invalidateQueries({
        queryKey: ["teacher", "student", id],
      });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "students"] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_TAKEN") {
          setChangeEmailError("Ese correo no está disponible");
        } else {
          setChangeEmailError(err.message);
        }
      } else {
        setChangeEmailError("Error al cambiar el correo");
      }
    },
  });
  const isSubmittingEmail = changeEmailMutation.isPending;

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityConfirmed) {
      setChangeEmailError(
        "Debes confirmar que verificaste la identidad del alumno.",
      );
      return;
    }

    setChangeEmailError(null);
    setError(null);
    setSuccess(null);
    changeEmailMutation.mutate(newEmail.trim());
  };

  if (isLoading) return <StudentDetailSkeleton />;

  if (!student) {
    return (
      <div className={styles.page}>
        <h1 className="sr-only">Ficha del estudiante</h1>
        <div role="alert" className={styles.error}>
          <p>
            {studentQuery.error instanceof ApiError &&
            studentQuery.error.statusCode === 404
              ? "Alumno no encontrado."
              : "No se pudo cargar la ficha del alumno."}
          </p>
          <Link href="/alumnos">Volver a alumnos</Link>
        </div>
      </div>
    );
  }

  const activeMembership = memberships.find(
    (membership) => membership.leftAt === null,
  );
  const currentGroupName =
    activeMembership?.groupName ??
    activeGroups.find((group) => group.id === student.groupId)?.name;
  const segment = student.ageSegment === "kids" ? "Kids" : "Teens";

  return (
    <div className={styles.page} onKeyDown={wrapDialogFocus}>
      <nav aria-label="Ruta de la ficha" className={styles.breadcrumb}>
        <ol>
          <li>
            <Link href="/alumnos">Alumnos</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{student.name}</li>
        </ol>
      </nav>

      <header className={styles.header}>
        <div>
          <h1>{student.name}</h1>
          <ul className={styles.badges}>
            <li className={styles.badge} data-tone="level">
              {student.level
                ? `Nivel MCER ${student.level}`
                : "Nivel MCER sin asignar"}
            </li>
            {student.ageSegment && (
              <li className={styles.badge}>Segmento {segment}</li>
            )}
          </ul>
        </div>
        <Link
          href={`/estadisticas/estudiantes/${id}`}
          className={styles.button}
        >
          Ver estadísticas <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </header>

      {error && !retryWarningModalOpen && (
        <div role="alert" className={styles.error}>
          <div className={styles.alertBody}>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className={styles.button}
              aria-label="Cerrar aviso de error"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {success && (
        <div role="status" className={styles.success}>
          <div className={styles.alertBody}>
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className={styles.button}
              aria-label="Cerrar confirmación"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className={styles.cards}>
        <section className={styles.card} aria-labelledby="student-profile">
          <div className={styles.cardHeader}>
            <h2 id="student-profile">Datos personales y acudiente</h2>
            {!isEditingProfile && (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className={styles.button}
                data-tone="primary"
              >
                Editar datos
              </button>
            )}
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className={styles.form}>
              <div className={styles.fields}>
                <div className={styles.field}>
                  <label htmlFor="edit-name">Nombre completo *</label>
                  <input
                    id="edit-name"
                    type="text"
                    required
                    maxLength={100}
                    className={styles.control}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="edit-bdate">Fecha de nacimiento</label>
                  <input
                    id="edit-bdate"
                    type="date"
                    className={styles.control}
                    value={editBirthDate}
                    onChange={(event) => setEditBirthDate(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  {student.approvalStatus === "approved" ? (
                    <>
                      <label htmlFor="edit-lvl">Nivel MCER *</label>
                      <select
                        id="edit-lvl"
                        value={editLevel}
                        className={styles.control}
                        onChange={(event) => {
                          if (isLevel(event.target.value))
                            setEditLevel(event.target.value);
                        }}
                      >
                        <option value={Level.A1}>A1</option>
                        <option value={Level.A2}>A2</option>
                        <option value={Level.B1}>B1</option>
                        <option value={Level.B2}>B2</option>
                      </select>
                    </>
                  ) : (
                    <p className={styles.muted}>
                      El nivel MCER se asigna al aprobar la solicitud.
                    </p>
                  )}
                </div>
                <div className={styles.field}>
                  <label htmlFor="edit-gname">Nombre del acudiente</label>
                  <input
                    id="edit-gname"
                    type="text"
                    maxLength={200}
                    className={styles.control}
                    value={editGuardianName}
                    onChange={(event) =>
                      setEditGuardianName(event.target.value)
                    }
                  />
                </div>
                <div className={`${styles.field} ${styles.wide}`}>
                  <label htmlFor="edit-gcontact">
                    Contacto del acudiente (teléfono o correo)
                  </label>
                  <input
                    id="edit-gcontact"
                    type="text"
                    maxLength={200}
                    className={styles.control}
                    value={editGuardianContact}
                    onChange={(event) =>
                      setEditGuardianContact(event.target.value)
                    }
                  />
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={() => setIsEditingProfile(false)}
                  className={styles.button}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className={styles.button}
                  data-tone="primary"
                >
                  {isSavingProfile ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          ) : (
            <dl className={styles.details}>
              <div>
                <dt>Nombre completo</dt>
                <dd>{student.name}</dd>
              </div>
              <div>
                <dt>Fecha de nacimiento</dt>
                <dd className={styles.date}>
                  {student.birthDate ? (
                    <time dateTime={student.birthDate}>
                      {student.birthDate}
                    </time>
                  ) : (
                    "Sin registrar"
                  )}
                </dd>
              </div>
              <div>
                <dt>Nombre del acudiente</dt>
                <dd>{student.guardianName || "Sin registrar"}</dd>
              </div>
              <div>
                <dt>Contacto del acudiente</dt>
                <dd>{student.guardianContact || "Sin registrar"}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className={styles.card} aria-labelledby="student-group">
          <div className={styles.cardHeader}>
            <h2 id="student-group">Grupo asignado</h2>
          </div>
          <dl className={styles.details}>
            <div>
              <dt>Grupo actual</dt>
              <dd>
                {currentGroupName ??
                  (membershipsQuery.isError
                    ? "No disponible"
                    : "Sin grupo activo")}
              </dd>
            </div>
          </dl>
          {groupsQuery.isError ? (
            <p role="alert" className={styles.error}>
              No se pudieron cargar los grupos disponibles.
            </p>
          ) : (
            <div className={styles.transfer}>
              <div className={styles.field}>
                <label htmlFor="destination-group-select">
                  Seleccionar grupo de destino
                </label>
                <select
                  id="destination-group-select"
                  name="destinationGroupId"
                  value={
                    activeGroups.some(
                      (group) => group.id === selectedDestinationGroup,
                    )
                      ? selectedDestinationGroup
                      : ""
                  }
                  onChange={(event) =>
                    setSelectedDestinationGroup(event.target.value)
                  }
                  disabled={isTransferringGroup || activeGroups.length === 0}
                  className={styles.control}
                >
                  <option value="" disabled>
                    {activeGroups.length
                      ? "Elige un grupo"
                      : "No hay grupos activos"}
                  </option>
                  {activeGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleGroupTransfer(false)}
                disabled={
                  isTransferringGroup ||
                  selectedDestinationGroup === student.groupId ||
                  !activeGroups.some(
                    (group) => group.id === selectedDestinationGroup,
                  )
                }
                className={styles.button}
                data-tone="primary"
              >
                {isTransferringGroup ? "Trasladando…" : "Cambiar de grupo"}
              </button>
            </div>
          )}

          <div className={styles.history}>
            <h3 id="membership-history">Historial de membresías</h3>
            {membershipsQuery.isError ? (
              <p role="alert" className={styles.error}>
                No se pudo cargar el historial de membresías.
              </p>
            ) : memberships.length === 0 ? (
              <p className={styles.muted}>No registra historial de grupos.</p>
            ) : (
              <table
                className={styles.table}
                aria-labelledby="membership-history"
              >
                <thead>
                  <tr>
                    <th scope="col">Grupo</th>
                    <th scope="col">Fecha de ingreso</th>
                    <th scope="col">Fecha de salida</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((membership) => (
                    <tr key={membership.id}>
                      <th scope="row">{membership.groupName}</th>
                      <td className={styles.date}>
                        <time dateTime={membership.joinedAt}>
                          {membershipDate.format(new Date(membership.joinedAt))}
                        </time>
                      </td>
                      <td className={styles.date}>
                        {membership.leftAt ? (
                          <time dateTime={membership.leftAt}>
                            {membershipDate.format(new Date(membership.leftAt))}
                          </time>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span
                          className={styles.badge}
                          data-tone={
                            membership.leftAt === null ? "active" : undefined
                          }
                        >
                          {membership.leftAt === null
                            ? "Vigente"
                            : "Finalizada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="student-access">
          <div className={styles.cardHeader}>
            <h2 id="student-access">Seguridad y soporte de acceso</h2>
          </div>
          <dl className={styles.details}>
            <div className={styles.wide}>
              <dt>Correo de acceso</dt>
              <dd>{student.email ?? "Sin registrar"}</dd>
            </div>
          </dl>
          <div className={`${styles.actions} ${styles.accessActions}`}>
            <button
              type="button"
              onClick={handleSendPasswordReset}
              disabled={resetPasswordMutation.isPending}
              className={styles.button}
            >
              {resetPasswordMutation.isPending
                ? "Enviando enlace…"
                : "Enviar enlace de recuperación de contraseña"}
            </button>
            <button
              type="button"
              onClick={() => {
                setChangeEmailError(null);
                setIdentityConfirmed(false);
                setNewEmail("");
                setIsChangeEmailOpen(true);
              }}
              className={styles.button}
            >
              Cambiar correo de acceso
            </button>
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.danger}`}
          aria-labelledby="student-danger"
        >
          <h2 id="student-danger">Zona de peligro</h2>
          <p>
            La baja elimina de forma definitiva la cuenta, las respuestas y los
            audios del estudiante.
          </p>
          <div className={`${styles.actions} ${styles.accessActions}`}>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
              className={styles.button}
              data-tone="danger"
            >
              Dar de baja al estudiante
            </button>
          </div>
        </section>
      </div>

      <AccessibleModal
        isOpen={isChangeEmailOpen}
        onClose={() => setIsChangeEmailOpen(false)}
        title="Cambiar correo de acceso"
        dialogClassName={styles.criticalDialog}
        dismissible={!isSubmittingEmail}
      >
        <form onSubmit={handleChangeEmail} className={styles.dialogBody}>
          <div className={styles.field}>
            <label htmlFor="current-access-email">Correo actual</label>
            <input
              id="current-access-email"
              type="email"
              value={student.email ?? ""}
              readOnly
              className={styles.control}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="change-new-email">Nuevo correo electrónico *</label>
            <input
              id="change-new-email"
              type="email"
              required
              maxLength={255}
              value={newEmail}
              disabled={isSubmittingEmail}
              aria-describedby={
                changeEmailError ? "change-email-error" : undefined
              }
              onChange={(event) => setNewEmail(event.target.value)}
              className={styles.control}
            />
            {changeEmailError && (
              <p id="change-email-error" role="alert" className={styles.error}>
                {changeEmailError}
              </p>
            )}
          </div>
          <p className={styles.callout}>
            El cambio cierra las sesiones activas del estudiante, envía avisos
            al correo anterior y al nuevo y queda registrado en la bitácora de
            auditoría.
          </p>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              required
              checked={identityConfirmed}
              disabled={isSubmittingEmail}
              onChange={(event) => setIdentityConfirmed(event.target.checked)}
            />
            <span>
              Confirmo que verifiqué la identidad del alumno fuera de la
              plataforma.
            </span>
          </label>
          <div className={`${styles.actions} ${styles.dialogActions}`}>
            <button
              type="button"
              disabled={isSubmittingEmail}
              onClick={() => setIsChangeEmailOpen(false)}
              className={styles.button}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                isSubmittingEmail ||
                !identityConfirmed ||
                !emailFormat.safeParse(newEmail.trim()).success
              }
              className={styles.button}
              data-tone="primary"
            >
              {isSubmittingEmail ? "Actualizando…" : "Confirmar cambio"}
            </button>
          </div>
        </form>
      </AccessibleModal>

      <AccessibleModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar baja definitiva"
        dialogClassName={styles.criticalDialog}
        dismissible={!isDeletingStudent}
      >
        <div className={styles.dialogBody}>
          <p className={styles.error}>
            La baja de <strong>{student.name}</strong> es irreversible.
          </p>
          <ul>
            <li>
              Se conserva el número histórico de alumnos en las asignaciones
              abiertas y cerradas.
            </li>
            <li>
              Se eliminan las referencias a su correo en los registros de
              auditoría.
            </li>
            <li>Se borran los audios guardados en Cloudflare R2.</li>
            <li>
              Se eliminan la cuenta, las membresías y los intentos del
              estudiante.
            </li>
          </ul>
          <div className={styles.field}>
            <label htmlFor="delete-confirm-input">
              Escribe <strong>ELIMINAR</strong> para confirmar la baja
            </label>
            <input
              id="delete-confirm-input"
              type="text"
              value={deleteConfirmText}
              disabled={isDeletingStudent}
              autoComplete="off"
              spellCheck={false}
              placeholder="ELIMINAR"
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              className={styles.control}
            />
          </div>
          {deleteError && (
            <p role="alert" className={styles.error}>
              {deleteError}
            </p>
          )}
          <div className={`${styles.actions} ${styles.dialogActions}`}>
            <button
              type="button"
              disabled={isDeletingStudent}
              onClick={() => setIsDeleteModalOpen(false)}
              className={styles.button}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isDeletingStudent || deleteConfirmText !== "ELIMINAR"}
              onClick={handleDeleteStudent}
              className={styles.button}
              data-tone="danger"
            >
              {isDeletingStudent
                ? "Dando de baja…"
                : "Confirmar baja definitiva"}
            </button>
          </div>
        </div>
      </AccessibleModal>

      <AccessibleModal
        isOpen={retryWarningModalOpen}
        onClose={closeRetryWarning}
        title="Pérdida definitiva de reintentos"
        dialogClassName={styles.criticalDialog}
        dismissible={!isTransferringGroup}
      >
        <div className={styles.dialogBody}>
          <p className={styles.error}>
            El traslado revocará definitivamente los reintentos pendientes en el
            grupo actual, incluso si el alumno vuelve a ese grupo.
          </p>
          {affectedActivities.length > 0 && (
            <div className={styles.callout}>
              <p>
                <strong>Actividades con reintentos que se revocarán</strong>
              </p>
              <ul>
                {affectedActivities.map((activity, index) => (
                  <li
                    key={
                      typeof activity === "string"
                        ? index
                        : activity.assignmentId
                    }
                  >
                    {typeof activity === "string"
                      ? activity
                      : activity.activityTitle}
                    {typeof activity !== "string" && activity.attemptNumber
                      ? ` (Intento #${activity.attemptNumber})`
                      : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={`${styles.actions} ${styles.dialogActions}`}>
            <button
              type="button"
              disabled={isTransferringGroup}
              onClick={closeRetryWarning}
              className={styles.button}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isTransferringGroup}
              onClick={() => handleGroupTransfer(true)}
              className={styles.button}
              data-tone="danger"
            >
              {isTransferringGroup
                ? "Trasladando…"
                : "Confirmar traslado definitivo"}
            </button>
          </div>
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
