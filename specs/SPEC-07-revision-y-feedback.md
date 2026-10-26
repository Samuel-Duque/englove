# SPEC-07 — Revisión, feedback, nuevo intento y retención de audios

| Campo | Valor |
|---|---|
| Estado | Aprobada |
| Etapa | 7 — Calificación, feedback y nuevo intento |
| Tareas | ENG-090, ENG-091, ENG-092, ENG-093, ENG-094, ENG-095, ENG-096 |
| Referencias | `.agents/CONTEXT.md` §2.4, §5.1–§5.3, §5.5, §7, §8, §10, §11.2, §14 (decisiones 9, 25, 29, 34 §5–§6, 39, 44, 55, 61, 65, 72, 76, 79, 82–84, 86, 87, 98, 100, 101, 104, 108–111), §15–§17 · `planning/architecture-overview.md` §3.1, §3.5, §3.6, §4.2, §4.5, §6, §7.5–§7.7, §8.3, §8.4, §9.1, §13, §14 · `planning/pbp-development.md` §4 (Etapa 7, H3) · `planning/sdd-process.md` §3–§7 · `specs/SPEC-01-scaffold.md` a `specs/SPEC-06-microjuegos.md` |
| Aprobada por / fecha | Líder del proyecto / 2026-10-26 |

## 1. Contexto y objetivo

Con las Etapas 5 y 6 implementadas, los alumnos resuelven las actividades asignadas (`fill_blank`, `speaking`, `open_question`, `exam`) y practican de forma autónoma 24/7 en los microjuegos (`game` en `/juegos`, sin asignación ni límite de intentos según la Decisión 111). En las actividades asignadas, `fill_blank` y `exam` quedan en `Attempt.status = 'graded'` con nota automática del servidor, mientras que `open_question` y `speaking` quedan en `Attempt.status = 'pending_review'` a la espera de calificación docente (con el audio en Cloudflare R2 y transcodificado a AAC-LC `.mp4`).

El objetivo de esta especificación (**Etapa 7 — Calificación, feedback y nuevo intento**, cierre del **Hito H3: Flujo de speaking y revisión**) es cerrar el ciclo de evaluación y retroalimentación sobre las actividades asignadas:

1. Exponer la cola de revisiones pendientes (`pending_review`) y el listado de calificados (`graded`), y conectar `overdueReviews` en `PendingSummaryService` (`GET /api/v1/dashboard/reminders`) medido desde la fecha de cierre efectiva (Decisión 110).
2. Proveer la interfaz docente `/revision` con pestañas **"Pendientes"** y **"Calificados"**, polling de 30 s, reproducción de audio (5 min TTL, `converted_key` o fallback al raw), botón **"Descargar audio"**, nota `0,0–5,0`, comentario, paquete limitado de stickers (`STICKERS`, Decisión 108) y control **"Habilitar nuevo intento"**.
3. Procesar `POST /api/v1/attempts/:id/review` y `POST /api/v1/attempts/:id/grant-retry` garantizando la inmutabilidad del puntaje tras `graded` (`422 SCORE_NOT_EDITABLE`, permitiendo editar solo `comment` y `stickers`, Decisión 109), la retención de audio a 30 días (`MediaAsset.retention_until`), los eventos `review_received` y `retry_granted`, y el envío del correo `grading-notification` solo en la primera revisión y sin nota ni feedback (Decisiones 34 §5 y 109).
4. Habilitar el portal del alumno en `/feedback` con historial de intentos y acceso al nuevo intento, más el job nocturno de retención de audios a 30 días en R2.

## 2. Alcance

**Incluye:**

- Endpoints docentes (`ENG-090`): `GET /api/v1/reviews/queue` (`pending_review`), `GET /api/v1/reviews/graded` (`graded` de asignaciones: `speaking`, `open_question`, `fill_blank`, `exam`) con filtros (`groupId`, `type`, `from`, `to`) y paginación (`offset`, `limit`), `GET /api/v1/attempts/:id/review-detail` y cálculo real de `overdueReviews` en `PendingSummaryService` (`ENG-045`) desde `effectiveDueAt` (Decisión 110).
- Interfaz en `apps/web/src/app/(teacher)/revision/` con pestañas **"Pendientes"** y **"Calificados"**, polling de 30 s, audio y descarga, nota `0,0–5,0` (solo en `pending_review`), edición de comentario y stickers (`STICKERS`, Decisión 108) e interruptor **"Habilitar nuevo intento"** con `retryExtendUntil` opcional, `effectiveDueAt` visible y alerta si la asignación cerró (`ENG-091`).
- Revisión (`POST /api/v1/attempts/:id/review`): calificación manual inicial (`Attempt.score`, `graded_at` del servidor, `status = 'graded'`), feedback en `Review` (`comment`, `stickers`, `reviewer_id`), rechazo de `score` en todo intento ya `graded` (`422 SCORE_NOT_EDITABLE`, Decisión 109), `MediaAsset.retention_until = graded_at + retention_days`, y `ProgressEvent(review_received)` y correo `grading-notification` sin PII ni nota solo en la primera revisión (`ENG-092`).
- Nuevo intento en asignaciones (`POST /api/v1/attempts/:id/grant-retry` y `allowRetry` en `review`): rol `teacher`, bloqueo en asignaciones canceladas (`409 ASSIGNMENT_CANCELLED`) o en intentos sin asignación / `game` (`409 RETRY_NOT_ALLOWED`, Decisión 111), unicidad atómica (`WHERE retry_granted_at IS NULL`, `409 RETRY_ALREADY_GRANTED`), `retryExtendUntil` futuro (`422 RETRY_EXTEND_INVALID`), `ProgressEvent(retry_granted)` y creación de `attempt_number + 1` con `previous_attempt_id` en `POST /api/v1/assignments/:id/attempts` (`ENG-096`).
- Vistas del alumno en `apps/web/src/app/(student)/feedback/`, activación de `💬 Feedback` en `StudentNav`, nota `0,0–5,0`, estrellas, comentario, stickers, aviso de nuevo intento e historial de intentos (`ENG-093`).
- Job nocturno `audio_retention` (`@nestjs/schedule`, `America/Bogota`, `ScheduledJobRun`) que borra de R2 `key` y `converted_key` con `retention_until < now()` (30 días) o `pending_upload > 7 días`, marcando `MediaAsset.status = 'deleted'` sin alterar `Attempt` ni `Review` (`ENG-095`).
- Prueba E2E con Playwright del Flujo 3 de `CONTEXT.md` §11.2 (`ENG-094`).

