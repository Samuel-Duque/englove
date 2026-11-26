import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthLoading } from '../../auth-page';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  title: 'Restablecer Contraseña',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLoading message="Cargando…" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
