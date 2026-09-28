# Englove — Decisiones sobre el modelo de datos

> Documento de decisiones resultante de la auditoría del modelo entidad-relación (`architecture-overview.md` §6 y `CONTEXT.md` §7.2), realizada como último paso de la etapa de planeación y antes de redactar SPEC-01 y escribir `schema.prisma`.
>
> Este documento no sustituye a los documentos originales. Sus decisiones se incorporan mediante una nueva ronda en el registro de decisiones.
>
> Fecha: 2026-09-28
>
> **Estado: aplicado el 2026-09-28** mediante la Ronda 5 del registro de decisiones (`CONTEXT.md` §14, decisiones 67–80), con reflejo en `architecture-overview.md` (§6 y §14.5, detalles A56–A70), `pbp-development.md` y `taskboard.md`. La propuesta de parámetros de organización con tipo (auditoría C2) **no se adopta** (§15).

## Resumen de la auditoría

El modelo es sólido en su núcleo (`Activity → Assignment → Attempt`, `organization_id` desde el día 1, `ProgressEvent` append-only, unicidad de intentos en base de datos) y no se rehace. La auditoría encontró cinco huecos que bloqueaban `schema.prisma` (§1–§5), un riesgo funcional que requería decisión de producto (§6) y varias simplificaciones y campos faltantes (§7–§13). §14 registra lo que se revisó y se mantiene; §15, lo que se descartó.

| § | Tema | Origen en la auditoría | Tipo |
|---|---|---|---|
| 1 | Persistencia de sesiones (`AuthSession`) | A1 | Hueco bloqueante |
| 2 | Contador de OTP fallidos en `EmailChangeRequest` | A2 | Hueco bloqueante |
| 3 | Estructura de `ExamDetail`: solo ítems `fill_blank` | A3 | Hueco bloqueante |
| 4 | Forma de `ProgressEvent` | A4 | Hueco bloqueante |
| 5 | Fuente única de la calificación en `Attempt` | A5 | Hueco bloqueante |
| 6 | Un solo grupo vigente por alumno | B1 | Decisión de producto |
| 7 | `Attempt.attempt_number` | C1 | Simplificación |
| 8 | Clave de respuestas en columna propia | C3 | Simplificación / seguridad |
| 9 | Idempotencia persistente de tareas programadas | C4 | Simplificación / robustez |
| 10 | Eliminar `rejected` de `ApprovalStatus` | C5 | Simplificación |
| 11 | Revisión de índices | C6 | Simplificación / rendimiento |
| 12 | Campos y relaciones faltantes | D | Completitud |
| 13 | Política de borrado de claves foráneas | D | Completitud |
| 14 | Revisado y mantenido | E | Ratificación |
| 15 | No adoptado: parámetros de organización con tipo | C2 | Descartado |

---

## 1. Persistencia de sesiones

### 1.1 Situación

La rotación de refresh tokens con detección de reutilización, la familia de sesión (`sid`) que el `JwtAuthGuard` valida en cada petición, el logout y la revocación de sesiones (restablecimiento de contraseña, cambio de correo con OTP, cambio administrativo del correo) están decididos, pero ninguna entidad del modelo guarda sesiones.

### 1.2 Decisión adoptada

Se añade la entidad **`AuthSession`**, una fila por familia de sesión:

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | Es el `sid` del JWT |
| `organization_id` | uuid | Tenant |
| `user_id` | uuid | FK a `User` |
| `refresh_token_hash` | text, único | Hash del refresh vigente; se sustituye en cada rotación |
| `expires_at` | timestamptz | Caducidad del refresh vigente (30 días profesora, 90 días alumno) |
| `rotated_at` | timestamptz, nullable | Última rotación |
| `last_used_at` | timestamptz, nullable | Último uso del refresh |
| `revoked_at` | timestamptz, nullable | Revocación (logout, reutilización, cambio de contraseña o correo) |
| `created_at`, `updated_at` | timestamptz | Servidor |

### 1.3 Reglas

