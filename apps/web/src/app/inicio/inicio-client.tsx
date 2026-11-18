"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Users,
  UserRound,
} from "lucide-react";
import styles from "./inicio.module.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  RemindersResponseSchema,
  AssignmentCardListResponseSchema,
  RuntimeViewSchema,
  type SessionView,
  type RemindersResponse,
  type AssignmentCard,
  type AssignmentCardListResponse,
  type RuntimeView,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../lib/api";
import {
  fetchSharedSession,
  fetchSharedProfile,
  requestSharedRefresh,
  clearSharedSession,
} from "../../lib/auth-session";
import { getActivityTypeLabel } from "../../lib/activity-labels";
import { TeacherShell } from "../../components/teacher-shell";
import { StudentFrame } from "../../components/student-shell";
import { AccessibleModal } from "../../components/ui/modal";

export function InicioClient() {
  const router = useRouter();
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<
    "all" | "pending" | "completed"
  >("all");
  const [startingCardId, setStartingCardId] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async (): Promise<SessionView | null> => {
      let sessionData = await fetchSharedSession();
      if (!sessionData) {
        const refreshed = await requestSharedRefresh().catch(() => false);
        if (refreshed) {
          sessionData = await fetchSharedSession();
        }
      }
      if (!sessionData) {
        clearSharedSession();
        router.replace("/login");
        return null;
      }
      return sessionData;
    },
  });

  const session = sessionQuery.data ?? null;
  const activeUserId = session?.user.id ?? null;

  const remindersQuery = useQuery({
    queryKey: ["teacher", "reminders", activeUserId],
    queryFn: () =>
      apiFetch<RemindersResponse>("/api/v1/dashboard/reminders", {
        schema: RemindersResponseSchema,
      }),
    enabled: session?.user.role === "teacher",
  });

  const cardsQuery = useQuery({
    queryKey: ["student", "assignments", activeUserId],
    queryFn: () =>
      apiFetch<AssignmentCardListResponse>("/api/v1/me/assignments", {
        schema: AssignmentCardListResponseSchema,
      }),
    enabled: session?.user.role === "student",
  });

  const profileQuery = useQuery({
    queryKey: ["student", "profile", activeUserId],
    queryFn: () => fetchSharedProfile(),
    enabled: session?.user.role === "student",
  });

  const startAttemptMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch<RuntimeView>(`/api/v1/assignments/${assignmentId}/attempts`, {
        method: "POST",
        schema: RuntimeViewSchema,
      }),
    onSuccess: (data) => {
      router.push(`/actividad/${data.attempt.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setAttemptError(
          err.message || "No se pudo iniciar el intento de la actividad.",
        );
      } else {
        setAttemptError(
          "Error de conexión al iniciar el intento. Verifica tu red y reintenta.",
        );
      }
      setStartingCardId(null);
    },
  });

  const handleStartAttempt = (assignmentId: string) => {
    setStartingCardId(assignmentId);
    setAttemptError(null);
    startAttemptMutation.mutate(assignmentId);
  };

  if (sessionQuery.isError || sessionQuery.isLoading || !session) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="origami-container origami-container--reading py-8"
      >
        {sessionQuery.isError ? (
          <section
            role="alert"
            className="origami-state origami-state--error space-y-3"
          >
            <h1 className="origami-page-title">Error de conexión</h1>
            <p>
              No pudimos abrir tu espacio. Verifica tu conexión y vuelve a
              intentar.
            </p>
            <button
              type="button"
              onClick={() => void sessionQuery.refetch()}
              className="origami-button origami-button--secondary"
            >
              Reintentar conexión
            </button>
          </section>
        ) : (
          <p role="status" className="origami-state">
            Cargando tu espacio…
          </p>
        )}
      </main>
    );
  }

  if (session.user.role === "teacher") {
    const reminders = remindersQuery.data;
    const management = [
      { href: "/asignaciones", label: "Asignaciones", Icon: CalendarDays },
      {
        href: "/actividades",
        label: "Catálogo de Actividades",
        Icon: BookOpen,
      },
      { href: "/grupos", label: "Gestión de Grupos", Icon: Users },
      { href: "/alumnos", label: "Gestión de Alumnos", Icon: UserRound },
      {
        href: "/revision",
        label: "Revisión y Calificación",
        Icon: ClipboardCheck,
      },
    ];
    return (
      <TeacherShell teacherName={session.user.name}>
        <header className={styles.stack}>
          <h1 className="origami-page-title">Panel Docente — Inicio</h1>
          <p className="origami-reading">
            Consulta las solicitudes de registro y las entregas que requieren
            atención.
          </p>
        </header>

        <section aria-labelledby="teacher-inbox" className={styles.stack}>
          <h2 id="teacher-inbox" className="origami-section-title">
            Avisos prioritarios
          </h2>
          {remindersQuery.isLoading ? (
            <p role="status" className="origami-state">
              Cargando avisos…
            </p>
          ) : remindersQuery.isError || !reminders ? (
            <div className="origami-state origami-state--error space-y-3">
              <p role="alert">
                No pudimos consultar las solicitudes y entregas pendientes.
              </p>
              <button
                type="button"
                onClick={() => void remindersQuery.refetch()}
                className="origami-button origami-button--secondary"
              >
                Volver a consultar
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="origami-card space-y-3">
                <h3 className="origami-card-title">Solicitudes de Registro</h3>
                <p className="origami-reading">
                  {reminders.pendingRegistrations === 0
                    ? "No hay alumnos pendientes de aprobación."
                    : reminders.pendingRegistrations === 1
                      ? "Hay 1 alumno esperando aprobación de cuenta."
                      : `Hay ${reminders.pendingRegistrations} alumnos esperando aprobación de cuenta.`}
                </p>
                <Link
                  href="/alumnos/solicitudes"
                  className="origami-button origami-button--secondary"
                >
                  Ver solicitudes
                </Link>
              </article>
              <article className="origami-card space-y-3">
                <h3 className="origami-card-title">Entregas sin Calificar</h3>
                <p className="origami-reading">
                  {reminders.overdueReviews === 0
                    ? `No hay entregas pendientes con más de ${reminders.ungradedReminderDays} días desde su cierre.`
                    : reminders.overdueReviews === 1
                      ? `Hay 1 entrega pendiente de calificar hace más de ${reminders.ungradedReminderDays} días.`
                      : `Hay ${reminders.overdueReviews} entregas pendientes de calificar hace más de ${reminders.ungradedReminderDays} días.`}
                </p>
                <Link
                  href="/revision"
                  className="origami-button origami-button--secondary"
                >
                  Ver entregas
                </Link>
              </article>
            </div>
          )}
        </section>

        <section aria-labelledby="teacher-management" className={styles.stack}>
          <h2 id="teacher-management" className="origami-section-title">
            Gestión del aula
          </h2>
          <ul className={styles.missions}>
            {management.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="origami-button origami-button--secondary w-full"
                >
                  <Icon aria-hidden="true" /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </TeacherShell>
    );
  }

  const ageSegment = session.student?.ageSegment ?? "kids";
  const assignmentCards = cardsQuery.data?.items ?? [];
  const pendingCards = assignmentCards.filter(
    (card) => card.canStart || card.canContinue,
  );
  const completedCards = assignmentCards.filter(
    (card) =>
      card.latestAttempt?.status === "graded" ||
      card.latestAttempt?.status === "pending_review",
  );
  const nextCard =
    pendingCards.find((card) => card.canContinue) ?? pendingCards[0];
  const filters = [
    { id: "all", label: "Todas", cards: assignmentCards },
    { id: "pending", label: "Por hacer", cards: pendingCards },
    { id: "completed", label: "Entregadas", cards: completedCards },
  ] as const;
  const filteredCards =
    filters.find(({ id }) => id === activeFilter)?.cards ?? assignmentCards;

  return (
    <StudentFrame
      studentName={session.user.name}
      ageSegment={ageSegment}
      level={profileQuery.data?.student?.level}
    >
      <AccessibleModal
        isOpen={!!attemptError}
        onClose={() => setAttemptError(null)}
        title="Aviso de Actividad"
      >
        <div className="space-y-4">
          <p>{attemptError}</p>
          <button
            type="button"
            onClick={() => setAttemptError(null)}
            className="origami-button"
          >
            Entendido
          </button>
        </div>
      </AccessibleModal>

      <header className={styles.stack}>
        <h1 className="origami-page-title">¡Hola, {session.user.name}!</h1>
        <p className="origami-reading">
          {ageSegment === "kids"
            ? "Elige una misión y practica inglés paso a paso."
            : "Consulta y continúa las actividades que te asignó tu profesora."}
        </p>
      </header>

      {cardsQuery.isLoading ? (
        <p role="status" className="origami-state">
          Cargando tus actividades…
        </p>
      ) : cardsQuery.isError ? (
        <section className="origami-state origami-state--error space-y-3">
          <p role="alert">No pudimos consultar tus actividades.</p>
          <button
            type="button"
            onClick={() => void cardsQuery.refetch()}
            className="origami-button origami-button--secondary"
          >
            Reintentar
          </button>
        </section>
      ) : (
        <section className={styles.stack} aria-labelledby="missions">
          <h2 id="missions" className="origami-section-title">
            Mis actividades
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar actividades"
          >
            {filters.map(({ id, label, cards }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveFilter(id)}
                aria-pressed={activeFilter === id}
                className={`origami-button origami-button--secondary ${activeFilter === id ? "origami-selected" : ""}`}
              >
                {label} ({cards.length})
              </button>
            ))}
          </div>

          {!filteredCards.length ? (
            <div className="origami-state space-y-3">
              <p>
                {activeFilter === "pending"
                  ? "No tienes actividades por hacer."
                  : activeFilter === "completed"
                    ? "Aún no tienes actividades entregadas."
                    : "Tu profesora aún no te ha asignado actividades."}
              </p>
              {activeFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className="origami-button origami-button--secondary"
                >
                  Ver todas las actividades
                </button>
              )}
            </div>
          ) : (
            <ul className={styles.missions}>
              {filteredCards.map((card) => (
                <MissionCard
                  key={card.id}
                  card={card}
                  featured={card.id === nextCard?.id}
                  starting={startingCardId === card.id}
                  onStart={() => handleStartAttempt(card.id)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </StudentFrame>
  );
}

const dueDateFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function MissionCard({
  card,
  featured,
  starting,
  onStart,
}: {
  card: AssignmentCard;
  featured: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  const dueAt = new Date(card.effectiveDueAt || card.dueAt);
  const hasDueDate = !Number.isNaN(dueAt.getTime());
  const completeUntil = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000);
  const now = Date.now();
  const isGracePeriod =
    hasDueDate && now > dueAt.getTime() && now <= completeUntil.getTime();
  const attempt = card.latestAttempt;
  const score = attempt?.score;

  return (
    <li
      className={`origami-card ${styles.mission} ${featured ? "origami-card--featured" : ""}`}
    >
      <div className={styles.stack}>
        {featured && <p className="origami-label">Siguiente actividad</p>}
        <p className="origami-meta">
          Nivel {card.activity.level} ·{" "}
          {getActivityTypeLabel(card.activity.type)}
        </p>
        <h3 className="origami-card-title">{card.activity.title}</h3>
        {hasDueDate && (
          <p className="origami-meta">
            Límite:{" "}
            <time dateTime={dueAt.toISOString()}>
              {dueDateFormat.format(dueAt)}
            </time>
          </p>
        )}
        {card.retryAvailable && (
          <p className="origami-state">
            Tu profesora te habilitó un nuevo intento.
          </p>
        )}
        {isGracePeriod && card.canContinue ? (
          <p className="origami-state origami-state--warning">
            Puedes terminar hasta {dueDateFormat.format(completeUntil)}{" "}
            (Colombia).
          </p>
        ) : (
          card.canStart && (
            <p className="origami-meta">
              Si empiezas antes del cierre, tendrás hasta 24 horas más para
              terminar.
            </p>
          )
        )}

        {attempt?.status === "graded" && score != null && (
          <p className="origami-label origami-tabular">
            Nota: {score.toFixed(1).replace(".", ",")} / 5,0
          </p>
        )}
        {attempt?.status === "pending_review" && (
          <p className="origami-state">En revisión por tu profesora</p>
        )}
      </div>

      <div>
        {card.canContinue && attempt ? (
          <Link
            href={`/actividad/${attempt.id}`}
            className="origami-button w-full"
          >
            Continuar actividad
          </Link>
        ) : card.canStart ? (
          <button
            type="button"
            disabled={starting}
            onClick={onStart}
            className="origami-button w-full"
          >
            {starting ? "Iniciando…" : "Empezar actividad"}
          </button>
        ) : attempt ? (
          <Link
            href={`/actividad/${attempt.id}`}
            className="origami-button origami-button--secondary w-full"
          >
            Ver detalles de entrega
          </Link>
        ) : (
          <p className="origami-state">Actividad no disponible</p>
        )}
      </div>
    </li>
  );
}
