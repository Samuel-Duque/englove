# SPEC-08 — Estadísticas de rendimiento y constancia

| Campo | Valor |
|---|---|
| Estado | Borrador |
| Etapa | 8 — Estadísticas y leaderboard |
| Tareas | ENG-100, ENG-101, ENG-102, ENG-103, ENG-104 |
| Referencias | `.agents/CONTEXT.md` §5.1, §5.3, §5.4, §12.8, §14 (Decisiones 20, 23, 25, 34, 41, 61, 66, 71, 73, 74, 76, 79, 98, 100, 104, 110, 111); `planning/architecture-overview.md` §6, §7.8, §9.3, §9.4; `planning/pbp-development.md` (Etapa 8); `specs/SPEC-01-scaffold.md` a `specs/SPEC-07-revision-y-feedback.md` |
| Aprobada por / fecha | — |

## 1. Contexto y objetivo

Al finalizar la Etapa 7, Englove persiste el desempeño y el hábito de estudio en dos tablas complementarias: `Attempt` (intentos con nota `0,0–5,0`, marcas de duración y plazos efectivos) y `ProgressEvent` (historial inmutable de entregas completadas, audios enviados, semanas de racha e insignias). Asimismo, existen `PendingSummaryService` (`ENG-045` / `ENG-090`) y la plantilla `'teacher-pending-summary'` en `MailService` (`ENG-020`), pendientes de conectarse al job periódico de correo y a las vistas analíticas.

`SPEC-08` especifica las tareas `ENG-100` a `ENG-104` de la Etapa 8:

1. **Motor de consultas e índices (`StatsModule`, `ENG-100`):** agregaciones separadas en los ejes de **rendimiento** (qué tan bien le va al alumno) y **constancia** (qué tan seguido practica), con presupuesto de respuesta `< 500 ms` sobre el volumen de 100 estudiantes y 3 meses (`seed-volume.ts`).
2. **Panel estadístico docente (`/estadisticas`, `ENG-101`, `ENG-102`, `ENG-103`):** vistas General, Por grupo, Leaderboard privado y Por estudiante con actualización automática por polling cada 30 segundos, restringidas exclusivamente al rol `teacher`.
3. **Recordatorio automático cada 3 días (`teacher_pending_summary`, `ENG-104`):** cron a las `08:00 America/Bogota` con idempotencia en `ScheduledJobRun` que envía el resumen de solicitudes y revisiones vencidas a la profesora solo cuando el conteo sea mayor que cero.

## 2. Alcance

### Entra en esta spec

- **`ENG-100` — Consultas agregadas, reglas de cálculo e índices (`< 500 ms`):**
  - Separación de fuentes (`Attempt` para rendimiento; `ProgressEvent` + duraciones de `Attempt` para constancia, Decisión 71).
  - Regla del último intento calificado (`MAX(attempt_number)` con `status = 'graded'`) en promedios agregados, manteniendo la serie histórica por intento (`1..N`) en microjuegos individuales (`game`, Decisiones 25, 74 y 104).
  - Universo de alumnos obligados por membresía histórica solapada con `[opens_at, due_at]` (Decisión 73), denominador congelado con `Assignment.historical_student_count` en asignaciones cerradas (Decisión 34 §14), exclusión de asignaciones canceladas (`cancelled_at IS NOT NULL`) del universo de cumplimiento conservando sus notas y eventos (Decisión 98), y exclusión de microjuegos (`game`, práctica autónoma 24/7) del numerador y denominador de cumplimiento de asignaciones (Decisión 111).
  - Recorte de duración por intento a `expected_duration_seconds * 3` y marcas de plazo extendido y duración implausible (Decisiones 61 y 79).
  - Índices compuestos en `Attempt` y `ProgressEvent` verificados con `seed-volume.ts` (`< 500 ms`) y vista materializada de contingencia `daily_student_activity` solo si se supera dicho umbral.
- **`ENG-101` — Vista general y vista por grupo con polling de 30 s:**
  - Endpoints `GET /api/v1/stats/overview` y `GET /api/v1/stats/groups/:id`.
  - Vistas en `apps/web/src/app/(teacher)/estadisticas/` con polling cada 30 s, métricas por nivel MCER (`A1`–`B2`) y por grupo, alertas de alumnos sin actividad en las últimas 2 semanas y tabla ordenable de grupo con ambos ejes y tendencia.
- **`ENG-102` — Leaderboard privado para la profesora:**
  - Endpoint `GET /api/v1/stats/leaderboard` y pestaña en `/estadisticas` protegidos por `@Roles(Role.teacher)` (sin feature flags `stats` ni `leaderboard`, Decisiones 34 §7 y 41).
- **`ENG-103` — Vista individual por estudiante y validación con la profesora:**
  - Endpoint `GET /api/v1/stats/students/:id` y página `/estadisticas/estudiantes/[id]` con serie temporal contra el promedio del grupo, desgloses por `ActivityType` y `GameMechanic`, distribución respecto a `passing_score = 3.0`, calendario semanal de constancia, racha vigente y mejor racha histórica, tasa de finalización y tiempo dedicado (diario, semanal y mensual).
