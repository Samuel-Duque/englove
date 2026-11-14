import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  title: 'Restablecer Contraseña',
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center p-6 text-center outline-none">
          <p className="text-zinc-500">Cargando…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
