import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { EstadisticasClient } from './estadisticas-client';

export const metadata: Metadata = {
  title: 'Estadísticas y Desempeño',
};

export default function EstadisticasPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="origami-state text-center">
          Cargando panel de estadísticas…
        </div>
      }
    >
      <EstadisticasClient />
    </Suspense>
  );
}
