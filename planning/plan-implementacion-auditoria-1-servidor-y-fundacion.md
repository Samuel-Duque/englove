# Plan de Implementación 1 de 2 — Servidor, Datos, Seguridad, Infraestructura y Gobernanza SDD

- **Fuente única:** [`planning/auditoria-post-spec-11.md`](auditoria-post-spec-11.md) (commit auditado `develop` @ `b4d04d3`; decisiones `QA-01` a `QA-08` cerradas el 2026-11-09). Este plan no usa ningún otro documento como fuente de hallazgos.
- **Complemento:** [`plan-implementacion-auditoria-2-cliente-y-cierre.md`](plan-implementacion-auditoria-2-cliente-y-cierre.md). Entre ambos planes se cubre el 100 % de la auditoría (42 hallazgos: 10 `P0`, 15 `P1`, 11 `P2`, 6 `P3`; `QA-01`..`QA-08`; §2, §3, §4, §6, §7 y §8).
- **Criterio de división:** por **capa y tipo de tarea**. Este plan agrupa gobernanza SDD (decisiones y specs), pipeline e infraestructura, API NestJS, base de datos, seguridad, multimedia, intentos, evaluación, gamificación, estadísticas, mantenimiento, seeds y las skills propias en lo que toca al servidor. El Plan 2 agrupa todo lo que ocurre en el navegador (apps/web), PWA, accesibilidad, TanStack Query, E2E y el cierre documental.
- **Los hallazgos que cruzan capas se parten en dos mitades.** La mitad servidor va aquí y la mitad cliente va en el Plan 2. Los contratos entre ambas mitades están en §3.
- **Modo:** este documento es un plan. No implementa nada. La ejecución se rige por `AGENTS.md`, `planning/sdd-process.md` y las skills `englove-spec`, `englove-guardrails`, `tdd`, `security-review`, `nestjs-best-practices`, `prisma-client-api`, `prisma-cli`, `render-deploy`, `render-docker`, `supabase-postgres-best-practices` (solo para SQL/locks en PostgreSQL), `code-review` y `verification-before-completion`.

---

## 1. Alcance del Plan 1

| Bloque | Contenido | Hallazgos que cierra |
| --- | --- | --- |
| Gobernanza SDD | Decisiones en `CONTEXT §14`, SPEC-11, SPEC-01/02/04/05, skill `englove-spec` | `P2-11` (parte), `P3-06` (parte), §3.1, §3.2 (SPEC-01/02/04/05), §3.3 (CONTEXT §4.2/§6/§7/§9, README L77), §6.2, §8.2 pasos 1-2 |
| Pipeline e infraestructura | `turbo.json`, `postinstall`, `render.yaml`, `Dockerfile`, `docker-compose.yml`, CI, `wrangler.jsonc`, `env.validation.ts` | `P1-15`, `P2-07`, `P2-09`, `P2-02` (parte), §7.1.1, §7.2.1, §7.2.2, `QA-08` |
| Identidad, sesión, tenant y logs (Bloque A) | OTP, sesión, `session_hint`, `GET /auth/session`, logout, `typ`, `locked_until`, `TenantPrismaExtension`, `pinoHttp` | `P0-01`, `P0-02` (servidor), `P0-03` (servidor), `P1-01`, `P1-12`, `P2-01`, `P2-02` (servidor), `QA-02`, `QA-08` |
| Intentos, multimedia, evaluación y grupos (Bloque B) | `completeAttempt`, `itemId`, `media/:id/confirm`, `ffmpeg`, `reviews`, `students`, seeds | `P0-09` (servidor), `P1-02`, `P1-03` (servidor), `P1-04`, `P1-06`, `P1-07` (servidor), `P1-09`, `P2-03`, `P2-04`, `P2-06`, `QA-05`, `QA-07` |
| Microjuegos, gamificación y estadísticas (Bloque C) | `ProgressEvent` en juegos, `scoreToGameStars`, mensajes, `groupAverageScore`, leaderboard, `Intl` | `P0-10`, `P1-05` (servidor y shared), `P1-11`, `P2-05`, `QA-06` |
| Robustez y limpieza del servidor | `as Type` en `apps/api` y `packages/shared`, `@Optional()`, códigos HTTP, código muerto del servidor, tests PostgreSQL reales | `P1-14` (parte), `P2-08` (parte API), `P3-01` (parte), `P3-02` |
| Skills (servidor) | `englove-guardrails` (`G-A06`, `G-C10`, `G-B10`) y `englove-spec` | `§6.1` (parte), `§6.2`, `§6.3` |

Fuera de este plan (van en el Plan 2): `apps/web`, Serwist, IndexedDB, TanStack Query, `as Type` en `apps/web`, WCAG 2.2 AA, E2E Playwright, specs SPEC-03/06/07/08/09/10, resto de documentos de `planning/`, `CONTEXT §1/§8/§11.1`, pendientes legales/operativos y la verificación global final.

---

## 2. Orden de ejecución y dependencias

