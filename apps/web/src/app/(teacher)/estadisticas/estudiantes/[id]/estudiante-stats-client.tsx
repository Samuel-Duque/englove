"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import {
  GAME_MECHANIC_LABELS,
  StudentStatsResponseSchema,
  type StudentStatsResponse,
  type WeekCalendarStatus,
} from "@upward-english/shared";
import { apiFetch, ApiError } from "../../../../../lib/api";
import { POLLING_INTERVAL_MS } from "../../../../../lib/query-client";
import styles from "./estudiante-stats.module.css";

const activityLabels = {
  fill_blank: "Completar espacios",
  open_question: "Pregunta abierta",
  speaking: "Pronunciación / Speaking",
  exam: "Examen",
  game: "Microjuego",
};

const weekStatuses = {
  active: { label: "Activa ✓", style: styles.active },
  forgiven: { label: "Perdón aplicado 🛡️", style: styles.forgiven },
  current_pending: { label: "En curso ⏳", style: styles.current },
  inactive: { label: "Inactiva", style: styles.inactive },
} satisfies Record<
  WeekCalendarStatus,
  { label: string; style: string | undefined }
>;

const timeModes = {
  dailyTime: "Por Día",
  weeklyTime: "Por Semana",
  monthlyTime: "Por Mes",
} as const;

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "short",
});
const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "short",
  timeStyle: "short",
});

