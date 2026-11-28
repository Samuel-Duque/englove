# Plan de Implementación — Kids: Postales Docentes (`/feedback`)

> **Alcance:** Rediseño de `/feedback` en tema **Kids (`data-theme="kids"`)** como **Postales de tu Profesora**, con sellos de calificación `0,0–5,0`, stickers oficiales inclinados sutilmente, botón «Escuchar comentario» (`es-CO`) y reintentos autorizados ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/feedback` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/feedback/page.tsx), [feedback-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/feedback/feedback-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 6 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-08` (stickers catálogo de 6, máximo 3), `SPEC-09` RF-21–RF-22, Decisiones 61, 84, 108, 122 |

---

## 1. Objetivo de la página y alcance

Convertir las tarjetas actuales de `/feedback` (que hoy no leen `ageSegment` y muestran stickers con `bg-indigo-50`, botones de acordeón pequeños y `bg-emerald-600` fuera de paleta) en **Postales de tu Profesora** cálidas y accesibles, con todo control `>= 48×48px`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Conectar `fetchSharedProfile()` en `feedback-client.tsx` (query `['student', 'profile', 'shell']`) para distinguir fielmente `kids` vs `teens`.
  - Rediseñar cada entrega en formato **Postal de Expedición**: cabecera punteada (`2px dashed #C78E54`) tintada según `item.activityType`, título `lang="en"`, **sello de calificación `0,0–5,0`** + 0–3 estrellas SVG arriba a la derecha.
  - Bloque de **comentario docente** sobre papel `#FFFDF5` con borde izquierdo `4px solid #C6470B` y **botón «Escuchar comentario» (`>= 48×48px`)** usando `es-CO`.
  - **Stickers recibidos (hasta 3 de los 6 oficiales):** sellos físicos en `#FFF0B3` / `#FFE6CC` con borde `2px solid #4A2511`, rotación decorativa sutil `±1.5°` (anulada estrictamente bajo `@media (prefers-reduced-motion: reduce)`).
  - **Banner de nuevo intento autorizado:** callout `#FFE6E3` con borde `2px solid #B9251D` y botón **`Intentar de nuevo`** en `#FFCA3A` (`min-height: 52px`, texto `#2B150A`).
  - **Botón acordeón historial de intentos:** elevado a **`min-height: 48px`** con `aria-expanded` explícito (corrigiendo el enlace/botón pequeño actual).
- **Permanece intacto:**
  - `useQuery(['student', 'feedback'])` hacia `GET /api/v1/student/feedback` (`StudentFeedbackListResponseSchema`), `retryMutation` hacia `POST /api/v1/assignments/:id/attempts`, modal de error `AccessibleModal` (botón `Entendido` `>= 48×48px`) y formato de fecha `America/Bogota`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Postal principal** | `--surface-1` | `#FFFFFF` (`border: 2.5px solid #4A2511`, `4px 4px 0 #4A2511`) | Base de lectura |
