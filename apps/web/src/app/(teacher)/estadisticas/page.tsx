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
        <div className="py-12 text-center text-zinc-500 text-sm">
          Cargando panel de estadísticas…
        </div>
      }
    >
      <EstadisticasClient />
    </Suspense>
  );
}
