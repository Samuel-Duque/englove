# Catálogo de reglas invariantes de Englove

Cada regla resume una decisión **ya tomada** y enlaza su fuente. El texto normativo vive en `.agents/CONTEXT.md` y `planning/architecture-overview.md`: si este catálogo y la fuente discrepan, manda la fuente y hay que corregir el catálogo (y el script).

**Cómo leer cada regla**

- **Verificación:** `Automática` (el script la detecta con poca ambigüedad), `Heurística` (el script avisa; un humano o agente confirma) o `Manual` (no hay señal textual fiable: revísala leyendo el código).
- **Severidad por defecto del script:** `ERROR` bloquea la aprobación del PR o el cierre de la tarea; `AVISO` exige una revisión y, si se mantiene, una justificación en el informe.
- **Excepciones legítimas:** casos en que la señal aparece sin incumplir la regla. Si aplica una, suprime el hallazgo con `guardrails-ignore` y el motivo (ver SKILL.md).

Índice: [A. Motor SQL y persistencia](#a-motor-sql-y-persistencia) · [B. Despliegue y hosting](#b-despliegue-y-hosting) · [C. Negocio, integridad y seguridad](#c-negocio-integridad-y-seguridad)

---

## A. Motor SQL y persistencia

### G-A01 — Sin Supabase en ninguna forma

- **Regla:** PostgreSQL 18 en Neon es el único motor SQL. Prohibidos clientes, paquetes, URLs, variables de entorno o configuración de Supabase (Auth, Realtime, RLS, Storage, Edge Functions).
- **Fuente:** decisión 82 (b); CONTEXT §6 (Datos e infraestructura) y §16 (Proveedores).
- **Verificación:** Automática — `@supabase/*`, `supabase.co`, `SUPABASE_*`, `supabase/config.toml`.
- **Excepciones:** ninguna en código ni configuración. La skill pública `supabase-postgres-best-practices` solo se usa para SQL genérico.

### G-A02 — La autorización vive en NestJS, no en RLS

- **Regla:** sin políticas RLS como mecanismo de autorización de negocio. La autorización la hacen `JwtAuthGuard` → `RolesGuard` → `TenantContext` y el filtro de tenant.
- **Fuente:** decisión 82; architecture §4.3; CONTEXT §6.
- **Verificación:** Automática — `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `auth.uid()`, `current_setting('request.jwt…')` en SQL, migraciones o código.
- **Excepciones:** ninguna en el piloto. Una necesidad real exige una decisión nueva en CONTEXT §14.

### G-A03 — Doble cadena de conexión de Prisma

- **Regla:** el runtime de la API usa `DATABASE_URL` (pooler de Neon, host `-pooler`, con `connection_limit` bajo). `MIGRATION_DATABASE_URL` (conexión directa) se usa solo para `prisma migrate deploy` en CI; nunca en el código de runtime ni en la web.
- **Fuente:** decisión 82 (b); architecture §11.2 y §11.4; SPEC-01 §5 (Configuración de arranque).
- **Verificación:** Heurística — `ERROR` si `MIGRATION_DATABASE_URL` aparece en `apps/api/src` o `apps/web`; `AVISO` si `prisma.config.ts` no la referencia o si un workflow ejecuta `migrate deploy` sin ella.
- **Revisión manual:** que la `DATABASE_URL` documentada apunte al host `-pooler`, que `connection_limit` esté fijado y que la web nunca reciba ninguna de las dos.
- **Excepciones:** el módulo de validación de entorno puede declarar `MIGRATION_DATABASE_URL` como variable conocida de CI (suprímelo con motivo).

### G-A04 — Nunca `prisma db push` fuera de `local`

- **Regla:** las migraciones en CI, staging y producción usan siempre `prisma migrate deploy`. `db push` no aparece en scripts ni configuración ejecutable versionada.
- **Fuente:** CONTEXT §6 (Backend); architecture §11.2 punto 4; SPEC-01 RF-17.
- **Verificación:** Automática en `package.json`, workflows, Dockerfiles, scripts `.sh`/`.ps1`/`.ts`/`.js`/`.mjs`. Las menciones documentales (`.md`) no se marcan (SPEC-01 RF-17).
- **Excepciones:** ninguna en archivos ejecutables versionados.

### G-A05 — `organization_id` directo en toda tabla de tenant

- **Regla:** toda tabla de la matriz de tenant lleva `organization_id` directo y obligatorio; ninguna infiere el tenant por joins. Solo `Organization` no lo lleva.
- **Fuente:** decisión 89; architecture §6.2 (matriz explícita) y §4.3 (test de esquema); CONTEXT §7.1.
- **Verificación:** Automática sobre `schema.prisma`. El script lee la matriz **en cada ejecución** de architecture §6.2 y los nombres de las tablas de detalle de CONTEXT §7.2. `ERROR` si un modelo de la matriz no tiene `organization_id` (o `organizationId` con `@map("organization_id")`) obligatorio; `AVISO` si aparece un modelo que no está en la matriz (decide si es tenant y actualiza architecture §6.2 primero).
- **Excepciones:** `Organization`.

### G-A06 — Toda consulta de tenant filtra por `organization_id`

- **Regla:** doble filtro deliberado: extensión de Prisma Client que añade `where: { organization_id }` **y** filtro explícito en el servicio.
- **Fuente:** CONTEXT §16; architecture §4.3 y §8.1.
- **Verificación:** Heurística — `AVISO` en llamadas `findMany`, `findFirst`, `updateMany`, `deleteMany`, `count`, `aggregate` y `groupBy` dentro de `apps/api/src` sin `organization_id`/`organizationId` en las líneas siguientes.
- **Revisión manual:** que exista la extensión de tenant y que el test de esquema la cubra; que `findUnique` por id no permita leer otro tenant (compara el `organization_id` del resultado o usa `findFirst` con ambos filtros).
- **Excepciones:** `User` por correo en login y signup (el correo es globalmente único, decisión 59); `Organization`; seeds y tareas que reciben un tenant confiable explícito (SPEC-01 §8).

### G-A07 — SQL crudo seguro y con tenant

- **Regla:** sin `$queryRawUnsafe` ni `$executeRawUnsafe`; el SQL crudo usa plantillas parametrizadas (`$queryRaw\`…\``) y filtra por `organization_id`.
- **Fuente:** architecture §4.3 y §8.3 (prevención de inyección); CONTEXT §16.
- **Verificación:** Automática (`ERROR` para `*Unsafe`); Heurística (`AVISO` para `$queryRaw`/`$executeRaw` sin `organization_id` cerca).
- **Excepciones:** SQL versionado dentro de migraciones (índices parciales, `CHECK`), que no pasa por el cliente.