- **`ENG-104` — Job cada 3 días de resumen de pendientes por correo:**
  - Ejecución cron a las `08:00 America/Bogota` registrada en `ScheduledJobRun` (`job_key = 'teacher_pending_summary'`), consultando `PendingSummaryService` y enviando `'teacher-pending-summary'` vía `MailService` solo cuando existan pendientes.

### Queda fuera de esta spec

- **Leaderboard público entre alumnos o comparativas visibles para `student`:** prohibido en el piloto (`.agents/CONTEXT.md` §2.4 y §5.4).
- **Feature flags `stats` o `leaderboard`:** descartados por las Decisiones 34 §7 y 41.
- **Exportación a PDF o Excel:** fuera del alcance del piloto (`.agents/CONTEXT.md` §2.4).
- **WebSockets, SSE o telemetría `heartbeat`:** descartados; se usa polling HTTP de 30 s y timestamps del servidor (`started_at`, `finished_at`).
- **PWA, modo offline y accesibilidad (`SPEC-09`), Contenido extra (`SPEC-10`) y Observabilidad con Sentry / lanzamiento (`Etapa 11`).**

## 3. Requisitos funcionales

1. **RF-1 — Separación de fuentes y regla del último intento calificado (`ENG-100`)**
   - **Dado** un conjunto de estudiantes con registros en `Attempt` y `ProgressEvent` dentro de una organización,
   - **Cuando** el backend calcula métricas estadísticas de rendimiento y de constancia,
   - **Entonces** obtiene las calificaciones exclusivamente de `Attempt` con `status = 'graded'` y `score IS NOT NULL`, obtiene las semanas activas, rachas e insignias de `ProgressEvent`, y en los promedios agregados (por asignación, grupo, nivel, tipo de actividad y leaderboard) utiliza únicamente el último intento calificado (`MAX(attempt_number)` con `status = 'graded'`) de cada par `(student_id, assignment_id)`.

2. **RF-2 — Universo de cumplimiento, denominador congelado y exclusión de canceladas y microjuegos (`ENG-100`)**
   - **Dado** un grupo con asignaciones de tipos asignables (`fill_blank`, `open_question`, `speaking`, `exam`), asignaciones con `cancelled_at IS NOT NULL` e intentos autónomos en microjuegos (`ActivityType = 'game'`),
   - **Cuando** el backend calcula la tasa de finalización de asignaciones para un grupo, nivel o estudiante,
   - **Entonces** evalúa únicamente asignaciones con `cancelled_at IS NULL` y `Activity.type != 'game'` donde la membresía del alumno en `GroupMembership` se solapó con `[opens_at, due_at]` (`joined_at <= due_at AND (left_at IS NULL OR left_at >= opens_at)`), usa `Assignment.historical_student_count` como denominador en asignaciones cerradas (`due_at < now()`) cuando no es nulo, y conserva las notas y eventos de asignaciones canceladas y de microjuegos en rendimiento y constancia sin incluirlos en el porcentaje de cumplimiento de asignaciones.

3. **RF-3 — Cálculo de tiempo dedicado con recorte superior y marcas de duración (`ENG-100`)**
   - **Dado** un intento finalizado (`finished_at IS NOT NULL`) con `status IN ('pending_review', 'graded')` y una actividad con `expected_duration_seconds`,
   - **Cuando** el backend agrega el tiempo dedicado por día, semana ISO o mes en zona `America/Bogota`,
   - **Entonces** calcula la duración con reloj del servidor como `MAX(0, finished_at - started_at)`, la recorta superiormente a `MIN(rawSeconds, expected_duration_seconds * 3)` y expone en el detalle individual si el intento contiene `'implausible_duration'` en `Attempt.flags`.

4. **RF-4 — Presupuesto de latencia `< 500 ms` con volumen de 3 meses (`ENG-100`)**
   - **Dado** una base de datos poblada con `prisma/seeds/seed-volume.ts` (100 estudiantes en 4 grupos/niveles y 3 meses de actividad),
   - **Cuando** la profesora consulta `/api/v1/stats/overview`, `/groups/:id`, `/leaderboard` o `/students/:id`,
   - **Entonces** cada endpoint responde en `< 500 ms` (p95) empleando los índices compuestos sobre `Attempt`, `ProgressEvent`, `Assignment` y `GroupMembership`.

