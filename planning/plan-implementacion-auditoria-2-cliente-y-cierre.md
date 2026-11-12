# Plan de Implementación 2 de 2 — Cliente Web, PWA, Accesibilidad, TanStack Query, E2E y Cierre Documental

> [!IMPORTANT]
> **DOCUMENTO HISTÓRICO / ARCHIVADO**
> Este plan de implementación ha sido **100 % implementado y verificado en la Etapa 12 (`SPEC-11`)**.
> **Los agentes de IA no deben usar este documento como tareas pendientes ni como fuente de nuevas decisiones.** La única fuente de verdad técnica y de producto del proyecto es [`.agents/CONTEXT.md`](../.agents/CONTEXT.md).

- **Fuente única:** [`planning/auditoria-post-spec-11.md`](auditoria-post-spec-11.md) (commit auditado `develop` @ `b4d04d3`; decisiones `QA-01` a `QA-08` cerradas el 2026-11-09). Este plan no usa ningún otro documento como fuente de hallazgos.
- **Complemento:** [`plan-implementacion-auditoria-1-servidor-y-fundacion.md`](plan-implementacion-auditoria-1-servidor-y-fundacion.md). Entre ambos planes se cubre el 100 % de la auditoría (42 hallazgos, `QA-01`..`QA-08`, §2, §3, §4, §6, §7 y §8).
- **Criterio de división:** por **capa y tipo de tarea**. Este plan agrupa todo lo que ocurre en `apps/web`: sesión y offline del navegador, Serwist, flujos de estudiante y docente, TanStack Query, `as Type` en web, WCAG 2.2 AA, E2E Playwright. También agrupa el cierre documental (specs restantes, documentos de `planning/`, `CONTEXT`/`AGENTS`), los pendientes operativos y legales, y la verificación global final.
- **Los hallazgos que cruzan capas se parten en dos mitades.** La mitad cliente va aquí. La mitad servidor está en el Plan 1. Los contratos que este plan consume están en §3.
- **Modo:** este documento es un plan. No implementa nada. La ejecución se rige por `AGENTS.md`, `planning/sdd-process.md` y las skills `englove-spec`, `englove-guardrails`, `tdd`, `accessibility`, `playwright-best-practices`, `webapp-testing`, `pwa-development`, `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `frontend-design`, `shadcn` (si se tocan componentes de UI), `code-review`, `security-review` y `verification-before-completion`.

---

## 1. Alcance del Plan 2

| Bloque | Contenido | Hallazgos que cierra |
| --- | --- | --- |
| Alineación documental restante | SPEC-03/06/07/08/09/10, `architecture-overview`, `sdd-process`, `taskboard`, informes históricos, longitud de specs | `P2-11` (resto), `P3-05`, §3.2 (SPEC-03/06/07/08/09/10), §3.3 (resto) |
| Fundaciones web | `api.ts`/`ApiError`, `auth-errors.ts`, `AccessibleModal`, base IndexedDB única, `QueryClient` | `P0-06`, `P0-07`, `P0-09` (cliente), parte de `P1-14` |
| Sesión, privacidad y cola offline | Login con `session_hint`, `navigator.locks`, higiene IDB, cola offline | `P0-02` (cliente), `P0-03` (cliente), `P0-04`, `P0-05`, `RF-6`, `QA-02`, `QA-08` (cliente) |
| PWA con Serwist | Spike real, instalación, retirada de `sw.js` y `swPrecachePlugin` | `P0-08`, `RF-7`, `QA-01`, `P2-10` (parte) |
| Flujos del estudiante | `actividad-runner`, `speaking`, `open_question`, microjuegos, `/inicio`, `/perfil`, `/progreso` | `P0-04`, `P1-03` (cliente), `P1-05` (cliente), `P1-07` (cliente), `P3-03` |
| Flujos de la maestra | Modal de traslado, `/revision`, editor de actividades, publicar, asignaciones, estadísticas | `P0-09`, `P1-08`, `P1-10`, `P2-10`, `QA-03`, `QA-07` (cliente) |
| TanStack Query y tipado en web | 20 vistas `*-client.tsx`, `as Type` en `apps/web`, guardrails `G-B04`/`G-C12`/`G-C13` | `P1-14`, `QA-04`, `RF-13`, `P3-01` (parte), §6.1.1, §6.1.3, §6.1.6 |
| Accesibilidad WCAG 2.2 AA | Contraste, landmarks, foco, `aria-live`, targets, `axe` con `wcag22aa` | `P1-13`, `RF-14` |
| E2E, cierre y operación | Suite Playwright, legales y operativos, `CONTEXT`/`AGENTS`, informe, verificación final | `P2-08` (parte web), `P3-04`, §4, §6.3, §7.2.3 (parte), §7.2.4, §8.2 pasos 2 (cierre) y 5 |

Prerrequisito del Plan 1: los contratos de §3. Las fases F0 y F1 de este plan pueden arrancar en paralelo con el Plan 1.

---

## 2. Orden de ejecución y dependencias

```
F0 Docs restantes ─► F1 Fundaciones web ─► F2 Sesión/offline ─► F3 Serwist
                                   │                │
                                   ├─► F4 Estudiante ─► F5 Docente ─► F6 TanStack + tipado ─► F7 WCAG 2.2 ─► F8 E2E + cierre