```
F0 Gobernanza SDD ──► F1 Pipeline e infra ──► F2 Bloque A ──► F3 Bloque B ──► F4 Bloque C ──► F5 Robustez ──► F6 Verificación P1
                              │                    │             │              │
                              └────────── entrega contratos al Plan 2 (§3) ──────┘
```

- Ningún código de producción se escribe antes de cerrar F0 (regla SDD de `AGENTS.md`; `sdd-process.md`).
- F1 va antes que el resto, porque sin `db:generate` en el flujo `pnpm typecheck` no se puede verificar nada.
- Cada tarea de código sigue TDD con **regresión real** (PostgreSQL, guards, filtros, interceptores), no con mocks de `$transaction` que no hacen `ROLLBACK`. Esta es la causa raíz sistémica de la auditoría (§1.3).
- El Plan 2 puede empezar F0/F1 en paralelo. Para sus fases funcionales necesita los contratos de §3 ya publicados.

---

## 3. Contratos de integración que este plan entrega al Plan 2

| Contrato | Entregado en | Lo consume el Plan 2 en |
| --- | --- | --- |
| Cookie `${cookiePrefix}session_hint=1` (`httpOnly:false`, `sameSite:'lax'`, `secure: appEnv !== 'local'`, `maxAge` 30 d/90 d), emitida en `login`, `refresh` y `logout` | T2.1 | Login, `trySilentRefresh()` |
| `GET /api/v1/auth/session` (solo lectura, sin rotar `refresh_token`) y cookie `refresh_token` con `path: '/api/v1/auth'` | T2.1, T2.2 | `auth-session.ts`, `navigator.locks`, logout |
| `AllExceptionsFilter` conserva `details` (p. ej. `409 UNCONSUMED_RETRY_WARNING` con `details.affectedActivities`) | T3.9 | `ApiError`, modal `confirmLostRetries` |
| `POST /api/v1/media/:id/confirm` (con `x-attempt-token`) y `upload-url` con `x-attempt-token` | T3.4 | Grabador `speaking` |
| `startGameAttempt` sin `409`, `attemptToken` acotado; `POST /api/v1/activities/:id/attempts` | T4.1 | Botón «Jugar de nuevo» |
| Respuestas de juegos sin `score`/`bestScore` visibles al niño (solo estrellas y mensaje) | T4.3 | `GameRenderer`, `actividad-runner`, `/juegos` |
| `scoreToGameStars` y `getGameMotivationMessage` en `packages/shared` | T4.3 | `GameRenderer`, vista previa docente |
| `itemId` de `open_question` multi-pregunta validado por `items[].id`; formato de `answers` por ítem | T3.5 | Runner `open_question`, `/revision` |
| `correction` presente en reintentos idempotentes de `/complete` | T3.2 | Runner |
| Códigos `403 AUTH_FORBIDDEN`, `422 SCORE_OUT_OF_RANGE` | T5.4 | `auth-errors.ts`, `/revision` |
| `ExamConfig.items` / `ExamConfig` en `packages/shared` sin `as Type` | T5.1 | Editor docente |

---

## 4. Fases y tareas

### F0 — Gobernanza SDD (pasos 1 y 2 de la hoja de ruta §8.2)

Skills: `englove-spec`, `domain-modeling` (las decisiones van en `CONTEXT §14`, no en `docs/adr/`, según `AGENTS.md`).

