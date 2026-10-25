# SPEC-06 — Microjuegos

| Campo | Valor |
| --- | --- |
| Estado | Verificada |
| Etapa | 6 — Microjuegos |
| Tareas | ENG-080, ENG-081, ENG-082, ENG-083, ENG-084, ENG-085, ENG-086, ENG-087 |
| Referencias | CONTEXT §2.3–§2.4, §3.2, §5.2, §6.2, §6.4, §8.1–§8.2, §10.3, §14 (decisiones 5, 7, 21, 25, 42, 61, 67, 74, 75, 81, 101, 104–106), §16–§17 · architecture §2.1, §3.1, §3.3, §3.4, §3.8, §4.5, §5.3, §7.5 · pbp Etapa 6 · sdd-process §3–§5 · SPEC-03 §4–§5 · SPEC-05 §3–§5 |
| Aprobada por / fecha | Líder del proyecto / 2026-10-25 |

## 1. Contexto y objetivo

Las Etapas 3 y 5 entregaron los esquemas Zod y el editor docente de las cinco mecánicas de microjuegos sobre `ActivityType = game` ([SPEC-03](./SPEC-03-gestor-de-contenidos.md)), junto con el motor de intentos, autocalificación, insignias y racha del portal del estudiante ([SPEC-05](./SPEC-05-portal-e-intentos.md)). En `SPEC-05`, el inicio de intentos sobre actividades `game` quedó resguardado tras el feature flag `games` hasta disponer de los componentes interactivos y calificadores de la Etapa 6.

`SPEC-06` especifica los 5 microjuegos (`match`, `order_words`, `drag_drop`, `memory`, `timed_choice`) en React + CSS / Framer Motion bajo `ActivityRuntimeProps`, sus calificadores deterministas en servidor (`ScoringService` en escala `0.0–5.0`, validación de `min_plausible_seconds` y generación de un `Attempt` individual calificado por separado en cada partida según la decisión 104), sonido (`Howler.js`), confeti (`canvas-confetti`), carga diferida de animaciones (`motion/kids.ts` y `motion/teens.ts`) y la zona «Juegos» (`/juegos`) detrás del flag `games`. Las preguntas `Q-01` a `Q-03` quedaron cerradas por las decisiones 104 a 106.

## 2. Alcance

- **Incluye:**
  - Contrato `ActivityRuntimeProps<TConfig, TAnswer>`, despachador `GameRenderer` en `apps/web/src/components/activities/`, vista previa (`previewMode = true`) en `/actividades/:id` y regla ESLint contra importar `lib/api` o `@tanstack/react-query` en `components/activities/`.
  - Microjuego `match` (emparejar pares) con serie de interacción híbrida (`@atlaskit/pragmatic-drag-and-drop`, toque/clic en dos pasos y teclado, decisión 105; `ENG-080`).
  - Microjuego `order_words` (ordenar palabras) con banco barajado de forma determinista y soporte táctil, clic, arrastre y teclado (`ENG-081`).
  - Microjuego `drag_drop` (clasificar objetos en destinos) con serie de interacción híbrida (`@atlaskit/pragmatic-drag-and-drop` + toque origen/destino + teclado, decisiones 81 y 105) y prueba en tablet Android real (`ENG-082`).
  - Microjuego `memory` (parejas de tarjetas) con barajado determinista por intento y reconstrucción en servidor de volteos (`ENG-083`).
  - Microjuego `timed_choice` (opción múltiple con cuenta regresiva), avance automático al vencer el tiempo y reinicio desde la primera pregunta y del temporizador al recargar un intento `in_progress` (decisión 106; `ENG-084`).
  - Scorers en `ScoringService` para las 5 mecánicas de `GameMechanic` (`0..1` → `0.0–5.0`), creación en `AttemptsService` de un `Attempt` individual (`attempt_number` incremental) con `graded` aparte por cada intento de `game` en ventana abierta (decisión 104) y `flags: ['implausible_duration']` cuando `durationSeconds < min_plausible_seconds` (`ENG-085`).
  - Sonido con `Howler.js` (activo en `kids`, silenciado en `teens`), celebración con `canvas-confetti` y carga diferida (`next/dynamic`) de `lib/motion/kids.ts` y `lib/motion/teens.ts` (`ENG-086`).
  - Zona «Juegos» (`/juegos`) detrás del flag `games`, a máximo 3 clics desde `/inicio`, con inicio de nuevos intentos individuales («Jugar de nuevo») y validada en tablet Android real (`ENG-087`).
- **No incluye:** motor **Phaser** o física 2D (Fase 2, `CONTEXT §2.4`, decisión 5); mecánicas fuera de `GameMechanic`; formularios docentes (`SPEC-03`); revisión manual y reintentos docentes de otros tipos (`SPEC-07`); vistas de analíticas y leaderboard (`SPEC-08`, que consumen los intentos individuales generados aquí); Service Worker offline (`SPEC-09`).

## 3. Requisitos funcionales

### RF-1 — Contrato `ActivityRuntimeProps`, despachador `GameRenderer` y vista previa interactiva

