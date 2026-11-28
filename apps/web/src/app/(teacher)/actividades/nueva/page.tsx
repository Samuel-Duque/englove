import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ActivityEditorComponent } from '../activity-editor';

export const metadata: Metadata = {
  title: 'Crear Nueva Actividad',
  description: 'Diseñador de nuevas actividades pedagógicas para estudiantes.',
};

export default function NuevaActividadPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="mx-auto max-w-[1024px] space-y-6">
          <span className="sr-only">Cargando editor de actividad…</span>
          <div className="h-16 rounded-xl bg-[#F6EFE4] border border-[#E4D5C3]" />
          <div className="h-48 rounded-xl bg-[#F6EFE4] border border-[#E4D5C3]" />
          <div className="h-56 rounded-xl bg-[#F6EFE4] border border-[#E4D5C3]" />
        </div>
      }
    >
      <ActivityEditorComponent />
    </Suspense>
  );
}
