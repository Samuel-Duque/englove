import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { PerfilClient } from './perfil-client';

export const metadata: Metadata = {
  title: 'Mi Perfil',
};

export default function PerfilPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm font-semibold text-zinc-600">Cargando tu perfil…</p>
        </div>
      }
    >
      <PerfilClient />
    </Suspense>
  );
}
