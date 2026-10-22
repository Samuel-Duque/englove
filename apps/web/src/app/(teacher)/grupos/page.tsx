'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { GroupView, GroupListResponse } from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupView[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter: all, active, archived
  const [archivedFilter, setArchivedFilter] = useState<'all' | 'active' | 'archived'>('active');

  // Modal / Form state for creating group
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rename state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (archivedFilter === 'active') params.set('archived', 'false');
      else if (archivedFilter === 'archived') params.set('archived', 'true');
      params.set('limit', '100');

      const data = await apiFetch<GroupListResponse>(`/api/v1/groups?${params.toString()}`);
      setGroups(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Error al cargar grupos');
    } finally {
      setIsLoading(false);
    }
  }, [archivedFilter]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<GroupView>('/api/v1/groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setSuccess(`Grupo "${name}" creado exitosamente.`);
      setNewGroupName('');
      setIsCreating(false);
      fetchGroups();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo crear el grupo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRename = (group: GroupView) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleSaveRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;

    setError(null);
    setSuccess(null);
    try {
      await apiFetch<GroupView>(`/api/v1/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setSuccess('Grupo renombrado exitosamente.');
      setEditingGroupId(null);
      fetchGroups();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_ARCHIVED') {
          setError('No es posible renombrar un grupo archivado.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo renombrar el grupo');
      }
    }
  };

  const handleArchive = async (group: GroupView) => {
    if (group.activeStudentCount > 0) {
      setError(
        `No es posible archivar el grupo "${group.name}": tiene ${group.activeStudentCount} alumno(s) activo(s). Traslada los alumnos antes de archivar (decisión 96).`,
      );
      return;
    }

    if (!window.confirm(`¿Seguro que deseas archivar el grupo "${group.name}"?`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await apiFetch<GroupView>(`/api/v1/groups/${group.id}/archive`, {
        method: 'POST',
      });
      setSuccess(`Grupo "${group.name}" archivado exitosamente.`);
      fetchGroups();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_HAS_ACTIVE_STUDENTS') {
          setError('No es posible archivar un grupo con alumnos activos.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo archivar el grupo');
      }
    }
  };

  const handleDelete = async (group: GroupView) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el grupo "${group.name}"? Esta acción solo se permite si el grupo no tiene historial.`)) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/api/v1/groups/${group.id}`, { method: 'DELETE' });
      setSuccess(`Grupo "${group.name}" eliminado exitosamente.`);
      fetchGroups();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'GROUP_HAS_HISTORY') {
          setError('No se puede borrar un grupo con historial de alumnos o asignaciones. Archívalo en su lugar.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo eliminar el grupo');
      }
    }
  };

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
            setError(null);
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
            onClick={() => setError(null)}
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
              setError(null);
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
    </div>
  );
}
