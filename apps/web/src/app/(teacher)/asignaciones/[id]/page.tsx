import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AsignacionDetailClient } from './asignacion-detail-client';

export const metadata: Metadata = {
  title: 'Detalle de Asignación',
  description: 'Detalle y seguimiento de la asignación.',
};

export const instant = false;

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = await params;
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-zinc-500 text-sm">
          Cargando detalle de la asignación…
        </div>
      }
    >
      <AsignacionDetailClient id={unwrappedParams.id} />
    </Suspense>
  );
}
