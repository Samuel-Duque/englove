import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthLoading } from '../auth-page';
import { RecuperarContrasenaClient } from './recuperar-contrasena-client';

export const metadata: Metadata = {
  title: 'Recuperar Contraseña',
  description: 'Solicita un enlace para restablecer la contraseña de tu cuenta en Upward English.',
};

export default function RecuperarContrasenaPage() {
  return (
    <Suspense fallback={<AuthLoading message="Cargando…" />}>
      <RecuperarContrasenaClient />
    </Suspense>
  );
}