- El refresh token lleva el `sid` y un secreto aleatorio. Si llega un refresh cuyo `sid` existe pero cuyo hash no coincide con `refresh_token_hash`, es una reutilización: se fija `revoked_at` en la familia y se exige login.
- `JwtAuthGuard` rechaza un access token cuyo `sid` tenga `revoked_at` no nulo.
- "Revocar todas las sesiones" = `revoked_at = now()` en todas las `AuthSession` del usuario; "revocar las demás" excluye el `sid` actual.
- Limpieza nocturna: se borran las sesiones caducadas o revocadas hace más de 30 días.
- Se borra en la cascada del alumno.

## 2. Contador de OTP fallidos

### 2.1 Decisión adoptada

`EmailChangeRequest` recibe **`failed_attempts` (smallint, 0 por defecto)**. Cada OTP incorrecto lo incrementa; al llegar a 3 la solicitud queda invalidada (se fija `used_at` o se descarta) y el alumno debe iniciar otra.

## 3. Estructura del examen

### 3.1 Situación

La tabla de scorers declara que el examen es siempre autocalificado y que cada ítem reutiliza el scorer de su subtipo, pero ningún documento define qué subtipos puede contener. Un ítem `open_question` o `speaking` no tiene scorer, y un ítem de mecánica de juego necesita que la clave viaje al cliente (A6), lo que es incompatible con una actividad calificada. La tarea del formulario de examen (ENG-038) ya dependía únicamente del formulario de fill in the blanks.

### 3.2 Decisión adoptada

- **Los ítems de un examen son exclusivamente de tipo `fill_blank`.** Cada ítem es una oración con huecos y su peso.
- `ExamDetail` guarda `config` (JSON con la lista de ítems: `id`, `weight` normalizado y la configuración pública del ítem) y `answer_key` (JSON indexado por `id` de ítem), ambos validados por el esquema Zod del examen (§8).
- El scorer de examen reutiliza el scorer de `fill_blank` por ítem y aplica la media ponderada, el ítem no respondido = 0, el mínimo de 2 ítems y la normalización de pesos ya decididos (decisión 34 §11 y §12).
- Añadir otros subtipos a un examen (por ejemplo, mecánicas de juego en modo sin feedback inmediato) requiere una decisión nueva.

## 4. Forma de `ProgressEvent`

### 4.1 Situación

El campo `value` mezclaba calificaciones (numérico) con identificadores (uuid de intento o de regla); `source` no estaba definido; el `payload` que escribe el job de rachas no figuraba en la entidad; y la regla "cuenta el último intento calificado" exige saber a qué intento pertenece cada evento.

### 4.2 Decisión adoptada

| Campo | Tipo | Uso |
|---|---|---|
| `organization_id`, `student_id` | uuid | Tenant y alumno |
| `type` | `ProgressEventType` | Sin cambios |
| `value` | numeric(6,1), nullable | Solo magnitudes: calificación 0,0–5,0, `1` en `audio_submitted`, semanas en `streak_week` |
| `attempt_id` | uuid, nullable, FK a `Attempt` | `attempt_completed`, `audio_submitted`, `review_received`, `retry_granted` (intento que concede) |
| `payload` | jsonb, nullable | Datos propios del evento: estado de racha en `streak_week`, `badge_award_id` en `badge_awarded` |
| `period_key` | text, nullable | Clave de periodo para eventos periódicos (semana ISO `2026-W40` en `streak_week`) |
| `occurred_at` | timestamptz | Servidor |

- Se elimina `source`.
- Único parcial `ProgressEvent(student_id, type, period_key) WHERE period_key IS NOT NULL` (idempotencia del job semanal, §9).
- **Reparto de responsabilidades de lectura:** las estadísticas de **rendimiento** se calculan sobre `Attempt` (calificación y último intento calificado); las de **constancia** y toda la gamificación (estrellas, insignias, rachas), sobre `ProgressEvent`.

## 5. Fuente única de la calificación

### 5.1 Situación

La calificación se guardaba dos veces (`Attempt.score` y `Review.score`); `graded_at` solo existía en `Review`, así que los intentos autocalificados no tenían fecha de calificación; y un comentario opcional sobre un intento autocalificado (pendiente P-2) crearía un `Review` sin saber qué `score` llevar.