```

- Código de producción solo después de F0 de este plan **y** F0 del Plan 1. SDD no admite saltarse specs.
- F4 y F5 dependen de los contratos del Plan 1 (§3).
- F6 va **después** de F4/F5 para migrar a TanStack Query vistas ya corregidas (si no, se migran dos veces).
- F7 va después de F6, porque los modales y componentes ya estarán estabilizados.
- F8 es la última. La verificación final requiere ambos planes en verde.

---

## 3. Contratos que este plan consume del Plan 1

| Contrato | Plan 1 | Se usa en |
| --- | --- | --- |
| Cookie `${cookiePrefix}session_hint=1` | T2.2 | T2.1, T2.2 de este plan |
| `GET /api/v1/auth/session`, `refresh_token` con `path: '/api/v1/auth'` | T2.2, T2.3 | T2.2, T2.3 |
| `details` preservado en `409 UNCONSUMED_RETRY_WARNING` | T3.9 | T1.1, T5.1 |
| `POST /api/v1/media/:id/confirm` + `x-attempt-token` en `upload-url` | T3.4 | T4.3 |
| `startGameAttempt` sin `409`; `POST /api/v1/activities/:id/attempts` | T4.1 | T4.5 |
| Juegos sin `score` visible, `scoreToGameStars` y `getGameMotivationMessage` | T4.3 | T4.5 |
| `itemId` de `open_question` multi-pregunta por `items[].id` | T3.7 | T4.4 |
| `correction` en reintentos de `/complete` | T3.2 | T4.2 |
| `403 AUTH_FORBIDDEN`, `422 SCORE_OUT_OF_RANGE` | T5.4 | T1.2, T5.2 |
| Tipos de `packages/shared` sin `as Type` | T5.1 | T6.x |

---

## 4. Fases y tareas

### F0 — Alineación documental restante (pasos 1-2 de §8.2, parte restante)

Skills: `englove-spec`, `domain-modeling`. Cada spec modificada recibe la fila obligatoria en `§12` (Decisión 128).

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T0.1 | `SPEC-03` | `RF-8` (L51) sigue describiendo un único campo `prompt`: alinear con `items[]` (L90, `RFC-01`); alinear la vista previa de `game`; incorporar el editor multi-oración/multi-hueco con preservación de UUIDs (`QA-03`); fila en `§12` (L226-L231) | §3.2 SPEC-03 |
| T0.2 | `SPEC-06` | L20 (quitar Framer Motion, Decisión 105); L85 (los intentos antiguos se descartan, Decisión 136); L229 (los juegos no alimentan estadísticas docentes de nota, Decisión 137); catálogo autónomo `/juegos`, inicio sin `Assignment`, estrellas de práctica sin nota, accesibilidad y TTS Kids; fila en `§12` | §3.2 SPEC-06 |
| T0.3 | `SPEC-07` | Añadir `open_question` multi-pregunta (`RFC-01`) en la vista de `/revision`, enlaces `WEB_BASE_URL`; coma decimal; fila en `§12` (ya incluye `confirmLostRetries` L75 y CORP L95) | §3.2 SPEC-07 |
| T0.4 | `SPEC-08` | Actualizar `§2` (L25: el ranking de puntos de juegos ya existe), `§4`, `§5`, `§7` (L78: `game` no aporta a notas académicas), `§9` (L121: `game` fuera de `scoreSeries`); pasar `En revisión` → `Aprobada` → `Verificada`; `RF-1,2,4,5,6,8,9,10,12`; regla `QA-06` | §3.2 SPEC-08 |
| T0.5 | `SPEC-09` y `SPEC-10` | Serwist real (`QA-01`), base única `englove_offline`, aislamiento `activeUserId`, `deleteDatabase`; sustituir `['wcag2a','wcag2aa','wcag21a','wcag21aa']` por el conjunto con `'wcag22aa'` (`SPEC-09:136`, `SPEC-10:143,213`); filas en `§12` | §3.2 SPEC-09/10 |
| T0.6 | `planning/architecture-overview.md` | L162: añadir `activity_id` en `Attempt`; L256: `COOKIE_PREFIX` coherente con `render.yaml` y `SPEC-11` (`englove_stg_`); L491: diagrama ER con `Attempt.assignment_id` nullable | §3.3.3 |
| T0.7 | `planning/sdd-process.md` y `planning/taskboard.md` | `sdd-process.md:201-214`: listar `SPEC-11` en el calendario; `taskboard.md:258`: eliminar la corrupción literal `<TAB>`; `L283-286`: quitar el ranking de juegos del backlog post-piloto (ya implementado en `ENG-162`) | §3.3.4 |
| T0.8 | Informes históricos | `informe-etapa-9.md#L33`: nota de que el `sw.js` manual dejó de ser la decisión vigente (Serwist); `poc-eng-140-informe.md#L97`: nota de obsolescencia de `middleware.ts` hacia `proxy.ts` | §3.3.5 |
| T0.9 | Longitud de specs | Reducir o dividir las 8 specs `> 20 min` de lectura (`SPEC-01`, `02`, `03`, `06`, `07`, `08`, `09`, `11`; `SPEC-11` ≈ 32 min) sin perder requisitos | `P3-05` |