**No incluye:**

- Práctica autónoma 24/7 en microjuegos (`ActivityType = game` en `/juegos` sin `Assignment` ni límite de intentos, Decisión 111): su ejecución vive en `SPEC-06` y su serie de progreso en `SPEC-08`.
- Estadísticas agregadas, gráficas, `leaderboard` privado ni el job cada 3 días del correo `teacher-pending-summary` (`SPEC-08` / Etapa 8).
- Cola offline en IndexedDB y aviso de actualización del Service Worker (`SPEC-09`), recursos externos (`SPEC-10`) ni reproducción de audios por el alumno en `/feedback` (`architecture-overview.md` §8.4).

## 3. Requisitos funcionales

1. **RF-1 — Cola de revisión pendiente y listado de calificados (`ENG-090`).**
   El backend debe exponer `GET /api/v1/reviews/queue` y `GET /api/v1/reviews/graded` para el rol `teacher`, filtrando por `organization_id` del JWT sobre intentos de actividades asignadas (`assignment_id IS NOT NULL`) y admitiendo `groupId`, `type` (`fill_blank`, `open_question`, `speaking`, `exam`), `from`, `to`, `offset` (`>= 0`, default `0`) y `limit` (`1..100`, default `20`).
   - **Dado** un profesor autenticado con intentos de asignaciones en `pending_review` (`speaking`, `open_question`) y en `graded` (`speaking`, `open_question`, `fill_blank`, `exam`),
   - **Cuando** consulta `GET /api/v1/reviews/queue` o `GET /api/v1/reviews/graded` con o sin filtros,
   - **Entonces** responde `200 OK` con `{ items, total, offset, limit }`, donde `queue` devuelve intentos en `pending_review` ordenados por `finished_at ASC` (`from`/`to` sobre `finished_at`) y `graded` devuelve intentos de asignaciones en `graded` ordenados por `graded_at DESC` (`from`/`to` sobre `graded_at`), incluyendo alumno (`id`, `displayName` desde `User.name`, `ageSegment`), grupo (`id`, `name`), actividad (`id`, `title`, `type`), asignación (`id`, `dueAt`, `cancelledAt`), intento (`attemptId`, `attemptNumber`, `status`, `score`, `stars`, `finishedAt`, `gradedAt`, `retryGrantedAt`, `retryExtendUntil`, `effectiveDueAt`, `canGrantRetry`), `review` y `mediaAsset` (`id`, `status`, `durationSeconds`, `isConverted`).

2. **RF-2 — Cálculo real de `overdueReviews` desde la fecha de cierre efectiva (`ENG-090`, Decisión 110).**
   `PendingSummaryService` (`GET /api/v1/dashboard/reminders`, `ENG-045`) debe calcular las revisiones vencidas reales desde el cierre efectivo.
   - **Dado** un profesor autenticado y `ungraded_reminder_days` en `FeatureFlagsService` (`games.config.ungraded_reminder_days`, default `3`),
   - **Cuando** invoca `GET /api/v1/dashboard/reminders`,
   - **Entonces** responde `200 OK` con `{ pendingApprovals, overdueReviews, thresholdDays }`, donde `overdueReviews` cuenta los intentos en `organization_id` con `status = 'pending_review'` cuya asignación tenga `cancelled_at IS NULL` y cuya fecha de cierre efectiva (`effectiveDueAt = previous_attempt.retry_extend_until ?? assignment.due_at`) sea anterior a `now() - ungraded_reminder_days * 24 h`.

