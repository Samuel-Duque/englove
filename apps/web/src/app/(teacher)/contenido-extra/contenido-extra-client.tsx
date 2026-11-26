"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalResourceItem,
  ExternalResourceItemSchema,
  ExternalResourceListResponse,
  ExternalResourceListResponseSchema,
  FeatureFlagsResponse,
  FeatureFlagsResponseSchema,
  isValidHttpsResourceUrl,
  Level,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../lib/api";
import { AccessibleModal, ConfirmDialog } from "../../../components/ui/modal";
import { ErrorState } from "../../../components/error-state";
import styles from "./contenido-extra.module.css";

const RESOURCE_LIMIT = 200;

function isLevel(val: string): val is Level {
  return (
    val === Level.A1 || val === Level.A2 || val === Level.B1 || val === Level.B2
  );
}

export function ContenidoExtraClient() {
  const queryClient = useQueryClient();

  // Filters
  const [levelFilter, setLevelFilter] = useState<
    "todos" | "general" | "A1" | "A2" | "B1" | "B2"
  >("todos");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResource, setEditingResource] =
    useState<ExternalResourceItem | null>(null);
  const [deletingResource, setDeletingResource] =
    useState<ExternalResourceItem | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formLevel, setFormLevel] = useState<Level | "">("");
  const [formDescription, setFormDescription] = useState("");
  const [formUrlError, setFormUrlError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  // 1. Feature flag query
  const flagsQuery = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () =>
      apiFetch<FeatureFlagsResponse>("/api/v1/feature-flags", {
        schema: FeatureFlagsResponseSchema,
      }),
  });

  const isExtraContentEnabled = Boolean(flagsQuery.data?.flags?.extra_content);

  // 2. Resources query
  const resourcesQuery = useQuery({
    queryKey: ["resources", "todos"],
    queryFn: () =>
      apiFetch<ExternalResourceListResponse>("/api/v1/resources", {
        schema: ExternalResourceListResponseSchema,
      }),
  });
  const filteredResourcesQuery = useQuery({
    queryKey: ["resources", "level", levelFilter],
    enabled: levelFilter !== "todos",
    queryFn: () =>
      apiFetch<ExternalResourceListResponse>(
        `/api/v1/resources?level=${levelFilter}`,
        {
          schema: ExternalResourceListResponseSchema,
        },
      ),
  });
  const visibleResourcesQuery =
    levelFilter === "todos" ? resourcesQuery : filteredResourcesQuery;

  // 3. Toggle feature flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch<FeatureFlagsResponse>("/api/v1/feature-flags/extra_content", {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
        schema: FeatureFlagsResponseSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      return queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else
        setServerError("No se pudo actualizar la visibilidad de la sección.");
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
      apiFetch<ExternalResourceItem>("/api/v1/resources", {
        method: "POST",
        body: JSON.stringify(data),
        schema: ExternalResourceItemSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      closeForm();
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Error al crear el recurso.");
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
        method: "PATCH",
        body: JSON.stringify(data),
        schema: ExternalResourceItemSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      closeForm();
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Error al actualizar el recurso.");
    },
  });

  // 6. Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/resources/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setDeletingResource(null);
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Error al eliminar el recurso.");
    },
  });

  // 7. Reorder resources mutation
  const reorderMutation = useMutation({
    mutationFn: (resourceIds: string[]) =>
      apiFetch<ExternalResourceListResponse>("/api/v1/resources/reorder", {
        method: "PUT",
        body: JSON.stringify({ resourceIds }),
        schema: ExternalResourceListResponseSchema,
      }),
    onSuccess: () => {
      setServerError(null);
      return queryClient.invalidateQueries({ queryKey: ["resources"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerError(err.message);
      else setServerError("Error al reordenar los recursos.");
    },
  });

  const openCreateForm = () => {
    setEditingResource(null);
    setFormTitle("");
    setFormUrl("");
    setFormLevel("");
    setFormDescription("");
    setFormUrlError(null);
    setServerError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: ExternalResourceItem) => {
    setEditingResource(item);
    setFormTitle(item.title);
    setFormUrl(item.url);
    setFormLevel(item.level ?? "");
    setFormDescription(item.description ?? "");
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

  useEffect(() => {
    if (!isFormOpen) return;
    const timer = window.setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isFormOpen]);

  useEffect(() => {
    if (!deletingResource) return;
    const timer = window.setTimeout(() => {
      deleteDialogRef.current
        ?.querySelector<HTMLButtonElement>(
          '[role="dialog"] button:not([aria-label])',
        )
        ?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [deletingResource]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormUrlError(null);
    setServerError(null);

    const trimmedUrl = formUrl.trim();
    if (
      !trimmedUrl.toLowerCase().startsWith("https://") ||
      !isValidHttpsResourceUrl(trimmedUrl)
    ) {
      setFormUrlError("Ingresa un enlace válido que comience con https://");
      return;
    }

    const normalizedUrl = trimmedUrl.replace(/^https:\/\//i, "https://");

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

  const handleMove = (index: number, direction: "up" | "down") => {
    const items = resourcesQuery.data?.items;
    if (!items || levelFilter !== "todos" || reorderMutation.isPending) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
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
      return "enlace externo";
    }
  };

  const items = visibleResourcesQuery.data?.items ?? [];
  const total = resourcesQuery.data?.total;
  const atCapacity = total !== undefined && total >= RESOURCE_LIMIT;
  const canCreate = total !== undefined && !atCapacity;
  const isSaving =
    createResourceMutation.isPending || updateResourceMutation.isPending;
  const positions = new Map(
    resourcesQuery.data?.items.map((item, index) => [item.id, index + 1]),
  );
  const canReorder = levelFilter === "todos" && !reorderMutation.isPending;

  if (flagsQuery.isLoading || resourcesQuery.isLoading)
    return <ContenidoExtraSkeleton />;

  return (
    <div className={styles.page}>
      {flagsQuery.data && !isExtraContentEnabled && (
        <div className={styles.banner}>
          <div role="status">
            <p className={styles.strong}>
              Sección oculta para los estudiantes.
            </p>
            <p>Puedes preparar los enlaces y activarla cuando estés lista.</p>
          </div>
          <button
            type="button"
            className={styles.primary}
            onClick={() => toggleFlagMutation.mutate(true)}
            disabled={toggleFlagMutation.isPending}
          >
            {toggleFlagMutation.isPending
              ? "Activando…"
              : "Habilitar sección para estudiantes"}
          </button>
        </div>
      )}

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Contenido Extra</h1>
          <p className={styles.muted}>
            Enlaces externos para que los estudiantes practiquen inglés.
          </p>
        </div>
        <div className={styles.controls}>
          {flagsQuery.data && (
            <button
              type="button"
              className={styles.visibility}
              onClick={() => toggleFlagMutation.mutate(!isExtraContentEnabled)}
              disabled={toggleFlagMutation.isPending}
              aria-pressed={isExtraContentEnabled}
            >
              {isExtraContentEnabled
                ? "✓ Visible para estudiantes"
                : "○ Oculto para estudiantes"}
            </button>
          )}
          {total !== undefined && (
            <span className={styles.capacity} role="status">
              {total} / {RESOURCE_LIMIT} enlaces
            </span>
          )}
          <button
            type="button"
            className={styles.primary}
            onClick={openCreateForm}
            disabled={!canCreate}
            aria-describedby={atCapacity ? "resource-limit" : undefined}
          >
            + Nuevo enlace
          </button>
        </div>
      </header>

      {atCapacity && (
        <p className={styles.limit} id="resource-limit">
          Alcanzaste el límite de {RESOURCE_LIMIT} enlaces. Elimina uno para
          agregar otro.
        </p>
      )}
      {flagsQuery.isError && (
        <ErrorState
          variant="teacher"
          editorial
          message="No se pudo consultar la visibilidad de la sección."
          onRetry={() => void flagsQuery.refetch()}
        />
      )}
      {serverError && !isFormOpen && !deletingResource && (
        <p className={styles.error} role="alert">
          {serverError}
        </p>
      )}

      <div
        className={styles.filters}
        role="group"
        aria-label="Filtro por nivel MCER"
      >
        {(["todos", "general", "A1", "A2", "B1", "B2"] as const).map(
          (level) => (
            <button
              key={level}
              type="button"
              onClick={() => setLevelFilter(level)}
              aria-pressed={levelFilter === level}
            >
              {level === "todos"
                ? "Todos"
                : level === "general"
                  ? "General"
                  : `Nivel ${level}`}
            </button>
          ),
        )}
      </div>

      {levelFilter !== "todos" && (
        <p className={styles.muted} id="resource-reorder-note">
          Selecciona el filtro «Todos» para reordenar el catálogo completo.
        </p>
      )}

      {resourcesQuery.isError && (
        <ErrorState
          variant="teacher"
          editorial
          message="No se pudo cargar el catálogo de enlaces."
          onRetry={() => void resourcesQuery.refetch()}
        />
      )}
      {visibleResourcesQuery.isLoading ? (
        <ResourceSkeleton />
      ) : visibleResourcesQuery.isError ? (
        levelFilter !== "todos" && (
          <ErrorState
            variant="teacher"
            editorial
            message="No se pudieron cargar los enlaces de este nivel."
            onRetry={() => void visibleResourcesQuery.refetch()}
          />
        )
      ) : items.length === 0 ? (
        <section className={styles.empty}>
          <h2>
            {levelFilter === "todos"
              ? "Aún no has publicado enlaces de contenido extra."
              : "No hay enlaces para este filtro."}
          </h2>
          {canCreate && (
            <>
              <p className={styles.muted}>
                Agrega un enlace que empiece por https://.
              </p>
              <button
                type="button"
                className={styles.primary}
                onClick={openCreateForm}
              >
                {total === 0 ? "Agregar primer enlace" : "Agregar enlace"}
              </button>
            </>
          )}
        </section>
      ) : (
        <ul
          className={styles.catalog}
          aria-label="Lista de recursos de contenido extra"
        >
          {items.map((item, index) => (
            <li key={item.id} className={styles.row}>
              <div className={styles.resource}>
                <span className={styles.position}>
                  {positions.get(item.id) ?? index + 1}
                </span>
                <div className={styles.details}>
                  <div className={styles.resourceTitle}>
                    <h2>{item.title}</h2>
                    <span className={styles.badge} data-general={!item.level}>
                      {item.level ? `Nivel ${item.level}` : "General"}
                    </span>
                  </div>
                  {item.description && <p>{item.description}</p>}
                  <p className={styles.domain}>{getHostname(item.url)}</p>
                </div>
              </div>
              <div className={styles.actions}>
                <div className={styles.actionGroup}>
                  <button
                    type="button"
                    className={styles.move}
                    onClick={() => handleMove(index, "up")}
                    disabled={!canReorder || index === 0}
                    aria-label={`Subir enlace ${item.title}`}
                  >
                    Subir <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className={styles.move}
                    onClick={() => handleMove(index, "down")}
                    disabled={!canReorder || index === items.length - 1}
                    aria-label={`Bajar enlace ${item.title}`}
                  >
                    Bajar <span aria-hidden="true">↓</span>
                  </button>
                </div>
                <div className={styles.actionGroup}>
                  {isValidHttpsResourceUrl(item.url) && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir <span aria-hidden="true">↗</span>
                    </a>
                  )}
                  <button type="button" onClick={() => openEditForm(item)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => {
                      setServerError(null);
                      setDeletingResource(item);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AccessibleModal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingResource ? "Editar enlace" : "Nuevo enlace"}
      >
        <form onSubmit={handleFormSubmit} className={styles.form}>
          {serverError && (
            <p role="alert" className={styles.error}>
              {serverError}
            </p>
          )}
          <label htmlFor="form-title">
            Título del recurso
            <input
              id="form-title"
              ref={firstInputRef}
              type="text"
              required
              maxLength={160}
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
            />
          </label>
          <div className={styles.field}>
            <label htmlFor="form-url">Enlace externo (https://)</label>
            <input
              id="form-url"
              type="text"
              inputMode="url"
              required
              maxLength={2048}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={formUrl}
              aria-invalid={Boolean(formUrlError)}
              aria-describedby={formUrlError ? "resource-url-error" : undefined}
              onChange={(event) => {
                setFormUrl(event.target.value);
                setFormUrlError(null);
              }}
              placeholder="https://es.educaplay.com/..."
            />
            {formUrlError && (
              <p className={styles.error} id="resource-url-error" role="alert">
                {formUrlError}
              </p>
            )}
          </div>
          <label htmlFor="form-level">
            Nivel de visibilidad
            <select
              id="form-level"
              value={formLevel}
              onChange={(event) => {
                const value = event.target.value;
                setFormLevel(isLevel(value) ? value : "");
              }}
            >
              <option value="">General (todos los niveles)</option>
              <option value="A1">Nivel A1</option>
              <option value="A2">Nivel A2</option>
              <option value="B1">Nivel B1</option>
              <option value="B2">Nivel B2</option>
            </select>
          </label>
          <label htmlFor="form-description">
            Descripción (opcional)
            <textarea
              id="form-description"
              rows={3}
              maxLength={500}
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
            />
          </label>
          <div className={styles.dialogActions}>
            <button type="button" onClick={closeForm}>
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.primary}
              disabled={isSaving || (!editingResource && !canCreate)}
            >
              {isSaving
                ? "Guardando…"
                : editingResource
                  ? "Guardar cambios"
                  : "Crear enlace"}
            </button>
          </div>
        </form>
      </AccessibleModal>

      <div ref={deleteDialogRef} className={styles.confirm}>
        <ConfirmDialog
          isOpen={Boolean(deletingResource)}
          title="¿Eliminar enlace?"
          message={
            serverError && deletingResource
              ? serverError
              : `¿Eliminar el enlace "${deletingResource?.title ?? ""}"? Dejará de aparecer en el portal inmediatamente.`
          }
          confirmText={
            deleteResourceMutation.isPending ? "Eliminando…" : "Eliminar enlace"
          }
          isDestructive
          onConfirm={() => {
            if (deletingResource && !deleteResourceMutation.isPending) {
              setServerError(null);
              deleteResourceMutation.mutate(deletingResource.id);
            }
          }}
          onCancel={() => {
            setDeletingResource(null);
            setServerError(null);
          }}
        />
      </div>
    </div>
  );
}

function ResourceSkeleton() {
  return (
    <div
      className={styles.loading}
      role="status"
      aria-label="Cargando recursos externos"
    >
      <div className={styles.placeholderRow} aria-hidden="true" />
      <div className={styles.placeholderRow} aria-hidden="true" />
      <div className={styles.placeholderRow} aria-hidden="true" />
      <div className={styles.placeholderRow} aria-hidden="true" />
    </div>
  );
}

export function ContenidoExtraSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.placeholderHeader} aria-hidden="true" />
      <ResourceSkeleton />
    </div>
  );
}