### G-A08 — `onDelete` explícito en toda relación

- **Regla:** toda clave foránea declara su `onDelete` según la tabla de architecture §6.2 (`Restrict`, `Cascade`, `SetNull`, `NoAction`).
- **Fuente:** decisión 80 (y 92 para `AuditLog.target_student_id` → `SetNull`); architecture §6.2; CONTEXT §16.
- **Verificación:** Automática — `ERROR` en todo `@relation(... fields: ...)` de `schema.prisma` sin `onDelete:`.
- **Revisión manual:** que el valor coincida con la tabla de architecture §6.2.
- **Excepciones:** ninguna.

### G-A09 — Modelo de datos vigente, sin campos retirados

- **Regla:** `Review` no tiene `score` ni `graded_at` (la nota vive en `Attempt`); `Student` no tiene `name` (vive en `User.name`); `ApprovalStatus` no tiene `rejected`; `Role` no tiene `guardian`; no existen `max_attempts`, `must_change_password`, `classroom_code` ni `RegistrationSource`.
- **Fuente:** decisiones 72, 79, 77, 35, 25 y 22; architecture §6.3 y §6.4; CONTEXT §16 (Modelo de datos).
- **Verificación:** Automática sobre `schema.prisma` y código.
- **Excepciones:** ninguna.

### G-A10 — `Attempt.score` en escala 0.0–5.0 garantizada por la base de datos

