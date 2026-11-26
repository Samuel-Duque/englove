import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AsignacionesClient } from './asignaciones-client';
import styles from './asignaciones.module.css';

export const metadata: Metadata = {
  title: 'Asignaciones',
  description: 'Gestión y programación de asignaciones de actividades para grupos de estudiantes.',
};

export default function AssignmentsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className={styles.skeletonCard}>
          <span className="sr-only">Cargando asignaciones…</span>
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      }
    >
      <AsignacionesClient />
    </Suspense>
  );
}
