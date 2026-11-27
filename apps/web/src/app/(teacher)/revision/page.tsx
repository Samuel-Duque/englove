import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { RevisionClient } from './revision-client';
import styles from './revision.module.css';

export const metadata: Metadata = {
  title: 'Revisión y Retroalimentación',
  description: 'Espacio docente para calificar entregas, revisar audios de Speaking y enviar retroalimentación.',
};

export default function RevisionPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page} role="status">
          <span className="sr-only">Cargando consola de revisión…</span>
          <div className={styles.splitLayout}>
            <div className={styles.skeletonStack}>
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
              <div className={styles.skeleton} />
            </div>
            <div className={`${styles.skeleton} ${styles.skeletonTall}`} />
          </div>
        </div>
      }
    >
      <RevisionClient />
    </Suspense>
  );
}
