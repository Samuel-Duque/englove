import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { InicioClient } from './inicio-client';
import { InicioLoading } from './inicio-loading';

export const metadata: Metadata = {
  title: 'Inicio',
  description: 'Panel de inicio de actividades y misiones en Upward English.',
};

export default function InicioPage() {
  return (
    <Suspense fallback={<InicioLoading />}>
      <InicioClient />
    </Suspense>
  );
}
