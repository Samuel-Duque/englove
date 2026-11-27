import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Gamepad2,
  Layers,
  Link2,
  ListOrdered,
  Move,
  Play,
  RotateCcw,
  Star,
  Timer,
} from 'lucide-react';
import {
  GAME_MECHANIC_LABELS,
  getGameMotivationMessage,
  scoreToGameStars,
  type GameMechanic,
  type StudentGameCard,
} from '@upward-english/shared';
import { FoxTeensIllustration } from '../../../components/fox-teens-illustration';
import styles from './teens-games.module.css';

const mechanicIcons = {
  match: Link2,
  order_words: ListOrdered,
  drag_drop: Move,
  memory: Layers,
  timed_choice: Timer,
} satisfies Record<GameMechanic, typeof Gamepad2>;

const filters = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Por practicar' },
  { value: 'completed', label: 'Jugados' },
] as const;

export type TeensGameFilter = (typeof filters)[number]['value'];

interface TeensGamesZoneProps {
  games: StudentGameCard[];
  filteredGames: StudentGameCard[];
  filter: TeensGameFilter;
  onFilterChange: (filter: TeensGameFilter) => void;
  gamesEnabled: boolean;
  catalogAvailable: boolean;
  queryError: Error | null;
  isWaitingForNetwork: boolean;
  actionError: string | null;
  onDismissActionError: () => void;
  startingGameId: string | null;
  onStart: (game: StudentGameCard) => void;
}

function bestStars(game: StudentGameCard): number {
  return (
    game.bestStars ??
    (game.bestScore == null
      ? (game.lastStars ?? 0)
      : scoreToGameStars(game.bestScore))
  );
}

function TeensGameCard({
  game,
  startingGameId,
  onStart,
}: Pick<TeensGamesZoneProps, 'startingGameId' | 'onStart'> & {
  game: StudentGameCard;
}) {
  const MechanicIcon = game.mechanic ? mechanicIcons[game.mechanic] : Gamepad2;
  const stars = bestStars(game);
  const isCompleted = game.status === 'completed';
  const resumeId =
    game.status === 'in_progress' ? game.inProgressAttemptId : null;
  const isStarting = startingGameId === game.id;
  const motivation =
    game.bestScore == null && stars === 0
      ? 'Practica a tu ritmo para sumar estrellas.'
      : getGameMotivationMessage(
          game.bestScore ?? (stars === 3 ? 4.5 : stars === 2 ? 3.5 : 1.5),
        );

  return (
    <article
      className={styles.card}
      data-status={game.status}
      aria-labelledby={`teens-game-title-${game.id}`}
    >
      <div className={styles.cardContent}>
        <div className={styles.cardMeta}>
          <span className={styles.mechanicBadge}>
            {game.mechanic ? GAME_MECHANIC_LABELS[game.mechanic] : 'Microjuego'}
          </span>
          <span className={styles.levelBadge}>Nivel {game.level}</span>
        </div>

        <div className={styles.titleRow}>
          <span className={styles.mechanicIcon} aria-hidden="true">
            <MechanicIcon size={24} />
          </span>
          <h2 id={`teens-game-title-${game.id}`} lang="en">
            {game.title}
          </h2>
        </div>

        <div className={styles.practiceRow}>
          <div
            className={styles.stars}
            role="img"
            aria-label={`Estrellas de práctica: ${stars} de 3`}
          >
            {[1, 2, 3].map((star) => {
              const active = star <= stars;
              return (
                <svg
                  key={star}
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2L3 9.4l6.2-.9L12 2.8Z"
                    fill={active ? 'var(--yellow, #ffca3a)' : 'var(--surface-1, #ffffff)'}
                    stroke={active ? 'var(--border-active, #4a2511)' : 'var(--border-control, #9a7b5c)'}
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                  />
                </svg>
              );
            })}
          </div>
          <span>
            {game.attemptsCount}{' '}
            {game.attemptsCount === 1 ? 'partida' : 'partidas'}
          </span>
        </div>

        <p className={styles.motivation}>{motivation}</p>
      </div>

      {resumeId ? (
        <Link
          href={`/actividad/${resumeId}`}
          className={styles.action}
          data-action="resume"
        >
          <Play size={18} aria-hidden="true" />
          <span>Reanudar partida</span>
        </Link>
      ) : (
        <button
          type="button"
          className={styles.action}
          data-action={isCompleted ? 'replay' : 'play'}
          disabled={startingGameId !== null}
          onClick={() => onStart(game)}
        >
          {isCompleted ? (
            <RotateCcw size={18} aria-hidden="true" />
          ) : (
            <Play size={18} aria-hidden="true" />
          )}
          <span>
            {isStarting
              ? 'Iniciando…'
              : isCompleted
                ? 'Jugar de nuevo'
                : 'Jugar'}
          </span>
        </button>
      )}
    </article>
  );
}