- **Regla:** `Attempt.score` es `numeric(2,1)` con `CHECK (score BETWEEN 0 AND 5)`; es la única columna de calificación.
- **Fuente:** decisiones 24 y 72; architecture §4.4 y §6.4.
- **Verificación:** Heurística — `AVISO` si `score` en `Attempt` no declara `@db.Decimal(2, 1)` o si hay migraciones sin ningún `CHECK` sobre `score`.
- **Excepciones:** ninguna.

### G-A11 — Prevención de IDOR y acceso a datos de tenant

- **Regla:** toda consulta sobre modelos de tenant debe restringirse por `organization_id`. Prohibido usar `findUnique({ where: { id } })` sobre entidades de tenant sin incluir `organization_id` (usar `findFirst({ where: { id, organization_id } })` o claves compuestas con `organization_id`). En rutas y servicios de alumno (`role === 'student'`), toda consulta o mutación sobre `Attempt`, `MediaAsset` y `ProgressEvent` debe validar además que el registro pertenezca a su propio `student_id = currentUser.studentId` (aislamiento horizontal estricto). Las mutaciones concurrentes sobre `Attempt.payload` deben combinarse de forma atómica en PostgreSQL (`payload || $nuevas` o bajo `SELECT ... FOR UPDATE`), nunca mediante *read-modify-write* en memoria.
- **Fuente:** decisiones 82 y 89; architecture §4.3, §6.2, §8.1 y §8.4; CONTEXT §16.
- **Verificación:** Heurística — `AVISO` en llamadas a `findUnique` sobre entidades de tenant distintas de `User` y `Organization`. Revisión manual de la comprobación de `student_id` en controladores y servicios de alumno.
- **Excepciones:** `findUnique` sobre `User.email` en login y auto-registro (el correo es globalmente único, decisión 59); `Organization.id`.

---

## B. Despliegue y hosting

### G-B01 — Sin Vercel, Cloudflare Pages ni OpenNext

- **Regla:** la web se despliega únicamente como Cloudflare Worker con `vinext` y Wrangler. Vercel y Cloudflare Pages no forman parte de la topología; OpenNext quedó descartado.
- **Fuente:** decisiones 82, 85 y 87; architecture §3.8 y §11.3; CONTEXT §16 (Proveedores).
- **Verificación:** Automática — `vercel.json`, `@vercel/*`, `VERCEL_*`, `vercel deploy`, `wrangler pages`, `pages_build_output_dir`, `@cloudflare/next-on-pages`, `@opennextjs/cloudflare`.
- **Excepciones:** ninguna en código ni configuración.

### G-B02 — `proxy.ts`, nunca `middleware.ts` ni runtime Edge

- **Regla:** la intercepción de rutas de Next.js 16 vive en `proxy.ts` (export `proxy`, runtime Node.js). Prohibidos `middleware.ts` y `runtime = 'edge'`.
- **Fuente:** decisiones 81 y 88; architecture §3.8; CONTEXT §16.
- **Verificación:** Automática — archivo `middleware.ts`/`.js` en `apps/web`; `export const runtime = 'edge'` o `runtime: 'edge'`.
- **Excepciones:** ninguna.

### G-B03 — `proxy.ts` solo redirige; nunca autoriza

- **Regla:** `proxy.ts` solo inspecciona la presencia de la cookie o el claim de rol para redirigir entre grupos de rutas o a `/login?next=` (refresco silencioso). La API valida JWT, rol, sesión y tenant en cada petición.
- **Fuente:** decisiones 58 y 81; architecture §3.1, §3.8 y §8.2; CONTEXT §10 y §16.
- **Verificación:** Heurística — `AVISO` si `proxy.ts` verifica firmas (`jwtVerify`, `jsonwebtoken`), importa Prisma o lee `organization_id`.
- **Revisión manual:** que ninguna decisión de acceso a datos dependa de que `proxy.ts` haya dejado pasar la petición.
- **Excepciones:** decodificar (sin verificar) el claim de rol para elegir la redirección.

