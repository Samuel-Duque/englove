---
name: englove-guardrails
description: "Verifica de forma automatizada e interactiva las reglas invariantes de arquitectura, persistencia, despliegue y negocio de Englove (.agents/CONTEXT.md §16, §14, §2.4 y planning/architecture-overview.md): PostgreSQL 18 en Neon con doble cadena Prisma, sin Supabase ni RLS, frontend en Cloudflare Workers con vinext, proxy.ts y RSC sin 'use cache' en autenticado, backend en Render con instancia única y cola serial segura de ffmpeg, archivos en Cloudflare R2 con URL prefirmada, puntaje 0.0-5.0 y timestamps exclusivos del servidor, organization_id directo en toda tabla y consulta de tenant con anti-IDOR, tipado estricto sin any ni @ts-ignore con validación en dos niveles, privacidad sin PII en logs y limpieza de IndexedDB en tablets compartidas, y exclusiones del piloto. Úsala obligatoriamente antes de escribir o dar por bueno código de producción, al revisar una rama o PR junto con code-review y security-review, al tocar schema.prisma, migraciones, Dockerfiles, wrangler, render.yaml o CI, o antes de pasar una tarea ENG a Hecho en el taskboard."
---

# englove-guardrails — Verificación de invariantes de Englove

Lista de verificación automatizada (`scripts/check-guardrails.mjs`) e interactiva (`references/reglas.md`) de las reglas que ningún cambio de código o configuración puede romper. No sustituye a los documentos del proyecto: enlaza a cada decisión y comprueba su cumplimiento. Si esta skill y un documento superior discrepan, manda el documento (y se corrige la skill).

## Reglas de oro

1. **Jerarquía de autoridad:** `.agents/CONTEXT.md` → `planning/architecture-overview.md` → `planning/sdd-process.md` → `planning/pbp-development.md` → `planning/taskboard.md` → `specs/` → código. Si una tarea parece exigir romper una regla de este catálogo, **detente**: no ajustes el código en silencio (decisión 82 (j) y CONTEXT §16). Propón primero una decisión nueva en CONTEXT §14 y espera confirmación del líder.
2. **Compuerta SDD previa al código:** ninguna tarea `ENG` se implementa ni pasa a `Hecho` sin su `SPEC-NN` en estado `Aprobada` (CONTEXT §11.1, decisión 65). La única excepción es un prototipo desechable declarado como tal (sdd-process §6, como fue ENG-140).
3. **Evidencia antes de afirmar cumplimiento:** ejecuta siempre el script antes de emitir el veredicto (principio de `verification-before-completion`). El script cubre las señales sintácticas; tú debes completar las comprobaciones marcadas como **Heurística** o **Manual** en [references/reglas.md](references/reglas.md).
4. **Enlazar, no duplicar:** cada hallazgo cita el ID de regla (`G-A01`…`G-C13`), el archivo y número de línea (`archivo:línea`) y la fuente (`CONTEXT §x`, `architecture §y`, decisión N).
5. **Aviso crítico sobre skills vecinas:** la skill pública `supabase-postgres-best-practices` vive en el repositorio **únicamente** por sus pautas de SQL e índices para PostgreSQL genérico. Queda prohibido aplicar cualquier recomendación suya de Supabase Auth, Supabase Storage, Realtime, Edge Functions o políticas RLS (`G-A01`, `G-A02`).

## Fuentes que debes consultar

| Fuente | Qué aporta a la verificación |
|---|---|
| [references/reglas.md](references/reglas.md) | Catálogo completo `G-A01` a `G-C13`: regla, fuente, modo de verificación (`Automática`, `Heurística`, `Manual`) y excepciones legítimas |
| `.agents/CONTEXT.md` §16, §14 y §2.4 | Convenciones obligatorias para agentes, registro de decisiones (1–92+) y tabla de elementos fuera del alcance del piloto |
| `planning/architecture-overview.md` | Estructura del monorepo (§2), Next.js 16 y `vinext` (§3.8), módulos, guards, scoring y jobs (§4), paquete compartido y `answer_key` (§5), modelo de datos y matriz de tenant (§6), seguridad, cookies y cascada (§8), entornos y despliegue (§11), convenciones y códigos de error (§13) |
| `specs/SPEC-NN-*.md` de la etapa | Contrato aprobado que el cambio implementa |

