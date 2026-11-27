'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronDown, Square, Star, Volume2 } from 'lucide-react';
import type { StudentFeedbackItemView } from '@upward-english/shared';
import { FoxExplorerIllustration } from '../../../components/fox-explorer-illustration';
import { AccessibleModal } from '../../../components/ui/modal';
import styles from './feedback-kids.module.css';

const typeLabels: Record<StudentFeedbackItemView['activityType'], string> = {
  fill_blank: 'Espacios en blanco',
  speaking: 'Expresión oral',
  open_question: 'Pregunta abierta',
  exam: 'Examen',
  game: 'Juego',
};

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
});
const deadlineFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value: string, formatter: Intl.DateTimeFormat) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatter.format(date) : null;
}

function Stars({ count }: { count: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${count} de 3 estrellas`}>
      {[1, 2, 3].map((index) => (
        <Star key={index} size={16} fill={index <= count ? 'var(--yellow)' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

function hasSpeechVoices() {
  return typeof window.SpeechSynthesisUtterance === 'function' &&
    Boolean(window.speechSynthesis?.getVoices().length);
}

function subscribeToVoices(onChange: () => void) {
  const synthesis = window.speechSynthesis;
  synthesis?.addEventListener('voiceschanged', onChange);
  return () => synthesis?.removeEventListener('voiceschanged', onChange);
}

interface FeedbackKidsProps {
  items: StudentFeedbackItemView[];
  expandedHistory: Readonly<Record<string, boolean>>;
  onToggleHistory: (assignmentId: string) => void;
  onStartRetry: (assignmentId: string) => void;
  startingAssignmentId: string | null;
  retryError: string | null;
  onDismissRetryError: () => void;
}

export function FeedbackKids({
  items,
  expandedHistory,
  onToggleHistory,
  onStartRetry,
  startingAssignmentId,
  retryError,
  onDismissRetryError,
}: FeedbackKidsProps) {
  const canListen = useSyncExternalStore(subscribeToVoices, hasSpeechVoices, () => false);
  const playback = useRef<SpeechSynthesisUtterance | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => () => {
    if (playback.current) {
      playback.current = null;
      window.speechSynthesis.cancel();
    }
  }, []);

  function toggleComment(assignmentId: string, comment: string) {
    const synthesis = window.speechSynthesis;
    playback.current = null;
    synthesis.cancel();
    if (playingId === assignmentId) {
      setPlayingId(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(comment);
    utterance.lang = 'es-CO';
    utterance.rate = 0.85;
    const finish = () => {
      if (playback.current !== utterance) return;
      playback.current = null;
      setPlayingId(null);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    playback.current = utterance;
    setPlayingId(assignmentId);
    synthesis.speak(utterance);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Postales de tu Profesora</h1>
      <AccessibleModal
        isOpen={Boolean(retryError)}
        onClose={onDismissRetryError}
        title="Aviso de intento"
        description={retryError ?? undefined}
        dialogClassName={styles.retryDialog}
      >
        <div className="flex justify-end">
          <button type="button" className="kids-button" data-tone="yellow" onClick={onDismissRetryError}>
            Entendido
          </button>
        </div>
      </AccessibleModal>

      {items.length === 0 && (
        <div className={styles.empty}>
          <FoxExplorerIllustration className={styles.fox} />
          <p>Todavía no tienes postales calificadas. Cuando tu profesora revise una entrega, aparecerá aquí.</p>
          <Link href="/inicio" className={`kids-button ${styles.cta}`} data-tone="yellow">
            Ir a mi ruta
          </Link>
        </div>
      )}

      {items.map((item) => {
        const { assignmentId, latestAttempt, attempts } = item;
        const comment = latestAttempt.comment;
        const historyId = `feedback-history-${assignmentId}`;
        const isHistoryOpen = Boolean(expandedHistory[assignmentId]);
        const isPlaying = playingId === assignmentId;
        const deadline = formatDate(item.effectiveDueAt, deadlineFormat);
        const gradedDate = formatDate(latestAttempt.gradedAt, dateFormat);

        return (
          <article key={assignmentId} className={styles.postcard} aria-labelledby={`feedback-title-${assignmentId}`}>
            <header className={styles.postmark} data-activity-type={item.activityType}>
              <div className={styles.heading}>
                <p className={styles.kind}>{typeLabels[item.activityType]}</p>
                <h2 id={`feedback-title-${assignmentId}`} lang="en">{item.activityTitle}</h2>
                {gradedDate && <time dateTime={latestAttempt.gradedAt}>{gradedDate}</time>}
              </div>
              <div className={styles.grade}>
                <div>
                  <p>Nota</p>
                  <p><strong>{latestAttempt.score.toFixed(1).replace('.', ',')}</strong> / 5,0</p>
                </div>
                <Stars count={latestAttempt.stars} />
              </div>
            </header>

            <div className={styles.body}>
              {comment?.trim() ? (
                <div className={styles.comment}>
                  <p><strong>Mensaje de tu profesora</strong></p>
                  <p className={styles.commentText}>{comment}</p>
                  {canListen && (
                    <button
                      type="button"
                      className="kids-button"
                      data-tone={isPlaying ? 'red' : 'yellow'}
                      aria-pressed={isPlaying}
                      onClick={() => toggleComment(assignmentId, comment)}
                    >
                      {isPlaying ? <Square size={18} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
                      Escuchar comentario
                    </button>
                  )}
                </div>
              ) : (
                <p className={styles.kind}>Sin comentario personalizado para esta entrega.</p>
              )}

              {latestAttempt.stickers.length > 0 && (
                <div>
                  <p><strong>Stickers recibidos</strong></p>
                  <ul className={styles.stickers} role="list">
                    {latestAttempt.stickers.slice(0, 3).map((sticker) => (
                      <li key={sticker.code}>
                        <span aria-hidden={Boolean(sticker.label)}>{sticker.emoji}</span>
                        {sticker.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.hasAvailableRetry && (
                <div className={styles.retry}>
                  <div>
                    <p><strong>¡Tu profesora te habilitó un nuevo intento!</strong></p>
                    {deadline && <p>Tienes plazo hasta el <time dateTime={item.effectiveDueAt}>{deadline}</time></p>}
                  </div>
                  <button
                    type="button"
                    className={`kids-button ${styles.cta}`}
                    data-tone="yellow"
                    disabled={startingAssignmentId !== null}
                    onClick={() => onStartRetry(assignmentId)}
                  >
                    {startingAssignmentId === assignmentId ? 'Iniciando…' : 'Intentar de nuevo'}
                  </button>
                </div>
              )}

              {attempts.length > 1 && (
                <div className={styles.history}>
                  <button
                    type="button"
                    className={styles.historyToggle}
                    aria-expanded={isHistoryOpen}
                    aria-controls={historyId}
                    onClick={() => onToggleHistory(assignmentId)}
                  >
                    <ChevronDown size={20} aria-hidden="true" />
                    {isHistoryOpen ? 'Ocultar historial de intentos' : `Ver historial de intentos (${attempts.length})`}
                  </button>
                  <ol id={historyId} role="list" hidden={!isHistoryOpen}>
                    {attempts.map((attempt) => {
                      const date = formatDate(attempt.gradedAt, dateFormat);
                      return (
                        <li key={attempt.id}>
                          <div className={styles.attemptHeading}>
                            <strong>Intento #{attempt.attemptNumber}</strong>
                            {date && <time dateTime={attempt.gradedAt}>{date}</time>}
                          </div>
                          <p className={styles.attemptScore}>
                            <strong>{attempt.score.toFixed(1).replace('.', ',')} / 5,0</strong>
                            <Stars count={attempt.stars} />
                          </p>
                          {attempt.comment && <p className={styles.commentText}>{attempt.comment}</p>}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
