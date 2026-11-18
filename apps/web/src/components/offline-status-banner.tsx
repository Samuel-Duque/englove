"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, CheckCircle2, CloudUpload } from "lucide-react";
import {
  subscribeOfflineStatus,
  triggerFlush,
  getOfflineUserId,
  type OfflineStatus,
} from "../lib/offline-queue";
import {
  resolveUserSegment,
  isTeensOrTeacherSegment,
  USER_SEGMENT_EVENT,
} from "../lib/user-segment";

export interface OfflineStatusBannerProps {
  initialStatus?: OfflineStatus;
}

export function OfflineStatusBanner({
  initialStatus,
}: OfflineStatusBannerProps = {}) {
  const [status, setStatus] = useState<OfflineStatus>(
    () =>
      initialStatus ?? {
        isOffline: false,
        pendingCount: 0,
        isFlushing: false,
        lastSyncedAt: null,
        justFlushed: false,
      },
  );

  const [isTeensOrPanel, setIsTeensOrPanel] = useState(() =>
    isTeensOrTeacherSegment(resolveUserSegment()),
  );

  useEffect(() => {
    const updateSegment = () => {
      const segment = resolveUserSegment();
      setIsTeensOrPanel(isTeensOrTeacherSegment(segment));
    };

    updateSegment();

    window.addEventListener("storage", updateSegment);
    window.addEventListener(USER_SEGMENT_EVENT, updateSegment);

    const unsubscribe = subscribeOfflineStatus((newStatus) => {
      setStatus(newStatus);
    });

    // Attempt flush when component mounts
    void triggerFlush(getOfflineUserId() ?? "");

    return () => {
      window.removeEventListener("storage", updateSegment);
      window.removeEventListener(USER_SEGMENT_EVENT, updateSegment);
      unsubscribe();
    };
  }, []);

  const effectiveTeensOrPanel =
    isTeensOrPanel || isTeensOrTeacherSegment(resolveUserSegment());

  // When successfully flushed, show confirmation for a brief period (§7)
  if (status.justFlushed && !status.isOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="origami-banner origami-state origami-state--success flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        <span>
          {effectiveTeensOrPanel
            ? "Tus respuestas pendientes se enviaron."
            : "¡Enviado!"}
        </span>
      </div>
    );
  }

  // When offline or has pending items waiting for network
  if (status.isOffline || status.pendingCount > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="origami-banner origami-state origami-state--warning flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {status.isOffline ? (
            <WifiOff className="size-5 shrink-0" aria-hidden="true" />
          ) : (
            <CloudUpload className="size-5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {status.isOffline
              ? effectiveTeensOrPanel
                ? "Sin conexión. Tus respuestas se guardan en este dispositivo."
                : "Sin internet. Tus respuestas se guardan aquí mientras tanto."
              : `${status.pendingCount} elemento(s) pendiente(s) de sincronizar…`}
          </span>
        </div>

        {!status.isOffline && status.pendingCount > 0 && (
          <button
            type="button"
            onClick={() => void triggerFlush(getOfflineUserId() ?? "")}
            disabled={status.isFlushing}
            className="origami-button origami-button--secondary"
          >
            {status.isFlushing ? "Enviando…" : "Sincronizar ahora"}
          </button>
        )}
      </div>
    );
  }

  return null;
}
