# ISSUE-09: Bloqueo Transitorio de Actividades por Límite de Rate Limiting (Error 429 RATE_LIMITED)

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** API Global (`RateLimiterGuard` / `RateLimiterService`) y Runner del Estudiante (`/actividad/[attemptId]`)
- **Severidad:** Alta (Bloquea la apertura de actividades durante sesiones continuas de juego o pruebas intensivas)
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

> [!NOTE]
> **HALLAZGO HISTÓRICO — 100% SUBSANADO Y VERIFICADO (2026-11-08).**  
> Subsanado e integrado en la **Etapa 12 («Calidad y remediación»)** bajo [`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md) y blindado con pruebas de regresión automáticas en el monorepo (tarea ENG-155).

---

## 1. Síntoma / Descripción del Usuario

*"mira chrome me salio un error entrando a una actividad"*

Al intentar abrir la actividad `Complete with Present Simple` tras haber jugado varias partidas previas en la misma sesión, la pantalla del navegador mostró el estado de error:

- **Emoji / Icono:** ⚠️
- **Título:** *No pudimos abrir la actividad*
- **Mensaje:** *Has hecho varios intentos. Espera un momento y vuelve a intentar*
- **Botón:** *Volver al Inicio*

---

## 2. Evidencia Recolectada vía Chrome DevTools MCP

1. **Página Activa:**
   - URL: `http://localhost:3000/actividad/6fd20bbb-bf17-4826-9c73-a135eeb3b035`
   - Intento: `6fd20bbb-bf17-4826-9c73-a135eeb3b035`
   - Actividad: `Complete with Present Simple` (Fill in the blanks)
   - Estado en DB: `in_progress`

2. **Consola del Navegador:**
   - `[error] Failed to load resource: the server responded with a status of 429 (Too Many Requests) [9 times]`

3. **Traza de Peticiones de Red (Network Log):**
   - `reqid=2537 GET http://localhost:3001/api/v1/me/assignments [429]`
   - `reqid=2541 GET http://localhost:3001/api/v1/feature-flags [429]`
   - `reqid=2542 GET http://localhost:3001/api/v1/attempts/6fd20bbb-bf17-4826-9c73-a135eeb3b035 [429]`
   - `reqid=2543 GET http://localhost:3001/api/v1/me [429]`
   - `reqid=2545 GET http://localhost:3001/api/v1/feature-flags [429]`
   - `reqid=2546 GET http://localhost:3001/api/v1/attempts/6fd20bbb-bf17-4826-9c73-a135eeb3b035 [429]`
   - `reqid=2547 GET http://localhost:3001/api/v1/me [429]`

4. **Comprobación tras Vencimiento de Ventana:**
   - Tras esperar a que se cumpliera la ventana de 60 segundos del limitador, se recargó la página y la actividad abrió sin ningún error, mostrando la pregunta y el campo de texto normalmente.

---

## 3. Diagnóstico Técnico y Causa Raíz

1. **Presupuesto de Peticiones en `RateLimiterGuard` (`apps/api`):**
   - Según `architecture-overview.md §8.3` y `SPEC-02 §4`:
     - El límite para usuarios autenticados es de **120 peticiones por minuto** por usuario (`api:user:${user.id}`).
   - La arquitectura especifica que:
     *"Los límites son moderados: bloquean ataques automatizados sin afectar el uso normal."*

2. **Amplificación de Peticiones en el Frontend (`apps/web`):**
   - Durante una sesión de juego activo o pruebas consecutivas (por ejemplo, jugar *Speed Quiz*, *Memory Cards*, *Animals*, *Nature* y luego pasar a una actividad de gramática en 2 minutos):
     - **En cada navegación de página:**
       - `StudentShell` consulta `GET /api/v1/me`.
       - `StudentNav` consulta `GET /api/v1/feature-flags`.
       - La página consulta sus asignaciones (`/api/v1/me/assignments?scope=available` y `continuity`).
       - En modo desarrollo (React Strict Mode), los `useEffect` de montaje se ejecutan dos veces, duplicando las consultas de flags y perfil.
     - **En cada interacción de juego:**
       - Cada carta volteada, cada opción seleccionada o cada emparejamiento invoca `enqueueEvent()`.
       - `enqueueEvent()` llamaba inmediatamente a `triggerFlush()`, enviando una petición HTTP `POST /api/v1/attempts/:id/events` por cada micro-acción individual sin esperar acumulación en lote.
     - **Suma acumulada:**
       - Un juego de 30-40 segundos puede generar entre 12 y 18 peticiones HTTP.
       - Jugar 3 o 4 partidas seguidas en 90 segundos genera **más de 120 peticiones HTTP**, agotando el cupo del usuario en la ventana rodante de 60 segundos.

3. **Efecto Cascada:**
   - Al llegar a la petición #121, `RateLimiterGuard` rechaza indiscriminadamente cualquier llamada HTTP con `429 RATE_LIMITED`.
   - Cuando el alumno abre la siguiente actividad, la carga del runtime (`GET /api/v1/attempts/:id`) es rechazada con 429, activando la pantalla de error: *"Has hecho varios intentos. Espera un momento y vuelve a intentar"*.

---

## 4. Solución Implementada y Verificación

1. **Micro-Batching de Eventos en `apps/web/src/lib/offline-queue.ts`:**
   - Se implementó `scheduleDebouncedFlush(250)` en `enqueueEvent`.
   - Múltiples interacciones continuas (volteo de cartas, selección de opciones, mecanografía) acumulan sus eventos en IndexedDB y se envían en una única petición HTTP en lote `POST /events` (de hasta 50 eventos) en lugar de una petición por cada clic.
   - Las llamadas explícitas a `triggerFlush()` (como al completar la actividad o al pulsar "Jugar de nuevo") cancelan el temporizador pendiente y sincronizan inmediatamente sin retraso.

2. **Caché en Memoria y Deduplicación de Feature Flags (`apps/web/src/lib/feature-flags-client.ts`):**
   - Se creó `fetchSharedFeatureFlags()` con deduplicación de promesas en vuelo y caché en memoria con TTL de 60 segundos.
   - `StudentNav` y `JuegosClient` ahora consumen `fetchSharedFeatureFlags()`, eliminando las consultas duplicadas redundantes a `GET /api/v1/feature-flags` en cada transición de ruta.

3. **Deduplicación de Peticiones de Perfil (`apps/web/src/lib/auth-session.ts`):**
   - Se implementó `fetchSharedProfile()` para compartir la promesa y caché en memoria de `GET /api/v1/me`.
   - `StudentShell` y `ActividadRunner` reutilizan la misma consulta de perfil, reduciendo a la mitad el tráfico inicial al abrir cualquier actividad.
   - Se integró la limpieza de estas cachés en `clearSharedDeviceSession()` de `auth-hygiene.ts` para garantizar el aislamiento entre sesiones.

4. **Pruebas y Verificación:**
   - Se agregó prueba unitaria específica en `apps/web/test/offline-queue.spec.ts` validando que eventos emitidos en ráfaga son agrupados en un solo `POST /events` tras 250 ms.
   - 144/144 pruebas de `@englove/web` en verde.
   - 338/338 pruebas de `@englove/api` en verde.
   - 65/65 pruebas de `@englove/shared` en verde.
   - `pnpm guardrails`: 0 errores.
   - `pnpm typecheck`: 0 errores.
   - `pnpm lint`: 0 errores.
