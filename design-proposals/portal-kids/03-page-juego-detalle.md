# Plan de Implementación — Kids: Juego en Vivo y Mecánicas (`/juegos/[activityId]` + `GameRenderer`)

> **Alcance:** Plan visual, táctil y de interacción para la ruta `/juegos/[activityId]` y el entorno real de ejecución de los **5 microjuegos (`GameMechanic`)** dentro de `GameRenderer` ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.2 y §6.2). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/juegos/[activityId]` (redirección actual a `/juegos`) + ejecución de partida dentro de `/actividad/[attemptId]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/[activityId]/page.tsx), [GameRenderer.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/GameRenderer.tsx), [MatchGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/MatchGame.tsx), [OrderWordsGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/OrderWordsGame.tsx), [DragDropGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/DragDropGame.tsx), [MemoryGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/MemoryGame.tsx), [TimedChoiceGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/TimedChoiceGame.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [02-page-juegos.md](./02-page-juegos.md) |
| **Orden de implementación** | **Página 3 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-06` (5 mecánicas, Decisión 105 interacción híbrida, Decisión 106 reinicio `timed_choice`, Decisión 107 Web Audio, Decisión 137 estrellas sin ranking), `G-B06` (`@atlaskit/pragmatic-drag-and-drop`) |

---

## 1. Objetivo de la página y alcance

En la arquitectura actual, `/juegos/[activityId]/page.tsx` redirige a `/juegos`, mientras que al iniciar o reanudar un juego desde `/juegos` la partida real se ejecuta dentro de `/actividad/[attemptId]` usando `<GameRenderer />`. Este plan unifica el diseño **Zorro Explorador** de los tableros de las 5 mecánicas y documenta la decisión de mantener `/juegos/[activityId]` como redirección segura (o entrada directa si en el futuro se habilita, sin duplicar `POST /api/v1/activities/:id/attempts`).

### Qué cambia vs. qué permanece intacto

- **Cambia (superficies, contraste, ergonomía táctil y celebración Kids):**
  - Estilizar el contenedor de `GameRenderer` y las 5 mecánicas (`match`, `order_words`, `drag_drop`, `memory`, `timed_choice`) con fichas táctiles de cuaderno (`border: 2px solid #4A2511`, `box-shadow: 2px 2px 0 #4A2511`, `border-radius: 14px`), estado seleccionado inequívoco (`#FFF0B3` + borde `#C6470B` + ícono check), botón **«Escuchar» (`48×48px`)** en consignas en inglés (`lang="en"`), y retroalimentación inmediata honesta con mensajes `aria-live="polite"`.
  - Unificar tarjetas de `MemoryGame`, ranuras de `OrderWordsGame`, zonas de destino de `DragDropGame`, columnas de `MatchGame` y temporizador/opciones de `TimedChoiceGame` con paleta cálida Kids y objetivos **`>= 48 × 48 px CSS`**.
- **Permanece intacto (reglas de juego y guardrails):**
  - Drag and drop exclusivo con `@atlaskit/pragmatic-drag-and-drop` (`G-B06`, nunca `@dnd-kit`).
  - Paridad obligatoria de interacción híbrida (Decisión 105): **arrastre + toque/clic en dos pasos (origen → destino) + operación por teclado** en `match`, `order_words` y `drag_drop`.
  - En `timed_choice` (Decisión 106): recargar o reanudar reinicia desde la primera pregunta y restablece `timeLimitSeconds`.
  - `sound.ts` (Web Audio API) con respeto a `soundEnabled` y `confetti.ts` respetando `prefers-reduced-motion`.
  - Cero exposición de `answerKey` en runtime real (`previewMode === false`); cero notas numéricas en juegos para alumnos (solo **0–3 estrellas de práctica** + mensaje motivador).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tablero base del juego** | `--surface-1` | `#FFFFFF` (`border: 2.5px solid #4A2511`, `border-radius: 22px`) | Base de lectura |
| **Zona destino / ranura vacía** | `--app-bg` / `--border-dashed` | Fondo `#FFF9EC`, borde `2px dashed #C78E54` | `#2B150A` sobre `#FFF9EC`: **14,9:1 (AAA)** |
| **Ficha / carta / opción en reposo** | `--surface-2` | `#FFF2D6`, texto `#2B150A`, borde `2px solid #4A2511` | **> 13,5:1 (AAA)** |
| **Ficha seleccionada (paso 1 toque)** | `--surface-soft-yellow` / `--orange` | Fondo `#FFF0B3`, borde `2.5px solid #C6470B`, texto `#2B150A` | **> 12,0:1 (AAA)** |
| **Acierto / pareja / colocación correcta** | `--status-ok-bg` / `--status-ok-ink` | Fondo `#E6F5EA`, borde `2px solid #166534`, texto `#14532D` | **8,3:1 (AAA)** |
| **Error temporal / pareja incorrecta** | `--surface-soft-red` | Fondo `#FFE2DD`, borde `2px solid #B9251D`, texto `#831712` | **6,7:1 (AA+)** |
| **Barra de tiempo (`TimedChoiceGame`)** | `--orange` / `--red` | Normal `#C6470B` · Últimos 25 % `#B9251D` sobre pista `#FFF2D6` | `>= 4,9:1` + numeral `tabular-nums` |
| **Botón `Comprobar` / `Finalizar partida`** | `--orange` / `--red` | `#C6470B` (hover `#A53906`) / `#B9251D` | **4,9:1** / **5,9:1 (AA)** |
| **Botón «Escuchar» / estrellas ganadas** | `--yellow` | `#FFCA3A`, texto/trazo `#2B150A` | **11,7:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`outline: 3px solid #1D4ED8; offset: 3px`) | **> 5,8:1** |