| **Cabecera punteada por tipo** | `--surface-soft-*` | Speaking `#FFE2DD` · Completar `#FFE6CC` · Abierta `#FFF0B3` · Examen `#FFEAD5` | `>= 6,7:1` |
| **Sello de nota `0,0–5,0`** | `--surface-2` | `#FFF2D6` con borde `2px solid #4A2511`, texto `#2B150A` | **> 13,5:1 (AAA)** |
| **Bloque comentario docente** | — | Fondo `#FFFDF5`, borde izquierdo `4px solid #C6470B`, texto `#2B150A` | **15,7:1 (AAA)** |
| **Stickers oficiales (hasta 3)** | `--surface-soft-yellow` | Fondo `#FFF0B3`, borde `2px solid #4A2511`, sombra `2px 2px 0 #4A2511`, texto `#2B150A` | **> 12,0:1 (AAA)** |
| **Banner nuevo intento (`hasAvailableRetry`)** | `--surface-soft-red` | `#FFE6E3`, borde `2px solid #B9251D`, texto `#831712` | **6,7:1 (AA+)** |
| **CTA `Intentar de nuevo`** | `--yellow` / `--yellow-hover` | `#FFCA3A` / `#FFD55C` (texto `#2B150A`, borde `2px solid #4A2511`, `0 4px 0 #4A2511`) | **11,7:1 (AAA)** |
| **Acordeón intentos anteriores** | `--surface-2` | Botón `#FFF2D6` (hover `#FFE0A3`), texto `#2B150A` | **> 13,5:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 3px`) | **> 5,8:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Postales de tu Profesora:** `Bricolage Grotesque 800`, `1.65rem–2rem` (`26–32px`).
- **Título de actividad (`<h2>`):** `Bricolage Grotesque 700`, `1.25rem` (`20px`), **`lang="en"`**.
- **Nota `4,8 / 5,0` y fechas:** `Nunito 800` con `font-variant-numeric: tabular-nums`.
- **Comentario docente:** `Nunito 600`, `1rem` (`16px`), `line-height: 1.55`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Contenedor lista de postales** | `max-width: 960px`, `gap: 24px` entre postales | `margin: 0 auto` | 1 columna clara para lectura cómoda del comentario. |
| **Tarjeta Postal** | `width: 100%`, `overflow: hidden` | `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511` | Cabecera `padding: 14px 20px`; cuerpo `padding: 20px`. |
| **Sello de calificación (arriba derecha)** | `min-height: 54px`, `min-width: 140px`, `display: inline-flex; align-items: center; gap: 12px`. | `padding: 8px 14px`, `border: 2px solid #4A2511`, `border-radius: 14px` | En `390×844` baja debajo del título sin encimarse. |
| **Botón «Escuchar comentario»** | **`min-height: 48px`**, **`min-width: 48px`** (`px-4`), fondo `#FFCA3A`. | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 2px 2px 0 #4A2511` | `aria-pressed` controla lectura en `es-CO` y ocultación si no existe `speechSynthesis`. |
| **Bandeja de stickers** | `display: flex; flex-wrap: wrap; gap: 10px`; cada sticker `min-height: 42px` (decorativo no interactivo). | `padding: 8px 14px`, `border: 2px solid #4A2511`, `border-radius: 12px` | `nth-child(odd) rotate(-1.5deg)` / `even rotate(1.5deg)` anulado en `prefers-reduced-motion: reduce`. |
| **Botón `Intentar de nuevo`** | `width: 100%` en móvil / `min-width: 196px` escritorio, **`min-height: 52px`**. | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 0 4px 0 #4A2511` | — |
| **Botón acordeón `Ver historial de intentos`** | **`min-height: 48px`**, `width: auto` (`100%` en móvil), `aria-expanded={isHistoryOpen}`. | `padding: 10px 16px`, `border: 1.5px solid #4A2511`, `border-radius: 12px` | Corrige el botón actual sin altura mínima ni `aria-expanded`. |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Copy |
| --- | --- | --- |
| **Carga (`isLoading`)** | 2 tarjetas esqueleto `#FFF2D6` (`240px` alto) sin salto visual. | *«Trayendo las postales de tu profesora…»* |
| **Error (`error`)** | `ErrorState` `variant="kids"` con botón `Reintentar` `52px` (`loadFeedback()`). | *«No pudimos cargar tus comentarios. Revisa tu conexión e inténtalo de nuevo.»* |
| **Vacío (`items.length === 0`)** | Tarjeta `#FFFFFF` con borde `2px dashed #C78E54`, `FoxExplorerIllustration` (`112×112px`) y botón `Ir a mi ruta` (`52px`). | *«Todavía no tienes postales calificadas. Cuando tu profesora revise una entrega, aparecerá aquí.»* |
| **Error de reintento (`retryError`)** | `AccessibleModal` estilizado en Kids con botón `Entendido` (`>= 48×48px`). | Mensaje exacto del backend. |

---

## 6. Plan de implementación paso a paso

1. **Verificar [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/feedback/page.tsx)** y su fallback cálido.
2. **En [feedback-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/feedback/feedback-client.tsx):**
   - Agregar `useQuery(['student', 'profile', 'shell'], fetchSharedProfile)` para determinar `ageSegment` (`kids` vs `teens`) y renderizar el estilo correspondiente.
   - Construir la tarjeta postal Kids con franja superior `2px dashed #C78E54` según `activityType`, sello de nota + estrellas SVG (`role="img"`), bloque comentario con botón «Escuchar comentario» (`48×48px`), stickers oficiales con inclinación `prefers-reduced-motion`-safe, banner de reintento con botón `#FFCA3A` (`52px`) y acordeón con `min-h-12` y `aria-expanded`.
   - Elevar botón `Entendido` del modal y `Reintentar` de error a `>= 48×48px`.
   - Limpiar `speechSynthesis.cancel()` al desmontar el componente.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`check-guardrails.mjs`), `accessibility` (`aria-expanded`, `aria-pressed`, `role="img"` en estrellas), `animate` (`prefers-reduced-motion` en inclinación de stickers), `playwright-best-practices` y `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] `feedback-client.tsx` adapta correctamente tema `kids` vs `teens` según perfil real.
- [ ] Todos los botones (`Intentar de nuevo`, `Escuchar comentario`, acordeón de historial, `Reintentar`, modal `Entendido`) miden **`>= 48 × 48 px CSS`**.
- [ ] Rotación de stickers desactivada bajo `prefers-reduced-motion: reduce`.
- [ ] `0` rankings, `0` desborde horizontal en `390×844` / `800×1280` / `1280×800`, `0` violaciones `axe-core` y `typecheck`/`lint` en verde.