## Cuándo y en qué modo usarla

| Situación | Modo | Comando base del script |
|---|---|---|
| Vas a empezar una tarea `ENG` o diseñar un módulo | **Preventivo** | Lee la sección aplicable de `references/reglas.md` antes de escribir código |
| Hay cambios en curso (working tree) o acabas de implementar una tarea | **Cambios locales** | `node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs` |
| Revisión de rama / PR (junto con `code-review` y `security-review`) | **Rama / PR** | `node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --base main` |
| Auditoría de un paquete, carpeta o del repositorio completo | **Auditoría** | `node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --all` (o rutas) |
| Se añadieron decisiones en CONTEXT §14 o se editó esta skill | **Mantenimiento** | `node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --self-check` |

## Procedimiento paso a paso

### Paso 1 — Verificar la compuerta SDD

1. Identifica qué tarea(s) `ENG-nnn` del `planning/taskboard.md` toca el cambio y qué `SPEC-NN` figura en su columna `Spec`.
2. Comprueba en `specs/README.md` y en la cabecera de la spec que su estado es **`Aprobada`** (y en las Etapas 1 y 2, que se cumplen las dependencias de la decisión 65). Si no está `Aprobada` y no es un prototipo desechable declarado, reporta incumplimiento bloqueante de la compuerta SDD.

### Paso 2 — Ejecutar el escaneo automático

Desde la raíz del repositorio:

```bash
# Cambios locales sin confirmar (+ archivos nuevos)
node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs

# Contra la rama base (PR o cierre de tarea)
node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --base main

# Carpeta o archivos concretos / repositorio completo
node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs apps/api prisma/schema.prisma
node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --all
```

El script lee en vivo la matriz de tablas de tenant de `architecture-overview.md` §6.2, las tablas de detalle de `CONTEXT.md` §7.2 y las decisiones de `CONTEXT.md` §14. Si emite una `NOTA` avisando que `CONTEXT.md` tiene decisiones posteriores a las conocidas por el script, léelas antes de continuar.

### Paso 3 — Revisión semántica y manual por bloque

El script detecta patrones sintácticos, pero las invariantes de diseño exigen leer el código tocado frente a [references/reglas.md](references/reglas.md):

#### A. Motor SQL y Persistencia (Neon y Prisma — `G-A01` a `G-A11`)
- **Neon exclusivo (`G-A01`, `G-A02`):** cero rastro de Supabase o RLS; la autorización ocurre en NestJS (`JwtAuthGuard` → `RolesGuard` → `TenantContext`).
- **Doble conexión y migraciones (`G-A03`, `G-A04`):** `DATABASE_URL` apunta al pooler de Neon (`-pooler`, `connection_limit` bajo) para el runtime; `MIGRATION_DATABASE_URL` (directa) se usa solo en `prisma migrate deploy` en CI. Prohibido `prisma db push` fuera de `local`.
- **Multi-tenant estricto y anti-IDOR (`G-A05`, `G-A06`, `G-A07`, `G-A11`):** toda tabla de la matriz de `architecture §6.2` tiene `organization_id` directo y obligatorio (sin inferirlo por joins). Toda consulta de tenant pasa por la extensión de Prisma Client **y** lleva filtro explícito `organization_id` en el servicio. Prohibido `findUnique` por id sin validar `organization_id` (usar `findFirst` o clave compuesta) y, en rutas de alumno, aislar horizontalmente exigiendo `student_id = currentUser.studentId` en `Attempt`, `MediaAsset` y `ProgressEvent`. Mutaciones de `Attempt.payload` atómicas en SQL (`payload || $nuevas` o `SELECT ... FOR UPDATE`).
- **Integridad del esquema (`G-A08`, `G-A09`, `G-A10`):** toda `@relation` declara `onDelete` según la tabla de `architecture §6.2` (`AuditLog.target_student_id` usa `SetNull` con redacción previa de `details`, decisión 92). Sin campos ni enums retirados (`Review.score`, `Student.name`, `ApprovalStatus.rejected`, `Role.guardian`, `max_attempts`, `classroom_code`). `Attempt.score` es `@db.Decimal(2, 1)` con `CHECK (score BETWEEN 0 AND 5)`.

