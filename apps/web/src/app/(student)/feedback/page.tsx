import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { FeedbackClient } from './feedback-client';

export const metadata: Metadata = {
  title: 'Mi Retroalimentación',
  description: 'Calificaciones, comentarios de tu profesora y stickers obtenidos en tus actividades.',
};

export const instant = false;

export default function StudentFeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm font-semibold text-zinc-600">Cargando tus comentarios y notas…</p>
        </div>
      }
    >
      <FeedbackClient />
    </Suspense>
  );
}
