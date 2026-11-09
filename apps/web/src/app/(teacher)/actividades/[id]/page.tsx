import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ActividadDetailClient } from './actividad-detail-client';

export const metadata: Metadata = {
  title: 'Editar Actividad',
  description: 'Editor docente para diseñar y configurar la actividad.',
};

export const instant = false;

export default async function EditarActividadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = await params;

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-zinc-500 text-sm">
          Cargando actividad…
        </div>
      }
    >
      <ActividadDetailClient id={unwrappedParams.id} />
    </Suspense>
  );
}
