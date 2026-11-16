import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ActividadRunner } from './actividad-runner';

export const metadata: Metadata = {
  title: 'Actividad en Curso',
};

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function ActividadPage({ params }: PageProps) {
  const { attemptId } = await params;
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm font-semibold text-zinc-600">Cargando actividad…</p>
        </div>
      }
    >
      <ActividadRunner attemptId={attemptId} />
    </Suspense>
  );
}