### G-B04 — Caché explícita, composición RSC y nunca de datos autenticados

- **Regla:** modelo de caché explícito de Next.js 16 con `use cache` y `cacheComponents: true`; React Compiler habilitado. Server Components (RSC) por defecto en `page.tsx` y `layout.tsx`; componentes cliente (`"use client"`) reducidos a las hojas interactivas. Acceso a la API y mutaciones mediante TanStack Query contra `api.<dominio>`; no usar Server Actions como backend de negocio. Nada se cachea por defecto y ninguna respuesta autenticada se cachea jamás. Carga diferida de variantes de animación (`Kids`/`Teens`).
- **Fuente:** decisiones 81 y 88; architecture §3.2, §3.8 y §10.2; CONTEXT §6 (Convenciones de Next.js 16).
- **Verificación:** Heurística — `AVISO` si `next.config.*` no tiene `cacheComponents: true` o `reactCompiler: true`; `AVISO` por APIs de caché implícita (`unstable_cache`, `export const revalidate`, `force-static`); `ERROR` si un archivo con `'use cache'` lee `cookies()`, `headers()` o la sesión.
- **Excepciones:** contenido público estático (por ejemplo, la página de Términos y Condiciones).

### G-B05 — Arrastrar y soltar con `@atlaskit/pragmatic-drag-and-drop`

- **Regla:** los microjuegos de arrastre usan `@atlaskit/pragmatic-drag-and-drop`. Prohibido `@dnd-kit` (y otras librerías de arrastre sin decisión: `react-dnd`, `react-beautiful-dnd`).
- **Fuente:** decisión 81; architecture §3.8; CONTEXT §6 y §16.
- **Verificación:** Automática.
- **Excepciones:** ninguna sin decisión nueva (según la decisión 105, `match` y `drag_drop` combinan de serie `@atlaskit/pragmatic-drag-and-drop` con selección por toque/clic en dos pasos y teclado).

### G-B06 — Worker de Cloudflare bien configurado y dentro del límite

- **Regla:** `wrangler.jsonc` con `nodejs_compat`, `compatibility_date` >= 2024-09-23 y `assets`. Bundle comprimido <= 3 MB en Workers Free (staging/demo) y <= 10 MB en Workers Paid (producción).
- **Fuente:** decisión 85; architecture §3.8, §11.3 y §11.5 (comprobación 3).
- **Verificación:** Automática sobre `wrangler.json`/`wrangler.jsonc`/`wrangler.toml` (flags, fecha, assets). El tamaño es **Manual**: revisa la salida de `wrangler deploy --dry-run` o del build de CI.
- **Excepciones:** ninguna.

### G-B07 — API en Docker con `ffmpeg` y `ffprobe`

- **Regla:** la API es un Web Service Docker en Render desde `apps/api`; la imagen instala `ffmpeg` (que incluye `ffprobe`) para transcodificar y medir duraciones.
- **Fuente:** decisión 64; architecture §3.5 y §11.3; CONTEXT §6.
- **Verificación:** Automática — `ERROR` si un `Dockerfile` de `apps/api` (o de la raíz) no instala `ffmpeg`.
- **Excepciones:** ninguna.

### G-B08 — Una sola instancia de la API

- **Regla:** Render ejecuta una única instancia, sin autoescalado; en producción, siempre activa. Nada de estado de proceso que asuma varias instancias. Externalizar cola o rate limiting (Redis, BullMQ…) exige antes una decisión nueva.
- **Fuente:** decisión 64 (intacta tras la 82 (h)); architecture §4.5, §8.3, §11.3 y §11.4; CONTEXT §16.
- **Verificación:** Automática — `ERROR` si `render.yaml` declara `numInstances` > 1 o un bloque `scaling`. Heurística — `AVISO` por `ioredis`, `redis`, `bullmq`, `bull`, almacenamiento Redis del throttler o `setInterval` en la API.
- **Excepciones:** `setInterval` acotado a una prueba o a un temporizador de cliente.

### G-B09 — Cola de transcodificación serial con recuperación

