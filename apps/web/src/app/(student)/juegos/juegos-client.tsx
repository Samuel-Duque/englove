"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Check,
  Gamepad2,
  Play,
  RotateCcw,
  Square,
  Star,
  Volume2,
} from "lucide-react";
import {
  type StudentGameCard,
  type StudentGamesListResponse,
  StudentGamesListResponseSchema,
  GAME_MECHANIC_LABELS,
  scoreToGameStars,
  getGameMotivationMessage,
  z,
} from "@upward-english/shared";
import { OrigamiCrane } from "../../../components/ui/origami-brand";
import { apiFetch, ApiError } from "../../../lib/api";
import { fetchSharedFeatureFlags } from "../../../lib/feature-flags-client";
import { fetchSharedProfile } from "../../../lib/auth-session";
import { speak } from "../../../lib/speech";
import styles from "./juegos.module.css";

const filters = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Por practicar" },
  { key: "completed", label: "Jugados" },
] as const;

interface GameCabinetCardProps {
  game: StudentGameCard;
  isStarting: boolean;
  isSpeaking: boolean;
  onSpeak: () => void;
  onStart: () => void;
}

function GameCabinetCard({
  game,
  isStarting,
  isSpeaking,
  onSpeak,
  onStart,
}: GameCabinetCardProps) {
  const headingId = useId();
  const isCompleted = game.status === "completed";
  const stars =
    game.bestStars ??
    (game.bestScore !== undefined && game.bestScore !== null
      ? scoreToGameStars(game.bestScore)
      : (game.lastStars ?? 0));
  const motivationMessage =
    game.bestScore !== undefined && game.bestScore !== null
      ? getGameMotivationMessage(game.bestScore)
      : stars > 0
        ? getGameMotivationMessage(stars === 3 ? 5.0 : stars === 2 ? 3.5 : 1.5)
        : null;
  const resumeId =
    game.status === "in_progress" ? game.inProgressAttemptId : null;
  const StartIcon = isCompleted ? RotateCcw : Gamepad2;

  return (
    <article
      aria-labelledby={headingId}
      className={`origami-card ${styles.cabinet}`}
      data-mechanic={game.mechanic}
    >
      <div className={styles.marquee}>
        <h2 id={headingId} className="origami-card-title">
          {game.title}
        </h2>
        <p className={styles.meta}>
          <span>Nivel {game.level}</span>
          <span>{GAME_MECHANIC_LABELS[game.mechanic] ?? "Microjuego"}</span>
        </p>
      </div>

      <div className={`origami-wood ${styles.frame}`}>
        <Image
          src={`/origami/games-${game.mechanic.replaceAll("_", "-")}.svg`}
          alt=""
          width={400}
          height={300}
          unoptimized
          className={styles.art}
        />
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          onClick={onSpeak}
          aria-label={
            isSpeaking
              ? `Detener lectura de ${game.title}`
              : `Escuchar ${game.title}`
          }
          className="origami-button origami-button--secondary"
        >
          {isSpeaking ? (
            <Square aria-hidden="true" />
          ) : (
            <Volume2 aria-hidden="true" />
          )}
          {isSpeaking ? "Detener lectura" : "Escuchar"}
        </button>

        <div className={styles.practice}>
          <span
            className={styles.stars}
            role="img"
            aria-label={`Estrellas de práctica: ${stars} de 3`}
          >
            {[1, 2, 3].map((star) => (
              <Star key={star} aria-hidden="true" data-earned={star <= stars} />
            ))}
          </span>
          {game.attemptsCount > 0 && (
            <span className="origami-meta">
              {game.attemptsCount}{" "}
              {game.attemptsCount === 1 ? "partida" : "partidas"}
            </span>
          )}
          {motivationMessage && (
            <p className="origami-meta">{motivationMessage}</p>
          )}
        </div>

        {resumeId ? (
          <Link
            href={`/actividad/${resumeId}`}
            className={`origami-button ${styles.gameAction}`}
          >
            <Play aria-hidden="true" />
            Reanudar partida
          </Link>
        ) : (
          <button
            type="button"
            disabled={isStarting}
            onClick={onStart}
            className={`origami-button ${styles.gameAction}`}
          >
            <StartIcon aria-hidden="true" />
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

export function JuegosClient() {
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ["student", "profile", "shell"],
    queryFn: () => fetchSharedProfile(),
  });
  const ageSegment = profileQuery.data?.student?.ageSegment ?? "kids";
  const isKids = ageSegment === "kids";

  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const allGamesFilter = useRef<HTMLButtonElement>(null);
  const [startingGameId, setStartingGameId] = useState<string | null>(null);
  const [speakingGameId, setSpeakingGameId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const flagsQuery = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const flagRes = await fetchSharedFeatureFlags();
      if (!flagRes) throw new Error("No se pudieron obtener las feature flags");
      return flagRes;
    },
  });

  const gamesEnabled = Boolean(flagsQuery.data?.flags?.games);

  const gamesQuery = useQuery({
    queryKey: ["student", "games"],
    queryFn: () =>
      apiFetch<StudentGamesListResponse>("/api/v1/me/games", {
        schema: StudentGamesListResponseSchema,
      }),
    enabled: gamesEnabled,
  });

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startGameMutation = useMutation({
    mutationFn: (gameId: string) =>
      apiFetch<{ attempt: { id: string } }>(
        `/api/v1/activities/${gameId}/attempts`,
        {
          method: "POST",
          schema: z.object({ attempt: z.object({ id: z.string() }) }),
        },
      ),
    onSuccess: (res) => {
      router.push(`/actividad/${res.attempt.id}`);
    },
    onError: (err: unknown, gameId: string) => {
      const game = games.find((g) => g.id === gameId);
      if (err instanceof ApiError) {
        if (
          err.code === "ATTEMPT_ALREADY_EXISTS" &&
          game?.inProgressAttemptId
        ) {
          router.push(`/actividad/${game.inProgressAttemptId}`);
          return;
        }
        setActionError(err.message);
      } else {
        setActionError("No se pudo iniciar el juego");
      }
      setStartingGameId(null);
    },
  });

  const isLoading =
    flagsQuery.isLoading || (gamesEnabled && gamesQuery.isLoading);
  const games: StudentGameCard[] = gamesQuery.data?.items || [];
  const listError = flagsQuery.error ?? gamesQuery.error;

  const handleSpeak = (game: StudentGameCard) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingGameId === game.id) {
      window.speechSynthesis.cancel();
      setSpeakingGameId(null);
      return;
    }
    setSpeakingGameId(game.id);
    speak(game.title, () => setSpeakingGameId(null));
  };

  const handleStartGame = (game: StudentGameCard) => {
    // If there is already an in-progress attempt, navigate directly to it
    if (game.status === "in_progress" && game.inProgressAttemptId) {
      router.push(`/actividad/${game.inProgressAttemptId}`);
      return;
    }

    setStartingGameId(game.id);
    setActionError(null);
    startGameMutation.mutate(game.id);
  };

  // Filtered cards
  const filteredGames = games.filter((game) => {
    if (filter === "pending") return game.status !== "completed";
    if (filter === "completed") return game.status === "completed";
    return true;
  });

  if (isLoading) {
    return (
      <div className={`origami-shell ${styles.catalog}`}>
        <div role="status" className={`origami-card ${styles.state}`}>
          <Gamepad2 aria-hidden="true" />
          <p>Cargando la zona de juegos…</p>
        </div>
      </div>
    );
  }

  // Feature flag check (SPEC-06 RF-11)
  if (!gamesEnabled) {
    return (
      <div className={`origami-shell ${styles.catalog}`}>
        <div className={`origami-card ${styles.state}`}>
          <Gamepad2 aria-hidden="true" />
          <h1 className="origami-page-title">Microjuegos no disponibles</h1>
          {listError ? (
            <p role="alert">
              No se pudo abrir la zona de juegos. Intenta recargar la página.
            </p>
          ) : (
            <p>
              La zona de juegos interactivos no está habilitada en este momento.
              Consulta más tarde con tu profesora.
            </p>
          )}
          <Link href="/inicio" className="origami-button">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const counts = {
    all: games.length,
    pending: games.filter((game) => game.status !== "completed").length,
    completed: games.filter((game) => game.status === "completed").length,
  };
  const accessDenied =
    listError instanceof ApiError && listError.statusCode === 403;

  return (
    <div className={`origami-shell ${styles.catalog}`}>
      <header className={`origami-card ${styles.header}`}>
        <div className={styles.headerCopy}>
          <h1 className="origami-page-title">Zona de Microjuegos</h1>
          <p className="origami-reading">
            Practica inglés jugando. Gana estrellas y repasa todas las veces que
            quieras.
          </p>
        </div>
        {isKids && <OrigamiCrane className={styles.crane} />}
      </header>

      {(!listError || games.length > 0) && (
        <div
          role="group"
          aria-label="Filtrar microjuegos"
          className={styles.filters}
        >
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              ref={key === "all" ? allGamesFilter : undefined}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`origami-button origami-button--secondary ${styles.filter}${filter === key ? " origami-selected" : ""}`}
            >
              <Check className={styles.filterMark} aria-hidden="true" />
              {label} ({counts[key]})
            </button>
          ))}
        </div>
      )}

      {listError && (
        <div className={`origami-state origami-state--error ${styles.notice}`}>
          <p role="alert">
            {accessDenied
              ? "No tienes acceso al catálogo de juegos en este momento."
              : "No se pudo cargar el catálogo de juegos. Intenta recargar la página."}
          </p>
          {accessDenied && (
            <Link
              href="/inicio"
              className="origami-button origami-button--secondary"
            >
              Volver al inicio
            </Link>
          )}
        </div>
      )}

      {actionError && (
        <div className={`origami-state origami-state--error ${styles.notice}`}>
          <p role="alert">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="origami-button origami-button--secondary"
          >
            Cerrar
          </button>
        </div>
      )}

      {filteredGames.length > 0 ? (
        <div className={styles.cabinets}>
          {filteredGames.map((game) => (
            <GameCabinetCard
              key={game.id}
              game={game}
              isStarting={startingGameId === game.id}
              isSpeaking={speakingGameId === game.id}
              onSpeak={() => handleSpeak(game)}
              onStart={() => handleStartGame(game)}
            />
          ))}
        </div>
      ) : !listError ? (
        <div className={`origami-card ${styles.state}`}>
          <Gamepad2 aria-hidden="true" />
          {games.length === 0 ? (
            <>
              <h2 className="origami-section-title">
                Todavía no hay juegos publicados para practicar.
              </h2>
              <p>Cuando tu profesora publique microjuegos, aparecerán aquí.</p>
            </>
          ) : (
            <>
              <h2 className="origami-section-title">
                No hay juegos en esta selección.
              </h2>
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  allGamesFilter.current?.focus();
                }}
                className="origami-button origami-button--secondary"
              >
                Ver todos los juegos
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
