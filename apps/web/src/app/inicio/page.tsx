import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { InicioClient } from './inicio-client';

export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Panel de inicio de actividades y misiones en Englove.',
};

export default function InicioPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-6 text-center bg-zinc-50 outline-none">
          <p className="text-zinc-600 text-lg">Cargando tu espacio…</p>
        </main>
      }
    >
      <InicioClient />
    </Suspense>
  );
}
