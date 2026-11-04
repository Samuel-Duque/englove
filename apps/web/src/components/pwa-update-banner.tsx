'use client';

import React, { useSyncExternalStore, useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import {
  getPwaUpdateState,
  subscribePwaUpdate,
  applyUpdate,
  dismissUpdateNotice,
  registerServiceWorker,
} from '../lib/pwa-manager';

export function PwaUpdateBanner() {
  const state = useSyncExternalStore(
    subscribePwaUpdate,
    getPwaUpdateState,
    getPwaUpdateState,
  );

  const [isTeensOrPanel, setIsTeensOrPanel] = useState(false);

  useEffect(() => {
    // Register SW on load in production
    registerServiceWorker();

    try {
      const storedTheme = localStorage.getItem('englove_segment') || localStorage.getItem('theme');
      const docTheme = document.documentElement.getAttribute('data-theme');
      if (storedTheme === 'teens' || docTheme === 'teens') {
        setIsTeensOrPanel(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  if (!state.shouldShowBanner) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 bg-zinc-900/95 text-white shadow-2xl backdrop-blur-md border-t border-zinc-700 transition-transform duration-300 ease-out"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-left w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">
              {isTeensOrPanel
                ? 'Hay una actualización disponible. La aplicación necesita reiniciarse para aplicar los cambios.'
                : '¡Englove tiene novedades! Toca Actualizar para verlas.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {!state.isMandatory && (
            <button
              type="button"
              onClick={dismissUpdateNotice}
              className="inline-flex items-center justify-center min-h-[48px] min-w-[48px] px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
            >
              Ahora no
            </button>
          )}

          <button
            type="button"
            onClick={applyUpdate}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] min-w-[48px] px-5 py-2.5 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 rounded-xl shadow-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>{isTeensOrPanel ? 'Reiniciar y actualizar' : 'Actualizar'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
