'use client';

import styles from '../origami-management.module.css';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GroupView,
  GroupViewSchema,
  GroupListResponse,
  GroupListResponseSchema,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { ConfirmDialog } from '../../../components/ui/modal';

export function GruposClient() {
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter: all, active, archived
  const [archivedFilter, setArchivedFilter] = useState<
    'all' | 'active' | 'archived'
  >('active');

  // Modal / Form state for creating group
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Rename state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const groupsQuery = useQuery({
    queryKey: ['teacher', 'groups', archivedFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (archivedFilter === 'active') params.set('archived', 'false');
      else if (archivedFilter === 'archived') params.set('archived', 'true');
      params.set('limit', '100');
      return apiFetch<GroupListResponse>(
        `/api/v1/groups?${params.toString()}`,
        {
          schema: GroupListResponseSchema,
        },
      );
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<GroupView>('/api/v1/groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
        schema: GroupViewSchema,
      }),
    onSuccess: (newGroup) => {
      setSuccess(`Grupo "${newGroup.name}" creado exitosamente.`);
      setNewGroupName('');
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
    },
    onError: (err: unknown) => {
      setActionError(
        err instanceof ApiError ? err.message : 'No se pudo crear el grupo',
      );
    },
  });

  const renameGroupMutation = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      apiFetch<GroupView>(`/api/v1/groups/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: payload.name }),
        schema: GroupViewSchema,
      }),
    onSuccess: (_, payload) => {
      setSuccess('Grupo renombrado exitosamente.');
      setEditingGroupId(null);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      void queryClient.invalidateQueries({
        queryKey: ['teacher', 'group', payload.id],
      });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({
        queryKey: ['teacher', 'assignments'],
      });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_ARCHIVED') {
          setActionError('No es posible renombrar un grupo archivado.');
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('No se pudo renombrar el grupo');
      }
    },
  });

  const archiveGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<GroupView>(`/api/v1/groups/${groupId}/archive`, {
        method: 'POST',
        schema: GroupViewSchema,
      }),
    onSuccess: (updated) => {
      setSuccess(`Grupo "${updated.name}" archivado exitosamente.`);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_HAS_ACTIVE_STUDENTS') {
          setActionError(
            'No es posible archivar un grupo con alumnos activos. Traslada sus alumnos a otro grupo antes de archivar.',
          );
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('No se pudo archivar el grupo');
      }
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      apiFetch(`/api/v1/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_HAS_HISTORY') {
          setActionError(
            'No se puede borrar un grupo con historial de alumnos o asignaciones. Archívalo en su lugar.',
          );
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('No se pudo eliminar el grupo');
      }
    },
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    setActionError(null);
    setSuccess(null);
    createGroupMutation.mutate(name);
  };

  const isSubmitting = createGroupMutation.isPending;

  const handleStartRename = (group: GroupView) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleSaveRename = (id: string) => {
    const name = editingName.trim();
    if (!name) return;

    setActionError(null);
    setSuccess(null);
    renameGroupMutation.mutate({ id, name });
  };

  const handleArchive = (group: GroupView) => {
    if (group.activeStudentCount > 0) {
      setActionError(
        `No es posible archivar el grupo "${group.name}": tiene ${group.activeStudentCount} alumno(s) activo(s). Traslada los alumnos antes de archivar (decisión 96).`,
      );
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Archivar grupo',
      message: `¿Seguro que deseas archivar el grupo "${group.name}"?`,
      isDestructive: false,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setActionError(null);
        setSuccess(null);
        archiveGroupMutation.mutate(group.id);
      },
    });
  };

  const handleDelete = (group: GroupView) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar grupo',
      message: `¿Seguro que deseas eliminar el grupo "${group.name}"? Esta acción solo se permite si el grupo no tiene historial.`,
      isDestructive: true,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setActionError(null);
        setSuccess(null);
        deleteGroupMutation.mutate(group.id, {
          onSuccess: () => {
            setSuccess(`Grupo "${group.name}" eliminado exitosamente.`);
          },
        });
      },
    });
  };

  const groups = groupsQuery.data?.items ?? [];
  const total = groupsQuery.data?.total ?? 0;
  const isLoading = groupsQuery.isLoading;
  const error = actionError || groupsQuery.error?.message;

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="origami-page-title text-[var(--origami-text-primary)]">
            Gestión de Grupos
          </h1>
          <p className="text-sm text-[var(--origami-text-secondary)]">
            Organiza tus aulas temáticas y asigna alumnos a un único grupo
            vigente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setActionError(null);
          }}
          className="origami-button"
        >
          + Crear grupo
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="origami-state origami-state--error flex flex-wrap justify-between items-center gap-2"
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
              onClick={() => void groupsQuery.refetch()}
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

      {/* Create Group Form Card */}
      {isCreating && (
        <form
          onSubmit={handleCreateGroup}
          className="rounded-xl border border-[var(--origami-border-subtle)] bg-[var(--origami-info-bg)] p-5 space-y-4"
        >
          <div className="flex min-w-0 flex-wrap items-center justify-between">
            <h2 className="origami-section-title text-[var(--origami-text-primary)]">
              Crear nuevo grupo
            </h2>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="origami-button origami-button--text"
            >
              Cancelar
            </button>
          </div>

          <div>
            <label
              htmlFor="new-group-name"
              className="origami-label block mb-1"
            >
              Nombre del grupo *
            </label>
            <input
              id="new-group-name"
              type="text"
              required
              maxLength={100}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ej. Primaria 3A - Martes y Jueves"
              className="origami-field"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="origami-button origami-button--secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newGroupName.trim()}
              className="origami-button"
            >
              {isSubmitting ? 'Creando…' : 'Crear grupo'}
            </button>
          </div>
        </form>
      )}

      {/* Filters Bar */}
      <div className="origami-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            aria-pressed={archivedFilter === 'active'}
            type="button"
            onClick={() => setArchivedFilter('active')}
            className={
              'origami-button origami-button--secondary' +
              (archivedFilter === 'active' ? ' origami-selected' : '')
            }
          >
            Grupos activos
          </button>
          <button
            aria-pressed={archivedFilter === 'archived'}
            type="button"
            onClick={() => setArchivedFilter('archived')}
            className={
              'origami-button origami-button--secondary' +
              (archivedFilter === 'archived' ? ' origami-selected' : '')
            }
          >
            Archivados
          </button>
          <button
            aria-pressed={archivedFilter === 'all'}
            type="button"
            onClick={() => setArchivedFilter('all')}
            className={
              'origami-button origami-button--secondary' +
              (archivedFilter === 'all' ? ' origami-selected' : '')
            }
          >
            Todos
          </button>
        </div>

        <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
          {total} grupo{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Group List */}
      {isLoading ? (
        <div role="status" className="origami-state text-center">
          Cargando grupos…
        </div>
      ) : groupsQuery.isError && !groupsQuery.data ? null : groups.length ===
        0 ? (
        <div className="origami-card text-center">
          {archivedFilter === 'archived' ? (
            <p className="origami-section-title">No hay grupos archivados</p>
          ) : (
            <>
              <p className="origami-section-title">
                No hay grupos{' '}
                {archivedFilter === 'active' ? 'activos' : 'registrados'}
              </p>
              <p className="origami-meta mt-1 mb-4">
                Los alumnos aprobados requieren pertenecer a un grupo activo
                para recibir asignaciones.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setActionError(null);
                }}
                className="origami-button"
              >
                Crear grupo
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="origami-card">
          <table
            role="table"
            aria-label="Grupos"
            className={styles.operationalTable}
          >
            <thead role="rowgroup" className={styles.operationalHead}>
              <tr role="row">
                <th
                  role="columnheader"
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-[var(--origami-text-secondary)]"
                >
                  Nombre del grupo
                </th>
                <th
                  role="columnheader"
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-[var(--origami-text-secondary)]"
                >
                  Estado
                </th>
                <th
                  role="columnheader"
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-[var(--origami-text-secondary)]"
                >
                  Alumnos vigentes
                </th>
                <th
                  role="columnheader"
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-semibold text-[var(--origami-text-secondary)]"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className={styles.operationalBody}>
              {groups.map((group) => {
                const isArchived = Boolean(group.archivedAt);
                const isEditingThis = editingGroupId === group.id;

                return (
                  <tr
                    role="row"
                    key={group.id}
                    className={
                      styles.operationalRow +
                      ' hover:bg-[var(--origami-surface-soft)] transition-colors'
                    }
                  >
                    <td role="cell" className={styles.cardHeading}>
                      {isEditingThis ? (
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <input
                            id={`edit-group-name-${group.id}`}
                            aria-label={`Editar nombre del grupo ${group.name}`}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="origami-field"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(group.id)}
                            className="origami-button origami-button--text"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupId(null)}
                            className="origami-button origami-button--text"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <h2 className="origami-card-title">
                          <Link
                            href={`/grupos/${group.id}`}
                            className="hover:text-[var(--origami-info-text)] font-semibold underline underline-offset-4"
                          >
                            {group.name}
                          </Link>
                        </h2>
                      )}
                    </td>

                    <td role="cell" className={styles.cardField}>
                      <span className={styles.mobileLabel} aria-hidden="true">
                        Estado
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isArchived
                            ? 'bg-[var(--origami-warning-bg)] text-[var(--origami-warning-text)]'
                            : 'bg-[var(--origami-success-bg)] text-[var(--origami-success-text)]'
                        }`}
                      >
                        {isArchived ? 'Archivado' : 'Activo'}
                      </span>
                    </td>

                    <td
                      role="cell"
                      className={
                        styles.cardField +
                        ' text-[var(--origami-text-secondary)]'
                      }
                    >
                      <span className={styles.mobileLabel} aria-hidden="true">
                        Alumnos vigentes
                      </span>
                      <Link
                        href={`/grupos/${group.id}`}
                        className="text-[var(--origami-text-primary)] hover:text-[var(--origami-info-text)] font-medium underline underline-offset-4"
                      >
                        {group.activeStudentCount} alumno
                        {group.activeStudentCount !== 1 ? 's' : ''}
                      </Link>
                    </td>

                    <td role="cell" className={styles.cardActions}>
                      <span className={styles.mobileLabel} aria-hidden="true">
                        Acciones
                      </span>
                      <div className={styles.rowActions}>
                        <Link
                          href={`/grupos/${group.id}`}
                          className="text-[var(--origami-info-text)] hover:text-[var(--origami-info-text)] underline underline-offset-4"
                        >
                          Ver miembros
                        </Link>

                        {!isArchived && !isEditingThis && (
                          <button
                            type="button"
                            onClick={() => handleStartRename(group)}
                            className="origami-button origami-button--text"
                          >
                            Renombrar
                          </button>
                        )}

                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() => handleArchive(group)}
                            className="origami-button origami-button--text text-[var(--origami-warning-text)]"
                          >
                            Archivar
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(group)}
                          className="origami-button origami-button--text text-[var(--origami-error-text)]"
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
      )}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={confirmDialog.isDestructive}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
}