- **Regla:** una conversión a la vez (512 MB de Render Starter); rutina de recuperación al arrancar para `MediaAsset` `ready` sin `converted_key` ni `transcode_failed_at`; máximo 3 intentos (`transcode_attempts`), luego `transcode_failed_at` y fallback definitivo al raw; el raw solo se borra tras subir el convertido y guardar `converted_key`.
- **Fuente:** decisiones 64 y 84; architecture §3.5 y §4.5.
- **Verificación:** Heurística — `AVISO` por `concurrency` > 1 o `Promise.all` cerca de `ffmpeg`. El resto es **Manual**.
- **Excepciones:** ninguna.

### G-B10 — Archivos en R2 privado con URL prefirmada; nunca a través de la API

- **Regla:** buckets privados de R2 vía S3 API (`@aws-sdk/client-s3`), subida directa con URL prefirmada de corta duración emitida tras verificar derechos. Los audios no pasan por la API ni se guardan en disco del servidor como almacenamiento.
- **Fuente:** decisión 55 (34 §21); CONTEXT §6 y §16; architecture §8.3 y §11.3.
- **Verificación:** Automática — `ERROR` por `FileInterceptor`, `@UploadedFile`, `multer`, `busboy` o `ACL: 'public-read'`. Heurística — `AVISO` por SDKs de otro almacenamiento (`@google-cloud/storage`, `firebase/storage`, `aws-sdk` v2).
- **Excepciones:** archivos temporales de `ffmpeg` en `os.tmpdir()` que se borran al terminar.

### G-B11 — Cookies de sesión, tokens y CORS

- **Regla:** refresh y access en cookies `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.<dominio>` y nombre con `COOKIE_PREFIX` por entorno; secretos JWT distintos por entorno; nunca tokens en `localStorage`/`sessionStorage`. CORS con allowlist explícita y `credentials: true`; validación de `Origin` en peticiones mutantes.
- **Fuente:** decisión 58; CONTEXT §10; architecture §4.6, §8.1 y §8.2.
- **Verificación:** Heurística — `ERROR` por `res.cookie(` sin `httpOnly: true` cerca, tokens en `localStorage`/`sessionStorage` o CORS con `origin: '*'`/`origin: true`; `AVISO` por `sameSite: 'none'`.
- **Revisión manual:** uso de `COOKIE_PREFIX` y `COOKIE_DOMAIN` (vacío en `local`), secretos separados y validación de `Origin`.
- **Excepciones:** `localStorage` para preferencias no sensibles (por ejemplo, volumen de sonido). Las respuestas offline van en IndexedDB.

### G-B12 — Entornos y planes coherentes

- **Regla:** `staging` y la demo usan el combo gratuito y **no son aptos para clases reales**; `production` usa Workers Paid, Render Starter siempre activo y Neon Launch (scale-to-zero desactivado en horario de clase). Recursos y secretos separados por entorno.
- **Fuente:** decisiones 82 (e)–(g) y 86; CONTEXT §6 (Entornos y costes); architecture §11.1.
- **Verificación:** Heurística — `AVISO` si un servicio de `render.yaml` cuyo nombre contiene `prod` usa `plan: free`. El resto es **Manual**.
- **Excepciones:** ninguna.

### G-B13 — Ejecución segura de ffmpeg y validación de subidas a R2

- **Regla:** la ejecución de `ffmpeg` y `ffprobe` debe realizarse siempre con array de argumentos y `shell: false` (o `fluent-ffmpeg`), sin concatenar ni interpolar comandos en shell. Los archivos temporales deben residir en `os.tmpdir()` con nombres UUID generados por el servidor y borrarse obligatoriamente en un bloque `finally`. La transcodificación mantiene concurrencia serial de 1 tarea a la vez (G-B09). Las subidas a R2 se limitan a 10 MB y tipos MIME permitidos (`audio/webm`, `audio/mp4`, `audio/ogg`) validados al firmar en `POST /media/upload-url`, y al procesar `complete` el backend debe verificar por `HEAD` contra R2 que el objeto existe y su tamaño real no excede el límite antes de descargarlo para transcodificación.
- **Fuente:** decisiones 55, 64 y 84; architecture §3.5, §7.6 y §11.3.
- **Verificación:** Heurística — `AVISO` por llamadas a `exec(` que contengan `ffmpeg` o `ffprobe`. Revisión manual de la limpieza en `finally` y de la comprobación `HEAD` en el servicio de media.
- **Excepciones:** ninguna.