5. **RF-5 — Vista general por nivel MCER y por grupo con alertas de inactividad (`ENG-101`)**
   - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/overview`,
   - **Cuando** el servidor procesa la consulta para su `organization_id` y ventana `[from, to]`,
   - **Entonces** devuelve `200 OK` con el resumen organizacional, los agregados por nivel MCER (`A1`–`B2`) y por grupo (promedio `0,0–5,0`, tasa de finalización, alumnos activos y tiempo dedicado), y la lista `inactiveAlerts` con los alumnos en estado `approved` sin eventos `attempt_completed` ni `audio_submitted` en los últimos 14 días calendario en `America/Bogota`.

6. **RF-6 — Vista por grupo con tabla comparativa de ambos ejes y tendencia (`ENG-101`)**
   - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/groups/:id` para un grupo de su organización,
   - **Cuando** el servidor compara la ventana `[from, to]` (por defecto últimos 30 días) frente a la ventana inmediatamente anterior de igual duración `[previousFrom, previousTo]`,
   - **Entonces** devuelve `200 OK` con el resumen del grupo y una fila por alumno que incluye promedio actual (`0,0–5,0`), delta y tendencia (`'up'` si $\Delta \ge +0,2$, `'down'` si $\Delta \le -0,2$, `'stable'` si $|\Delta| < 0,2$, `'none'` si falta nota en algún periodo), semanas activas, racha vigente (`currentStreakWeeks` y `forgivenessAvailable`), tasa de finalización y tiempo dedicado, ordenable por cualquier columna.

7. **RF-7 — Polling automático de 30 segundos en el panel estadístico (`ENG-101`)**
   - **Dado** que la profesora visualiza `/estadisticas` o `/estadisticas/estudiantes/[id]` en una pestaña activa del navegador,
   - **Cuando** transcurren 30 segundos,
   - **Entonces** TanStack Query revalida automáticamente las consultas activas (`refetchInterval: 30_000`) preservando los filtros y el ordenamiento vigentes.

8. **RF-8 — Leaderboard privado exclusivo para la profesora (`ENG-102`)**
   - **Dado** una petición a `GET /api/v1/stats/leaderboard` con filtros opcionales `groupId`, `level`, `from` y `to`,
   - **Cuando** el usuario autenticado tiene rol `teacher`,
   - **Entonces** devuelve `200 OK` con el ranking de estudiantes aprobados de la organización (`rank`, promedio `0,0–5,0`, actividades completadas, `currentStreakWeeks` y `badgesCount`); mientras que si el usuario tiene rol `student`, responde `403 FORBIDDEN` con código `AUTH_FORBIDDEN`.

9. **RF-9 — Vista individual por estudiante: eje de rendimiento (`ENG-103`)**
   - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/students/:id` con filtros opcionales `from`, `to`, `type` y `level`,
   - **Cuando** el servidor genera el bloque `performance` del estudiante,
   - **Entonces** devuelve la serie cronológica de intentos calificados (`scoreSeries`, incluyendo cada intento `attempt_number = 1..N` en actividades `game` y las banderas `usedExtendedDeadline` e `implausibleDuration`), el promedio del grupo del alumno en el mismo periodo (`groupAverageScore`), los promedios desglosados por `ActivityType` y por `GameMechanic`, los promedios por nivel MCER y la distribución respecto a `passing_score = 3.0` (aprobadas `>= 3.0` vs. por mejorar `< 3.0`).

10. **RF-10 — Vista individual por estudiante: eje de constancia (`ENG-103`)**
    - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/students/:id`,
    - **Cuando** el servidor genera el bloque `consistency` del estudiante,
    - **Entonces** devuelve el calendario de semanas ISO en `America/Bogota` (`weeklyCalendar`, últimas 12 semanas por defecto con estados `'active'`, `'forgiven'`, `'inactive'` o `'current_pending'` y conteo de actividades completadas), la racha vigente (`currentStreakWeeks`), disponibilidad de perdón (`forgivenessAvailable`), mejor racha histórica (`bestStreakWeeks`), tasa de finalización de asignaciones obligadas y tiempo dedicado recortado agrupado por día (`dailyTime`), semana ISO (`weeklyTime`) y mes (`monthlyTime`).

11. **RF-11 — Validación de filtros y aislamiento multi-tenant anti-IDOR (`ENG-101`, `ENG-102`, `ENG-103`)**
    - **Dado** cualquier petición a `/api/v1/stats/*`,
    - **Cuando** los parámetros de consulta son inválidos (`from > to`, UUID o enum inválido) o el `:id` de grupo/estudiante pertenece a otra organización o no existe,
    - **Entonces** el backend responde `400 VALIDATION_ERROR` ante parámetros mal formados y `404 NOT_FOUND` (`GROUP_NOT_FOUND` o `STUDENT_NOT_FOUND`) al filtrar siempre por `organization_id` del JWT con `findFirst`.

