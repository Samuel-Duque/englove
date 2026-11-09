import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { RegistroClient } from './registro-client';

export const metadata: Metadata = {
  title: 'Registro de Estudiante',
  description: 'Crea tu cuenta de estudiante en Englove.',
};

export const instant = false;

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6 text-center">
          <p className="text-zinc-600 text-lg">Cargando formulario de registro…</p>
        </main>
      }
    >
      <RegistroClient />
    </Suspense>
  );
}
