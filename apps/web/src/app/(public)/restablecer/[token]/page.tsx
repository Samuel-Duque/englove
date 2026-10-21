import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  title: 'Restablecer contraseña | Englove',
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6 text-center">
          <p className="text-zinc-500">Cargando…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