12. **RF-12 — Job cada 3 días de correo de pendientes a la profesora (`ENG-104`)**
    - **Dado** el cron diario a las `08:00 America/Bogota` que verifica en `ScheduledJobRun` (`job_key = 'teacher_pending_summary'`) si han transcurrido $\ge 3$ días calendario en `America/Bogota` desde la última ejecución `done` de cada organización (o si no existe ejecución previa),
    - **Cuando** se cumple el ciclo de 3 días y consulta `PendingSummaryService.getReminders(organizationId)`,
    - **Entonces** reclama de forma idempotente la ejecución `(organization_id, 'teacher_pending_summary', period_key)` y, si `pendingApprovals > 0 || overdueReviews > 0`, envía la plantilla `'teacher-pending-summary'` de `MailService` a los usuarios `teacher` de la organización y marca el job como `done`; si ambos contadores son `0`, no envía ningún correo y marca igualmente el job como `done`.

## 4. Reglas de negocio

1. **Separación de tablas por eje (Decisión 71):**
   - **Rendimiento:** solo considera filas de `Attempt` con `status = 'graded'` y `score IS NOT NULL`.
   - **Constancia:** considera `ProgressEvent` con `type IN ('attempt_completed', 'audio_submitted')` para semanas activas, rachas, actividades completadas y alertas de inactividad, más `Attempt.finished_at - Attempt.started_at` para el tiempo dedicado. Una entrega en `pending_review` (`open_question` o `speaking` con audio confirmado) suma de inmediato en constancia (Decisión 100), aunque su calificación siga pendiente.
2. **Escala `0,0–5,0`, redondeo y umbral de aprobación (Decisiones 20, 23 y 34 §5):**
   - Todos los promedios se calculan en el servidor y se redondean a 1 decimal (`Math.round(val * 10) / 10`).
   - El umbral de aprobación se toma de `Organization.config.passing_score` (por defecto `3.0`): `score >= 3.0` es aprobada (`passed = true`) y `score < 3.0` es por mejorar (`passed = false`).
3. **Último intento calificado frente a serie individual en microjuegos (Decisiones 25, 74 y 104):**
   - En los promedios agregados (por asignación, grupo, nivel, tipo/mecánica y leaderboard), cada par `(student_id, assignment_id)` aporta únicamente su intento con mayor `attempt_number` que esté en `status = 'graded'`.
   - En la vista individual del estudiante (`RF-9`), `scoreSeries` incluye todos los intentos calificados (`attempt_number = 1..N`) de microjuegos (`ActivityType = 'game'`) para mostrar la evolución partida a partida, e incluye en actividades asignadas el intento calificado vigente (marcando `usedExtendedDeadline = previous_attempt.retry_extend_until IS NOT NULL`).
4. **Cumplimiento de asignaciones, denominador congelado y cancelaciones (Decisiones 34 §14, 73, 98 y 111):**
   - Universo de cumplimiento: asignaciones con `cancelled_at IS NULL` y `Activity.type IN ('fill_blank', 'open_question', 'speaking', 'exam')`. Los microjuegos (`game`) nunca entran en el numerador ni en el denominador de la tasa de finalización.
   - Alumnos obligados a una asignación: miembros del grupo con `GroupMembership.joined_at <= assignment.due_at AND (GroupMembership.left_at IS NULL OR GroupMembership.left_at >= assignment.opens_at)`.
   - Asignación completada por un alumno obligado: existe al menos un `Attempt` del alumno en esa asignación con `status IN ('pending_review', 'graded')`.
   - Denominador por asignación: si `assignment.due_at < now()` y `assignment.historical_student_count !== null`, se usa `historical_student_count`; en caso contrario, el conteo dinámico de alumnos obligados aprobados.
5. **Calendario semanal ISO, perdón de racha y `bestStreakWeeks` (`ENG-103`):**
   - Las semanas ISO se evalúan en `America/Bogota` (`getBogotaIsoWeekKey` de `GamificationService`).
   - Al recorrer cronológicamente las semanas desde el inicio del alumno aplicando las 4 reglas de racha (`.agents/CONTEXT.md` §5.3), cada semana se clasifica como `'active'`, `'forgiven'` (semana cerrada sin actividad que consumió el perdón disponible manteniendo `weeks > 0`), `'inactive'` o `'current_pending'` (semana actual aún sin actividad). `bestStreakWeeks` es el máximo valor histórico alcanzado por `weeks`.
6. **Recorte de duración y cubetas de tiempo (Decisiones 79 y A67):**
   - Para cada intento con `finished_at IS NOT NULL` y `status IN ('pending_review', 'graded')`: `rawSeconds = Math.max(0, Math.floor((finished_at.getTime() - started_at.getTime()) / 1000))` y `effectiveSeconds = Math.min(rawSeconds, Math.max(60, activity.expected_duration_seconds) * 3)`.
   - Las series `dailyTime` (`YYYY-MM-DD`), `weeklyTime` (`YYYY-Www`) y `monthlyTime` (`YYYY-MM`) agrupan `effectiveSeconds` según `finished_at` en zona `America/Bogota`.