---

### F1 — Fundaciones web

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T1.1 | `ApiError` y `apiFetch` | `apps/web/src/lib/api.ts#L10-L19`: `ApiError` conserva `details`; `apiFetch` (`#L108`) valida las respuestas con esquemas Zod de `packages/shared` en lugar de `return data as T` | `P0-09` (cliente), `P1-14` (parte), `QA-04` |
| T1.2 | Mensajes de error de auth | `login-client.tsx#L101-L103` y `registro-client.tsx#L65-L67`: validar el cuerpo de error con un esquema compartido y pasar `errorBody.code` a `getAuthErrorMessage` (`auth-errors.ts#L19-L24`). Verifica `403 ACCOUNT_PENDING_APPROVAL`, `423 AUTH_ACCOUNT_LOCKED`, `409 EMAIL_TAKEN`, `PASSWORD_POLICY` | `P0-07` |
| T1.3 | `AccessibleModal` | `modal.tsx#L26-L84`: `onClose` en `useRef`, `useEffect` de foco inicial dependiente solo de `[isOpen]`. Prueba que escribir en un `<input>` dentro del modal no mueve el foco (alumnos, alumno-detail, contenido-extra) | `P0-06` |
| T1.4 | Base IndexedDB única | Todo acceso a `englove_offline` pasa por `openOfflineDb()` (`offline-queue.ts#L108-L120`); eliminar la apertura aislada de `saveLocalRecording` que creaba solo `pendingUploads` | `P0-05`.2, `RF-6`.1 |
| T1.5 | Infraestructura TanStack Query | `QueryClientProvider`, convenciones de claves y de `invalidateQueries`; punto de partida para F6 | `QA-04` |

---

