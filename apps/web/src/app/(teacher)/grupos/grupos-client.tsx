'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GroupView, GroupListResponse } from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { ConfirmDialog } from '../../../components/ui/modal';

export function GruposClient() {
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter: all, active, archived
  const [archivedFilter, setArchivedFilter] = useState<'all' | 'active' | 'archived'>('active');

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
      return apiFetch<GroupListResponse>(`/api/v1/groups?${params.toString()}`);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<GroupView>('/api/v1/groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: (newGroup) => {
      setSuccess(`Grupo "${newGroup.name}" creado exitosamente.`);
      setNewGroupName('');
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
    },
    onError: (err: unknown) => {
      setActionError(err instanceof ApiError ? err.message : 'No se pudo crear el grupo');
    },
  });

  const renameGroupMutation = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      apiFetch<GroupView>(`/api/v1/groups/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: payload.name }),
      }),
    onSuccess: (_, payload) => {
      setSuccess('Grupo renombrado exitosamente.');
      setEditingGroupId(null);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'group', payload.id] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'assignments'] });
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
          setActionError('No se puede borrar un grupo con historial de alumnos o asignaciones. Archívalo en su lugar.');
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
  const error = actionError || (groupsQuery.error instanceof ApiError ? groupsQuery.error.message : groupsQuery.error instanceof Error ? groupsQuery.error.message : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Gestión de Grupos
          </h1>
          <p className="text-sm text-zinc-600">
            Organiza tus aulas temáticas y asigna alumnos a un único grupo vigente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setActionError(null);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        >
          + Crear grupo
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex justify-between items-center"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-800 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex justify-between items-center"
        >
          <span>{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Create Group Form Card */}
      {isCreating && (
        <form
          onSubmit={handleCreateGroup}
          className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900">Crear nuevo grupo</h2>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-zinc-500 hover:text-zinc-700 font-medium"
            >
              Cancelar
            </button>
          </div>

          <div>
            <label htmlFor="new-group-name" className="block text-xs font-semibold text-zinc-700 mb-1">
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
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newGroupName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creando…' : 'Crear grupo'}
            </button>
          </div>
        </form>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-zinc-50 text-xs font-medium">
          <button
            type="button"
            onClick={() => setArchivedFilter('active')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              archivedFilter === 'active'
                ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Grupos activos
          </button>
          <button
            type="button"
            onClick={() => setArchivedFilter('archived')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              archivedFilter === 'archived'
                ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Archivados
          </button>
          <button
            type="button"
            onClick={() => setArchivedFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              archivedFilter === 'all'
                ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Todos
          </button>
        </div>

        <span className="text-xs text-zinc-500 font-medium">
          {total} grupo{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Group List */}
      {isLoading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">
          Cargando grupos…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
          <p className="text-base font-semibold text-zinc-800">
            Crea tu primer grupo para aprobar solicitudes
          </p>
          <p className="mt-1 text-sm text-zinc-500 mb-6">
            Los alumnos aprobados requieren pertenecer a un grupo activo para recibir asignaciones.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setActionError(null);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + Crear mi primer grupo
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider"
                >
                  Nombre del grupo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider"
                >
                  Estado
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider"
                >
                  Alumnos vigentes
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wider"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {groups.map((group) => {
                const isArchived = Boolean(group.archivedAt);
                const isEditingThis = editingGroupId === group.id;

                return (
                  <tr key={group.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">
                      {isEditingThis ? (
                        <div className="flex items-center gap-2">
                          <input
                            id={`edit-group-name-${group.id}`}
                            aria-label={`Editar nombre del grupo ${group.name}`}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(group.id)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupId(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <Link
                          href={`/grupos/${group.id}`}
                          className="hover:text-blue-600 font-semibold"
                        >
                          {group.name}
                        </Link>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isArchived
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isArchived ? 'Archivado' : 'Activo'}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600">
                      <Link
                        href={`/grupos/${group.id}`}
                        className="text-zinc-800 hover:text-blue-600 font-medium"
                      >
                        {group.activeStudentCount} alumno{group.activeStudentCount !== 1 ? 's' : ''}
                      </Link>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-3">
                      <Link
                        href={`/grupos/${group.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ver miembros
                      </Link>

                      {!isArchived && !isEditingThis && (
                        <button
                          type="button"
                          onClick={() => handleStartRename(group)}
                          className="text-zinc-600 hover:text-zinc-900"
                        >
                          Renombrar
                        </button>
                      )}

                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => handleArchive(group)}
                          className="text-amber-700 hover:text-amber-900"
                        >
                          Archivar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(group)}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        Eliminar
                      </button>
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
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
