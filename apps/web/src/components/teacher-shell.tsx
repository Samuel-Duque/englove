import { Suspense, type ReactNode } from 'react';
import { TeacherOfflineStatusBanner } from './offline-status-banner';
import { TeacherBreadcrumbs, TeacherNav } from './teacher-nav';
import styles from './teacher-portal.module.css';

export function TeacherShell({ children, teacherName, utility }: {
  children: ReactNode;
  teacherName?: string;
  utility?: ReactNode;
}) {
  return (
    <div data-teacher-shell="" className={styles.shell}>
      <Suspense fallback={<div className={styles.sidebar} aria-hidden="true" />}>
        <TeacherNav teacherName={teacherName} />
      </Suspense>
      <div className={styles.workspace}>
        <div className={styles.utilityBar}>
          <div className={styles.utilityInner}>
            {utility ?? <Suspense fallback={<span>Panel Docente</span>}><TeacherBreadcrumbs /></Suspense>}
          </div>
        </div>
        <TeacherOfflineStatusBanner />
        <main id="main-content" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
