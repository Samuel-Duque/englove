import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ActivityLoading } from './activity-loading';
import { ActividadRunner } from './actividad-runner';

export const metadata: Metadata = {
  title: 'Actividad en Curso',
};

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function ActividadPage({ params }: PageProps) {
  const { attemptId } = await params;
  return (
    <Suspense fallback={<ActivityLoading />}>
      <ActividadRunner attemptId={attemptId} />
    </Suspense>
  );
}