| ID | Tarea | Detalle tomado de la auditoría | Cierra |
| --- | --- | --- | --- |
| T0.1 | Registrar decisiones nuevas en `.agents/CONTEXT.md §14` | `QA-02` (`session_hint` sin PII + `GET /auth/session` + `navigator.locks` + `refresh_token` con `path: '/api/v1/auth'`), `QA-03` (editor multi-oración/multi-hueco preservando UUIDs), `QA-06` (exclusión total de `implausible_duration` en `games-leaderboard`), `QA-07` (limpieza definitiva de `retry_granted_at` y `retry_extend_until`), `QA-08` (`secure: appEnv !== 'local'`, obligatorio en staging/production). Registrar también `QA-01` (Serwist real), `QA-04` (migración completa a TanStack Query) y `QA-05` (endpoint `media/:id/confirm`) como decisiones ya cerradas | §8.1, §8.2 paso 1 |
| T0.2 | Corregir inconsistencias factuales de `CONTEXT.md` **del lado del servidor** | `§4.2` L128 (Recursos adicionales: `ExternalResource` con nivel MCER y tope de 200, Decisiones 124–126); `§6` L202 y L219 (quitar Howler.js y Framer Motion, Decisión 105: `Web Audio API` + CSS/Tailwind); `§7` L255 (añadir `Attempt.activity_id` y `Attempt.assignment_id` nullable); `§9` L290 (`status = 'submitted'` no existe; el enum real es `pending_review` / `graded`) | §3.3.1 (parte) |
| T0.3 | Actualizar `specs/SPEC-11` | Quitar `(Propuesto)` de `§11.2`; incorporar precisiones `QA-01`..`QA-08` (incluido `§4.3` y `§5.3` con la regla `QA-06`); dejar `§12` fiel al estado real (corrige la afirmación «compuertas superadas»: `typecheck` y `test` fallaban) | §3.1.1, §3.1.3, §8.2 paso 2 |
| T0.4 | Alinear `SPEC-01` | `render.yaml` (`plan: free` en staging, sin `MIGRATION_DATABASE_URL`), `.env.example`, MinIO y Mailpit en `docker-compose.yml` (`§6`, `§8`, `§9`) y fila en `§12` | §3.2 SPEC-01 |
| T0.5 | Alinear `SPEC-02` | Claim `typ: 'access'` (L109), higiene `englove_offline` al login/logout, enlace `/terminos`, `America/Bogota` en el job de edad, `session_hint`, `GET /auth/session`, `path` de refresh, `Secure` según `APP_ENV`; fila en `§12` (último cambio 2026-10-19) | §3.2 SPEC-02 |
| T0.6 | Alinear `SPEC-04` | `RF-2` (L38): sustituir `409 ACTIVITY_NOT_ASSIGNABLE` por `422 GAME_ASSIGNMENT_NOT_ALLOWED`; L124: retirar el filtro por `type = game`; avisos de cambio de grupo; fila en `§12` | §3.2 SPEC-04 |
| T0.7 | Alinear `SPEC-05` | `Attempt` dual (`assignment_id` XOR `activity_id`, `attempts_parent_xor_check`; L150-L157), `ffprobe` real, lote previo a `/complete`, racha de 12 semanas, endpoint `media/:id/confirm`; fila en `§12` | §3.2 SPEC-05 |
| T0.8 | Actualizar la skill `englove-spec` (3 copias `.agents/`, `.claude/`, `.kiro/`) | `check-spec.mjs`: bloquear `(Propuesto)` residual en specs `Aprobada`/`Verificada`; modo `--check-git` que falla si una spec `Verificada` se modificó sin fila nueva en `§12` (Decisión 128); `SKILL.md` y `references/validacion.md` incluyen `SPEC-11`/Etapa 12 y exigen `'wcag22aa'` (Decisión 133). Añadir test automatizado | §6.2 |
| T0.9 | Corregir `README.md` L77 | PostgreSQL local mapea `5433:5432` en `docker-compose.yml` (no `5432`); alinear con T1.4 | §3.3.2 |

Compuerta de salida F0: `node .agents/skills/englove-spec/scripts/check-spec.mjs` sin errores sobre las specs tocadas. Los avisos de longitud `> 20 min` son tarea del Plan 2 (`P3-05`).

---

### F1 — Pipeline, infraestructura y configuración (paso 3 de §8.2 y §7.2)

Skills: `render-deploy`, `render-docker`, `ci-cd-and-automation`, `turborepo`, `prisma-cli`.

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T1.1 | Reparar `typecheck` | Añadir `"postinstall": "pnpm --filter @englove/api db:generate"` en `package.json` y dependencia de `db:generate` en `turbo.json` para `typecheck`/`build`. Debe quedar resuelto el desfase con la migración `20261108000000_autonomous_microgames` (fallos en `students.service.ts#L736`, `seed-dev.ts#L665-666`, `attempts.service.ts#L359-L508`) | `P1-15`.1, §7.1.1 |
| T1.2 | Reparar `test` en Windows | `turbo.json`: `test.dependsOn` pasa a `["build", "^build"]` para evitar `EPERM unlink .../packages/shared/dist/index.d.ts` (`tsup clean: true` contra Vitest) | `P1-15`.2 |
| T1.3 | `render.yaml` | `plan: free` en staging (hoy `starter`, 7 USD/mes contra presupuesto 0 USD); retirar `MIGRATION_DATABASE_URL` del runtime y ejecutar `prisma migrate deploy` solo en build/pre-deploy (`G-A03`); declarar `JWT_SECRET`; `COOKIE_PREFIX` coherente (`englove_stg_` en lugar de `englove_staging_`) | `P1-15`.3, `RF-4`.1, §7.2.1 |
| T1.4 | `docker-compose.yml` | Quitar `mc anonymous set download localminio/englove-dev` (L47) para que fallen las URLs prefirmadas mal firmadas (`G-B10`, Decisión 134); documentar o unificar el puerto `5433`; soporte HTTPS local (`mkcert`/túnel) para `QA-08`. Nota: `navigator.mediaDevices` y el service worker exigen `localhost` o HTTPS en tablets externas | `P2-07`, §7.2.3 (MinIO), `QA-08` |
| T1.5 | `apps/api/Dockerfile` | `USER node`; `.dockerignore`; `pnpm prune --prod`; `NODE_OPTIONS="--max-old-space-size=320"` (contenedor de 512 MB) | `P2-09`, §7.2.1 |
| T1.6 | `.github/workflows/ci.yml` | Apuntar a las ramas reales (`develop`/`master`, no la inexistente `main`); añadir `pnpm build`; control de tamaño del Worker `<= 3 MB` (plan Free) y job de Playwright (el contenido de la suite lo entrega el Plan 2, T8.x) | `P2-09`, §7.2.2 |
| T1.7 | `apps/web/wrangler.jsonc` | Añadir `env.staging` y `env.production` | `P2-09`, §7.2.2 |
| T1.8 | `apps/api/src/config/env.validation.ts` | Validar `COOKIE_DOMAIN`; eliminar el fallback por defecto de `JWT_SECRET` (hoy en 3 archivos: `jwt-auth.guard.ts`, `attempts.service.ts#L113-L116` y `#L1479`, y el tercero detectado en la auditoría), fallando al arranque si falta fuera de `local` | `P2-02` (parte), `RF-2`.4, §7.2.1 |

