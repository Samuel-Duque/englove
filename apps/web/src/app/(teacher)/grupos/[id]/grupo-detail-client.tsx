'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GroupView, StudentListResponse } from '@englove/shared';
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
    queryFn: () => apiFetch<GroupView>(`/api/v1/groups/${id}`),
  });

  const membersQuery = useQuery({
    queryKey: ['teacher', 'group', id, 'members'],
    queryFn: () => apiFetch<StudentListResponse>(`/api/v1/groups/${id}/members?limit=100`),
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
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['teacher', 'group', id], updated);
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'groups'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'students'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher', 'assignments'] });
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
          setActionError('No se puede borrar un grupo con historial. Archívalo en su lugar.');
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
    const activeCount = group?.activeStudentCount ?? totalMembers ?? members.length;
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
      message: '¿Seguro que deseas eliminar este grupo? Solo es posible si no tiene historial.',
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
    (groupQuery.error instanceof ApiError ? groupQuery.error.message : groupQuery.error instanceof Error ? groupQuery.error.message : null) ||
    (membersQuery.error instanceof ApiError ? membersQuery.error.message : membersQuery.error instanceof Error ? membersQuery.error.message : null);

  if (isLoading) {
    return <div className="py-12 text-center text-zinc-500 text-sm">Cargando grupo…</div>;
  }

  if (!group) {
    return (
      <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-6 text-center text-rose-800">
        {error || 'Grupo no encontrado'}
      </div>
    );
  }

  const isArchived = Boolean(group.archivedAt);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/grupos" className="hover:text-zinc-900">
          Grupos
        </Link>
        <span>/</span>
        <span className="text-zinc-800 font-medium truncate">{group.name}</span>
      </div>

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          {isRenaming ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-base font-semibold text-zinc-900"
              />
              <button
                type="button"
                onClick={handleSaveRename}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{group.name}</h1>
              {!isArchived && (
                <button
                  type="button"
                  onClick={() => {
                    setNewName(group.name);
                    setIsRenaming(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  (Renombrar)
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isArchived ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isArchived ? 'Grupo Archivado' : 'Grupo Activo'}
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              {totalMembers} alumno{totalMembers !== 1 ? 's' : ''} activo{totalMembers !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/asignaciones?groupId=${id}`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Ver asignaciones
          </Link>
          {!isArchived && (
            <button
              type="button"
              onClick={handleArchive}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50"
            >
              Archivar grupo
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            Eliminar grupo
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex justify-between items-center"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-600 font-bold ml-4">
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
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-600 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-zinc-900 border-b border-zinc-100 pb-2">
          Alumnos miembros vigentes ({totalMembers})
        </h2>

        {members.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            Este grupo aún no tiene alumnos asignados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase">
                    Nombre
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase">
                    Correo
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase">
                    Nivel
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-600 uppercase">
                    Segmento
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-zinc-600 uppercase">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                      <Link href={`/alumnos/${member.id}`} className="hover:text-blue-600">
                        {member.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{member.email}</td>
                    <td className="px-4 py-3 text-sm text-zinc-800">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-zinc-100">
                        {member.level ?? 'Sin nivel'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 capitalize">
                      {member.ageSegment}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <Link
                        href={`/alumnos/${member.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
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
