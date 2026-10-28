# SPEC-08 — Estadísticas de rendimiento y constancia

| Campo | Valor |
|---|---|
| Estado | Verificada |
| Etapa | 8 — Estadísticas y leaderboard |
| Tareas | ENG-100, ENG-101, ENG-102, ENG-103, ENG-104 |
| Referencias | `.agents/CONTEXT.md` §5.1, §5.3, §5.4, §12.8, §14 (Decisiones 20, 23, 25, 34, 41, 61, 66, 71, 73, 74, 76, 79, 98, 100, 104, 110–115); `planning/architecture-overview.md` §6, §7.8, §9.3, §9.4; `planning/pbp-development.md` (Etapa 8); `specs/SPEC-01-scaffold.md` a `specs/SPEC-07-revision-y-feedback.md` |
| Aprobada por / fecha | Líder del proyecto / 2026-10-27 |
| Verificada por / fecha | Líder del proyecto / 2026-10-28 |

## 1. Contexto y objetivo

Al finalizar la Etapa 7, Englove persiste el desempeño y el hábito de estudio en dos tablas complementarias: `Attempt` (intentos con nota `0,0–5,0`, marcas de duración y plazos efectivos) y `ProgressEvent` (entregas completadas, audios enviados, semanas de racha e insignias). Asimismo, existen `PendingSummaryService` (`ENG-045` / `ENG-090`) y la plantilla `'teacher-pending-summary'` en `MailService` (`ENG-020`), pendientes de conectarse al job periódico de correo y a las vistas analíticas.

`SPEC-08` especifica las tareas `ENG-100` a `ENG-104` de la Etapa 8:

1. **Motor de consultas e índices (`StatsModule`, `ENG-100`):** agregaciones separadas en los ejes de **rendimiento** (qué tan bien le va al alumno) y **constancia** (qué tan seguido practica), con presupuesto `< 500 ms` sobre `seed-volume.ts` (100 estudiantes, 3 meses).
2. **Panel estadístico docente (`/estadisticas`, `ENG-101` a `ENG-103`):** vistas General, Por grupo (con comparativa de tendencia cada 30 días y semanal, Decisión 112), Leaderboard privado (con filtrado por grupo y por grupos de nivel `A1`, `A2`, `B1` o `B2`, Decisión 115) y Por estudiante con polling cada 30 s, restringidas al rol `teacher`.
3. **Recordatorio cada 3 días (`teacher_pending_summary`, `ENG-104`):** cron diario a las `08:00 America/Bogota` con verificación de bloque de 3 días en `ScheduledJobRun` (Decisión 114) que envía correo a la profesora solo cuando existan pendientes.

Las preguntas abiertas `Q-01` a `Q-04` quedaron cerradas y aprobadas mediante las Decisiones 112 a 115 de `.agents/CONTEXT.md` §14.

## 2. Alcance

### Entra en esta spec

- **`ENG-100` — Consultas agregadas, reglas de cálculo e índices (`< 500 ms`):**
  - Separación de fuentes (`Attempt` calificado para rendimiento; `ProgressEvent` + duraciones de `Attempt` para constancia, Decisión 71).
  - Regla del último intento calificado (`MAX(attempt_number)` con `status = 'graded'`) en promedios agregados y serie completa por intento (`1..N`) en microjuegos individuales (`game`, Decisiones 25, 74 y 104).
  - Universo de alumnos obligados por solape de `GroupMembership` con `[opens_at, due_at]` (Decisión 73), denominador congelado `Assignment.historical_student_count` en asignaciones cerradas (Decisión 34 §14), exclusión de asignaciones canceladas (`cancelled_at IS NOT NULL`) del cumplimiento conservando notas y eventos (Decisión 98), y filtro canónico `Assignment.activity.type !== 'game'` para excluir la práctica autónoma 24/7 del porcentaje de cumplimiento (Decisiones 111 y 113).
  - Recorte de duración a `expected_duration_seconds * 3`, marcas de plazo extendido y duración implausible (Decisiones 61 y 79), e índices compuestos verificados bajo `< 500 ms`.