Cada tarea tiene prueba o verificación: build de Docker con usuario no root, `render.yaml` revisado con `render-deploy`, workflow ejecutado.

---

### F2 — Bloque A: Identidad, sesión, multi-tenant y logs

Skills: `security-review`, `nestjs-best-practices`, `prisma-client-api`, `tdd`. Las pruebas pasan por `OriginGuard → JwtAuthGuard → TenantInterceptor → ValidationPipe → AllExceptionsFilter → pinoHttp` y PostgreSQL real (`P1`-regresión real).

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T2.1 | `confirmEmailChange` sin `ROLLBACK` | En `auth.service.ts#L964-L1063` devolver un resultado discriminado desde `$transaction` (persistiendo `failed_attempts`/`used_at`) y lanzar `UnprocessableEntityException` **fuera** del bloque. Prueba contra PostgreSQL real: el 3.er intento fallido bloquea el OTP (Decisión 69) | `P0-01`, `RF-2`.1 |
| T2.2 | Sesión continua (servidor) | `setSessionCookies` emite `${cookiePrefix}session_hint=1` (`httpOnly:false`, `sameSite:'lax'`, `secure: appEnv !== 'local'`, sin PII, mismo `maxAge` de 30/90 días) sincronizada en `login`, `refresh` y `logout`; `GET /api/v1/auth/session` de solo lectura sobre `access_token`; ampliar el `path` de `${cookiePrefix}refresh_token` de `'/api/v1/auth/refresh'` a `'/api/v1/auth'` | `P0-02` (servidor), `P0-03` (servidor), `QA-02` |
| T2.3 | Logout que revoca tras 15 min | `logout` recibe `refresh_token`, revoca `AuthSession` en BD filtrando por `id`, `user_id` y `organization_id` (hoy `updateMany` en `#L629` omite `user_id`/`organization_id`) | `P1-12`.2, `RF-2`.3 |
| T2.4 | Cookies `Secure` por entorno | `access_token`, `refresh_token` y `session_hint` con `secure: appEnv !== 'local'` (y `|| webBaseUrl.startsWith('https://')` donde aplique), `secure: true` estricto en `staging` y `production`. Pruebas que verifiquen `Secure` según `APP_ENV` | `QA-08`, `P2-02` |
| T2.5 | `typ` estricto y `locked_until` | `JwtAuthGuard` rechaza JWT sin `typ` (hoy opcional) y aplica `typ` también en `attempts.service.ts`; `JwtAuthGuard` y `AuthService.refresh` verifican `user.locked_until > now` y detienen sesiones activas | `P1-12`.3, `P2-02`, `RF-2`.4-5 |
| T2.6 | `TenantPrismaExtension` | En `tenant-prisma.extension.ts#L26-L82` interceptar `create`, `update`, `delete`, `upsert`, `$queryRaw` y `$executeRaw` (69 llamadas directas por `id` en `apps/api/src`); sin `TenantContext` no aceptar `organization_id` *truthy* ni objetos `{ not: ... }`. Auditar `TenantContext.runBypass` (comentario `guardrails-ignore G-A06:` justificado) | `P1-12`.1, `RF-3`.1 |
| T2.7 | Redacción de logs | `pinoHttp` (`app.module.ts#L38-L54`): `redact.paths` incluye `req.headers["x-attempt-token"]`; sanear query strings en `req.url` (p. ej. `?search=` con correos de menores); mismo saneado en `AllExceptionsFilter#L68` | `P1-01`, `RF-15`.2, `G-C10` |
| T2.8 | DoS en Argon2id | `reset-password` (`auth.service.ts#L790`): verificar que el token existe en BD **antes** de calcular Argon2id; `signup` (`#L675-L689`): hash dummy cuando el correo ya existe (anula el oráculo temporal) | `P2-01` |
| T2.9 | Pruebas de regresión | Una prueba con nombre por hallazgo (`P0-01`, `P0-02`/`03` servidor, `P1-01`, `P1-12`, `P2-01`, `QA-08`), ejecutadas por HTTP y contra PostgreSQL | `RF-2`, `RF-3`, §1.3 |

---

### F3 — Bloque B: Intentos, multimedia, evaluación, grupos y seeds

