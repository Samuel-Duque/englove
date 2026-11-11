import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProgresoClient } from './progreso-client';

export const metadata: Metadata = {
  title: 'Mi Progreso',
};

export default function ProgresoPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm font-semibold text-zinc-600">Cargando tu progreso…</p>
        </div>
      }
    >
      <ProgresoClient />
    </Suspense>
  );
}
