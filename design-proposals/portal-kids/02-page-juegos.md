# Plan de Implementación — Kids: Campamento de Microjuegos (`/juegos`)

> **Alcance:** Rediseño de `/juegos` en tema **Kids (`data-theme="kids"`)** como el **Campamento de Microjuegos abierto 24/7** ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.2). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/juegos` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/page.tsx), [juegos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/juegos-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 2 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-06`, Decisiones 111, 130, 132, 137 (`CONTEXT.md` §2.4 y §16) |

---

## 1. Objetivo de la página y alcance

Convertir el listado actual de `/juegos` en el **Campamento de Microjuegos**: una vitrina lúdica cálida abierta 24/7 para práctica autónoma sin notas ni rankings, con píldoras personales de estrellas acumuladas y partidas jugadas, tarjetas con ícono de mecánica (`52×52px`), botón «Escuchar» (`48×48px`) y CTA claro según estado.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Sustituir el header plano actual por **Banner del Campamento** (`#FFE2B3 → #FFD494`) con resumen claro sin notas y 2 píldoras de constancia personal (`Estrellas de práctica: X / Y` y `Partidas jugadas: N`, calculadas sobre `gamesQuery.data.items` del propio alumno — **cero rankings ni comparativas**).
  - Tarjetas estilizadas de cuaderno (`border: 2.5px solid #4A2511`, `box-shadow: 4px 4px 0 #4A2511`, `border-radius: 22px`), franja superior punteada con nivel MCER + insignia de mecánica (`GAME_MECHANIC_LABELS[game.mechanic]`), ícono táctil `52×52px`, botón «Escuchar» `#FFCA3A` (`48×48px`), fila de 0–3 estrellas con `role="img"` y mensaje motivador (`getGameMotivationMessage`).
  - Estado de flag apagado (`!gamesEnabled`) y estado vacío con `FoxExplorerIllustration` y estética Zorro Explorador.
- **Permanece intacto:**
  - `flagsQuery` (`fetchSharedFeatureFlags()`), `gamesQuery` (`GET /api/v1/me/games`), `startGameMutation` (`POST /api/v1/activities/:gameId/attempts`), manejo de `ATTEMPT_ALREADY_EXISTS` con `game.inProgressAttemptId` y navegación hacia `/juegos/[activityId]` o `/actividad/[attemptId]` según el flujo vigente (nota: verificar si el botón navega a `/actividad/${id}` como hace hoy `juegos-client.tsx` o a `/juegos/${game.id}` — preservar exactamente el comportamiento real de `juegos-client.tsx` que ya funciona con el backend).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token CSS | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Banner del Campamento** | `--surface-games-start` → `--surface-games-end` | `#FFE2B3` → `#FFD494` | `#2B150A` sobre `#FFD494`: **11,3:1 (AAA)** |