Tareas: `ENG-080` a `ENG-084`. Referencias: `architecture §3.4`, `SPEC-03 RF-21`.

Los microjuegos residen en `apps/web/src/components/activities/games/` y se invocan mediante `GameRenderer`, recibiendo solo `ActivityRuntimeProps<GamePublicConfig, GameAnswers>`: `config`, `initialState`, `theme` (`'kids' | 'teens'`), `soundEnabled`, `previewMode`, `onEvent` y `onComplete`. Ningún archivo bajo `apps/web/src/components/activities/` puede importar `lib/api` ni `@tanstack/react-query` (regla ESLint `no-restricted-imports`). Con `previewMode = true` (`/actividades/:id`), muestra «Vista previa: no se guardan respuestas» y simula el cierre en memoria sin crear filas en `Attempt`.

**Criterios de aceptación**:

- **Dado** un intento en curso o una vista previa docente sobre una actividad `type = 'game'`, **Cuando** `GameRenderer` monta el microjuego con `ActivityRuntimeProps`, **Entonces** renderiza la mecánica sin peticiones de red directas y emite progreso con `onEvent` y cierre con `onComplete`.
- **Dado** un archivo en `apps/web/src/components/activities/` que importa `apiFetch` o `@tanstack/react-query`, **Cuando** se ejecuta `pnpm lint`, **Entonces** ESLint falla por violar la frontera de módulo.
- **Dado** un docente en `/actividades/:id` editando un microjuego, **Cuando** abre «Previsualizar» (`previewMode = true`) y completa la partida, **Entonces** ve «Vista previa: no se guardan respuestas» y el resultado simulado con 0 llamadas a `/api/v1/attempts`.

### RF-2 — Microjuego `match` (Emparejar) con interacción híbrida

Tarea: `ENG-080`. Referencias: Decisiones 81 y 105, `SPEC-03 §4`, `architecture §2.1`, `§3.4`.

`MatchGame` presenta las columnas `left` y `right` de `MatchSettings` (`>= 2` pares). `right` se baraja de forma determinista con semilla derivada de `attemptId` (o de los IDs en `previewMode`), garantizando una permutación no paralela a `left`. Según la decisión 105, ofrece una serie de interacción híbrida activa simultáneamente: (a) arrastre con `@atlaskit/pragmatic-drag-and-drop`, (b) toque/clic en dos pasos (activar origen con `aria-pressed="true"` y tocar destino) y (c) teclado (`Tab`, `Enter`/`Space`, `Escape`). Cada tarjeta mide al menos `48 × 48 px`.

**Criterios de aceptación**:

- **Dado** un microjuego `match` con `N >= 2` pares, **Cuando** el estudiante inicia o recarga el intento `in_progress`, **Entonces** `right` aparece barajada de forma determinista y restaura `initialState.pairs`.
- **Dado** un ítem de `left` seleccionado por arrastre, toque en dos pasos o teclado, **Cuando** el estudiante lo vincula con uno de `right`, **Entonces** asigna `pairs[leftId] = rightId` (liberando vínculos previos de ambos), emite `onEvent({ itemId: 'pairs', answer: pairs })` y muestra feedback según `config.answerKey.solution.pairs`.
- **Dado** que el estudiante pulsa «Finalizar» con respuesta total o parcial, **Cuando** confirma la entrega, **Entonces** emite `onComplete({ pairs })` tras vaciar los eventos pendientes.

### RF-3 — Microjuego `order_words` (Ordenar palabras)

Tarea: `ENG-081`. Referencias: `SPEC-03 §4`, `architecture §3.4`.

`OrderWordsGame` presenta una línea de construcción y un banco con las fichas (`tokens`) de `OrderWordsSettings.tokens` (`>= 2` fichas) barajadas de forma determinista para diferir de `solution.tokenIds`. El estudiante mueve y reordena fichas entre el banco y la oración por toque/clic, arrastre (`@atlaskit/pragmatic-drag-and-drop`) o teclado (`Tab` + `Enter`/`Space`).

**Criterios de aceptación**:

- **Dado** un microjuego `order_words` cuyos `tokens` fueron creados en el orden de la oración, **Cuando** `OrderWordsGame` se monta, **Entonces** el banco presenta una permutación determinista distinta a `solution.tokenIds`.
- **Dado** un estudiante que coloca, reordena o retira una ficha, **Cuando** cambia la secuencia, **Entonces** actualiza `tokenIds` sin duplicados y emite `onEvent({ itemId: 'tokenIds', answer: tokenIds })`.
- **Dado** que el estudiante pulsa «Comprobar y finalizar», **Cuando** se invoca `onComplete({ tokenIds })`, **Entonces** cada posición `i` cuenta como acierto si el `text` del token en `i` coincide con el `text` del token esperado en `solution.tokenIds[i]`.

### RF-4 — Microjuego `drag_drop` (Arrastrar y soltar en categorías) con interacción híbrida

Tarea: `ENG-082`. Referencias: Decisiones 81 y 105, `SPEC-03 §4`, `architecture §3.8`, `pbp Etapa 6`.