### 5.2 Decisión adoptada

- **`Attempt.score` (numeric(2,1), 0,0–5,0) y `Attempt.graded_at` (timestamptz, servidor) son la única fuente de la calificación** para los cinco tipos de actividad. `graded_at` se fija en `complete` para los autocalificados y en `POST /attempts/:id/review` para la revisión manual.
- **`Review` pasa a ser solo feedback:** `attempt_id` (único), `reviewer_id`, `comment`, `stickers`, `created_at`, `updated_at`. Se elimina `Review.score` y `Review.graded_at`.
- `POST /attempts/:id/review { score, ... }` escribe `score` y `graded_at` en `Attempt` y el feedback en `Review`, en la misma transacción. Sobre un intento autocalificado, `score` no se acepta: solo feedback y habilitación.
- `MediaAsset.retention_until = Attempt.graded_at + retention_days`.
- Restricción `CHECK (score BETWEEN 0 AND 5)` en `Attempt.score`, además de la validación `SCORE_OUT_OF_RANGE` de la API.

## 6. Un solo grupo vigente por alumno

### 6.1 Situación

La aprobación recibía `groupIds` y `GroupMembership` era muchos a muchos. Si la misma actividad se asignaba a dos grupos de un alumno, este tendría dos asignaciones y dos intentos, con doble conteo en finalización y promedios. Además, sin fechas en la membresía, un cambio de grupo impedía saber a qué asignaciones estaba obligado el alumno en cada momento.

### 6.2 Decisión adoptada (decisión de producto del 2026-09-28)

**Un alumno aprobado pertenece a exactamente un grupo a la vez.** Se conserva el historial de cambios de grupo:

- `GroupMembership` recibe `joined_at` (timestamptz, servidor) y `left_at` (timestamptz, nullable, servidor).
- Único parcial `GroupMembership(student_id) WHERE left_at IS NULL`: una sola membresía vigente.
- `POST /students/:id/approve { level, groupId, ... }` (singular) crea la membresía vigente.
- **Cambio de grupo:** `PUT /students/:id/group { groupId }` cierra la membresía vigente (`left_at = now()`) y abre la nueva en una transacción. No existe "sin grupo" para un alumno aprobado.
- **Visibilidad e inicio:** el alumno solo ve e inicia asignaciones de su grupo vigente. Los intentos ya creados se conservan y pueden completarse dentro de su ventana (cierre efectivo + 24 h) aunque el alumno haya cambiado de grupo.
- **Alumnos obligados por una asignación:** los que tuvieron una membresía en su grupo que se solapa con `[opens_at, due_at]`. Es la base del denominador de finalización y del conteo que congela `historical_student_count` al borrar un alumno (decisión 34 §14, que se mantiene para los alumnos borrados, cuyas membresías desaparecen).

## 7. Número de intento

### 7.1 Decisión adoptada

- `Attempt.attempt_number` (smallint, no nulo): `1` para el primer intento; el intento hijo toma `attempt_number` del anterior + 1 y enlaza con `previous_attempt_id`.
- **Único `Attempt(assignment_id, student_id, attempt_number)`**, expresable de forma nativa en Prisma (`@@unique`). **Sustituye a los dos índices únicos parciales** de la decisión 61 (A50):
  - dos inicios simultáneos de un primer intento chocan en `attempt_number = 1`;
  - como solo el último intento puede conceder una habilitación, dos consumos simultáneos de la misma autorización chocan en `n + 1`.
- "Último intento" = `MAX(attempt_number)`; "habilitación sin consumir" = el último intento tiene `retry_granted_at` no nulo. La petición perdedora sigue recibiendo `ATTEMPT_ALREADY_EXISTS`.
- Se conserva `previous_attempt_id` para la trazabilidad. La decisión 61 no cambia en su comportamiento.

## 8. Clave de respuestas en columna propia

### 8.1 Decisión adoptada

