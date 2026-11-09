# ISSUE-08: Banner Verde Duplicado ("¡Enviado!") y Disparo Invasivo en Cada Interacción del Juego

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** `/actividad/[attemptId]` y Layout del Estudiante (`StudentShell`)
- **Severidad:** Media (Experiencia de Usuario / Defecto Visual Severo)
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

> [!NOTE]
> **HALLAZGO HISTÓRICO — 100% SUBSANADO Y VERIFICADO (2026-11-08).**  
> Subsanado e integrado en la **Etapa 12 («Calidad y remediación»)** bajo [`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md) y blindado con pruebas de regresión automáticas en el monorepo (tarea ENG-155).

---

## 1. Síntoma / Descripción del Usuario

*"cuando se entra al juego y se tiene un acierto en la pantalla sale una linea muy fea y duplicada que me parece que no cumple ninguna funcion"*

- En la captura aportada por el usuario (`Vocabulary Match: Animals & Objects`):
  - Justo debajo de la barra superior de navegación aparecía una franja verde de ancho completo con el mensaje: `✓ ¡Enviado!`
  - Inmediatamente debajo, encima del contenedor de la actividad, aparecía una segunda franja verde con bordes redondeados con el mismo mensaje: `✓ ¡Enviado!`
- Cada vez que el estudiante realizaba una acción (por ejemplo, emparejar correctamente una palabra), ambas franjas verdes parpadeaban y permanecían visibles en pantalla durante 4 segundos.

---

## 2. Diagnóstico Técnico y Causa Raíz

1. **Duplicación del Componente en el Árbol DOM:**
   - `StudentShell` (`apps/web/src/components/student-shell.tsx`) renderizaba `<OfflineStatusBanner />` globalmente en el layout.
   - `ActividadRunner` (`apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`) también renderizaba localmente `<OfflineStatusBanner />`.
   - Al estar uno dentro de otro, ambos escuchaban el estado reactivo simultáneamente y se superponían.

2. **Disparo Erróneo de `justFlushed` en Conexión Normal:**
   - En `apps/web/src/lib/offline-queue.ts`, tras completarse un envío exitoso a la API, la condición `remaining === 0` encendía `justFlushed = true` de forma indiscriminada por 4 segundos, incluso cuando el usuario nunca estuvo offline.

---

## 3. Solución Implementada y Verificación

1. **Eliminación del Banner Duplicado:**
   - Se removió la instancia redundante `<OfflineStatusBanner />` de `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx` (antigua línea 736), manteniendo única y limpiamente el banner global en `StudentShell`.

2. **Condicionamiento de `justFlushed` a Reconexión Real:**
   - En `apps/web/src/lib/offline-queue.ts`:
     - Se introdujo la bandera interna `hasBeenOffline`.
     - Solo se activa cuando el navegador dispara el evento `window.addEventListener('offline')` o cuando una petición de red falla y activa la cola de reintentos (`scheduleBackoffRetry()`).
     - Al completarse el vaciado (`executeFlush`), `justFlushed = true` únicamente se activa si `hasBeenOffline` era `true`.
     - En el juego online normal y continuo, la sincronización es invisible y no interrumpe al estudiante con alertas.

3. **Deduplicación de Peticiones Concurrentes de Refresh Token:**
   - En `apps/web/src/app/(public)/login/page.tsx`, se migró el refresco silencioso a `fetchSharedSession()`, evitando que peticiones paralelas compitan por el mismo refresh token y provoquen 401 por rotación prematura.

4. **Verificación:**
   - Se ejecutaron las pruebas unitarias de `apps/web` con 142 pruebas exitosas (`vitest run test/offline-queue.spec.ts`).
   - Se verificó que el banner ya no se monta por duplicado y solo se activa ante eventos offline genuinos.
