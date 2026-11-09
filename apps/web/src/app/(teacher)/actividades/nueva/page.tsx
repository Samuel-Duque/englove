import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ActivityEditorComponent } from '../activity-editor';

export const metadata: Metadata = {
  title: 'Crear Nueva Actividad',
  description: 'Diseñador de nuevas actividades pedagógicas para estudiantes.',
};

export const instant = false;

export default function NuevaActividadPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-zinc-500 text-sm">Cargando editor de actividad…</div>}>
      <ActivityEditorComponent />
    </Suspense>
  );
}
