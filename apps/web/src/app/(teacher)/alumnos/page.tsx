import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlumnosClient } from './alumnos-client';

export const metadata: Metadata = {
  title: 'Alumnos',
  description: 'Directorio de alumnos activos, solicitudes de inscripción y cuentas bloqueadas.',
};

export default function StudentsManagementPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="py-12 text-center text-sm text-[#5E3E2C]">
          Cargando gestión de alumnos…
        </div>
      }
    >
      <AlumnosClient />
    </Suspense>
  );
}
