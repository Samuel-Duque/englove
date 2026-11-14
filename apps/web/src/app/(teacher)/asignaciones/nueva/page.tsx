import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { NuevaAsignacionClient } from './nueva-asignacion-client';

export const metadata: Metadata = {
  title: 'Nueva Asignación',
  description: 'Programa una nueva actividad para un grupo de estudiantes.',
};

export default function NewAssignmentPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-zinc-500 text-sm">
          Cargando formulario de asignación…
        </div>
      }
    >
      <NuevaAsignacionClient />
    </Suspense>
  );
}