`DragDropGame` muestra una bandeja de objetos (`DragDropSettings.objects`, barajada de forma determinista) y contenedores de categorías (`DragDropSettings.targets`, `>= 2` destinos). Según las decisiones 81 y 105, integra de serie la serie de interacción híbrida: (a) arrastre con `@atlaskit/pragmatic-drag-and-drop`, (b) toque/clic en dos pasos sin arrastre (tocar objeto con `aria-pressed="true"` y tocar categoría destino) y (c) teclado (`Tab`, `Enter`/`Space`, `Escape`).

**Criterios de aceptación**:

- **Dado** un microjuego `drag_drop` en tablet táctil o escritorio, **Cuando** el estudiante arrastra un objeto hacia un destino o lo activa por toque/teclado y elige el destino, **Entonces** asigna `placements[objectId] = targetId` y emite `onEvent({ itemId: 'placements', answer: placements })`.
- **Dado** un objeto ya ubicado en un destino, **Cuando** el estudiante lo mueve a otro destino o lo devuelve a la bandeja antes de entregar, **Entonces** actualiza o elimina la clave en `placements` y emite `onEvent`.
- **Dado** que el estudiante pulsa «Finalizar», **Cuando** confirma la entrega, **Entonces** muestra feedback frente a `config.answerKey.solution.placements` e invoca `onComplete({ placements })`.

### RF-5 — Microjuego `memory` (Memoria de tarjetas)

Tarea: `ENG-083`. Referencias: `SPEC-03 §4`, `architecture §3.4`.

`MemoryGame` dispone las tarjetas de `MemorySettings.cards` (par `>= 4`) boca abajo en cuadrícula responsiva, barajadas de forma determinista por `attemptId`. En cada turno el estudiante voltea dos tarjetas distintas (`[cardA, cardB]`); mientras están descubiertas se bloquea voltear una tercera. Al elegir la segunda tarjeta, añade `[cardA, cardB]` a `selections` y emite `onEvent({ itemId: 'selections', answer: selections })`.

**Criterios de aceptación**:

- **Dado** un tablero de `memory`, **Cuando** el estudiante voltea dos tarjetas `[cardA, cardB]` que forman pareja en `config.answerKey.solution.pairs`, **Entonces** quedan descubiertas y bloqueadas, reproduce feedback de acierto y registra `[cardA, cardB]` en `selections`.
- **Dado** que voltea dos tarjetas `[cardA, cardB]` que no forman pareja, **Cuando** transcurren `900 ms`, **Entonces** vuelven a ponerse boca abajo, aumenta el contador de fallos y `[cardA, cardB]` permanece en `selections`.
- **Dado** un intento `in_progress` con jugadas en `initialState.selections`, **Cuando** recarga la página, **Entonces** conserva el orden de casillas y mantiene descubiertas las parejas ya encontradas.

### RF-6 — Microjuego `timed_choice` (Opción múltiple con temporizador)

Tarea: `ENG-084`. Referencias: Decisión 106, `SPEC-03 §4`, `CONTEXT §3.2`.

`TimedChoiceGame` presenta las preguntas de `TimedChoiceSettings.questions` (`>= 1`) una por vez, con cuenta regresiva de `timeLimitSeconds` segundos (`5..120`, por defecto `20`). Según la decisión 106, al iniciar o al recargar/reanudar un intento `in_progress`, reinicia el intento desde la primera pregunta (`índice 0`, limpiando `choices`) y reinicia el temporizador completo (`timeLimitSeconds`) para ser justos con el estudiante.

**Criterios de aceptación**:

- **Dado** una pregunta activa con tiempo restante mayor a `0`, **Cuando** el estudiante elige `optionId`, **Entonces** detiene el reloj, registra `choices[questionId] = optionId`, emite `onEvent({ itemId: 'choices', answer: choices })`, muestra feedback por `800 ms` y avanza a la siguiente pregunta (o a `onComplete({ choices })` en la última).
- **Dado** una pregunta activa cuyo reloj llega a `0` sin selección, **Cuando** se agota el tiempo, **Entonces** registra `choices[questionId] = null`, emite `onEvent({ itemId: 'choices', answer: choices })`, resalta la opción esperada por `800 ms` y avanza automáticamente.
- **Dado** un intento `in_progress` de `timed_choice` donde el estudiante recarga la página o sufre un corte en una pregunta intermedia, **Cuando** se vuelve a montar `TimedChoiceGame`, **Entonces** reinicia desde la primera pregunta (`índice 0`) con `choices = {}` y el temporizador en `timeLimitSeconds` segundos.

### RF-7 — Scorers en servidor por `GameMechanic`, conversión `0.0–5.0` e intentos individuales (`Attempt`)

Tarea: `ENG-085`. Referencias: Decisiones 7, 21, 25, 42, 61, 74, 75 y 104; `CONTEXT §16.4`; `architecture §4.5`, `§7.5`; `SPEC-03 §4`.

