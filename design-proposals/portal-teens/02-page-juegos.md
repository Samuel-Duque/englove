# Plan de Implementación — Teens: Zona de Microjuegos (`/juegos`)

> **Alcance:** Rediseño de `/juegos` en tema **Teens (`data-theme="teens"`)** como **Zona de Microjuegos · Práctica libre 24/7** ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.2). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/juegos` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/page.tsx), [juegos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/juegos-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 2 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-06`, Decisiones 111, 130, 132, 137 (`CONTEXT.md` §2.4 y §16) |

---

## 1. Objetivo de la página y alcance

Migrar el tema Teens de `/juegos` desde `bg-zinc-900 / indigo-600` hacia tarjetas limpias `#FFFFFF` sobre `#FAF6EE`, añadiendo el banner moderno superior con contadores personales (`Estrellas de práctica` y `Partidas jugadas` sin rankings) y **retirando el botón «Escuchar» repetido de cada tarjeta de juego** (actualmente `juegos-client.tsx` renderiza `🔊` para ambos temas).

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Banner superior Teens (`#FFFFFF` con barra superior o lateral `#C6470B`, o `#2B150A → #3E2011` sobrio, según jerarquía limpia de Teens) con subtítulo *«Practica vocabulario y estructuras a tu ritmo. Los microjuegos dan estrellas de práctica y nunca afectan tus notas.»* y dos indicadores en `tabular-nums`: `Estrellas de práctica: X / Y` y `Partidas jugadas: N`.
  - Filtros `Todos`, `Por practicar`, `Jugados` en `#F3EADA` / activo `#C6470B` (`min-height: 48px`).
  - Tarjetas `#FFFFFF` (`border: 1.5px solid #D8C2A8`, `border-radius: 16px`), ícono geométrico sobrio de mecánica (`48×48px` decorativo en `#F3EADA`), insignia `GAME_MECHANIC_LABELS[game.mechanic]` en `#FFF0DE` / `#872E06`, `Nivel XX` en `#F3EADA` / `#5E3E2C`, 0–3 estrellas SVG (`role="img"`), conteo de partidas y CTA (`Reanudar partida` `#B9251D`, `Jugar` `#C6470B`, `Jugar de nuevo` `#FFCA3A`).
  - **En `ageSegment === 'teens'`, ocultar el botón «Escuchar» (`🔊`) de las tarjetas del catálogo** (`teens-portal-diseno.md` §1.1 y §4.2), manteniéndolo solo en Kids.
- **Permanece intacto:**
  - `flagsQuery`, `gamesQuery` (`/api/v1/me/games`), `startGameMutation`, manejo de `ATTEMPT_ALREADY_EXISTS`, `scoreToGameStars`, `getGameMotivationMessage` y estado cuando `!gamesEnabled`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Banner superior Teens** | `--surface-1` / `--border-active` | `#FFFFFF`, borde `1.5px solid #D8C2A8` con acento lateral `4px solid #C6470B` | `#2B150A` sobre `#FFFFFF`: **17,29:1 (AAA)** |
