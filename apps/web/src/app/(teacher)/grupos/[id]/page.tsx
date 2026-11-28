import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { GroupDetailLoading, GrupoDetailClient } from './grupo-detail-client';

export const metadata: Metadata = {
  title: 'Detalle del Grupo',
  description: 'Gestión de miembros y detalles de aula temática.',
};

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = await params;

  return (
    <Suspense fallback={<GroupDetailLoading />}>
      <GrupoDetailClient key={unwrappedParams.id} id={unwrappedParams.id} />
    </Suspense>
  );
}
