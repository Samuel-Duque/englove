import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { GrupoDetailClient } from './grupo-detail-client';

export const metadata: Metadata = {
  title: 'Detalle del Grupo',
  description: 'Gestión de miembros y detalles de aula temática.',
};

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = await params;

  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando grupo…</div>}>
      <GrupoDetailClient id={unwrappedParams.id} />
    </Suspense>
  );
}
