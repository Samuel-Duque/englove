import type { ReactNode } from 'react';
import { AccessibleModal, type ConfirmDialogProps } from './ui/modal';
import styles from './teacher-portal.module.css';

type BadgeTone = 'neutral' | 'ok' | 'warm' | 'accent' | 'danger';

const statusBadges = {
  activityPublished: ['Publicada', 'ok'],
  activityDraft: ['Borrador', 'neutral'],
  activityArchived: ['Archivada', 'warm'],
  assignmentOpen: ['Abierta', 'ok'],
  assignmentScheduled: ['Programada', 'accent'],
  assignmentClosed: ['Cerrada', 'neutral'],
  assignmentCancelled: ['Cancelada', 'danger'],
  reviewPending: ['Por revisar', 'danger'],
  reviewOverdue: ['Atrasada', 'danger'],
  reviewGraded: ['Calificada', 'ok'],
  studentPendingApproval: ['Pendiente de aprobación', 'warm'],
  studentLocked: ['Bloqueada (10 min)', 'danger'],
  streakActive: ['Activa', 'ok'],
  streakForgiven: ['Perdón aplicado', 'warm'],
} satisfies Record<string, [string, BadgeTone]>;

export function TeacherStatusBadge({ kind }: { kind: keyof typeof statusBadges }) {
  const [label, tone] = statusBadges[kind];
  return <EditorialBadge tone={tone}>{label}</EditorialBadge>;
}

export function EditorialBadge({ children, tone = 'neutral' }: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={styles.badge} data-tone={tone}>{children}</span>;
}

export function EditorialTable({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return (
    <div className={styles.tableScroll} role="region" aria-labelledby={labelledBy} tabIndex={0}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

export function EditorialConfirmDialog({
  isOpen, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar',
  isDestructive, isPending = false, onConfirm, onCancel,
}: ConfirmDialogProps & { isPending?: boolean }) {
  return (
    <AccessibleModal isOpen={isOpen} title={title} onClose={onCancel} dismissible={!isPending} dialogClassName={styles.dialog}>
      <p>{message}</p>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} aria-disabled={isPending || undefined} onClick={() => { if (!isPending) onCancel(); }}>{cancelText}</button>
        <button type="button" className={isDestructive ? styles.dangerButton : styles.primaryButton} aria-disabled={isPending || undefined} onClick={() => { if (!isPending) onConfirm(); }}>
          {isPending ? 'Procesando…' : confirmText}
        </button>
      </div>
    </AccessibleModal>
  );
}
