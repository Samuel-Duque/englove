# Englove — Taskboard

> **Propósito.** Estado operativo del trabajo: qué está hecho, qué sigue, qué está bloqueado y por qué. Las tareas se agrupan por las etapas de [`pbp-development.md`](./pbp-development.md), siguen la arquitectura de [`architecture-overview.md`](./architecture-overview.md) y el proceso SDD de [`sdd-process.md`](./sdd-process.md). Las decisiones de producto viven en `.agents/CONTEXT.md`; este tablero no las redefine.
>
> Última actualización: 2026-09-21. Etapa activa: **0 — Arranque**, en paralelo con **1 — Scaffold**. Ninguna spec redactada todavía; la primera tarea de spec es SPEC-00.

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
| Por hacer | 19 |
| Bloqueado | 0 |
| Backlog | 83 |
| **Total** | **110** |

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
| ENG-004 | Crear proyectos Supabase staging y producción; buckets privados `audio`; credenciales fuera del repositorio | P0 | — | — | Por hacer |
| ENG-006 | Documentos legales: autorización parental en papel (Ley 1581 de 2012), T&C del acudiente, política de privacidad para padres. Revisión legal | P0 | — | — | Por hacer |
| ENG-007 | Especificación de tokens de diseño con dos conjuntos (Kids, Teens) y lista de componentes base | P1 | — | — | Por hacer |
| ENG-008 | Prototipo navegable del portal del alumno con la navegación de 2–4 clics por zona (architecture §3.1) y sesiones de observación con 3 niños por segmento | P1 | ENG-007 | — | Por hacer |

### Etapa 1 — Scaffold

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-010 | Monorepo pnpm + Turborepo: `apps/web`, `apps/api`, `packages/shared`, `tooling` con tsconfig, eslint y prettier compartidos | P0 | SPEC-01, ENG-001 | SPEC-01 | Por hacer |
| ENG-011 | `apps/web`: Next.js 14+ App Router, TypeScript estricto, Tailwind, shadcn/ui, grupos de rutas `(public)`, `(teacher)`, `(student)` | P0 | ENG-010 | SPEC-01 | Por hacer |
| ENG-012 | `apps/api`: NestJS, configuración validada al arrancar, `health`, Swagger automático, logging pino | P0 | ENG-010 | SPEC-01 | Por hacer |
| ENG-013 | `schema.prisma` núcleo con todas las entidades de CONTEXT §7.2 (incluye `PasswordResetToken`, bloqueo en `User`, `retry_*` y `previous_attempt_id` en `Attempt`, `score numeric(2,1)`, `approval_status` y `registration_source` en `Student`, `Guardian.user_id` nullable), enums (incluye `ApprovalStatus`, `RegistrationSource`), `organization_id`, índices; migración inicial; seed de organización piloto y usuaria profesora | P0 | ENG-012 | SPEC-01 | Por hacer |
| ENG-014 | `packages/shared`: enums, tipos del contrato de actividad, registro de esquemas Zod (esqueleto) | P0 | ENG-010 | SPEC-01 | Por hacer |
| ENG-015 | CI: lint, typecheck, tests, `prisma migrate deploy` en staging; check que prohíbe `db push`; despliegue automático de staging en Vercel y Render desde `main` | P0 | ENG-013, ENG-004, ENG-003 | SPEC-01 | Por hacer |
| ENG-016 | Entorno local: docker compose con Postgres 16, `.env.example`, README de arranque en menos de 30 minutos | P1 | ENG-012 | SPEC-01 | Por hacer |
| ENG-017 | Test de esquema: toda tabla de tenant tiene `organization_id` | P1 | ENG-013 | SPEC-01 | Por hacer |
| ENG-018 | Tabla `FeatureFlag` + servicio en la API + carga en el frontend al iniciar sesión. Claves iniciales: `games`, `extra_content`, `stats`, `leaderboard`; configuración `passing_score = 3.0`, `retention_days = 30`, `pending_upload_ttl_days = 7` | P1 | ENG-013 | SPEC-01 | Por hacer |
| ENG-019 | Cuenta de correo transaccional Resend con dominio de envío verificado (SPF, DKIM); `MailService` con un solo remitente y plantillas `signup-received`, `approved`, `welcome` y `password-reset`; salida al log en `local` | P0 | ENG-003 | SPEC-01 | Por hacer |
| SPEC-02 | Redactar y aprobar SPEC-02 Identidad y sesión: login por correo, bloqueo 10/10, recuperación, guards, tenant, `Guardian` y `Student` | P0 | SPEC-00 | — | Por hacer |