7. **Tendencia en vista de grupo y desempate en leaderboard (`ENG-101`, `ENG-102`):**
   - Para una ventana `[from, to]` de duración $D$, el periodo previo es `[from - D, from)`. Si existen promedios en ambos periodos, `scoreTrendDelta = ROUND(currentAvg - previousAvg, 1)` (`'up'` si $\ge +0,2$, `'down'` si $\le -0,2$, `'stable'` si $|\Delta| < 0,2$; `'none'` si alguno es `null`).
   - En el leaderboard, el orden por defecto es: `averageScore DESC NULLS LAST`, `completedActivitiesCount DESC`, `currentStreakWeeks DESC`, `badgesCount DESC`, `studentName ASC`.
8. **Cadencia de 3 días del job `teacher_pending_summary` (`ENG-104`, Decisiones 34 §18, 76 y 110):**
   - El cron `@Cron('0 0 8 * * *', { timeZone: 'America/Bogota' })` comprueba por organización la última fila `done` de `job_key = 'teacher_pending_summary'` en `ScheduledJobRun`. Si no existe o su `period_key` (`YYYY-MM-DD`) es anterior en $\ge 3$ días calendario a la fecha actual en Bogotá, ejecuta el resumen con `PendingSummaryService.getReminders(organizationId)` y envía correo con `idempotencyKey = 'teacher-pending-summary:${orgId}:${periodKey}:${teacherId}'` solo cuando `pendingApprovals > 0 || overdueReviews > 0`.

## 5. Contrato de API

Todos los endpoints viven bajo `/api/v1/stats`, protegidos con `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(Role.teacher)`. Los tipos se declaran en `packages/shared/src/api/stats.ts` y se reexportan en `packages/shared/src/api/index.ts`.

### 5.1 Endpoints y parámetros de consulta

| Método | Ruta | Query params (`class-validator`) | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/stats/overview` | `from?`, `to?` (ISO date; default últimos 30 días en Bogotá) | Resumen global, por nivel MCER, por grupo y alertas de inactividad (14 días). |
| `GET` | `/api/v1/stats/groups/:id` | `from?`, `to?`, `sortBy?`, `sortOrder?` (`'asc' \| 'desc'`) | Resumen del grupo y tabla comparativa de alumnos con tendencia. |
| `GET` | `/api/v1/stats/leaderboard` | `from?`, `to?`, `groupId?` (UUID), `level?` (`Level`) | Leaderboard privado de estudiantes aprobados para la profesora. |
| `GET` | `/api/v1/stats/students/:id` | `from?`, `to?`, `type?` (`ActivityType`), `level?` (`Level`) | Detalle individual de rendimiento y constancia del estudiante. |

### 5.2 Contratos TypeScript (`packages/shared/src/api/stats.ts`)

```ts
import { ActivityType, AgeSegment, GameMechanic, Level } from '../enums';

export type ScoreTrendDirection = 'up' | 'down' | 'stable' | 'none';
export type WeekCalendarStatus = 'active' | 'forgiven' | 'inactive' | 'current_pending';

export interface LevelStatsSummary {
  level: Level;
  studentCount: number;
  activeStudentCount: number;
  averageScore: number | null;
  assignedCount: number;
  completedAssignedCount: number;
  completionRatePercent: number | null;
  timeSpentSeconds: number;
}

export interface GroupStatsSummary {
  groupId: string;
  groupName: string;
  studentCount: number;
  activeStudentCount: number;
  averageScore: number | null;
  assignedCount: number;
  completedAssignedCount: number;
  completionRatePercent: number | null;
  timeSpentSeconds: number;
}

export interface InactiveStudentAlert {
  studentId: string;
  studentName: string;
  level: Level;
  ageSegment: AgeSegment;
  groupId: string | null;
  groupName: string | null;
  lastActivityAt: string | null;
  daysSinceLastActivity: number | null;
}

export interface StatsOverviewResponse {
  period: { from: string; to: string };
  organizationSummary: {
    totalApprovedStudents: number;
    activeStudentsInPeriod: number;
    averageScore: number | null;
    completionRatePercent: number | null;
    totalTimeSpentSeconds: number;
    inactiveAlertsCount: number;
  };
  byLevel: LevelStatsSummary[];
  byGroup: GroupStatsSummary[];
  inactiveAlerts: InactiveStudentAlert[];
}

export interface GroupStudentStatsRow {
  studentId: string;
  studentName: string;
  level: Level;
  ageSegment: AgeSegment;
  isCurrentMember: boolean;
  averageScore: number | null;
  previousAverageScore: number | null;
  scoreTrendDelta: number | null;
  scoreTrend: ScoreTrendDirection;
  activeWeeksInPeriod: number;
  currentStreakWeeks: number;
  forgivenessAvailable: boolean;
  assignedCount: number;
  completedAssignedCount: number;
  completionRatePercent: number | null;
  timeSpentSeconds: number;
  lastActivityAt: string | null;
}

