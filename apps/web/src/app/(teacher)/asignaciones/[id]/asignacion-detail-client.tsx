"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AssignmentView,
  AssignmentViewSchema,
  AssignmentAvailability,
  formatBogotaDateTime,
  getExtendedDueAt,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../../lib/api";
import { AccessibleModal } from "../../../../components/ui/modal";

import { activityTypeLabels } from "../../actividades/activity-labels";

import { availabilityBadges } from "../assignment-labels";

export function AsignacionDetailClient({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Cancellation Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const modalReturnBtnRef = useRef<HTMLButtonElement | null>(null);

  const assignmentQuery = useQuery({
    queryKey: ["teacher", "assignment", id],
    queryFn: () =>
      apiFetch<AssignmentView>(`/api/v1/assignments/${id}`, {
        schema: AssignmentViewSchema,
      }),
  });

  const assignment = assignmentQuery.data ?? null;
  const isLoading = assignmentQuery.isLoading;

  const getErrorMessage = () => {
    if (!assignmentQuery.error) return null;
    const err = assignmentQuery.error;
    if (err instanceof ApiError) {
      if (err.statusCode === 404) {
        return "No encontramos esta asignación o alguno de los recursos seleccionados";
      } else if (err.statusCode === 403) {
        return "No tienes acceso a esta sección";
      } else if (err.statusCode === 429) {
        return "Espera un momento antes de volver a intentarlo";
      }
      return err.message || "No pudimos cargar la asignación";
    }
    return "No pudimos cargar la asignación";
  };

  const error = getErrorMessage();

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetch<AssignmentView>(`/api/v1/assignments/${id}/cancel`, {
        method: "POST",
        schema: AssignmentViewSchema,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["teacher", "assignment", id], updated);
      queryClient.invalidateQueries({ queryKey: ["teacher", "assignments"] });
      setShowCancelModal(false);
      setSuccessNotice("Asignación cancelada");
      setTimeout(() => {
        titleRef.current?.focus();
      }, 50);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setCancelError(
            "Esta asignación no se puede cancelar porque ya está cerrada o cancelada",
          );
        } else {
          setCancelError(err.message || "No se pudo cancelar la asignación");
        }
      } else {
        setCancelError("No se pudo cancelar la asignación");
      }
    },
  });

  const isCancelling = cancelMutation.isPending;

  // Keyboard accessibility: handle Escape key to close cancellation modal (RF-15)
  useEffect(() => {
    if (!showCancelModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseCancelModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCancelModal, isCancelling]);

  const handleOpenCancelModal = () => {
    setCancelError(null);
    setShowCancelModal(true);
    setTimeout(() => {
      modalReturnBtnRef.current?.focus();
    }, 50);
  };

  const handleCloseCancelModal = () => {
    if (isCancelling) return;
    setShowCancelModal(false);
    setCancelError(null);
    // Return focus to cancel button (RF-15)
    setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);
  };

  const handleConfirmCancel = () => {
    setCancelError(null);
    cancelMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="origami-state" role="status">
        Cargando asignación…
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div
          role="alert"
          className="origami-state origami-state--error space-y-3"
        >
          <p className="font-medium">
            {error ||
              "No encontramos esta asignación o alguno de los recursos seleccionados"}
          </p>
          <div className="flex flex-wrap gap-2">
            {!(
              assignmentQuery.error instanceof ApiError &&
              [403, 404].includes(assignmentQuery.error.statusCode)
            ) && (
              <button
                type="button"
                className="origami-button origami-button--secondary"
                onClick={() => void assignmentQuery.refetch()}
              >
                Reintentar
              </button>
            )}
            <Link
              href="/asignaciones"
              className="origami-button origami-button--text"
            >
              Volver a asignaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const badge =
    availabilityBadges[assignment.availability] ||
    availabilityBadges[AssignmentAvailability.open];
  const isCancelled = assignment.cancelledAt !== null;
  const extendedDue = getExtendedDueAt(assignment.dueAt);

  return (
    <div className="origami-shell mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="origami-meta flex flex-wrap items-center gap-2">
        <Link
          href="/asignaciones"
          className="origami-button origami-button--text"
        >
          Asignaciones
        </Link>
        <span>/</span>
        <span className="text-(--origami-text-primary) font-medium">
          {assignment.activity.title}
        </span>
      </div>

      {/* Success banner */}
      {successNotice && (
        <div
          role="status"
          className="origami-state origami-state--success flex items-center justify-between gap-2"
        >
          <span className="font-medium">{successNotice}</span>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="origami-button origami-button--text"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-(--origami-border-subtle) pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`origami-state text-sm font-bold ${badge.tone}`}>
              {badge.label}
            </span>
            <span className="text-xs text-(--origami-text-secondary) font-medium">
              v{assignment.activity.version}
            </span>
          </div>
          <h1 ref={titleRef} tabIndex={-1} className="origami-page-title mt-2">
            {assignment.activity.title}
          </h1>
          <p className="text-sm text-(--origami-text-secondary) mt-1">
            {activityTypeLabels[assignment.activity.type]} · Nivel{" "}
            {assignment.activity.level}
          </p>
        </div>

        <div>
          {!isCancelled ? (
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={handleOpenCancelModal}
              className="origami-button origami-button--secondary text-(--origami-error-text)"
            >
              Cancelar asignación
            </button>
          ) : (
            <span className="inline-flex items-center rounded-lg bg-(--origami-surface-soft) px-3 py-1.5 text-xs text-(--origami-text-secondary) font-medium">
              Cancelada el {formatBogotaDateTime(assignment.cancelledAt!)}
            </span>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Group Info Card */}
        <section className="origami-card space-y-3">
          <h2 className="origami-card-title border-b border-(--origami-border-subtle) pb-2">
            Grupo destinatario
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-(--origami-text-secondary) font-medium">
                Nombre:
              </span>
              <span className="font-semibold text-(--origami-text-primary)">
                {assignment.group.name}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-(--origami-text-secondary) font-medium">
                Estado del grupo:
              </span>
              <span>
                {assignment.group.archivedAt ? (
                  <span className="origami-state origami-state--warning">
                    Archivado
                  </span>
                ) : (
                  <span className="origami-state origami-state--success">
                    Activo
                  </span>
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-(--origami-border-subtle)">
              <Link
                href={`/grupos/${assignment.group.id}`}
                className="origami-button origami-button--text"
              >
                Ver ficha del grupo →
              </Link>
            </div>
          </div>
        </section>

        {/* Activity Catalog Info Card */}
        <section className="origami-card space-y-3">
          <h2 className="origami-card-title border-b border-(--origami-border-subtle) pb-2">
            Actividad en catálogo
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-(--origami-text-secondary) font-medium">
                Tipo:
              </span>
              <span className="font-semibold text-(--origami-text-primary)">
                {activityTypeLabels[assignment.activity.type]}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-(--origami-text-secondary) font-medium">
                Nivel:
              </span>
              <span className="font-semibold text-(--origami-text-primary)">
                {assignment.activity.level}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-(--origami-text-secondary) font-medium">
                Estado en catálogo:
              </span>
              <span className="capitalize font-semibold text-(--origami-text-primary)">
                {assignment.activity.status === "published"
                  ? "Publicada"
                  : assignment.activity.status === "archived"
                    ? "Archivada"
                    : "Borrador"}
              </span>
            </div>
            <div className="pt-2 border-t border-(--origami-border-subtle)">
              <Link
                href={`/actividades/${assignment.activity.id}`}
                className="origami-button origami-button--text"
              >
                Ver editor de actividad →
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Dates & Policy Section */}
      <section className="origami-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--origami-border-subtle) pb-3">
          <h2 className="origami-card-title">Plazos y horarios</h2>
          <span className="text-xs font-semibold text-(--origami-text-secondary) bg-(--origami-surface-soft) px-2.5 py-1 rounded-md">
            Hora de Colombia (America/Bogota)
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="rounded-lg bg-(--origami-surface-soft) border border-(--origami-border-subtle) p-4 space-y-1">
            <span className="font-semibold text-(--origami-text-secondary) block uppercase tracking-wider text-[10px]">
              Apertura
            </span>
            <p className="origami-card-title">
              {formatBogotaDateTime(assignment.opensAt)}
            </p>
            <p className="text-[11px] text-(--origami-text-secondary)">
              Instante en que se habilita para los alumnos.
            </p>
          </div>

          <div className="rounded-lg bg-(--origami-surface-soft) border border-(--origami-border-subtle) p-4 space-y-1">
            <span className="font-semibold text-(--origami-text-secondary) block uppercase tracking-wider text-[10px]">
              Cierre para empezar
            </span>
            <p className="origami-card-title">
              {formatBogotaDateTime(assignment.dueAt)}
            </p>
            <p className="text-[11px] text-(--origami-text-secondary)">
              Límite para iniciar el primer intento.
            </p>
          </div>
        </div>

        {/* Mandatory Policy Explanation (SPEC-04 RF-7, §7) */}
        <div className="origami-state origami-state--warning space-y-2">
          <p className="font-semibold">Regla de entrega y tolerancia:</p>
          <p className="leading-relaxed">
            los alumnos pueden empezar hasta esta hora; quien haya empezado
            tendrá hasta 24 horas más para terminar.
          </p>
          <div className="pt-2 border-t border-(--origami-border-subtle) font-medium">
            Última hora para terminar si empezó a tiempo:{" "}
            <span className="font-bold">
              {formatBogotaDateTime(extendedDue)}
            </span>
          </div>
        </div>
      </section>

      {/* Cancellation Confirmation Dialog (Accessible Modal) */}
      <AccessibleModal
        isOpen={showCancelModal}
        onClose={handleCloseCancelModal}
        title="¿Cancelar esta asignación?"
      >
        <p className="text-xs text-(--origami-text-secondary) leading-relaxed">
          No se podrán empezar nuevos intentos. Quienes ya empezaron podrán
          terminar dentro de su plazo. Se conservarán los trabajos y las
          calificaciones.
        </p>

        {cancelError && (
          <div role="alert" className="origami-state origami-state--error">
            {cancelError}
          </div>
        )}

        <div className="flex items-center flex-wrap justify-end gap-3 pt-3 border-t border-(--origami-border-subtle)">
          <button
            ref={modalReturnBtnRef}
            type="button"
            onClick={handleCloseCancelModal}
            disabled={isCancelling}
            className="origami-button origami-button--secondary"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={isCancelling}
            className="origami-button"
          >
            {isCancelling ? "Cancelando…" : "Cancelar asignación"}
          </button>
        </div>
      </AccessibleModal>
    </div>
  );
}
