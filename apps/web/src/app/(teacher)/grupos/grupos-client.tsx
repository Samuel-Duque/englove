"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GroupListResponseSchema,
  GroupViewSchema,
  type GroupListResponse,
  type GroupView,
} from "@upward-english/shared";
import {
  EditorialBadge,
  EditorialConfirmDialog,
} from "../../../components/teacher-editorial";
import { apiFetch, ApiError } from "../../../lib/api";
import styles from "./grupos.module.css";

const filters = [
  { value: "active", label: "Activos" },
  { value: "archived", label: "Archivados" },
  { value: "all", label: "Todos" },
] as const;

type GroupFilter = (typeof filters)[number]["value"];
type GroupAction = { group: GroupView; kind: "archive" | "delete" };
type GroupError = { message: string; showStudents?: boolean };

const archiveBlocked = {
  message:
    "Este grupo tiene alumnos vigentes. Trasládalos a otro grupo antes de archivarlo.",
  showStudents: true,
};

function focusInput(node: HTMLInputElement | null) {
  node?.focus();
}

function focusAlert(node: HTMLDivElement | null) {
  if (node)
    requestAnimationFrame(() => {
      if (node.isConnected) node.focus();
    });
}

function reportError(error: unknown, fallback: string): GroupError {
  return { message: error instanceof Error ? error.message : fallback };
}

export function GroupsLoading() {
  return (
    <div className={styles.skeleton} role="status">
      <span className="sr-only">Cargando grupos…</span>
      {[1, 2, 3, 4].map((row) => (
        <div key={row} aria-hidden="true" />
      ))}
    </div>
  );
}