---

## Backlog

### Etapa 2 — Identidad y roles

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-020 | Login único con correo y contraseña para todos los roles: argon2id, access y refresh en cookies `httpOnly` (30 días profesora / 90 días alumno), rotación con detección de reutilización, logout, redirección por rol; rechaza `pending_approval` (`ACCOUNT_PENDING_APPROVAL`) y `rejected` (`AUTH_INVALID_CREDENTIALS`) | P0 | SPEC-02, ENG-013 | SPEC-02 | Backlog |
| ENG-021 | Guards `JwtAuthGuard`, `RolesGuard`, `TenantContext`; extensión de Prisma con filtro `organization_id` | P0 | ENG-020 | SPEC-02 | Backlog |
| ENG-022 | CRUD `Guardian` con aceptación de T&C (versión y fecha); soporta `Guardian` sin `user_id` creado desde el auto-registro | P0 | ENG-021 | SPEC-02 | Backlog |
| ENG-023 | CRUD `Student` (acudiente, nivel, segmento, `consent_status`, `approval_status`, `registration_source`) con `User` asociado con correo obligatorio y único por organización | P0 | ENG-022 | SPEC-02 | Backlog |
| ENG-024 | Bloqueo por intentos fallidos para todos los roles: `failed_login_count`, `locked_until`, 10 intentos → 10 minutos, `AUTH_ACCOUNT_LOCKED`; listado de bloqueados y desbloqueo anticipado de alumnos para la profesora | P0 | ENG-020 | SPEC-02 | Backlog |
| ENG-025 | Pantallas de login, recuperación y restablecimiento de contraseña (`(public)`), con sugerencia de frase memorable para Kids | P0 | ENG-020, ENG-028 | SPEC-02 | Backlog |
| ENG-026 | Pruebas de integración: auth, auto-registro (`pending_approval` no inicia sesión), rotación de refresh, bloqueo y desbloqueo, recuperación (token usado / caducado, revocación de sesiones), 403 por rol, aislamiento de tenant en dos modelos | P0 | ENG-021, ENG-024, ENG-028, ENG-029 | SPEC-02 | Backlog |
| ENG-027 | Endurecimiento HTTP: helmet, CORS con allowlist, throttler global y estricto en login, signup y forgot-password, comprobación de `Origin` en peticiones mutantes | P1 | ENG-012 | SPEC-02 | Backlog |
| ENG-028 | Correos de cuenta de la recuperación y del alta directa: `forgot-password` (respuesta uniforme, límite por correo), `PasswordResetToken` con hash y 30 min, `reset-password` con revocación de sesiones; correo `welcome` (token 72 h) para el alta directa; `POST /students/:id/reset-password` con contraseña temporal y `must_change_password` | P0 | ENG-020, ENG-019 | SPEC-02 | Backlog |
| ENG-029 | Auto-registro del estudiante (Decidido, CONTEXT §4.1): pantalla `/registro`, `POST /auth/signup` sin autenticación previa, crea `User` + `Guardian` (sin cuenta) + `Student` en `pending_approval` con `registration_source = self_registered`; correo `signup-received`; validación de correo único y de requisitos de contraseña | P0 | ENG-020, ENG-022, ENG-023, ENG-019 | SPEC-02 | Backlog |
| SPEC-03 | Redactar y aprobar SPEC-03 Gestor de contenidos, incluida la bandeja de solicitudes de registro | P0 | SPEC-00 | — | Backlog |