---

## C. Negocio, integridad y seguridad

### G-C01 — Idioma

- **Regla:** identificadores de código, tablas y columnas en inglés; documentación, comentarios de negocio y textos de interfaz en español. El contenido pedagógico es en inglés.
- **Fuente:** decisión 20; CONTEXT §16 (Idioma); architecture §13.
- **Verificación:** Heurística — `AVISO` por identificadores con tildes o `ñ`. Lo demás es **Manual** (textos de UI en español de Colombia; mensajes de error traducidos desde `code`).
- **Excepciones:** literales de texto (no identificadores).

### G-C02 — La nota se calcula siempre en el servidor

- **Regla:** cada scorer produce una fracción 0–1 y `ScoringService` la convierte a 0.0–5.0 con un decimal (`round(fraction × 5, 1)`). Ningún endpoint acepta un puntaje del alumno. Solo la revisión manual de la profesora (`open_question`, `speaking`) escribe `score`, y sobre un autocalificado se rechaza con `SCORE_NOT_EDITABLE`. `Review` nunca guarda nota. Umbral `passing_score` leído de `games.config` (3.0).
- **Fuente:** decisiones 24, 72 y 83 (b); CONTEXT §16; architecture §4.4.
- **Verificación:** Heurística — `ERROR` por `score` en DTOs o esquemas de entrada fuera del módulo de revisión; `AVISO` por escritura de `score` en `review.create/update/upsert`.
- **Revisión manual:** redondeo a un decimal, uso de `SCORE_OUT_OF_RANGE` y `SCORE_NOT_EDITABLE`, umbral leído de configuración y no fijado en código.
- **Excepciones:** el DTO de `POST /attempts/:id/review`.

### G-C03 — Los timestamps los asigna el servidor

- **Regla:** `started_at`, `finished_at`, `graded_at`, `occurred_at`, `joined_at`, `left_at`, `created_at` y equivalentes los fija NestJS (`new Date()`) o PostgreSQL (`now()`). Ningún DTO de entrada los declara; el `ValidationPipe` global usa `whitelist: true`. El campo `at` del contrato de actividad es interno del cliente y no viaja en los DTOs HTTP.
- **Fuente:** decisión 37 (34 §3); CONTEXT §10 y §16; architecture §4.4, §5.2, §6.2 y §8.1.
- **Verificación:** Heurística — `ERROR` por esos campos en `*.dto.ts` o en esquemas de API de `packages/shared`; `ERROR` por `new ValidationPipe(` sin `whitelist: true`; `AVISO` por un campo `at` en esquemas de API.
- **Excepciones:** plazos de negocio elegidos por la profesora: `opens_at`, `due_at` y `retry_extend_until` (se validan contra el reloj del servidor).

### G-C04 — `answer_key` nunca llega al alumno en tipos calificados

- **Regla:** `config` y `answer_key` en columnas separadas; Prisma Client omite `answer_key` por defecto (`omit` global); solo `ScoringService` y el editor de la profesora la seleccionan; `toPublicConfig()` la elimina antes de responder al alumno. En `game` la clave viaja de forma explícita (práctica de bajo riesgo; el servidor recalcula).
- **Fuente:** decisión 75; architecture §5.3 y §6.4; CONTEXT §16.
- **Verificación:** Heurística — `AVISO` por selección explícita de `answer_key`/`answerKey` fuera de archivos de scoring o editor; `AVISO` si se instancia `PrismaClient` sin `omit` de `answer_key` en ese archivo.
- **Excepciones:** scorers, editor de la profesora y servicio de `game`.

### G-C05 — Entidades y funciones eliminadas no vuelven