`ScoringService` incorpora `calculateGame(config, answerKey, userAnswers, durationSeconds?, minPlausibleSeconds?)` con un scorer puro por cada `GameMechanic` que calcula la fracción en `[0, 1]` y la convierte con `this.fractionToScore(fraction)` (`Math.round(fraction * 5 * 10) / 10`). Según la decisión 104, en `ActivityType.game`, cuando el último intento del estudiante ya finalizó (`graded` o `abandoned`) y la asignación sigue abierta (`opens_at <= now <= effectiveDueAt`, `cancelled_at === null`, `flags.games === true`), `AttemptsService.startAttempt` crea un nuevo `Attempt` individual (`attempt_number = latestAttempt.attempt_number + 1`, `previous_attempt_id = latestAttempt.id`) sin exigir `retry_granted_at`. Al completarse, cada `Attempt` guarda su propio `status = 'graded'`, `score`, `graded_at`, `finished_at` y `ProgressEvent(attempt_completed)` para que el panel estadístico docente (`SPEC-08`) muestre la evolución del estudiante en cada intento.

**Criterios de aceptación**:

- **Dado** un intento de `ActivityType.game` en cualquiera de las 5 mecánicas, **Cuando** el estudiante invoca `POST /api/v1/attempts/:id/complete`, **Entonces** `AttemptsService` carga `game_detail` filtrando por `organization_id`, calcula la nota `0.0–5.0` en `ScoringService.calculateGame`, guarda `status = 'graded'`, `score`, `graded_at` y `finished_at` con reloj del servidor, emite `ProgressEvent(attempt_completed)`, evalúa insignias/racha y devuelve `CompletionView` con `correction`.
- **Dado** un estudiante que completó el intento `#1` (`status = 'graded'`) de una asignación `game` con ventana abierta, **Cuando** invoca `POST /api/v1/assignments/:assignmentId/attempts` para jugar de nuevo, **Entonces** crea una nueva fila en `Attempt` con `attempt_number = 2` y `previous_attempt_id = attempt1.id`, y al completarla la califica como un registro `graded` separado sin sobrescribir el intento `#1`.
- **Dado** un intento de `order_words` con dos tokens de idéntico `text`, **Cuando** el estudiante intercambia sus IDs manteniendo el texto de cada posición, **Entonces** el scorer otorga `fraction = 1.0` (`score = 5.0`).
- **Dado** un intento de `memory` con `total_pairs = 4` y 1 fallo previo (`4 / (4 + 1) = 0.8`), **Cuando** el servidor califica el intento aunque `selections` incluya jugadas posteriores sobre cartas ya resueltas, **Entonces** ignora esas jugadas posteriores y calcula `score = 4.0`.

### RF-8 — Validación de duraciones plausibles (`min_plausible_seconds`) y eventos de estado

Tarea: `ENG-085`. Referencias: Decisiones 75 y 106, `CONTEXT §16.5`, `SPEC-05 RF-7`, `RF-10`.

Al cerrar un intento `game`, el servidor calcula `durationSeconds = Math.max(0, Math.round((now.getTime() - attempt.started_at.getTime()) / 1000))` con su reloj y lo compara con `activity.min_plausible_seconds` (por defecto `15` s en `game`). En `POST /api/v1/attempts/:id/events`, cuando `ev.itemId` es `'pairs'`, `'tokenIds'`, `'placements'`, `'selections'` o `'choices'`, reemplaza `answers[ev.itemId]` con el valor enviado por cada `clientEventId` nuevo.

**Criterios de aceptación**:

- **Dado** una actividad `game` con `min_plausible_seconds = 15`, **Cuando** un intento se completa en `6` segundos según el reloj del servidor, **Entonces** `Attempt.flags` incluye `'implausible_duration'` y conserva su `score` en `[0.0, 5.0]`.
- **Dado** un intento `in_progress` donde se actualiza o reinicia el mapa en `{ itemId: 'placements' | 'choices', answer: { ... } }`, **Cuando** `submitEvents` procesa el nuevo `clientEventId`, **Entonces** `attempt.payload.answers[itemId]` refleja exactamente el mapa enviado sin conservar claves eliminadas.

### RF-9 — Efectos de sonido (`Howler.js`) y confeti (`canvas-confetti`) por segmento

Tarea: `ENG-086`. Referencias: `CONTEXT §3.2`, `architecture §2.1`, `§3.3`.

El runner incorpora `Howler.js` para tres eventos cortos (`hit`, `miss`, `complete`) y botón de silencio en cabecera. `soundEnabled` inicia en `true` para `kids` y en `false` para `teens`. Al completar una actividad autocalificada con `score >= 3.0` o desbloquear insignia, dispara `canvas-confetti` acorde al tema activo.

**Criterios de aceptación**:

- **Dado** un estudiante `kids` que abre un microjuego, **Cuando** se monta la actividad, **Entonces** el sonido inicia activo (`soundEnabled = true`); si es `teens`, inicia silenciado (`soundEnabled = false`) y puede activarlo con un toque/clic.
- **Dado** que `soundEnabled = false` o que el navegador bloquea el audio sin gesto previo, **Cuando** ocurre un acierto, fallo o cierre, **Entonces** el microjuego continúa sin lanzar errores no capturados.
- **Dado** un intento completado con `score >= 3.0`, **Cuando** se muestra el cierre y `prefers-reduced-motion` no está activo, **Entonces** se dispara `canvas-confetti` con la paleta del tema activo.

