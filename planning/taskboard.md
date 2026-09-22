# Englove — Taskboard

> **Propósito.** Estado operativo del trabajo: qué está hecho, qué sigue, qué está bloqueado y por qué. Las tareas se agrupan por las etapas de [`pbp-development.md`](./pbp-development.md), siguen la arquitectura de [`architecture-overview.md`](./architecture-overview.md) y el proceso SDD de [`sdd-process.md`](./sdd-process.md). Las decisiones de producto viven en `.agents/CONTEXT.md`; este tablero no las redefine.
>
> Última actualización: 2026-09-22. Aplica la decisión 34 de CONTEXT §14 (`incongruencias-y-decisiones-definitivas.md`): se eliminan ENG-006, ENG-022, ENG-042 y ENG-136; se crean ENG-045, ENG-073, ENG-104 y DOC-06; se reescriben las tareas afectadas. Etapa activa: **0 — Arranque**, en paralelo con **1 — Scaffold**. Ninguna spec redactada todavía; la primera tarea de spec es SPEC-00.

---

## Cómo usar este tablero

- **Estados:** `Backlog` (definida, aún no lista), `Por hacer` (pertenece a la etapa activa o a la siguiente y se puede tomar respetando sus dependencias), `En curso`, `Bloqueado` (espera una decisión o a un tercero), `Hecho`.
- **Prioridad:** `P0` imprescindible para lanzar el piloto; `P1` importante, negociable en fecha; `P2` deseable.
- **Límite de trabajo en curso:** 3 tareas `En curso` a la vez.
- **Tipos de tarea:** `SPEC-NN` redacta y aprueba la spec de una etapa; `ENG-nnn` implementa; `DOC-nn` documenta el proyecto.
- **Regla SDD:** ninguna tarea `ENG` pasa a `En curso` sin que la `SPEC` de su etapa esté Aprobada. Cada tarea `ENG` indica la spec que implementa en la columna "Spec".
- Una tarea pasa a `Hecho` cuando cumple la Definición de Hecho de `pbp-development.md` §3.
- Al mover una tarea, actualizar el resumen y la fecha del encabezado. Si cierra un pendiente de CONTEXT §15, actualizar CONTEXT en el mismo cambio. Si cierra la última `ENG` de una spec, actualizar el estado de la spec en `specs/README.md`.
- Las etapas se numeran igual que el orden de construcción de CONTEXT §12. La Etapa 0 agrupa lo que debe pasar antes o en paralelo al primer código.
- Ninguna tarea de este tablero puede construir algo de CONTEXT §2.4. Si aparece, se retira y se propone en CONTEXT §14.

---

## Resumen

| Estado | Tareas |
|---|---|
| Hecho | 8 |
| En curso | 0 |
| Por hacer | 18 |
| Bloqueado | 0 |
| Backlog | 84 |
| **Total** | **110** |

Eliminadas el 2026-09-22 por la decisión 34 (no cuentan en el total): ENG-006 (documentos legales), ENG-022 (CRUD `Guardian`), ENG-042 (`ConsentRecord`), ENG-136 (consentimientos recogidos).

---

## Bloqueado — esperando decisión

Ninguna tarea bloqueada. Las tres que lo estaban (ENG-103, ENG-133, ENG-134) se desbloquearon el 2026-09-21 con las decisiones 25, 27 y 28 de CONTEXT §14; ENG-133 y ENG-134 se renumeraron como ENG-095 y ENG-096 y pasaron a la Etapa 7.

---

## Hecho

| ID | Tarea | Fecha |
|---|---|---|
| DOC-01 | `.agents/CONTEXT.md`: contexto raíz, decisiones y pendientes | 2026-09-18 |
| DOC-02 | `planning/architecture-overview.md` | 2026-09-18 |
| DOC-03 | `planning/pbp-development.md` | 2026-09-18 |
| DOC-04 | `planning/taskboard.md` | 2026-09-18 |
| DOC-05 | `planning/sdd-process.md`: metodología Spec-Driven Development, plantilla y ciclo de vida | 2026-09-21 |
| ENG-002 | Decidir proveedor de hosting por capa: Vercel (web) y Render (API). Registrado en CONTEXT §6 y §14 | 2026-09-21 |
| ENG-005 | Cerrar con el líder del proyecto: métrica del piloto (retirada, foco en rendimiento y constancia), retención de audios y política de reintentos. Registrado en CONTEXT §14 | 2026-09-21 |
| ENG-009 | Cerrar el mecanismo de acceso del alumno: correo y contraseña con recuperación. Registrado en CONTEXT §4 y §14 | 2026-09-21 |

---

## En curso

Ninguna tarea en curso.

---

## Por hacer

