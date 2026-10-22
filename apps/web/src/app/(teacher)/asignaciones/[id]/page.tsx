'use client';

import React, { useState, useEffect, useCallback, use, useRef } from 'react';
import Link from 'next/link';
import {
  AssignmentView,
  AssignmentAvailability,
  ActivityType,
  formatBogotaDateTime,
  getExtendedDueAt,
} from '@englove/shared';
import { apiFetch, ApiError } from '../../../../lib/api';

const typeLabels: Record<ActivityType, string> = {
  [ActivityType.fill_blank]: 'Rellenar huecos',
  [ActivityType.open_question]: 'Pregunta abierta',
  [ActivityType.speaking]: 'Expresión oral (Speaking)',
  [ActivityType.game]: 'Microjuego',
  [ActivityType.exam]: 'Examen',
};

const availabilityBadges: Record<
  AssignmentAvailability,
  { label: string; bg: string; text: string }
> = {
  [AssignmentAvailability.scheduled]: {
    label: 'Programada',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
  },
  [AssignmentAvailability.open]: {
    label: 'Abierta',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
  },
  [AssignmentAvailability.closed]: {
    label: 'Cerrada',
    bg: 'bg-zinc-100 border-zinc-200',
    text: 'text-zinc-600',
  },
  [AssignmentAvailability.cancelled]: {
    label: 'Cancelada',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
  },
};