### RF-10 — Carga diferida de animaciones por tema (`motion/kids.ts` y `motion/teens.ts`)

Tarea: `ENG-086`. Referencias: Decisión 67, `architecture §3.1`, `§3.3`, `pbp Etapa 6`.

Las variantes de Framer Motion (`motion`) y presets de celebración se separan en `apps/web/src/lib/motion/kids.ts` y `apps/web/src/lib/motion/teens.ts` y se cargan con `next/dynamic` según el `ageSegment` activo.

**Criterios de aceptación**:

- **Dado** un estudiante con `ageSegment = 'kids'`, **Cuando** carga el portal o ejecuta un microjuego, **Entonces** descarga el chunk de `motion/kids` sin descargar `motion/teens` (y viceversa para `teens`).
- **Dado** el build de producción de `apps/web`, **Cuando** se inspeccionan los chunks con el analizador de bundle, **Entonces** `lib/motion/kids.ts` y `lib/motion/teens.ts` se emiten en chunks separados fuera del bundle inicial.

### RF-11 — Zona «Juegos» (`/juegos`) en el portal del estudiante detrás del feature flag `games`

Tarea: `ENG-087`. Referencias: Decisión 104, `CONTEXT §5.2`, `architecture §3.1`, `pbp Etapa 6`.

El portal incluye `apps/web/src/app/(student)/juegos/page.tsx` y el enlace «🎮 Juegos» en `StudentNav`, gobernados por `GET /api/v1/feature-flags`:

- Con `flags.games === true`, `StudentNav` muestra «🎮 Juegos» (`/juegos`) y lista las asignaciones del grupo activo con `activity.type === 'game'`, mostrando título, nivel CEFR, etiqueta de mecánica en español (`Emparejar`, `Ordenar palabras`, `Arrastrar y soltar`, `Memoria`, `Contra reloj`), `Intento #N`, estrellas del último intento calificado (`0..3`) y botón en 1 clic (`Empezar juego`, `Continuar juego` o `Jugar de nuevo` + `Ver último resultado` según la decisión 104).
- Con `flags.games === false`, «🎮 Juegos» se oculta del menú y, si se navega a `/juegos`, muestra estado informativo con enlace a `/inicio`.

**Criterios de aceptación**:

- **Dado** un tenant con `flags.games = true` y un estudiante con microjuegos asignados, **Cuando** entra a `/inicio`, pulsa «Juegos» (`clic 1`) y pulsa «Empezar juego» o «Jugar de nuevo» (`clic 2`), **Entonces** inicia un nuevo `Attempt` individual y abre `/actividad/:attemptId` en máximo 3 clics desde `/inicio`.
- **Dado** un tenant donde `flags.games` pasa a `false`, **Cuando** el estudiante carga `/inicio` o `/juegos`, **Entonces** oculta el enlace del menú, `/juegos` muestra aviso de sección no disponible sin error 500 y los intentos previos en `/progreso` permanecen intactos.

## 4. Reglas de negocio

1. **Calificación exclusiva en servidor (`CONTEXT §16.4`, decisiones 7 y 75):** Aunque `GamePublicConfig` incluye `answerKey` para feedback inmediato, el cliente jamás envía ni persiste `score`. `ScoringService` calcula la fracción `0..1` en servidor y la convierte a `0.0–5.0` con 1 decimal (`Math.round(fraction * 5 * 10) / 10`).
2. **Intentos individuales secuenciales en microjuegos (decisión 104):** Mientras la asignación `game` esté en su ventana abierta (`opens_at <= now <= effectiveDueAt`, `cancelled_at === null`, `flags.games === true`) y el estudiante no tenga un intento `in_progress`, puede iniciar un nuevo `Attempt` individual (`attempt_number = anterior + 1`, enlazado por `previous_attempt_id`). Cada intento genera su propio `graded` y `score` para que el panel estadístico docente (`SPEC-08`) muestre la evolución del estudiante en cada intento; los resúmenes de grupo usan `MAX(attempt_number)` calificado.
3. **Fórmulas de fracción `0..1` por mecánica (`SPEC-03 §4`):**
   - `match`: `correct_pairs / total_left_items`. Cada `leftId` suma `1` si `userAnswers.pairs?.[leftId] === solution.pairs[leftId]` sin reutilizar un `rightId` ya adjudicado.
   - `order_words`: `correct_positions / total_tokens`. El índice `i` suma `1` si `userAnswers.tokenIds?.[i]` existe en `settings.tokens`, no se repitió antes y su `text` coincide con el `text` del token esperado en `solution.tokenIds[i]`.
   - `drag_drop`: `correct_objects / total_objects`. Cada `objectId` suma `1` si `userAnswers.placements?.[objectId] === solution.placements[objectId]`.
   - `memory`: reconstrucción secuencial sobre `userAnswers.selections` (tope `200` tuplas), ignorando tuplas inválidas, cartas repetidas (`cardA === cardB`), IDs ajenos o jugadas con cartas de parejas ya resueltas. Cada pareja válida suma `1` a `found_pairs`; de lo contrario suma `1` a `failed_selections`. Si `found_pairs === 0`, `fraction = 0`; si `found_pairs > 0`, `fraction = found_pairs / (total_pairs + failed_selections)`.
   - `timed_choice`: `correct_questions / total_questions`. Cada pregunta suma `1` si `userAnswers.choices?.[question.id] === solution.choices[question.id]`; `null` u omitidas suman `0`.
