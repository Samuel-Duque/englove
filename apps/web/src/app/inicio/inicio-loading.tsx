import React from 'react';
import styles from './kids-inicio.module.css';

export function InicioLoading() {
  return (
    <main id="main-content" tabIndex={-1} className="kids-loading outline-none">
      <div className={styles.loadingPage} role="status">
        <p>Preparando tu ruta de hoy…</p>
        <div className={styles.heroGrid} aria-hidden="true"><span /><span /></div>
        <div className={styles.cardGrid} aria-hidden="true"><span /><span /></div>
      </div>
    </main>
  );
}
