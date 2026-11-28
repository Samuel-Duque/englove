import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProgresoClient } from './progreso-client';
import { ProgresoKidsLoading } from './progreso-kids';
import { ProgresoTeensLoading } from './progreso-teens';

export const metadata: Metadata = {
  title: 'Mi Progreso',
};

export default function ProgresoPage() {
  return (
    <Suspense
      fallback={
        <>
          <div className="hidden [[data-theme=kids]_&]:block">
            <ProgresoKidsLoading />
          </div>
          <div className="[[data-theme=kids]_&]:hidden">
            <ProgresoTeensLoading />
          </div>
        </>
      }
    >
      <ProgresoClient />
    </Suspense>
  );
}