### Etapa 3 — Gestor de contenidos (Hito H1)

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-030 | Esquemas Zod completos por tipo (`fill_blank`, `open_question`, `speaking`, `game` × 5 mecánicas, `exam`) con separación `config` / `answerKey`, `toPublicConfig()` y fórmula de fracción de acierto por mecánica | P0 | SPEC-03, ENG-014 | SPEC-03 | Backlog |
| ENG-031 | Tablas de detalle 1:1 en Prisma y migración | P0 | ENG-013, ENG-030 | SPEC-03 | Backlog |
| ENG-032 | Endpoints `activities`: CRUD, estados `draft` / `published` / `archived`, duplicar, versionado por duplicación cuando hay intentos | P0 | ENG-021, ENG-031 | SPEC-03 | Backlog |
| ENG-033 | Panel: layout de la profesora, navegación, lista de actividades con filtros por nivel y tipo | P0 | ENG-025 | SPEC-03 | Backlog |
| ENG-034 | Formulario fill in the blanks: editor de oraciones con huecos y opciones | P0 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-035 | Formulario pregunta abierta | P0 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-036 | Formulario speaking: consigna, duración máxima, ejemplo opcional | P0 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-037 | Formularios de microjuego, uno por mecánica, derivados de los esquemas Zod, con plantillas de ejemplo | P1 | ENG-032, ENG-033 | SPEC-03 | Backlog |
| ENG-038 | Formulario examen: composición de ítems con pesos | P1 | ENG-034 | SPEC-03 | Backlog |
| ENG-039 | Vista previa de actividad en el panel reutilizando el renderizador del alumno (se entrega en la Etapa 5) | P1 | ENG-063 | SPEC-05 | Backlog |
| ENG-040 | CRUD `Group` y membresías (API y panel) | P0 | ENG-023, ENG-033 | SPEC-03 | Backlog |
| ENG-041 | Gestión de alumnos y acudientes en el panel (alta directa como flujo alterno): alta con correo de acceso (envía correo `welcome` o, si se marca, entrega contraseña temporal), edición, nivel, segmento, restablecer contraseña, ver y levantar bloqueos | P0 | ENG-023, ENG-028, ENG-033 | SPEC-03 | Backlog |
| ENG-042 | `ConsentRecord` en papel: registro manual y estado `pending` / `signed_paper` visible en la lista de alumnos, independiente de la aprobación de la cuenta | P0 | ENG-041 | SPEC-03 | Backlog |
| ENG-043 | Sesión cronometrada de onboarding: la profesora crea su primera actividad en menos de 10 minutos; iterar formularios si no se cumple | P0 | ENG-034, ENG-035, ENG-036 | SPEC-03 | Backlog |
| ENG-044 | Bandeja de solicitudes de registro (Decidido, CONTEXT §4.1): pestaña "Solicitudes" en `alumnos/` sobre `GET /students/requests`; aprobar (`POST /students/:id/approve` con nivel, segmento y grupo, correo `approved`) o rechazar (`POST /students/:id/reject`, borrado en cascada sin `Attempt` ni `MediaAsset`) | P0 | ENG-029, ENG-040, ENG-041 | SPEC-03 | Backlog |
| SPEC-04 | Redactar y aprobar SPEC-04 Asignación | P0 | SPEC-00 | — | Backlog |
| SPEC-05 | Redactar y aprobar SPEC-05 Portal e intentos: navegación por zona, ciclo de intento, scoring 0,0–5,0, speaking, progreso, cascada | P0 | SPEC-00 | — | Backlog |

### Etapa 4 — Asignación

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-050 | Modelo y endpoints `assignments`: actividad, grupos, `opens_at`, `due_at`; validaciones (solo `published`, fechas coherentes, sin duplicados activos). Sin `max_attempts`: un intento por asignación (decisión 25) | P0 | SPEC-04, ENG-032, ENG-040 | SPEC-04 | Backlog |
| ENG-051 | Interfaz de asignación a uno o varios grupos con fechas en America/Bogota | P0 | ENG-050 | SPEC-04 | Backlog |
| ENG-052 | Vista de asignaciones por grupo | P1 | ENG-051 | SPEC-04 | Backlog |
| ENG-053 | E2E flujo 1 (Playwright): la profesora crea y asigna una actividad | P0 | ENG-051 | SPEC-04 | Backlog |