3. **RF-3 — Detalle de intento para revisión docente y reproducción/descarga de audio (`ENG-090`, `ENG-091`).**
   `GET /api/v1/attempts/:id/review-detail` (rol `teacher`) debe cargar el contexto de evaluación y enlazarse con `GET /api/v1/media/:id/url` y `GET /api/v1/media/:id/download-url` (TTL 5 min).
   - **Dado** un profesor autenticado que selecciona un intento de asignación de su organización en `/revision`,
   - **Cuando** consulta `GET /api/v1/attempts/:id/review-detail` y, para `speaking` con `MediaAsset.status = 'ready'`, solicita `/url` o `/download-url`,
   - **Entonces** `review-detail` responde `200 OK` con `items` (`correctAnswer`, `explanation`, `rubricText`), `answers`, `mediaAsset` (`isConverted: converted_key !== null`, `retentionUntil`), `review` actual e historial `attemptHistory`; `/url` devuelve URL prefirmada de 5 min hacia `converted_key` cuando existe o hacia `key` con `isConverted: false` si falló `ffmpeg`; `/download-url` devuelve URL prefirmada con `Content-Disposition: attachment`; y si `MediaAsset.status = 'deleted'`, informa que el audio expiró por retención sin fallar la carga.

4. **RF-4 — Calificación manual inicial de intentos `pending_review` (`speaking` y `open_question`) (`ENG-092`, Decisiones 108 y 109).**
   `POST /api/v1/attempts/:id/review` debe calificar por primera vez los intentos manuales pendientes.
   - **Dado** un intento de la organización en `status = 'pending_review'`,
   - **Cuando** el profesor envía `POST /api/v1/attempts/:id/review` con `{ score, comment, stickers?, allowRetry?, retryExtendUntil? }` donde `score` está en `0.0..5.0` (1 decimal), `comment` tiene `1..2000` caracteres tras `.trim()` y `stickers` tiene `0..3` códigos válidos sin duplicados del paquete `STICKERS`,
   - **Entonces** en una transacción actualiza `Attempt.score = score`, `Attempt.graded_at = now()` (reloj del servidor) y `Attempt.status = 'graded'`; crea `Review` (`organization_id`, `attempt_id`, `reviewer_id`, `comment`, `stickers`); si hay `MediaAsset` en `'ready'`, fija `MediaAsset.retention_until = Attempt.graded_at + retention_days` (default 30 días); crea `ProgressEvent(review_received)` con `attempt_id` y `value = score` (sin sumar a la racha semanal) y evalúa insignias; si `allowRetry === true`, aplica RF-7 en la misma transacción; y responde `200 OK` con `AttemptReviewDetailView` (o `400`/`422` si faltan datos o algún sticker es inválido).

5. **RF-5 — Edición exclusiva de comentario y stickers e inmutabilidad de la nota en intentos ya `graded` (`ENG-092`, Decisión 109).**
   Una vez que cualquier intento (autocalificado `fill_blank`/`exam` o manual `open_question`/`speaking` ya calificado) está en `status = 'graded'`, su puntaje y `graded_at` son inmutables y solo se permite crear o editar `comment` y `stickers`.
   - **Dado** un intento de la organización en `status = 'graded'`,
   - **Cuando** el profesor envía `POST /api/v1/attempts/:id/review`,
   - **Entonces** si el cuerpo incluye `score !== undefined`, rechaza la petición con `422 Unprocessable Entity` y `code: 'SCORE_NOT_EDITABLE'`; si no incluye `score` y aporta un `comment` válido (obligatorio en manuales; opcional en autocalificadas siempre que haya `comment` o `1..3` códigos en `stickers`), hace upsert de `Review` (`comment`, `stickers`, `reviewer_id`), conserva intactos `Attempt.score` y `Attempt.graded_at`, registra `ProgressEvent(review_received)` solo si el intento no tenía `Review` previo (`isFirstReview === true`), y responde `200 OK`.

6. **RF-6 — Emisión única del correo `grading-notification` sin PII ni nota (`ENG-092`, Decisiones 34 §5 y 109).**
   El correo `'grading-notification'` debe enviarse exclusivamente la primera vez que se registra un `Review` sobre el intento, omitiendo notas y comentarios.
   - **Dado** que `POST /api/v1/attempts/:id/review` confirma una revisión en base de datos,
   - **Cuando** es la primera revisión del intento (`isFirstReview === true`),
   - **Entonces** tras el commit invoca asíncronamente `'grading-notification'` de `MailService` hacia `User.email` del alumno con `{ activityTitle, feedbackUrl: '${APP_PUBLIC_URL}/feedback' }` y 1 reintento en fallo, sin incluir en asunto ni cuerpo `Attempt.score`, estrellas, `Review.comment`, `Review.stickers` ni el nombre del menor; y cuando es una edición posterior de `comment` o `stickers` (`isFirstReview === false`), **no** reenvía el correo.

7. **RF-7 — Habilitación de nuevo intento sobre actividades asignadas (`ENG-092`, `ENG-096`, Decisiones 61, 98 y 111).**
   El profesor puede habilitar un único nuevo intento sobre el último intento calificado de una actividad asignada (`fill_blank`, `open_question`, `speaking`, `exam`) vía `POST /api/v1/attempts/:id/grant-retry { retryExtendUntil? }` o `allowRetry: true` en `review`.
   - **Dado** un profesor autenticado que solicita habilitar nuevo intento sobre el intento `:id` de su organización,
   - **Cuando** el servidor procesa la solicitud en una transacción,
   - **Entonces** valida en orden: (1) si el intento es de tipo `game` o carece de `assignment_id` (los microjuegos viven 24/7 sin asignación ni límite de intentos, Decisión 111), responde `409 RETRY_NOT_ALLOWED`; (2) bloquea la fila de `Assignment` (`SELECT ... FOR UPDATE`) y si `assignment.cancelled_at !== null`, responde `409 ASSIGNMENT_CANCELLED`; (3) si el intento no está en `'graded'` o no es el último del alumno en la asignación (`MAX(attempt_number)` sin hijo `previous_attempt_id = id`), responde `409 RETRY_NOT_ALLOWED`; (4) si `retryExtendUntil` se envía y no es fecha futura (`retryExtendUntil <= now()`), responde `422 RETRY_EXTEND_INVALID`; (5) ejecuta `UPDATE "Attempt" SET retry_granted_at = now(), retry_granted_by = :teacherUserId, retry_extend_until = :retryExtendUntil WHERE id = :id AND organization_id = :orgId AND retry_granted_at IS NULL` y si actualiza `0` filas responde `409 RETRY_ALREADY_GRANTED`; (6) registra `ProgressEvent(retry_granted)` con `attempt_id` y `payload: { retry_extend_until }` y responde `200 OK`.

