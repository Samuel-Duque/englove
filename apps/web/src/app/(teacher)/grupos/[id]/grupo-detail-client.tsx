'use client';

import styles from '../../origami-management.module.css';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GroupView,
  GroupViewSchema,
  StudentListResponse,
  StudentListResponseSchema,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../../lib/api';
import { ConfirmDialog } from '../../../../components/ui/modal';

export function GrupoDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Rename modal / inline state
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const groupQuery = useQuery({
    queryKey: ['teacher', 'group', id],
    queryFn: () =>
      apiFetch<GroupView>(`/api/v1/groups/${id}`, {
        schema: GroupViewSchema,
      }),
  });

  const membersQuery = useQuery({
    queryKey: ['teacher', 'group', id, 'members'],
    queryFn: () =>
      apiFetch<StudentListResponse>(`/api/v1/groups/${id}/members?limit=100`, {
        schema: StudentListResponseSchema,
      }),
  });

  useEffect(() => {
    if (groupQuery.data && !isRenaming) {
      setNewName(groupQuery.data.name);
    }
  }, [groupQuery.data, isRenaming]);

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<GroupView>(`/api/v1/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
        schema: GroupViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'group', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({
        queryKey: ['teacher', 'assignments'],
      });
      setIsRenaming(false);
      setSuccess('Grupo renombrado exitosamente.');
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

  const archiveMutation = useMutation({
    mutationFn: () =>
      apiFetch<GroupView>(`/api/v1/groups/${id}/archive`, {
        method: 'POST',
        schema: GroupViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'group', id], updated);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      setSuccess('Grupo archivado exitosamente.');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_HAS_ACTIVE_STUDENTS') {
          setActionError(
            'Este grupo tiene alumnos activos. Para archivarlo, traslada sus alumnos a otro grupo desde su ficha de alumno.',
          );
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('No se pudo archivar el grupo');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      router.push('/grupos');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_HAS_HISTORY') {
          setActionError(
            'No se puede borrar un grupo con historial. Archívalo en su lugar.',
          );
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError('No se pudo eliminar el grupo');
      }
    },
  });

  const handleSaveRename = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setActionError(null);
    setSuccess(null);
    renameMutation.mutate(trimmed);
  };

  const group = groupQuery.data ?? null;
  const members = membersQuery.data?.items ?? [];
  const totalMembers = membersQuery.data?.total ?? 0;
  const isLoading = groupQuery.isLoading || membersQuery.isLoading;

  const handleArchive = () => {
    const activeCount =
      group?.activeStudentCount ?? totalMembers ?? members.length;
    if (activeCount > 0) {
      setActionError(
        `No es posible archivar el grupo: tiene ${activeCount} alumno(s) activo(s) (decisión 96). Traslada los alumnos antes de archivar.`,
      );
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Archivar grupo',
      message: '¿Seguro que deseas archivar este grupo?',
      isDestructive: false,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setActionError(null);
        setSuccess(null);
        archiveMutation.mutate();
      },
    });
  };

  const handleDelete = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar grupo',
      message:
        '¿Seguro que deseas eliminar este grupo? Solo es posible si no tiene historial.',
      isDestructive: true,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        setActionError(null);
        deleteMutation.mutate();
      },
    });
  };

  const error =
    actionError ||
    (groupQuery.error instanceof ApiError
      ? groupQuery.error.message
      : groupQuery.error instanceof Error
        ? groupQuery.error.message
        : null) ||
    (membersQuery.error instanceof ApiError
      ? membersQuery.error.message
      : membersQuery.error instanceof Error
        ? membersQuery.error.message
        : null);

  if (isLoading) {
    return (
      <div role="status" className="origami-state text-center">
        Cargando grupo…
      </div>
    );
  }

  if (!group) {
    const isMissing =
      groupQuery.error instanceof ApiError &&
      groupQuery.error.statusCode === 404;
    return (
      <div className="origami-state origami-state--error space-y-4">
        <h1 className="origami-page-title">
          {isMissing ? 'Grupo no encontrado' : 'No se pudo cargar el grupo'}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/grupos"
            className="origami-button origami-button--secondary"
          >
            Volver a grupos
          </Link>
          {!isMissing && (
            <button
              type="button"
              className="origami-button origami-button--secondary"
              onClick={() => void groupQuery.refetch()}
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  const isArchived = Boolean(group.archivedAt);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--origami-text-secondary)]">
        <Link
          href="/grupos"
          className="hover:text-[var(--origami-text-primary)] underline underline-offset-4"
        >
          Grupos
        </Link>
        <span>/</span>
        <span className="text-[var(--origami-text-primary)] font-medium">
          {group.name}
        </span>
      </div>

      {/* Header & Actions */}
      <div className="flex flex-wrap flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--origami-border-subtle)] pb-5">
        <div>
          {isRenaming ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 mt-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                className="origami-field"
              />
              <button
                type="button"
                onClick={handleSaveRename}
                className="origami-button"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="origami-button origami-button--secondary"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="origami-page-title text-[var(--origami-text-primary)]">
                {group.name}
              </h1>
              {!isArchived && (
                <button
                  type="button"
                  onClick={() => {
                    setNewName(group.name);
                    setIsRenaming(true);
                  }}
                  className="origami-button origami-button--text"
                >
                  (Renombrar)
                </button>
              )}
            </div>
          )}

          <div className="flex min-w-0 flex-wrap items-center gap-3 mt-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isArchived
                  ? 'bg-[var(--origami-warning-bg)] text-[var(--origami-warning-text)]'
                  : 'bg-[var(--origami-success-bg)] text-[var(--origami-success-text)]'
              }`}
            >
              {isArchived ? 'Grupo Archivado' : 'Grupo Activo'}
            </span>
            <span className="text-xs text-[var(--origami-text-secondary)] font-medium">
              {totalMembers} alumno{totalMembers !== 1 ? 's' : ''} activo
              {totalMembers !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/asignaciones?groupId=${id}`}
            className="rounded-lg border border-[var(--origami-border-control)] px-3 py-2 text-xs font-semibold text-[var(--origami-text-secondary)] hover:bg-[var(--origami-surface-soft)] underline underline-offset-4"
          >
            Ver asignaciones
          </Link>
          {!isArchived && (
            <button
              type="button"
              onClick={handleArchive}
              className="origami-button origami-button--secondary text-[var(--origami-warning-text)]"
            >
              Archivar grupo
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            className="origami-button origami-button--secondary text-[var(--origami-error-text)]"
          >
            Eliminar grupo
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
            onClick={() => setActionError(null)}
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

      {/* Members List */}
      <div className="origami-card space-y-4">
        <h2 className="origami-section-title text-[var(--origami-text-primary)] border-b border-[var(--origami-border-subtle)] pb-2">
          Alumnos miembros vigentes ({totalMembers})
        </h2>

        {membersQuery.isError && !membersQuery.data ? (
          <div className="origami-state origami-state--error flex flex-wrap items-center gap-2">
            <p role="alert">No se pudieron cargar los integrantes del grupo.</p>
            <button
              type="button"
              className="origami-button origami-button--secondary"
              onClick={() => void membersQuery.refetch()}
            >
              Reintentar
            </button>
          </div>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--origami-text-secondary)]">
            Este grupo aún no tiene alumnos asignados.
          </p>
        ) : (
          <table
            role="table"
            aria-label="Integrantes del grupo"
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
                  Acción
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup" className={styles.operationalBody}>
              {members.map((member) => (
                <tr
                  role="row"
                  key={member.id}
                  className={
                    styles.operationalRow +
                    ' hover:bg-[var(--origami-surface-soft)]'
                  }
                >
                  <td
                    role="cell"
                    className={styles.cardHeading + ' font-semibold'}
                  >
                    <h3 className="origami-card-title">
                      <Link
                        href={`/alumnos/${member.id}`}
                        className="hover:text-[var(--origami-info-text)] underline underline-offset-4"
                      >
                        {member.name}
                      </Link>
                    </h3>
                  </td>
                  <td
                    role="cell"
                    className={
                      styles.cardField + ' text-[var(--origami-text-secondary)]'
                    }
                  >
                    <span className={styles.mobileLabel} aria-hidden="true">
                      Correo
                    </span>
                    {member.email}
                  </td>
                  <td role="cell" className={styles.cardField}>
                    <span className={styles.mobileLabel} aria-hidden="true">
                      Nivel
                    </span>
                    <span className="flex flex-wrap px-2 py-0.5 rounded text-xs font-bold bg-[var(--origami-surface-raised)]">
                      {member.level ?? 'Sin nivel'}
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
                    {member.ageSegment}
                  </td>
                  <td role="cell" className={styles.cardField}>
                    <span className={styles.mobileLabel} aria-hidden="true">
                      Acción
                    </span>
                    <Link
                      href={`/alumnos/${member.id}`}
                      className="text-xs font-semibold text-[var(--origami-info-text)] hover:text-[var(--origami-info-text)] underline underline-offset-4"
                    >
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
