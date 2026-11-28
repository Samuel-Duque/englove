import { BookOpen } from 'lucide-react';
import styles from './actividad.module.css';

export function ActivityLoading() {
  return (
    <div className={styles.notebook} role="status">
      <div className={styles.skeleton + ' ' + styles.skeletonHeader}>
        <BookOpen size={24} aria-hidden="true" />
        <p className="font-bold">Preparando tu cuaderno de campo…</p>
      </div>
      <div className={styles.skeleton} aria-hidden="true">
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
      </div>
    </div>
  );
}

