'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Flag, Gamepad2, MessageSquare, Shield } from 'lucide-react';
import {
  StudentProgressViewSchema,
  type AssignmentCard,
  type StudentProgressView,
} from '@upward-english/shared';
import { FoxTeensIllustration } from '../../components/fox-teens-illustration';
import { ErrorState } from '../../components/error-state';
import { apiFetch } from '../../lib/api';
import { fetchSharedFeatureFlags } from '../../lib/feature-flags-client';
import type { AssignmentFilter } from './kids-inicio';
import styles from './teens-inicio.module.css';

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const typeLabels: Record<AssignmentCard['activity']['type'], string> = {
  fill_blank: 'Completar espacios',
  open_question: 'Pregunta abierta',
  speaking: 'Speaking',
  exam: 'Examen',
  game: 'Minijuego',
};

const filters: Record<AssignmentFilter, { label: string; matches: (card: AssignmentCard) => boolean }> = {
  all: { label: 'Todas', matches: () => true },
  pending: { label: 'Por hacer', matches: (card) => card.canStart || card.canContinue },
  completed: {
    label: 'Entregadas',
    matches: (card) =>
      card.latestAttempt?.status === 'graded' || card.latestAttempt?.status === 'pending_review',
  },
};

const filterIds: AssignmentFilter[] = ['all', 'pending', 'completed'];

function getActionableSummary(cards: AssignmentCard[]): string {
  const pendingCount = cards.filter((card) => card.canStart || card.canContinue).length;
  if (pendingCount === 0) {
    return 'Estás al día con tus actividades asignadas.';
  }
  if (pendingCount === 1) {
    return 'Tienes 1 actividad por hacer.';
  }
  return `Tienes ${pendingCount} actividades por hacer.`;
}

function getCardStatus(card: AssignmentCard): {
  key: 'in_progress' | 'retry' | 'pending' | 'graded' | 'pending_review';
  label: string;
} {
  if (card.canContinue) {
    return { key: 'in_progress', label: 'En progreso' };
  }
  if (card.retryAvailable && card.canStart) {
    return { key: 'retry', label: 'Reintento habilitado' };
  }
  if (card.latestAttempt?.status === 'graded') {
    return { key: 'graded', label: 'Calificada' };
  }
  if (card.latestAttempt?.status === 'pending_review') {
    return { key: 'pending_review', label: 'En revisión' };
  }
  return { key: 'pending', label: 'Pendiente' };
}

function TeensWeeklyLog({ userId }: { userId: string }) {
  const progress = useQuery({
    queryKey: ['student', 'progress', userId],
    queryFn: () =>
      apiFetch<StudentProgressView>('/api/v1/me/progress', {
        schema: StudentProgressViewSchema,
      }),
  });
  const streak = progress.data?.streak;

  return (
    <section className={styles.log} aria-labelledby="teens-weekly-title">
      <div className={styles.logHeader}>
        <h2 id="teens-weekly-title" className={styles.logTitle}>
          Bitácora semanal
        </h2>
        {streak && (
          <p className={styles.streakCount}>
            {streak.weeks} {streak.weeks === 1 ? 'semana activa' : 'semanas activas'}
          </p>
        )}
      </div>

      {streak ? (
        <>
          <div className={styles.weeks} aria-hidden="true">
            {[1, 2, 3, 4].map((week) => (
              <span
                key={week}
                className={styles.weekCell}
                data-reached={week <= streak.weeks}
              >
                {week <= streak.weeks ? <Check size={16} /> : <Flag size={15} />}
                <span>Sem. {week}</span>
              </span>
            ))}
          </div>
          <p className={styles.shield} data-available={streak.forgivenessAvailable}>
            <Shield size={17} aria-hidden="true" />
            {streak.forgivenessAvailable
              ? 'Escudo de perdón activo'
              : `Recuperando escudo: ${streak.activeWeeksSinceForgivenessUsed} de 2 semanas activas`}
          </p>
        </>
      ) : progress.isError ? (
        <div className="space-y-3">
          <p role="status" className={styles.logMuted}>
            No pudimos cargar tu bitácora semanal.
          </p>
          <button
            type="button"
            className="teens-button"
            onClick={() => void progress.refetch()}
          >
            Reintentar bitácora
          </button>
        </div>
      ) : (
        <p role="status" className={styles.logMuted}>
          Cargando tu bitácora…
        </p>
      )}
    </section>
  );
}