### Etapa 5 — Portal del estudiante (Hito H2)

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-060 | Layout del alumno con tokens por `age_segment` (`data-theme`), barra de navegación de hasta cinco zonas, techos de clics por zona según architecture §3.1 | P0 | SPEC-05, ENG-007, ENG-025 | SPEC-05 | Backlog |
| ENG-061 | Home del alumno: asignaciones abiertas ordenadas por `due_at`; tarjeta con aviso de nuevo intento habilitado | P0 | ENG-050, ENG-060 | SPEC-05 | Backlog |
| ENG-062 | Ciclo de intento en la API: start con `attemptToken` y regla de un intento por asignación (`ATTEMPT_ALREADY_EXISTS`, consumo de habilitación, `previous_attempt_id`), eventos por lotes idempotentes (`clientEventId`), complete; estados y `flags` | P0 | ENG-050 | SPEC-05 | Backlog |
| ENG-063 | Runtime del contrato en el cliente: `ActivityRenderer` y `useAttempt` | P0 | ENG-062 | SPEC-05 | Backlog |
| ENG-064 | `ScoringService` con conversión de fracción a 0,0–5,0 (`round(fraction × 5, 1)`), `passing_score`, `SCORE_OUT_OF_RANGE`; fill in the blanks: renderizador, scorer con pruebas unitarias, corrección por ítem en `complete` | P0 | ENG-063 | SPEC-05 | Backlog |
| ENG-065 | Pregunta abierta: renderizador → `pending_review` | P0 | ENG-063 | SPEC-05 | Backlog |
| ENG-066 | Módulo `media`: URLs firmadas de subida y descarga, `MediaAsset`, verificación de derechos, límite de 10 MB | P0 | ENG-062 | SPEC-05 | Backlog |
| ENG-067 | Speaking: `MediaRecorder`, blob en IndexedDB, subida firmada, confirmación en `complete`; prueba en iOS real | P0 | ENG-066 | SPEC-05 | Backlog |
| ENG-068 | `ProgressEvent` (valores en 0,0–5,0) + motor de insignias con `BadgeRule` + rachas semanales perdonables; seed de reglas iniciales (primera tarea, primer audio, 4/8/12 semanas, 5 años) | P0 | ENG-062 | SPEC-05 | Backlog |
| ENG-069 | Vista de progreso personal del alumno: estrellas derivadas de la calificación, insignias, rachas (3 clics) | P0 | ENG-068 | SPEC-05 | Backlog |
| ENG-070 | Borrado en cascada de alumno con test de integración escrito antes: intentos, eventos, insignias, consentimientos, membresías, tokens de recuperación, audios en bucket | P0 | ENG-066 | SPEC-05 | Backlog |
| ENG-071 | Texto a voz en consignas Kids (Web Speech API); objetivos táctiles de al menos 48 px | P1 | ENG-060 | SPEC-05 | Backlog |
| ENG-072 | E2E flujo 2 (Playwright): el alumno completa una actividad | P0 | ENG-064, ENG-067 | SPEC-05 | Backlog |
| SPEC-06 | Redactar y aprobar SPEC-06 Microjuegos | P1 | SPEC-00 | — | Backlog |
| SPEC-07 | Redactar y aprobar SPEC-07 Calificación, feedback, nuevo intento y retención de audios | P0 | SPEC-00 | — | Backlog |

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
| ENG-090 | Endpoints `GET /reviews/queue` (`pending_review`) y `GET /reviews/graded` (calificados, incluidos autocalificados) con filtros por grupo, tipo y fecha | P0 | SPEC-07, ENG-062 | SPEC-07 | Backlog |
| ENG-091 | Interfaz de calificación y feedback con polling de 30 s y dos pestañas: reproducir audio (URL firmada de 5 min), leer respuesta, calificar 0,0–5,0, comentario obligatorio, stickers, interruptor "Habilitar nuevo intento" | P0 | ENG-090, ENG-066 | SPEC-07 | Backlog |
| ENG-092 | `Review` con `score` 0,0–5,0: actualiza intento, emite `ProgressEvent(review_received)`, fija `retention_until = graded_at + retention_days`; tests de rango, caducidad de URL y acceso cruzado entre alumnos | P0 | ENG-091, ENG-068 | SPEC-07 | Backlog |
| ENG-093 | Vista de feedback recibido en el portal del alumno, por actividad y agregada (3–4 clics); historial de intentos anteriores visible | P0 | ENG-092 | SPEC-07 | Backlog |
| ENG-094 | E2E flujo 3 (Playwright): la profesora califica y el alumno ve el feedback | P0 | ENG-093 | SPEC-07 | Backlog |
| ENG-095 | Job nocturno de retención de audios: borrado de `ready` con `retention_until` vencido y de `pending_upload` con más de `pending_upload_ttl_days`; registro queda `deleted`; `Review` y `score` intactos; test con reloj simulado. (Antes ENG-133) | P0 | ENG-092 | SPEC-07 | Backlog |
| ENG-096 | Habilitar nuevo intento: `allowRetry` en `review`, `POST /attempts/:id/grant-retry` con `extendUntil` opcional, `RETRY_ALREADY_GRANTED`, `ProgressEvent(retry_granted)`; el nuevo intento pasa por el ciclo completo; estadísticas y progreso usan el último intento calificado (tests). (Antes ENG-134) | P0 | ENG-092, ENG-062 | SPEC-07 | Backlog |

