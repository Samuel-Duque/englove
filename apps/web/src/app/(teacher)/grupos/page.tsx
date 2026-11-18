import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { GruposClient } from './grupos-client';

export const metadata: Metadata = {
  title: 'Gestión de Grupos',
  description: 'Administración de grupos y aulas temáticas de estudiantes.',
};

export default function GroupsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="origami-state text-center">
          Cargando gestión de grupos…
        </div>
      }
    >
      <GruposClient />
    </Suspense>
  );
}