Skills: `security-review`, `nestjs-best-practices`, `prisma-client-api`, `supabase-postgres-best-practices` (`SELECT ... FOR UPDATE`, índices únicos parciales), `tdd`.

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T3.1 | `completeAttempt` transaccional | `attempts.service.ts#L846-L1143`: `$transaction` + `SELECT ... FOR UPDATE` y/o `updateMany({ where: { id, status: 'in_progress' } })`; sin `ProgressEvent` ni insignias duplicadas en entregas paralelas (`SEC-09d`) | `P1-06`, `RF-3`.2 |
| T3.2 | Reintento idempotente con `correction` | `buildExistingCompletionView` (`#L852-L875` y `#L1574-L1605`): `select: { answer_key: true }` para no devolver `correction: null` en intentos ya `graded` | `P2-04`, `RF-8`.1 |
| T3.3 | Validación de `itemId` y tamaño JSONB | `submitEvents` (`#L728-L748`) usa `config.items` (no `questions`) sin aserción ciega; `completeAttempt` (`#L935-L942`) valida claves y tamaño de `dto.answers` con Zod (cuerpos de `1mb` en `main.ts:44` no deben inflar `Attempt.payload` hasta OOM) | `P1-04`, `RF-4`.2 |
| T3.4 | `POST /api/v1/media/:id/confirm` | Exige `x-attempt-token`, tamaño real `<= 10 MiB` con corte de stream (sin `readFileSync` en RAM), magic bytes, `ffprobe` real con duración en `[2 s, max_duration_seconds]` sin fallback `sizeBytes / 8000` (rechazo `422`), `SELECT ... FOR UPDATE` marcando `ready` previos del intento como `pending_delete` antes de pasar el nuevo a `ready`, y encolado de `ffmpeg`. `upload-url` exige `x-attempt-token` y cuota de `pending_upload`. Segunda confirmación sin `P2002`/`500` | `P1-02`, `P1-03`.4-5, `RF-5`.3, `QA-05` |
| T3.5 | `ffmpeg` robusto | `runFfmpeg` (`media.service.ts#L522-L550`): drenar `stderr`; escalar a `SIGKILL` tras el timeout; `processQueue` reencola fallos con `transcode_attempts` en `1..2`; cola serial (1 tarea en 512 MB) se mantiene | `P1-03`.1-3, `RF-5`.2 |
| T3.6 | Pruebas `AUDIO-01` | Añadir a `media.spec.ts` las pruebas de regresión exigidas por `SPEC-11 §9` (binario no-audio con magic bytes `OggS`/`EBML` de 24 KB–960 KB se rechaza) | `P1-02`, `RF-5`.4 |
| T3.7 | `open_question` multi-pregunta (servidor) | Validar `itemId` contra `items[].id` en `/events`; `ReviewsService` (`#L348-L354`) no debe rellenar `answers['text']` como respaldo de otras preguntas | `P1-07` (servidor), `RF-8`.3 |
| T3.8 | Condiciones de carrera en revisión | `ReviewsService.submitReview` (`#L487-L506`, `#L608`): `FOR UPDATE` en intentos autocalificados (`fill_blank`/`exam`) y primer comentario docente en `graded`; doble clic sin `P2002`/`500` | `P1-06` (revisión) |
| T3.9 | Traslado de grupo con reintentos (servidor) | `AllExceptionsFilter#L76-L83` conserva `details`; `students.service.ts#L731-L795` filtra `status: 'graded'` y, con `confirmLostRetries: true`, limpia **en la misma `$transaction`** `retry_granted_at = null` y `retry_extend_until = null` en los intentos `graded` afectados del grupo saliente (revocación definitiva aunque el alumno regrese) | `P0-09` (servidor), `RF-9`, `QA-07` |
| T3.10 | Seeds | `seed-dev.ts#L538-L583`: `Midterm Exam A1` con `items[]`, UUIDs válidos y `answer_key` correcto (hoy `TypeError: item.blanks is not iterable` → `500`); `seed-volume.ts#L148-L187`: no insertar intentos de 100 alumnos de 4 grupos sobre una asignación exclusiva del grupo `A1` | `P1-09`, `RF-4`.3 |
| T3.11 | Cascada de eliminación de alumno | `students.service.ts#L44` y `#L985-L1030`: mover `AuditLog` redactado y borrado en R2 de modo que un fallo intermedio no deje estado parcial (SQL dentro de `$transaction`; efectos externos después) | `P2-03` |
| T3.12 | `GroupsService` y `ResourcesService` | `archiveGroup` (`groups.service.ts#L197-L252`) bloquea `Group` con `FOR UPDATE` frente a traslados simultáneos; `ResourcesService.create` (`#L137-L175`) hace tope de 200 y `MAX(position)+1` dentro de transacción | `P2-06` |
| T3.13 | `@Optional()` | Retirar `@Optional()` persistente en 4 clases (incluye `MediaService`) | `P2-03` (parte), `RF-4`.4 |
| T3.14 | Migración de microjuegos | Añadir a `20261108000000_autonomous_microgames/migration.sql` el bloque `DO $$ ... RAISE NOTICE` con el conteo de filas descartadas (`SPEC-11 §6.4`) si la migración aún no se ha aplicado en entornos compartidos; si ya se aplicó, crear una migración nueva que registre el conteo | `RF-1`.1 |

