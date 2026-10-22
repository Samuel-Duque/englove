'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActivitySummary,
  ActivityListResponse,
  ActivityType,
  ActivityStatus,
  Level,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../lib/api';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Rellenar huecos',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

const statusLabels: Record<ActivityStatus, { label: string; color: string }> = {
  [ActivityStatus.draft]: { label: 'Borrador', color: 'bg-zinc-100 text-zinc-800' },
  [ActivityStatus.published]: { label: 'Publicada', color: 'bg-emerald-100 text-emerald-800' },
  [ActivityStatus.archived]: { label: 'Archivada', color: 'bg-amber-100 text-amber-800' },
};

export default function ActivitiesCatalogPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter === 'archived') {
        params.set('status', ActivityStatus.archived);
      } else if (statusFilter === 'active') {
        // Without status, API returns active catalog (draft + published)
      }

      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      if (levelFilter !== 'all') {
        params.set('level', levelFilter);
      }
      params.set('limit', '100');

      const data = await apiFetch<ActivityListResponse>(`/api/v1/activities?${params.toString()}`);
      setActivities(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error al cargar actividades');
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter, levelFilter]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleDuplicate = async (id: string) => {
    setError(null);
    try {
      const duplicated = await apiFetch<ActivitySummary>(`/api/v1/activities/${id}/duplicate`, {
        method: 'POST',
      });
      setActionSuccess('Actividad duplicada exitosamente');
      router.push(`/actividades/${duplicated.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo duplicar la actividad');
    }
  };

  const handleArchive = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api/v1/activities/${id}/archive`, { method: 'POST' });
      setActionSuccess('Actividad archivada exitosamente');
      fetchActivities();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo archivar la actividad');
    }
  };

  const handleRestore = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/api/v1/activities/${id}/restore`, { method: 'POST' });
      setActionSuccess('Actividad restaurada al catálogo');
      fetchActivities();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo restaurar la actividad');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este borrador? Esta acción no se puede deshacer.')) {
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/v1/activities/${id}`, { method: 'DELETE' });
      setActionSuccess('Borrador eliminado exitosamente');
      fetchActivities();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACTIVITY_DELETE_NOT_ALLOWED') {
          setError('No es posible eliminar la actividad: solo se pueden eliminar borradores sin asignaciones.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo eliminar la actividad');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Catálogo de Actividades
          </h1>
          <p className="text-sm text-zinc-600">
            Diseña y gestiona el contenido pedagógico para tus grupos.
          </p>
        </div>
        <Link
          href="/actividades/nueva"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        >
          + Crear actividad
        </Link>
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

      {actionSuccess && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex justify-between items-center"
        >
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Status Tabs */}
          <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-zinc-50 text-xs font-medium">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Catálogo activo
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'archived'
                  ? 'bg-white text-zinc-900 shadow-sm font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Archivadas
            </button>
          </div>

          {/* Type Filter */}
          <label className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
            Tipo:
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los tipos</option>
              <option value={ActivityType.fill_blank}>Rellenar huecos</option>
              <option value={ActivityType.open_question}>Pregunta abierta</option>
              <option value={ActivityType.speaking}>Speaking</option>
              <option value={ActivityType.game}>Microjuego</option>
              <option value={ActivityType.exam}>Examen</option>
            </select>
          </label>

          {/* Level Filter */}
          <label className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
            Nivel:
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los niveles</option>
              <option value={Level.A1}>A1</option>
              <option value={Level.A2}>A2</option>
              <option value={Level.B1}>B1</option>
              <option value={Level.B2}>B2</option>
            </select>
          </label>
        </div>

        <span className="text-xs text-zinc-500">
          {total} actividad{total !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Activity List / Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">
          Cargando catálogo…
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
          {statusFilter === 'active' && typeFilter === 'all' && levelFilter === 'all' ? (
            <div>
              <p className="text-base font-semibold text-zinc-800">
                Aún no tienes actividades
              </p>
              <p className="mt-1 text-sm text-zinc-500 mb-6">
                Crea tu primera actividad para empezar a armar tus clases y asignaciones.
              </p>
              <Link
                href="/actividades/nueva"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Crear mi primera actividad
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-base font-semibold text-zinc-800">
                No encontramos actividades con estos filtros
              </p>
              <p className="mt-1 text-sm text-zinc-500 mb-4">
                Prueba cambiando los criterios de búsqueda o revisa las archivadas.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('active');
                  setTypeFilter('all');
                  setLevelFilter('all');
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((act) => {
            const statusConfig = statusLabels[act.status];

            return (
              <div
                key={act.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-zinc-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-zinc-100 text-zinc-700">
                      Nivel {act.level}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-900 line-clamp-2 mb-1">
                    {act.title}
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">
                    {typeLabels[act.type]} • Versión {act.version}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="border-t border-zinc-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/actividades/${act.id}`}
                      className="font-semibold text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
                    >
                      {act.status === ActivityStatus.archived ? 'Ver' : 'Editar'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(act.id)}
                      className="text-zinc-600 hover:text-zinc-900 focus:outline-none focus:underline"
                    >
                      Duplicar
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {act.status === ActivityStatus.archived ? (
                      <button
                        type="button"
                        onClick={() => handleRestore(act.id)}
                        className="font-medium text-emerald-600 hover:text-emerald-800 focus:outline-none focus:underline"
                      >
                        Restaurar al catálogo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleArchive(act.id)}
                        className="text-amber-700 hover:text-amber-900 focus:outline-none focus:underline"
                      >
                        Archivar
                      </button>
                    )}

                    {act.status === ActivityStatus.draft && (
                      <button
                        type="button"
                        onClick={() => handleDelete(act.id)}
                        className="text-rose-600 hover:text-rose-800 focus:outline-none focus:underline"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