8. **RF-8 — Interfaz docente de revisión en `/revision` con pestañas, polling y controles de nuevo intento (`ENG-091`, Decisiones 108 y 109).**
   `apps/web/src/app/(teacher)/revision/page.tsx` debe proveer la consola de revisión docente.
   - **Dado** un profesor autenticado en `/revision`,
   - **Cuando** alterna entre **"Pendientes"** y **"Calificados"**, aplica filtros y abre un intento,
   - **Entonces** la cola hace polling cada 30 s (`refetchInterval: 30_000`) y el detalle muestra: reproductor `<audio>` (con aviso si `isConverted === false`) y botón **"Descargar audio"** en `speaking`; respuestas del alumno e ítems con `correctAnswer` y rúbrica; nota `0,0–5,0` (editable solo en `pending_review`; insignia de solo lectura cuando `status = 'graded'`); comentario y selector de hasta 3 stickers de `STICKERS` (editables en ambas pestañas); e interruptor **"Habilitar nuevo intento"** con campo opcional **"Extender fecha límite hasta"** (`retryExtendUntil`), fecha efectiva visible (`effectiveDueAt`) y advertencia *"La actividad ya cerró. Sin una nueva fecha, el alumno no podrá empezar el intento."* si `assignment.dueAt < now` y `retryExtendUntil` está vacío.

9. **RF-9 — Consumo del nuevo intento por el alumno e historial de intentos (`ENG-096`, `ENG-093`).**
   El alumno debe visualizar y consumir la autorización de nuevo intento en actividades asignadas creando `attempt_number + 1`.
   - **Dado** un alumno cuyo último intento en una asignación no cancelada está en `'graded'` con `retry_granted_at !== null` y sin intento hijo,
   - **Cuando** consulta `/inicio` o ejecuta `POST /api/v1/assignments/:id/attempts`,
   - **Entonces** `/inicio` muestra **"Tu profesora te habilitó un nuevo intento"** con `effectiveDueAt = retry_extend_until ?? assignment.due_at`; y `POST /api/v1/assignments/:id/attempts` verifica `now() <= effectiveDueAt` (`409 ASSIGNMENT_CLOSED` si venció) y crea un nuevo `Attempt` en `'in_progress'` con `attempt_number = previous.attempt_number + 1` y `previous_attempt_id = previous.id`, conservando intactos los intentos previos y sus `Review`.

10. **RF-10 — Portal de retroalimentación del alumno en `/feedback` y navegación (`ENG-093`).**
    El alumno debe consultar sus calificaciones y retroalimentación de actividades asignadas en `/feedback` a `<= 4` clics desde `/inicio`.
    - **Dado** un alumno autenticado con intentos de asignaciones en `status = 'graded'`,
    - **Cuando** navega a `/feedback` desde `StudentNav` o desde el enlace del correo (`GET /api/v1/student/feedback` y `GET /api/v1/student/assignments/:assignmentId/feedback`),
    - **Entonces** el ítem `💬 Feedback` en `StudentNav` está habilitado y la vista (adaptada a `kids` / `tween`) muestra las actividades calificadas ordenadas por `graded_at DESC` con nota `0,0–5,0`, estrellas (`0..3`), comentario (`Review.comment`), stickers (`STICKERS`), botón **"Intentar de nuevo"** si tiene reintento vigente e historial cronológico de todos sus intentos en la asignación, sin exponer nunca URLs ni reproductores de audio.

11. **RF-11 — Job nocturno de retención de audios a 30 días y limpieza de subidas huérfanas (`ENG-095`).**
    El job nocturno en `America/Bogota` debe purgar de R2 los audios vencidos y las subidas abandonadas.
    - **Dado** el cron nocturno `audio_retention` registrado en `ScheduledJobRun` (`job_key = 'audio_retention'`, `period_key = 'YYYY-MM-DD'`),
    - **Cuando** procesa los `MediaAsset` de cada organización,
    - **Entonces** selecciona los registros con `(status = 'ready' AND retention_until < now())`, `(status = 'pending_upload' AND created_at < now() - pending_upload_ttl_days)` (7 días) o `status = 'pending_delete'`; borra de R2 tanto `key` como `converted_key` (`_converted.mp4`) y marca `MediaAsset.status = 'deleted'` y `deleted_at = now()`, conservando `attempt_id`, `mime_type`, `duration_seconds`, `Attempt.score` y `Review`; si falla R2 en un elemento, lo deja en `'pending_delete'`, registra el error sin PII y continúa con el lote.

