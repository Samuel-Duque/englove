import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ExtraClient } from './extra-client';

export const metadata: Metadata = {
  title: 'Contenido extra',
};

export const instant = false;

export default function ExtraPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm font-bold text-amber-900">Cargando contenido extra…</p>
        </div>
      }
    >
      <ExtraClient />
    </Suspense>
  );
}