4. **Estrellas derivadas visualmente (decisiones 7 y 101):** `0` si `score === 0.0` o `null`, `1` si `0.0 < score < 3.0`, `2` si `3.0 <= score < 4.5` y `3` si `score >= 4.5`.
5. **Barajado determinista por intento y reinicio en `timed_choice` (decisión 106):** En `match`, `order_words`, `drag_drop` y `memory`, el orden inicial se deriva de una función pura sembrada con `attemptId`. En `timed_choice`, recargar un intento `in_progress` reinicia desde la primera pregunta (`índice 0`) y reinicia el temporizador `timeLimitSeconds`.
6. **Duración plausible con reloj del servidor (`CONTEXT §16.5`, decisión 75):** Si `durationSeconds < activity.min_plausible_seconds`, añade `'implausible_duration'` a `Attempt.flags` sin alterar `score`.

## 5. Contrato de API

Se completa el soporte de `ActivityType.game` en las rutas existentes bajo `/api/v1`:

| Método y ruta | Rol | Entrada / Cabeceras | Respuesta y comportamiento para `ActivityType.game` |
| --- | --- | --- | --- |
| `GET /api/v1/feature-flags` | `student`, `teacher` | Cookie `access_token` | `200 { flags: { games, extra_content }, config }` para gobernar `/juegos`. |
| `GET /api/v1/me/assignments` | `student` | `scope?`, `offset?`, `limit?` | `200 AssignmentCardListResponse`. En `available` incluye `game` si `flags.games === true`, fijando `canStart = true` también cuando el último intento está `graded`/`abandoned` y la ventana sigue abierta (decisión 104). |
| `POST /api/v1/assignments/:assignmentId/attempts` | `student` | Cookie `access_token`, `Origin` | `201 RuntimeView` con `GamePublicConfig`. Con `flags.games === false`, `409 ACTIVITY_NOT_AVAILABLE`. En `game`, si el último intento finalizó y la ventana sigue abierta, crea un nuevo `Attempt` con `attempt_number = anterior + 1` y `previous_attempt_id` (decisión 104); si hay uno `in_progress`, `409 ATTEMPT_ALREADY_EXISTS`. |
| `GET /api/v1/attempts/:id` | `student` | Cookie `access_token` | `200 RuntimeView` con `game_detail` filtrado por `organization_id`. |
| `POST /api/v1/attempts/:id/events` | `student` | `{ events }`, `x-attempt-token`, `Origin` | `200 { acceptedEventIds }`. Idempotente por `clientEventId`; reemplaza `payload.answers[itemId]`. |
| `POST /api/v1/attempts/:id/complete` | `student` | `CompleteAttemptDto`, `x-attempt-token`, `Origin` | `200 CompletionView` con `attempt` (`status = 'graded'`, `score` `0.0–5.0`, `flags`), `correction` y `newBadges`. |

**Códigos de error:** `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 FORBIDDEN` (`NO_ACTIVE_GROUP`), `404 ATTEMPT_NOT_FOUND` / `ASSIGNMENT_NOT_FOUND`, `409 ACTIVITY_NOT_AVAILABLE` / `ATTEMPT_ALREADY_EXISTS` / `ATTEMPT_NOT_IN_PROGRESS` / `ATTEMPT_CLOSED`, y `500 SCORE_OUT_OF_RANGE`.

## 6. Modelo de datos

Se reutilizan sin migraciones DDL las tablas `Activity`, `GameDetail`, `Assignment`, `Attempt` y `FeatureFlag` de `apps/api/prisma/schema.prisma` (`SPEC-01`). El índice único `@@unique([assignment_id, student_id, attempt_number])` y `previous_attempt_id` (`@unique`) en `Attempt` soportan nativamente la secuencia de intentos individuales (`attempt_number = 1..N`) de la decisión 104.

Contratos en `packages/shared`:

- `GamePublicConfig`: `{ mechanic: GameMechanic, settings, answerKey }`.
- `GameAnswers` en `Attempt.payload.answers`: `match` (`{ pairs?: Record<string, string> }`), `order_words` (`{ tokenIds?: string[] }`), `drag_drop` (`{ placements?: Record<string, string> }`), `memory` (`{ selections?: Array<[string, string]> }`), `timed_choice` (`{ choices?: Record<string, string | null> }`).
- `correction` en `CompletionView`: mapa por ítem con `{ correct, expected..., submitted... }` en `match`, `order_words`, `drag_drop` y `timed_choice`, y `{ summary: { foundPairs, totalPairs, failedSelections }, pairs }` en `memory`.