function TeensAssignmentCard({
  card,
  startingCardId,
  onStart,
}: {
  card: AssignmentCard;
  startingCardId: string | null;
  onStart: (assignmentId: string) => void;
}) {
  const attempt = card.latestAttempt;
  const due = new Date(card.effectiveDueAt || card.dueAt);
  const completeUntil = new Date(due.getTime() + 24 * 60 * 60 * 1000);
  const now = Date.now();
  const isGracePeriod = now > due.getTime() && now <= completeUntil.getTime();
  const hasDeadline = Number.isFinite(due.getTime());
  const score = attempt?.score;
  const stars = score == null ? 0 : score >= 4.5 ? 3 : score >= 3 ? 2 : score > 0 ? 1 : 0;
  const status = getCardStatus(card);

  return (
    <article className={styles.card} data-featured={card.canContinue}>
      <div className="space-y-3">
        <div className={styles.cardTop}>
          <span className={styles.typePill}>
            {typeLabels[card.activity.type]} · Nivel {card.activity.level}
          </span>
          <span className={styles.statusPill} data-status={status.key}>
            {status.label}
          </span>
        </div>

        <div className={styles.cardHeading}>
          <h3 lang="en">{card.activity.title}</h3>
          {hasDeadline && (
            <p className={styles.cardDeadline}>
              Límite: <time dateTime={due.toISOString()}>{dateFormat.format(due)}</time>
            </p>
          )}
        </div>

        {card.retryAvailable && (
          <p className={styles.callout} data-tone="retry">
            Tu profesora habilitó un nuevo intento{hasDeadline ? ` hasta el ${dateFormat.format(due)}` : ''}.
          </p>
        )}

        {isGracePeriod ? (
          <p className={styles.callout} data-tone="grace">
            Ventana de tolerancia 24 h: puedes terminar hasta el {dateFormat.format(completeUntil)} (Colombia).
          </p>
        ) : (
          card.canStart && (
            <p className={styles.meta}>
              Si empiezas antes del cierre, tendrás hasta 24 horas adicionales para terminar.
            </p>
          )
        )}

        {attempt?.status === 'graded' && score != null && (
          <div className={styles.grade}>
            <span>Nota: {score.toFixed(1).replace('.', ',')} / 5,0</span>
            <span
              className={styles.stars}
              role="img"
              aria-label={`${stars} de 3 estrellas`}
            >
              {'★'.repeat(stars) + '☆'.repeat(3 - stars)}
            </span>
          </div>
        )}

        {attempt?.status === 'pending_review' && (
          <p className={styles.callout}>En revisión por tu profesora</p>
        )}
      </div>

      <div className={styles.cardAction}>
        {card.canContinue && attempt ? (
          <Link href={`/actividad/${attempt.id}`} className="teens-button" data-tone="red">
            Continuar actividad <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : card.canStart ? (
          <button
            type="button"
            disabled={startingCardId !== null}
            className="teens-button"
            data-tone={card.retryAvailable ? 'yellow' : 'orange'}
            onClick={() => onStart(card.id)}
          >
            {startingCardId === card.id
              ? 'Iniciando…'
              : card.retryAvailable
                ? 'Intentar de nuevo'
                : 'Empezar actividad'}
          </button>
        ) : attempt ? (
          <Link href={`/actividad/${attempt.id}`} className="teens-button">
            Ver entrega y feedback
          </Link>
        ) : (
          <button type="button" disabled className="teens-button">
            Actividad no disponible
          </button>
        )}
      </div>
    </article>
  );
}

export function TeensInicio({
  userId,
  name,
  level,
  cards,
  activeFilter,
  setFilter,
  startingCardId,
  onStart,
  isLoading,
  hasError,
  onRetry,
}: {
  userId: string;
  name: string;
  level?: string | null;
  cards: AssignmentCard[];
  activeFilter: AssignmentFilter;
  setFilter: (filter: AssignmentFilter) => void;
  startingCardId: string | null;
  onStart: (id: string) => void;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
}) {
  const { data: features } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => fetchSharedFeatureFlags(),
    retry: false,
  });
  const gamesEnabled = features?.flags?.games === true;
  const filter = filters[activeFilter];
  const visibleCards = cards.filter((card) => filter.matches(card));

  return (
    <>
      <div className={styles.heroGrid}>
        <section className={styles.hero} data-teens-dark="" aria-labelledby="teens-hero-title">
          <div className={styles.heroContent}>
            {level && <span className={styles.heroBadge}>Nivel {level}</span>}
            <h1 id="teens-hero-title">Hola, {name}</h1>
            <p className={styles.heroSummary}>
              {isLoading ? 'Cargando tus actividades…' : getActionableSummary(cards)}
            </p>
            <div className={styles.heroActions}>
              {gamesEnabled && (
                <Link href="/juegos" className={styles.heroPrimary}>
                  <Gamepad2 size={19} aria-hidden="true" />
                  <span>Practicar en microjuegos</span>
                </Link>
              )}
              <Link href="/feedback" className={styles.heroSecondary}>
                <MessageSquare size={18} aria-hidden="true" />
                <span>Revisar feedback</span>
              </Link>
            </div>
          </div>
          <FoxTeensIllustration className={styles.heroFox} size={136} />
        </section>

        <TeensWeeklyLog userId={userId} />
      </div>

      <section aria-labelledby="teens-assignments-title">
        <h2 id="teens-assignments-title" className={styles.sectionTitle}>
          Actividades asignadas
        </h2>

        {isLoading ? (
          <div role="status">
            <p className={styles.loadingNotice}>Cargando tus actividades…</p>
            <div className={styles.cardGrid} aria-hidden="true">
              <span className={styles.skeletonCard} />
              <span className={styles.skeletonCard} />
            </div>
          </div>
        ) : hasError ? (
          <ErrorState
            variant="teens"
            message="No pudimos cargar tus actividades. Revisa tu conexión e inténtalo de nuevo."
            onRetry={onRetry}
          />
        ) : (
          <>
            <div className={styles.filters} role="group" aria-label="Filtrar actividades">
              {filterIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.filterChip}
                  aria-pressed={id === activeFilter}
                  onClick={() => setFilter(id)}
                >
                  {filters[id].label} ({cards.filter(filters[id].matches).length})
                </button>
              ))}
            </div>

            {visibleCards.length > 0 ? (
              <div className={styles.cardGrid}>
                {visibleCards.map((card) => (
                  <TeensAssignmentCard
                    key={card.id}
                    card={card}
                    startingCardId={startingCardId}
                    onStart={onStart}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <FoxTeensIllustration size={96} />
                <p>
                  {activeFilter === 'completed'
                    ? 'Todavía no tienes actividades entregadas.'
                    : 'No tienes actividades pendientes esta semana. Puedes practicar en la Zona de Microjuegos.'}
                </p>
                {gamesEnabled && (
                  <Link href="/juegos" className="teens-button" data-tone="orange">
                    <Gamepad2 size={18} aria-hidden="true" />
                    <span>Ir a Zona de Microjuegos</span>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
