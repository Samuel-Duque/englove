import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AsignacionDetailClient } from './asignacion-detail-client';
import styles from './asignacion-detail.module.css';

export const metadata: Metadata = {
  title: 'Detalle de Asignación',
  description: 'Detalle y seguimiento de la asignación.',
};

function AssignmentDetailSkeleton() {
  return (
    <div className={styles.page} role="status">
      <span className="sr-only">Cargando detalle de la asignación…</span>
      <div className={`${styles.skeletonBlock} ${styles.skeletonHeader}`} aria-hidden="true" />
      <div className={styles.kpiGrid} aria-hidden="true">
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonBlock} />
      </div>
      <div className={`${styles.skeletonBlock} ${styles.skeletonTable}`} aria-hidden="true" />
    </div>
  );
}

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = await params;
  return (
    <Suspense fallback={<AssignmentDetailSkeleton />}>
      <AsignacionDetailClient id={unwrappedParams.id} />
    </Suspense>
  );
}