- **Regla:** no reintroducir `Guardian` (entidad, rol o módulo), `ConsentRecord`, `ConsentStatus`, `ConsentMethod`, consentimiento legal de menores, autenticación multifactor, pantallas de `admin` o `parent`, ni los flags `stats` o `leaderboard`.
- **Fuente:** decisiones 11, 34–36, 41 y 91; CONTEXT §2.4, §9 y §16.
- **Verificación:** Automática.
- **Excepciones:** `guardian_name`, `guardian_contact` (y sus formas camelCase) en `Student`; los valores reservados `parent` y `admin` del enum `Role`; el OTP de cambio de correo (`otp_hash`), que no es MFA.

### G-C06 — Nada del fuera de alcance del piloto

- **Regla:** no construir nada de CONTEXT §2.4: WebSockets o tiempo real (incluido SSE), heartbeat o detección de inactividad de pestaña, Capacitor o tiendas, muro social o sección de padres, Phaser, Educaplay embebido (iframe), pasarela de pagos, gestión de consentimiento. Tampoco analítica de terceros, píxeles ni publicidad en el portal del estudiante.
- **Fuente:** CONTEXT §2.4 y §9; decisiones 2, 9, 10, 12, 14 y 17.
- **Verificación:** Automática (`AVISO` para `visibilitychange`/heartbeat, que tienen usos legítimos).
- **Excepciones:** `visibilitychange` para pausar audio o animaciones, sin registrar actividad.

### G-C07 — Rutas de la API

- **Regla:** todo endpoint de negocio bajo `/api/v1`; solo `/health` y `/docs` en la raíz; `/docs` responde 404 en producción (`APP_ENV === 'production'`).
- **Fuente:** decisión 83 (a); architecture §13; SPEC-01 §5.
- **Verificación:** Heurística — `AVISO` si `main.ts` de la API no llama a `setGlobalPrefix('api/v1'…)`, si lo hace sin excluir `health` y `docs`, si `SwaggerModule.setup` no depende de `APP_ENV`, o si un controlador repite el prefijo (`@Controller('api/…')`).
- **Excepciones:** ninguna.

### G-C08 — Zona horaria `America/Bogota`

- **Regla:** las tareas programadas se definen en `America/Bogota`; el frontend muestra fechas en esa zona; la API y la base de datos guardan UTC.
- **Fuente:** decisión 67 (no adopta su §15: zona fija); architecture §4.5, §9.3 y §13.
- **Verificación:** Automática — `ERROR` por `@Cron(` sin `timeZone: 'America/Bogota'`; `AVISO` por otra zona IANA en el código.
- **Excepciones:** pruebas que fijan otra zona a propósito.

### G-C09 — Tareas periódicas idempotentes con `ScheduledJobRun`

- **Regla:** toda tarea periódica registra su ejecución en `ScheduledJobRun` (único por organización, tarea y periodo) y es idempotente ante reinicios y despliegues solapados.
- **Fuente:** decisiones 64 y 76; architecture §4.5; CONTEXT §16.
- **Verificación:** Heurística — `AVISO` si un archivo con `@Cron(` no referencia `ScheduledJobRun`/`scheduledJobRun` (ni un servicio con `JobRun` en el nombre).
- **Excepciones:** las tareas disparadas (transcodificación y recuperación) se apoyan en `MediaAsset.transcode_attempts`/`transcode_failed_at`, no en esta tabla.

### G-C10 — Sin datos personales en logs ni en errores

- **Regla:** ningún log ni reporte de error incluye nombre, correo, respuestas, audio, contraseña ni tokens; solo identificadores. Los errores al cliente son `{ statusCode, code, message }` sin detalles técnicos. Sentry con `sendDefaultPii: false`. La auditoría va a `AuditLog`, no al log.
- **Fuente:** CONTEXT §9; architecture §4.6, §8.5, §12 y §13; decisión 51 (34 §17).
- **Verificación:** Heurística — `AVISO` por llamadas de log con `email`, `password`, `token`, `body` o `answers`; `AVISO` por `console.log` en `apps/api/src`; `ERROR` por `sendDefaultPii: true`; `AVISO` si una respuesta de error incluye `stack`.
- **Excepciones:** nombres de variable que contienen la palabra sin registrar su valor (confírmalo leyendo la línea).

