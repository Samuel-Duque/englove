# Plan de Implementación — Teens: Juego en Vivo y Mecánicas (`/juegos/[activityId]` + `GameRenderer`)

> **Alcance:** Rediseño en tema **Teens (`data-theme="teens"`)** de `GameRenderer` y las 5 mecánicas interactivas ejecutadas durante una partida ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.2 y §6.2), manteniendo la ruta `/juegos/[activityId]` como redirección segura. Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/juegos/[activityId]` (redirección a `/juegos`) + ejecución real dentro de `/actividad/[attemptId]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/[activityId]/page.tsx), [GameRenderer.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/GameRenderer.tsx), [MatchGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/MatchGame.tsx), [OrderWordsGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/OrderWordsGame.tsx), [DragDropGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/DragDropGame.tsx), [MemoryGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/MemoryGame.tsx), [TimedChoiceGame.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/games/TimedChoiceGame.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [02-page-juegos.md](./02-page-juegos.md) |
| **Orden de implementación** | **Página 3 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-06` (Decisiones 105, 106, 107, 137), `G-B06` (`@atlaskit/pragmatic-drag-and-drop`), `G-C04` |

---

## 1. Objetivo de la página y alcance

Aplicar el acabado limpio y ágil de Teens (`#FAF6EE`, `#FFFFFF`, `#F3EADA`, borde `1.5px solid #D8C2A8` / `#4A2511`, sombra compacta `0 2px 0 #4A2511`, tipografía `Plus Jakarta Sans`) a los 5 tableros de juego cuando `theme === 'teens'`, asegurando paridad de **arrastre + toque en dos pasos + teclado**, **cero botones TTS en consignas Teens** y **cero notas numéricas al alumno**.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - En `GameRenderer.tsx` y los 5 juegos, cuando `theme === 'teens'`: reemplazar estilos oscuros `zinc-900` / `indigo` por superficies limpias `#FFFFFF` y `#F3EADA`, acentos `#C6470B` / `#B9251D`, fichas nítidas con `border-radius: 12px` y sombra compacta `0 2px 0 #4A2511`.
  - Ocultar el botón TTS de consigna cuando `theme === 'teens'` (conservando el interruptor `Sonido: Activado / Silenciado` en `actividad-runner.tsx`).
- **Permanece intacto:**
  - `@atlaskit/pragmatic-drag-and-drop` (`G-B06`) + selección en 2 pasos + teclado + anuncios `aria-live="polite"`.
  - Reinicio completo de `TimedChoiceGame` al recargar o reanudar (Decisión 106).
  - `sound.ts` (Web Audio API) y `confetti.ts` con paleta Teens respetando `prefers-reduced-motion`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tablero base del juego** | `--surface-1` | `#FFFFFF`, borde `1.5px solid #D8C2A8`, `border-radius: 16px` | Base de lectura |
| **Zonas destino / ranuras vacías** | `--app-bg` / `--border-control` | `#FAF6EE`, borde `1.5px dashed #9A7B5C` | `#2B150A` sobre `#FAF6EE`: **16,04:1 (AAA)** |
| **Ficha / carta / opción en reposo** | `--surface-2` | `#F3EADA`, texto `#2B150A`, borde `1.5px solid #4A2511` | **14,49:1 (AAA)** |
| **Ficha seleccionada (toque paso 1)** | `--tint-orange-bg` / `--orange` | `#FFF0DE`, borde `2px solid #C6470B`, texto `#872E06` | **7,74:1 (AAA)** |
| **Acierto / pareja confirmada** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, borde `1.5px solid #166534`, texto `#166534` | **6,32:1 (AA+)** |
| **Desacierto temporal** | `--tint-red-bg` / `--red` | `#FDECE9`, borde `1.5px solid #B9251D`, texto `#831712` | **8,75:1 (AAA)** |
| **Barra tiempo `TimedChoiceGame`** | `--orange` / `--red` | `#C6470B` → `#B9251D` sobre pista `#F3EADA` | `>= 4,88:1` + `tabular-nums` |
| **Botón finalizar / comprobar** | `--orange` / `--red` | `#C6470B` / `#B9251D` (texto `#FFFFFF`, `0 2px 0 #4A2511`) | `>= 4,88:1 (AA)` |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **Consignas:** `Plus Jakarta Sans 600`, `1rem` (`16px`).
- **Tokens / opciones / pares en inglés:** `Plus Jakarta Sans 700` o `Bricolage Grotesque 700`, `1rem–1.125rem`, con **`lang="en"`**.
- **Temporizadores, intentos y estrellas:** `tabular-nums`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Mecánica / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas de interacción |
| --- | --- | --- | --- |
| **`OrderWordsGame` fichas** | **`min-height: 48px`**, **`min-width: 60px`**, `padding: 10px 14px`, `gap: 8px`. | `border: 1.5px solid #4A2511`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` | Drag + clic + teclado en paridad; `flex-wrap` limpio en `390px`. |
| **`MatchGame` botones** | Columnas `1fr 1fr` (`gap: 14px`); cada par **`min-height: 52px`**. | `padding: 12px 14px`, `border-radius: 12px` | Muestra número de pareja + color (no depende solo del color). |
| **`DragDropGame` fichas y destinos** | Ficha **`min-height: 48px`**; zona destino **`min-height: 56px`**, ancho `100%` en móvil. | `border-radius: 12px` | Drag + 2 pasos + teclado + botón devolver `>= 48×48px`. |
| **`MemoryGame` cartas** | `3–4 columnas` desktop/tablet, `2–3 columnas` móvil (`min-height: 84px`). | Dorso `#F3EADA` con emblema lineal; cara `#FFFFFF` con borde `#4A2511` | Flip instantáneo en `prefers-reduced-motion: reduce`. |
| **`TimedChoiceGame` reloj y opciones** | Pista `height: 10px`; opciones **`min-height: 52px`**, `padding: 12px 16px`. | `border-radius: 12px` | Reinicia al recargar (Decisión 106). |
| **Botón enviar resultado** | **`min-height: 48px`** (`50px`), `min-width: 200px` (`100%` móvil). | `border: 1.5px solid #4A2511`, `0 2px 0 #4A2511` | Al terminar muestra 0–3 estrellas + motivación (cero nota numérica). |

---

## 5. Estados obligatorios y casos límite

- **`prefers-reduced-motion: reduce`:** anula animaciones de tarjetas, confeti y transiciones manteniendo el cambio visual de estado.
- **Sin `AudioContext` o silenciado:** `soundManager.play()` falla silenciosamente sin afectar la partida.
- **Modo preview docente (`previewMode === true`):** sigue funcionando sin afectar la vista limpia del alumno.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [GameRenderer.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/GameRenderer.tsx):** aplicar clases del tema Teens cuando `props.theme === 'teens'` (sin TTS automático de consigna en catálogo ni vista oscura `zinc-900`).
2. **Actualizar los 5 componentes de mecánica** (`OrderWordsGame.tsx`, `MatchGame.tsx`, `DragDropGame.tsx`, `MemoryGame.tsx`, `TimedChoiceGame.tsx`) para soportar tokens de `[data-theme="teens"]` (`#FAF6EE`, `#FFFFFF`, `#F3EADA`, `#C6470B`, `#166534`, `#B9251D`), `lang="en"` en ítems en inglés y `min-h-12 min-w-12` (`>= 48×48px`) en todas las piezas.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`G-B06`, `G-C04`), `animate`, `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Las 5 mecánicas usan paleta cálida Teens (`#FAF6EE` / `#FFFFFF` / `#F3EADA`) sin `zinc-950` ni `indigo-600`.
- [ ] Paridad drag (`@atlaskit/pragmatic-drag-and-drop`) + toque en 2 pasos + teclado, con `>= 48×48px` en cada control.
- [ ] Cero exposición de `answerKey`, cero notas numéricas al alumno y reinicio correcto de `timed_choice`.
- [ ] `0` violaciones `axe-core`, `0` desborde horizontal en `390×844` y `typecheck`/`lint`/`check-guardrails.mjs` en verde.
