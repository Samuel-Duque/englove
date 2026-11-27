import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { FeedbackClient } from './feedback-client';
import { FeedbackKidsLoading, FeedbackTeensLoading } from './feedback-loading';

export const metadata: Metadata = {
  title: 'Mi Retroalimentación',
  description: 'Calificaciones, comentarios de tu profesora y stickers obtenidos en tus actividades.',
};

export default function StudentFeedbackPage() {
  return (
    <Suspense
      fallback={
        <>
          <div className="hidden [[data-theme=kids]_&]:block">
            <FeedbackKidsLoading />
          </div>
          <div className="[[data-theme=kids]_&]:hidden">
            <FeedbackTeensLoading />
          </div>
        </>
      }
    >
      <FeedbackClient />
    </Suspense>
  );
}