- **`ENG-101` — Vista general y vista por grupo con polling de 30 s:**
  - Endpoints `GET /api/v1/stats/overview` y `GET /api/v1/stats/groups/:id` con tendencia a **30 días** (`trend30d`) y **semanal** (`trend7d`, Decisión 112).
- **`ENG-102` — Leaderboard privado para la profesora:**
  - Endpoint `GET /api/v1/stats/leaderboard` protegido por `@Roles(Role.teacher)` (sin feature flags `stats` ni `leaderboard`, Decisiones 34 §7 y 41), con filtrado por grupo (`groupId`) y por grupos de nivel (`A1`, `A2`, `B1` o `B2`, Decisión 115).
- **`ENG-103` — Vista individual por estudiante y validación con la profesora:**
  - Endpoint `GET /api/v1/stats/students/:id` y vista `/estadisticas/estudiantes/[id]` con serie temporal contra el promedio del grupo, desgloses por `ActivityType` y `GameMechanic`, umbral `passing_score = 3.0`, calendario semanal ISO, racha vigente, mejor racha histórica y tiempo dedicado (diario, semanal y mensual).
- **`ENG-104` — Job cada 3 días de resumen de pendientes por correo:**
  - Cron a las `08:00 America/Bogota` con `ScheduledJobRun` (`job_key = 'teacher_pending_summary'`, Decisión 114), consultando `PendingSummaryService` y enviando `'teacher-pending-summary'` vía `MailService` solo cuando existan pendientes.

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
   - **Entonces** obtiene las calificaciones exclusivamente de `Attempt` con `status = 'graded'` y `score IS NOT NULL`, obtiene las semanas activas, rachas e insignias de `ProgressEvent`, y en los promedios agregados toma únicamente el último intento calificado (`MAX(attempt_number)` con `status = 'graded'`) de cada par `(student_id, assignment_id)`.

2. **RF-2 — Universo de cumplimiento, denominador congelado y exclusión de canceladas y microjuegos (`ENG-100`)**
   - **Dado** un grupo con asignaciones de tipos asignables (`fill_blank`, `open_question`, `speaking`, `exam`), asignaciones canceladas (`cancelled_at IS NOT NULL`) e intentos autónomos en microjuegos (`ActivityType = 'game'`),
   - **Cuando** el backend calcula la tasa de finalización de asignaciones para un grupo, nivel o estudiante,
   - **Entonces** evalúa únicamente asignaciones con `cancelled_at IS NULL` y `Activity.type != 'game'` donde `GroupMembership` se solapó con `[opens_at, due_at]` (`joined_at <= due_at AND (left_at IS NULL OR left_at >= opens_at)`), usa `Assignment.historical_student_count` como denominador en asignaciones cerradas (`due_at < now()`) cuando no es nulo, y conserva las notas y eventos de canceladas y microjuegos en rendimiento y constancia sin incluirlos en el porcentaje de cumplimiento.

3. **RF-3 — Cálculo de tiempo dedicado con recorte superior y marcas de duración (`ENG-100`)**
   - **Dado** un intento finalizado (`finished_at IS NOT NULL`) con `status IN ('pending_review', 'graded')` y una actividad con `expected_duration_seconds`,
   - **Cuando** el backend agrega el tiempo dedicado por día, semana ISO o mes en zona `America/Bogota`,
   - **Entonces** calcula la duración con reloj del servidor como `MAX(0, finished_at - started_at)`, la recorta a `MIN(rawSeconds, expected_duration_seconds * 3)` y expone si el intento contiene `'implausible_duration'` en `Attempt.flags`.