### F2 — Sesión continua, multi-pestaña, privacidad y cola offline

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T2.1 | Login y refresco silencioso | `login-client.tsx#L49-L58`: sustituir la comprobación `document.cookie.includes('englove_session'\|'access_token='\|'englove_user_logged=1')` por la presencia de `${cookiePrefix}session_hint`; ejecutar `trySilentRefresh()` al expirar el `access_token` (15 min). `login-client.tsx#L222`: usar `APP_ENV === 'local'` en lugar de `NODE_ENV !== 'production'` | `P0-02` (cliente), `QA-02`, `QA-08`, `P2-02` (cliente) |
| T2.2 | Multi-pestaña | `auth-session.ts#L20-L45`: `fetchSharedSession()` pasa a `GET /api/v1/auth/session` (solo lectura); `requestSharedRefresh()` coordinado con `navigator.locks` y fallback en memoria; `LoginClient` llama `setSharedSession(data)` tras `login`/`refresh` (`login-client.tsx#L107-L122`) | `P0-03` (cliente), `QA-02` |
| T2.3 | Logout | Usar `POST /api/v1/auth/logout` con el `path` ampliado para revocar `AuthSession` en BD aun pasados 15 min | `P0-03`, `§4.1` paso 10 |
| T2.4 | `ActividadRunner` ante `401`/`4xx` | `handleCompleteAttempt` (`actividad-runner.tsx#L473-L490`) y `/events` pasan por `requestSharedRefresh()`; los `401`/`422` se muestran en línea. La guarda `if (error \|\| !runtime)` (`#L580`) no desmonta el runner ni destruye el trabajo en pantalla | `P0-04`.1 |
| T2.5 | `offline-queue.ts` | `fetch()` crudo (`#L565`, `#L602`) → `requestSharedRefresh()`; `isQueuePausedDueToAuth` se limpia tras refresh o login exitoso (hoy solo en `window.online`, `#L776`) | `P0-04`.2 |
| T2.6 | Privacidad en `saveLocalRecording` | `actividad-runner.tsx#L42-L121`: `userId` obligatorio en cada registro (`pendingUploads`); `executeFlush(activeUserId)`; `purgeOtherUsersEntries` (`offline-queue.ts#L273`) borra también registros sin `userId` | `P0-05`.1, `RF-6`.1 |
| T2.7 | Higiene al logout/login | `auth-hygiene.ts#L66-L78`: `indexedDB.deleteDatabase('englove_offline')` esperando `onsuccess`/`onblocked` (hoy resuelve antes de `tx.oncomplete`); `login-client.tsx#L110-L122`: `await purgeOtherUsersEntries` y `clearSharedSession()`, `clearSharedProfile()`, `clearSharedFeatureFlags()` antes de `router.push` (`auth-session.ts` singletons) | `P0-05`.3, `RF-6`.2-3 |
| T2.8 | `/inicio` y `/perfil` | `inicio-client.tsx#L48-L101`: sustituir `fetch()` crudo por el cliente con refresh `401`; montar `<OfflineStatusBanner />`; pasar `level` a `<StudentNav>`. `/perfil`: limpiar `cachedProfile` al cambiar de tema | `§4.1` paso 3, `P1-13` (flujo 9) |

---

### F3 — Service Worker real con Serwist (`QA-01`)

Skills: `pwa-development`. Salvaguarda de `SPEC-11 §11.4.2`: si el spike muestra incompatibilidad bloqueante con Vite 8 + `@vinext/cloudflare`, se detiene esa pieza y se registra **una nueva decisión en `CONTEXT §14`**, sin parches silenciosos.

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T3.1 | Spike real | Probar `serwist` / `@serwist/vite` con `vinext` + `@cloudflare/vite-plugin`; documentar el resultado | `P0-08`, `QA-01` |
| T3.2 | Instalación | Añadir `serwist`/`@serwist/vite` a `apps/web/package.json`; precaching de estáticos versionado por hash; `NetworkOnly` en `/api/*`; fallback de navegación a `/offline`; ciclo `waiting` → `SKIP_WAITING` | `RF-7` |
| T3.3 | Retiradas | Eliminar `public/sw.js` manual (`CACHE_VERSION = 'englove-static-v1'` fijo) y `swPrecachePlugin` de `vite.config.ts#L11-L65`; comprobar que `/offline` y el manifiesto ya no se sirven Cache-First sin revisión | `P0-08` |
| T3.4 | `PwaUpdateBanner` y banners offline | Copy según segmento real del usuario (`Kids`, `Teens`, profesora) en `pwa-update-banner.tsx#L26-L31`, `offline-status-banner.tsx#L24-L28`, `offline-client.tsx#L11-L15`. Hoy leen `englove_segment` que nadie escribe | `RF-7`, `P2-10` (parte) |
| T3.5 | Regla `G-C13` | Ver T6.4 (el script comprueba la presencia efectiva de Serwist y bloquea `public/sw.js` manual) | §6.1.6 |

---

