import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthLoading } from '../auth-page';
import { RegistroClient } from './registro-client';

export const metadata: Metadata = {
  title: 'Registro de Estudiante',
  description: 'Crea tu cuenta de estudiante en Upward English.',
};

export default function RegistroPage() {
  return (
    <Suspense
      fallback={<AuthLoading message="Cargando formulario de registro…" />}
    >
      <RegistroClient />
    </Suspense>
  );
}