export function GruposClient() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<GroupError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [archivedFilter, setArchivedFilter] = useState<GroupFilter>("active");
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmation, setConfirmation] = useState<GroupAction | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["teacher", "groups", archivedFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (archivedFilter !== "all")
        params.set("archived", String(archivedFilter === "archived"));
      params.set("limit", "100");
      return apiFetch<GroupListResponse>(`/api/v1/groups?${params}`, {
        schema: GroupListResponseSchema,
      });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<GroupView>("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
        schema: GroupViewSchema,
      }),
    onSuccess: (group) => {
      setSuccess(`Se creó el grupo «${group.name}».`);
      setNewGroupName("");
      setIsCreating(false);
      if (archivedFilter === "archived") setArchivedFilter("active");
      void queryClient.invalidateQueries({ queryKey: ["teacher", "groups"] });
    },
    onError: (error) =>
      setActionError(reportError(error, "No se pudo crear el grupo.")),
  });

  const renameGroupMutation = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      apiFetch<GroupView>(`/api/v1/groups/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: payload.name }),
        schema: GroupViewSchema,
      }),
    onSuccess: (group) => {
      setSuccess(`El grupo ahora se llama «${group.name}».`);
      setEditingGroupId(null);
      queryClient.setQueryData(["teacher", "group", group.id], group);
      void queryClient.invalidateQueries({ queryKey: ["teacher", "groups"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "students"] });
      void queryClient.invalidateQueries({
        queryKey: ["teacher", "assignments"],
      });
    },
    onError: (error, { id }) => {
      if (error instanceof ApiError && error.code === "GROUP_ARCHIVED") {
        setEditingGroupId(null);
        setActionError({
          message:
            "Este grupo ya está archivado. Su nombre no se puede cambiar.",
          showStudents: true,
        });
        void queryClient.invalidateQueries({ queryKey: ["teacher", "groups"] });
        void queryClient.invalidateQueries({
          queryKey: ["teacher", "group", id],
        });
        return;
      }
      setActionError(reportError(error, "No se pudo renombrar el grupo."));
    },
  });

  const archiveGroupMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<GroupView>(`/api/v1/groups/${id}/archive`, {
        method: "POST",
        schema: GroupViewSchema,
      }),
    onSuccess: (group) => {
      setSuccess(`Se archivó el grupo «${group.name}».`);
      queryClient.setQueryData(["teacher", "group", group.id], group);
      void queryClient.invalidateQueries({ queryKey: ["teacher", "groups"] });
    },
    onError: (error, id) => {
      if (
        error instanceof ApiError &&
        error.code === "GROUP_HAS_ACTIVE_STUDENTS"
      ) {
        setActionError(archiveBlocked);
        void queryClient.invalidateQueries({ queryKey: ["teacher", "groups"] });
        void queryClient.invalidateQueries({
          queryKey: ["teacher", "group", id],
        });
        return;
      }
      setActionError(reportError(error, "No se pudo archivar el grupo."));
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (group: GroupView) =>
      apiFetch(`/api/v1/groups/${group.id}`, { method: "DELETE" }),
    onSuccess: (_, group) => {
      setSuccess(`Se eliminó el grupo «${group.name}».`);
      queryClient.removeQueries({ queryKey: ["teacher", "group", group.id] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "groups"] });
    },
    onError: (error) => {
      setActionError(
        error instanceof ApiError && error.code === "GROUP_HAS_HISTORY"
          ? {
              message:
                "El grupo tiene historial de alumnos o asignaciones y no se puede eliminar.",
            }
          : reportError(error, "No se pudo eliminar el grupo."),
      );
    },
  });

  const isChangingGroup =
    renameGroupMutation.isPending ||
    archiveGroupMutation.isPending ||
    deleteGroupMutation.isPending;
  const isConfirming =
    archiveGroupMutation.isPending || deleteGroupMutation.isPending;
  const isSubmitting = createGroupMutation.isPending;
  const canMutate = !isChangingGroup && !isSubmitting;
  const groups = groupsQuery.data?.items ?? [];
  const total = groupsQuery.data?.total ?? 0;

  function clearFeedback() {
    setActionError(null);
    setSuccess(null);
  }

  function startCreating() {
    clearFeedback();
    setEditingGroupId(null);
    setIsCreating(true);
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name || !canMutate) return;
    clearFeedback();
    createGroupMutation.mutate(name);
  }

  function submitRename(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const name = editingName.trim();
    if (!name || !canMutate) return;
    clearFeedback();
    renameGroupMutation.mutate({ id, name });
  }

  function openConfirmation(group: GroupView, kind: GroupAction["kind"]) {
    clearFeedback();
    if (kind === "archive" && group.activeStudentCount > 0) {
      setActionError({ ...archiveBlocked });
      return;
    }
    setConfirmation({ group, kind });
  }

  function confirmGroupAction() {
    if (!confirmation || !canMutate) return;
    const { group, kind } = confirmation;
    const onSettled = () => setConfirmation(null);
    if (kind === "archive")
      archiveGroupMutation.mutate(group.id, { onSettled });
    else deleteGroupMutation.mutate(group, { onSettled });
  }

  const isDeleting = confirmation?.kind === "delete";

  return (
    <section className={styles.page} aria-labelledby="groups-title">
      <header className={styles.header}>
        <div>
          <h1 id="groups-title">Grupos</h1>
          <p>Organiza tus grupos y consulta sus alumnos vigentes.</p>
        </div>
        <button
          className={styles.primary}
          type="button"
          aria-expanded={isCreating}
          aria-controls={isCreating ? "create-group" : undefined}
          disabled={!canMutate}
          onClick={startCreating}
        >
          <span aria-hidden="true">+</span> Nuevo grupo
        </button>
      </header>

      {actionError && !confirmation && (
        <div
          className={styles.alert}
          role="alert"
          tabIndex={-1}
          ref={focusAlert}
        >
          <p>{actionError.message}</p>
          {actionError.showStudents && (
            <Link href="/alumnos" className={styles.detail}>
              Ir a Alumnos
            </Link>
          )}
        </div>
      )}
      {success && (
        <p className={styles.success} role="status">
          {success}
        </p>
      )}

      {isCreating && (
        <form
          id="create-group"
          className={styles.create}
          onSubmit={submitCreate}
          aria-labelledby="create-group-title"
        >
          <h2 id="create-group-title">Crear grupo</h2>
          <label htmlFor="new-group-name">Nombre del grupo</label>
          <input
            id="new-group-name"
            ref={focusInput}
            required
            maxLength={100}
            value={newGroupName}
            readOnly={isSubmitting}
            onChange={(event) => setNewGroupName(event.target.value)}
          />
          <div className={styles.formActions}>
            <button
              className={styles.secondary}
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsCreating(false);
                setNewGroupName("");
                clearFeedback();
              }}
            >
              Cancelar
            </button>
            <button
              className={styles.primary}
              type="submit"
              disabled={!canMutate || !newGroupName.trim()}
            >
              {isSubmitting ? "Creando…" : "Crear grupo"}
            </button>
          </div>
        </form>
      )}

      <div className={styles.toolbar}>
        <div
          className={styles.filters}
          role="group"
          aria-label="Filtrar grupos por estado"
        >
          {filters.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={archivedFilter === value}
              disabled={!canMutate}
              onClick={() => {
                if (value !== archivedFilter) {
                  clearFeedback();
                  setEditingGroupId(null);
                  setArchivedFilter(value);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {groupsQuery.data && (
          <span className={styles.count} role="status">
            {total} {total === 1 ? "grupo" : "grupos"}
          </span>
        )}
      </div>

      {groupsQuery.isError && (
        <div className={styles.alert} role="alert">
          <p>
            {
              reportError(
                groupsQuery.error,
                "No se pudieron cargar los grupos.",
              ).message
            }
          </p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void groupsQuery.refetch()}
          >
            Reintentar
          </button>
        </div>
      )}

      {groupsQuery.isLoading ? (
        <GroupsLoading />
      ) : (
        groupsQuery.data &&
        (groups.length === 0 ? (
          <div className={styles.empty}>
            <h2>
              {archivedFilter === "archived"
                ? "No hay grupos archivados"
                : "Crea tu primer grupo"}
            </h2>
            {archivedFilter !== "archived" && (
              <>
                <p>
                  Los alumnos aprobados necesitan un grupo activo para recibir
                  asignaciones.
                </p>
                {!isCreating && (
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!canMutate}
                    onClick={startCreating}
                  >
                    Crear un grupo
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className={styles.directory}>
            <table
              className={styles.table}
              role="table"
              aria-label="Directorio de grupos"
            >
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">
                    Nombre del grupo
                  </th>
                  <th role="columnheader" scope="col">
                    Estado
                  </th>
                  <th role="columnheader" scope="col">
                    Alumnos vigentes
                  </th>
                  <th role="columnheader" scope="col">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {groups.map((group) => {
                  const isArchived = Boolean(group.archivedAt);
                  const isEditing = !isArchived && editingGroupId === group.id;
                  const href = `/grupos/${group.id}`;

                  return (
                    <tr key={group.id} role="row">
                      <th role="rowheader" scope="row">
                        {isEditing ? (
                          <form
                            className={styles.rename}
                            onSubmit={(event) => submitRename(event, group.id)}
                          >
                            <label
                              className="sr-only"
                              htmlFor={`edit-group-name-${group.id}`}
                            >
                              Nombre del grupo {group.name}
                            </label>
                            <input
                              id={`edit-group-name-${group.id}`}
                              ref={focusInput}
                              required
                              maxLength={100}
                              value={editingName}
                              readOnly={renameGroupMutation.isPending}
                              onChange={(event) =>
                                setEditingName(event.target.value)
                              }
                            />
                            <div className={styles.formActions}>
                              <button
                                type="button"
                                className={styles.secondary}
                                disabled={!canMutate}
                                onClick={() => {
                                  setEditingGroupId(null);
                                  clearFeedback();
                                }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className={styles.primary}
                                disabled={!canMutate || !editingName.trim()}
                              >
                                {renameGroupMutation.isPending
                                  ? "Guardando…"
                                  : "Guardar"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <Link className={styles.name} href={href}>
                            {group.name}
                          </Link>
                        )}
                      </th>
                      <td role="cell">
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Estado
                        </span>
                        <EditorialBadge tone={isArchived ? "warm" : "ok"}>
                          {isArchived ? "Archivado" : "Activo"}
                        </EditorialBadge>
                      </td>
                      <td role="cell" className={styles.count}>
                        <span className={styles.mobileLabel} aria-hidden="true">
                          Alumnos vigentes
                        </span>
                        {group.activeStudentCount}
                      </td>
                      <td role="cell">
                        <div className={styles.rowActions}>
                          <Link
                            className={styles.detail}
                            href={href}
                            aria-label={`Ver detalle de ${group.name}`}
                          >
                            Ver detalle <span aria-hidden="true">→</span>
                          </Link>
                          {!isArchived && !isEditing && (
                            <button
                              type="button"
                              disabled={!canMutate}
                              onClick={() => {
                                clearFeedback();
                                setIsCreating(false);
                                setEditingGroupId(group.id);
                                setEditingName(group.name);
                              }}
                            >
                              Renombrar
                            </button>
                          )}
                          {!isArchived && (
                            <button
                              type="button"
                              disabled={!canMutate}
                              onClick={() => openConfirmation(group, "archive")}
                            >
                              Archivar
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.danger}
                            disabled={!canMutate}
                            onClick={() => openConfirmation(group, "delete")}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}

      {confirmation && (
        <EditorialConfirmDialog
          isOpen
          title={isDeleting ? "Eliminar grupo" : "Archivar grupo"}
          message={
            isDeleting
              ? `¿Eliminar «${confirmation.group.name}»? Solo se pueden eliminar grupos sin historial.`
              : `¿Archivar «${confirmation.group.name}»? El grupo dejará de estar disponible para nuevas asignaciones y conservará su historial.`
          }
          confirmText={isDeleting ? "Eliminar grupo" : "Archivar grupo"}
          isDestructive={isDeleting}
          isPending={isConfirming}
          onConfirm={confirmGroupAction}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </section>
  );
}