### F4 — Flujos del estudiante

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T4.1 | Temporizador `speaking` | `actividad-runner.tsx#L350-L374`: eliminar la clausura obsoleta (`isRecording === false`) para cortar la grabación en `maxDurationSeconds` | `P1-08`.3, `RF-6`.4 |
| T4.2 | `fill_blank` | El `<label>` visible deja de exponer el UUID crudo (`Espacio [b1-uuid]:`); mostrar la `correction` devuelta en reintentos idempotentes | `§4.1` paso 4 |
| T4.3 | Grabador `speaking` con `media/:id/confirm` | Confirmar el audio apenas termina la subida a R2/MinIO (con `x-attempt-token`) y antes de habilitar «Terminar»; errores `422` de audio se muestran en línea sin desmontar la actividad | `P1-03` (cliente), `QA-05`, `§4.1` paso 6 |
| T4.4 | `open_question` multi-pregunta | `actividad-runner.tsx#L1048-L1050`: usar el `items[].id` correcto (no `'text'`); `/revision` (`revision-client.tsx#L555-L558`) no rellena con `answers['text']` las preguntas dejadas en blanco | `P1-07` (cliente), `RF-8`.3 |
| T4.5 | Microjuegos | `GameRenderer.tsx#L82-L165` y `actividad-runner.tsx#L553-L561`, `#L680-L718`: usar `scoreToGameStars` y `getGameMotivationMessage` de `packages/shared`; no mostrar `Nota: X.X / 5.0` al niño; botón «Jugar de nuevo» (sin depender de `assignmentId`, hacia `POST /api/v1/activities/:id/attempts`); banner `«Modo de prueba — este intento no se guarda»` en la vista previa docente; `/juegos` (`juegos-client.tsx`) sin `score` | `P1-05` (cliente), `RF-1`.3 y `.5`, `RF-10`.2 |
| T4.6 | Examen | Verificar el flujo `exam` con el seed corregido en el Plan 1 y el manejo de `401` de T2.4 | `§4.1` paso 7 |
| T4.7 | Formato decimal | `progreso-client.tsx#L186`, `actividad-runner.tsx#L681`, `TrendBadge` en `estadisticas-client.tsx#L51-L64`: coma decimal en lugar de `.toFixed(1)` con punto | `P3-03` |
| T4.8 | `/registro` y `/terminos` | `registro-client.tsx` (ver T1.2); `terminos/page.tsx#L10-L81`: aviso visible de texto provisional pendiente de validación jurídica (`SPEC-11 §7.4`) | `P3-04`, `§4.1` paso 1 |
| T4.9 | Código muerto de juegos | Retirar `src/lib/motion/*` (`kidsMotion`/`teensMotion` cargados y descartados en `GameRenderer.tsx#L43`) | `P3-01` (parte) |

---

### F5 — Flujos de la maestra

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T5.1 | Modal `confirmLostRetries` | `alumno-detail-client.tsx#L113-L145`: capturar `UNCONSUMED_RETRY_WARNING`, mostrar la lista de `affectedActivities` y reenviar con `confirmLostRetries: true`. El aviso informa de que la pérdida del reintento es definitiva (`QA-07`) | `P0-09`, `RF-9`, `QA-07` |
| T5.2 | Calificación con coma decimal | `revision-client.tsx#L114`, `#L196`, `#L625-L636`: `<input type="text" inputMode="decimal">`, normalizar `,` → `.`, validar 0.0–5.0 sin truncar a `4.0`; mostrar `422 SCORE_OUT_OF_RANGE` | `P1-10`, `RF-8`.2 |
| T5.3 | Editor de actividades | `activity-editor.tsx#L521-L556`, `#L637-L660`: `fill_blank` y `exam` con múltiples oraciones (`items[]`), múltiples huecos por oración (`blanks[]`) y `2..6` opciones por hueco; **preservar** `item.id`, `blank.id`, `option.id` al cargar/editar/guardar; `crypto.randomUUID()` solo para elementos nuevos; sin truncar actividades existentes | `P1-08`.1, `QA-03` |
| T5.4 | Publicar | `actividad-detail-client.tsx#L13-L26`: actualizar el estado local tras «Publicar» (hoy queda «Borrador») | `P1-08`.2 |
| T5.5 | Selector de asignaciones | `nueva-asignacion-client.tsx#L393`: retirar `game` (Microjuego) del selector docente | `P2-10`, `RF-1`.4 |
| T5.6 | Vista previa de juegos del docente | Usar `scoreToGameStars` correcto, sin `/ 5.0`, con el banner de modo prueba (ver T4.5) | `§4.2` paso 4 |
| T5.7 | Estadísticas | Verificar `/estadisticas` y la ficha del alumno con los datos corregidos en el Plan 1 (`groupAverageScore`, `order_words`, leaderboard) | `§4.2` paso 7 |
| T5.8 | Grupos y contenido extra | Comprobar que el foco estable de T1.3 resuelve `/contenido-extra` y los modales de `/alumnos`; `/grupos` sin regresión | `§4.2` pasos 2, 3, 8 |

---