| **Contadores personales / Nivel** | `--surface-2` | `#F3EADA`, texto `#2B150A` / `#5E3E2C` | **7,99–14,49:1 (AAA)** |
| **Insignia de mecánica** | `--tint-orange-bg` / `-ink` | `#FFF0DE`, texto `#872E06` | **7,74:1 (AAA)** |
| **Tarjeta de juego** | `--surface-1` / `--border-rest` | `#FFFFFF`, borde `1.5px solid #D8C2A8` (`#4A2511` si `in_progress`) | **17,29:1 (AAA)** |
| **CTA `Jugar`** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,88:1 (AA)** |
| **CTA `Reanudar partida`** | `--red` / `--red-hover` | `#B9251D` / `#991D16` (texto `#FFFFFF`) | **6,28:1 (AA+)** |
| **CTA `Jugar de nuevo`** | `--yellow` | `#FFCA3A` (texto `#2B150A`) | **11,33:1 (AAA)** |
| **Estrellas SVG** | `--yellow` / `--border-rest` | Activa `#FFCA3A` (trazo `#4A2511`) · Vacía `#F3EADA` | `role="img"` + `aria-label` |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Zona de Microjuegos:** `Bricolage Grotesque 800`, `clamp(1.5rem, 2.4vw, 1.95rem)`.
- **Título juego (`<h2>`):** `Bricolage Grotesque 700`, `1.125rem` (`18px`), **`lang="en"`**.
- **Cuerpo, badges y cifras:** `Plus Jakarta Sans 500–700` con `tabular-nums` en estrellas totales y partidas.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Banner superior** | `width: 100%`, `min-height: 112px`; escritorio flex `space-between`, tablet/móvil apilado. | `padding: 22px 24px`, `border-radius: 16px`, `border: 1.5px solid #D8C2A8` | Píldoras `min-height: 44px`, `padding: 8px 14px`, `border-radius: 12px`. |
| **Filtros (`Todos`, `Por practicar`, `Jugados`)** | `display: flex; flex-wrap: wrap; gap: 8px`; cada botón **`min-height: 48px`**, `min-width: 96px`. | `padding: 10px 16px`, `border-radius: 999px` | Sin truncamiento en `390×844`. |
| **Rejilla de juegos** | Escritorio (`>= 961px`): **`3 columnas`** (`gap: 18px`). Tablet (`681–960px`): **`2 columnas`**. Móvil (`<= 680px`): **`1 columna`**, `gap: 14px`. | — | — |
| **Tarjeta de Microjuego** | `min-height: 256px`, `display: flex; flex-direction: column; justify-content: space-between`. | `padding: 20px`, `border-radius: 16px`, `box-shadow: 0 2px 8px rgba(43,21,10,0.05)` | Ícono geométrico de mecánica `48 × 48 px`; **sin botón TTS en Teens**. |
| **CTA inferior** | `width: 100%`, **`min-height: 48px`** (`50px`). | `border: 1.5px solid #4A2511`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F3EADA` (`112px` banner + 3 tarjetas `256px`), *«Cargando microjuegos…»*.
- **Flag apagado (`!gamesEnabled`):** tarjeta limpia `#FFFFFF` con `FoxTeensIllustration` (`96×96px`), mensaje *«La Zona de Microjuegos aún no está habilitada. Consulta con tu profesora.»* y enlace `Volver a inicio` (`>= 48px`).
- **Vacío:** tarjeta limpia con `FoxTeensIllustration` y copy directo sin tono infantil.
- **Error de red o inicio:** alerta `#FDECE9` con borde `#B9251D`, `role="alert"` y botón cerrar **`>= 48 × 48 px`**.

---

## 6. Plan de implementación paso a paso

1. **Actualizar la rama Teens en [juegos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/juegos/juegos-client.tsx):**
   - Condicionar el renderizado del botón «Escuchar» exclusivamente a `isKids` (`{isKids && <ListenButton ... />}`).
   - Reemplazar todas las clases `bg-zinc-900`, `bg-indigo-600`, `border-zinc-800` por los tokens `[data-theme="teens"]` (`#FFFFFF`, `#F3EADA`, `#D8C2A8`, `#C6470B`, `#B9251D`, `#FFCA3A`).
   - Añadir banner superior con métricas personales en `tabular-nums` (cero rankings).
   - Elevar todos los botones de filtro, cerrar error y CTA a `min-h-12` (`>= 48px`).

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Sin clases oscuras heredadas (`bg-zinc-900`, `bg-indigo-600`) ni botones «Escuchar» repetidos en Teens.
- [ ] Rejilla `3 → 2 → 1` columnas en escritorio / tablet / móvil sin desborde horizontal.
- [ ] Estrellas de práctica SVG (`role="img"`) y contadores personales sin nota ni ranking.
- [ ] Todos los controles `>= 48 × 48 px CSS`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
