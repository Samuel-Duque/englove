import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ContenidoExtraClient } from './contenido-extra-client';

export const metadata: Metadata = {
  title: 'Contenido Extra',
  description: 'Gestión docente de enlaces y recursos pedagógicos externos.',
};

export const instant = false;

export default function ContenidoExtraPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-zinc-500 text-sm">
          Cargando catálogo de contenido extra…
        </div>
      }
    >
      <ContenidoExtraClient />
    </Suspense>
  );
}