4. **RF-4 — Presupuesto de latencia `< 500 ms` con volumen de 3 meses (`ENG-100`)**
   - **Dado** una base de datos poblada con `prisma/seeds/seed-volume.ts` (100 estudiantes en 4 grupos/niveles y 3 meses de actividad),
   - **Cuando** la profesora consulta `/api/v1/stats/overview`, `/groups/:id`, `/leaderboard` o `/students/:id`,
   - **Entonces** cada endpoint responde en `< 500 ms` (p95) empleando los índices compuestos sobre `Attempt`, `ProgressEvent`, `Assignment` y `GroupMembership`.

5. **RF-5 — Vista general por nivel MCER y por grupo con alertas de inactividad (`ENG-101`)**
   - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/overview`,
   - **Cuando** el servidor procesa la consulta para su `organization_id` y ventana `[from, to]`,
   - **Entonces** devuelve `200 OK` con el resumen organizacional, los agregados por nivel MCER (`A1`–`B2`) y por grupo (promedio `0,0–5,0`, tasa de finalización, alumnos activos y tiempo dedicado), y `inactiveAlerts` con los alumnos `approved` sin eventos `attempt_completed` ni `audio_submitted` en los últimos 14 días en `America/Bogota`.

6. **RF-6 — Vista por grupo con tabla comparativa y tendencia cada 30 días y semanal (`ENG-101`)**
   - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/groups/:id` para un grupo de su organización,
   - **Cuando** el servidor evalúa la ventana `[from, to]` y calcula tanto la comparación **cada 30 días** (`trend30d`: últimos 30 días frente a los 30 días anteriores) como la comparación **semanal** (`trend7d`: últimos 7 días frente a los 7 días anteriores, con `trendMode = '30d' | '7d'`),
   - **Entonces** devuelve `200 OK` con el resumen del grupo y una fila por alumno que incluye promedio del periodo (`0,0–5,0`), `trend30d` y `trend7d` (cada una con promedio actual, promedio previo, delta y dirección `'up'` si $\Delta \ge +0,2$, `'down'` si $\Delta \le -0,2$, `'stable'` si $|\Delta| < 0,2$, `'none'` si falta nota), semanas activas, racha vigente (`currentStreakWeeks` y `forgivenessAvailable`), tasa de finalización y tiempo dedicado, ordenable por cualquier columna.

7. **RF-7 — Polling automático de 30 segundos en el panel estadístico (`ENG-101`)**
   - **Dado** que la profesora visualiza `/estadisticas` o `/estadisticas/estudiantes/[id]` en una pestaña activa del navegador,
   - **Cuando** transcurren 30 segundos,
   - **Entonces** TanStack Query revalida automáticamente las consultas activas (`refetchInterval: 30_000`) preservando los filtros y el ordenamiento vigentes.

8. **RF-8 — Leaderboard privado para la profesora con filtro por grupos (`A1`, `A2`, `B1`, `B2`) (`ENG-102`)**
   - **Dado** una petición a `GET /api/v1/stats/leaderboard` con filtros opcionales por grupo (`groupId`), por grupos de nivel MCER (`level`: `A1`, `A2`, `B1` o `B2`) y por fechas (`from`, `to`),
   - **Cuando** el usuario autenticado tiene rol `teacher`,
   - **Entonces** devuelve `200 OK` con el ranking de estudiantes aprobados que cumplan el filtro (`rank`, promedio `0,0–5,0`, actividades completadas, `currentStreakWeeks` y `badgesCount`); mientras que si el usuario tiene rol `student`, responde `403 FORBIDDEN` (`AUTH_FORBIDDEN`).