### F6 — TanStack Query, cero `as Type` en web y guardrails de cliente (`QA-04`)

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T6.1 | Inventario | Listar las 20 vistas `apps/web/src/app/**/*-client.tsx` pendientes de 25 con API (solo `/contenido-extra` usa `useMutation`). El documento no las enumera, por lo que esta tarea fija el inventario antes de migrar | `P1-14` |
| T6.2 | Migración | Migrar las 20 vistas (más `useMutation` en `revision-client.tsx`) a `useQuery` + `useMutation` + `queryClient.invalidateQueries`, retirando `useEffect + useState + fetch/apiFetch` manuales; resuelve datos obsoletos entre pestañas/rutas tras mutar grupos o alumnos | `P1-14`, `QA-04`, `RF-13`.1 |
| T6.3 | `as Type` en `apps/web` | Eliminar las 168+ aserciones `as Type` de `apps/web/src` (excepto `as const` y tests), usando Zod y type guards (la mitad API/shared está en el Plan 1, T5.1) | `P1-14`, `RF-13`.2 |
| T6.4 | `englove-guardrails` — reglas de cliente | En las 3 copias: `G-C12` (`check-guardrails.mjs#L454-L458`, `ERROR`) bloquea toda aserción `as <Type>`/`<Type>expr` en runtime (`apps/` y `packages/shared/`, excluyendo `as const` y tests); `G-B04` (`#L436-L447`) detecta `useEffect` con `apiFetch`/`fetch('/api/v1/...')` en `*-client.tsx` (hoy solo mira `page.tsx`); `G-C13` verifica `serwist`/`@serwist/vite` en `apps/web/package.json` y bloquea `public/sw.js` manual; actualizar `SKILL.md`, `references/reglas.md` (L285) y extender el test automatizado del Plan 1 (T6.2) | `§6.1`.1, `.3`, `.6`, `RF-13`.3 |
| T6.5 | Código muerto de cliente | `next.config.ts` coexistiendo con `vite.config.ts`; resto de código muerto web de `P3-01` | `P3-01` (parte) |

---

### F7 — Accesibilidad WCAG 2.2 AA (`ENG-159`, Decisión 133)

Skills: `accessibility`, `playwright-best-practices`, `web-design-guidelines`.

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T7.1 | Contraste | Tema `Teens`: `text-amber-950` sobre `bg-zinc-950` y `text-zinc-100` sobre `bg-emerald-50` (`1.19:1–2.35:1`); botones `bg-amber-500 text-white` en Kids/Teacher (`2.15:1`). Puntos de partida: `juegos-client.tsx#L135-L162`, `progreso-client.tsx#L62-L153`, `MatchGame.tsx#L265-L370`, vista previa de juegos | `P1-13`.1 |
| T7.2 | Landmarks y `SkipLink` | `layout.tsx#L36-L46`: la navegación sale de `<main id="main-content">`; eliminar `<main>` anidado; `SkipLink` salta realmente la navegación | `P1-13`.2 |
| T7.3 | Juegos | `MemoryGame` (`#L162`) y `TimedChoiceGame`: mantener el foco al deshabilitar botones; `aria-live` en todos los juegos; objetivos táctiles `>= 24x24 px` en `DragDropGame` (`w-6 h-6` sin `aria-label`) y `OrderWordsGame` | `P1-13`.3-4 |
| T7.4 | `axe` con `wcag22aa` | `.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` en todas las rutas autenticadas; ampliar de 2 specs (5 de 30 rutas) a la cobertura completa | `P1-13`.5, `RF-14`.5, §6.3 |

---

### F8 — E2E, operación, cierre documental y verificación final