- Las tablas de detalle con clave (`FillBlankDetail`, `GameDetail`, `ExamDetail`) guardan `config` (jsonb, pública) y **`answer_key` (jsonb) en columnas separadas**. `OpenQuestionDetail` y `SpeakingDetail` no tienen `answer_key`.
- Prisma Client se configura para **omitir `answer_key` por defecto**; solo `ScoringService` y el editor de la profesora la seleccionan explícitamente.
- `toPublicConfig()` se mantiene: la regla A6 queda protegida en dos capas (no se lee y, si se leyera, no se serializa). En `game` la clave se incluye explícitamente en la respuesta al alumno, como ya estaba decidido.

## 9. Idempotencia persistente de tareas programadas

### 9.1 Situación

Todas las tareas deben ser idempotentes (decisión 64, A55), pero con la cola en memoria un reinicio olvida qué se ejecutó, por ejemplo si el correo de pendientes ya salió en la ventana de 3 días.

### 9.2 Decisión adoptada

- Tabla **`ScheduledJobRun`**: `organization_id`, `job_key`, `period_key`, `status` (`running` / `done` / `failed`), `started_at`, `finished_at`. Único `(organization_id, job_key, period_key)`.
- Cada tarea periódica inserta su fila al empezar (`ON CONFLICT DO NOTHING`); si ya existe con `done`, no hace nada; si existe con `failed` o `running` antigua (más de 1 hora), la retoma.
- `period_key` por tarea: fecha para las nocturnas, semana ISO para la semanal, mes para la mensual, ventana de 3 días para el correo de pendientes.
- Únicos complementarios: `BadgeAward(student_id, badge_rule_id)` y el único parcial de `ProgressEvent` por `period_key` (§4).

## 10. Eliminar `rejected` de `ApprovalStatus`

### 10.1 Decisión adoptada

`ApprovalStatus` queda con `pending_approval` y `approved`. Rechazar una solicitud borra `User` y `Student` en el acto (§8.4 de architecture), así que el estado `rejected` nunca llegaba a persistirse. El login de una cuenta rechazada ya responde `AUTH_INVALID_CREDENTIALS` porque la cuenta no existe.

## 11. Revisión de índices

### 11.1 Decisión adoptada

- **Se añaden índices en claves foráneas** usadas por el borrado en cascada y por las consultas: `Review(attempt_id)` único, `MediaAsset(attempt_id)`, `Assignment(activity_id)`, `GroupMembership(group_id, student_id)`, `AuthSession(user_id)`, `PasswordResetToken(user_id)`, `ProgressEvent(attempt_id)`.
- **Único parcial `MediaAsset(attempt_id) WHERE status = 'ready'`:** un intento de speaking tiene como máximo un audio válido.
- **Se sustituyen:** `Attempt(assignment_id, student_id, created_at)` por el único de §7; los únicos parciales de A50 por el único de §7; `GroupMembership(group_id, student_id)` único por el índice no único anterior más el único parcial de §6 (un alumno puede volver a un grupo).
- **Se retiran** por innecesarios con 100 alumnos: `User(locked_until)` y `Student(organization_id, birth_date)`.
- Se añade `AuthSession(expires_at)` para la limpieza nocturna.

## 12. Campos y relaciones faltantes

### 12.1 Decisiones adoptadas

- **`Activity.expected_duration_seconds`** (int, nullable) y **`Activity.min_plausible_seconds`** (int, nullable), con valores por defecto por tipo en `packages/shared`. El primero recorta el tiempo en estadísticas (`× 3`, architecture §9.4); el segundo es el umbral de `implausible_duration` (architecture §4.4).
- **`User.name`** (obligatorio) para todos los roles; **se elimina `Student.name`**. El nombre del auto-registro se guarda en `User.name`; los correos y la auditoría usan `User.name`.
- **`BadgeRule` es de cada organización:** `organization_id` y único `(organization_id, key)`. El seed crea las reglas iniciales para la organización piloto.
- **`Review.stickers`:** `text[]` con códigos de un catálogo fijo (`STICKERS`) en `packages/shared`; la API rechaza códigos desconocidos.
- **`ExternalResource`:** `organization_id`, `title`, `url` (https), `description` (nullable), `level` (nullable), `position`, `created_by`. El detalle de interfaz lo fija SPEC-10.
- **`Group.archived_at`** (timestamptz, nullable): un grupo archivado no recibe nuevos alumnos ni asignaciones y conserva su historial (§13).
- **El diagrama entidad-relación se completa** con todas las relaciones: `Organization` con todas las tablas de tenant, `Activity.parent_id`, `Activity.created_by`, `Attempt.retry_granted_by`, `Review.reviewer_id`, `ExternalResource.created_by`, `AuthSession`, `ScheduledJobRun` y `BadgeRule` por organización.

