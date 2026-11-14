import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginClient } from './login-client';

export const metadata: Metadata = {
  title: 'Iniciar Sesión',
  description: 'Ingresa a la plataforma Englove para continuar tus actividades de inglés.',
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-6 text-center outline-none">
          <p className="text-zinc-600 text-lg">Comprobando tu sesión…</p>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