export function TeensGamesZone({
  games,
  filteredGames,
  filter,
  onFilterChange,
  gamesEnabled,
  catalogAvailable,
  queryError,
  isWaitingForNetwork,
  actionError,
  onDismissActionError,
  ...cardActions
}: TeensGamesZoneProps) {
  const [dismissedQueryError, setDismissedQueryError] = useState<Error | null>(
    null,
  );

  if (!gamesEnabled && !queryError && !isWaitingForNetwork) {
    return (
      <div className={styles.zone}>
        <section className={styles.noticeCard} aria-labelledby="teens-games-disabled">
          <FoxTeensIllustration className={styles.noticeIllustration} />
          <h1 id="teens-games-disabled">Microjuegos no disponibles</h1>
          <p>
            La Zona de Microjuegos aún no está habilitada. Consulta con tu
            profesora.
          </p>
          <Link
            href="/inicio"
            className={`${styles.action} ${styles.noticeAction}`}
            data-action="play"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span>Volver a inicio</span>
          </Link>
        </section>
      </div>
    );
  }

  const visibleQueryError =
    queryError !== dismissedQueryError ? queryError : null;
  const completedCount = games.filter(
    (game) => game.status === 'completed',
  ).length;
  const counts = {
    all: games.length,
    pending: games.length - completedCount,
    completed: completedCount,
  };
  const showCatalog = gamesEnabled && catalogAvailable;
  const totalStars = games.reduce((sum, game) => sum + bestStars(game), 0);
  const maxStars = games.length * 3;
  const totalAttempts = games.reduce((sum, game) => sum + game.attemptsCount, 0);

  return (
    <div className={styles.zone}>
      <header className={styles.banner}>
        <div className={styles.bannerIntro}>
          <span className={styles.kicker}>Práctica libre 24/7</span>
          <h1>Zona de Microjuegos</h1>
          <p className={styles.bannerSubtitle}>
            Practica vocabulario y estructuras a tu ritmo. Los microjuegos dan
            estrellas de práctica y nunca afectan tus notas.
          </p>
        </div>

        {showCatalog && (
          <div className={styles.stats}>
            <div className={styles.statPill}>
              <Star
                size={18}
                fill="var(--yellow, #ffca3a)"
                stroke="var(--border-active, #4a2511)"
                aria-hidden="true"
              />
              <span>
                Estrellas de práctica:{' '}
                <strong>
                  {totalStars} / {maxStars}
                </strong>
              </span>
            </div>
            <div className={styles.statPill}>
              <Gamepad2 size={18} aria-hidden="true" />
              <span>
                Partidas jugadas: <strong>{totalAttempts}</strong>
              </span>
            </div>
          </div>
        )}
      </header>

      {(actionError || visibleQueryError) && (
        <div className={styles.alert}>
          <p role="alert">{actionError ?? visibleQueryError?.message}</p>
          <button
            type="button"
            className={styles.alertClose}
            onClick={() => {
              if (actionError) onDismissActionError();
              else setDismissedQueryError(queryError);
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      {isWaitingForNetwork && (
        <div className={styles.noticeCard} role="status">
          <p>La Zona de Microjuegos se cargará cuando vuelva la conexión.</p>
        </div>
      )}

      {showCatalog && (
        <>
          <div
            className={styles.filters}
            role="group"
            aria-label="Filtrar microjuegos"
          >
            {filters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => onFilterChange(value)}
              >
                {label} ({counts[value]})
              </button>
            ))}
          </div>

          {filteredGames.length > 0 ? (
            <div className={styles.grid}>
              {filteredGames.map((game) => (
                <TeensGameCard key={game.id} game={game} {...cardActions} />
              ))}
            </div>
          ) : (
            <div className={styles.noticeCard} role="status">
              <FoxTeensIllustration className={styles.noticeIllustration} />
              <p>
                No hay microjuegos disponibles en esta vista por ahora. Cuando
                tu profesora publique nuevos retos, aparecerán aquí.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