| ID | Tarea | Detalle | Cierra |
| --- | --- | --- | --- |
| T8.1 | Reparar specs E2E | `spec-06-microgames.spec.ts#L83`, `spec-08-stats-and-leaderboard.spec.ts#L190-L296`, `spec-03-04-teacher-management.spec.ts#L208`; eliminar el test vacuo `if (await banner.isVisible())` de `spec-09#L82` (aserciones no condicionales) | `P2-08` (web) |
| T8.2 | Nuevos E2E de regresión | Navegador real con cookies `HttpOnly`/`Secure` locales y colas IndexedDB (causa raíz §1.3): sesión > 15 min, dos pestañas, logout, grabación con cambio de alumno, traslado con reintento vigente, coma decimal, `open_question` multi-pregunta, «Jugar de nuevo», foco en modales, editor multi-oración sin truncar | §1.3, `RF-2`, `RF-6`, `RF-9` |
| T8.3 | Flujos de punta a punta | Recorrer los 10 pasos del estudiante y los 8 de la maestra (§4.1 y §4.2) y verificar cada uno | §4 |
| T8.4 | `CONTEXT.md` — resto | `§1`: corregir el conteo de tests (reales: 566 = 65 `shared` + 353 `api` + 148 `web`; la suma anterior `65 + 490` era imposible), `§8` L272 y `AGENTS.md` L49: reflejar el estado real de Serwist una vez instalado; `§11.1`: corregir «448 tests unitarios» | §3.1.3, §3.3.1 |
| T8.5 | `SPEC-11 §12` e informe | Dejar `§12` de `SPEC-11` y `planning/informe-etapa-12.md` fieles al estado real, con salida adjunta de verificación (no declarar «verificada» sin evidencia) | §3.1.3, §6.3 |
| T8.6 | Pendientes operativos | Subdominios bajo el mismo dominio raíz (`app.`/`api.`) para que las cookies `SameSite=Lax` funcionen en Safari/iPadOS sin bloqueo ITP; CORS y ciclo de vida en Cloudflare R2 real; `SPF`/`DKIM`/`DMARC` en Resend (`ENG-003`, `ENG-004`) | §7.2.3 |
| T8.7 | Pendientes legales y de piloto | Texto jurídico definitivo de `/terminos` conforme a la Ley 1581 de 2012 (o banner provisional de T4.8), formato de autorización parental previa a «Aprobar», Sentry/GlitchTip sin PII, backup/restore en Neon, manual docente (`ENG-139`, `ENG-007/008`, `ENG-131/132/135`, `DOC-06`) | §7.2.4 |
| T8.8 | Hashes finales | Recalcular `skills-lock.json` tras T6.4 (`P3-06`) | `P3-06` |
| T8.9 | Verificación final | Con PostgreSQL, MinIO y Mailpit activos: `pnpm db:generate && pnpm lint && pnpm typecheck && pnpm test && pnpm build`, `check-guardrails.mjs --all`, `check-spec.mjs` (`SPEC-01..11`) y Playwright E2E completo con cookies `Secure` locales y `axe` `wcag22aa`. `Exit 0` en todos, con salida adjunta (`verification-before-completion`) | §8.2 paso 5 |
| T8.10 | Revisión | `code-review`, `security-review` y `englove-guardrails` sobre el diff del Plan 2 | §6.3 |

---

## 5. Matriz de trazabilidad: hallazgos de la auditoría → este plan

| Hallazgo | Mitad cliente/cierre (Plan 2) | Mitad servidor (Plan 1) |
| --- | --- | --- |
| `P0-01` | — | T2.1 |
| `P0-02` | T2.1 | T2.2, T2.4 |
| `P0-03` | T2.2, T2.3 | T2.2, T2.3 |
| `P0-04` | T2.4, T2.5 | — |
| `P0-05` | T1.4, T2.6, T2.7 | — |
| `P0-06` | T1.3 | — |
| `P0-07` | T1.2 | — |
| `P0-08` | T3.1–T3.3, T6.4 | T6.1 |
| `P0-09` | T1.1, T5.1 | T3.9 |
| `P0-10` | — | T4.2 |
| `P1-01` | — | T2.7 |
| `P1-02` | — | T3.4, T3.6 |
| `P1-03` | T4.3 | T3.4, T3.5 |
| `P1-04` | — | T3.3 |
| `P1-05` | T4.5, T5.6 | T4.3 |
| `P1-06` | — | T3.1, T3.8 |
| `P1-07` | T4.4 | T3.7 |
| `P1-08` | T4.1, T5.3, T5.4 | — |
| `P1-09` | T4.6 (verificación) | T3.10 |
| `P1-10` | T5.2 | T5.4 |
| `P1-11` | T5.7 (verificación) | T4.4–T4.6 |
| `P1-12` | — | T2.3, T2.5, T2.6 |
| `P1-13` | T7.1–T7.4 | — |
| `P1-14` | T1.1, T1.5, T6.1–T6.4 | T5.1 |
| `P1-15` | — | T1.1–T1.3 |
| `P2-01` | — | T2.8 |
| `P2-02` | T2.1 | T1.8, T2.4, T2.5 |
| `P2-03` | — | T3.11, T3.13 |
| `P2-04` | T4.2 | T3.2 |
| `P2-05` | — | T5.2 |
| `P2-06` | — | T3.12 |
| `P2-07` | — | T1.4 |
| `P2-08` | T8.1 | T5.5 |
| `P2-09` | T8.2 (job CI de Playwright, con T1.6) | T1.5–T1.7 |
| `P2-10` | T3.4, T5.5 | — |
| `P2-11` | T0.1–T0.9, T8.4, T8.5 | T0.1–T0.9 |
| `P3-01` | T4.9, T6.5 | T4.1, T5.3 |
| `P3-02` | T1.2 (consume códigos) | T5.4 |
| `P3-03` | T4.7 | — |
| `P3-04` | T4.8, T8.7 | — |
| `P3-05` | T0.9 | — |
| `P3-06` | T8.8 | T6.3 |
| `QA-01` | T3.1–T3.3 | T0.1 |
| `QA-02` | T2.1–T2.3 | T0.1, T2.2, T2.3 |
| `QA-03` | T5.3, T0.1 | T0.1 |
| `QA-04` | T6.1–T6.4 | T0.1, T5.1 |
| `QA-05` | T4.3 | T0.1, T3.4 |
| `QA-06` | T0.4 (spec) | T4.5 |
| `QA-07` | T5.1 | T0.1, T3.9 |
| `QA-08` | T2.1 | T1.4, T2.4 |