---

### F4 — Bloque C: Microjuegos, gamificación y estadísticas

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T4.1 | `startGameAttempt` | `attempts.service.ts#L482-L489`: eliminar los intentos `in_progress` previos en lugar de lanzar `409 ATTEMPT_ALREADY_EXISTS` (`SPEC-11 §5.1`); `attemptToken` acotado (hoy 365 días en `#L522`) conforme a la spec; limpiar el código muerto de asignaciones de juegos en `AttemptsService` | `RF-1`.2, `P3-01` (parte) |
| T4.2 | `ProgressEvent` en juegos | `completeAttempt` (`#L1125-L1126`): invocar `gamificationService.recordAttemptCompleted(organizationId, studentId, attempt.id, null)` al completar partidas válidas de `game`; restaura rachas, insignias y alertas de inactividad `>= 14` días (Decisiones 104 y 137b) | `P0-10`, `RF-12`.1 |
| T4.3 | Estrellas y mensajes en `packages/shared` y respuestas | `scoreToGameStars` (`scoring.ts#L260-L298`) con tramos `0.0 → 0⭐`, `0.1–2.9 → 1⭐`, `3.0–4.4 → 2⭐`, `4.5–5.0 → 3⭐`; `getGameMotivationMessage` con la tabla de 10 mensajes de `SPEC-11 §4.2`; `GET /me/games`, `GET /attempts/:id` y `POST /complete` (`attempts.service.ts#L403-L418`, `#L1139`) dejan de exponer `score`/`bestScore` al niño. Recalcular `gamePoints` del ranking docente | `P1-05` (servidor), `RF-10` |
| T4.4 | Estadísticas | `groupAverageScore` (`stats.service.ts#L1222-L1231`): indexar `gMap` por `assignment_id` **y** `student_id`; `computeGamesPractice` incluye `GameMechanic.order_words`; `byLevel` selecciona `activity.expected_duration_seconds` para juegos autónomos | `P1-11`.1-3, `RF-12`.2-3 |
| T4.5 | `games-leaderboard` | `stats.service.ts#L1682-L1764`: excluir todo intento cuyo `Attempt.flags` contenga `'implausible_duration'` de `gamePoints`, `totalStars`, `gamesPlayedCount`, `uniqueGamesPlayed` y `practiceTimeSeconds`; `gamesPractice` individual conserva el desglose diagnóstico | `QA-06` |
| T4.6 | Presupuesto `< 500 ms` | Cachear `Intl.DateTimeFormat('en-CA', ...)` a nivel de módulo en `gamification.service.ts#L320-L326` y `stats.service.ts#L79-L80`, `#L428`, `#L1579-L1643`; `stats.performance.spec.ts` pasa (`677,42 ms` → `< 500 ms`) | `P1-11`.4, `RF-11` |
| T4.7 | Rol y códigos | `Role.student` recibe `403 AUTH_FORBIDDEN` (no `FORBIDDEN`) en el endpoint docente de leaderboard y demás | `RF-12`.4 (ver T5.4) |

---

### F5 — Robustez, mantenimiento y limpieza del servidor

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T5.1 | Eliminar `as Type` en `apps/api` y `packages/shared` | 155 aserciones en `apps/api/src` y 18 en `packages/shared/src`, sustituidas por narrowing, type guards o `Zod` (se exceptúan `as const` y tests). Incluye la de `attempts.service.ts` (`as { questions?: ... }`) | `P1-14` (parte), `RF-13`.2 |
| T5.2 | `MaintenanceService` | `maintenance.service.ts#L169`: abandonar también intentos `in_progress` de microjuegos (hoy `if (!att.assignment) continue`); `runMonthlyAgeReview` (`#L379-L387`) en `America/Bogota`; `runTeacherPendingSummary` (`#L696-L715`) no marca `ScheduledJobRun` como `done` si `sendMail` devuelve `{ status: 'failed' }` | `P2-05`, `RF-8`.4 |
| T5.3 | Código muerto del servidor | `@nestjs/throttler` sin uso (`apps/api/package.json#L29`); lectura de `APP_PUBLIC_URL` y filtro no-op `{ not: undefined }` en `reviews.service.ts#L49-L64`; `next.config.ts` coexistiendo con `vite.config.ts` se coordina con el Plan 2 (T6.x) | `P3-01` (parte), `RF-13`.4 |
| T5.4 | Códigos HTTP | `SubmitReviewDto` (`reviews.dto.ts#L53-L54`): `422 SCORE_OUT_OF_RANGE` en vez de `400 VALIDATION_ERROR`; `RolesGuard#L27` y `JwtAuthGuard#L112`: `AUTH_FORBIDDEN` en vez de `FORBIDDEN` | `P3-02` |
| T5.5 | Tests PostgreSQL honestos | Los 7 archivos `*.postgres.spec.ts` / `e2e-*.spec.ts` de `apps/api/test/` dejan de hacer `return` temprano y usan `describe.skipIf` (puerto por defecto o variable a `:5433`, coherente con T1.4); `auth.spec.ts#L97` deja de caer en timeout por contención de Argon2id (`5058 ms > 5000 ms`) | `P2-08` (parte API), `RF-15`.4 |

