import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlumnoDetailClient } from './alumno-detail-client';

export const metadata: Metadata = {
  title: 'Ficha del Alumno',
  description: 'Detalle, historial académico y gestión del estudiante.',
};

export const instant = false;

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = await params;

  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando ficha del alumno…</div>}>
      <AlumnoDetailClient id={unwrappedParams.id} />
    </Suspense>
  );
}
