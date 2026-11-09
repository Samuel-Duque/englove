import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstudianteStatsClient } from './estudiante-stats-client';

export const metadata: Metadata = {
  title: 'Ficha de Estudiante - Estadísticas',
};

export const instant = false;

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = await params;

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-zinc-500 text-sm">
          Cargando ficha del estudiante…
        </div>
      }
    >
      <EstudianteStatsClient studentId={unwrappedParams.id} />
    </Suspense>
  );
}