## 13. Política de borrado de claves foráneas

### 13.1 Decisión adoptada

| Relación | `onDelete` | Motivo |
|---|---|---|
| `Organization` → cualquier tabla | `Restrict` | No se borran organizaciones en el piloto |
| `User` (profesora) ← `Activity.created_by`, `Review.reviewer_id`, `Attempt.retry_granted_by`, `AuditLog.actor_user_id`, `ExternalResource.created_by` | `Restrict` | No hay borrado de profesoras en el piloto; la autoría y la auditoría no se pierden |
| `User` → `Student`, `AuthSession`, `PasswordResetToken`, `EmailChangeRequest` | `Cascade` | Dependen de la cuenta |
| `Student` → `Attempt`, `GroupMembership`, `ProgressEvent`, `BadgeAward` | `Cascade` | Red de seguridad; el borrado real lo orquesta el servicio de architecture §8.4 (R2 primero) |
| `Attempt` → `Review`, `MediaAsset`, `ProgressEvent.attempt_id` | `Cascade` | Ídem |
| `Attempt.previous_attempt_id` → `Attempt` | `NoAction` | Se comprueba al final de la sentencia: el borrado conjunto de los intentos de un alumno funciona |
| `AuditLog.target_student_id` → `Student` | `Cascade` | Según la propuesta vigente de P-4; si P-4 se decide distinto, pasa a uuid sin FK |
| `Activity` ← `Assignment` | `Restrict` | Una actividad asignada se archiva, no se borra |
| `Activity` → tablas de detalle | `Cascade` | Un borrador sin asignaciones se puede borrar con su detalle |
| `Activity.parent_id` → `Activity` | `Restrict` | El historial de versiones no se rompe |
| `Group` ← `Assignment`, `GroupMembership` | `Restrict` | Un grupo con historia se archiva (`archived_at`), no se borra |
| `Assignment` ← `Attempt` | `Restrict` | Una asignación con intentos no se borra |
| `BadgeRule` ← `BadgeAward` | `Restrict` | Una regla se desactiva (`active = false`) |

## 14. Revisado y mantenido

- **Tablas de detalle 1:1 por tipo de actividad** (decisión 5). Un `config` único en `Activity` sería más simple, pero las tablas dan columnas con tipo donde importan (`mechanic`, duraciones) y, con §8, un lugar natural para `answer_key`.
- **`Attempt.payload` en JSON, sin tabla de eventos de intento.** Se añade una regla: `POST /attempts/:id/events` combina las respuestas nuevas con el JSON existente en una sola sentencia (`payload || $nuevas`, indexado por `itemId`) o bajo `SELECT … FOR UPDATE`, para que dos lotes simultáneos no se pisen.
- **Campos de habilitación en el intento que concede** (decisión 61).
- **`can_switch_interface` y la tarea mensual** (decisión 34 §15), aunque sean derivables de `birth_date`.
- **`historical_student_count`** (decisión 34 §14), que sigue siendo necesario para los alumnos borrados.

## 15. No adoptado

- **Parámetros de organización con tipo (auditoría C2).** Se proponía mover `passing_score`, `retention_days`, `pending_upload_ttl_days` y `ungraded_reminder_days` de `FeatureFlag.config` a columnas con tipo en `Organization`, junto con `timezone`. **No se adopta:** esos parámetros siguen en la configuración de `FeatureFlag` tal como estaba decidido (decisión 20, ENG-018), y la zona horaria sigue fijada en America/Bogota.