export interface GroupStatsResponse {
  group: { id: string; name: string };
  period: { from: string; to: string; previousFrom: string; previousTo: string };
  summary: GroupStatsSummary;
  students: GroupStudentStatsRow[];
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  level: Level;
  ageSegment: AgeSegment;
  groupId: string | null;
  groupName: string | null;
  averageScore: number | null;
  completedActivitiesCount: number;
  currentStreakWeeks: number;
  badgesCount: number;
}

export interface LeaderboardResponse {
  period: { from: string; to: string };
  filters: { groupId: string | null; level: Level | null };
  entries: LeaderboardEntry[];
}

export interface StudentScorePoint {
  attemptId: string;
  assignmentId: string;
  activityId: string;
  activityTitle: string;
  activityType: ActivityType;
  gameMechanic: GameMechanic | null;
  level: Level;
  attemptNumber: number;
  score: number;
  passed: boolean;
  gradedAt: string;
  usedExtendedDeadline: boolean;
  implausibleDuration: boolean;
}

export interface StudentTypeBreakdown {
  type: ActivityType;
  gradedCount: number;
  averageScore: number | null;
  passedCount: number;
  needsImprovementCount: number;
}

export interface StudentGameMechanicBreakdown {
  mechanic: GameMechanic;
  attemptsCount: number;
  uniqueGamesCount: number;
  averageScore: number | null;
}

export interface StudentLevelBreakdown {
  level: Level;
  gradedCount: number;
  averageScore: number | null;
}

export interface StudentWeekCalendarItem {
  weekKey: string;
  weekStart: string;
  status: WeekCalendarStatus;
  completedCount: number;
}

export interface TimeBucketItem {
  bucketKey: string;
  timeSpentSeconds: number;
  completedCount: number;
}

export interface StudentStatsResponse {
  student: {
    id: string;
    name: string;
    level: Level;
    ageSegment: AgeSegment;
    groupId: string | null;
    groupName: string | null;
    joinedAt: string;
  };
  period: { from: string; to: string };
  filters: { type: ActivityType | null; level: Level | null };
  performance: {
    passingScore: number;
    studentAverageScore: number | null;
    groupAverageScore: number | null;
    totalGradedActivities: number;
    passedCount: number;
    needsImprovementCount: number;
    passRatePercent: number | null;
    scoreSeries: StudentScorePoint[];
    byActivityType: StudentTypeBreakdown[];
    byGameMechanic: StudentGameMechanicBreakdown[];
    byLevel: StudentLevelBreakdown[];
  };
  consistency: {
    currentStreakWeeks: number;
    bestStreakWeeks: number;
    forgivenessAvailable: boolean;
    activeWeeksInPeriod: number;
    completedActivitiesInPeriod: number;
    assignedCount: number;
    completedAssignedCount: number;
    completionRatePercent: number | null;
    totalTimeSpentSeconds: number;
    weeklyCalendar: StudentWeekCalendarItem[];
    dailyTime: TimeBucketItem[];
    weeklyTime: TimeBucketItem[];
    monthlyTime: TimeBucketItem[];
  };
}
```

### 5.3 Códigos de respuesta

- `200 OK`: payload tipado según contrato.
- `400 Bad Request` (`VALIDATION_ERROR`): `from > to`, UUID o enum inválido.
- `401 Unauthorized` (`AUTH_UNAUTHORIZED`): token ausente o vencido.
- `403 Forbidden` (`AUTH_FORBIDDEN`): usuario autenticado con rol distinto de `teacher`.
- `404 Not Found` (`GROUP_NOT_FOUND`, `STUDENT_NOT_FOUND`): grupo o estudiante inexistente en la organización.

## 6. Modelo de datos

No se añaden tablas nuevas; se consultan `Organization`, `User`, `Student`, `Group`, `GroupMembership`, `Activity`, `GameDetail`, `Assignment`, `Attempt`, `ProgressEvent`, `BadgeAward` y `ScheduledJobRun`.

Para asegurar tiempos `< 500 ms` en agregaciones por rango de fechas a nivel de organización (`ENG-100`), se añaden en `apps/api/prisma/schema.prisma` (con su migración SQL en `prisma/migrations/`) tres índices compuestos adicionales a los ya existentes:

```prisma
// En model Attempt:
@@index([organization_id, status, graded_at])
@@index([organization_id, status, finished_at])