---

## 3. Tipografía y reglas de texto

- **Consigna en español:** `Nunito 700`, `1rem–1.0625rem` (`16–17px`), máx. `55–65 ch`.
- **Palabras, oraciones y tarjetas en inglés:** `Bricolage Grotesque 700` o `Nunito 800`, `1.0625rem–1.25rem` (`17–20px`), siempre con **`lang="en"`**.
- **Temporizadores, contadores de movimientos y estrellas:** `Nunito 800` con `font-variant-numeric: tabular-nums`.

---

## 4. Anatomía y tamaño exacto de cada componente por mecánica

| Componente / Mecánica | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Sombra | Reglas de interacción híbrida |
| --- | --- | --- | --- |
| **Cabecera de juego (`GameRenderer`)** | Consigna + botón «Escuchar» `48×48px` + interruptor `Sonido` `>= 48×48px` (en runner). | `padding: 16px`, `gap: 12px`, `border-bottom: 2px dashed #C78E54` | Anuncio de estado en región `aria-live="polite"`. |
| **`OrderWordsGame` — Banco y zona de oración** | Cada ficha de palabra: **`min-height: 48px`**, **`min-width: 64px`**, `padding: 10px 16px`; contenedor flex-wrap `gap: 10px`. | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 2px 2px 0 #4A2511` | Soporta arrastre, clic para mover banco ↔ oración y flechas/Enter para reordenar; nunca recorta palabras en `390px`. |
| **`MatchGame` — Columnas A y B** | Escritorio/Tablet: `grid-template-columns: 1fr 1fr`, `gap: 16px`; móvil: 2 columnas compactas o apilado limpio según largo. Cada botón par **`min-height: 54px`**. | `padding: 12px 14px`, `border-radius: 16px`, `border: 2px solid #4A2511` | Clic A → clic B + arrastre + teclado; línea o insignia de número de pareja además de color (`1`, `2`, `3…`). |
| **`DragDropGame` — Fichas y zonas destino** | Ficha: **`min-height: 48px`**, `padding: 10px 16px`. Zona destino: **`min-height: 60px`**, ancho `100%` en móvil. | Zona: `border: 2px dashed #C78E54`, `border-radius: 16px`, fondo `#FFF9EC` | Toque ficha → toque zona + drag-and-drop + teclado; botón `Quitar` `>= 48×48px` o clic para devolver al banco. |
| **`MemoryGame` — Rejilla de cartas** | Escritorio/Tablet: `3–4 columnas` (`gap: 14px`); Móvil (`390×844`): **`2–3 columnas`** (`minmax(96px, 1fr)`), carta **`min-height: 88px`** (`>= 48×48px`). | Dorso `#FFE2B3` con sello brújula; cara `#FFFFFF` con `border: 2.5px solid #4A2511`, `3px 3px 0 #4A2511` | Sin dependencia de hover; giro respetando `prefers-reduced-motion: reduce` (cambio de estado instantáneo). |
| **`TimedChoiceGame` — Reloj y opciones** | Pista de tiempo `height: 12px` + cifra `tabular-nums`; cada botón de opción **`min-height: 54px`**, ancho `100%` en `1` o `2 columnas`. | `padding: 14px 16px`, `border: 2px solid #4A2511`, `border-radius: 16px` | Mantiene reinicio completo de ronda si se recarga (Decisión 106). |
| **Botón final de verificación/entrega del juego** | `width: 100%` móvil / `min-width: 220px` escritorio, **`min-height: 52px`**. | `border: 2px solid #4A2511`, `box-shadow: 0 4px 0 #4A2511`, fondo `#C6470B` | En pantalla de cierre: **0–3 estrellas** + mensaje motivador; nunca nota numérica `0,0–5,0` al alumno. |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Regla |
| --- | --- | --- |
| **Ruta directa `/juegos/[activityId]`** | Redirección inmediata a `/juegos` (comportamiento actual en `page.tsx`). | Evita intentos huérfanos sin `POST /attempts`. |
| **`prefers-reduced-motion: reduce`** | Desactiva flip 3D de `MemoryGame`, sacudida de error y confeti animado. | Permanece el cambio claro de borde, ícono y texto. |
| **Sonido silenciado o sin `AudioContext`** | `soundManager.play()` retorna sin error; partida 100 % jugable en silencio. | Interruptor `Sonido` visible con `aria-pressed`. |
| **Sin red al terminar partida** | `actividad-runner.tsx` encola el evento `completed` en IndexedDB y muestra recibo honesto offline (sin fingir estrellas confirmadas del servidor si no hay respuesta). | Ver `04-page-actividad.md`. |