---

### F6 — Skills propias (servidor), hashes y verificación del Plan 1

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T6.1 | `englove-guardrails` — reglas de servidor | En las 3 copias (`.agents/`, `.claude/`, `.kiro/`): `G-A06` (`check-guardrails.mjs#L391-L425`) audita todo uso de `TenantContext.runBypass` con comentario `guardrails-ignore G-A06:` y avisa de `.update/.delete/.upsert({ where: { id } })` en modelos con `organization_id` mientras no estén interceptados; `G-C10` comprueba `redact` de `x-attempt-token` y saneado de query strings; `G-B10` detecta `mc anonymous set download` o lectura pública en `docker-compose.yml`/infra; actualizar `SKILL.md` y `references/reglas.md`. Las reglas `G-C12`, `G-B04` y `G-C13` las activa el Plan 2 sobre el mismo script | `§6.1`.2, `.4`, `.5` |
| T6.2 | Prueba automatizada del script | Crear test de regresión del propio `check-guardrails.mjs` (`SPEC-11 §9`) con casos positivos/negativos de T6.1; el Plan 2 lo extiende | `§6.1` (test) |
| T6.3 | `skills-lock.json` | Recalcular `computedHash` de `englove-guardrails` y `englove-spec` tras editar (hoy previos al commit `64b1916`); se recalcula de nuevo al cerrar el Plan 2 | `P3-06` |
| T6.4 | Verificación del Plan 1 (`verification-before-completion`) | Con PostgreSQL, MinIO y Mailpit activos: `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (cero `skip` silenciosos), `pnpm build`, `node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --all` y `check-spec.mjs`. Adjuntar salida real con `Exit 0` | §6.3, §8.2 paso 5 (parte) |
| T6.5 | Revisión | `code-review` (Estándares y Spec) + `security-review` + `englove-guardrails` sobre el diff del Plan 1 antes de dar por cerrada cada tarea ENG | §1, §6.3 |

---

## 5. Matriz de trazabilidad: hallazgos de la auditoría → este plan

| Hallazgo | Mitad servidor (Plan 1) | Mitad cliente (Plan 2) |
| --- | --- | --- |
| `P0-01` | T2.1 | — |
| `P0-02` | T2.2, T2.4 | Plan 2: login y `trySilentRefresh()` |
| `P0-03` | T2.2, T2.3 | Plan 2: `navigator.locks`, `setSharedSession` |
| `P0-04` | — | Plan 2 |
| `P0-05` | — | Plan 2 |
| `P0-06` | — | Plan 2 |
| `P0-07` | — | Plan 2 |
| `P0-08` | T6.1 (regla `G-C13` queda en Plan 2) | Plan 2 |
| `P0-09` | T3.9 | Plan 2: `ApiError`, modal `confirmLostRetries` |
| `P0-10` | T4.2 | — |
| `P1-01` | T2.7 | — |
| `P1-02` | T3.4, T3.6 | — |
| `P1-03` | T3.4, T3.5 | Plan 2: temporizador `speaking` (en `P1-08`) |
| `P1-04` | T3.3 | — |
| `P1-05` | T4.3 | Plan 2: UI de juegos |
| `P1-06` | T3.1, T3.8 | — |
| `P1-07` | T3.7 | Plan 2: runner y `/revision` |
| `P1-08` | — | Plan 2 (editor, publicar, temporizador `speaking`) |
| `P1-09` | T3.10 | — |
| `P1-10` | T5.4 (código `422 SCORE_OUT_OF_RANGE`) | Plan 2 (coma decimal) |
| `P1-11` | T4.4, T4.5, T4.6 | — |
| `P1-12` | T2.3, T2.5, T2.6 | — |
| `P1-13` | — | Plan 2 |
| `P1-14` | T5.1 (api + shared) | Plan 2 (TanStack Query, `as Type` en web, `apiFetch`, `G-B04`, `G-C12`) |
| `P1-15` | T1.1, T1.2, T1.3 | — |
| `P2-01` | T2.8 | — |
| `P2-02` | T1.8, T2.4, T2.5 | Plan 2: `login-client.tsx#L222` (`APP_ENV === 'local'`) |
| `P2-03` | T3.11, T3.13 | — |
| `P2-04` | T3.2 | — |
| `P2-05` | T5.2 | — |
| `P2-06` | T3.12 | — |
| `P2-07` | T1.4 | — |
| `P2-08` | T5.5 | Plan 2: 3 specs E2E rotas y test vacuo de `spec-09` |
| `P2-09` | T1.5, T1.6, T1.7 | — |
| `P2-10` | — | Plan 2 |
| `P2-11` | T0.1–T0.9 (parte) | Plan 2 (resto de specs y documentos) |
| `P3-01` | T4.1, T5.3 | Plan 2 (`src/lib/motion/*`, `next.config.ts`) |
| `P3-02` | T5.4 | — |
| `P3-03` | — | Plan 2 |
| `P3-04` | — | Plan 2 |
| `P3-05` | — | Plan 2 |
| `P3-06` | T6.3 | Plan 2 (recálculo final) |
| `QA-01` | T0.1 | Plan 2 |
| `QA-02` | T0.1, T2.2, T2.3 | Plan 2 |
| `QA-03` | T0.1 | Plan 2 |
| `QA-04` | T0.1, T5.1 | Plan 2 |
| `QA-05` | T0.1, T3.4 | Plan 2 |
| `QA-06` | T0.1, T4.5 | — |
| `QA-07` | T0.1, T3.9 | Plan 2 |
| `QA-08` | T0.1, T1.4, T2.4 | Plan 2 |