function formatScore(score: number | null | undefined): string {
  return score == null ? "—" : score.toFixed(1).replace(".", ",");
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} s`;
}

function DateValue({
  value,
  withTime = false,
}: {
  value: string;
  withTime?: boolean;
}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return (
    <time dateTime={value}>
      {(withTime ? dateTimeFormat : dateFormat).format(date)}
    </time>
  );
}

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={styles.metric}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {children && <dd className={styles.metricDetail}>{children}</dd>}
    </div>
  );
}

function StatsTable({
  label,
  columns,
  children,
}: {
  label: string;
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div
      className={styles.tableScroll}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function GamesPractice({
  practice,
}: {
  practice: StudentStatsResponse["gamesPractice"];
}) {
  return (
    <section
      className={`${styles.section} ${styles.panel} ${practice?.totalSessions ? styles.callout : ""}`}
    >
      <h2>Práctica en juegos</h2>
      {practice?.totalSessions ? (
        <>
          <dl className={styles.gameMetrics}>
            <Metric label="Partidas jugadas" value={practice.totalSessions} />
            <Metric
              label="Juegos distintos"
              value={practice.uniqueGamesPlayed}
            />
            <Metric
              label="Tiempo de práctica"
              value={formatDuration(practice.totalPracticeTimeSeconds)}
            />
          </dl>
          {!!practice.byMechanic?.length && (
            <div className={styles.section}>
              <h3>Desglose por mecánica</h3>
              <StatsTable
                label="Desglose por mecánica"
                columns={[
                  "Mecánica",
                  "Partidas",
                  "Juegos distintos",
                  "Tiempo practicado",
                ]}
              >
                {practice.byMechanic.map((item) => (
                  <tr key={item.mechanic}>
                    <th scope="row">{GAME_MECHANIC_LABELS[item.mechanic]}</th>
                    <td>{item.sessionsCount}</td>
                    <td>{item.uniqueGamesCount}</td>
                    <td>{formatDuration(item.practiceTimeSeconds)}</td>
                  </tr>
                ))}
              </StatsTable>
            </div>
          )}
          {!!practice.sessions?.length && (
            <div className={styles.section}>
              <h3>Historial cronológico de partidas (Bogotá)</h3>
              <StatsTable
                label="Historial de partidas"
                columns={[
                  "Fecha y hora",
                  "Microjuego",
                  "Mecánica",
                  "Estrellas",
                  "Duración",
                ]}
              >
                {practice.sessions.map((session) => (
                  <tr key={session.attemptId}>
                    <td>{session.playedAtBogota}</td>
                    <th scope="row" lang="en">
                      {session.activityTitle}
                    </th>
                    <td>
                      {session.mechanic
                        ? GAME_MECHANIC_LABELS[session.mechanic]
                        : "—"}
                    </td>
                    <td>{session.stars} de 3</td>
                    <td>{formatDuration(session.durationSeconds)}</td>
                  </tr>
                ))}
              </StatsTable>
            </div>
          )}
        </>
      ) : (
        <p className={styles.muted}>
          Sin partidas registradas en el periodo seleccionado.
        </p>
      )}
    </section>
  );
}

export function EstudianteStatsClient({ studentId }: { studentId: string }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [timeBucketMode, setTimeBucketMode] =
    useState<keyof typeof timeModes>("weeklyTime");

  const params = new URLSearchParams();
  if (fromDate) params.set("from", new Date(fromDate).toISOString());
  if (toDate) params.set("to", new Date(toDate).toISOString());
  if (selectedType) params.set("type", selectedType);
  if (selectedLevel) params.set("level", selectedLevel);
  const queryString = params.toString();

  const studentStatsQuery = useQuery({
    queryKey: ["stats", "student", studentId, queryString],
    queryFn: () =>
      apiFetch<StudentStatsResponse>(
        `/api/v1/stats/students/${studentId}?${queryString}`,
        { schema: StudentStatsResponseSchema },
      ),
    refetchInterval: POLLING_INTERVAL_MS,
  });
  const { data, error, isPending, isFetching, refetch } = studentStatsQuery;
  const refresh = () => {
    void refetch();
  };
  const student = data?.student;
  const performance = data?.performance;
  const consistency = data?.consistency;
  const timeBuckets = consistency?.[timeBucketMode] ?? [];

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
        <Link href="/estadisticas">Estadísticas</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">
          {student?.name ?? "Ficha de estudiante"}
        </span>
      </nav>

      <header className={styles.header}>
        <div className={styles.identity}>
          <h1>{student?.name ?? "Ficha de estudiante"}</h1>
          <p className={styles.studentMeta}>
            {student && (
              <>
                <span className={styles.badge}>Nivel {student.level}</span>
                <span className={styles.badge}>
                  {student.ageSegment === "kids" ? "Kids" : "Teens"}
                </span>
                <strong>{student.groupName || "Sin grupo"}</strong>
                {student.joinedAt && (
                  <span>
                    Registro <DateValue value={student.joinedAt} />
                  </span>
                )}
              </>
            )}
          </p>
          {isPending && (
            <div className={styles.metaSkeleton} aria-hidden="true" />
          )}
        </div>
        <div className={styles.actions}>
          {isPending && (
            <span className={styles.profileSkeleton} aria-hidden="true" />
          )}
          {student && (
            <Link className={styles.control} href={`/alumnos/${studentId}`}>
              Ver ficha de alumno <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            className={styles.control}
            onClick={refresh}
            disabled={isFetching}
          >
            <RefreshCw size={16} aria-hidden="true" /> Refrescar
          </button>
          <span className={styles.polling}>
            <span aria-hidden="true" />
            Actualización cada {POLLING_INTERVAL_MS / 1000} s
          </span>
        </div>
      </header>

      <fieldset className={styles.filters} aria-label="Filtros de estadísticas">
        <div>
          <label htmlFor="student-filter-from">Desde</label>
          <input
            id="student-filter-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="student-filter-to">Hasta</label>
          <input
            id="student-filter-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="student-filter-type">Tipo evaluable</label>
          <select
            id="student-filter-type"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
          >
            <option value="">Todos los tipos</option>
            <option value="fill_blank">{activityLabels.fill_blank}</option>
            <option value="open_question">
              {activityLabels.open_question}
            </option>
            <option value="speaking">{activityLabels.speaking}</option>
            <option value="exam">{activityLabels.exam}</option>
          </select>
        </div>
        <div>
          <label htmlFor="student-filter-level">Nivel</label>
          <select
            id="student-filter-level"
            value={selectedLevel}
            onChange={(event) => setSelectedLevel(event.target.value)}
          >
            <option value="">Todos los niveles</option>
            {["A1", "A2", "B1", "B2"].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </div>
        {(fromDate || toDate || selectedType || selectedLevel) && (
          <button
            type="button"
            className={styles.control}
            onClick={() => {
              setFromDate("");
              setToDate("");
              setSelectedType("");
              setSelectedLevel("");
            }}
          >
            Limpiar filtros
          </button>
        )}
      </fieldset>

      {error && (
        <div className={styles.error}>
          <p role="alert">
            {error instanceof ApiError
              ? error.message
              : "Error al cargar la información del estudiante."}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.control}
              onClick={refresh}
              disabled={isFetching}
            >
              Reintentar
            </button>
            <Link className={styles.control} href="/estadisticas">
              Volver a estadísticas
            </Link>
          </div>
        </div>
      )}

      {isPending && (
        <div className={styles.section} role="status">
          <span className="sr-only">Cargando ficha del estudiante…</span>
          <div className={styles.metrics} aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className={styles.metricSkeleton} key={index} />
            ))}
          </div>
          <div className={styles.calendar} aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <div className={styles.weekSkeleton} key={index} />
            ))}
          </div>
        </div>
      )}

      {performance && consistency && (
        <>
          <section
            className={styles.section}
            aria-labelledby="student-performance"
          >
            <div className={styles.sectionHeading}>
              <h2 id="student-performance">Rendimiento</h2>
              <p>
                Umbral de aprobación{" "}
                <strong>{formatScore(performance.passingScore)}</strong>
              </p>
            </div>
            <dl className={styles.metrics}>
              <Metric
                label="Promedio del alumno"
                value={formatScore(performance.studentAverageScore)}
              />
              <Metric
                label="Promedio del grupo"
                value={formatScore(performance.groupAverageScore)}
              />
              <Metric
                label="Tasa de aprobación"
                value={
                  performance.passRatePercent == null
                    ? "—"
                    : `${performance.passRatePercent}%`
                }
              >
                {performance.passedCount} aprobadas ·{" "}
                {performance.needsImprovementCount} por mejorar
              </Metric>
              <Metric
                label="Actividades completadas"
                value={consistency.completedAssignedCount}
              >
                {performance.totalGradedActivities} calificadas en el periodo
              </Metric>
            </dl>
            <div className={`${styles.panel} ${styles.section}`}>
              <h3>Evolución de notas (0,0–5,0)</h3>
              {performance.scoreSeries.length ? (
                <StatsTable
                  label="Historial cronológico de notas"
                  columns={[
                    "Actividad",
                    "Tipo",
                    "Nivel",
                    "Intento",
                    "Calificación",
                    "Estado",
                    "Observaciones",
                    "Fecha",
                  ]}
                >
                  {performance.scoreSeries.map((item) => (
                    <tr key={item.attemptId}>
                      <th scope="row" lang="en">
                        {item.activityTitle}
                      </th>
                      <td>{activityLabels[item.activityType]}</td>
                      <td>{item.level}</td>
                      <td>{item.attemptNumber}</td>
                      <td>
                        <strong>{formatScore(item.score)}</strong>
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${item.passed ? styles.active : styles.current}`}
                        >
                          {item.passed ? "Aprobada" : "Por mejorar"}
                        </span>
                      </td>
                      <td>
                        {[
                          item.usedExtendedDeadline && "Plazo extendido",
                          // guardrails-ignore G-C06: bandera calculada en servidor como parte de SPEC-08
                          item.implausibleDuration && "Duración atípica",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td>
                        <DateValue value={item.gradedAt} />
                      </td>
                    </tr>
                  ))}
                </StatsTable>
              ) : (
                <p className={styles.muted}>
                  No hay entregas calificadas en el periodo seleccionado.
                </p>
              )}
            </div>
            {(performance.byActivityType.length > 0 ||
              performance.byLevel.length > 0) && (
              <div className={styles.breakdowns}>
                {performance.byActivityType.length > 0 && (
                  <div className={styles.panel}>
                    <h3>Por tipo de actividad</h3>
                    <dl className={styles.breakdown}>
                      {performance.byActivityType.map((item) => (
                        <div key={item.type}>
                          <dt>
                            {activityLabels[item.type]} ({item.gradedCount})
                          </dt>
                          <dd>{formatScore(item.averageScore)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                {performance.byLevel.length > 0 && (
                  <div className={styles.panel}>
                    <h3>Por nivel MCER</h3>
                    <dl className={styles.breakdown}>
                      {performance.byLevel.map((item) => (
                        <div key={item.level}>
                          <dt>
                            {item.level} ({item.gradedCount})
                          </dt>
                          <dd>{formatScore(item.averageScore)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            )}
          </section>

          <section
            className={styles.section}
            aria-labelledby="student-consistency"
          >
            <div className={styles.sectionHeading}>
              <h2 id="student-consistency">Constancia</h2>
            </div>
            <dl className={styles.metrics}>
              <Metric
                label="Racha vigente"
                value={`${consistency.currentStreakWeeks} sem.`}
              >
                Mejor racha: {consistency.bestStreakWeeks} semanas
              </Metric>
              <Metric
                label="Perdón de racha"
                value={
                  consistency.forgivenessAvailable ? "Disponible" : "Consumido"
                }
              >
                Se recupera tras 2 semanas consecutivas activas
              </Metric>
              <Metric
                label="Cumplimiento de asignaciones"
                value={
                  consistency.completionRatePercent == null
                    ? "—"
                    : `${consistency.completionRatePercent}%`
                }
              >
                {consistency.completedAssignedCount} de{" "}
                {consistency.assignedCount} asignaciones obligatorias
              </Metric>
              <Metric
                label="Tiempo total dedicado"
                value={formatDuration(consistency.totalTimeSpentSeconds)}
              >
                {consistency.completedActivitiesInPeriod} entregas completadas
                en el periodo
              </Metric>
            </dl>
            <div className={`${styles.panel} ${styles.section}`}>
              <div className={styles.sectionHeading}>
                <h3>Calendario de constancia</h3>
                <p>Últimas 12 semanas ISO · Hora de Bogotá</p>
              </div>
              <ul
                className={styles.calendar}
                role="list"
                aria-label="Semanas del calendario de constancia"
              >
                {consistency.weeklyCalendar.map((week) => (
                  <li key={week.weekKey} className={styles.week}>
                    <strong>{week.weekKey}</strong>
                    <time dateTime={week.weekStart}>{week.weekStart}</time>
                    <span>
                      {week.completedCount}{" "}
                      {week.completedCount === 1 ? "entrega" : "entregas"}
                    </span>
                    <span
                      className={`${styles.badge} ${weekStatuses[week.status].style}`}
                    >
                      {weekStatuses[week.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${styles.panel} ${styles.section}`}>
              <div className={styles.sectionHeading}>
                <h3>Desglose de tiempo de estudio</h3>
                <div
                  className={styles.timeModes}
                  role="group"
                  aria-label="Agrupar tiempo de estudio"
                >
                  {(["dailyTime", "weeklyTime", "monthlyTime"] as const).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={styles.control}
                        aria-pressed={timeBucketMode === mode}
                        onClick={() => setTimeBucketMode(mode)}
                      >
                        {timeModes[mode]}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {timeBuckets.length ? (
                <StatsTable
                  label="Tiempo de estudio"
                  columns={[
                    "Periodo",
                    "Tiempo total dedicado",
                    "Actividades completadas",
                  ]}
                >
                  {timeBuckets.map((item) => (
                    <tr key={item.bucketKey}>
                      <th scope="row">{item.bucketKey}</th>
                      <td>{formatDuration(item.timeSpentSeconds)}</td>
                      <td>{item.completedCount}</td>
                    </tr>
                  ))}
                </StatsTable>
              ) : (
                <p className={styles.muted}>
                  No hay registros de tiempo para el rango seleccionado.
                </p>
              )}
            </div>
            {consistency.offlineUndeliveredAttempts.length ? (
              <section
                data-testid="offline-undelivered-attempts-section"
                className={`${styles.panel} ${styles.callout} ${styles.section}`}
              >
                <h3 className={styles.calloutHeading}>
                  <AlertTriangle size={19} aria-hidden="true" /> Entregas que no
                  llegaron a tiempo
                </h3>
                <StatsTable
                  label="Entregas que no llegaron a tiempo"
                  columns={[
                    "Actividad",
                    "Inicio",
                    "Límite de entrega (Bogotá)",
                  ]}
                >
                  {consistency.offlineUndeliveredAttempts.map((attempt) => (
                    <tr key={attempt.attemptId}>
                      <th scope="row" lang="en">
                        {attempt.activityTitle}
                      </th>
                      <td>
                        <DateValue value={attempt.startedAt} withTime />
                      </td>
                      <td>
                        <DateValue value={attempt.completeUntil} withTime />
                      </td>
                    </tr>
                  ))}
                </StatsTable>
              </section>
            ) : (
              <p className={`${styles.panel} ${styles.muted}`}>
                No hay entregas fuera de plazo por falta de conexión en el
                periodo seleccionado.
              </p>
            )}
          </section>

          <GamesPractice practice={data.gamesPractice} />
        </>
      )}
    </div>
  );
}