12. **RF-12 — Aislamiento multi-tenant, RBAC y autoridad temporal/numérica (`ENG-090`–`ENG-096`).**
    Todo endpoint de revisión y feedback debe aislar por `organization_id` y rol.
    - **Dado** cualquier petición a `/api/v1/reviews/*`, `/api/v1/attempts/:id/review*`, `/api/v1/attempts/:id/grant-retry`, `/api/v1/media/:id/*` o `/api/v1/student/feedback*`,
    - **Cuando** el rol no está autorizado o el recurso pertenece a otra `organization_id`,
    - **Entonces** un `student` recibe `403 Forbidden` en endpoints docentes o de URLs de audio; accesos a otra `organization_id` responden `404 Not Found` (sin `findUnique` por `id` sin `organization_id`); en `/api/v1/student/feedback*` el `student_id` sale exclusivamente del JWT; los timestamps los fija el servidor y las notas se muestran con coma decimal (`0,0–5,0`).

## 4. Reglas de negocio

- **Autoridad e inmutabilidad del puntaje y tiempos (`CONTEXT.md` §16.2, Decisiones 72, 101 y 109):**
  - El puntaje (`Attempt.score`, `0.0–5.0`) y `Attempt.graded_at` viven exclusivamente en `Attempt`; `Review` solo almacena `comment`, `stickers` y `reviewer_id`.
  - Una vez que un intento está en `status = 'graded'` (autocalificado o manual ya calificado), la nota y `graded_at` son inmutables (`422 SCORE_NOT_EDITABLE`). En **"Calificados"** solo se pueden editar `Review.comment` y `Review.stickers`; para reevaluar la nota se usa **"Habilitar nuevo intento"**.
  - Al calificar manualmente (`open_question`, `speaking`), las estrellas (`0..3`) siguen la Decisión 101: `score >= 4.5` → 3⭐; `3.0 <= score < 4.5` → 2⭐; `0.0 < score < 3.0` → 1⭐; `score = 0.0` o `null` → 0⭐.
- **Comentario y paquete limitado de stickers (Decisiones 79, 84 y 108):**
  - En revisión manual (`open_question`, `speaking`), `comment` es obligatorio (`1..2000` chars). En autocalificadas (`fill_blank`, `exam`), `comment` es opcional, pero guardar requiere al menos `comment` no vacío o `1..3` stickers.
  - `Review.stickers` admite `0..3` códigos sin duplicados del paquete de 6 stickers `STICKERS` en `packages/shared` (Decisión 108).
- **Nuevo intento en asignaciones vs. práctica autónoma 24/7 en microjuegos (Decisiones 25, 61, 98, 110 y 111):**
  - Las actividades asignables por la profesora son `fill_blank`, `open_question`, `speaking` y `exam` (1 intento base por asignación + `grant-retry` sobre el último intento `graded` en asignación no cancelada).
  - Los microjuegos (`ActivityType = game`) **nunca son un `Assignment`**: viven abiertos **24/7** en `/juegos` para práctica autónoma del estudiante sin límite de intentos ni fecha de cierre (Decisión 111). Por tanto, `grant-retry` no aplica a `game` (`409 RETRY_NOT_ALLOWED`).
  - En actividades asignadas, el cierre efectivo del nuevo intento es `effectiveDueAt = previous.retry_extend_until ?? assignment.due_at`, y el umbral de `overdueReviews` (`ungraded_reminder_days`, 3 días) se mide desde `effectiveDueAt` sobre asignaciones no canceladas (Decisión 110).
- **Eventos de progreso, correo único y racha (Decisiones 34 §5, 100 y 109):**
  - `ProgressEvent(review_received)` y el correo `'grading-notification'` se emiten **únicamente en la primera creación de `Review`** (`isFirstReview === true`), sin reemitirse al editar `comment`/`stickers` ni sumar a la racha semanal.
- **Retención de audios (`architecture-overview.md` §8.3–§8.4, Decisiones 55, 76, 86, 87):**
  - `MediaAsset.retention_until = Attempt.graded_at + retention_days` (30 días). Durante esos 30 días solo el `teacher` obtiene URLs prefirmadas (5 min) a `converted_key` (o `key` si `converted_key === null`). Al vencer, el job nocturno borra ambos objetos de R2 y marca `MediaAsset.status = 'deleted'`.

## 5. Contrato de API

Contratos exportados desde `packages/shared/src/api/reviews.ts` (y reexportados en `packages/shared`):

### 5.1 Paquete cerrado `STICKERS` y tipos compartidos (Decisión 108)

```ts
export const STICKER_CODES = [
  'great_job',
  'good_pronunciation',
  'creative_answer',
  'grammar_star',
  'super_effort',
  'keep_practicing',
] as const;

export type StickerCode = (typeof STICKER_CODES)[number];

export interface StickerDefinition {
  code: StickerCode;
  label: string;
  emoji: string;
}

export const STICKERS: Readonly<Record<StickerCode, StickerDefinition>> = {
  great_job: { code: 'great_job', label: '¡Excelente trabajo!', emoji: '🌟' },
  good_pronunciation: { code: 'good_pronunciation', label: '¡Muy buena pronunciación!', emoji: '🎙️' },
  creative_answer: { code: 'creative_answer', label: '¡Respuesta muy creativa!', emoji: '💡' },
  grammar_star: { code: 'grammar_star', label: '¡Estrella de la gramática!', emoji: '📚' },
  super_effort: { code: 'super_effort', label: '¡Súper esfuerzo!', emoji: '🚀' },
  keep_practicing: { code: 'keep_practicing', label: '¡Sigue practicando!', emoji: '💪' },
};
```

