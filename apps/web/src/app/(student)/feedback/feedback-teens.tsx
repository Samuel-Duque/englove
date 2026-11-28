import React from 'react';
import { ChevronDown, Star } from 'lucide-react';
import type { StudentFeedbackItemView } from '@upward-english/shared';
import { FoxTeensIllustration } from '../../../components/fox-teens-illustration';
import { AccessibleModal } from '../../../components/ui/modal';
import styles from './feedback-teens.module.css';

const typeLabels: Record<StudentFeedbackItemView['activityType'], string> = {
  fill_blank: 'Espacios en blanco',
  speaking: 'Expresión oral',
  open_question: 'Pregunta abierta',
  exam: 'Examen',
  game: 'Juego',
};

const gradeFormat = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateOptions = { timeZone: 'America/Bogota', day: 'numeric', month: 'short' } as const;
const dateFormat = new Intl.DateTimeFormat('es-CO', dateOptions);
const deadlineFormat = new Intl.DateTimeFormat('es-CO', {
  ...dateOptions,
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value: string, formatter: Intl.DateTimeFormat) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatter.format(date) : null;
}

function Grade({ score, stars }: { score: number; stars: number }) {
  return (
    <div className={styles.grade}>
      <p className={styles.gradeValue}>
        <strong>{gradeFormat.format(score)}</strong> / 5,0
      </p>
      <span className={styles.stars} role="img" aria-label={`${stars} de 3 estrellas`}>
        {[1, 2, 3].map((star) => (
          <Star key={star} size={17} fill={star <= stars ? 'var(--yellow)' : 'none'} aria-hidden="true" />
        ))}
      </span>
    </div>
  );
}

interface FeedbackTeensProps {
  items: StudentFeedbackItemView[];
  expandedHistory: Readonly<Record<string, boolean>>;
  onToggleHistory: (assignmentId: string) => void;
  onStartRetry: (assignmentId: string) => void;
  startingAssignmentId: string | null;
  retryError: string | null;
  onDismissRetryError: () => void;
}

export function FeedbackTeens({
  items,
  expandedHistory,
  onToggleHistory,
  onStartRetry,
  startingAssignmentId,
  retryError,
  onDismissRetryError,
}: FeedbackTeensProps) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Mi Feedback</h1>
      <AccessibleModal
        isOpen={Boolean(retryError)}
        onClose={onDismissRetryError}
        title="Aviso de intento"
        description={retryError ?? undefined}
        dialogClassName={styles.dialog}
      >
        <div className={styles.dialogActions}>
          <button type="button" className="teens-button" data-tone="yellow" onClick={onDismissRetryError}>
            Entendido
          </button>
        </div>
      </AccessibleModal>

      {items.length === 0 && (
        <div className={`${styles.card} ${styles.empty}`}>
          <FoxTeensIllustration size={96} />
          <h2>Aún no tienes actividades calificadas</h2>
          <p>Cuando tu profesora revise tus entregas, verás aquí su feedback.</p>
        </div>
      )}

      {items.map(({ assignmentId, activityTitle, activityType, latestAttempt, attempts, hasAvailableRetry, effectiveDueAt }) => {
        const titleId = `feedback-title-${assignmentId}`;
        const historyId = `feedback-history-${assignmentId}`;
        const isHistoryOpen = Boolean(expandedHistory[assignmentId]);
        const gradedDate = formatDate(latestAttempt.gradedAt, dateFormat);
        const deadline = formatDate(effectiveDueAt, deadlineFormat);

        return (
          <article key={assignmentId} className={styles.card} aria-labelledby={titleId}>
            <header className={styles.header}>
              <div>
                <p className={styles.meta}>{typeLabels[activityType]}</p>
                <h2 id={titleId} lang="en">{activityTitle}</h2>
                {gradedDate && <time className={styles.meta} dateTime={latestAttempt.gradedAt}>{gradedDate}</time>}
              </div>
              <div className={styles.gradePanel}>
                <p className={styles.meta}>Nota</p>
                <Grade score={latestAttempt.score} stars={latestAttempt.stars} />
              </div>
            </header>

            {latestAttempt.comment?.trim() ? (
              <div className={styles.comment}>
                <h3>Mensaje de tu profesora</h3>
                <p>{latestAttempt.comment}</p>
              </div>
            ) : (
              <p className={styles.meta}>Sin comentario personalizado para esta entrega.</p>
            )}

            {latestAttempt.stickers.length > 0 && (
              <div>
                <h3>Stickers recibidos</h3>
                <ul className={styles.stickers} role="list">
                  {latestAttempt.stickers.slice(0, 3).map((sticker) => (
                    <li key={sticker.code}>
                      <span aria-hidden={Boolean(sticker.label)}>{sticker.emoji}</span>
                      {sticker.label && <span lang="en">{sticker.label}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasAvailableRetry && (
              <div className={styles.retry}>
                <div>
                  <h3>Tu profesora te habilitó un nuevo intento</h3>
                  {deadline && <p>Tienes plazo hasta el <time dateTime={effectiveDueAt}>{deadline}</time></p>}
                </div>
                <button
                  type="button"
                  className={`teens-button ${styles.retryButton}`}
                  data-tone="yellow"
                  aria-disabled={startingAssignmentId !== null}
                  onClick={() => {
                    if (startingAssignmentId === null) onStartRetry(assignmentId);
                  }}
                >
                  {startingAssignmentId === assignmentId ? 'Iniciando…' : 'Intentar de nuevo'}
                </button>
              </div>
            )}

            {attempts.length > 1 && (
              <div className={styles.history}>
                <button
                  className={styles.historyToggle}
                  type="button"
                  aria-expanded={isHistoryOpen}
                  aria-controls={historyId}
                  onClick={() => onToggleHistory(assignmentId)}
                >
                  <ChevronDown size={18} aria-hidden="true" />
                  {isHistoryOpen ? 'Ocultar historial de intentos' : `Ver historial de intentos (${attempts.length})`}
                </button>
                <ol id={historyId} role="list" hidden={!isHistoryOpen}>
                  {attempts.map((attempt) => {
                    const date = formatDate(attempt.gradedAt, dateFormat);
                    return (
                      <li key={attempt.id}>
                        <div className={styles.attemptHeader}>
                          <strong>Intento #{attempt.attemptNumber}</strong>
                          {date && <time className={styles.meta} dateTime={attempt.gradedAt}>{date}</time>}
                        </div>
                        <Grade score={attempt.score} stars={attempt.stars} />
                        {attempt.comment && <p className={styles.attemptComment}>{attempt.comment}</p>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
