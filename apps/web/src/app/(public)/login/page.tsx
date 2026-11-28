import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { AuthLoading } from '../auth-page';
import { LoginClient, type DemoAccount } from './login-client';

export const metadata: Metadata = {
  title: 'Iniciar Sesión',
  description: 'Ingresa a la plataforma Upward English para continuar tus actividades de inglés.',
};

const demoAccounts: readonly DemoAccount[] = [
  {
    label: '👩‍🏫 Docente Principal',
    email: 'profesora@upwardenglish.app',
    password: 'UpwardEnglish2026!',
  },
  {
    label: '👦 Alumno (Kids)',
    email: 'lucas.kids@upwardenglish.app',
    password: 'Estudiante2026!',
  },
  {
    label: '🧑 Alumna (Teens)',
    email: 'camila.teens@upwardenglish.app',
    password: 'Estudiante2026!',
  },
];

async function LoginContent() {
  await connection();
  const appEnv = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV;
  return <LoginClient demoAccounts={appEnv === 'local' ? demoAccounts : []} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading message="Comprobando tu sesión…" />}>
      <LoginContent />
    </Suspense>
  );
}
