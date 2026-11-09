# ISSUE-05: Diagnóstico Sistémico del Módulo de Microjuegos y Cola de Eventos

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** `/juegos` y `/actividad/[attemptId]` (Zona de Juegos, Microjuegos y Actividad Runner)
- **Severidad:** Crítica (Afecta transversalmente a todos los juegos: Match, Order Words, Drag & Drop, Memory, Timed Choice)
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

> [!NOTE]
> **HALLAZGO HISTÓRICO — 100% SUBSANADO Y VERIFICADO (2026-11-08).**  
> Subsanado e integrado en la **Etapa 12 («Calidad y remediación»)** bajo [`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md), formalizado en las Decisiones 130 a 137 de [CONTEXT §14](../.agents/CONTEXT.md#14-registro-de-decisiones-arquitectónicas-y-de-producto) y blindado con pruebas de regresión automáticas en el monorepo (tareas ENG-150 y ENG-155).

---

## 1. Síntoma / Descripción del Usuario
*"Bueno, parece que en general todo el módulo de juegos está roto."*
- Al jugar cualquier microjuego (Emparejar, Ordenar palabras, Clasificación por categorías, Memoria, Selección con tiempo), en cada interacción del usuario (arrastrar, soltar, unir o hacer clic) salta el error en la consola:
  ```text
  Uncaught (in promise) NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.
  ```
- Al terminar un juego, las respuestas no se reflejan adecuadamente en la calificación del servidor o el intento queda con calificación mínima / 0 estrellas, dando la impresión de que todo el módulo de juegos está completamente descompuesto.

---

## 2. Diagnóstico Técnico Integral: ¿Por qué parece que todo el módulo de juegos está roto?

Tras revisar la arquitectura de los 5 juegos, el runner y el backend, se identificaron **tres fallas encadenadas**:

### 2.1 Falla Central: IndexedDB sin almacén `pendingEvents` (Efecto de ISSUE-04)
- **Cadena de llamada:**
  1. El estudiante realiza un movimiento en el juego (ej: unir dos tarjetas en `MatchGame` o soltar un objeto en `DragDropGame`).
  2. El componente del juego dispara `onEvent({ itemId, answer })`.
  3. En `actividad-runner.tsx`, se captura en `handleAnswerChange` y se invoca `sendEvent(itemId, answer)`.
  4. `sendEvent` intenta registrar el movimiento invocando `enqueueEvent` (`apps/web/src/lib/offline-queue.ts`).
  5. Como la base de datos `englove_offline` fue creada vacía por `auth-hygiene.ts`, `enqueueEvent` intenta abrir `db.transaction('pendingEvents')` y **falla de forma catastrófica con `NotFoundError`**.
  6. **Consecuencia:** Como `actividad-runner.tsx` hace `enqueueEvent(...).then(...)` sin bloque `.catch()`, **cada movimiento en pantalla genera una excepción visible no capturada en consola**.

### 2.2 Desconexión de Sincronización hacia la Base de Datos
- Como `enqueueEvent` revienta en cada movimiento, **los eventos nunca se guardan en IndexedDB**.
- Por ende, la cola `flushQueue()` no tiene eventos pendientes en el navegador.
- En consecuencia, la petición `POST /api/v1/attempts/:id/events` **nunca se envía al backend**.
- En la base de datos PostgreSQL, el campo `attempts.payload.answers` permanece vacío (`{}`).

### 2.3 Condición de Carrera y Omisión de Payload en `/complete`
- Cuando el estudiante pulsa *"Finalizar juego / Finalizar clasificación"*:
  1. `actividad-runner.tsx` ejecuta `handleCompleteAttempt(finalAnswers)`.
  2. Dentro de `handleCompleteAttempt`, la llamada a la API es:
     ```ts
     const res = await fetch(`${apiUrl}/api/v1/attempts/${attemptId}/complete`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'x-attempt-token': attemptToken },
       body: JSON.stringify({ ...(finalMediaId ? { mediaId: finalMediaId } : {}) }),
     });
     ```
  3. **Problema estructural:** `POST /complete` **no envía las respuestas en el cuerpo**. Confía exclusivamente en que las respuestas ya hayan llegado previamente vía eventos a `attempts.payload.answers`.
  4. Además, `handleCompleteAttempt` **no espera a que la cola termine de vaciarse (`triggerFlush`)** antes de pedir la calificación.
  5. En el backend, `completeAttempt` en `attempts.service.ts` hace:
     ```ts
     const payload = (attempt.payload as { answers?: Record<string, unknown> }) || {};
     const answers = payload.answers || {};
     const scoreResult = this.scoringService.calculateGame(config, answerKey, answers);
     ```
  6. Al no tener respuestas en `attempt.payload`, el backend califica un examen en blanco (0 aciertos de N), asigna score `1.0` o `0.0`, y otorga 0 estrellas.

---

## 3. Estado de los 5 Microjuegos Individuales

A nivel de componentes UI y lógica de interacción, los juegos están implementados:
1. **`MatchGame.tsx` (Emparejar):** Mecánica interactiva operativa; emite `{ itemId: 'pairs', answer: Record<string, string> }`.
2. **`DragDropGame.tsx` (Clasificación por categorías):** Mecánica interactiva operativa; emite `{ itemId: 'placements', answer: Record<string, string> }`.
3. **`OrderWordsGame.tsx` (Ordenar palabras / tokens):** Operativo; emite `{ itemId: 'tokenIds', answer: string[] }`.
4. **`MemoryGame.tsx` (Memoria de cartas):** Operativo; emite `{ itemId: 'selections', answer: string[] }`.
5. **`TimedChoiceGame.tsx` (Selección con tiempo):** Operativo; emite `{ itemId: 'choices', answer: Record<string, string | null> }`.

**Conclusión:** Los 5 juegos no están rotos a nivel visual ni de reglas; lo que está roto es la **capa de transporte y persistencia de eventos** (`offline-queue` + `actividad-runner`) que los conecta con el backend y el guardado de notas.

---

## 4. Archivos Involucrados

1. [`apps/web/src/lib/auth-hygiene.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/auth-hygiene.ts#L24) — Crea la base de datos `englove_offline` corrupta/vacía.
2. [`apps/web/src/lib/offline-queue.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/offline-queue.ts#L113-L134) — Falla en `enqueueEvent` por no comprobar almacenes existentes y versión.
3. [`apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx#L261) y [#L436-L447](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx#L436-L447) — Omisión de `.catch()` en `sendEvent`, omisión de espera a `triggerFlush()` y falta de envío defensivo de respuestas finales en `POST /complete`.
4. [`apps/api/src/attempts/attempts.service.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/attempts/attempts.service.ts#L585-L587) — Espera exclusiva de respuestas desde `attempt.payload.answers`.

---

## 5. Soluciones Evaluadas y Adoptadas en la Etapa 12

> *Soluciones adoptadas formalmente en la Etapa 12 (ENG-150 y ENG-155):*

- **Posible Solución 1 (Arreglar la raíz de IndexedDB):**
  Corregir `auth-hygiene.ts` y elevar `DB_VERSION` en `offline-queue.ts` con creación garantizada de `pendingEvents`. Al sanar IndexedDB, los eventos se guardarán y vaciarán automáticamente.
- **Posible Solución 2 (Envío defensivo en `POST /complete`):**
  Permitir opcionalmente que `POST /api/v1/attempts/:id/complete` acepte un campo `answers` en el DTO/cuerpo. Si `attempt.payload.answers` está vacío (o hay respuestas más recientes enviadas al completar), el servidor las fusiona defensivamente para calificar sin depender exclusivamente de que el flush de eventos en background haya llegado milisegundos antes.
- **Posible Solución 3 (Asegurar vaciado antes de completar en Frontend):**
  En `handleCompleteAttempt`, invocar y esperar `await triggerFlush()` antes de enviar el fetch de `/complete`.
- **Posible Solución 4 (Manejo de errores en `sendEvent`):**
  Añadir un `.catch()` a `enqueueEvent` para que si IndexedDB falla o está bloqueado por permisos del navegador, el usuario pueda seguir jugando y la entrega se haga directamente vía HTTP.

---

## 6. Solución Implementada y Verificación (2026-11-06)

1. **Reparación del Transporte y Persistencia Base (IndexedDB):**
   Con la solución de ISSUE-04, la cola `pendingEvents` se crea y mantiene íntegra en versión 2, permitiendo que cada interacción de los 5 microjuegos se registre y vacíe normalmente sin excepciones.
2. **Propagación de Respuestas en la Cola de Eventos Offline (`offline-queue.ts`):**
   En [`apps/web/src/lib/offline-queue.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/lib/offline-queue.ts), el método `executeFlush()` fue corregido para extraer las respuestas encoladas en `completionEvent.payload.answers` y enviarlas en el cuerpo de la petición de completado a `/api/v1/attempts/:id/complete`.
3. **Soporte de Respuestas en el DTO y Contrato de `/complete`:**
   - En [`packages/shared/src/api/attempts.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/packages/shared/src/api/attempts.ts), se actualizó la interfaz `CompleteAttemptRequest` para incluir `answers?: Record<string, unknown>`.
   - En [`apps/api/src/attempts/dto/attempts.dto.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/attempts/dto/attempts.dto.ts), se decoró con `@IsOptional()` y `@IsObject()`.
4. **Fusión Defensiva en el Servidor (`attempts.service.ts`):**
   En [`apps/api/src/attempts/attempts.service.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/attempts/attempts.service.ts#L585-L600), `completeAttempt` ahora combina defensivamente las respuestas acumuladas en `attempt.payload.answers` con las respuestas recibidas en el cuerpo `dto.answers`. Si los eventos individuales en background sufren latencia de red, la finalización no califica en blanco ni otorga 0 estrellas injustamente.
5. **Flujo de Finalización en Frontend (`actividad-runner.tsx`):**
   En [`apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx), al pulsar terminar juego se envían las respuestas finales en el cuerpo y se asegura la sincronización previa llamando a `await triggerFlush()`.
6. **Verificación:**
   - Se crearon pruebas unitarias en [`apps/api/test/attempts.spec.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/test/attempts.spec.ts) validando que `/complete` califica exitosamente tanto con respuestas previas en payload como con respuestas enviadas en el body del DTO.
   - Las 14 pruebas de `attempts.spec.ts` y las 10 de `e2e-microgames-flow.spec.ts` pasaron con puntajes deterministas.
