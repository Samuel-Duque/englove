import { useState } from "react";
import Link from "next/link";
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
  Tent,
  Timer,
} from "lucide-react";
import {
  GAME_MECHANIC_LABELS,
  getGameMotivationMessage,
  scoreToGameStars,
  type GameMechanic,
  type StudentGameCard,
} from "@upward-english/shared";
import { FoxExplorerIllustration } from "../../../components/fox-explorer-illustration";
import { ListenButton } from "../../../components/listen-button";
import styles from "./games-camp.module.css";

const mechanicIcons = {
  match: Link2,
  order_words: ListOrdered,
  drag_drop: Move,
  memory: Layers,
  timed_choice: Timer,
} satisfies Record<GameMechanic, typeof Gamepad2>;

const filters = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Por practicar" },
  { value: "completed", label: "Jugados" },
] as const;

type GameFilter = (typeof filters)[number]["value"];

interface KidsGamesCampProps {
  games: StudentGameCard[];
  filteredGames: StudentGameCard[];
  filter: GameFilter;
  onFilterChange: (filter: GameFilter) => void;
  gamesEnabled: boolean;
  catalogAvailable: boolean;
  queryError: Error | null;
  isWaitingForNetwork: boolean;
  actionError: string | null;
  onDismissActionError: () => void;
  startingGameId: string | null;
  onStart: (game: StudentGameCard) => void;
}

function bestStars(game: StudentGameCard) {
  return (
    game.bestStars ??
    (game.bestScore == null
      ? (game.lastStars ?? 0)
      : scoreToGameStars(game.bestScore))
  );
}

function CampGameCard({
  game,
  startingGameId,
  onStart,
}: Pick<KidsGamesCampProps, "startingGameId" | "onStart"> & {
  game: StudentGameCard;
}) {
  const MechanicIcon = game.mechanic ? mechanicIcons[game.mechanic] : Gamepad2;
  const stars = bestStars(game);
  const isCompleted = game.status === "completed";
  const resumeId =
    game.status === "in_progress" ? game.inProgressAttemptId : null;
  const isStarting = startingGameId === game.id;
  const motivation =
    game.bestScore == null && stars === 0
      ? "¡Juega para ganar tus primeras estrellas!"
      : getGameMotivationMessage(
          game.bestScore ?? (stars === 3 ? 4.5 : stars === 2 ? 3.5 : 1.5),
        );

  return (
    <article
      className={styles.card}
      data-status={game.status}
      aria-labelledby={`game-title-${game.id}`}
    >
      <div className={styles.cardTop}>
        <span className={styles.mechanic}>
          {game.mechanic ? GAME_MECHANIC_LABELS[game.mechanic] : "Microjuego"}
        </span>
        <span>Nivel {game.level}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.titleRow}>
          <span className={styles.mechanicIcon} aria-hidden="true">
            <MechanicIcon size={28} />
          </span>
          <h2 id={`game-title-${game.id}`} lang="en">
            {game.title}
          </h2>
          <ListenButton text={game.title} />
        </div>
        <div className={styles.practice}>
          <div
            className={styles.stars}
            role="img"
            aria-label={`Estrellas de práctica: ${stars} de 3`}
          >
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                size={24}
                fill={star <= stars ? "var(--yellow)" : "var(--border-soft)"}
                aria-hidden="true"
              />
            ))}
          </div>
          <span>
            {game.attemptsCount}{" "}
            {game.attemptsCount === 1 ? "partida" : "partidas"}
          </span>
        </div>
        <p className={styles.motivation}>{motivation}</p>
        {resumeId ? (
          <Link
            href={`/actividad/${resumeId}`}
            className={styles.action}
            data-action="resume"
          >
            <Play size={18} aria-hidden="true" />
            Reanudar partida
          </Link>
        ) : (
          <button
            type="button"
            className={styles.action}
            data-action={isCompleted ? "replay" : "play"}
            disabled={startingGameId !== null}
            onClick={() => onStart(game)}
          >
            {isCompleted ? (
              <RotateCcw size={18} aria-hidden="true" />
            ) : (
              <Play size={18} aria-hidden="true" />
            )}
            {isStarting
              ? "Iniciando…"
              : isCompleted
                ? "Jugar de nuevo"
                : "Jugar"}
          </button>
        )}
      </div>
    </article>
  );
}

export function KidsGamesCamp({
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
}: KidsGamesCampProps) {
  const [dismissedQueryError, setDismissedQueryError] = useState<Error | null>(
    null,
  );

  if (!gamesEnabled && !queryError && !isWaitingForNetwork) {
    return (
      <div className={styles.camp}>
        <div className={styles.notice}>
          <FoxExplorerIllustration />
          <h1>Microjuegos no disponibles</h1>
          <p>
            El Campamento de Microjuegos aún no está abierto. Tu profesora lo
            activará pronto.
          </p>
          <Link href="/inicio" className={styles.action} data-action="play">
            <ArrowLeft size={18} aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const visibleQueryError =
    queryError !== dismissedQueryError ? queryError : null;
  const completedCount = games.filter(
    (game) => game.status === "completed",
  ).length;
  const counts = {
    all: games.length,
    pending: games.length - completedCount,
    completed: completedCount,
  };
  const showCatalog = gamesEnabled && catalogAvailable;

  return (
    <div className={styles.camp}>
      <header className={styles.banner}>
        <div className={styles.bannerIntro}>
          <span className={styles.bannerIcon} aria-hidden="true">
            <Tent size={32} />
          </span>
          <div>
            <h1>Campamento de Microjuegos</h1>
            <p>Practica inglés cuando quieras. ¡Juega y gana estrellas!</p>
          </div>
        </div>
        {showCatalog && (
          <div className={styles.totals}>
            <p>
              <Star size={19} fill="var(--yellow)" aria-hidden="true" />
              <span>
                Estrellas de práctica:{" "}
                <strong>
                  {games.reduce((sum, game) => sum + bestStars(game), 0)} /{" "}
                  {games.length * 3}
                </strong>
              </span>
            </p>
            <p>
              <Gamepad2 size={19} aria-hidden="true" />
              <span>
                Partidas jugadas:{" "}
                <strong>
                  {games.reduce((sum, game) => sum + game.attemptsCount, 0)}
                </strong>
              </span>
            </p>
          </div>
        )}
      </header>

      {(actionError || visibleQueryError) && (
        <div className={styles.alert}>
          <p role="alert">{actionError ?? visibleQueryError?.message}</p>
          <button
            type="button"
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
        <p className={styles.notice} role="status">
          El campamento se cargará cuando vuelva la conexión.
        </p>
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

          {filteredGames.length ? (
            <div className={styles.grid}>
              {filteredGames.map((game) => (
                <CampGameCard key={game.id} game={game} {...cardActions} />
              ))}
            </div>
          ) : (
            <div className={styles.notice} role="status">
              <FoxExplorerIllustration />
              <p>
                Todavía no hay juegos publicados en esta pestaña. ¡Vuelve
                pronto!
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
