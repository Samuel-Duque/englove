'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, CheckCircle2, CloudUpload } from 'lucide-react';
import {
  subscribeOfflineStatus,
  triggerFlush,
  type OfflineStatus,
} from '../lib/offline-queue';

export function OfflineStatusBanner() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOffline: false,
    pendingCount: 0,
    isFlushing: false,
    lastSyncedAt: null,
    justFlushed: false,
  });

  const [isTeensOrPanel, setIsTeensOrPanel] = useState(false);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('englove_segment') || localStorage.getItem('theme');
      const docTheme = document.documentElement.getAttribute('data-theme');
      if (storedTheme === 'teens' || docTheme === 'teens') {
        setIsTeensOrPanel(true);
      }
    } catch {
      // Ignore
    }

    const unsubscribe = subscribeOfflineStatus((newStatus) => {
      setStatus(newStatus);
    });

    // Attempt flush when component mounts
    void triggerFlush();

    return () => {
      unsubscribe();
    };
  }, []);

  // When successfully flushed, show confirmation for a brief period (§7)
  if (status.justFlushed && !status.isOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-200" aria-hidden="true" />
        <span>
          {isTeensOrPanel ? 'Tus respuestas pendientes se enviaron.' : '¡Enviado!'}
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
        className="bg-amber-500 text-zinc-950 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-sm border-b border-amber-600/30"
      >
        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          {status.isOffline ? (
            <WifiOff className="w-4 h-4 text-zinc-900 shrink-0" aria-hidden="true" />
          ) : (
            <CloudUpload className="w-4 h-4 text-zinc-900 shrink-0 animate-pulse" aria-hidden="true" />
          )}
          <span>
            {status.isOffline
              ? isTeensOrPanel
                ? 'Sin conexión. Tus respuestas se guardan en este dispositivo.'
                : 'Sin internet. Tus respuestas se guardan aquí mientras tanto.'
              : `${status.pendingCount} elemento(s) pendiente(s) de sincronizar…`}
          </span>
        </div>

        {!status.isOffline && status.pendingCount > 0 && (
          <button
            type="button"
            onClick={() => void triggerFlush()}
            disabled={status.isFlushing}
            className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-3 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700 transition-colors"
          >
            {status.isFlushing ? 'Enviando…' : 'Sincronizar ahora'}
          </button>
        )}
      </div>
    );
  }

  return null;
}
