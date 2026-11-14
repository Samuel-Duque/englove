import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { RecuperarContrasenaClient } from './recuperar-contrasena-client';

export const metadata: Metadata = {
  title: 'Recuperar Contraseña',
  description: 'Solicita un enlace para restablecer la contraseña de tu cuenta en Englove.',
};

export default function RecuperarContrasenaPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-6 text-center outline-none">
          <p className="text-zinc-600 text-lg">Cargando…</p>
        </main>
      }
    >
      <RecuperarContrasenaClient />
    </Suspense>
  );
}