### G-C11 — Secretos solo en variables de entorno

- **Regla:** ningún secreto en el repositorio; `.env.example` sin valores reales; nada secreto con prefijo `NEXT_PUBLIC_` (va al bundle web).
- **Fuente:** CONTEXT §10; architecture §4.6 y §8.1; SPEC-01 §5.
- **Verificación:** Automática — archivos `.env` versionados (salvo `.env.example`), claves privadas PEM, cadenas de conexión con contraseña, claves con forma de secreto (`sk_live_…`, `re_…` de Resend) y variables `NEXT_PUBLIC_*` con `SECRET`, `PRIVATE`, `PASSWORD`, `DATABASE` o `R2_SECRET`.
- **Excepciones:** credenciales evidentes de desarrollo local en `docker-compose.yml` (por ejemplo, `postgres:postgres@localhost`).

### G-C12 — Tipado estricto y validación en dos niveles

- **Regla:** prohibido el uso de `any`, `@ts-ignore`, `@ts-nocheck` y aserciones inseguras (`as Type`) en código de producción; usar `unknown` junto con *type narrowing* (`typeof`, `in`, `instanceof`) o esquemas Zod (`schema.parse()` / `schema.safeParse()`). Validación en dos niveles estricta: `class-validator` valida exclusivamente la envoltura HTTP en `apps/api` (`ValidationPipe` global con `whitelist: true` y `transform: true`, sin `forbidNonWhitelisted: true` para ignorar campos desconocidos como timestamps según A71); `Zod` (`packages/shared`) valida exclusivamente la configuración y respuestas por tipo de actividad (`ZodValidationPipe`). Los tipos y contratos compartidos residen como fuente única en `packages/shared` y nunca se duplican entre aplicaciones.
- **Fuente:** decisión 20; architecture §2, §4.2 (A5), §4.4 (A71) y §13; SPEC-01 RF-1 y RF-13; CONTEXT §16.
- **Verificación:** Automática — `ERROR` por `as any`, `: any`, `@ts-ignore` o `@ts-nocheck` en archivos de código de runtime de `apps/` y `packages/shared/`.
- **Excepciones:** archivos de prueba (`*.spec.ts`, `*.test.ts`, fixtures) o mocks explícitos.

### G-C13 — Higiene en dispositivos compartidos, PWA y enlaces seguros

- **Regla:** al cerrar sesión (`logout`) o cambiar de alumno en el cliente web, se debe vaciar obligatoriamente la caché de TanStack Query y las colecciones locales de IndexedDB (`pendingEvents`, `pendingUploads`) para evitar fuga de información entre alumnos que comparten la misma tablet o equipo. El Service Worker (Serwist) jamás debe cachear respuestas autenticadas de `/api/v1/*`. Toda URL externa en `ExternalResource` debe validar protocolo `https:` estricto (bloqueando `javascript:`, `data:`, `http:`) y abrirse con `rel="noopener noreferrer" target="_blank"`. Queda prohibido el uso de `dangerouslySetInnerHTML` para renderizar consignas pedagógicas, respuestas o comentarios de retroalimentación.
- **Fuente:** decisiones 20 y 51; CONTEXT §5.2 y §9; architecture §7.6, §8.5, §10.1 y §10.2; SPEC-01 RF-15.
- **Verificación:** Automática — `AVISO` por `dangerouslySetInnerHTML` en componentes de `apps/web`. Revisión manual para vaciado de IndexedDB/QueryClient en logout y validación de URLs en `ExternalResource`.
- **Excepciones:** ninguna.

---

## Mantenimiento del catálogo

- Si CONTEXT §14 añade o cambia una decisión que afecta a una regla, actualiza la regla, el script (`scripts/check-guardrails.mjs`) y ejecuta `node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --self-check`.
- Los ID son estables: una regla retirada se marca **Retirada** con la decisión que la retira; no se reutiliza su ID.