// En model ProgressEvent:
@@index([organization_id, type, occurred_at])
```

**Contingencia de vista materializada (`daily_student_activity`):** las consultas operan en vivo sobre las tablas indexadas (`.agents/CONTEXT.md` §12.8 y `architecture-overview.md` §9.4). Solo si el benchmark con `seed-volume.ts` supera `500 ms` en alguna consulta, se añadirá la vista materializada `daily_student_activity` refrescada con `REFRESH MATERIALIZED VIEW CONCURRENTLY` en `MaintenanceService.handleNightlyMaintenance()`.

## 7. Interfaz

Bajo `apps/web/src/app/(teacher)/estadisticas/`:

1. **Panel principal (`page.tsx`, ruta `/estadisticas`):**
   - Selector de periodo (`Últimos 7 días`, `Últimos 30 días`, `Últimos 90 días` o rango personalizado `Desde / Hasta`) e indicador de actualización automática cada 30 s (`refetchInterval: 30_000` en TanStack Query).
   - **Pestaña General (`overview`):** tarjetas KPI organizacionales, bloque de **Alertas de inactividad (últimas 2 semanas)** con enlace directo a la ficha del alumno, y tablas comparativas **Por nivel MCER (`A1`–`B2`)** y **Por grupo**.
   - **Pestaña Por grupo (`groups`):** selector de grupo y tabla ordenable por cualquier columna con ambos ejes (promedio `0,0–5,0`, badge de tendencia `↑`/`↓`/`→` con delta, semanas activas, racha vigente e indicador de perdón, tasa de finalización y tiempo dedicado).
   - **Pestaña Leaderboard privado (`leaderboard`):** banner *"Vista privada para la profesora — No visible para estudiantes"*, filtros por grupo y nivel, y tabla de ranking con posición, alumno, grupo, nivel, promedio, actividades completadas, racha e insignias.
2. **Ficha estadística de estudiante (`estudiantes/[id]/page.tsx`, ruta `/estadisticas/estudiantes/[id]`):**
   - Filtros por fechas (`from`, `to`), tipo de actividad y nivel MCER.
   - **Bloque Rendimiento:** gráfica de serie temporal de notas (`0,0–5,0`) superpuesta con la línea del **promedio de su grupo** (`groupAverageScore`) y la línea de umbral `3,0`, marcando intentos con plazo extendido o duración implausible; tarjetas de aprobadas (`>= 3,0`) vs. por mejorar (`< 3,0`); y desgloses por los 5 `ActivityType`, las 5 `GameMechanic` y los 4 niveles MCER.
   - **Bloque Constancia:** KPIs de racha vigente, mejor racha histórica (`bestStreakWeeks`), estado del perdón semanal, tasa de finalización de asignaciones y tiempo dedicado; calendario visual de las últimas 12 semanas ISO (`Activa`, `Perdón usado`, `Inactiva`, `Semana en curso`); y gráfico de tiempo dedicado conmutable por **Día**, **Semana** o **Mes**.
3. **Estados vacíos, carga y error:** ausencia de notas representada con `—` (nunca `0,0`), esqueletos (`Skeleton`) durante la carga inicial y aviso de error con acción `Reintentar ahora` conservando datos previos en caché.

## 8. Seguridad y privacidad

- **RBAC exclusivo docente:** `StatsController` exige `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(Role.teacher)`. `proxy.ts` redirige a cualquier rol distinto de `teacher` fuera de `/estadisticas` y NestJS rechaza con `403 FORBIDDEN` cualquier acceso de `student` a `/api/v1/stats/*`.
- **Anti-IDOR multi-tenant (Regla G-B02):** toda consulta filtra por `organization_id` del JWT y valida grupos y estudiantes con `findFirst({ where: { id, organization_id } })`.
- **Cero PII en correos y logs (Regla G-C10):** el correo `'teacher-pending-summary'` contiene únicamente los contadores numéricos (`pendingRequests`, `ungradedActivities`) y enlaces internos, sin nombres ni datos de alumnos; los logs registran solo metadatos operativos (`organizationId`, `periodKey`, `messageId`).

## 9. Pruebas

- **Unitarias y de integración (`apps/api/src/stats/stats.service.spec.ts`):**
  - Separación de fuentes (`Attempt` calificado vs. `ProgressEvent`) y regla del último intento calificado (`MAX(attempt_number)` con `status = 'graded'`) en promedios agregados (`RF-1`).
  - Serie individual de microjuegos (`game`) con todos los intentos `attempt_number = 1..N` en `scoreSeries` mientras el promedio agregado toma el último intento calificado (`RF-1`, `RF-9`).
  - Universo de alumnos obligados con membresía histórica solapada (`joined_at`, `left_at`), denominador congelado `historical_student_count` en asignaciones cerradas ante bajas o cambios de grupo, exclusión de asignaciones canceladas (`cancelled_at IS NOT NULL`) del cumplimiento conservando sus notas, y exclusión de `game` del porcentaje de finalización (`RF-2`).
  - Recorte de duración a `expected_duration_seconds * 3` y banderas `implausibleDuration` y `usedExtendedDeadline` (`RF-3`, `RF-9`).
  - Cálculo de `overview` por nivel, por grupo y lista `inactiveAlerts` de alumnos sin actividad en 14 días (`RF-5`).
  - Cálculo de `groups/:id` con tendencia (`up`, `down`, `stable`, `none`) respecto al periodo anterior de igual duración y ordenamiento por columnas (`RF-6`).
  - Cálculo de `students/:id` con desgloses por `ActivityType`, `GameMechanic` y `Level`, umbral `3.0`, calendario semanal (`active`, `forgiven`, `inactive`), `bestStreakWeeks` y cubetas de tiempo diario, semanal y mensual (`RF-9`, `RF-10`).
- **Seguridad, RBAC y validaciones (`apps/api/src/stats/stats.controller.spec.ts`):**
  - Petición con rol `student` a `GET /api/v1/stats/leaderboard` (y demás rutas de `/stats/*`) devuelve `403 FORBIDDEN` (`RF-8`).
  - Acceso a `groupId` o `studentId` de otra organización devuelve `404 NOT_FOUND` y rango `from > to` devuelve `400 VALIDATION_ERROR` (`RF-11`).
- **Benchmark de volumen (`apps/api/src/stats/stats.performance.spec.ts`):**
  - Sobre `seedVolume()` (100 estudiantes, 3 meses), verifica que `/overview`, `/groups/:id`, `/leaderboard` y `/students/:id` responden en `< 500 ms` (`RF-4`).
- **Job cada 3 días (`apps/api/src/maintenance/maintenance.service.spec.ts`):**
  - Verifica que `teacher_pending_summary` envía correo solo si `pendingApprovals > 0 || overdueReviews > 0`, omite el envío cuando ambos son `0`, respeta la ventana de 3 días en `ScheduledJobRun` y es idempotente (`RF-12`).
- **Frontend y validación docente (`apps/web`):**
  - Pruebas de componentes de `/estadisticas` y `/estadisticas/estudiantes/[id]` verificando el polling de 30 s (`RF-7`), pestañas y filtros (`RF-5`, `RF-6`, `RF-8`, `RF-9`, `RF-10`), más sesión de validación con la profesora en staging (`ENG-103`).

## 10. Fuera de alcance y decisiones diferidas

- **Exclusiones del piloto (`.agents/CONTEXT.md` §2.4):** sin leaderboard público para estudiantes, sin exportación PDF/Excel, sin entidades descartadas (`Guardian`, `ConsentRecord`, Supabase Storage/Auth/Realtime, RLS).
- **Sin feature flags `stats` ni `leaderboard` (Decisiones 34 §7 y 41):** acceso controlado únicamente por `@Roles(Role.teacher)`.
- **Sin WebSockets, SSE ni heartbeat:** actualización mediante polling HTTP cada 30 segundos y duraciones calculadas en el servidor.

## 11. Preguntas abiertas

Se documentan las siguientes decisiones y consideraciones técnicas propuestas para validación del líder antes de pasar `SPEC-08` a `Aprobada`:

- **Q-01 — Ventana por defecto y umbral de tendencia en la vista de grupo (`ENG-101`):**
  - *Propuesto:* Usar por defecto los últimos **30 días** en `America/Bogota` comparados contra los 30 días previos, clasificando `scoreTrend` como `'up'` ($\Delta \ge +0,2$), `'down'` ($\Delta \le -0,2$), `'stable'` ($|\Delta| < 0,2$) o `'none'` (si falta nota en alguno de los dos periodos).
- **Q-02 — Distinción de microjuegos (`game`) frente a actividades asignadas en el esquema actual (`ENG-100`, `ENG-103`):**
  - *Propuesto:* Mantener en `StatsService` el filtro canónico ya utilizado en `PendingSummaryService` y `ReviewService` (`Assignment.activity.type !== 'game'` y `Assignment.cancelled_at === null` para el universo de cumplimiento de asignaciones; `Activity.type === 'game'` para aislar la práctica autónoma 24/7), sin alterar la nulabilidad de `Attempt.assignment_id` en el esquema Prisma durante la Etapa 8.
- **Q-03 — Evaluación exacta de bloques de 3 días en `ScheduledJobRun` para `teacher_pending_summary` (`ENG-104`):**
  - *Propuesto:* Ejecutar el cron diariamente a las `08:00 America/Bogota` (`0 0 8 * * *`) y verificar contra la última ejecución `done` de `job_key = 'teacher_pending_summary'` en `ScheduledJobRun` si han transcurrido $\ge 3$ días calendario en Bogotá antes de registrar `period_key = YYYY-MM-DD`, evitando el salto de días consecutivos (`31` y `1`) que produce `*/3` en cron estándar.
- **Q-04 — Ordenamiento y desempate en el leaderboard privado (`ENG-102`):**
  - *Propuesto:* Incluir a todos los estudiantes en estado `approved`, ordenando por `averageScore DESC NULLS LAST` y desempatando por `completedActivitiesCount DESC`, `currentStreakWeeks DESC`, `badgesCount DESC` y `studentName ASC`.

## 12. Registro de cambios

| Fecha | Autor | Descripción |
|---|---|---|
| 2026-10-27 | Agente IA | Redacción inicial de `SPEC-08` en estado `Borrador` cubriendo `ENG-100` a `ENG-104` y documentando `Q-01` a `Q-04`. |