Cobertura por secciones de la auditoría:

- **§1:** compuertas finales y causa raíz → T8.2, T8.9. **§2.1:** no se tocan, y T8.2/T8.3 verifican que no se pierdan.
- **§2.2:** `RF-1` → T4.5, T5.5; `RF-2` → T2.1–T2.3; `RF-6` → T1.4, T2.4–T2.7, T4.1; `RF-7` → F3; `RF-8` → T4.4, T5.2, T4.8; `RF-9` → T1.1, T5.1; `RF-10` → T4.5; `RF-13` → F6; `RF-14` → F7; `RF-15` → T0.x, T8.1, T8.9 (el resto en Plan 1).
- **§3.1:** T0.5, T8.4, T8.5 (con T0.3 del Plan 1). **§3.2:** SPEC-03/06/07/08/09/10 → T0.1–T0.5 (SPEC-01/02/04/05 en el Plan 1). **§3.3:** `architecture-overview`, `sdd-process`, `taskboard`, informes históricos → T0.6–T0.8; `CONTEXT §1/§8/§11.1` y `AGENTS.md` → T8.4.
- **§4.1 y §4.2 (flujos):** reparaciones en F2, F4, F5; verificación en T8.3.
- **§6:** `englove-guardrails` (`G-C12`, `G-B04`, `G-C13`) → T6.4; `accessibility` + `playwright-best-practices` → F7, T8.1; hashes → T8.8; `verification-before-completion` → T8.9.
- **§7.1:** puntos 2, 3 (cliente), 4 (cliente), 5, 6 → F1–F7. **§7.2:** punto 3 (dominio, R2, Resend) → T8.6; punto 4 → T8.7.
- **§8:** `QA-01`..`QA-08` según matriz; §8.2 pasos 2 (cierre), 4 bloque D (Serwist, IndexedDB, editor, TanStack Query, `as Type`, WCAG) y 5 → F0, F2–F8.

---

## 6. Criterios de aceptación del Plan 2

1. Sesión de 30/90 días real: tras 15 min sin actividad no se pide login. Dos pestañas simultáneas no revocan la sesión. El logout revoca en BD.
2. Cero grabaciones o identidad del alumno anterior tras logout/login en tablet compartida (`deleteDatabase('englove_offline')`, `userId` obligatorio, singletons limpios).
3. Serwist instalado y funcional (o decisión de incompatibilidad registrada en `CONTEXT §14` con la salvaguarda de `SPEC-11 §11.4.2`). `public/sw.js` y `swPrecachePlugin` retirados.
4. Todos los flujos §4.1 y §4.2 operan de punta a punta: traslado de grupo con confirmación, coma decimal, `open_question` multi-pregunta, editor sin truncar y con UUID preservados, microjuegos con estrellas, mensajes y «Jugar de nuevo».
5. 25 de 25 vistas con API usan TanStack Query; 0 `as Type` en `apps/web`. `check-guardrails.mjs --all` sin errores, con `G-C12`, `G-B04`, `G-C13` activas y testeadas.
6. `axe` con `wcag22aa` sin violaciones en las rutas autenticadas. Modales, `SkipLink` y juegos verificados con teclado.
7. Las 11 specs alineadas y con fila en `§12`. `CONTEXT.md`, `AGENTS.md`, `README`, `planning/*` e informes históricos sin contradicciones listadas en la auditoría §3.
8. Verificación final con `Exit 0` real, adjunta, sobre todas las compuertas del paso 5 de §8.2, y ambos planes cerrados.
