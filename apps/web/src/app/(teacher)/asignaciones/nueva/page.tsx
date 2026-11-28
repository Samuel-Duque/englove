import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { NuevaAsignacionClient } from './nueva-asignacion-client';
import styles from './nueva-asignacion.module.css';

export const metadata: Metadata = {
  title: 'Nueva asignación',
  description: 'Programa una actividad publicada para uno o varios grupos de estudiantes.',
};

export default function NewAssignmentPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page} role="status" aria-live="polite">
          <div className={styles.loadingWrap}>
            <p className={styles.loadingText}>Cargando formulario de asignación…</p>
            <div className={styles.skeletonBlock} />
            <div className={styles.skeletonBlock} />
          </div>
        </div>
      }
    >
      <NuevaAsignacionClient />
    </Suspense>
  );
}
