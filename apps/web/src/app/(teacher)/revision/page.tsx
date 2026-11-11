import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { RevisionClient } from './revision-client';

export const metadata: Metadata = {
  title: 'Revisión y Calificación',
  description: 'Consola docente para calificar actividades y proporcionar retroalimentación.',
};

export default function RevisionPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-zinc-500 text-sm">
          Cargando consola de revisión…
        </div>
      }
    >
      <RevisionClient />
    </Suspense>
  );
}
