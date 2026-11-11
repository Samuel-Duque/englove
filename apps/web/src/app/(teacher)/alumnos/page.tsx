import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlumnosClient } from './alumnos-client';

export const metadata: Metadata = {
  title: 'Gestión de Alumnos',
  description: 'Administración de alumnos, solicitudes de inscripción y cuentas bloqueadas.',
};

export default function StudentsManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-zinc-500 text-sm">
          Cargando gestión de alumnos…
        </div>
      }
    >
      <AlumnosClient />
    </Suspense>
  );
}
