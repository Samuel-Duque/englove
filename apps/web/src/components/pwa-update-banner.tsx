"use client";

import React, { useSyncExternalStore, useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import {
  getPwaUpdateState,
  subscribePwaUpdate,
  applyUpdate,
  dismissUpdateNotice,
  registerServiceWorker,
} from "../lib/pwa-manager";
import {
  resolveUserSegment,
  isTeensOrTeacherSegment,
  USER_SEGMENT_EVENT,
} from "../lib/user-segment";

export function PwaUpdateBanner() {
  const state = useSyncExternalStore(
    subscribePwaUpdate,
    getPwaUpdateState,
    getPwaUpdateState,
  );

  const [isTeensOrPanel, setIsTeensOrPanel] = useState(() =>
    isTeensOrTeacherSegment(resolveUserSegment()),
  );

  useEffect(() => {
    // Register SW on load in production
    registerServiceWorker();

    const updateSegment = () => {
      const segment = resolveUserSegment();
      setIsTeensOrPanel(isTeensOrTeacherSegment(segment));
    };

    updateSegment();

    window.addEventListener("storage", updateSegment);
    window.addEventListener(USER_SEGMENT_EVENT, updateSegment);
    return () => {
      window.removeEventListener("storage", updateSegment);
      window.removeEventListener(USER_SEGMENT_EVENT, updateSegment);
    };
  }, []);

  if (!state.shouldShowBanner) {
    return null;
  }

  const effectiveTeensOrPanel =
    isTeensOrPanel || isTeensOrTeacherSegment(resolveUserSegment());

  return (
    <aside
      role="status"
      aria-live="polite"
      className="origami-banner origami-state origami-state--warning"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Sparkles className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p>
              {effectiveTeensOrPanel
                ? "Hay una actualización disponible. La aplicación necesita reiniciarse para aplicar los cambios."
                : "¡Upward English tiene novedades! Toca Actualizar para verlas."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!state.isMandatory && (
            <button
              type="button"
              onClick={dismissUpdateNotice}
              className="origami-button origami-button--secondary"
            >
              Ahora no
            </button>
          )}

          <button
            type="button"
            onClick={applyUpdate}
            className="origami-button"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>
              {effectiveTeensOrPanel ? "Reiniciar y actualizar" : "Actualizar"}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
