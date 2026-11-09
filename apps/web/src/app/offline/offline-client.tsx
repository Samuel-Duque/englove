'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineClient() {
  const [isTeensOrTeacher, setIsTeensOrTeacher] = useState(false);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('englove_segment') || localStorage.getItem('theme');
      const docTheme = document.documentElement.getAttribute('data-theme');
      if (storedTheme === 'teens' || docTheme === 'teens') {
        setIsTeensOrTeacher(true);
      }
    } catch {
      // Fallback to default
    }
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-amber-50 text-zinc-900">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-amber-200 p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6 text-amber-800">
          <WifiOff className="w-8 h-8" aria-hidden="true" />
        </div>

        {isTeensOrTeacher ? (
          <>
            <h1 className="text-2xl font-bold mb-3 text-zinc-900">Sin conexión</h1>
            <p className="text-zinc-600 mb-8 text-base">
              Sin conexión. Revisa tu red e inténtalo de nuevo.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-3 text-zinc-900">¡Ups! No hay internet</h1>
            <p className="text-zinc-600 mb-8 text-base">
              ¡Ups! No hay internet. Revisa la conexión y vuelve a intentarlo.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center justify-center gap-2 min-h-[48px] min-w-[48px] px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-zinc-950 font-bold text-lg shadow-sm transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
        >
          <RefreshCw className="w-5 h-5" aria-hidden="true" />
          <span>Reintentar</span>
        </button>
      </div>
    </main>
  );
}