#### B. Entornos de Despliegue y Hosting (Cloudflare Workers, Render, R2 — `G-B01` a `G-B13`)
- **Frontend en Workers con `vinext` (`G-B01` a `G-B06`):** sin Vercel, Cloudflare Pages ni OpenNext. Intercepción solo en `proxy.ts` (export `proxy`, runtime Node.js; prohibidos `middleware.ts` y runtime Edge), que **únicamente redirige** por presencia de cookie o claim de rol y nunca decide autorización de negocio. Server Components (RSC) por defecto; componentes cliente reducidos a las hojas interactivas; API consumida con TanStack Query (sin Server Actions como backend de mutaciones). Caché explícita con `'use cache'` y `cacheComponents: true`, jamás sobre datos autenticados. Drag and drop con `@atlaskit/pragmatic-drag-and-drop` (prohibido `@dnd-kit`). Bundle comprimido del Worker <= 3 MB en Free y <= 10 MB en Paid.
- **Backend en Render con instancia única y ffmpeg seguro (`G-B07`, `G-B08`, `G-B09`, `G-B13`):** imagen Docker de `apps/api` con `ffmpeg` y `ffprobe`. Invocación de `ffmpeg` siempre como array de argumentos (`shell: false`), archivos temporales en `os.tmpdir()` limpiados en `finally`. Una sola instancia activa (sin autoescalado ni Redis/BullMQ sin decisión nueva). Cola de transcodificación **serial** (1 tarea a la vez en 512 MB) con rutina de recuperación al arrancar (`status = ready`, `converted_key IS NULL`, `transcode_failed_at IS NULL`, máx. 3 intentos en `transcode_attempts` y fallback al raw).
- **Archivos en R2 y red (`G-B10`, `G-B11`, `G-B12`, `G-B13`):** subida directa a bucket privado de Cloudflare R2 con URL prefirmada (`@aws-sdk/client-s3`) validada en tamaño (<= 10 MB) y MIME; verificación `HEAD` en R2 antes de descargar para transcodificación; ningún stream de audio pasa por la API ni se guarda en disco local como almacenamiento. Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.<dominio>` y `COOKIE_PREFIX` por entorno; CORS con allowlist y validación de `Origin`; secretos JWT separados entre staging y producción.

#### C. Reglas de Negocio, Integridad y Seguridad (`G-C01` a `G-C13`)
- **Idioma y terminología (`G-C01`):** identificadores de código, tablas y columnas en inglés; textos de UI, comentarios de negocio y documentación en español. "Tipo de actividad" solo para los 5 valores de `ActivityType`; "mecánica de juego" solo para los 5 de `GameMechanic`.
- **Calificación y reloj en servidor (`G-C02`, `G-C03`):** los scorers devuelven fracción `0..1` y `ScoringService` convierte a `0.0–5.0` con un decimal (`round(fraction × 5, 1)`); ningún endpoint acepta `score` del alumno; `Review` solo guarda feedback cualitativo y rechaza nota en autocalificados con `SCORE_NOT_EDITABLE`. Todos los timestamps (`started_at`, `finished_at`, `graded_at`, `occurred_at`, `joined_at`, `left_at`) los asigna el servidor y `ValidationPipe({ whitelist: true, transform: true })` descarta cualquier campo extra (sin `forbidNonWhitelisted`). El campo `at` de `ActivityEvent` no sale en los DTOs HTTP.
- **Protección de `answer_key` (`G-C04`):** `config` y `answer_key` en columnas separadas; `omit` global de `answer_key` en Prisma Client; `toPublicConfig()` nunca la expone en `fill_blank` ni `exam`.
- **Alcance y superficie de API (`G-C05`, `G-C06`, `G-C07`):** sin `Guardian`, `ConsentRecord`, consentimiento de menores, MFA, pantallas de `admin`/`parent`, ni flags `stats`/`leaderboard`. Nada de CONTEXT §2.4 (WebSockets/SSE, heartbeat, Phaser, iframe de Educaplay, Capacitor, pagos, analítica o píxeles en el portal del alumno). Endpoints de negocio bajo `/api/v1`; solo `/health` y `/docs` en la raíz, con `/docs` respondiendo `404` en producción (`APP_ENV === 'production'`).
- **Operación, tipado, privacidad e higiene (`G-C08` a `G-C13`):** zona horaria `America/Bogota` en `@Cron` y visualización; tareas periódicas idempotentes registradas en `ScheduledJobRun`; tipado estricto sin `any`, `@ts-ignore` ni `@ts-nocheck` con validación en dos niveles (`class-validator` para HTTP y `Zod` para actividades en `packages/shared`); cero PII en logs o errores (`sendDefaultPii: false`, errores `{ statusCode, code, message }` sin stack traces); secretos solo en variables de entorno; vaciado de IndexedDB y caché al cerrar sesión en tablets compartidas; enlaces externos con `https:` y sin `dangerouslySetInnerHTML`.

### Paso 4 — Gestionar falsos positivos

Si un hallazgo del script corresponde a una **excepción legítima** documentada en `references/reglas.md`, puedes suprimirlo en la línea afectada o en la inmediatamente anterior indicando siempre el motivo:

```ts
// guardrails-ignore G-A06: búsqueda de usuario por email globalmente único en login (decisión 59)
const user = await this.prisma.user.findUnique({ where: { email } });
```

El script rechaza con `AVISO` cualquier `guardrails-ignore` sin motivo y lista todas las supresiones en su salida para que el revisor humano las audite. Nunca uses `guardrails-ignore` para silenciar un incumplimiento real.

### Paso 5 — Emitir el informe estructurado

Usa siempre esta plantilla al reportar al usuario o al integrarte con `code-review`:

```markdown
## Informe de Guardrails (englove-guardrails)