### 5.2 Endpoints de revisión docente y feedback estudiantil

| Método y ruta | Rol | Entrada (Query / Body) | Respuesta `200 OK` | Códigos de error (`code`) |
|---|---|---|---|---|
| `GET /api/v1/reviews/queue` | `teacher` | Query: `groupId?`, `type?`, `from?`, `to?`, `offset?=0`, `limit?=20` | `ReviewListResponse` (`items: ReviewListItemView[]`, `total`, `offset`, `limit`) | `400`, `401`, `403` |
| `GET /api/v1/reviews/graded` | `teacher` | Query: `groupId?`, `type?`, `from?`, `to?`, `offset?=0`, `limit?=20` | `ReviewListResponse` | `400`, `401`, `403` |
| `GET /api/v1/attempts/:id/review-detail` | `teacher` | Param: `id` (UUID) | `AttemptReviewDetailView` (`ReviewListItemView` + `items`, `answers`, `attemptHistory`) | `401`, `403`, `404` |
| `POST /api/v1/attempts/:id/review` | `teacher` | Body: `{ score?: number, comment?: string, stickers?: StickerCode[], allowRetry?: boolean, retryExtendUntil?: string \| null }` | `AttemptReviewDetailView` | `400`, `403`, `404`, `409 ASSIGNMENT_CANCELLED`, `409 RETRY_ALREADY_GRANTED`, `409 RETRY_NOT_ALLOWED`, `422 SCORE_NOT_EDITABLE`, `422 RETRY_EXTEND_INVALID` |
| `POST /api/v1/attempts/:id/grant-retry` | `teacher` | Body: `{ retryExtendUntil?: string \| null }` | `GrantRetryResponse` (`attemptId`, `retryGrantedAt`, `retryGrantedBy`, `retryExtendUntil`, `effectiveDueAt`) | `403`, `404`, `409 ASSIGNMENT_CANCELLED`, `409 RETRY_ALREADY_GRANTED`, `409 RETRY_NOT_ALLOWED`, `422 RETRY_EXTEND_INVALID` |
| `GET /api/v1/student/feedback` | `student` | — (`student_id` desde JWT) | `StudentFeedbackListResponse` (`items: StudentFeedbackItemView[]`) | `401`, `403` |
| `GET /api/v1/student/assignments/:assignmentId/feedback` | `student` | Param: `assignmentId` (UUID) | `StudentFeedbackItemView` (`latestAttempt`, `attempts[]`, `hasAvailableRetry`, `effectiveDueAt`) | `401`, `403`, `404` |
| `GET /api/v1/media/:id/url` y `/download-url` | `teacher` | Param: `id` (UUID) | `{ url, expiresIn: 300, isConverted: boolean, durationSeconds: number \| null }` | `401`, `403`, `404` |

## 6. Modelo de datos

Para las capacidades de `SPEC-07` sobre actividades asignadas se utilizan las tablas e índices de `apps/api/prisma/schema.prisma`:

- **`Attempt`**: `score Decimal? @db.Decimal(2,1)`, `graded_at DateTime?`, `retry_granted_at DateTime?`, `retry_granted_by String?`, `retry_extend_until DateTime?`, `previous_attempt_id String? @unique`. Índices: `@@index([organization_id, status, finished_at])`, `@@index([organization_id, student_id, graded_at])` y `@@unique([assignment_id, student_id, attempt_number])`. *(Según la Decisión 111, los intentos de práctica autónoma 24/7 en `game` operan sin `Assignment` con `assignment_id` nullable y `activity_id` directo a `Activity`; las vistas de revisión y `grant-retry` de `SPEC-07` operan sobre intentos con `assignment_id IS NOT NULL`).*
- **`Review`**: `id`, `organization_id`, `attempt_id @unique`, `reviewer_id`, `comment String?`, `stickers String[] @default([])`, `created_at`, `updated_at`.
- **`MediaAsset`**: `key`, `converted_key String?`, `status MediaAssetStatus`, `retention_until DateTime?`, `deleted_at DateTime?`. Índices: `@@index([status, retention_until])` y `@@index([status, created_at])`.
- **`ProgressEvent`**: `ProgressEventType.review_received` y `ProgressEventType.retry_granted`.
- **`ScheduledJobRun`**: registro diario por organización con `job_key = 'audio_retention'` y `period_key = 'YYYY-MM-DD'`.

## 7. Interfaz

### 7.1 Consola docente en `/revision` (`ENG-091`)