## 7. Interfaz

| Ruta / Componente | Contenido y estados |
| --- | --- |
| `(student)/juegos/page.tsx` (`/juegos`) | Cabecera temática (`kids` / `teens`), filtros (`Todos`, `Por jugar`, `Completados`) y tarjetas `game` con mecánica en español, nivel CEFR, `Intento #N`, estrellas del último intento y botón en 1 clic (`Empezar juego`, `Continuar juego` o `Jugar de nuevo` + `Ver último resultado`). Vacío: «Aún no tienes juegos asignados». Flag inactivo: «La zona de juegos no está habilitada en este momento» + enlace a `/inicio`. |
| `actividad/[attemptId]/page.tsx` | Monta `GameRenderer` para `activity.type === 'game'`, botón `🔊 Escuchar` (`speechSynthesis`), interruptor de sonido (`Howler.js`, activo en `kids`, silenciado en `teens`) y cierre con nota `0.0–5.0`, estrellas, `canvas-confetti`, insignias y «Jugar de nuevo» si la ventana sigue abierta. |
| `(teacher)/actividades/activity-editor.tsx` | Modal de previsualización (`previewMode = true`) que monta `GameRenderer` con aviso «Vista previa: no se guardan respuestas» y selector `Kids` / `Teens`. |

**Accesibilidad y ergonomía táctil (`CONTEXT §3.2`, `§10.3`, decisión 105):**

- Máximo 3 clics desde `/inicio` hasta cualquier microjuego (`/inicio` → «🎮 Juegos» → botón de tarjeta).
- Objetivos táctiles `>= 48 × 48 px` (`min-h-12 min-w-12`), separación `>= 8 px` y `touch-action: manipulation`.
- Serie de interacción híbrida en `match` y `drag_drop`: arrastre con `@atlaskit/pragmatic-drag-and-drop`, toque/clic en dos pasos (origen → destino) y teclado (`Tab`, `Enter`/`Space`, `Escape`).
- Respeto a `prefers-reduced-motion: reduce` omitiendo confeti y giros bruscos.

## 8. Seguridad y privacidad

- **Aislamiento multi-tenant y anti-IDOR (`CONTEXT §16.3`):** Toda consulta sobre `GameDetail`, `Activity`, `Assignment`, `Attempt` y `FeatureFlag` filtra por `organization_id` del JWT, y en rutas de alumno por `student_id = req.user.studentId`. Recursos ajenos responden `404`.
- **Autorización de intento (`x-attempt-token` y CSRF):** `events` y `complete` verifican firma y vigencia de `x-attempt-token` vinculado a `(attemptId, studentId, organizationId)` y cabecera `Origin`.
- **Integridad de calificación y tiempos (`CONTEXT §16.4`, `§16.5`):** `ValidationPipe` con `whitelist: true` descarta campos extra; `ScoringService` recalcula el puntaje en servidor e ignora relojes del cliente para `started_at`, `finished_at`, `graded_at` y `durationSeconds`.
- **Acotación de payload en `memory`:** `ScoringService` procesa hasta `200` tuplas de `selections` y descarta entradas inválidas sin lanzar errores 500.
- **Privacidad en tablets compartidas (`CONTEXT §16.9`):** Cero PII en logs/Sentry; `clearSharedDeviceSession()` limpia IndexedDB y cachés al cerrar sesión.

## 9. Pruebas

| RF | Nivel | Prueba y comprobación principal |
| --- | --- | --- |
| `RF-1` | Unit + Lint (CI) | `SPEC-06 RF-1`: `GameRenderer` monta las 5 mecánicas con `ActivityRuntimeProps` y opera en `previewMode = true` sin red; ESLint falla si `components/activities/` importa `lib/api` o `@tanstack/react-query`. |
| `RF-2` | Unit + E2E Playwright | `SPEC-06 RF-2`: `MatchGame` baraja `right`, empareja con la serie híbrida (arrastre, toque en dos pasos y teclado), reemplaza vínculos y completa; rechaza `attemptId` ajeno con `404`. |
| `RF-3` | Unit + E2E Playwright | `SPEC-06 RF-3`: `OrderWordsGame` presenta el banco desordenado, mueve fichas sin duplicar IDs en `tokenIds` y evalúa por posición de texto. |
| `RF-4` | Unit + E2E + Tablet real | `SPEC-06 RF-4`: `DragDropGame` ubica y devuelve objetos con la serie híbrida (`@atlaskit/pragmatic-drag-and-drop`, toque origen + destino y teclado); prueba táctil en tablet Android real. |
| `RF-5` | Unit + E2E Playwright | `SPEC-06 RF-5`: `MemoryGame` bloquea tercera carta por `900 ms` en fallos, descubre parejas, restaura estado al recargar y registra `selections`. |
| `RF-6` | Unit + E2E Playwright | `SPEC-06 RF-6`: `TimedChoiceGame` registra elección antes de `0 s`, asigna `null` al vencer `timeLimitSeconds`, y al recargar un intento `in_progress` reinicia desde la primera pregunta (`índice 0`) y reinicia el temporizador. |
| `RF-7` | Unit + Integración | `SPEC-06 RF-7`: `ScoringService.calculateGame` califica las 5 mecánicas en `0.0–5.0`; jugar de nuevo un `game` ya `graded` en ventana abierta crea `Attempt` individual (`attempt_number + 1`) con su propio `graded` y `score`. |
| `RF-8` | Unit + Integración | `SPEC-06 RF-8`: intento con `durationSeconds < min_plausible_seconds` recibe `flags: ['implausible_duration']` con reloj del servidor; `submitEvents` reemplaza mapas al deshacer o reiniciar `timed_choice`. |
| `RF-9` | Unit + E2E | `SPEC-06 RF-9`: sonido inicia activo en `kids` y silenciado en `teens`, degrada sin error si el navegador bloquea audio y dispara `canvas-confetti` con `score >= 3.0` respetando `prefers-reduced-motion`. |
| `RF-10` | Build / Bundle | `SPEC-06 RF-10`: `lib/motion/kids.ts` y `lib/motion/teens.ts` se importan con `next/dynamic` por `ageSegment` en chunks separados fuera del bundle inicial. |
| `RF-11` | Integración + E2E + Tablet | `SPEC-06 RF-11`: con `flags.games = true`, `/juegos` lista los microjuegos del grupo activo y abre o vuelve a jugar (`Jugar de nuevo`) en `<= 3` clics creando `Attempt` individual; con `flags.games = false`, oculta el menú, responde `409 ACTIVITY_NOT_AVAILABLE` y preserva intentos previos. |

