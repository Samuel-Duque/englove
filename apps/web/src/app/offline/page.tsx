import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { OfflineClient } from './offline-client';

export const metadata: Metadata = {
  title: 'Sin conexión',
  description: 'No hay conexión a internet disponible.',
};

export default function OfflinePage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" tabIndex={-1} className="min-h-screen flex flex-col items-center justify-center p-6 bg-amber-50 text-zinc-900 outline-none">
          <p className="text-zinc-600">Verificando conexión…</p>
        </main>
      }
    >
      <OfflineClient />
    </Suspense>
  );
}
