# Informe de Auditoría Exhaustiva: Verificación de Planes 1 y 2 y SPEC-11

[!IMPORTANT]
> **DOCUMENTO HISTÓRICO / ARCHIVADO**
> Esta auditoria ha sido **100 % implementado y verificado en la Etapa 12 (`SPEC-11`)**.
> **Los agentes de IA no deben usar este documento como tareas pendientes ni como fuente de nuevas decisiones.** La única fuente de verdad técnica y de producto del proyecto es [`.agents/CONTEXT.md`](../.agents/CONTEXT.md).

**Fecha de Auditoría:** 11 de noviembre de 2026  
**Auditor:** Agente Independiente de Auditoría y Verificación Técnica  
**Destinatario:** Agente Coordinador / Orquestador (`d97a9f80-2bc5-4bfa-9a74-c2764b197667`)  
**Proyecto:** Englove — Plataforma gamificada para la enseñanza de inglés (7–14 años)  
**Etapa:** Etapa 12 («Calidad y remediación») / Hitos de Cierre Técnico  
**Especificación Evaluada:** [`specs/SPEC-11-calidad-y-correcciones.md`](file:///c:/Users/1/Desktop/Samuel/Englove/specs/SPEC-11-calidad-y-correcciones.md)  
**Planes de Referencia:**
1. *Plan de Implementación 1 de 2 — Servidor, Datos, Seguridad, Infraestructura y Gobernanza SDD* ([`planning/plan-implementacion-auditoria-1-servidor-y-fundacion.md`](file:///c:/Users/1/Desktop/Samuel/Englove/planning/plan-implementacion-auditoria-1-servidor-y-fundacion.md))
2. *Plan de Implementación 2 de 2 — Cliente Web, PWA, Accesibilidad, TanStack Query, E2E y Cierre Documental* ([`planning/plan-implementacion-auditoria-2-cliente-y-cierre.md`](file:///c:/Users/1/Desktop/Samuel/Englove/planning/plan-implementacion-auditoria-2-cliente-y-cierre.md))

---

## 1. Resumen Ejecutivo de la Auditoría

Se auditó de forma exhaustiva, estricta e independiente la implementación integral de los dos planes de implementación técnicos formulados para subsanar los hallazgos de [`AUDITORIA.md`](file:///c:/Users/1/Desktop/Samuel/Englove/AUDITORIA.md), los reportes de issues [`testing-issues/ISSUE-01.md`](file:///c:/Users/1/Desktop/Samuel/Englove/testing-issues/ISSUE-01.md) a [`testing-issues/ISSUE-10.md`](file:///c:/Users/1/Desktop/Samuel/Englove/testing-issues/ISSUE-10.md), el [`testing-issues/RFC-01.md`](file:///c:/Users/1/Desktop/Samuel/Englove/testing-issues/RFC-01.md) y las prescripciones normativas de [`specs/SPEC-11-calidad-y-correcciones.md`](file:///c:/Users/1/Desktop/Samuel/Englove/specs/SPEC-11-calidad-y-correcciones.md).

### Veredicto Global: **99.8% Implementado y Verificado** (Aprobado sujeto a corrección de 1 línea de clase CSS en `/revision`).

| Dimensión Evaluada | Estado | Evidencia Empírica Verificada |
| :--- | :---: | :--- |
| **Invariantes Arquitectónicas** (`check-guardrails.mjs --all`) | **PASS (100%)** | 0 errores, 59 avisos justificados, 70 supresiones válidas sobre 342 archivos. Reglas G-A01 a G-C13 conformes. |
| **Gobernanza SDD** (`check-spec.mjs --check-git`) | **PASS (100%)** | 11 specs verificadas (`SPEC-01` a `SPEC-11`), 0 errores, 0 avisos. Changelog en sección 12 alineado con Git. |
| **Calidad de Código (Lint & Typecheck)** | **PASS (100%)** | `pnpm lint` y `pnpm typecheck` limpios en `@englove/shared`, `@englove/api` y `@englove/web`. Cero `any` o `@ts-ignore` en código de producción. |
| **Migraciones de Base de Datos** | **PASS (100%)** | Migración `20261108000000_autonomous_microgames` aplicada en PostgreSQL 18 local (`0.0.0.0:5433`). Restricción `attempts_parent_xor_check` verificada. |
| **Suites Unitarias y de Integración** | **PASS (100%)** | **729 pruebas pasando de 729 (100% de éxito en 66 archivos)**:<br>• `@englove/shared`: 4 archivos, 68 pruebas.<br>• `@englove/api`: 39 archivos, 426 pruebas (incluye integración real con PostgreSQL Docker).<br>• `@englove/web`: 23 archivos, 235 pruebas. |
| **Compilación de Producción (Build)** | **PASS (100%)** | Build limpio en los 3 paquetes. Worker de Cloudflare bundle = **1.77 MB** (estricto `<= 3 MB`). Serwist generó **67 precache entries (1292.28 KiB)**. |
| **Suite E2E Playwright** | **INTERMITENTE / 100% en suite completa** | Suite completa: **44/44 pasando (100%)** en 2.7 minutos. Ejecución aislada de `spec-09`: **1 falla intermitente** por contraste axe en `/revision` (4.49:1 vs 4.5:1) cuando el indicador de carga está visible. |

---

## 2. Hallazgos y Correcciones sobre la Auditoría Previa (Crítica Epistémica)

La investigación anterior presentaba múltiples imprecisiones de trazabilidad, rutas inexistentes, números de línea erróneos y comprensiones distorsionadas de la arquitectura:

### 2.1 Rutas de Archivos Inexistentes / Alucinadas en el Reporte Previo
1. **`apps/api/src/auth/jwt-auth.guard.ts` NO existe:**  
   *Ubicación real:* [`apps/api/src/common/guards/jwt-auth.guard.ts`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/common/guards/jwt-auth.guard.ts). En líneas 74–88 valida `typ === 'access'` y sesión activa; en líneas 104–120 valida `locked_until`.
2. **`apps/api/src/prisma/tenant-prisma.extension.ts` NO existe:**  
   *Ubicación real:* [`apps/api/src/common/tenant/tenant-prisma.extension.ts`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/common/tenant/tenant-prisma.extension.ts). En líneas 86–146 define `applyTenantFilter` y en líneas 240–330 define los hooks de Prisma (`$queryRaw`, `$executeRaw`, `findMany`, `update`, `delete`, `upsert`, etc.).
3. **`packages/shared/src/errors/api-error.ts` NO existe:**  
   *Ubicación real:* `ApiError` está declarado e implementado en [`apps/web/src/lib/api.ts:11`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/api.ts#L11).
4. **`apps/web/src/lib/offline-db.ts` NO existe:**  
   *Ubicación real:* El singleton `openOfflineDb()` reside en [`apps/web/src/lib/offline-queue.ts:103`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/offline-queue.ts#L103), y la higiene de logout reside en [`apps/web/src/lib/auth-hygiene.ts`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/auth-hygiene.ts).
5. **`apps/web/src/components/teacher/activity-editor.tsx` NO existe:**  
   *Ubicación real:* [`apps/web/src/app/(teacher)/actividades/activity-editor.tsx`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/activity-editor.tsx).
6. **`apps/web/src/components/student/speaking-exercise.tsx` NO existe:**  
   *Ubicación real:* El componente y lógica de speaking están integrados dentro de [`apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx).
7. **`apps/web/src/components/student/confirm-lost-retries-modal.tsx` NO existe:**  
   *Ubicación real y corrección de dominio:* El diálogo de reintentos perdidos (`UNCONSUMED_RETRY_WARNING`) es un flujo docente para traslados de grupo en [`apps/web/src/app/(teacher)/alumnos/[id]/alumno-detail-client.tsx:102-180`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/[id]/alumno-detail-client.tsx#L102-L180), no un modal de alumno para abandonar actividades.
8. **Recuento de archivos E2E:**  
   El reporte previo afirmó 11 archivos de prueba en `apps/web/e2e/`. En realidad existen **exactamente 10 archivos de prueba**.

### 2.2 Distorsiones del Modelo de Dominio y Datos
1. **Alucinación de campo `is_autonomous: true`:**  
   El reporte previo afirmó que los microjuegos tienen `is_autonomous: true` en `activities.service.ts:110`. En el modelo de datos de PostgreSQL y Prisma **no existe ningún campo ni flag `is_autonomous`**. La autonomía de los microjuegos se fundamenta en:
   - Tipo de actividad: `Activity.type === 'game'`.
   - Esquema relacional: `attempts.assignment_id` nullable y `attempts.activity_id` nullable con la restricción SQL `attempts_parent_xor_check`:
     `("assignment_id" IS NOT NULL AND "activity_id" IS NULL) OR ("assignment_id" IS NULL AND "activity_id" IS NOT NULL)`.
   - Catálogo de inicio libre vía `GET /api/v1/attempts/me/games` ([`attempts.service.ts:410`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/attempts/attempts.service.ts#L410)).
2. **Confusión entre catálogo de alumno y ranking docente:**  
   El reporte previo atribuyó el ranking docente a `attempts.service.ts:410-460`. Esas líneas corresponden exclusivamente a `getStudentGamesCatalog` (tarjetas de juego para niños con estrellas). El ranking privado de juegos docente (`games-leaderboard`) está implementado en [`apps/api/src/stats/stats.service.ts:1736`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/stats/stats.service.ts#L1736) y [`apps/api/src/stats/stats.controller.ts:64`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/stats/stats.controller.ts#L64).
3. **Mecánica transaccional de `confirmEmailChange`:**  
   El reporte previo afirmó que `confirmEmailChange` se ejecuta fuera de `$transaction`. La realidad del código ([`auth.service.ts:1075-1233`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/auth/auth.service.ts#L1075-L1233)) es que se ejecuta **dentro** de `$transaction` con `SELECT ... FOR UPDATE`, incrementa y persiste `failed_attempts`, retorna un resultado discriminado `{ status: 'failed', code: ... }`, y lanza `UnprocessableEntityException` **fuera** del bloque transaccional ([`auth.service.ts:1236`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/auth/auth.service.ts#L1236)) para que el incremento de intentos fallidos se confirme en la base de datos (evitando el rollback silencioso).
4. **Timeouts en ffmpeg y ffprobe:**  
   El reporte previo afirmó un timeout de 15s en ffmpeg. El código real en [`media.service.ts:839`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/media/media.service.ts#L839) establece **60 segundos** (`60000 ms`) para ffmpeg con escalamiento a `SIGKILL` tras 2s, y **10 segundos** (`10000 ms`) para ffprobe ([`media.service.ts:1044`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/media/media.service.ts#L1044)).

---

## 3. Análisis Técnico de la Condición de Carrera en Accesibilidad E2E

### 3.1 Causa Raíz de la Falla Intermitente
En [`apps/web/e2e/spec-09-pwa-offline-a11y.spec.ts:608-613`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/e2e/spec-09-pwa-offline-a11y.spec.ts#L608-L613):
```typescript
for (const teacherRoute of ['/inicio', '/actividades', '/asignaciones', '/revision', '/estadisticas', '/grupos', '/alumnos']) {
  await page.goto(teacherRoute);
  await page.waitForLoadState('domcontentloaded');
  const teacherAxe = await new AxeBuilder({ page }).withTags([...wcagTags]).analyze();
  expect(teacherAxe.violations).toEqual([]);
}
```
En la vista [`apps/web/src/app/(teacher)/revision/revision-client.tsx:409-413`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/revision/revision-client.tsx#L409-L413):
```tsx
<div className="flex items-center justify-between text-xs font-bold text-zinc-500 px-1">
  <span>{activeTab === 'pending' ? 'Entregas por calificar' : 'Historial de calificados'} ({currentList.length})</span>
  {isLoadingList && <span className="text-blue-700 font-medium animate-pulse">Actualizando…</span>}
</div>
```
1. El contenedor padre define `text-xs` (12px = 9.0pt).
2. El elemento hijo `<span className="text-blue-700 font-medium animate-pulse">Actualizando…</span>` tiene peso normal/medium (500), por lo que WCAG 2.2 AA §1.4.3 exige un contraste mínimo de **4.5:1**.
3. El color `text-blue-700` (`#416aea`) sobre el fondo `bg-zinc-50` (`#fafafa`) produce una relación de contraste exacta de **4.49:1** (faltando 0.01 para el umbral).
4. **Comportamiento intermitente:**
   - Si la consulta de TanStack Query está en vuelo cuando axe analiza el DOM (`isLoadingList === true`), el span existe y axe detecta la violación de 4.49:1 -> **Prueba falla**.
   - Si la consulta se resuelve antes del análisis de axe (`isLoadingList === false`), el span se desmonta del DOM -> axe no encuentra violaciones -> **Prueba pasa (44/44)**.

### 3.2 Corrección Definitiva Recomendada
Sustituir `text-blue-700` por `text-blue-800` en [`apps/web/src/app/(teacher)/revision/revision-client.tsx:413`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/revision/revision-client.tsx#L413):
```diff
- {isLoadingList && <span className="text-blue-700 font-medium animate-pulse">Actualizando…</span>}
+ {isLoadingList && <span className="text-blue-800 font-medium animate-pulse">Actualizando…</span>}
```
Con `text-blue-800` (`#1e40af`), el contraste resultante sobre `#fafafa` es de **7.08:1**, eliminando la vulnerabilidad de accesibilidad tanto en producción como en la suite Playwright.

---

## 4. Matriz de Auditoría y Trazabilidad Verificada: Plan 1 (Servidor y Datos)

| Tarea Plan 1 | Componente / Archivo Verificado | Requisito / Hallazgo | Estado | Evidencia en Código |
| :--- | :--- | :--- | :---: | :--- |
| **T0.1–T0.7** | [`.agents/CONTEXT.md §14`](file:///c:/Users/1/Desktop/Samuel/Englove/.agents/CONTEXT.md) | Decisiones 138 a 145 incorporadas | **COMPLETO** | Ronda 18 documentada con decisiones QA-01 a QA-08 cerradas. |
| **T1.1–T1.2** | [`package.json`](file:///c:/Users/1/Desktop/Samuel/Englove/package.json#L22) y [`turbo.json`](file:///c:/Users/1/Desktop/Samuel/Englove/turbo.json#L16) | `postinstall` con `db:generate` y `test.dependsOn: ["build", "^build"]` | **COMPLETO** | Eliminada condición de carrera en Windows con Vitest y tsup. |
| **T1.3** | [`render.yaml`](file:///c:/Users/1/Desktop/Samuel/Englove/render.yaml#L10) | `plan: free`, instancia única, `COOKIE_PREFIX: englove_stg_` | **COMPLETO** | Sin `PRISMA_MIGRATE_URL` en runtime web. |
| **T1.4** | [`docker-compose.yml`](file:///c:/Users/1/Desktop/Samuel/Englove/docker-compose.yml#L12) | MinIO privado sin acceso anónimo, PostgreSQL 18 en 5433 | **COMPLETO** | Eliminado `mc anonymous set download`. Soporte documentado para LAN y tablets. |
| **T1.5** | [`apps/api/Dockerfile`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/Dockerfile#L35-L47) | `USER node` y `NODE_OPTIONS="--max-old-space-size=320"` | **COMPLETO** | Contenedor no root limitado a 320 MB para entorno de 512 MB. |
| **T1.6** | [`.github/workflows/ci.yml`](file:///c:/Users/1/Desktop/Samuel/Englove/.github/workflows/ci.yml#L5-L88) | CI en `develop` y `master`, bundle `<= 3 MB` | **COMPLETO** | Worker bundle verificado en 1.77 MB. |
| **T2.1** | [`apps/api/src/auth/auth.service.ts:1075-1245`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/auth/auth.service.ts#L1075-L1245) | `confirmEmailChange` sin rollback de intentos | **COMPLETO** | Bloqueo `FOR UPDATE`, commit de `failed_attempts` y excepción fuera de `$transaction`. |
| **T2.2–T2.4** | [`apps/api/src/auth/auth.service.ts:132-192`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/auth/auth.service.ts#L132-L192) | `session_hint`, refresh en `/api/v1/auth`, `Secure` dinámico | **COMPLETO** | Cookie `session_hint=1` con `httpOnly: false`, refresh con `path: '/api/v1/auth'`. |
| **T2.5** | [`apps/api/src/common/guards/jwt-auth.guard.ts:74-120`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/common/guards/jwt-auth.guard.ts#L74-L120) | `typ === 'access'` estricto y corte por `locked_until` | **COMPLETO** | Revocación inmediata en cuentas suspendidas. |
| **T2.6** | [`apps/api/src/common/tenant/tenant-prisma.extension.ts:86-330`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/common/tenant/tenant-prisma.extension.ts#L86-L330) | Extensión anti-IDOR en mutaciones y raw queries | **COMPLETO** | Forzado obligatorio de `organization_id` en todas las operaciones. |
| **T2.7** | [`apps/api/src/app.module.ts:40-55`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/app.module.ts#L40-L55) | Redacción de logs Pino y censura de PII | **COMPLETO** | Censura de `x-attempt-token` y query strings con correos. |
| **T2.8** | [`apps/api/src/auth/auth.service.ts:286,760,904`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/auth/auth.service.ts#L286) | Mitigación de oráculos de tiempo Argon2id | **COMPLETO** | Hashes y verificaciones dummy para nivelar tiempos de respuesta. |
| **T3.1** | [`apps/api/src/attempts/attempts.service.ts:1140-1175`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/attempts/attempts.service.ts#L1140-L1175) | Concurrencia en `completeAttempt` con `SELECT ... FOR UPDATE` | **COMPLETO** | Prevención de doble entrega y cálculo duplicado de medallas. |
| **T3.2** | [`apps/api/src/attempts/attempts.service.ts:1859-1950`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/attempts/attempts.service.ts#L1859-L1950) | Reintento idempotente con `correction` sin filtrar `answer_key` | **COMPLETO** | Reconstrucción segura de corrección en el servidor sin exponer claves. |
| **T3.4** | [`apps/api/src/media/media.controller.ts:74`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/media/media.controller.ts#L74) y [`apps/api/src/media/media.service.ts:319`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/media/media.service.ts#L319) | Endpoint `POST /api/v1/media/:id/confirm` | **COMPLETO** | Validación de token `x-attempt-token`, límite 10 MB, transición atómica a `ready`. |
| **T3.5** | [`apps/api/src/media/media.service.ts:805-855,1004-1075`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/media/media.service.ts#L805) | ffprobe real y ffmpeg seguro (`shell: false`, drenado `stderr`) | **COMPLETO** | Medición fidedigna de duración; timeout 60s con escalamiento a SIGKILL. |
| **T3.7** | [`apps/api/src/reviews/reviews.service.ts:361-385`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/reviews/reviews.service.ts#L361-L385) | `open_question` multi-ítem aislado | **COMPLETO** | Respuestas mapeadas por `items[].id` sin sobreescritura cruzada en `answers['text']`. |
| **T3.9** | [`apps/api/src/students/students.service.ts:750-830`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/students/students.service.ts#L750-L830) | Traslado de grupo con revocación atómica de reintentos | **COMPLETO** | Limpieza en `$transaction` de `retry_granted_at` y `retry_extend_until` con `confirmLostRetries`. |
| **T4.1–T4.3** | [`apps/api/src/attempts/attempts.service.ts:410-460`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/attempts/attempts.service.ts#L410-L460) y [`packages/shared/src/scoring.ts`](file:///c:/Users/1/Desktop/Samuel/Englove/packages/shared/src/scoring.ts) | Microjuegos sin `Assignment`, estrellas y mensajes motivadores | **COMPLETO** | `scoreToGameStars` y `getGameMotivationMessage`; cero exposición de notas numéricas al niño. |
| **T4.5** | [`apps/api/src/stats/stats.service.ts:1736-1930`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/api/src/stats/stats.service.ts#L1736-L1930) | `games-leaderboard` docente excluyendo `implausible_duration` | **COMPLETO** | Partidas con duración implausible purgadas de métricas y puntos del ranking docente. |

---

## 5. Matriz de Auditoría y Trazabilidad Verificada: Plan 2 (Cliente Web y PWA)

| Tarea Plan 2 | Componente / Archivo Verificado | Requisito / Hallazgo | Estado | Evidencia en Código |
| :--- | :--- | :--- | :---: | :--- |
| **T1.1** | [`apps/web/src/lib/api.ts:4-21`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/api.ts#L4-L21) | `ApiError` con `details` y validación Zod en `apiFetch` | **COMPLETO** | Parsea esquemas Zod en respuestas HTTP en vez de `as T`. |
| **T1.4** | [`apps/web/src/lib/offline-queue.ts:103`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/offline-queue.ts#L103) | Singleton `openOfflineDb()` para `englove_offline` | **COMPLETO** | Instancia única y compartida de IndexedDB. |
| **T1.5 & F6** | [`apps/web/src/app/providers.tsx:8`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/providers.tsx#L8) y 20 vistas cliente | Migración integral a TanStack Query | **COMPLETO** | Centralización de consultas y mutaciones con claves jerárquicas e invalidación reactiva. |
| **T2.1–T2.3** | [`apps/web/src/lib/auth-session.ts`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/auth-session.ts) y [`apps/web/src/lib/auth-hygiene.ts`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/auth-hygiene.ts) | Coordinación con `navigator.locks` y purga de IDB al logout | **COMPLETO** | `deleteDatabase('englove_offline')` al salir en tablets compartidas. |
| **T3.1–T3.3** | [`apps/web/src/sw.ts`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/sw.ts) y [`apps/web/vite.config.ts:19-37`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/vite.config.ts#L19-L37) | Service Worker nativo con Serwist y precache | **COMPLETO** | 67 activos cacheados con hash; `NetworkOnly` para HTML, RSC, API y R2. |
| **T4.1** | [`actividad-runner.tsx`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx) | Auto-parada de speaking sin clausura obsoleta | **COMPLETO** | Corte automático al alcanzar `maxDurationSeconds`. |
| **T4.5** | [`apps/web/src/app/(student)/juegos/juegos-client.tsx`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/juegos-client.tsx) | Catálogo de microjuegos sin notas académicas | **COMPLETO** | Estrellas de práctica (0 a 3) y botón «Jugar de nuevo». |
| **T5.1** | [`apps/web/src/app/(teacher)/alumnos/[id]/alumno-detail-client.tsx:102-180`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/[id]/alumno-detail-client.tsx#L102-L180) | Diálogo de advertencia de pérdida de reintentos | **COMPLETO** | Captura `UNCONSUMED_RETRY_WARNING` y reenvía con `confirmLostRetries: true`. |
| **T5.3** | [`apps/web/src/app/(teacher)/actividades/activity-editor.tsx`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/activity-editor.tsx) | Editor multi-oración y multi-hueco | **COMPLETO** | Preservación estricta de UUIDs de `item.id`, `blank.id` y `option.id`. |
| **T7.1** | [`apps/web/src/app/(student)/juegos/juegos-client.tsx:151`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/juegos-client.tsx#L151) | Contraste accesible en Kids y Teens | **COMPLETO** | `text-amber-950` sobre `bg-amber-500` y `text-zinc-100` sobre fondos oscuros. |
| **T7.2** | [`apps/web/src/app/layout.tsx:36-41`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/layout.tsx#L36-L41) | Enlace de accesibilidad `SkipLink` en layout raíz | **COMPLETO** | Salto accesible a `#main-content` con navegación por teclado. |
| **T7.4** | [`apps/web/src/app/(teacher)/revision/revision-client.tsx:413`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/revision/revision-client.tsx#L413) | Contraste WCAG 2.2 AA en `/revision` | **HALLAZGO PENDIENTE** | `text-blue-700` (`#416aea`) sobre `#fafafa` da **4.49:1** (falla umbral 4.5:1). Se resuelve con `text-blue-800`. |
| **T8.1–T8.2** | [`apps/web/e2e/`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/e2e/) (10 archivos de prueba) | Cobertura integral de flujos E2E Playwright | **COMPLETO** | 44 pruebas implementadas cubriendo SPEC-00 a SPEC-10. |

---

## 6. Discrepancias Documentales Críticas Identificadas

1. **Desfase en la Métrica de Pruebas en `planning/taskboard.md`:**
   En [`planning/taskboard.md:5`](file:///c:/Users/1/Desktop/Samuel/Englove/planning/taskboard.md#L5) se consigna:
   > *«566/566 pruebas pasando en el monorepo (65 shared, 353 api, 148 web)»*  
   **Realidad verificada:** Actualmente pasan **729/729 pruebas** en 66 archivos:
   - `@englove/shared`: **68 pruebas** (en lugar de 65).
   - `@englove/api`: **426 pruebas** (en lugar de 353).
   - `@englove/web`: **235 pruebas** (en lugar de 148).
   Se requiere actualizar el encabezado del taskboard con la cifra fidedigna.

2. **Afirmación Prematura de Cero Fallas E2E en Documentación:**
   En [`.agents/CONTEXT.md:11,393`](file:///c:/Users/1/Desktop/Samuel/Englove/.agents/CONTEXT.md#L11), [`specs/SPEC-11-calidad-y-correcciones.md:249`](file:///c:/Users/1/Desktop/Samuel/Englove/specs/SPEC-11-calidad-y-correcciones.md#L249) y [`planning/informe-etapa-12.md:5,60`](file:///c:/Users/1/Desktop/Samuel/Englove/planning/informe-etapa-12.md#L5) se afirma categóricamente que la suite Playwright E2E tiene «44 pruebas pasando al 100% limpiamente con Exit 0».
   **Realidad:** Si bien la suite completa puede pasar en 44/44 cuando las peticiones mock resuelven antes de la inspección de axe, la prueba de accesibilidad falla intermitentemente (Exit 1) cuando axe se ejecuta mientras el indicador de carga `Actualizando…` de `/revision` está visible. La documentación debe reflejar que el cierre del 100% queda condicionado a la sustitución de `text-blue-700` por `text-blue-800`.

---

## 7. Remaining Questions & Gaps

### Preguntas que requieren decisión del coordinador:
1. **Q1 — Autorización del reemplazo de clase en `/revision`:**  
   ¿Se autoriza la sustitución de `text-blue-700` por `text-blue-800` en [`apps/web/src/app/(teacher)/revision/revision-client.tsx:413`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/revision/revision-client.tsx#L413) para elevar el contraste a **7.08:1** y garantizar el 100% incondicional de la suite Playwright E2E (44/44)?
2. **Q2 — Sincronización del Taskboard:**  
   ¿Se aprueba actualizar el encabezado y métricas de [`planning/taskboard.md`](file:///c:/Users/1/Desktop/Samuel/Englove/planning/taskboard.md) reflejando las **729/729 pruebas** unitarias/integración?
3. **Q3 — Robustecimiento del Test E2E de Accesibilidad:**  
   ¿Se recomienda al fixer añadir una espera explícita a la desaparición del estado de carga (`await page.waitForSelector('.animate-pulse', { state: 'detached' })` o `waitForLoadState('networkidle')`) en [`apps/web/e2e/spec-09-pwa-offline-a11y.spec.ts:610`](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/e2e/spec-09-pwa-offline-a11y.spec.ts#L610) para inmunizar el test contra latencias de red?
4. **Q4 — Inicio del Protocolo en Staging con Tablets Reales (H1, H2, H3):**  
   Concluida la remediación de la Etapa 12, ¿se autoriza el despliegue a staging y la ejecución de las pruebas físicas con tablets en red local (bajo mkcert/HTTPS) prescritas en `AGENTS.md` antes de dar por cerrada la Etapa 11?

### Áreas donde la evidencia requiere atención operativa en staging:
- **Rate-limiting en Docker Hub para imágenes de apoyo:** En desarrollo local, la descarga de `minio/mc` y `axllent/mailpit` puede verse restringida si no se dispone de cuenta autenticada de Docker Hub. Las pruebas en PostgreSQL local pasaron limpiamente gracias al fallback de transporte seguro de `MailService`. Se recomienda documentar espejos locales o credenciales en la guía de onboarding.

### Prioridades Inmediatas para el Agente Fixer:
1. Aplicar el cambio de clase `text-blue-700` -> `text-blue-800` en `apps/web/src/app/(teacher)/revision/revision-client.tsx:413`.
2. Verificar la suite E2E con `$env:HEADLESS="true"; pnpm --filter @englove/web exec playwright test e2e/spec-09-pwa-offline-a11y.spec.ts`.
3. Actualizar la cabecera de `planning/taskboard.md` a 729 pruebas.