- **Ruta y layout:** `apps/web/src/app/(teacher)/revision/page.tsx` con filtros superiores (grupo, tipo de actividad asignable, fechas `Desde`/`Hasta`), pestañas **"Pendientes"** (con contador) y **"Calificados"**, y vista maestro-detalle. Polling con TanStack Query (`refetchInterval: 30_000`, `staleTime: 15_000`), invalidando `['reviews']` y `['dashboard', 'reminders']` tras guardar.
- **Audio (`speaking`):** reproductor `<audio>` alimentado por `GET /api/v1/media/:id/url` y botón **"Descargar audio"** (`/download-url`). Si `isConverted === false`, muestra advertencia amarilla: *"El audio original no pudo convertirse a MP4 estándar. Si tu navegador no lo reproduce directamente, usa el botón Descargar audio."* Si `status === 'deleted'`, informa que el audio cumplió los 30 días de retención.
- **Calificación, edición de feedback y nuevo intento (Decisiones 108 y 109):** input `0,0–5,0` editable solo en `pending_review` y mostrado como insignia de solo lectura cuando `status === 'graded'`; comentario (`1..2000` chars obligatorio en manuales, opcional en autocalificadas) y selector de hasta 3 stickers de `STICKERS` editables también en **"Calificados"**; e interruptor **"Habilitar nuevo intento"** con campo opcional **"Extender fecha límite hasta"** (`retryExtendUntil`), fecha efectiva visible y alerta *"La actividad ya cerró. Sin una nueva fecha, el alumno no podrá empezar el intento."* si `dueAt < now` y `retryExtendUntil` está vacío.

### 7.2 Portal del alumno en `/feedback` y `/inicio` (`ENG-093`)

- **Navegación y ruta:** se habilita `💬 Feedback` en `StudentNav` hacia `apps/web/src/app/(student)/feedback/page.tsx` (máximo 3–4 clics desde `/inicio`), adaptada por tema `kids` (7–10) y `tween` (11–14).
- **Contenido:** tarjetas ordenadas por `graded_at DESC` con título, tipo en español, nota `0,0–5,0`, estrellas (`0..3`), comentario de la profesora, stickers (`emoji` + `label`), banner **"Tu profesora te habilitó un nuevo intento"** con fecha efectiva y botón **"Intentar de nuevo"** (hacia `/actividad/[assignmentId]`), y sección desplegable **"Historial de intentos"** (`Intento #1`, `Intento #2`, fecha, nota, estrellas y revisión de cada intento).

## 8. Seguridad y privacidad

- **Multi-tenant y anti-IDOR (`CONTEXT.md` §16.3):** toda consulta filtra por `organization_id` del JWT (`404 Not Found` si no coincide; prohibido `findUnique` por `id` sin validar `organization_id`). En `/api/v1/student/feedback*`, `student_id` se obtiene exclusivamente del JWT.
- **RBAC:** `/api/v1/reviews/*`, `/api/v1/attempts/:id/review*`, `/api/v1/attempts/:id/grant-retry` y `/api/v1/media/:id/*` exigen `@Roles(Role.teacher)` (`403 Forbidden` para `student`).
- **Privacidad de menores (Decisiones 34 §5, 39 y 109):** el correo `'grading-notification'` se envía solo en la primera revisión del intento y omite nota, estrellas, comentario, stickers y nombre del alumno (solo incluye el título de la actividad y el enlace a `/feedback`). Cero PII en logs y Sentry. Texto plano escapado por React (sin `dangerouslySetInnerHTML`).

## 9. Pruebas

- **Unitarias e integración en `apps/api` (Jest):**
  - **RF-1:** `GET /api/v1/reviews/queue` y `GET /api/v1/reviews/graded` filtran por `organization_id`, `status`, `groupId`, `type`, `from`, `to` y paginan con `offset`/`limit`.
  - **RF-2:** `PendingSummaryService` calcula `overdueReviews` contando intentos `pending_review` de asignaciones activas (`cancelled_at IS NULL`) cuyo `effectiveDueAt` (`previous_attempt.retry_extend_until ?? assignment.due_at`) venció hace más de `ungraded_reminder_days` (3 días, Decisión 110).
  - **RF-3:** `GET /api/v1/attempts/:id/review-detail` devuelve ítems, respuestas, historial y `mediaAsset`; `/media/:id/url` y `/download-url` priorizan `converted_key`, hacen fallback a `key` (`isConverted: false`) y manejan `deleted`.
  - **RF-4:** `POST /api/v1/attempts/:id/review` en `pending_review` valida `score` (`0.0..5.0`), `comment` obligatorio y códigos del paquete `STICKERS` (Decisión 108), actualiza `Attempt` (`score`, `graded_at` del servidor, `status = 'graded'`), fija `retention_until = graded_at + 30 días`, crea `Review` y emite `ProgressEvent(review_received)` sin sumar racha.
  - **RF-5:** `POST /api/v1/attempts/:id/review` en todo intento ya `graded` rechaza `score` con `422 SCORE_NOT_EDITABLE` y sin `score` guarda/actualiza `Review.comment` y `Review.stickers` sin alterar `Attempt.score` ni `graded_at` (Decisión 109).
  - **RF-6:** el commit de la primera revisión (`isFirstReview === true`) dispara `'grading-notification'` con 1 reintento en fallo y sin nota, comentario ni nombre del alumno; editar `comment` o `stickers` después (`isFirstReview === false`) no reenvía el correo ni duplica `ProgressEvent(review_received)` (Decisión 109).
  - **RF-7:** `grant-retry` (y `allowRetry` en `review`) rechaza asignaciones canceladas (`409 ASSIGNMENT_CANCELLED`), intentos de tipo `game` o no últimos/no `graded` (`409 RETRY_NOT_ALLOWED`, Decisión 111), fechas pasadas (`422 RETRY_EXTEND_INVALID`) y concesiones duplicadas/concurrentes (`409 RETRY_ALREADY_GRANTED`), y emite `ProgressEvent(retry_granted)`.
  - **RF-9:** `POST /api/v1/assignments/:id/attempts` consume la autorización creando `attempt_number + 1` con `previous_attempt_id` dentro de `effectiveDueAt` (`409 ASSIGNMENT_CLOSED` si venció), preservando intentos anteriores.
  - **RF-10:** `GET /api/v1/student/feedback` y `/assignments/:assignmentId/feedback` entregan nota, estrellas, `review`, stickers, estado de reintento e historial de intentos del alumno sin URLs de audio.
  - **RF-11:** el job `audio_retention` con reloj simulado borra de R2 `key` y `converted_key` para `ready` con `retention_until < now()`, `pending_upload > 7 días` y `pending_delete`, marca `status = 'deleted'`, registra `ScheduledJobRun`, conserva `Attempt.score` y `Review`, y aisla fallos de R2 en `pending_delete`.
  - **RF-12:** pruebas RBAC (`403` a `student` en revisión y URLs de audio) y anti-IDOR (`404` entre organizaciones).
