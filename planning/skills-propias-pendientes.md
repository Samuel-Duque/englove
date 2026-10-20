# Englove — Skills propias pendientes de crear

> Estado: **2 de 5 creadas.** `englove-spec` se creó el 2026-10-08 (tarea DOC-07 del taskboard) y `englove-guardrails` el 2026-10-19 (tarea DOC-08); las otras tres siguen como ideas aprobadas, todavía no creadas (decisión del equipo: se crearán en sus hitos correspondientes).
> Origen: análisis de skills del proyecto (octubre 2026). No se encontró ninguna skill pública confiable para este dominio y reglas de negocio específicas, por eso se proponen propias.
> Actualización técnica (2026-10-19): adaptado a las decisiones 81 a 92 de `CONTEXT.md` §14 y `planning/architecture-overview.md` §11 (despliegue en Cloudflare Workers mediante `vinext` para frontend, backend en Render con instancia única y cola serial, almacenamiento en Cloudflare R2, motor SQL exclusivo PostgreSQL 18 en Neon en sustitución de Supabase, y validación superada del PoC ENG-140).
> Herramienta recomendada para crearlas: la skill `skill-creator` (ya instalada en `.agents/skills/`).

---

## Cuándo crearlas

| Skill propia | Prioridad | Momento recomendado | Estado |
|---|---|---|---|
| `englove-spec` | alta | Antes de redactar las specs `SPEC-00` a `SPEC-10` (Etapa 0 / inicio de Etapa 1) | **Creada** 2026-10-08 (DOC-07) |
| `englove-guardrails` | alta | Antes de escribir el primer código de producción (Etapa 1 / inicio de Etapa 2) | **Creada** 2026-10-19 (DOC-08) |
| `englove-activity-type` | media | Cuando exista `packages/shared` y la primera actividad implementada | Pendiente |
| `englove-kids-ux` | media | Cuando empiece el frontend (tokens de tema Kids/Teens) | Pendiente |
| `englove-cefr-content` | baja | Cuando se necesiten seeds de contenido (incongruencia #16: seeds de datos operativos) | Pendiente |

---

## Convenciones al crearlas

- Carpeta fuente: `.agents/skills/<nombre>/SKILL.md`.
- **Sincronización multi-agente obligatoria:** en este repositorio `.claude/skills/` y `.kiro/skills/` son copias versionadas (no enlaces simbólicos). Al crear o modificar una skill propia:
  1. Copiar la carpeta completa a `.claude/skills/<nombre>/` y `.kiro/skills/<nombre>/`.
  2. Registrarla en `skills-lock.json` con `"source": "./.agents/skills/<nombre>"`, `"sourceType": "local"` y `computedHash` (SHA-256 de la carpeta calculado por el CLI de skills).
- **Idioma:** instrucciones de las skills en español (igual que toda la documentación del proyecto); identificadores de código en inglés.
- **Principio de no duplicación:** las skills deben **referenciar** `.agents/CONTEXT.md` y `planning/` en lugar de copiar su contenido, previniendo desincronizaciones cuando la arquitectura evolucione.
- **Activación precisa:** mantener el `description` del frontmatter muy concreto (cuándo y por qué usarla), para que el agente la active en el momento exacto.

---

## Relación con skills públicas instaladas y delimitación

El repositorio cuenta con skills públicas instaladas en `.agents/skills/`. Su interacción con el stack definido en `planning/architecture-overview.md` se delimita así:

- **`render-deploy` y `render-docker`:** se usan para la configuración del Web Service en Render (`apps/api`), el Dockerfile multi-etapa con `ffmpeg`/`ffprobe` y el aprovisionamiento de variables de entorno.
- **`ci-cd-and-automation`:** se usa para estructurar los flujos de GitHub Actions (checks de PR, despliegue con Wrangler a Cloudflare Workers, despliegue a Render y ejecución de `prisma migrate deploy` contra Neon).
- **`prisma-cli` y `prisma-client-api`:** se usan para la gestión del ORM (modelos, migraciones y extensiones de tenant en Prisma 7).
- **`supabase-postgres-best-practices` (Aviso crítico de alcance):** se conserva en el proyecto exclusivamente por sus buenas prácticas de diseño relacional, indexación, planes de consulta y optimización SQL para PostgreSQL genérico. **Englove no utiliza Supabase como proveedor de base de datos** (sustituido por Neon según decisión 82). Queda estrictamente prohibido aplicar recomendaciones de esa skill que involucren Supabase Auth, Supabase Storage, Edge Functions o RLS como mecanismo de autorización de negocio.

---

## 1. `englove-spec`

> **Estado: creada el 2026-10-08** (tarea DOC-07 del taskboard). Vive en `.agents/skills/englove-spec/`, con copias en `.claude/skills/` y `.kiro/skills/`, y está registrada en `skills-lock.json` como skill local. Contenido:
>
> - `SKILL.md`: reglas de oro (jerarquía, sin código sin spec Aprobada, el agente redacta y el líder aprueba, enlazar en vez de copiar), fuentes que leer y cuatro modos: **Arranque (SPEC-00)**, **Redactar**, **Revisar** y **Actualizar** (estados y transiciones de `sdd-process.md` §6), con el cierre del cambio (`specs/README.md`, taskboard, CONTEXT) y el informe final.
> - `references/guia-de-secciones.md`: cómo rellenar en Englove la cabecera y cada una de las 12 secciones de la plantilla.
> - `references/validacion.md`: lista de comprobación contra CONTEXT §14, §2.4, §15 y §16, y formato del informe de revisión.
> - `scripts/check-spec.mjs`: verificación estructural sin dependencias (`node .agents/skills/englove-spec/scripts/check-spec.mjs specs/SPEC-NN-nombre.md`). Lee en cada ejecución la plantilla de `sdd-process.md` §5, los pendientes de CONTEXT §15 y el taskboard. Comprueba secciones, cabecera y estado, texto de plantilla sin reemplazar, RF con Dado/Cuando/Entonces, RF sin prueba, P-n asignados, tareas `ENG` cubiertas, tamaño, índice y señales de alarma (términos eliminados o fuera de alcance).
>
> Prueba y evolución: validada inicialmente con un borrador de SPEC-01. Actualizada tras el PoC ENG-140 (decisiones 81–92) para verificar que las specs reflejen Cloudflare Workers con `vinext`, Neon como motor SQL y el cierre formal de P-1 a P-5.

**Qué hace:** redactar, revisar o actualizar una especificación `SPEC-NN` siguiendo el proceso SDD del proyecto.

**Fuentes que debe leer:**
- `planning/sdd-process.md` §5 (plantilla de 12 secciones), §6 (ciclo de vida), §9 (reglas para agentes) y §10 (anti-patrones).
- `.agents/CONTEXT.md` §14 (decisiones 1–92), §2.4 (fuera de alcance del piloto), §15 (pendientes) y §16 (convenciones).
- `planning/architecture-overview.md` §1, §3.8, §4, §6, §8 y §11 (topología y stack decididos).

**Comportamiento esperado:**
1. Crear o actualizar el archivo con las 12 secciones de la plantilla oficial.
2. Validar que no contradiga ninguna decisión de CONTEXT §14 (especialmente: Neon como Postgres, Cloudflare Workers mediante `vinext`, Render con instancia única, Cloudflare R2 para almacenamiento, sin Supabase ni Vercel).
3. Asegurar que no incluya ningún elemento de la lista fuera de alcance del piloto (§2.4).
4. Mantener la jerarquía de autoridad: CONTEXT → architecture-overview → sdd-process → pbp-development → taskboard → specs → código.
5. Recordar que ningún código de producción se escribe sin spec aprobada.

**Relación con otras skills:** complementa a `grill-me` (entrevista previa) y a `code-review` (verificar contra la spec).

---

## 2. `englove-guardrails`

> **Estado: creada el 2026-10-19** (tarea DOC-08 del taskboard). Vive en `.agents/skills/englove-guardrails/`, con copias en `.claude/skills/` y `.kiro/skills/`, y está registrada en `skills-lock.json` como skill local. Contenido:
>
> - `SKILL.md`: reglas de oro (jerarquía, compuerta SDD previa al código, evidencia antes de afirmar cumplimiento, enlazar en vez de copiar y delimitación frente a `supabase-postgres-best-practices`), fuentes que consultar, modos de uso (Preventivo, Cambios locales, Rama/PR, Auditoría y Mantenimiento), procedimiento en 5 pasos, gestión de supresiones justificadas (`guardrails-ignore G-XNN: motivo`) y plantilla obligatoria del informe estructurado.
> - `references/reglas.md`: catálogo explicativo de las 33 reglas invariantes (`G-A01`–`G-A10`, `G-B01`–`G-B12`, `G-C01`–`G-C11`), con su fuente normativa, modo de verificación (`Automática`, `Heurística`, `Manual`) y excepciones legítimas.
> - `scripts/check-guardrails.mjs`: escáner estático sin dependencias (`node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs [--base REF | --all | RUTAS...] [--json] [--self-check]`). Lee en cada ejecución la matriz de tablas de tenant de `architecture-overview.md` §6.2, las tablas de detalle de `CONTEXT.md` §7.2, las decisiones de `CONTEXT.md` §14 y la tabla de fuera de alcance de `CONTEXT.md` §2.4. Incluye `--self-check` para verificar que el catálogo y el script permanezcan sincronizados.

**Qué hace:** lista de verificación automatizada e interactiva de las reglas invariantes del proyecto (`.agents/CONTEXT.md` §16 y `planning/architecture-overview.md`). Se usa de forma mandatoria junto con `code-review` y `security-review` antes de aprobar PRs o cerrar tareas en el taskboard.

**Reglas organizadas que debe comprobar:**

### A. Motor SQL y Persistencia (Neon & Prisma)
- **PostgreSQL 18 en Neon como motor SQL exclusivo (decisión 82):**
  - Prohibido reintroducir clientes, librerías, referencias o configuración de Supabase (ni Auth, ni Realtime, ni RLS, ni Storage).
  - Doble cadena de conexión en Prisma: `DATABASE_URL` conectada al pooler de Neon (PgBouncer, host `-pooler` con `connection_limit`) para el runtime de la API; `MIGRATION_DATABASE_URL` conectada directamente a Neon, reservada exclusivamente para `prisma migrate deploy` en CI (architecture §11.4).
  - `prisma db push` estrictamente prohibido fuera del entorno `local` (las migraciones en CI/staging/producción usan siempre `prisma migrate deploy`).
  - La autorización de acceso a datos vive en NestJS (Guards, `TenantContext`, decoradores RBAC); **no en RLS de Postgres**.
  - Multi-tenant explícito: toda tabla de tenant incluye la columna `organization_id` directa (decisión 89; no depender de joins para inferir el tenant) y toda consulta de tenant filtra por `organization_id` (extensión de Prisma Client + filtro explícito en servicios, architecture §4.3).

### B. Entornos de Despliegue y Hosting (Cloudflare Workers, Render, Cloudflare R2)
- **Frontend (`apps/web`) en Cloudflare Workers (decisiones 85 y 87):**
  - Despliegue empaquetado exclusivamente como Worker mediante Wrangler y el adaptador `vinext`. Cloudflare Pages y Vercel quedan fuera de la topología de producción.
  - Intercepción de rutas mediante **`proxy.ts`** (export `proxy` en runtime Node.js; prohibido `middleware.ts` y el runtime Edge; decisiones 81 y 88).
  - `proxy.ts` solo inspecciona presencia de cookie / claim de rol para redirigir entre grupos de rutas o intentar refresco silencioso; **nunca decide autorización de negocio** (decisión 58).
  - Caché explícito con la directiva `use cache` y `cacheComponents: true` (Next.js 16); prohibido cachear respuestas o datos autenticados (architecture §3.8).
  - Arrastrar y soltar implementado con `@atlaskit/pragmatic-drag-and-drop` (prohibido `@dnd-kit`, decisión 81).
  - Límite de tamaño de Worker comprimido: <= 3 MB en Workers Free (staging/demo), <= 10 MB en Workers Paid (producción).
- **Backend (`apps/api`) en Render (decisión 64 intacta):**
  - Web Service Docker desde `apps/api`. La imagen Docker incluye obligatoriamente `ffmpeg` y `ffprobe` (architecture §11.3).
  - **Una sola instancia activa**: prohibido el autoescalado o múltiples instancias en Render. La API mantiene estado en memoria (cola serial de transcodificación, contadores de rate limiting en memoria `@nestjs/throttler`, y cron jobs de `@nestjs/schedule` que se duplicarían).
  - Cola de transcodificación **serial** (1 tarea a la vez en los 512 MB de Render Starter) con rutina de recuperación al arrancar (máx 3 intentos en `transcode_attempts`, luego `transcode_failed_at` y fallback definitivo al audio raw original, decisiones 64 y 84).
- **Archivos en Cloudflare R2:**
  - Almacenamiento en buckets privados de Cloudflare R2 vía S3 API (`@aws-sdk/client-s3`). Prohibido Supabase Storage o almacenamiento en disco local del servidor.
  - Subida directa con URLs prefirmadas (el stream de audio no pasa por la API de Render para proteger el ancho de banda del plan).
- **Topología de red y cookies:**
  - Cookies de sesión `httpOnly` con `Domain=.<dominio>`, prefijo diferenciado por entorno (`COOKIE_PREFIX`) y secretos JWT separados entre staging y producción. Subdominios `app.<dominio>` y `api.<dominio>`.
- **Diferenciación por entornos:**
  - Staging y demo en combo gratuito ($0; advertencia: no apto para clases reales por suspensión de Neon y Render).
  - Producción (piloto) en planes mínimos de pago (~$16–19/mes: Cloudflare Workers Paid, Render Starter siempre activo, Neon Launch con scale-to-zero desactivado en horario de clases).

### C. Reglas de Negocio, Integridad y Seguridad
- Identificadores de código en inglés; documentación, comentarios de negocio y textos de UI en español.
- Toda calificación se calcula **siempre en el servidor**, en escala colombiana 0.0–5.0 con un decimal (umbral `passing_score = 3.0`); columna única `Attempt.score` (con restricción `CHECK`); `Review` aporta únicamente feedback cualitativo (decisión 72).
- Los timestamps (`started_at`, `finished_at`, `graded_at`, `occurred_at`) los asigna siempre el servidor; `whitelist: true` en el `ValidationPipe` descarta cualquier timestamp enviado por el cliente.
- Separación de `config` y `answer_key` en columnas separadas de las tablas de detalle; la clave de respuestas nunca viaja al alumno en tipos calificados (`omit` global en Prisma Client).
- No reintroducir `Guardian`, `ConsentRecord`, autenticación multifactor ni pantallas de `admin` o `parent`.
- No construir nada del fuera de alcance del piloto (CONTEXT §2.4: WebSockets, heartbeat, Capacitor, muro social, Phaser, pagos, etc.).
- Rutas de API: todo endpoint de negocio bajo el prefijo `/api/v1`; excepciones exclusivas en la raíz para `/health` y `/docs` (`/docs` responde 404 en producción, decisión 83).
- Zona horaria de referencia `America/Bogota` para cron jobs y visualización.

**Salida esperada:** informe estructurado de cumplimiento/incumplimiento señalando archivo, número de línea y regla infringida.

---

## 3. `englove-activity-type`

**Qué haría:** guiar el recorrido de desarrollo completo para añadir o modificar un tipo de actividad pedagógica o una mecánica de juego.

**Contexto del dominio:**
- Tipos de actividad: `fill_blank`, `open_question`, `speaking`, `game`, `exam`.
- Mecánicas de `game`: `match`, `order_words`, `drag_drop`, `memory`, `timed_choice`.
- Eje central de datos: `Activity` (plantilla) → `Assignment` (a un grupo) → `Attempt` (intento del alumno).
- Cada tipo tiene tabla de detalle 1:1, con `organization_id` directo y columnas separadas para `config` y `answer_key`.

**Pasos que debe cubrir:**
1. Esquema Zod en `packages/shared` (el `answer_key` nunca se expone en contratos que lleguen al alumno).
2. Tabla de detalle en Prisma + migración aplicada con Prisma Migrate (`MIGRATION_DATABASE_URL` contra Neon).
3. DTO (class-validator), servicio y scorer en NestJS (cálculo de fracción de acierto convertida a escala 0.0–5.0 en servidor).
4. Componente de actividad para los temas Kids y Teens en Next.js 16 (consumiendo `useAttempt()`, detrás del contrato de actividad, con `@atlaskit/pragmatic-drag-and-drop` para microjuegos de arrastre).
5. Revisión de la profesora (cola manual, comentarios, stickers) si el tipo lo requiere.
6. Seeds de prueba y suite de tests (unitarios de scorer, integración de endpoints y E2E de intento).
7. Actualizar el contrato de API en la spec correspondiente de `specs/`.

---

## 4. `englove-kids-ux`

**Qué haría:** verificar y aplicar las reglas de diseño y experiencia de usuario (UX) para las dos audiencias del producto (Kids y Teens).

**Cubre:**
- Tokens de diseño por tema (`data-theme="kids"` / `"teens"`) y cómo los bundles de animación se cargan dinámicamente con `next/dynamic` según el tema activo.
- Reglas por edad: Kids (7–10) bloqueado en su interfaz lúdica; Teens (11+) puede alternar tema desde el perfil si `can_switch_interface = true`.
- Ergonomía táctil: zonas táctiles grandes, nivel de lectura adaptado, mensajes breves, retroalimentación positiva e inmediata.
- Celebraciones (`canvas-confetti`), efectos de sonido (Howler.js), animación con Framer Motion y respeto riguroso de `prefers-reduced-motion`.
- Microjuegos de arrastrar y soltar con `@atlaskit/pragmatic-drag-and-drop` optimizados para tablets táctiles.
- Contraste WCAG 2.2 nivel AA (auditado con axe-core en CI).
- Síntesis de voz con Web Speech API (`en-US` y `es-CO`).
- Textos de interfaz en español de Colombia con tono cercano, cálido y motivador.

**Se apoya en:** `frontend-design`, `accessibility`, `animate` y `web-design-guidelines`.

---

## 5. `englove-cefr-content`

**Qué haría:** generar o validar contenido de actividades alineado a los niveles A1, A2, B1 y B2 del MCER (Marco Común Europeo de Referencia), pedagógicamente apropiado para niños de 7 a 14 años.

**Detalles:**
- La salida debe ser JSON estrictamente válido según los esquemas Zod de `packages/shared`.
- Vocabulario y estructuras gramaticales acordes al nivel y edad, con temáticas cotidianas y motivadoras.
- Generación de scripts de seeds de prueba para Neon (incongruencia #16 de `planning/incongruencias-y-decisiones-definitivas.md`).
- Asistente de desarrollo: no sustituye la labor pedagógica de la profesora (el contenido curricular real del piloto lo crea y gestiona ella desde el panel).
- No introduce llamadas a modelos de IA en tiempo de ejecución del producto (el producto no usa APIs de IA para evaluar alumnos; la generación es puramente offline para pruebas y seeds).

---

## Ideas descartadas o cubiertas por herramientas existentes

- **Skill propia para despliegue / infraestructura (`englove-deploy`):** descartada. La topología técnica ya está automatizada con Wrangler (`apps/web` a Cloudflare Workers con `vinext`), Docker en Render (`apps/api`) y Prisma Migrate en GitHub Actions. La verificación de invariantes de hosting y base de datos se delega a `englove-guardrails`, mientras que las skills públicas `render-deploy`, `render-docker` y `ci-cd-and-automation` ofrecen soporte suficiente para la configuración de proveedores.
- **Skill propia para el pipeline de audio (`MediaRecorder` → R2 → `ffmpeg`):** descartada. El flujo está completamente documentado y acotado en `planning/architecture-overview.md` §3.5 y en SPEC-05; `englove-guardrails` vigila que no se alteren la cola serial, la rutina de recuperación ni la subida directa a R2. Reconsiderar únicamente si la transcodificación genera fallos reiterados en producción.
- **Skills de fase 2:** Phaser (juegos avanzados) y Capacitor (aplicaciones móviles nativas). Existen skills públicas del ecosistema (`phaserjs/phaser`, `capawesome-team/skills`) que se evaluarán cuando comience esa fase.
