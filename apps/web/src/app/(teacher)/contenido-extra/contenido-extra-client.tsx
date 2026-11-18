'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ExternalResourceItem,
  ExternalResourceItemSchema,
  ExternalResourceListResponse,
  ExternalResourceListResponseSchema,
  FeatureFlagsResponse,
  FeatureFlagsResponseSchema,
  isValidHttpsResourceUrl,
  Level,
} from '@upward-english/shared';
import { apiFetch, ApiError } from '../../../lib/api';
import { AccessibleModal, ConfirmDialog } from '../../../components/ui/modal';

function isLevel(val: string): val is Level {
  return (
    val === Level.A1 || val === Level.A2 || val === Level.B1 || val === Level.B2
  );
}

export function ContenidoExtraClient() {
  const queryClient = useQueryClient();

  // Filters
  const [levelFilter, setLevelFilter] = useState<
    'todos' | 'general' | 'A1' | 'A2' | 'B1' | 'B2'
  >('todos');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResource, setEditingResource] =
    useState<ExternalResourceItem | null>(null);
  const [deletingResource, setDeletingResource] =
    useState<ExternalResourceItem | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formLevel, setFormLevel] = useState<Level | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formUrlError, setFormUrlError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // 1. Feature flag query
  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () =>
      apiFetch<FeatureFlagsResponse>('/api/v1/feature-flags', {
        schema: FeatureFlagsResponseSchema,
      }),
  });

  const isExtraContentEnabled = Boolean(flagsQuery.data?.flags?.extra_content);

  // 2. Resources query
  const resourcesUrl =
    levelFilter === 'todos'
      ? '/api/v1/resources'
      : `/api/v1/resources?level=${levelFilter}`;

  const resourcesQuery = useQuery({
    queryKey: ['resources', levelFilter],
    queryFn: () =>
      apiFetch<ExternalResourceListResponse>(resourcesUrl, {
        schema: ExternalResourceListResponseSchema,
      }),
  });

  // 3. Toggle feature flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<FeatureFlagsResponse>('/api/v1/feature-flags/extra_content', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
        schema: FeatureFlagsResponseSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else
        setServerError('No se pudo actualizar la visibilidad de la sección.');
    },
  });

  // 4. Create resource mutation
  const createResourceMutation = useMutation({
    mutationFn: (data: {
      title: string;
      url: string;
      description?: string | null;
      level?: Level | null;
    }) =>
      apiFetch<ExternalResourceItem>('/api/v1/resources', {
        method: 'POST',
        body: JSON.stringify(data),
        schema: ExternalResourceItemSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      closeForm();
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError('Error al crear el recurso.');
    },
  });

  // 5. Update resource mutation
  const updateResourceMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        title?: string;
        url?: string;
        description?: string | null;
        level?: Level | null;
      };
    }) =>
      apiFetch<ExternalResourceItem>(`/api/v1/resources/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        schema: ExternalResourceItemSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      closeForm();
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError('Error al actualizar el recurso.');
    },
  });

  // 6. Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/resources/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      setDeletingResource(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError('Error al eliminar el recurso.');
    },
  });

  // 7. Reorder resources mutation
  const reorderMutation = useMutation({
    mutationFn: (resourceIds: string[]) =>
      apiFetch<ExternalResourceListResponse>('/api/v1/resources/reorder', {
        method: 'PUT',
        body: JSON.stringify({ resourceIds }),
        schema: ExternalResourceListResponseSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError('Error al reordenar los recursos.');
    },
  });

  const openCreateForm = () => {
    setEditingResource(null);
    setFormTitle('');
    setFormUrl('');
    setFormLevel('');
    setFormDescription('');
    setFormUrlError(null);
    setServerError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: ExternalResourceItem) => {
    setEditingResource(item);
    setFormTitle(item.title);
    setFormUrl(item.url);
    setFormLevel(item.level ?? '');
    setFormDescription(item.description ?? '');
    setFormUrlError(null);
    setServerError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingResource(null);
    setFormUrlError(null);
    setServerError(null);
  };

  // Focus trap / escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFormOpen) closeForm();
        if (deletingResource) setDeletingResource(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, deletingResource]);

  useEffect(() => {
    if (isFormOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isFormOpen]);

  useEffect(() => {
    if (deletingResource) {
      setTimeout(() => cancelDeleteRef.current?.focus(), 50);
    }
  }, [deletingResource]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormUrlError(null);
    setServerError(null);

    const trimmedUrl = formUrl.trim();
    if (
      !trimmedUrl.toLowerCase().startsWith('https://') ||
      !isValidHttpsResourceUrl(trimmedUrl)
    ) {
      setFormUrlError('Ingresa un enlace válido que comience con https://');
      return;
    }

    const normalizedUrl = trimmedUrl.replace(/^https:\/\//i, 'https://');

    const payload = {
      title: formTitle.trim(),
      url: normalizedUrl,
      level: formLevel || null,
      description: formDescription.trim() ? formDescription.trim() : null,
    };

    if (editingResource) {
      updateResourceMutation.mutate({ id: editingResource.id, data: payload });
    } else {
      createResourceMutation.mutate(payload);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const items = resourcesQuery.data?.items;
    if (!items || levelFilter !== 'todos') return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const currentItem = newItems[index];
    const targetItem = newItems[targetIndex];
    if (!currentItem || !targetItem) return;

    newItems[index] = targetItem;
    newItems[targetIndex] = currentItem;

    const ids = newItems.map((r) => r.id);
    reorderMutation.mutate(ids);
  };

  const getHostname = (rawUrl: string): string => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return 'enlace externo';
    }
  };

  const items = resourcesQuery.data?.items ?? [];
  const isLoading = resourcesQuery.isLoading;

  return (
    <div className="space-y-6 min-w-0">
      {/* Banner when extra_content is disabled (RF-3, RF-4) */}
      {!isExtraContentEnabled && flagsQuery.isSuccess && (
        <div
          role="status"
          className="origami-state origami-state--warning flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              🔒
            </span>
            <div>
              <p className="text-sm font-bold">
                Sección oculta para los estudiantes
              </p>
              <p className="text-xs text-[var(--origami-warning-text)]">
                Puedes preparar los enlaces y activarla cuando estés lista.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleFlagMutation.mutate(true)}
            disabled={toggleFlagMutation.isPending}
            className="origami-button"
          >
            {toggleFlagMutation.isPending
              ? 'Activando…'
              : 'Habilitar sección para estudiantes'}
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-wrap flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--origami-border-subtle)] pb-5">
        <div>
          <h1 className="origami-page-title text-[var(--origami-text-primary)]">
            Contenido extra
          </h1>
          <p className="text-sm text-[var(--origami-text-secondary)] mt-1">
            Enlaces externos verificados para práctica y profundización fuera
            del flujo evaluable.
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {/* Toggle button */}
          <button
            type="button"
            onClick={() => toggleFlagMutation.mutate(!isExtraContentEnabled)}
            disabled={toggleFlagMutation.isPending || !flagsQuery.isSuccess}
            aria-pressed={isExtraContentEnabled}
            className={
              'origami-button origami-button--secondary' +
              (isExtraContentEnabled ? ' origami-selected' : '')
            }
          >
            {isExtraContentEnabled
              ? '✓ Visible para estudiantes'
              : '○ Oculto para estudiantes'}
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="origami-button"
          >
            + Nuevo enlace
          </button>
        </div>
      </div>

      {serverError && (
        <div role="alert" className="origami-state origami-state--error">
          {serverError}
        </div>
      )}

      {flagsQuery.isError && (
        <div className="origami-state origami-state--error flex flex-wrap items-center justify-between gap-2">
          <p role="alert">No se pudo consultar la visibilidad de la sección.</p>
          <button
            type="button"
            onClick={() => void flagsQuery.refetch()}
            className="origami-button origami-button--secondary"
          >
            Reintentar visibilidad
          </button>
        </div>
      )}

      {/* Level Filters */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="toolbar"
        aria-label="Filtro por nivel MCER"
      >
        <span className="text-xs font-bold text-[var(--origami-text-secondary)] mr-1">
          Filtrar por nivel:
        </span>
        {(['todos', 'general', 'A1', 'A2', 'B1', 'B2'] as const).map((lvl) => {
          const isActive = levelFilter === lvl;
          const label =
            lvl === 'todos'
              ? 'Todos'
              : lvl === 'general'
                ? 'General'
                : `Nivel ${lvl}`;
          return (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              aria-pressed={isActive}
              className={
                'origami-button origami-button--secondary' +
                (isActive ? ' origami-selected' : '')
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {levelFilter !== 'todos' && items.length > 1 && (
        <p className="text-xs text-[var(--origami-text-secondary)] italic">
          * Nota: El reordenamiento manual requiere seleccionar el filtro
          «Todos» para ordenar el catálogo completo.
        </p>
      )}

      {/* Content List */}
      {isLoading ? (
        <div
          role="status"
          className="origami-state py-16 text-center text-sm font-medium text-[var(--origami-text-secondary)]"
        >
          Cargando recursos externos…
        </div>
      ) : resourcesQuery.isError && !resourcesQuery.data ? (
        <div className="origami-state origami-state--error flex flex-wrap items-center justify-between gap-2">
          <p role="alert">No se pudo cargar el catálogo de recursos.</p>
          <button
            type="button"
            onClick={() => void resourcesQuery.refetch()}
            className="origami-button origami-button--secondary"
          >
            Reintentar catálogo
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--origami-border-control)] bg-[var(--origami-surface-soft)] p-12 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--origami-surface-raised)] text-3xl">
            🔗
          </div>
          <div className="space-y-1">
            <h2 className="origami-section-title text-[var(--origami-text-primary)]">
              Aún no has publicado enlaces de contenido extra.
            </h2>
            <p className="text-xs text-[var(--origami-text-secondary)] max-w-sm mx-auto">
              Agrega enlaces a Educaplay, videos educativos o diccionarios para
              que los alumnos practiquen libremente.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="origami-button"
          >
            Agregar primer enlace
          </button>
        </div>
      ) : (
        <ul
          className="space-y-3"
          aria-label="Lista de recursos de contenido extra"
        >
          {items.map((item, index) => {
            const domain = getHostname(item.url);
            const canMoveUp =
              levelFilter === 'todos' &&
              index > 0 &&
              !reorderMutation.isPending;
            const canMoveDown =
              levelFilter === 'todos' &&
              index < items.length - 1 &&
              !reorderMutation.isPending;

            return (
              <li
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[var(--origami-border-subtle)] bg-[var(--origami-surface)] p-4 hover:border-[var(--origami-border-control)] transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--origami-surface-raised)] text-xs font-bold text-[var(--origami-text-secondary)]">
                    {index + 1}
                  </span>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="origami-card-title text-[var(--origami-text-primary)]">
                        {item.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.level
                            ? 'bg-[var(--origami-info-bg)] text-[var(--origami-info-text)]'
                            : 'bg-[var(--origami-success-bg)] text-[var(--origami-success-text)]'
                        }`}
                      >
                        {item.level ? `Nivel ${item.level}` : 'General'}
                      </span>
                      <span className="text-xs text-[var(--origami-text-secondary)]">
                        ({domain})
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-[var(--origami-text-secondary)] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {/* Reorder Buttons (RF-4) */}
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'up')}
                    disabled={!canMoveUp}
                    title="Subir posición"
                    aria-label={`Subir enlace ${item.title}`}
                    className="origami-button origami-button--secondary"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'down')}
                    disabled={!canMoveDown}
                    title="Bajar posición"
                    aria-label={`Bajar enlace ${item.title}`}
                    className="origami-button origami-button--secondary"
                  >
                    ▼
                  </button>

                  {/* Open Link (RF-6) */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-wrap items-center justify-center min-h-[48px] min-w-[48px] px-3 rounded-xl border border-[var(--origami-border-subtle)] text-xs font-bold text-[var(--origami-text-secondary)] hover:bg-[var(--origami-surface-raised)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--origami-focus)] focus-visible:outline-[var(--origami-focus)]"
                  >
                    Abrir ↗
                  </a>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    className="origami-button origami-button--secondary"
                  >
                    Editar
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setDeletingResource(item)}
                    className="origami-button origami-button--secondary text-[var(--origami-error-text)]"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal Form: Create / Edit (RF-1, RF-4) */}
      <AccessibleModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingResource(null);
          setServerError(null);
        }}
        title={editingResource ? 'Editar enlace' : 'Nuevo enlace'}
      >
        {serverError && (
          <div role="alert" className="origami-state origami-state--error">
            {serverError}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="form-title"
              className="origami-label block font-bold mb-1"
            >
              Título del recurso *
            </label>
            <input
              id="form-title"
              ref={firstInputRef}
              type="text"
              required
              maxLength={160}
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Ej: Animals & Colors Memory Game"
              className="origami-field"
            />
          </div>

          <div>
            <label
              htmlFor="form-url"
              className="origami-label block font-bold mb-1"
            >
              Enlace externo (debe comenzar con https://) *
            </label>
            <input
              aria-invalid={Boolean(formUrlError)}
              aria-describedby={formUrlError ? 'resource-url-error' : undefined}
              id="form-url"
              type="url"
              required
              maxLength={2048}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={formUrl}
              onChange={(e) => {
                setFormUrl(e.target.value);
                if (formUrlError) setFormUrlError(null);
              }}
              placeholder="https://es.educaplay.com/..."
              className="origami-field"
            />
            {formUrlError && (
              <p
                id="resource-url-error"
                className="text-xs font-bold text-[var(--origami-error-text)] mt-1"
                role="alert"
              >
                {formUrlError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="form-level"
              className="origami-label block font-bold mb-1"
            >
              Nivel de visibilidad
            </label>
            <select
              id="form-level"
              value={formLevel}
              onChange={(e) => {
                const v = e.target.value;
                setFormLevel(isLevel(v) ? v : '');
              }}
              className="origami-field"
            >
              <option value="">General (todos los niveles)</option>
              <option value="A1">Nivel A1</option>
              <option value="A2">Nivel A2</option>
              <option value="B1">Nivel B1</option>
              <option value="B2">Nivel B2</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="form-description"
              className="origami-label block font-bold mb-1"
            >
              Descripción u orientación (opcional)
            </label>
            <textarea
              id="form-description"
              rows={3}
              maxLength={500}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Instrucciones breves o consigna para el alumno…"
              className="origami-field"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="origami-button origami-button--secondary w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                createResourceMutation.isPending ||
                updateResourceMutation.isPending
              }
              className="origami-button w-full sm:w-auto"
            >
              {createResourceMutation.isPending ||
              updateResourceMutation.isPending
                ? 'Guardando…'
                : editingResource
                  ? 'Guardar cambios'
                  : 'Crear enlace'}
            </button>
          </div>
        </form>
      </AccessibleModal>

      {/* Modal: Delete Confirmation (RF-4) */}
      <ConfirmDialog
        isOpen={Boolean(deletingResource)}
        title="¿Eliminar enlace?"
        message={`¿Eliminar el enlace "${deletingResource?.title ?? ''}"? Dejará de aparecer en el portal inmediatamente.`}
        confirmText={
          deleteResourceMutation.isPending ? 'Eliminando…' : 'Eliminar enlace'
        }
        cancelText="Cancelar"
        isDestructive={true}
        onConfirm={() => {
          if (deletingResource) {
            deleteResourceMutation.mutate(deletingResource.id);
          }
        }}
        onCancel={() => setDeletingResource(null)}
      />
    </div>
  );
}
