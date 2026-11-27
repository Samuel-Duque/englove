'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Compass, Flag, Gamepad2, MessageCircle, Shield } from 'lucide-react';
import { StudentProgressViewSchema, type StudentProgressView, type AssignmentCard } from '@upward-english/shared';
import { FoxExplorerIllustration } from '../../components/fox-explorer-illustration';
import { ListenButton } from '../../components/listen-button';
import { ErrorState } from '../../components/error-state';
import { apiFetch } from '../../lib/api';
import { fetchSharedFeatureFlags } from '../../lib/feature-flags-client';
import styles from './kids-inicio.module.css';

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const typeLabels = {
  fill_blank: 'Completar espacios',
  open_question: 'Pregunta abierta',
  speaking: 'Speaking',
  exam: 'Examen',
  game: 'Minijuego',
};

export type AssignmentFilter = 'all' | 'pending' | 'completed';

const filters: Record<AssignmentFilter, { label: string; matches: (card: AssignmentCard) => boolean }> = {
  all: { label: 'Todas', matches: () => true },
  pending: { label: 'Por hacer', matches: (card) => card.canStart || card.canContinue },
  completed: {
    label: 'Entregadas',
    matches: (card) => card.latestAttempt?.status === 'graded' || card.latestAttempt?.status === 'pending_review',
  },
};

const filterIds: AssignmentFilter[] = ['all', 'pending', 'completed'];

function GamesLink() {
  return (
    <Link href="/juegos" className="kids-button" data-tone="orange">
      <Gamepad2 size={20} aria-hidden="true" /> Ir al campamento de juegos
    </Link>
  );
}

function WeeklyLog({ userId }: { userId: string }) {
  const progress = useQuery({
    queryKey: ['student', 'progress', userId],
    queryFn: () => apiFetch<StudentProgressView>('/api/v1/me/progress', { schema: StudentProgressViewSchema }),
  });
  const streak = progress.data?.streak;

  return (
    <section className={styles.log} aria-labelledby="weekly-title">
      <h2 id="weekly-title" className={styles.sectionTitle}>Bitácora semanal</h2>
      {streak ? (
        <>
          <p><strong>{streak.weeks}</strong> {streak.weeks === 1 ? 'semana de racha' : 'semanas de racha'}</p>
          <div className={styles.weeks} aria-hidden="true">
            {[1, 2, 3, 4].map((week) => (
              <span key={week} data-reached={week <= streak.weeks}>
                {week <= streak.weeks ? <Check size={18} /> : <Flag size={16} />}
                <span>Sem. {week}</span>
              </span>
            ))}
          </div>
          <p className={styles.shield} data-available={streak.forgivenessAvailable}>
            <Shield size={18} aria-hidden="true" />
            {streak.forgivenessAvailable
              ? 'Escudo de perdón disponible'
              : `Recuperando el escudo (${streak.activeWeeksSinceForgivenessUsed}/2 semanas)`}
          </p>
        </>
      ) : progress.isError ? (
        <>
          <p role="status">No pudimos cargar tu bitácora.</p>
          <button type="button" className="kids-button" onClick={() => void progress.refetch()}>Reintentar bitácora</button>
        </>
      ) : (
        <p role="status">Cargando tu bitácora…</p>
      )}
    </section>
  );
}