9. **RF-9 — Vista individual por estudiante: eje de rendimiento (`ENG-103`)**
   - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/students/:id` con filtros opcionales `from`, `to`, `type` y `level`,
   - **Cuando** el servidor genera el bloque `performance` del estudiante,
   - **Entonces** devuelve la serie cronológica de intentos calificados (`scoreSeries`, con cada intento `attempt_number = 1..N` en `game` y banderas `usedExtendedDeadline` e `implausibleDuration`), el promedio del grupo del alumno (`groupAverageScore`), los promedios por `ActivityType`, `GameMechanic` y `Level`, y la distribución respecto a `passing_score = 3.0` (`>= 3.0` vs. `< 3.0`).

10. **RF-10 — Vista individual por estudiante: eje de constancia (`ENG-103`)**
    - **Dado** una profesora autenticada que solicita `GET /api/v1/stats/students/:id`,
    - **Cuando** el servidor genera el bloque `consistency` del estudiante,
    - **Entonces** devuelve el calendario de semanas ISO en `America/Bogota` (`weeklyCalendar`, últimas 12 semanas por defecto con estados `'active'`, `'forgiven'`, `'inactive'` o `'current_pending'`), `currentStreakWeeks`, `forgivenessAvailable`, `bestStreakWeeks`, tasa de finalización de asignaciones y tiempo dedicado recortado por día (`dailyTime`), semana ISO (`weeklyTime`) y mes (`monthlyTime`).

11. **RF-11 — Validación de filtros y aislamiento multi-tenant anti-IDOR (`ENG-101`, `ENG-102`, `ENG-103`)**
    - **Dado** cualquier petición a `/api/v1/stats/*`,
    - **Cuando** los parámetros de consulta son inválidos (`from > to`, UUID o enum inválido) o el `:id` de grupo/estudiante pertenece a otra organización o no existe,
    - **Entonces** el backend responde `400 VALIDATION_ERROR` ante parámetros mal formados y `404 NOT_FOUND` (`GROUP_NOT_FOUND` o `STUDENT_NOT_FOUND`) filtrando siempre por `organization_id` del JWT con `findFirst`.

12. **RF-12 — Job cada 3 días de correo de pendientes a la profesora (`ENG-104`)**
    - **Dado** el cron diario a las `08:00 America/Bogota` que verifica en `ScheduledJobRun` (`job_key = 'teacher_pending_summary'`) si han transcurrido $\ge 3$ días calendario en `America/Bogota` desde la última ejecución `done` de cada organización,
    - **Cuando** se cumple el ciclo de 3 días y consulta `PendingSummaryService.getReminders(organizationId)`,
    - **Entonces** reclama de forma idempotente `(organization_id, 'teacher_pending_summary', period_key)` y, si `pendingApprovals > 0 || overdueReviews > 0`, envía la plantilla `'teacher-pending-summary'` de `MailService` a los usuarios `teacher` de la organización y marca el job como `done`; si ambos son `0`, no envía correo y marca el job como `done`.

## 4. Reglas de negocio

1. **Separación de tablas por eje (Decisión 71):**
   - **Rendimiento:** solo considera `Attempt` con `status = 'graded'` y `score IS NOT NULL`.
   - **Constancia:** considera `ProgressEvent` con `type IN ('attempt_completed', 'audio_submitted')` para semanas activas, rachas, actividades completadas y alertas de inactividad, más `Attempt.finished_at - Attempt.started_at` para el tiempo dedicado. Una entrega en `pending_review` suma de inmediato en constancia (Decisión 100).
2. **Escala `0,0–5,0`, redondeo y umbral de aprobación (Decisiones 20, 23 y 34 §5):**
   - Todos los promedios se calculan en el servidor y se redondean a 1 decimal (`Math.round(val * 10) / 10`). El umbral de aprobación es `Organization.config.passing_score` (`3.0`): `score >= 3.0` es aprobada (`passed = true`).
3. **Último intento calificado frente a serie individual en microjuegos (Decisiones 25, 74 y 104):**
   - En los promedios agregados, cada par `(student_id, assignment_id)` aporta únicamente su intento con mayor `attempt_number` en `status = 'graded'`.
   - En `scoreSeries` del estudiante (`RF-9`), se incluyen todos los intentos calificados (`attempt_number = 1..N`) de microjuegos (`game`) y el intento calificado vigente de asignaciones (con `usedExtendedDeadline = previous_attempt.retry_extend_until IS NOT NULL`).
4. **Cumplimiento de asignaciones, denominador congelado y filtro de microjuegos (Decisiones 34 §14, 73, 98, 111 y 113):**
   - Universo de cumplimiento: asignaciones con `cancelled_at IS NULL` y `Activity.type !== 'game'`. Los microjuegos (`game`) nunca entran en el numerador ni en el denominador de finalización, sin alterar la nulabilidad de `Attempt.assignment_id` en Etapa 8.
   - Alumnos obligados: miembros del grupo con `joined_at <= due_at AND (left_at IS NULL OR left_at >= opens_at)`.
   - Denominador por asignación: `historical_student_count` si `due_at < now()` y no es `null`; de lo contrario, el conteo dinámico de obligados aprobados.
5. **Calendario semanal ISO, perdón de racha y `bestStreakWeeks` (`ENG-103`):**
   - Evaluado en `America/Bogota` (`getBogotaIsoWeekKey`) aplicando las 4 reglas de racha (`.agents/CONTEXT.md` §5.3). Cada semana es `'active'`, `'forgiven'`, `'inactive'` o `'current_pending'`; `bestStreakWeeks` es el máximo histórico alcanzado.
6. **Recorte de duración y cubetas de tiempo (Decisiones 79 y A67):**
   - Para intentos con `finished_at IS NOT NULL` y `status IN ('pending_review', 'graded')`: `effectiveSeconds = Math.min(Math.max(0, Math.floor((finished_at.getTime() - started_at.getTime()) / 1000)), Math.max(60, activity.expected_duration_seconds) * 3)`, agrupado en `dailyTime`, `weeklyTime` y `monthlyTime` según `finished_at` en Bogotá.
7. **Tendencia cada 30 días y semanal en vista de grupo (`ENG-101`, Decisión 112):**
   - Tomando `to` como corte, se calculan simultáneamente `trend30d` (`[to - 30d, to]` vs. `[to - 60d, to - 30d)`) y `trend7d` (`[to - 7d, to]` vs. `[to - 14d, to - 7d)`). En ambas (y en `scoreTrend` según `trendMode = '30d' | '7d'`, default `'30d'`), `delta = ROUND(currentAvg - previousAvg, 1)` y la dirección es `'up'` ($\Delta \ge +0,2$), `'down'` ($\Delta \le -0,2$), `'stable'` ($|\Delta| < 0,2$) o `'none'` si falta nota en alguno de los dos periodos.
8. **Filtrado por grupos (`A1`, `A2`, `B1`, `B2`) y desempate en leaderboard (`ENG-102`, Decisión 115):**
   - Filtra estudiantes `approved` por `groupId` y/o por grupos de nivel MCER (`level`: `A1`, `A2`, `B1` o `B2`), recalculando `rank = 1..K` con orden `averageScore DESC NULLS LAST`, `completedActivitiesCount DESC`, `currentStreakWeeks DESC`, `badgesCount DESC`, `studentName ASC`.
9. **Cadencia de 3 días del job `teacher_pending_summary` (`ENG-104`, Decisiones 34 §18, 76, 110 y 114):**
   - Cron `@Cron('0 0 8 * * *', { timeZone: 'America/Bogota' })` que comprueba si la última ejecución `done` de `job_key = 'teacher_pending_summary'` en `ScheduledJobRun` dista $\ge 3$ días calendario de hoy en Bogotá antes de consultar `PendingSummaryService` y enviar correo solo cuando `pendingApprovals > 0 || overdueReviews > 0`.

## 5. Contrato de API

Endpoints bajo `/api/v1/stats` con `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(Role.teacher)`. Contratos en `packages/shared/src/api/stats.ts`.

### 5.1 Endpoints y parámetros de consulta

| Método | Ruta | Query params (`class-validator`) | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/stats/overview` | `from?`, `to?` (ISO date; default últimos 30 días) | Resumen global, por nivel MCER, por grupo y alertas de inactividad (14 días). |
| `GET` | `/api/v1/stats/groups/:id` | `from?`, `to?`, `trendMode?` (`'30d' \| '7d'`), `sortBy?`, `sortOrder?` | Resumen del grupo y tabla de alumnos con tendencia a 30 días y semanal. |
| `GET` | `/api/v1/stats/leaderboard` | `from?`, `to?`, `groupId?` (UUID), `level?` (`'A1' \| 'A2' \| 'B1' \| 'B2'`) | Leaderboard privado filtrable por grupo y por grupos de nivel (`A1`–`B2`). |
| `GET` | `/api/v1/stats/students/:id` | `from?`, `to?`, `type?` (`ActivityType`), `level?` (`Level`) | Detalle individual de rendimiento y constancia del estudiante. |

### 5.2 Contratos TypeScript (`packages/shared/src/api/stats.ts`)

```ts
import { ActivityType, AgeSegment, GameMechanic, Level } from '../enums';

export type ScoreTrendDirection = 'up' | 'down' | 'stable' | 'none';
export type TrendComparisonMode = '30d' | '7d';
export type WeekCalendarStatus = 'active' | 'forgiven' | 'inactive' | 'current_pending';

export interface ScoreTrendComparison {
  currentAverageScore: number | null;
  previousAverageScore: number | null;
  delta: number | null;
  direction: ScoreTrendDirection;
}

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
  trend30d: ScoreTrendComparison;
  trend7d: ScoreTrendComparison;
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
  trendMode: TrendComparisonMode;
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

Opera sobre `Organization`, `User`, `Student`, `Group`, `GroupMembership`, `Activity`, `GameDetail`, `Assignment`, `Attempt`, `ProgressEvent`, `BadgeAward` y `ScheduledJobRun`. En `apps/api/prisma/schema.prisma` se añaden tres índices compuestos para garantizar `< 500 ms` (`ENG-100`):

```prisma
// En model Attempt:
@@index([organization_id, status, graded_at])
@@index([organization_id, status, finished_at])

// En model ProgressEvent:
@@index([organization_id, type, occurred_at])
```

**Contingencia (`daily_student_activity`):** las consultas operan en vivo sobre las tablas indexadas (`.agents/CONTEXT.md` §12.8 y `architecture-overview.md` §9.4); solo si el benchmark con `seed-volume.ts` supera `500 ms` se creará la vista materializada `daily_student_activity` con refresco nocturno.

## 7. Interfaz

Bajo `apps/web/src/app/(teacher)/estadisticas/`:

1. **Panel principal (`page.tsx`, `/estadisticas`):**
   - Selector de periodo (`Últimos 7 días`, `Últimos 30 días`, `Últimos 90 días` o rango personalizado) y polling automático cada 30 s (`refetchInterval: 30_000`).
   - **Pestaña General (`overview`):** KPIs organizacionales, **Alertas de inactividad (últimas 2 semanas)** y comparativas por nivel (`A1`–`B2`) y por grupo.
   - **Pestaña Por grupo (`groups`):** selector de grupo, conmutador de tendencia (**Cada 30 días** vs. **Semanal 7 días**, mostrando `trend30d` y `trend7d`, Decisión 112) y tabla ordenable con promedio `0,0–5,0`, tendencias `↑`/`↓`/`→`, semanas activas, racha vigente, finalización y tiempo dedicado.
   - **Pestaña Leaderboard privado (`leaderboard`):** aviso de privacidad docente, filtros rápidos por **grupos de nivel (`Todos`, `A1`, `A2`, `B1`, `B2`)** y selector de grupo (`groupId`, Decisión 115), y tabla de ranking.
2. **Ficha de estudiante (`estudiantes/[id]/page.tsx`, `/estadisticas/estudiantes/[id]`):**
   - Filtros por fechas, tipo de actividad y nivel MCER.
   - **Rendimiento:** serie temporal de notas (`0,0–5,0`) contra el promedio del grupo (`groupAverageScore`) y el umbral `3,0`, marcando plazo extendido o duración implausible; conteo de aprobadas (`>= 3,0`) vs. por mejorar (`< 3,0`); y desgloses por `ActivityType`, `GameMechanic` y `Level`.
   - **Constancia:** racha vigente, mejor racha histórica (`bestStreakWeeks`), perdón semanal, tasa de finalización, calendario de 12 semanas ISO y barras de tiempo dedicado por **Día**, **Semana** o **Mes**.
3. **Estados vacíos, carga y error:** ausencia de notas como `—` (nunca `0,0`), `Skeleton` inicial y botón `Reintentar ahora` ante fallo de red.

## 8. Seguridad y privacidad

- **RBAC exclusivo docente:** `StatsController` exige `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(Role.teacher)`. `proxy.ts` redirige a roles distintos de `teacher` y NestJS responde `403 FORBIDDEN` a `student`.
- **Anti-IDOR (Regla G-B02):** toda consulta filtra por `organization_id` del JWT y valida grupos/estudiantes con `findFirst({ where: { id, organization_id } })`.
- **Cero PII en correos y logs (Regla G-C10):** `'teacher-pending-summary'` solo incluye contadores (`pendingRequests`, `ungradedActivities`) y enlaces; los logs solo registran metadatos operativos.

## 9. Pruebas

- **Unitarias y de integración (`apps/api/src/stats/stats.service.spec.ts`):**
  - Separación de fuentes y regla del último intento calificado (`MAX(attempt_number)` con `status = 'graded'`) en promedios agregados (`RF-1`).
  - Serie individual de microjuegos (`game`) con todos los intentos `1..N` en `scoreSeries` y último intento calificado en agregados (`RF-1`, `RF-9`).
  - Alumnos obligados por membresía solapada, denominador congelado `historical_student_count`, exclusión de canceladas del cumplimiento conservando notas y exclusión de `game` (`RF-2`).
  - Recorte de duración a `expected_duration_seconds * 3` y banderas `implausibleDuration` y `usedExtendedDeadline` (`RF-3`, `RF-9`).
  - `overview` por nivel, por grupo e `inactiveAlerts` de 14 días (`RF-5`).
  - `groups/:id` verificando tanto la comparación de tendencia cada **30 días** (`trend30d`) como la comparación **semanal** (`trend7d`) y ordenamiento (`RF-6`).
  - `leaderboard` con ordenamiento determinista y filtrado por grupo (`groupId`) y por grupos de nivel (`A1`, `A2`, `B1`, `B2`) (`RF-8`).
  - `students/:id` con desgloses por `ActivityType`, `GameMechanic` y `Level`, umbral `3.0`, calendario semanal, `bestStreakWeeks` y tiempo diario/semanal/mensual (`RF-9`, `RF-10`).
- **Seguridad y validaciones (`apps/api/src/stats/stats.controller.spec.ts`):**
  - Rol `student` recibe `403 FORBIDDEN` en `/leaderboard` y demás rutas de `/stats/*` (`RF-8`); `groupId` o `studentId` ajeno devuelve `404 NOT_FOUND` y `from > to` devuelve `400 VALIDATION_ERROR` (`RF-11`).
- **Benchmark de volumen (`apps/api/src/stats/stats.performance.spec.ts`):**
  - Sobre `seedVolume()`, verifica que los 4 endpoints responden en `< 500 ms` (`RF-4`).
- **Job cada 3 días (`apps/api/src/maintenance/maintenance.service.spec.ts`):**
  - Verifica envío de `'teacher-pending-summary'` solo cuando hay pendientes, omisión cuando ambos son `0`, e idempotencia por ventana de 3 días en `ScheduledJobRun` (`RF-12`).
- **Frontend y validación docente (`apps/web`):**
  - Pruebas de componentes verificando polling de 30 s (`RF-7`), conmutación de tendencia 30 días / semanal (`RF-6`), filtros por grupos `A1`–`B2` en leaderboard (`RF-8`), vistas general e individual (`RF-5`, `RF-9`, `RF-10`) y sesión con la profesora en staging (`ENG-103`).

## 10. Fuera de alcance y decisiones diferidas

- **Exclusiones del piloto (`.agents/CONTEXT.md` §2.4):** sin leaderboard público para estudiantes, sin exportación PDF/Excel, sin entidades descartadas (`Guardian`, `ConsentRecord`, Supabase Storage/Auth/Realtime, RLS).
- **Sin feature flags `stats` ni `leaderboard` (Decisiones 34 §7 y 41):** acceso controlado únicamente por `@Roles(Role.teacher)`.
- **Sin WebSockets, SSE ni heartbeat:** actualización mediante polling HTTP cada 30 segundos y duraciones calculadas en el servidor.

## 11. Preguntas abiertas

No quedan preguntas abiertas bloqueantes. Las cuatro preguntas iniciales (`Q-01` a `Q-04`) fueron cerradas por el líder del proyecto el 2026-10-27 (`.agents/CONTEXT.md` §14, Decisiones 112 a 115):

- **Q-01 (Cerrada — Decisión 112):** En la vista por grupo (`ENG-101`), además de comparar cada 30 días (`trend30d`), se compara semanalmente (`trend7d`: últimos 7 días vs. 7 días anteriores), con umbral $\pm 0,2$.
- **Q-02 (Cerrada — Decisión 113):** Se aplica el filtro canónico (`Assignment.activity.type !== 'game'` y `cancelled_at === null` para cumplimiento; `Activity.type === 'game'` para práctica autónoma 24/7) sin alterar `Attempt.assignment_id` en Etapa 8.
- **Q-03 (Cerrada — Decisión 114):** El job `teacher_pending_summary` (`ENG-104`) corre en un cron diario a las `08:00 America/Bogota` verificando en `ScheduledJobRun` que hayan transcurrido $\ge 3$ días calendario en Bogotá desde la última ejecución `done`.
- **Q-04 (Cerrada — Decisión 115):** El leaderboard privado (`ENG-102`) ordena deterministamente a todos los alumnos `approved` e incluye filtrado por grupos (`groupId`) y por grupos de nivel MCER (`A1`, `A2`, `B1` o `B2`).

## 12. Registro de cambios

| Fecha | Autor | Descripción |
|---|---|---|
| 2026-10-27 | Agente IA | Redacción inicial de `SPEC-08` en estado `Borrador` cubriendo `ENG-100` a `ENG-104` y documentando `Q-01` a `Q-04`. |
| 2026-10-27 | Líder del proyecto / Agente IA | Cierre de `Q-01` a `Q-04` (Decisiones 112 a 115 de `CONTEXT.md` §14: tendencia a 30 días y semanal en grupo, filtro canónico de `game`, ventana exacta de 3 días en `ScheduledJobRun` y filtro por grupos `A1`, `A2`, `B1`, `B2` en el leaderboard privado) y aprobación de `SPEC-08` (`Estado: Aprobada`). |
| 2026-10-28 | Líder del proyecto / Agente IA | Verificación exhaustiva de la implementación de `SPEC-08` (`ENG-100` a `ENG-104`). Contratos compartidos (`@englove/shared`), índices en `Attempt` y `ProgressEvent`, `StatsService` y `StatsController`, cron cada 3 días de pendientes (`teacher_pending_summary`), vistas en Next.js (`/estadisticas` y `/estadisticas/estudiantes/[id]`), suites de pruebas completas (34 pruebas en API + 11 en web + presupuesto `< 500 ms`) y guardrails validados con 0 errores (`Estado: Verificada`). |