export default function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [assignment, setAssignment] = useState<AssignmentView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Cancellation Modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalReturnBtnRef = useRef<HTMLButtonElement | null>(null);

  const fetchAssignment = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AssignmentView>(`/api/v1/assignments/${id}`);
      setAssignment(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setError(
            'No encontramos esta asignación o alguno de los recursos seleccionados',
          );
        } else if (err.statusCode === 403) {
          setError('No tienes acceso a esta sección');
        } else if (err.statusCode === 429) {
          setError('Espera un momento antes de volver a intentarlo');
        } else {
          setError(err.message || 'No pudimos cargar la asignación');
        }
      } else {
        setError('No pudimos cargar la asignación');
      }
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  // Keyboard accessibility: handle Escape key to close cancellation modal (RF-15)
  useEffect(() => {
    if (!showCancelModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseCancelModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const updated = await apiFetch<AssignmentView>(
        `/api/v1/assignments/${id}/cancel`,
        {
          method: 'POST',
        },
      );
      setAssignment(updated);
      setShowCancelModal(false);
      setSuccessNotice('Asignación cancelada');
      setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          setCancelError('No tienes acceso a esta sección');
        } else if (err.statusCode === 404) {
          setCancelError(
            'No encontramos esta asignación o alguno de los recursos seleccionados',
          );
        } else if (err.statusCode === 429) {
          setCancelError('Espera un momento antes de volver a intentarlo');
        } else {
          setCancelError(
            err.message ||
              'No se pudo cancelar la asignación. Intenta de nuevo.',
          );
        }
      } else {
        setCancelError('No se pudo cancelar la asignación. Intenta de nuevo.');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-zinc-500 text-sm">
        Cargando asignación…
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800"
        >
          <p className="font-medium">
            {error || 'No encontramos esta asignación o alguno de los recursos seleccionados'}
          </p>
          <div className="mt-4">
            <Link
              href="/asignaciones"
              className="inline-flex items-center rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-900"
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/asignaciones" className="hover:text-zinc-900">
          Asignaciones
        </Link>
        <span>/</span>
        <span className="text-zinc-800 font-medium truncate max-w-sm">
          {assignment.activity.title}
        </span>
      </div>

      {/* Success banner */}
      {successNotice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex justify-between items-center"
        >
          <span className="font-medium">{successNotice}</span>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              v{assignment.activity.version}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-2">
            {assignment.activity.title}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {typeLabels[assignment.activity.type]} · Nivel{' '}
            {assignment.activity.level}
          </p>
        </div>

        <div>
          {!isCancelled ? (
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={handleOpenCancelModal}
              className="rounded-lg border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
            >
              Cancelar asignación
            </button>
          ) : (
            <span className="inline-flex items-center rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 font-medium">
              Cancelada el {formatBogotaDateTime(assignment.cancelledAt!)}
            </span>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Group Info Card */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">
            Grupo destinatario
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Nombre:</span>
              <span className="font-semibold text-zinc-900">
                {assignment.group.name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Estado del grupo:</span>
              <span>
                {assignment.group.archivedAt ? (
                  <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    Archivado
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    Activo
                  </span>
                )}
              </span>
            </div>
            <div className="pt-2 border-t border-zinc-100">
              <Link
                href={`/grupos/${assignment.group.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Ver ficha del grupo →
              </Link>
            </div>
          </div>
        </section>

        {/* Activity Catalog Info Card */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">
            Actividad en catálogo
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Tipo:</span>
              <span className="font-semibold text-zinc-900">
                {typeLabels[assignment.activity.type]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Nivel:</span>
              <span className="font-semibold text-zinc-900">
                {assignment.activity.level}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 font-medium">Estado en catálogo:</span>
              <span className="capitalize font-semibold text-zinc-800">
                {assignment.activity.status === 'published'
                  ? 'Publicada'
                  : assignment.activity.status === 'archived'
                    ? 'Archivada'
                    : 'Borrador'}
              </span>
            </div>
            <div className="pt-2 border-t border-zinc-100">
              <Link
                href={`/actividades/${assignment.activity.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Ver editor de actividad →
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Dates & Policy Section */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h2 className="text-base font-bold text-zinc-900">
            Plazos y horarios
          </h2>
          <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-md">
            Hora de Colombia (America/Bogota)
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-1">
            <span className="font-semibold text-zinc-500 block uppercase tracking-wider text-[10px]">
              Apertura
            </span>
            <p className="text-base font-bold text-zinc-900">
              {formatBogotaDateTime(assignment.opensAt)}
            </p>
            <p className="text-[11px] text-zinc-500">
              Instante en que se habilita para los alumnos.
            </p>
          </div>

          <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4 space-y-1">
            <span className="font-semibold text-zinc-500 block uppercase tracking-wider text-[10px]">
              Cierre para empezar
            </span>
            <p className="text-base font-bold text-zinc-900">
              {formatBogotaDateTime(assignment.dueAt)}
            </p>
            <p className="text-[11px] text-zinc-500">
              Límite para iniciar el primer intento.
            </p>
          </div>
        </div>

        {/* Mandatory Policy Explanation (SPEC-04 RF-7, §7) */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
          <p className="font-semibold">
            Regla de entrega y tolerancia:
          </p>
          <p className="leading-relaxed">
            los alumnos pueden empezar hasta esta hora; quien haya empezado tendrá hasta 24 horas más para terminar.
          </p>
          <div className="pt-2 border-t border-amber-200 font-medium">
            Última hora para terminar si empezó a tiempo:{' '}
            <span className="font-bold">{formatBogotaDateTime(extendedDue)}</span>
          </div>
        </div>
      </section>

      {/* Cancellation Confirmation Dialog (Accessible Modal) */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3
              id="modal-title"
              className="text-lg font-bold text-zinc-900"
            >
              ¿Cancelar esta asignación?
            </h3>

            <p className="text-xs text-zinc-600 leading-relaxed">
              No se podrán empezar nuevos intentos. Quienes ya empezaron podrán terminar dentro de su plazo. Se conservarán los trabajos y las calificaciones.
            </p>

            {cancelError && (
              <div
                role="alert"
                className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800"
              >
                {cancelError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                ref={modalReturnBtnRef}
                type="button"
                onClick={handleCloseCancelModal}
                disabled={isCancelling}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
              >
                {isCancelling ? 'Cancelando…' : 'Cancelar asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