### Etapa 0 — Arranque

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| SPEC-00 | Crear `specs/` con `README.md` (índice) y `_template.md` según `sdd-process.md` §4 y §5 | P0 | — | — | Por hacer |
| SPEC-01 | Redactar y aprobar SPEC-01 Scaffold: esquema núcleo, convenciones, CI, entornos | P0 | SPEC-00 | — | Por hacer |
| ENG-001 | Inicializar repositorio git local y remoto; proteger rama principal; plantilla de PR con la Definición de Hecho y campo obligatorio de spec y RF | P0 | — | — | Por hacer |
| ENG-003 | Reservar dominio provisional; subdominios `app.` / `api.` y `app-staging.` / `api-staging.`; crear proyectos en Vercel (`apps/web`) y Render (`apps/api`) para staging y producción | P0 | ENG-001 | — | Por hacer |
| ENG-004 | Crear proyectos Supabase staging y producción (solo PostgreSQL, sin buckets); crear cuenta de Cloudflare R2 con buckets privados `englove-dev`, `englove-staging` y `englove-prod` y credenciales con alcance a cada bucket (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`); credenciales fuera del repositorio. (Decisión 34 §21) | P0 | — | — | Por hacer |
| ENG-007 | Especificación de tokens de diseño con dos conjuntos (Kids, Teens) y lista de componentes base, incluidos los estados de error por tema (architecture §3.6) | P1 | — | — | Por hacer |
| ENG-008 | Prototipo navegable del portal del alumno con la navegación de 2–4 clics por zona (architecture §3.1) y sesiones de observación con 3 niños por segmento | P1 | ENG-007 | — | Por hacer |

### Etapa 1 — Scaffold

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-010 | Monorepo pnpm + Turborepo: `apps/web`, `apps/api`, `packages/shared`, `tooling` con tsconfig, eslint y prettier compartidos | P0 | SPEC-01, ENG-001 | SPEC-01 | Por hacer |
| ENG-011 | `apps/web`: Next.js 14+ App Router, TypeScript estricto, Tailwind, shadcn/ui, grupos de rutas `(public)`, `(teacher)`, `(student)`; `ErrorBoundary` global y componentes `ErrorState` reutilizables por zona con variantes Kids / Teens / panel y mapa único `code → mensaje` sin detalles técnicos (decisión 34 §17, architecture §3.6) | P0 | ENG-010 | SPEC-01 | Por hacer |
| ENG-012 | `apps/api`: NestJS, configuración validada al arrancar (incluidas variables `R2_*`), `health`, Swagger automático, logging pino; Dockerfile con `ffmpeg` y `ffprobe`; filtro global de excepciones que devuelve `{ statusCode, code, message }` sin datos internos | P0 | ENG-010 | SPEC-01 | Por hacer |
| ENG-013 | `schema.prisma` núcleo con todas las entidades de CONTEXT §7.2: sin `Guardian` ni `ConsentRecord`; `Student` con `guardian_name`, `guardian_contact` (nullable), `birth_date`, `age_segment`, `can_switch_interface`, `approval_status`; `User` con bloqueo y `terms_accepted_at` / `terms_version`; `PasswordResetToken`; `EmailChangeRequest`; `Assignment.historical_student_count`; `Attempt` con `retry_*`, `previous_attempt_id`, `score numeric(2,1)`, `flags`; `MediaAsset` con `converted_key`, `duration_seconds`; `SpeakingDetail` con `min_duration_seconds` / `max_duration_seconds`; enums sin `guardian`, `ConsentStatus`, `ConsentMethod` ni `RegistrationSource`; `organization_id`; índices; migración inicial. Seeds: `seed.ts` (organización piloto y profesora), `seed-dev.ts` (≥ 10 alumnos con niveles A1–B2, ambos segmentos, `pending_approval` y `approved`, intentos `graded` / `pending_review` / `abandoned`, rachas activas y perdonadas; una actividad `published` de cada tipo y mecánica; asignaciones abiertas, cerradas y próximas) y `seed-volume.ts` (100 alumnos, 3 meses de intentos). (Decisión 34 §1, §2, §13–§16, §22) | P0 | ENG-012 | SPEC-01 | Por hacer |
| ENG-014 | `packages/shared`: enums (sin `guardian`, `ConsentStatus`, `ConsentMethod`, `RegistrationSource`), tipos del contrato de actividad, registro de esquemas Zod (esqueleto). Los DTOs de `start`, `events` y `complete` no incluyen campos de timestamp (decisión 34 §3) | P0 | ENG-010 | SPEC-01 | Por hacer |
| ENG-015 | CI: lint, typecheck, tests, `prisma migrate deploy` en staging; check que prohíbe `db push`; despliegue automático de staging en Vercel y Render desde `main` | P0 | ENG-013, ENG-004, ENG-003 | SPEC-01 | Por hacer |
| ENG-016 | Entorno local: docker compose con Postgres 16 (y MinIO opcional como S3 local), `.env.example` con variables `R2_*` y sin ninguna de Supabase Storage, `ffmpeg` en el README, arranque en menos de 30 minutos; scripts `seed`, `seed:dev`, `seed:volume` | P1 | ENG-012 | SPEC-01 | Por hacer |
| ENG-017 | Test de esquema: toda tabla de tenant tiene `organization_id` | P1 | ENG-013 | SPEC-01 | Por hacer |
| ENG-018 | Tabla `FeatureFlag` + servicio en la API + carga en el frontend al iniciar sesión. Claves iniciales: `games`, `extra_content` (sin `stats` ni `leaderboard`: el panel estadístico se controla solo por RBAC, decisión 34 §7); configuración `passing_score = 3.0`, `retention_days = 30`, `pending_upload_ttl_days = 7`, `ungraded_reminder_days = 3` | P1 | ENG-013 | SPEC-01 | Por hacer |
| ENG-019 | Cuenta de correo transaccional Resend con dominio de envío verificado (SPF, DKIM); `MailService` con un solo remitente y plantillas `signup-received`, `approved`, `password-reset`, `email-change-otp`, `grading-notification` (sin nota ni feedback, solo aviso y enlace a `/feedback`) y `teacher-pending-summary`; salida al log en `local`. (Decisión 34 §1, §5, §18) | P0 | ENG-003 | SPEC-01 | Por hacer |
| SPEC-02 | Redactar y aprobar SPEC-02 Identidad y sesión: login por correo, bloqueo 10/10, recuperación, cambio de correo con OTP, contraseña 8–16 sin espacios, rate limiting (architecture §8.3), guards, tenant, `User` y `Student` con datos del acudiente. Incluye la política de rate limiting como requisito de seguridad | P0 | SPEC-00 | — | Por hacer |

---

## Backlog

### Etapa 2 — Identidad y roles

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-020 | Login único con correo y contraseña para todos los roles: argon2id, access y refresh en cookies `httpOnly` (30 días profesora / 90 días alumno), rotación con detección de reutilización, logout, redirección por rol; rechaza `pending_approval` (`ACCOUNT_PENDING_APPROVAL`) y `rejected` (`AUTH_INVALID_CREDENTIALS`) | P0 | SPEC-02, ENG-013 | SPEC-02 | Backlog |
| ENG-021 | Guards `JwtAuthGuard`, `RolesGuard`, `TenantContext`; extensión de Prisma con filtro `organization_id` | P0 | ENG-020 | SPEC-02 | Backlog |
| ENG-023 | CRUD `Student` (`guardian_name`, `guardian_contact`, `birth_date`, nivel, segmento, `can_switch_interface`, `approval_status`) con `User` asociado con correo obligatorio y único por organización; `guardian_*` editables solo por `teacher` (403 para el alumno); API `GET /students/requests`, `POST /students/:id/approve` (con corrección de `guardian_*` y `age_segment`), `POST /students/:id/reject`. Sin `POST /students`: la única vía de alta es `signup` (decisión 34 §1) | P0 | ENG-021 | SPEC-02 | Backlog |
| ENG-024 | Bloqueo por intentos fallidos para todos los roles: `failed_login_count`, `locked_until`, 10 intentos → 10 minutos, `AUTH_ACCOUNT_LOCKED`; `GET /students/locked` y `POST /students/:id/unlock` para la profesora (la pestaña "Bloqueados" llega en ENG-041) | P0 | ENG-020 | SPEC-02 | Backlog |
| ENG-025 | Pantallas de login, recuperación y restablecimiento de contraseña (`(public)`), con validación 8–16 caracteres sin espacios y sugerencia de frase memorable para Kids; estados de error de ENG-011 | P0 | ENG-020, ENG-028 | SPEC-02 | Backlog |
| ENG-026 | Pruebas de integración: auth, auto-registro (`pending_approval` no inicia sesión; crea solo `User` + `Student`; rechaza contraseñas fuera de política), rotación de refresh, bloqueo y desbloqueo, recuperación (token usado / caducado, revocación de sesiones), cambio de correo con OTP (3 fallos invalidan), rate limiting (`429` en cada límite de architecture §8.3), 403 por rol, aislamiento de tenant en dos modelos | P0 | ENG-021, ENG-024, ENG-027, ENG-028, ENG-029 | SPEC-02 | Backlog |
| ENG-027 | Endurecimiento HTTP y rate limiting (decisión 34 §20): helmet, CORS con allowlist, comprobación de `Origin` en peticiones mutantes; `@nestjs/throttler` con la tabla de architecture §8.3: login 10 / 15 min por IP, signup 10 / hora por IP, forgot-password 5 / hora por IP y por correo, email-change 5 / hora por usuario, API autenticada 120 / min por usuario, no autenticada 30 / min por IP; `429 RATE_LIMITED` con `Retry-After` | P0 | ENG-012 | SPEC-02 | Backlog |
| ENG-028 | Recuperación de contraseña y cambio de correo: `forgot-password` (respuesta uniforme), `PasswordResetToken` con hash y 30 min, `reset-password` con revocación de sesiones y política 8–16 sin espacios (`PASSWORD_POLICY`); `POST /students/:id/reset-password` (solo `teacher`) envía el mismo enlace al correo del alumno, sin contraseña temporal; `EmailChangeRequest` con OTP de 6 dígitos y 10 min, `POST /me/email-change` (contraseña actual + correo nuevo único, OTP al correo nuevo) y `POST /me/email-change/confirm` (aplica, avisa al correo anterior, revoca sesiones). (Decisión 34 §1) | P0 | ENG-020, ENG-019 | SPEC-02 | Backlog |
| ENG-029 | Auto-registro del estudiante (Decidido, CONTEXT §4.1, decisiones 33 y 34 §1): pantalla `/registro`, `POST /auth/signup` sin autenticación previa, crea solo `User` (con `terms_accepted_at` / `terms_version`) + `Student` en `pending_approval` con `guardian_name` y `guardian_contact` en el body como campos del `Student`; `age_segment` y `can_switch_interface` derivados de `birthDate`; checkbox de T&C obligatorio; correo `signup-received`; validación de correo único y contraseña 8–16 sin espacios | P0 | ENG-020, ENG-023, ENG-019 | SPEC-02 | Backlog |
| SPEC-03 | Redactar y aprobar SPEC-03 Gestor de contenidos, incluida la bandeja de solicitudes de registro, la pestaña de bloqueados, los recordatorios del dashboard y las reglas de examen (mínimo 2 ítems, normalización de pesos) y de duración de speaking, con criterios Dado/Cuando/Entonces | P0 | SPEC-00 | — | Backlog |

### Etapa 3 — Gestor de contenidos (Hito H1)

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-030 | Esquemas Zod completos por tipo (`fill_blank`, `open_question`, `speaking`, `game` × 5 mecánicas, `exam`) con separación `config` / `answerKey`, `toPublicConfig()` y fórmula de fracción de acierto por mecánica | P0 | SPEC-03, ENG-014 | SPEC-03 | Backlog |
| ENG-031 | Tablas de detalle 1:1 en Prisma y migración | P0 | ENG-013, ENG-030 | SPEC-03 | Backlog |
| ENG-032 | Endpoints `activities`: CRUD, estados `draft` / `published` / `archived`, duplicar, versionado por duplicación cuando hay intentos; en `POST /activities/:id/publish` validación de mínimo 2 ítems para `exam` (`EXAM_MIN_ITEMS`; el borrador se guarda sin restricción); al guardar un `exam`, normalización proporcional de pesos a 100 % con la respuesta devolviendo los pesos efectivos (decisión 34 §11 y §12) | P0 | ENG-021, ENG-031 | SPEC-03 | Backlog |
| ENG-033 | Panel: layout de la profesora, navegación, lista de actividades con filtros por nivel y tipo | P0 | ENG-025 | SPEC-03 | Backlog |
| ENG-034 | Formulario fill in the blanks: editor de oraciones con huecos y opciones | P0 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-035 | Formulario pregunta abierta | P0 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-036 | Formulario speaking: consigna, ejemplo opcional, duración mínima fija (2 s, solo lectura) y duración máxima configurable (`max_duration_seconds`, default 120, máximo 300) validada por el esquema Zod (decisión 34 §13) | P0 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-037 | Formularios de microjuego, uno por mecánica, derivados de los esquemas Zod, con plantillas de ejemplo | P1 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-038 | Formulario examen: composición de ítems con pesos; al guardar, los pesos se normalizan a 100 % y el formulario muestra el peso ajustado de cada ítem con un mensaje de confirmación del ajuste; aviso si hay menos de 2 ítems al intentar publicar (decisión 34 §11 y §12) | P1 | ENG-034 | SPEC-03 | Backlog |
| ENG-039 | Vista previa de actividad en el panel reutilizando el renderizador del alumno (se entrega en la Etapa 5) | P1 | ENG-063 | SPEC-05 | Backlog |
| ENG-040 | CRUD `Group` y membresías (API y panel) | P0 | ENG-023, ENG-033 | SPEC-03 | Backlog |
| ENG-041 | Gestión de alumnos en el panel (`alumnos/`): lista y ficha con edición de nivel, segmento y datos del acudiente (`guardian_name`, `guardian_contact`, editables solo por la profesora, directamente en `Student`; sin pantalla de acudiente separada); botón "Enviar enlace de recuperación" (`POST /students/:id/reset-password`); **pestaña "Bloqueados"** con listado de cuentas bloqueadas por intentos fallidos y desbloqueo en un clic (`POST /students/:id/unlock`). Sin alta directa ni contraseñas temporales (decisión 34 §1 y §8) | P0 | ENG-023, ENG-024, ENG-028, ENG-033 | SPEC-03 | Backlog |
| ENG-043 | Sesión cronometrada de onboarding: la profesora crea su primera actividad en menos de 10 minutos; iterar formularios si no se cumple | P0 | ENG-034, ENG-035, ENG-036 | SPEC-03 | Backlog |
| ENG-044 | Bandeja de solicitudes de registro (Decidido, CONTEXT §4.1): pestaña "Solicitudes" en `alumnos/` sobre `GET /students/requests`; al aprobar (`POST /students/:id/approve`) la profesora asigna nivel y grupo y puede editar `guardian_name`, `guardian_contact` y corregir `age_segment` directamente en el `Student`; correo `approved`; rechazar (`POST /students/:id/reject`) borra `User` + `Student`. Sin ningún paso de consentimiento (decisión 34 §1 y §2) | P0 | ENG-029, ENG-040, ENG-041 | SPEC-03 | Backlog |
| ENG-045 | Recordatorios del dashboard de la profesora (decisión 34 §8): módulo `dashboard` con `PendingSummaryService` y `GET /dashboard/reminders`; ruta `(teacher)/inicio/` con tarjetas minimalistas (contador + enlace directo) para solicitudes de registro pendientes y actividades sin calificar hace más de `ungraded_reminder_days` (3 por defecto; esta tarjeta se llena con datos reales desde ENG-090). Separado del panel estadístico | P1 | ENG-044, ENG-018 | SPEC-03 | Backlog |
| SPEC-04 | Redactar y aprobar SPEC-04 Asignación (incluye la semántica de `due_at` sobre `started_at` del servidor, decisión 34 §10) | P0 | SPEC-00 | — | Backlog |
| SPEC-05 | Redactar y aprobar SPEC-05 Portal e intentos: navegación por zona, ciclo de intento con reloj del servidor y regla de `due_at` (Dado/Cuando/Entonces para ambos casos), scoring 0,0–5,0 con ítem no respondido = 0, speaking (duración, transcodificación, fallback), algoritmo de rachas (RF con Dado/Cuando/Entonces por cada una de las 4 reglas), `age_segment` y cambio de interfaz con job mensual, progreso, cascada con denominador congelado | P0 | SPEC-00 | — | Backlog |

### Etapa 4 — Asignación

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-050 | Modelo y endpoints `assignments`: actividad, grupos, `opens_at`, `due_at`, `historical_student_count` (nullable, lo fija ENG-070); validaciones (solo `published`, fechas coherentes, sin duplicados activos). Sin `max_attempts`: un intento por asignación (decisión 25) | P0 | SPEC-04, ENG-032, ENG-040 | SPEC-04 | Backlog |
| ENG-051 | Interfaz de asignación a uno o varios grupos con fechas en America/Bogota | P0 | ENG-050 | SPEC-04 | Backlog |
| ENG-052 | Vista de asignaciones por grupo | P1 | ENG-051 | SPEC-04 | Backlog |
| ENG-053 | E2E flujo 1 (Playwright): la profesora crea y asigna una actividad | P0 | ENG-051 | SPEC-04 | Backlog |

### Etapa 5 — Portal del estudiante (Hito H2)

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-060 | Layout del alumno con tokens por `age_segment` (`data-theme`), barra de navegación de hasta cinco zonas, techos de clics por zona según architecture §3.1 | P0 | SPEC-05, ENG-007, ENG-025 | SPEC-05 | Backlog |
| ENG-061 | Home del alumno: asignaciones abiertas ordenadas por `due_at`; tarjeta con aviso de nuevo intento habilitado | P0 | ENG-050, ENG-060 | SPEC-05 | Backlog |
| ENG-062 | Ciclo de intento en la API: start con `attemptToken` y regla de un intento por asignación (`ATTEMPT_ALREADY_EXISTS`, consumo de habilitación, `previous_attempt_id`), eventos por lotes idempotentes (`clientEventId`), complete; estados y `flags`. **Reloj del servidor (decisión 34 §3):** `started_at` y `finished_at` los asigna la API; los DTOs no aceptan timestamps (`forbidNonWhitelisted`). **Regla de `due_at` (decisión 34 §10):** la validación se aplica al momento de `started_at`; iniciar tras `due_at` (o tras `extendUntil`) responde `409 ATTEMPT_CLOSED` sin crear el intento; un intento iniciado antes del cierre siempre puede completarse aunque termine después (tests con reloj simulado) | P0 | ENG-050 | SPEC-05 | Backlog |
| ENG-063 | Runtime del contrato en el cliente: `ActivityRenderer` y `useAttempt`; el `at` de los eventos es solo informativo; estado de error "actividad cerrada" con el texto de architecture §3.6 | P0 | ENG-062 | SPEC-05 | Backlog |
| ENG-064 | `ScoringService` con conversión de fracción a 0,0–5,0 (`round(fraction × 5, 1)`), `passing_score`, `SCORE_OUT_OF_RANGE`; fill in the blanks: renderizador, scorer con pruebas unitarias, corrección por ítem en `complete`. Casos de prueba obligatorios: ítem sin respuesta recibe 0 y su peso entra en el denominador; en `exam`, media ponderada con pesos normalizados (decisión 34 §11) | P0 | ENG-063 | SPEC-05 | Backlog |
| ENG-065 | Pregunta abierta: renderizador → `pending_review` | P0 | ENG-063 | SPEC-05 | Backlog |
| ENG-066 | Módulo `media` sobre **Cloudflare R2** (`@aws-sdk/client-s3` + presigner, variables `R2_*`, sin Supabase Storage): URLs firmadas de subida (10 min), reproducción y descarga (`GET /media/:id/download-url`, 5 min, solo `teacher`); `MediaAsset` con `mime_type` detectado en cliente, `duration_seconds`, `converted_key`; verificación de derechos; límite de 10 MB; **validación de duración** en la confirmación con `ffprobe`: < 2 s → `AUDIO_IMPLAUSIBLE_DURATION`, > `max_duration_seconds` → `AUDIO_EXCEEDS_MAX_DURATION`; **transcodificación** asíncrona con `ffmpeg` (`fluent-ffmpeg`) a MP4/AAC mono 64 kbps en `<assetId>_converted.mp4`, borrado del raw al terminar, cola en memoria con 3 reintentos, fallback al raw con `converted_key = null` si falla (tests). (Decisión 34 §13, §21, §22) | P0 | ENG-062 | SPEC-05 | Backlog |
| ENG-067 | Speaking: `getSupportedMimeType()` + `MediaRecorder` con tope de grabación en `max_duration_seconds` y contador visible, blob en IndexedDB, subida firmada a R2, confirmación en `complete`; prueba en iOS real y en Firefox | P0 | ENG-066 | SPEC-05 | Backlog |
| ENG-068 | `ProgressEvent` (valores en 0,0–5,0) + motor de insignias con `BadgeRule` + rachas semanales con el **algoritmo de 4 reglas** de architecture §9.3 (decisión 34 §9): solo semanas activas cuentan; perdón solo con racha activa (racha 0 no consume perdón); recuperación tras 2 semanas activas consecutivas; máximo 1 perdón. Tests unitarios por caso: racha 0 sin perdón posible, perdón usado requiere 2 semanas activas para recuperarse, no acumulación, dos inactivas seguidas rompen. Seed de reglas iniciales (primera tarea, primer audio, 4/8/12 semanas, 5 años) | P0 | ENG-062 | SPEC-05 | Backlog |
| ENG-069 | Vista de progreso personal del alumno: estrellas derivadas de la calificación, insignias, rachas con perdón disponible (3 clics) | P0 | ENG-068 | SPEC-05 | Backlog |
| ENG-070 | Borrado en cascada de alumno con test de integración escrito antes. Paso previo: **congelar el denominador histórico** fijando `Assignment.historical_student_count` en las asignaciones de sus grupos que aún lo tengan `null` (decisión 34 §14). Luego: intentos, revisiones, eventos, insignias, membresías, tokens de recuperación, solicitudes de cambio de correo, `MediaAsset` y objetos raw y convertidos en R2, `Student` y `User`. El test verifica cero filas y objetos huérfanos y que el denominador congelado no cambia | P0 | ENG-066 | SPEC-05 | Backlog |
| ENG-071 | Texto a voz en consignas Kids (Web Speech API); objetivos táctiles de al menos 48 px | P1 | ENG-060 | SPEC-05 | Backlog |
| ENG-072 | E2E flujo 2 (Playwright): el alumno completa una actividad | P0 | ENG-064, ENG-067 | SPEC-05 | Backlog |
| ENG-073 | Perfil del alumno y `age_segment` (decisión 34 §15): ruta `(student)/perfil/` accesible desde el avatar con cambio de correo (OTP, API de ENG-028) y, si `can_switch_interface`, selector Kids/Teens sobre `PATCH /me/interface` (rechaza con `INTERFACE_SWITCH_NOT_ALLOWED` si no está habilitado; reemite el access token con el nuevo `age_segment`); **job mensual** (día 1) que recalcula la edad desde `birth_date` y activa `can_switch_interface` a quien cumplió 11 años sin cambiar `age_segment`; tests con reloj simulado (alumno de 9 años no ve la opción; de 11+ alterna sin relogin) | P0 | ENG-060, ENG-028 | SPEC-05 | Backlog |
| SPEC-06 | Redactar y aprobar SPEC-06 Microjuegos | P1 | SPEC-00 | — | Backlog |
| SPEC-07 | Redactar y aprobar SPEC-07 Calificación, feedback, nuevo intento y retención de audios. Incluye como RF: el reloj es el del servidor (`reviewed_at` / `graded_at` en NestJS); el correo de notificación de calificación no contiene la nota ni el feedback, solo el aviso y el enlace a la app; descarga de audio; reproducción del `converted_key` con fallback al raw | P0 | SPEC-00 | — | Backlog |

### Etapa 6 — Microjuegos

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-080 | Emparejar (dnd-kit) | P1 | SPEC-06, ENG-063 | SPEC-06 | Backlog |
| ENG-081 | Ordenar palabras | P1 | SPEC-06, ENG-063 | SPEC-06 | Backlog |
| ENG-082 | Arrastrar y soltar | P1 | SPEC-06, ENG-063 | SPEC-06 | Backlog |
| ENG-083 | Memoria de tarjetas | P1 | SPEC-06, ENG-063 | SPEC-06 | Backlog |
| ENG-084 | Elección múltiple con temporizador | P1 | SPEC-06, ENG-063 | SPEC-06 | Backlog |
| ENG-085 | Scorers de servidor por mecánica con salida en 0,0–5,0; validación de duraciones plausibles con `flags` | P0 | ENG-080 a ENG-084 | SPEC-06 | Backlog |
| ENG-086 | Sonido (Howler) y confeti por tema; carga diferida de bundles de animación Kids y Teens; verificación con analizador de bundle | P1 | ENG-060 | SPEC-06 | Backlog |
| ENG-087 | Zona "Juegos" en el portal del alumno bajo el flag `games` (3 clics); prueba táctil en tablet Android real | P1 | ENG-080 a ENG-084, ENG-018 | SPEC-06 | Backlog |
| SPEC-08 | Redactar y aprobar SPEC-08 Estadísticas de rendimiento y constancia | P0 | SPEC-00 | — | Backlog |

### Etapa 7 — Calificación, feedback y nuevo intento (Hito H3)

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-090 | Endpoints `GET /reviews/queue` (`pending_review`) y `GET /reviews/graded` (calificados, incluidos autocalificados) con filtros por grupo, tipo y fecha; el `PendingSummaryService` de ENG-045 pasa a contar los `pending_review` con más de `ungraded_reminder_days` desde el cierre de su asignación | P0 | SPEC-07, ENG-062, ENG-045 | SPEC-07 | Backlog |
| ENG-091 | Interfaz de calificación y feedback con polling de 30 s y dos pestañas: reproducir audio (URL firmada de 5 min que apunta a `converted_key` cuando existe; si es `null`, al raw con aviso visual de compatibilidad), **botón "Descargar audio"** (`GET /media/:id/download-url`) para conservarlo antes de que venza la retención (decisión 34 §6), leer respuesta, calificar 0,0–5,0, comentario obligatorio, stickers, interruptor "Habilitar nuevo intento" | P0 | ENG-090, ENG-066 | SPEC-07 | Backlog |
| ENG-092 | `Review` con `score` 0,0–5,0 y `graded_at` del servidor: actualiza intento, emite `ProgressEvent(review_received)`, fija `retention_until = graded_at + retention_days`; **al calificar envía al alumno el correo `grading-notification` sin incluir nota ni feedback, solo el aviso y el enlace a `/feedback`** (asíncrono, un reintento; decisión 34 §5); tests de rango, caducidad de URL, acceso cruzado entre alumnos (ningún alumno obtiene URL de audio) y contenido del correo | P0 | ENG-091, ENG-068, ENG-019 | SPEC-07 | Backlog |
| ENG-093 | Vista de feedback recibido en el portal del alumno, por actividad y agregada (3–4 clics); historial de intentos anteriores visible; destino del enlace del correo de calificación | P0 | ENG-092 | SPEC-07 | Backlog |
| ENG-094 | E2E flujo 3 (Playwright): la profesora califica y el alumno ve el feedback (y el correo llega al log en modo local) | P0 | ENG-093 | SPEC-07 | Backlog |
| ENG-095 | Job nocturno de retención de audios en R2: borrado del raw y del `_converted.mp4` de los `ready` con `retention_until` vencido (30 días tras la calificación, decisión 34 §6) y de los `pending_upload` con más de `pending_upload_ttl_days` (7); registro queda `deleted`; `Review` y `score` intactos; test con reloj simulado. (Antes ENG-133) | P0 | ENG-092 | SPEC-07 | Backlog |
| ENG-096 | Habilitar nuevo intento: `allowRetry` en `review`, `POST /attempts/:id/grant-retry` con `extendUntil` opcional, `RETRY_ALREADY_GRANTED`, `ProgressEvent(retry_granted)`; el nuevo intento pasa por el ciclo completo; estadísticas y progreso usan el último intento calificado (tests). (Antes ENG-134) | P0 | ENG-092, ENG-062 | SPEC-07 | Backlog |

### Etapa 8 — Estadísticas de rendimiento y constancia

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-100 | Consultas agregadas: serie de calificaciones por alumno, promedios por tipo, nivel y grupo, semanas activas y rachas, finalización de lo asignado, tiempo por actividad (`finished_at - started_at` del servidor) con recorte de valores implausibles; agregados diario, semanal, mensual; regla del último intento calificado; **denominador congelado (decisión 34 §14):** para asignaciones cerradas usar `Assignment.historical_student_count` cuando no es `null`, para abiertas el conteo de alumnos activos del grupo (test: borrar un alumno no altera promedios pasados); índices; objetivo de menos de 500 ms con `seed-volume.ts` de ENG-013 | P0 | SPEC-08, ENG-062, ENG-096 | SPEC-08 | Backlog |
| ENG-101 | Panel estadístico con polling de 30 s: vista general y vista por grupo (tabla de rendimiento y constancia por alumno). Acceso únicamente por `RolesGuard('teacher')`, sin feature flags (decisión 34 §7). Los recordatorios del dashboard son de ENG-045, no de esta tarea | P0 | ENG-100 | SPEC-08 | Backlog |
| ENG-102 | Leaderboard privado solo para `teacher` (promedio del periodo y actividades completadas). Test de 403 para `student`: la restricción proviene del `RolesGuard` con `@Roles('teacher')`, no de un feature flag (decisión 34 §7) | P0 | ENG-068 | SPEC-08 | Backlog |
| ENG-103 | Vista por estudiante: línea de tiempo de rendimiento con promedio del grupo, calendario de constancia, filtros por fechas, tipo y nivel; sesión de validación con la profesora en staging. (Desbloqueada el 2026-09-21: sustituye a las "gráficas alineadas a la métrica") | P0 | ENG-101 | SPEC-08 | Backlog |
| ENG-104 | Correo de pendientes a la profesora cada 3 días (decisión 34 §18): job (`@nestjs/schedule`, 08:00 America/Bogota) que usa el `PendingSummaryService` de ENG-045 para contar solicitudes sin aprobar y actividades sin calificar con más de `ungraded_reminder_days` desde su cierre; si hay al menos un pendiente envía `teacher-pending-summary` con el detalle y un enlace directo a cada sección; si no hay ninguno, no envía nada. Tests con reloj simulado y `MailService` en modo log | P1 | ENG-090, ENG-045, ENG-019 | SPEC-08 | Backlog |
| SPEC-09 | Redactar y aprobar SPEC-09 PWA, offline y accesibilidad, incluida la notificación in-app de actualizaciones | P0 | SPEC-00 | — | Backlog |

### Etapa 9 — PWA, offline y accesibilidad

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-110 | Manifest, iconos, service worker (Serwist) con `NetworkFirst` para la API y limpieza en logout; instalación. **Gestión de actualizaciones (decisión 34 §4):** detección de SW en `waiting` y del header `X-App-Min-Version` de la API; notificación in-app no bloqueante ("Hay una actualización disponible. La aplicación necesita reiniciarse para aplicar los cambios.") con botón que hace `SKIP_WAITING` y recarga; texto adaptado a Kids, Teens y panel; nunca a mitad de un intento en curso; `NEXT_PUBLIC_APP_VERSION` inyectada en build | P0 | SPEC-09, ENG-060 | SPEC-09 | Backlog |
| ENG-111 | Cola offline en IndexedDB para eventos y audios; reintento automático al reconectar y al abrir la app; test de no duplicación por `clientEventId` | P0 | ENG-063, ENG-067 | SPEC-09 | Backlog |
| ENG-112 | Pase de accesibilidad: contraste AA en ambos temas con axe en CI, foco visible, tamaños táctiles, texto a voz | P1 | ENG-060 | SPEC-09 | Backlog |
| ENG-113 | Prueba de rendimiento en tablet Android real de gama media o baja; informe | P1 | ENG-087 | SPEC-09 | Backlog |
| SPEC-10 | Redactar y aprobar SPEC-10 Contenido extra | P1 | SPEC-00 | — | Backlog |

### Etapa 10 — Contenido extra

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-120 | `ExternalResource`: CRUD en API y panel | P1 | SPEC-10, ENG-033 | SPEC-10 | Backlog |
| ENG-121 | Sección "Contenido extra" en el portal del alumno (`extra/`, 3 clics): enlaces externos en pestaña nueva, sin iframe, bajo el flag `extra_content` | P1 | ENG-120, ENG-060 | SPEC-10 | Backlog |

### Etapa 11 — Lanzamiento (Hito H4)

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-130 | Suite E2E completa (tres flujos) en CI contra staging, como puerta de promoción a producción | P0 | ENG-053, ENG-072, ENG-094 | — | Backlog |
| ENG-131 | Captura de errores de frontend con rol y versión, sin datos personales; alertas al equipo | P0 | ENG-011 | — | Backlog |
| ENG-132 | Verificar el plan de backups de Supabase y ensayar una restauración en staging | P0 | ENG-004 | — | Backlog |
| ENG-135 | Carga de contenido inicial por la profesora según checklist por nivel A1–B2 (empieza en H1) | P0 | ENG-043 | — | Backlog |
| ENG-137 | Checklist de lanzamiento y decisión go/no-go según las condiciones de CONTEXT §12.11 (contenido, estadísticas, manual de uso); verificar que SPEC-01 a SPEC-10 están Verificadas | P0 | Todas las anteriores | — | Backlog |
| ENG-138 | Producción: dominio propio en Vercel y Render, instancia de Render siempre activa, bucket R2 de producción con credenciales propias, Resend con dominio real, variables de entorno de producción (incluidas `R2_*`), monitor externo de `/health` | P0 | ENG-003, ENG-004, ENG-019, ENG-015 | — | Backlog |
| ENG-139 | Alumnos activos auto-registrados en `/registro` y aprobados desde la bandeja antes del primer día (la profesora acompaña el registro a quien lo necesite; no hay alta directa ni contraseñas temporales, decisión 34 §1); prueba de login de una muestra en producción | P0 | ENG-044, ENG-138 | — | Backlog |
| DOC-06 | Manual de uso de la profesora (decisión 34 §19): documento en español, tono casual y conversacional, no técnico, que cubre alumnos (solicitudes, edición, bloqueados, recuperación de contraseña), grupos, actividades (incluidos pesos de examen y duración de speaking), asignaciones, calificación y feedback (con descarga de audio y nuevo intento), estadísticas, recordatorios y configuración; capturas o descripciones de cada flujo; entregado como `.md` en el repositorio o como sección de ayuda del panel; revisado por la profesora | P0 | ENG-103, ENG-094 | — | Backlog |

---

## Decisiones que desbloquean tareas

| Pendiente de CONTEXT §15 | Tareas afectadas | Qué se hace mientras no se decide | Fecha límite recomendada |
|---|---|---|---|
| Nombre definitivo del producto | ENG-003, ENG-110, ENG-138 | Se usa "Englove" como provisional en dominio, manifest e iconos | Antes de la Etapa 9 |

Cerrados el 2026-09-21 y ya reflejados en las tareas: hosting (Vercel + Render), acceso del alumno (correo + contraseña), métrica del piloto (retirada), retención de audios y plazos 30 / 7 días, política de reintentos, umbral 3,0 y tramos de estrellas, bloqueo 10 / 10 min también para la profesora, Resend para registro y recuperación, intercambio de etapas 6 y 7 (rechazado).

Cerrados el 2026-09-22 (decisión 34) y ya reflejados en las tareas: eliminación de `Guardian` y del consentimiento legal, auto-registro como única vía de alta, contraseña 8–16 sin espacios y cambio de correo con OTP, timestamps en servidor, notificación de actualizaciones PWA, correo de calificación sin nota, tipos del piloto y descarga de audios, RBAC sin flags `stats` / `leaderboard`, bloqueados y recordatorios, algoritmo de rachas, `due_at`, ítems no respondidos y mínimo de ítems, normalización de pesos, duración de audios, denominador congelado, `age_segment`, seeds, estados de error, correo de pendientes, manual de la profesora, rate limiting, Cloudflare R2, transcodificación de audios.

---

## Hitos

| Hito | Se alcanza al cerrar | Tarea que lo cierra | Estado |
|---|---|---|---|
| H1 — La profesora puede crear contenido | Etapa 3 | ENG-043 | Pendiente |
| H2 — Un alumno completa una actividad | Etapa 5 | ENG-072 | Pendiente |
| H3 — Ciclo pedagógico completo | Etapa 7 | ENG-094 | Pendiente |
| H4 — Listo para el piloto | Etapa 11 | ENG-137 | Pendiente |