- **Alcance revisado:** `<diff / archivos / rama>`
- **Compuerta SDD:** `<SPEC-NN Aprobada | BLOQUEADO: motivo>`
- **Resultado del script:** `<N errores, M avisos, K suprimidos>`
- **Veredicto:** `CUMPLE` | `CUMPLE CON AVISOS JUSTIFICADOS` | `INCUMPLE (bloquea PR / cierre de tarea)`

### Incumplimientos (`ERROR`)
| Archivo y línea | Regla | Fuente | Hallazgo | Corrección requerida |
|---|---|---|---|---|
| `apps/api/src/...:42` | `G-C03` | decisión 37, arch §4.4 | `startedAt` declarado en DTO de entrada | Eliminar el campo del DTO y asignar `new Date()` en el servicio |

### Avisos revisados (`AVISO`) y comprobaciones manuales
| Archivo y línea / Bloque | Regla | Estado | Justificación o acción |
|---|---|---|---|
| `apps/api/src/...:18` | `G-A06` | Justificado / Corregir | ... |

### Resumen por bloque
- **A. Motor SQL y Persistencia (Neon y Prisma):** `<OK / N hallazgos>`
- **B. Despliegue y Hosting (Workers, Render, R2):** `<OK / N hallazgos>`
- **C. Negocio, Integridad y Seguridad:** `<OK / N hallazgos>`
```

Si no hay ningún `ERROR` ni `AVISO`, mantén la cabecera, el resumen por bloque en `OK` y omite las tablas vacías.

## Relación con otras skills

- **`code-review`:** `englove-guardrails` aporta las fuentes e invariantes concretas del eje **Standards** de Englove; ejecútala siempre al hacer una revisión de código.
- **`security-review`:** complementa la auditoría OWASP general con las reglas de seguridad propias del dominio (`G-A02`, `G-A06`, `G-A11`, `G-B03`, `G-B10`, `G-B11`, `G-B13`, `G-C02`, `G-C03`, `G-C04`, `G-C10`, `G-C11`, `G-C12`, `G-C13`).
- **`englove-spec`:** verifica las specs antes de aprobarlas; `englove-guardrails` verifica el código y la configuración que las implementan.
- **`verification-before-completion`:** exige correr `check-guardrails.mjs` (además de `lint`, `typecheck` y `test`) antes de declarar terminada cualquier tarea `ENG`.
