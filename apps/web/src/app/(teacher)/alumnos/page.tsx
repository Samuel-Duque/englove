import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlumnosClient } from './alumnos-client';

export const metadata: Metadata = {
  title: 'Gestión de Alumnos',
  description:
    'Administración de alumnos, solicitudes de inscripción y cuentas bloqueadas.',
};

export default function StudentsManagementPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="origami-state text-center">
          Cargando gestión de alumnos…
        </div>
      }
    >
      <AlumnosClient />
    </Suspense>
  );
}