---

## 6. Plan de implementación paso a paso

1. **Mantener [juegos/[activityId]/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/[activityId]/page.tsx)** como `redirect('/juegos')` (o documentar explícitamente que toda ejecución cursa por `/actividad/[attemptId]`).
2. **Estilizar [GameRenderer.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/GameRenderer.tsx)** aplicando tokens `[data-theme="kids"]` / `[data-theme="teens"]` mediante `props.theme`: en `previewMode` (usado por la profesora), mostrar vista de prueba; en ejecución alumno Kids, nunca mostrar nota numérica en resultados de juego.
3. **Actualizar una a una las 5 mecánicas** (`OrderWordsGame.tsx`, `MatchGame.tsx`, `DragDropGame.tsx`, `MemoryGame.tsx`, `TimedChoiceGame.tsx`):
   - Reemplazar colores Tailwind genéricos (`indigo`, `zinc`, `amber-200`) por clases ligadas a tokens `--surface-*`, `--border-strong`, `--orange`, `--yellow`, `--status-ok-*`.
   - Verificar que todo botón, ficha, carta y ranura cumpla `min-h-12 min-w-12` (`>= 48×48px`).
   - Agregar atributo `lang="en"` en palabras/frases en inglés y región `aria-live="polite"` para retroalimentación de emparejamiento/ordenamiento.
   - Asegurar que todas las animaciones (giro de cartas, pulsos de temporizador) respeten `@media (prefers-reduced-motion: reduce)`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux` (interacción híbrida Decisión 105, TTS, audio opcional, estrellas sin nota)
- `upward-english-guardrails` (`G-B06` `@atlaskit/pragmatic-drag-and-drop`, `G-C04` sin `answer_key`)
- `animate` (transiciones CSS puras y `prefers-reduced-motion`)
- `accessibility` y `playwright-best-practices` (probar navegación solo por teclado + toque en 5 mecánicas en `390×844`, `800×1280`, `1280×800`)

---

## 8. Criterios de aceptación (Checklist)

- [ ] Las 5 mecánicas usan tokens `[data-theme="kids"]` con bordes `#4A2511`, foco `#1D4ED8` y `>= 48×48px` en cada pieza/carta/opción.
- [ ] `match`, `order_words` y `drag_drop` funcionan por drag (`@atlaskit/pragmatic-drag-and-drop`), toque en 2 pasos y teclado.
- [ ] `timed_choice` reinicia desde la pregunta 1 y restablece `timeLimitSeconds` al recargar.
- [ ] Resultados de juego muestran únicamente 0–3 estrellas y mensaje motivador, sin nota ni ranking.
- [ ] `0` violaciones `axe-core`, `0` desborde horizontal en `390×844` y `typecheck`/`lint`/`check-guardrails.mjs` en verde.
