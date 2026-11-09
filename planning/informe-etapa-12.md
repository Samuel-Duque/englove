# Informe de Remediación y Verificación — Etapa 12 (Calidad y Remediación)

> **Propósito:** Registrar formalmente la ejecución, validación y cierre de la **Etapa 12 «Calidad y remediación»** conforme a [SPEC-11](../specs/SPEC-11-calidad-y-correcciones.md), las decisiones 127 a 137 de [CONTEXT §14](../.agents/CONTEXT.md#14-registro-de-decisiones-arquitectónicas-y-de-producto), la resolución de [plan-remediacion-etapa-12.md](plan-remediacion-etapa-12.md), [AUDITORIA.md](../AUDITORIA.md) y [testing-issues/](../testing-issues/README.md) (incluyendo ISSUE-10), cubriendo las tareas ENG-143, ENG-150 a ENG-162 y DOC-09.  
> **Fecha de ejecución:** 2026-11-08  
> **Veredicto general:** **CUMPLIDA (100% VERIFICADA TRAS REMEDIACIÓN INTEGRAL)**. Las 15 especificaciones funcionales (RF-1 a RF-15) de SPEC-11 y los hallazgos de pruebas dinámicas han sido remediados y verificados con 566 pruebas automatizadas en verde, 0 errores en guardrails y compuertas de tipado, linting y compilación superadas.

---

## 1. Resumen Ejecutivo

La Etapa 12 corrigió todas las brechas de persistencia, seguridad, concurrencia, audio, accesibilidad y alineación descubiertas en la auditoría del `2026-11-05`, en las pruebas del `2026-11-06`, y en la verificación a posteriori registrada en `planning/plan-remediacion-etapa-12.md` e `ISSUE-10`.

Bajo la **decisión 127**, se respetó la regla de cero funcionalidades nuevas, con la única excepción acordada por el líder en la **decisión 137** (`ENG-162`): el ranking de juegos privado de la profesora y el panel «Práctica en juegos», con separación tajante entre notas académicas (`0.0–5.0`) y estrellas/puntos lúdicos.

Adicionalmente, se ejecutó la remediación completa de las 6 brechas técnicas detectadas a posteriori:
1. **Brecha 1 (Service Worker y Precache):** Implementación de Serwist con inyección de manifiesto de precache de Vite para activos estáticos versionados y `/offline`, garantizando la exclusión estricta de HTML autenticado, RSC, endpoints `/api/v1/*` y URLs prefirmadas de R2 (Decisiones 116 y 117).
2. **Brecha 2 (RSC en 18 rutas `page.tsx`):** Desacoplamiento de las 18 rutas en componentes cliente (`*-client.tsx`) manteniendo cada `page.tsx` como Server Component puro con metadatos descriptivos `<title>` y exportación limpia para Cloudflare Workers con `vinext` (Regla `G-B04`).
3. **Brecha 3 (Eliminación de `alert` y `confirm`):** Erradicación total de llamadas bloqueantes de navegador (`window.alert` y `window.confirm`), reemplazadas por modales accesibles y banners de alerta `role="alert"`.
4. **Brecha 4 (Accesibilidad WCAG 2.2 AA):** Corrección de controles interactivos anidados (`MatchGame`, `DragDropGame`), contraste mínimo de 4.5:1 en tema Teens, trampas de foco y tecla Escape en modales, botón TTS de lectura de enunciados para niños (Kids) y SkipLink en el layout raíz.
5. **Brecha 5 (Plantillas de correo y recordatorios):** Inyección de URL base absoluta en plantillas de correo para docentes y saneamiento en `maintenance.service.ts` eliminando el registro de `done` cuando no hay pendientes para evitar el bloqueo espurio de 3 días en recordatorios.
6. **Brecha 6 (Streaming en transcodificación S3/R2):** Conexión directa mediante `stream/promises.pipeline` para evitar cargar audios completos en RAM en Render Starter (512 MB).
7. **ISSUE-10 (Bypass de tenant en endpoints públicos de auth):** Uso controlado de `TenantContext.runBypass` en `AuthService` para búsquedas y revocaciones previas a autenticación (`login`, `refresh` para `AuthSession.findFirst` y `User.findUnique`, `signup`, `forgotPassword`) evitando el error 500 originado por la extensión de tenant de Prisma.

---

## 2. Matriz de Remediación de Hallazgos y Tareas

| Tarea | Hallazgos cubiertos | Estado | Verificación |
|---|---|---|---|
| **ENG-150** | `ISSUE-05`, `ISSUE-07`, auditoría §1.1 | **Hecho** | Microjuegos autónomos sin `Assignment` (`Attempt.assignment_id = null`, `activity_id != null`), migración de descarte en Docker PostgreSQL, rechazo con `422 GAME_ASSIGNMENT_NOT_ALLOWED` en `POST /assignments`, endpoints `GET /me/games` y `POST /activities/:id/attempts` verificados en `e2e-microgames-flow.spec.ts`. |
| **ENG-151** | `SEC-01`, `SEC-04`, `SEC-05`, `SEC-08`, `SEC-09c`, `SEC-09f`, `ISSUE-10` | **Hecho** | Validación estricta de `JWT_SECRET`, tokens con `typ: 'access' \| 'attempt'`, logout con verificación criptográfica, OTP atómico con límite de tasa por usuario, prefijo `${COOKIE_PREFIX}` uniforme, saneamiento de `next` en `/login`, y `TenantContext.runBypass` para lookups públicos de autenticación. |
| **ENG-152** | `SEC-09a`, `SEC-09d`, `G-A06`, `G-A11` | **Hecho** | `TenantPrismaExtension` cubre `aggregate`, `groupBy` y `findFirstOrThrow` con filtro cerrado por `organization_id`; `SELECT ... FOR UPDATE` o bloqueo condicional en `completeAttempt`, `submitReview`, `failed_login_count` y `rejectStudent`. |
| **ENG-153** | `SEC-07`, `SEC-09b`, `G-A03` | **Hecho** | Pool de conexiones `pg.Pool(max: 5)`, límite de body `1mb` con `bodyParser: false`, `SubmitEventsDto` con `@ArrayMaxSize(50)` y cota FIFO de 500 eventos, barrido de claves expiradas en `RateLimiterService`, índices parciales y `CHECK` en `schema.spec.ts`. |
| **ENG-154** | `SEC-03`, `SEC-06`, `G-B13`, `G-C08`, `ISSUE-01`, Brecha 6 | **Hecho** | Validación de `ContentLength` con `HeadObjectCommand` (máximo 10 MB), descarga por streaming directo con `pipeline` a disco, `ffprobe` para medición de duración de audio, eliminación de endpoints mock, cabeceras CORP para streaming. |
| **ENG-155** | `SEC-02`, `G-C13`, `ISSUE-04`, `ISSUE-05`, `ISSUE-08`, `ISSUE-09`, Brecha 1 | **Hecho** | Higiene de IndexedDB en logout en tablets compartidas (`deleteDatabase`, purga de entradas ajenas), cola offline robusta ante fallos de subida, Service Worker real con Serwist y precache estricto de assets y `/offline`. |
| **ENG-156** | `ISSUE-02`, `ISSUE-03`, `ISSUE-06`, `RFC-01`, Brecha 5, decisiones 131 y 132 | **Hecho** | `open_question` multi-pregunta con compatibilidad `activity.id` y `question.id`, advertencia de pérdida de nuevo intento en `PUT /students/:id/group`, mensajes motivadores de estrellas por segmento en Kids y Teens, ruta `/terminos`, y URLs absolutas en correos. |
| **ENG-157** | Presupuesto de latencia SPEC-08 RF-4 | **Hecho** | Agrupación optimizada con `_max.occurred_at`, `calculateStreak` por lotes, eliminación de consultas N+1, latencia < 500 ms con `seed-volume.ts` verificada en `stats.performance.spec.ts`. |
| **ENG-158** | `G-C12`, `SEC-09f` | **Hecho** | Sustitución de `as any` y aserciones no tipadas por esquemas Zod y tipado estricto, retiro de dependencias huérfanas, actualización de `KNOWN_MAX_DECISION = 137` en `check-guardrails.mjs`. |
| **ENG-143** | Migración RSC y TanStack Query (`G-B04`), Brecha 2 | **Hecho** | Arquitectura Server Components en las 30 páginas de la aplicación; desacoplamiento de las 18 páginas cliente en componentes `*-client.tsx` dedicados; metadatos descriptivos `<title>` por ruta en servidor sin `'use client'` superfluo. |
| **ENG-159** | Accesibilidad WCAG 2.2 AA (decisión 133), Brechas 3 y 4 | **Hecho** | Contraste >= 4.5:1 en texto y >= 3:1 en controles en tema `teens`, desanidación de botones interactivos, anuncios `aria-live` en juegos, tamaño táctil >= 48x48 px, enlaces `SkipLink`, botón TTS en `GameRenderer`, y eliminación total de `alert`/`confirm`. |
| **ENG-160** | Entorno local reproducible (decisión 134) | **Hecho** | `docker-compose.yml` con PostgreSQL 18, MinIO auto-inicializado con bucket `englove-dev` y Mailpit SMTP, sincronizado con `.env.example`. |
| **ENG-161** | Regresión y cierre de etapa | **Hecho** | 566 pruebas en verde en monorepo, 0 errores en guardrails, typecheck y linter limpios en los 4 paquetes. |
| **ENG-162** | Ranking de juegos y panel «Práctica en juegos» (decisión 137) | **Hecho** | Exclusión de `game` de promedios académicos, panel docente «Práctica en juegos» con tiempo recortado `3x` y sesiones `1..N`, y ranking privado docente por puntos de estrellas (máximo 5 mejores partidas por juego). |
| **DOC-09** | Alineación documental y de skills | **Hecho** | Sincronización completa de `AGENTS.md`, `README.md`, `CONTEXT.md`, `architecture-overview.md`, `taskboard.md`, `specs/SPEC-06-microjuegos.md`, `specs/SPEC-08-estadisticas.md`, `specs/SPEC-11-calidad-y-correcciones.md`, `testing-issues/ISSUE-10-auth-endpoints-500-tenant-extension-bypass.md` y las tres copias de skills (`.agents`, `.claude`, `.kiro`). |

---

## 3. Evidencia de Verificación Técnica

### 3.1. Pruebas Automatizadas Monorepo (`pnpm test`)
- **Total de pruebas ejecutadas:** 566 tests
- **Resultado:** **566 passed (100% exitoso)**
- **Desglose por paquete:**
  - `@englove/shared`: 4 test files, 65 tests passed
  - `@englove/web`: 15 test files, 148 tests passed
  - `@englove/api`: 36 test files, 353 tests passed (incluyendo pruebas concurrentes reales en PostgreSQL Docker, suite de tenant bypass para ISSUE-10, suite de leaderboard/práctica, E2E flows y pruebas de rendimiento)

### 3.2. Verificación Estática y Guardrails
- **`pnpm typecheck`:** 4/4 proyectos tipados sin errores (0 errors).
- **`pnpm lint`:** 0 errores, 0 avisos en `@englove/shared`, `@englove/web` y `@englove/api`.
- **`pnpm build`:** Compilación exitosa para API (NestJS) y Web (Vite / vinext Cloudflare Workers).
- **`check-guardrails.mjs --all`:** 309 archivos evaluados, **0 errores**, 37 excepciones justificadas por diseño y documentadas con `guardrails-ignore`.
- **`check-spec.mjs specs/SPEC-11-calidad-y-correcciones.md`:** 0 errores, estructura conforme a `sdd-process.md §5`.

---

## 4. Estado de las Compuertas y Siguientes Pasos

1. **Compuerta de Calidad (Etapa 12):** **CUMPLIDA Y CERRADA**.
2. **Desbloqueo de Etapa 11 (Lanzamiento):**
   - Habilita la ejecución de tareas de infraestructura productiva y go/no-go (`ENG-130`, `ENG-131`, `ENG-132`, `ENG-135`, `ENG-137`, `ENG-138`, `ENG-139`, `DOC-06`).
   - Se mantiene la prohibición de tocar infraestructura cloud real en entornos locales hasta la sesión programada de despliegue a producción.