- **Componentes / UI en `apps/web`:**
  - **RF-8:** `/revision` renderiza pestañas, aviso de compatibilidad de audio, nota en solo lectura para todo intento ya `graded`, edición de comentario/stickers y alerta cuando `dueAt < now` sin `retryExtendUntil`.
  - **RF-10:** `/feedback` y `StudentNav` muestran nota con coma (`0,0–5,0`), stickers, historial de intentos y botón **"Intentar de nuevo"**.
- **E2E en Playwright (`ENG-094`, Flujo 3 de `CONTEXT.md` §11.2):**
  - Cubre **RF-1, RF-3, RF-4, RF-6, RF-8, RF-10 y RF-12**: el profesor califica un intento pendiente en `/revision` con nota, comentario y stickers; se verifica el correo `grading-notification` en log local sin PII ni nota; y el alumno visualiza su calificación y retroalimentación en `/feedback`.

## 10. Fuera de alcance y decisiones diferidas

- Microjuegos (`ActivityType = game`) como espacio autónomo 24/7 sin `Assignment` ni límite de intentos (Decisión 111) → `SPEC-06` y estadísticas en `SPEC-08`.
- Estadísticas agregadas por grupo/alumno, gráficas, exportación, `leaderboard` privado y job cada 3 días del correo `teacher-pending-summary` → `SPEC-08` (`ENG-100` a `ENG-104`).
- Cola offline en IndexedDB y aviso de actualización del Service Worker → `SPEC-09` (`ENG-110`, `ENG-111`).
- Recursos externos (`ExternalResource`) → `SPEC-10` (`ENG-120`, `ENG-121`).
- Tiempo real (WebSockets/SSE) y reproducción de audio por el alumno (`CONTEXT.md` §2.4, `architecture-overview.md` §8.4).

## 11. Preguntas abiertas

No quedan preguntas abiertas. Las cuatro decisiones operativas de esta especificación fueron resueltas y aprobadas por el líder del proyecto el 2026-10-26 (Ronda 12 de `CONTEXT.md` §14, Decisiones 108 a 111):

| ID | Pregunta | Resolución aprobada (2026-10-26) |
|---|---|---|
| `Q-01` | Paquete limitado de stickers (`RF-4`, `RF-5`, `RF-8`, `RF-10`) | **Cerrada (Decisión 108):** Paquete cerrado de 6 stickers (`STICKERS` en §5.1), `0..3` sin duplicados por revisión. |
| `Q-02` | Edición de `Review` en intentos ya calificados y disparo único de correo (`RF-4`, `RF-5`, `RF-6`) | **Cerrada (Decisión 109):** Nota inmutable tras `graded` (`422 SCORE_NOT_EDITABLE`); solo se editan `comment` y `stickers`. `grading-notification` y `ProgressEvent(review_received)` se emiten solo la primera vez. |
| `Q-03` | Referencia temporal de `overdueReviews` (`RF-2`) | **Cerrada (Decisión 110):** Umbral `ungraded_reminder_days` medido desde `effectiveDueAt` sobre asignaciones no canceladas. |
| `Q-04` | Microjuegos (`game`) frente a asignaciones y `grant-retry` (`RF-1`, `RF-7`, `RF-9`) | **Cerrada (Decisión 111):** Los microjuegos nunca son un `Assignment`; viven abiertos 24/7 en `/juegos` para práctica autónoma ilimitada sin asignación ni `grant-retry`. |

## 12. Registro de cambios

| Fecha | Autor | Cambio |
|---|---|---|
| 2026-10-25 | Agente SDD | Redacción inicial de `SPEC-07` en estado `Borrador` cubriendo `ENG-090` a `ENG-096` y propuestas `Q-01` a `Q-04`. |
| 2026-10-26 | Líder del proyecto / Agente SDD | Cierre de `Q-01` a `Q-04` mediante las Decisiones 108 a 111 de `CONTEXT.md` §14. `SPEC-07` pasa a estado `Aprobada`. |