| **Píldoras de estrellas / partidas** | `--surface-1` | `#FFFFFF` con borde `2px solid #4A2511` | `#2B150A` sobre `#FFFFFF`: **15,7:1 (AAA)** |
| **Tarjeta de juego** | `--surface-1` | `#FFFFFF` (`border: 2.5px solid #4A2511`, `4px 4px 0 #4A2511`) | Base de lectura |
| **Franja superior por estado** | `--surface-soft-yellow` / `--surface-soft-orange` | `#FFF0B3` (en progreso / nuevo) o `#FFF2D6` (jugado) | `>= 9,4:1 (AAA)` |
| **Badge de mecánica** | — | Fondo `#FFE6CC`, texto `#872E06`, borde `#4A2511` | **6,9:1 (AA+)** |
| **Caja de ícono de mecánica (`52×52px`)** | `--yellow` / `--surface-2` | `#FFF2D6` con borde `2px solid #4A2511` | **> 13,5:1** |
| **Filtro activo** | `--orange` | `#C6470B` (texto `#FFFFFF`) | **4,9:1 (AA)** |
| **CTA `Reanudar partida`** | `--red` / `--red-hover` | `#B9251D` / `#991D16` (texto `#FFFFFF`) | **5,9:1 (AA)** |
| **CTA `Jugar`** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,9:1 (AA)** |
| **CTA `Jugar de nuevo` / Botón «Escuchar»** | `--yellow` / `--yellow-hover` | `#FFCA3A` / `#FFD55C` (texto `#2B150A`) | **11,7:1 (AAA)** |
| **Estrella ganada vs. pendiente** | `--yellow` / `--border-soft` | Activa `#FFCA3A` con trazo `#4A2511` · Vacía `#E8C79B` | SVG accesible, no emoji borroso |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` | `3px solid #1D4ED8; offset: 3px` |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Campamento de Microjuegos:** `Bricolage Grotesque 800`, `clamp(1.55rem, 2.5vw, 2rem)` (`24.8–32px`), `letter-spacing: -0.02em`.
- **Título de juego (`<h2>`):** `Bricolage Grotesque 700`, `1.1875rem` (`19px`), **`lang="en"`** para pronunciación correcta en lectores y TTS.
- **Píldoras numéricas y conteo de partidas:** `Nunito 800` con `font-variant-numeric: tabular-nums`.
- **Copy libre de evaluación:** nunca mostrar palabras como *«nota»*, *«calificación»*, *«ranking»*, *«puesto»* ni *«0,0–5,0»*.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones y grid (`1280×800` / `800×1280` / `390×844`) | Padding / Borde / Sombra | Reglas táctiles |
| --- | --- | --- | --- |
| **Banner del Campamento** | `width: 100%`, `min-height: 140px`; escritorio flex `space-between`, móvil apilado `1 columna`. | `padding: 24px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 5px 5px 0 #4A2511` | Píldoras personales en `gap: 10px`, `min-height: 44px` (`padding: 8px 14px`, `border-radius: 14px`). |
| **Barra de filtros (`Todos`, `Por practicar`, `Jugados`)** | `display: flex; flex-wrap: wrap; gap: 10px`; cada botón **`min-height: 48px`**, `min-width: 92px`. | `padding: 10px 18px`, `border: 2px solid #4A2511`, `border-radius: 999px` | En `390×844` permite salto de línea limpio (`flex-wrap: wrap`) sin truncar ni desbordar. |
| **Rejilla de Microjuegos** | Escritorio (`>= 961px`): **`grid-template-columns: repeat(3, minmax(0, 1fr))`**, `gap: 20px`. Tablet (`681–960px`): **`2 columnas`**. Móvil (`<= 680px`): **`1 columna`**, `gap: 16px`. | — | Sin desbordamiento horizontal en `390px` ni `800px`. |
| **Tarjeta de Microjuego** | Ancho `100%` de celda, `min-height: 290px`, `display: flex; flex-direction: column; justify-content: space-between`. | `overflow: hidden`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511` | — |
| **Franja `game-top`** | `min-height: 42px`, `padding: 10px 16px`, `border-bottom: 2px dashed #C78E54`. | — | Muestra insignia de mecánica a la izquierda + `Nivel XX` a la derecha. |
| **Bloque título + ícono + TTS** | Ícono mecánica **`52 × 52 px`** (`border: 2px solid #4A2511`, `border-radius: 14px`) + título 2 líneas máx. + botón **«Escuchar» `48 × 48 px`**. | `gap: 12px` | Reemplaza el botón actual `bg-amber-100` por el `ListenButton` oficial `#FFCA3A` con `aria-pressed`. |
| **Fila de 0–3 estrellas** | Contenedor `role="img"` con 3 SVGs de `24 × 24 px` (`gap: 4px`) + etiqueta `N partida(s)` a la derecha. | `padding: 8px 12px`, `border-radius: 12px`, fondo `#FFF9EC`, `border: 1.5px solid #E8C79B` | `aria-label="Estrellas de práctica: X de 3"`. |
| **Botón CTA inferior** | `width: 100%`, **`min-height: 52px`**, `padding: 12px 18px`. | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 0 4px 0 #4A2511` | Color según estado (`#B9251D` reanudar, `#FFCA3A` jugar de nuevo, `#C6470B` jugar). |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Copy |
| --- | --- | --- |
| **Carga (`isLoading`)** | Banner skeleton + 3 tarjetas skeleton (`290px` alto) en `#FFF2D6`. | *«Cargando el Campamento de Microjuegos…»* |
| **Flag apagado (`!gamesEnabled`)** | Tarjeta ilustrada con `FoxExplorerIllustration`, borde `2px dashed #C78E54`, CTA `Volver al inicio` (`52px`). | *«El Campamento de Microjuegos aún no está abierto. Tu profesora lo activará pronto.»* |
| **Catálogo vacío / filtro sin resultados** | Tarjeta centrada con `FoxExplorerIllustration`, sin mensaje de error rojo. | *«Todavía no hay juegos publicados en esta pestaña. ¡Vuelve pronto!»* |
| **Error al cargar o iniciar partida (`error`)** | Banner `role="alert"` en `#FFE6E1` con borde `2px solid #B9251D` y botón cerrar `>= 48 × 48 px` (corregir el botón actual `text-xs underline`). | Muestra `error` claro sin stack traces. |

---

## 6. Plan de implementación paso a paso

1. **Revisar [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/page.tsx):** añadir `<Suspense fallback={...}>` cálido con skeletons en `#FFF2D6` si aplica.
2. **Refactorizar el render de tema Kids en [juegos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/juegos-client.tsx):**
   - Calcular totales personales del banner desde `games`: `totalStars = sum(bestStars)`, `maxStars = games.length * 3` y `totalAttempts = sum(attemptsCount)` (solo datos propios).
   - Reemplazar cabecera actual por **Banner del Campamento** (`#FFE2B3 → #FFD494`) + barra de filtros con botones `min-h-12`.
   - Reemplazar cada tarjeta por la estructura `game-top` + caja mecánica `52×52px` + título `lang="en"` + `ListenButton` `48×48px` + SVG estrellas + CTA `52px`.
   - Elevar el botón `Cerrar` de la alerta de error a `min-h-12 min-w-12`.
3. **Limpiar síntesis de voz al desmontar** (manteniendo el `useEffect` actual de `speechSynthesis.cancel()`).

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux` (Decisiones 130, 132 y 137: juegos abiertos sin `Assignment`, estrellas sin notas ni rankings)
- `upward-english-guardrails` (`check-guardrails.mjs`)
- `accessibility` y `playwright-best-practices` (rejilla 3→2→1 columnas y `48×48px` en todos los botones en `1280×800`, `800×1280`, `390×844`)
- `verification-before-completion` (`pnpm --filter web typecheck`, `pnpm --filter web lint`)

---

## 8. Criterios de aceptación (Checklist)

- [ ] Banner `#FFE2B3 → #FFD494` con contadores personales en `tabular-nums` y **cero rankings o notas numéricas**.
- [ ] Rejilla de 3 columnas en escritorio (`>= 961px`), 2 en tablet (`681–960px`) y 1 en móvil (`<= 680px`).
- [ ] Cada tarjeta tiene ícono `52×52px`, `ListenButton` `48×48px`, `lang="en"` en título, 3 estrellas SVG (`role="img"`) y CTA `52px`.
- [ ] Botones de filtro y cerrar alerta `>= 48 × 48 px CSS`.
- [ ] Pasa `typecheck`, `lint`, `axe-core` WCAG 2.2 AA y `check-guardrails.mjs`.
