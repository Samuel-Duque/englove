import React from 'react';
import styles from './feedback-kids.module.css';
import teensStyles from './feedback-teens.module.css';

export function FeedbackKidsLoading() {
  return (
    <div className={styles.page} role="status">
      <p className={styles.loadingLabel}>Trayendo las postales de tu profesora…</p>
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
    </div>
  );
}

export function FeedbackTeensLoading() {
  return (
    <div className={teensStyles.page} role="status">
      <p className={teensStyles.meta}>Cargando tu retroalimentación…</p>
      <div className={teensStyles.skeleton} aria-hidden="true" />
      <div className={teensStyles.skeleton} aria-hidden="true" />
    </div>
  );
}