## 10. Fuera de alcance y decisiones diferidas

- **Motor `Phaser` y física 2D:** excluidos del piloto (`CONTEXT §2.4`, decisión 5); `ActivityRuntimeProps` permite incorporar motores en canvas en Fase 2 sin alterar backend ni base de datos.
- **Almacenamiento navegador:** prohibido usar `localStorage` para tokens o progreso (`CONTEXT §16.9`).
- **Calificación manual, reintentos docentes y analíticas:** `retry_granted_at` manual para otros tipos pertenece a `SPEC-07`, y la visualización docente de la serie de intentos y `implausible_duration` pertenece a `SPEC-08`.

## 11. Preguntas abiertas

Ninguna pregunta bloqueante ni P-n abierto del piloto (`CONTEXT §15`). `Q-01`, `Q-02` y `Q-03` cerradas el 2026-10-24:

| Pregunta cerrada | Decisión aceptada | Aplicada en |
| --- | --- | --- |
| `Q-01` — Nuevos intentos en `/juegos` para microjuegos ya calificados | **Decisión 104:** generar un `Attempt` individual (`attempt_number = anterior + 1`, `previous_attempt_id`) con `graded` y `score` aparte por cada intento jugado en ventana abierta, para conservar la evolución del estudiante en el panel estadístico docente (`SPEC-08`) | `RF-7`, `RF-11`, `§4–§7`, `§9` |
| `Q-02` — Alternativa sin arrastre en `drag_drop` y `match` (Decisión 81) | **Decisión 105:** serie de interacción híbrida integrada de serie (`@atlaskit/pragmatic-drag-and-drop` + toque/clic en dos pasos origen → destino + teclado) | `RF-2`, `RF-4`, `§7`, `§9` |
| `Q-03` — Recarga o corte de red en `timed_choice` (`SPEC-03 §4`) | **Decisión 106:** reiniciar el intento desde la primera pregunta (`índice 0`) y reiniciar el temporizador (`timeLimitSeconds`) para ser justos con el estudiante | `RF-6`, `RF-8`, `§4`, `§9` |

## 12. Registro de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-10-24 | Creación de `SPEC-06` en estado `Borrador` (`RF-1` a `RF-11`, contratos de las 5 mecánicas de `GameMechanic`, scorers `0..1` → `0.0–5.0`, `min_plausible_seconds`, sonido/confeti, `motion/kids` y `motion/teens`, zona `/juegos` y preguntas `Q-01` a `Q-03`) | Redacción de la especificación de Etapa 6 previa a `ENG-080`–`ENG-087` |
| 2026-10-24 | `Borrador` → `En revisión`; cierre de `Q-01`, `Q-02` y `Q-03` mediante las Decisiones 104, 105 y 106 de `CONTEXT §14` | Decisiones tomadas por el líder del proyecto sobre `Q-01` a `Q-03` |
| 2026-10-25 | `En revisión` → `Aprobada` → `Verificada`; aprobación del líder del proyecto e implementación completa de ENG-080 a ENG-087 (scorers deterministas 0.0–5.0 en ScoringService, Attempt individual secuencial según Decisión 104, flag implausible_duration, 5 componentes de microjuegos bajo ActivityRuntimeProps, GameRenderer con simulación in-memory, audio Howler.js, confeti, chunks diferidos kids/teens, zona /juegos) con 365/365 pruebas en verde en monorepo (54 shared, 235 api, 76 web) | Aprobación formal e implementación integral de la Etapa 6 de SDD |

