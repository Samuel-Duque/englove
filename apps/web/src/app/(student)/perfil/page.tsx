import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { PerfilClient } from './perfil-client';
import { PerfilLoading } from './perfil-loading';

export const metadata: Metadata = {
  title: 'Mi Perfil',
};

export default function PerfilPage() {
  return (
    <Suspense fallback={<PerfilLoading />}>
      <PerfilClient />
    </Suspense>
  );
}
