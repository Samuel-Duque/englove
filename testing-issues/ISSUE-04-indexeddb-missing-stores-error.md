# ISSUE-04: Error en consola en juegos/actividades (`NotFoundError` en IndexedDB `pendingEvents`)

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** `/actividad/[attemptId]` (Juego de Emparejar / Runner de Actividades)
- **Severidad:** Alta (rompe la cola de persistencia offline/sincronización y genera `Uncaught (in promise) NotFoundError` en cada interacción del juego)
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

> [!NOTE]
> **HALLAZGO HISTÓRICO — 100% SUBSANADO Y VERIFICADO (2026-11-08).**  
> Subsanado e integrado en la **Etapa 12 («Calidad y remediación»)** bajo [`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md) y blindado con pruebas de regresión automáticas en el monorepo (tarea ENG-155).

---

## 1. Síntoma / Descripción del Usuario
Al jugar una actividad (por ejemplo, el juego de emparejar *MatchGame* en `/actividad/dc5052d2-6eba-462e-85ed-cd6b21b397c5`), al unir o seleccionar elementos aparece el siguiente error no capturado en la consola de Chrome DevTools:

```text
Uncaught (in promise) NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.
  at (offline-queue.ts:116:19)
  at enqueueEvent (offline-queue.ts:115:10)
  at (actividad-runner.tsx:261:35)
  at handleAnswerChange (actividad-runner.tsx:284:5)
  at handleLink (MatchGame.tsx:89:12)
```

---

## 2. Inspección Técnica y Evidencia

### 2.1 Inspección en Vivo de IndexedDB (Chrome DevTools MCP)
Mediante `evaluate_script` en la página activa, se consultó el estado real de IndexedDB en el navegador del usuario:
```json
[
  { "name": "englove_offline", "version": 1, "objectStores": [] },
  { "name": "englove_storage", "version": 1, "objectStores": [] }
]
```
**Resultado:** La base de datos `englove_offline` existe en versión `1`, pero su lista de almacenes de objetos (`objectStores`) está completamente vacía (`[]`).

### 2.2 Flujo que detona el error
1. El usuario interactúa con el juego (arrastra y une dos tarjetas).
2. Se dispara `handleLink` en `MatchGame.tsx:89`.
3. Llama a `handleAnswerChange(itemId, value)` en `actividad-runner.tsx:284`.
4. Llama a `sendEvent(...)` en `actividad-runner.tsx:261`:
   ```ts
   const promise = enqueueEvent({
     userId: currentUserId,
     attemptId,
     clientEventId,
     eventType: 'answered',
     payload: { itemId, answer },
     attemptToken,
   }).then(() => {});
   ```
5. `enqueueEvent` en `apps/web/src/lib/offline-queue.ts:114-116` hace:
   ```ts
   const db = await openOfflineDb();
   const tx = db.transaction(EVENTS_STORE, 'readwrite'); // EVENTS_STORE = 'pendingEvents'
   ```
6. Como `pendingEvents` no existe en la base de datos abierta, la API de IndexedDB del navegador lanza inmediatamente `NotFoundError: One of the specified object stores was not found`.
7. Como la promesa en `actividad-runner.tsx` no tiene bloque `.catch()`, se convierte en un `Uncaught (in promise)`.

---

## 3. Causa Raíz

### ¿Por qué `englove_offline` se creó con `objectStores: []` vacíos?

El culpable es la función de higiene de sesión en [`apps/web/src/lib/auth-hygiene.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/auth-hygiene.ts#L24):

```ts
// auth-hygiene.ts (líneas 18-35)
const dbNames = ['englove_offline', 'englove_storage'];
await Promise.allSettled(
  dbNames.map(
    (name) =>
      new Promise<void>((resolve) => {
        try {
          const req = window.indexedDB.open(name); // <-- CRÍTICO: llamada sin versión ni onupgradeneeded
          req.onsuccess = () => {
            const db = req.result;
            // ...
          };
        }
      })
  )
);
```

1. **Creación prematura sin almacenes:**
   Cuando `clearSharedDeviceSession()` se ejecuta (por ejemplo, en el login/logout o carga inicial de higiene), invoca `window.indexedDB.open(name)` **sin especificar versión y sin proveer un manejador `onupgradeneeded`**.
   Según la especificación W3C de IndexedDB, si la base de datos no existía aún en el navegador, el navegador la crea automáticamente con **versión 1** y **cero object stores**.
2. **`onupgradeneeded` nunca se vuelve a disparar:**
   Cuando más adelante el juego abre la base de datos mediante [`apps/web/src/lib/offline-queue.ts:90`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/offline-queue.ts#L90):
   ```ts
   const DB_VERSION = 1;
   const request = window.indexedDB.open(DB_NAME, DB_VERSION);
   ```
   El navegador detecta que la base de datos `englove_offline` ya existe y su versión es `1`. Dado que `solicitada == existente == 1`, **el evento `onupgradeneeded` NO se ejecuta**.
3. **Corrupción permanente del estado local:**
   La base de datos queda congelada en versión 1 sin los stores `pendingEvents` ni `pendingUploads`. Toda llamada futura a `db.transaction('pendingEvents')` falla irrecuperablemente hasta que se borre la base de datos o se incremente la versión.
4. **Falta de manejo de errores en `sendEvent`:**
   En `actividad-runner.tsx`, la promesa devuelta por `enqueueEvent` no tiene `.catch()`, por lo que el error revienta directamente a la consola.

---

## 4. Archivos Involucrados

1. [`apps/web/src/lib/auth-hygiene.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/auth-hygiene.ts#L18-L35) — Creación accidental de bases de datos vacías al llamar `window.indexedDB.open(name)` sin versión ni `onupgradeneeded`.
2. [`apps/web/src/lib/offline-queue.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/offline-queue.ts#L41-L44) y [#L85-L107](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/offline-queue.ts#L85-L107) — Definición de versión fija `DB_VERSION = 1` y falta de verificación de si los stores existen al abrir.
3. [`apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx#L261-L274) — Omisión de `.catch()` en la promesa de `enqueueEvent`.

---

## 5. Posibles Soluciones a Evaluar (para la sesión de fixes)

> *Estas opciones son propuestas preliminares para decisión futura:*

- **Posible Solución 1 (Corrección en `auth-hygiene.ts` - Preventiva):**
  En `clearSharedDeviceSession`, no abrir ciegamente bases de datos con `indexedDB.open(name)`. Se puede verificar primero si la base de datos existe con `indexedDB.databases()`, o si `db.objectStoreNames.length === 0`, cerrarla inmediatamente y eliminarla (`indexedDB.deleteDatabase(name)`).
- **Posible Solución 2 (Auto-reparación y versionado en `offline-queue.ts` - Defensiva):**
  - Incrementar `DB_VERSION` a `2` (o verificar dinámicamente si faltan los almacenes requeridos).
  - En `openOfflineDb()`, si al completarse `request.onsuccess` se detecta que `!db.objectStoreNames.contains(EVENTS_STORE)`, cerrar la conexión y forzar una actualización (reabrir con versión superior o recrear).
- **Posible Solución 3 (Manejo de promesas en `actividad-runner.tsx`):**
  Agregar `.catch((err) => { console.warn('Offline enqueue fallback:', err); })` a la promesa en `sendEvent` para que una falla en IndexedDB no interrumpa la experiencia del juego ni genere errores no capturados en consola.

---

## 6. Solución Implementada y Verificación (2026-11-06)

1. **Blindaje de Higiene de Sesión (`auth-hygiene.ts`):**
   En [`apps/web/src/lib/auth-hygiene.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/auth-hygiene.ts), cuando el navegador no cuenta con `indexedDB.databases()`, la llamada a `open()` incluye un manejador `onupgradeneeded` que comprueba si `event.oldVersion === 0`. En tal caso aborta inmediatamente la transacción y cierra la base de datos, impidiendo que se creen bases de datos huérfanas con versión 1 y cero object stores.
2. **Elevación de Versión y Auto-Reparación Limpia (`offline-queue.ts`):**
   En [`apps/web/src/lib/offline-queue.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/offline-queue.ts):
   - Se elevó la constante `DB_VERSION` a `2`.
   - Se implementó auto-recuperación determinista en `openOfflineDb()`: si al abrir la base de datos se detecta que los almacenes esperados (`pendingEvents`, `pendingUploads`) no existen (resultado de bases creadas corruptas previamente), se cierra la conexión y se invoca `window.indexedDB.deleteDatabase(DB_NAME)` antes de volver a abrir limpiamente a `DB_VERSION = 2`. Esto previene de raíz el error `VersionError` que provocaría intentar abrir con `version + 1`.
3. **Manejo Defensivo de Promesas en Actividades (`actividad-runner.tsx`):**
   En [`apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx):
   - Se dotó a `clearLocalRecording` de manejador `onupgradeneeded` para garantizar la existencia de `pendingUploads` en `englove_storage`.
   - Se blindó `sendEvent` con `.catch((error) => console.warn('No se pudo encolar evento offline de forma no bloqueante:', error))`, evitando que fallos de almacenamiento local detonen excepciones no capturadas `Uncaught (in promise)` que interrumpan la partida del estudiante.
4. **Verificación:**
   - Se crearon pruebas dedicadas en [`apps/web/test/auth-hygiene.spec.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/test/auth-hygiene.spec.ts) y [`apps/web/test/offline-queue.spec.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/test/offline-queue.spec.ts), verificando la auto-recuperación de bases de datos con 0 almacenes y el comportamiento ante desconexión.
   - Las 142 pruebas del paquete `@englove/web` pasaron exitosamente.