function MissionCard({ card, position, startingCardId, onStart }: {
  card: AssignmentCard;
  position: number;
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

  return (
    <article className={styles.card} data-featured={card.canContinue}>
      <div className={styles.strip} data-activity={card.activity.type}>
        <span>Parada {String(position).padStart(2, '0')} · {typeLabels[card.activity.type]}</span>
        <span>Nivel {card.activity.level}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardHeading}>
          <div>
            <h3 lang="en">{card.activity.title}</h3>
            {hasDeadline && <p>Fecha límite <time dateTime={due.toISOString()}>{dateFormat.format(due)}</time></p>}
          </div>
          <ListenButton text={card.activity.title} />
        </div>

        {card.retryAvailable && (
          <p className={styles.callout} data-tone="retry">
            Tu profesora te habilitó un nuevo intento{hasDeadline ? ` hasta el ${dateFormat.format(due)}` : ''}.
          </p>
        )}
        {isGracePeriod ? (
          <p className={styles.callout} data-tone="grace">Puedes terminar hasta el {dateFormat.format(completeUntil)} (Colombia).</p>
        ) : card.canStart && (
          <p className={styles.meta}>Si empiezas antes del cierre, tendrás hasta 24 horas más para terminar.</p>
        )}

        {attempt?.status === 'graded' && score != null && (
          <div className={styles.grade}>
            <span>Nota {score.toFixed(1).replace('.', ',')} / 5,0</span>
            <span className={styles.stars} role="img" aria-label={`${stars} de 3 estrellas`}>
              {'★'.repeat(stars) + '☆'.repeat(3 - stars)}
            </span>
          </div>
        )}
        {attempt?.status === 'pending_review' && <p className={styles.callout}>En revisión por tu profe</p>}

        <div className={styles.cardAction}>
          {card.canContinue && attempt ? (
            <Link href={`/actividad/${attempt.id}`} className="kids-button" data-tone="red">
              Continuar actividad <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ) : card.canStart ? (
            <button
              type="button"
              disabled={startingCardId !== null}
              className="kids-button"
              data-tone={card.retryAvailable ? 'yellow' : 'orange'}
              onClick={() => onStart(card.id)}
            >
              {startingCardId === card.id ? 'Iniciando…' : card.retryAvailable ? 'Intentar de nuevo' : 'Empezar actividad'}
            </button>
          ) : attempt ? (
            <Link href={`/actividad/${attempt.id}`} className="kids-button">Ver entrega y feedback</Link>
          ) : (
            <button type="button" disabled className="kids-button">Actividad no disponible</button>
          )}
        </div>
      </div>
    </article>
  );
}

export function KidsInicio({
  userId, name, level, cards, activeFilter, setFilter, startingCardId, onStart, isLoading, hasError, onRetry,
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
  const visibleCards = cards.map((card, index) => ({ card, position: index + 1 })).filter(({ card }) => filter.matches(card));

  return (
    <>
      <div className={styles.heroGrid}>
        <section className={styles.hero} aria-labelledby="diary-title">
          <div>
            <p className={styles.diaryLabel}><Compass size={18} aria-hidden="true" /> Diario de expedición</p>
            <h1 id="diary-title">¡Hola, {name}!</h1>
            <p>Explora, habla y descubre tu inglés.</p>
            {level && <p className={styles.level}>Nivel {level}</p>}
            <div className={styles.heroActions}>
              {gamesEnabled && <GamesLink />}
              <Link href="/feedback" className="kids-button">
                <MessageCircle size={18} aria-hidden="true" /> Ver mi feedback
              </Link>
            </div>
          </div>
          <FoxExplorerIllustration className={styles.heroFox} />
        </section>
        <WeeklyLog userId={userId} />
      </div>

      <section aria-labelledby="route-title">
        <h2 id="route-title" className={styles.sectionTitle}>Tu ruta de expedición</h2>
        {isLoading ? (
          <div role="status" className={styles.routeLoading}>
            Preparando tu ruta de hoy…
            <div className={styles.cardGrid} aria-hidden="true"><span /><span /></div>
          </div>
        ) : hasError ? (
          <ErrorState
            variant="kids"
            message="No pudimos cargar tus paradas. Revisa tu conexión e inténtalo de nuevo."
            onRetry={onRetry}
          />
        ) : (
          <>
            <div className={styles.filters} role="group" aria-label="Filtrar paradas">
              {filterIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="kids-button"
                  data-tone={id === activeFilter ? 'orange' : undefined}
                  aria-pressed={id === activeFilter}
                  onClick={() => setFilter(id)}
                >
                  {filters[id].label} ({cards.filter(filters[id].matches).length})
                </button>
              ))}
            </div>
            {visibleCards.length > 0 ? (
              <div className={styles.cardGrid}>
                {visibleCards.map(({ card, position }) => (
                  <MissionCard key={card.id} card={card} position={position} startingCardId={startingCardId} onStart={onStart} />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <FoxExplorerIllustration className={styles.emptyFox} />
                <h3>{activeFilter === 'completed' ? 'Todavía no tienes paradas entregadas.' : 'No tienes paradas pendientes esta semana.'}</h3>
                {gamesEnabled && <GamesLink />}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