### Etapa 8 — Estadísticas de rendimiento y constancia

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-100 | Consultas agregadas: serie de calificaciones por alumno, promedios por tipo, nivel y grupo, semanas activas y rachas, finalización de lo asignado, tiempo por actividad con recorte de valores implausibles; agregados diario, semanal, mensual; regla del último intento calificado; índices; seed de volumen (100 alumnos, 3 meses) con objetivo de menos de 500 ms | P0 | SPEC-08, ENG-062, ENG-096 | SPEC-08 | Backlog |
| ENG-101 | Panel estadístico con polling de 30 s: vista general y vista por grupo (tabla de rendimiento y constancia por alumno) | P0 | ENG-100 | SPEC-08 | Backlog |
| ENG-102 | Leaderboard privado solo para `teacher` (promedio del periodo y actividades completadas), con test de 403 para `student` | P0 | ENG-068 | SPEC-08 | Backlog |
| ENG-103 | Vista por estudiante: línea de tiempo de rendimiento con promedio del grupo, calendario de constancia, filtros por fechas, tipo y nivel; sesión de validación con la profesora en staging. (Desbloqueada el 2026-09-21: sustituye a las "gráficas alineadas a la métrica") | P0 | ENG-101 | SPEC-08 | Backlog |
| SPEC-09 | Redactar y aprobar SPEC-09 PWA, offline y accesibilidad | P0 | SPEC-00 | — | Backlog |

### Etapa 9 — PWA, offline y accesibilidad

| ID | Tarea | Prioridad | Depende de | Spec | Estado |
|---|---|---|---|---|---|
| ENG-110 | Manifest, iconos, service worker (Serwist) con `NetworkFirst` para la API y limpieza en logout; instalación | P0 | SPEC-09, ENG-060 | SPEC-09 | Backlog |
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
| ENG-136 | Consentimientos en papel recogidos y registrados para el 100 % de los alumnos activos | P0 | ENG-006, ENG-042 | — | Backlog |
| ENG-137 | Checklist de lanzamiento y decisión go/no-go según las condiciones de CONTEXT §12.11; verificar que SPEC-01 a SPEC-10 están Verificadas | P0 | Todas las anteriores | — | Backlog |
| ENG-138 | Producción: dominio propio en Vercel y Render, instancia de Render siempre activa, Resend con dominio real, variables de entorno de producción, monitor externo de `/health` | P0 | ENG-003, ENG-019, ENG-015 | — | Backlog |
| ENG-139 | Alta de las cuentas de alumnos activos con correo de acceso y contraseña temporal entregada en persona; prueba de login de una muestra en producción | P0 | ENG-041, ENG-138 | — | Backlog |

---

## Decisiones que desbloquean tareas

| Pendiente de CONTEXT §15 | Tareas afectadas | Qué se hace mientras no se decide | Fecha límite recomendada |
|---|---|---|---|
| Nombre definitivo del producto | ENG-003, ENG-110, ENG-138 | Se usa "Englove" como provisional en dominio, manifest e iconos | Antes de la Etapa 9 |

Cerrados el 2026-09-21 y ya reflejados en las tareas: hosting (Vercel + Render), acceso del alumno (correo + contraseña), métrica del piloto (retirada), retención de audios y plazos 30 / 7 días, política de reintentos, umbral 3,0 y tramos de estrellas, bloqueo 10 / 10 min también para la profesora, Resend para registro y recuperación, intercambio de etapas 6 y 7 (rechazado).

---

## Hitos

| Hito | Se alcanza al cerrar | Tarea que lo cierra | Estado |
|---|---|---|---|
| H1 — La profesora puede crear contenido | Etapa 3 | ENG-043 | Pendiente |
| H2 — Un alumno completa una actividad | Etapa 5 | ENG-072 | Pendiente |
| H3 — Ciclo pedagógico completo | Etapa 7 | ENG-094 | Pendiente |
| H4 — Listo para el piloto | Etapa 11 | ENG-137 | Pendiente |