Cobertura por secciones de la auditoría:

- **§1 (resumen, compuertas, causa raíz):** compuertas `lint`/`typecheck`/`test`/guardrails/specs → T1.1, T1.2, T4.6, T5.5, T6.1–T6.4. La causa raíz de §1.3 se corrige con pruebas de regresión reales en F2 y F3.
- **§2.1 (aciertos de Etapa 12):** no se tocan. Las pruebas de F2–F4 verifican que no se pierdan (`toPublicConfig`, anti-SSRF, `OriginGuard`, `argonSemaphore`, `MediaService` sin `isMock`, migración XOR, ranking).
- **§2.2 (`RF-1` a `RF-15`):** `RF-1` → T3.14, T4.1 (+ Plan 2); `RF-2` → T2.1–T2.5, T1.8; `RF-3` → T2.6, T3.1; `RF-4` → T1.3, T3.3, T3.10, T3.13; `RF-5` → T3.4–T3.6; `RF-6`, `RF-7` → Plan 2; `RF-8` → T3.2, T3.7, T5.2 (+ Plan 2); `RF-9` → T3.9 (+ Plan 2); `RF-10` → T4.3 (+ Plan 2); `RF-11` → T4.6; `RF-12` → T4.2, T4.4, T4.7; `RF-13` → T5.1, T6.1 (+ Plan 2); `RF-14` → Plan 2; `RF-15` → T1.4, T2.7, T5.5, T0.x (+ Plan 2).
- **§3 (documental):** §3.1 → T0.3; §3.2 SPEC-01/02/04/05 → T0.4–T0.7 (las demás, Plan 2); §3.3 → T0.2, T0.9 (resto, Plan 2).
- **§4 (flujos E2E de estudiante y maestra):** la mitad servidor de cada paso está cubierta arriba. La verificación de punta a punta se completa en el Plan 2 (E2E).
- **§6 (skills):** §6.1 → T6.1, T6.2 (resto en Plan 2); §6.2 → T0.8; §6.3 → T6.3, T6.4 (`verification-before-completion`); `accessibility` + `playwright-best-practices` → Plan 2.
- **§7.1:** puntos 1, 3 (servidor), 4 (servidor) → F1–F4; 2 (servidor); 5 y 6 → Plan 2 (salvo T5.1). **§7.2:** 1 y 2 → F1; 3 (MinIO/R2) → T1.4; 3 (dominio, Resend) y 4 → Plan 2.
- **§8:** `QA-01`..`QA-08` según matriz; §8.2 paso 1 → T0.1–T0.2; paso 2 → T0.3–T0.7; paso 3 → F1 y T6.1–T6.3; paso 4 bloques A, B, C → F2, F3, F4 (el bloque D lo cubre el Plan 2); paso 5 → T6.4 y Plan 2.

---

## 6. Criterios de aceptación del Plan 1

1. `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` terminan con `Exit 0` en un clon limpio, incluido Windows (sin `EPERM`).
2. Los 7 tests `*.postgres.spec.ts` / `e2e-*.spec.ts` se ejecutan (o se saltan de forma visible con `skipIf`). Ninguno pasa en falso.
3. Cada tarea de corrección tiene su prueba de regresión nombrada por el hallazgo (Decisión 129), ejecutada por HTTP o PostgreSQL real.
4. `check-guardrails.mjs --all`: 0 errores. `check-spec.mjs`: sin errores en las specs tocadas.
5. `render.yaml` en `plan: free`, sin `MIGRATION_DATABASE_URL` en runtime. MinIO local privado. Dockerfile no root.
6. Los contratos de §3 están documentados en las specs alineadas (T0.4–T0.7, T0.3) y disponibles para el Plan 2.
7. Ninguna tarea añade funcionalidades fuera de las decididas en la auditoría (`AGENTS.md`, decisiones 127 a 129 y `QA-01`..`QA-08`).
