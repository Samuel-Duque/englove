# Plan de Implementación — Teens: Inicio (`/inicio`)

> **Alcance:** Rediseño de `/inicio` para estudiantes con `ageSegment === 'teens'`, aplicando el hero en Tinta Corteza profunda (`#2B150A → #3E2011`), Bitácora semanal con Escudo de perdón y tarjetas limpias sin botones TTS repetidos ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.1). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/inicio` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/page.tsx), [inicio-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/inicio-client.tsx) (rama estudiante Teens) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 1 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-08`, `SPEC-09` RF-20–RF-21, Decisiones 43, 60, 101, 130 |

---

## 1. Objetivo de la página y alcance

Retirar la herencia oscura genérica (`bg-zinc-950`) y las tarjetas estilo Kids repetidas en `inicio-client.tsx`, ofreciendo una portada **ágil, directa y madura**: **Hero oscuro cálido (`#2B150A → #3E2011`)** con resumen accionable y **Zorro Explorador Teens** en medallón circular, **Bitácora semanal** lateral y rejilla limpia de **Actividades asignadas** en 2 columnas (`1` en móvil) sin botones «Escuchar» repetidos.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Bloque superior `hero-grid` (`1.6fr / 1fr` en `>= 961px`):
    - **Izquierda (Hero oscuro cálido `#2B150A → #3E2011`):** etiqueta `Nivel [X]` (`#FFCA3A` o `#F3EADA`), título `Hola, [Nombre]` (`#FFF9EC`), resumen accionable dinámico (*«Tienes N actividad(es) por hacer.»*), 2 accesos rápidos `>= 48px` (`Practicar en microjuegos` en `#FFCA3A` con texto `#2B150A`, y `Revisar feedback` con borde `#F3EADA` y texto `#FFF9EC`), **foco obligatorio `#FFCA3A` (`--focus-ring-dark`)** y medallón circular del **Zorro Teens** (oculto en `<= 680px`).
    - **Derecha (Bitácora semanal):** tarjeta `#FFFFFF`, contador `N semanas activas` en `tabular-nums`, tira limpia de 4 semanas y estado del **Escudo de perdón** (`Escudo de perdón activo` vs. `Recuperando escudo: X de 2 semanas activas`).
  - Filtros `Todas`, `Por hacer`, `Entregadas` en `#FFFFFF` / activo `#C6470B` (`min-height: 48px`).
  - Tarjetas limpias (`border: 1.5px solid #D8C2A8`, `border-radius: 16px`, sin costuras punteadas ni botones «Escuchar»): la tarjeta en progreso destaca con borde `1.5px solid #4A2511` + barra lateral/superior `3px solid #B9251D`.
- **Permanece intacto:**
  - `sessionQuery`, `cardsQuery` (`/api/v1/me/assignments`), `profileQuery`, query de progreso semanal (`/api/v1/me/progress`), `startAttemptMutation` (`/api/v1/assignments/:id/attempts`), ventana de tolerancia 24h y cálculo de estrellas desde el `score` del servidor.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Fondo Hero** | `--hero-start` → `--hero-end` | `#2B150A` → `#3E2011` | `#FFF9EC` sobre `#3E2011`: **14,10:1 (AAA)** |
| **Texto secundario hero** | `--hero-muted` | `#F3EADA` | Sobre `#3E2011`: **12,39:1 (AAA)** |
| **Botón hero `Practicar en microjuegos`** | `--yellow` | `#FFCA3A`, texto `#2B150A`, borde `#4A2511` | **11,33:1 (AAA)** |
| **Botón hero `Revisar feedback`** | — | Fondo transparente / `rgba(255,255,255,0.06)`, borde `1.5px solid #F3EADA`, texto `#FFF9EC` | **12,39:1 (AAA)** |
| **Foco sobre Hero oscuro** | `--focus-ring-dark` | `#FFCA3A` (`3px solid #FFCA3A; offset: 2px`) | **9,69:1 (AAA)** *(nunca `#1D4ED8` sobre oscuro)* |
| **Bitácora y Tarjetas en reposo** | `--surface-1` / `--border-rest` | `#FFFFFF`, borde `1.5px solid #D8C2A8` | `#2B150A` sobre `#FFFFFF`: **17,29:1 (AAA)** |
| **Tarjeta en progreso** | `--border-active` | Borde `1.5px solid #4A2511` + acento `3px solid #B9251D` | — |
| **Callout tolerancia 24h / reintento** | `--yellow-soft` / `--tint-red-bg` | `#FFF1C2` (`#543200`) / `#FDECE9` (`#831712`) | **10,15:1** / **8,75:1 (AAA)** |
| **CTAs de tarjeta** | `--red` / `--orange` / `--yellow` / `--surface-2` | Continuar `#B9251D` · Empezar `#C6470B` · Reintentar `#FFCA3A` · Ver entrega `#F3EADA` | Todos **>= 4,88:1** |
| **Foco en superficies claras** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **Hero `<h1>`:** `Bricolage Grotesque 800`, `clamp(1.55rem, 2.5vw, 2.05rem)`, `letter-spacing: -0.02em`.
- **Título sección (`<h2>`):** `Bricolage Grotesque 700`, `1.3rem` (`20.8px`).
- **Título tarjeta (`<h3>`):** `Bricolage Grotesque 700`, `1.1rem` (`17.6px`), **`lang="en"`** si es en inglés.
- **Cuerpo, chips y metadatos:** `Plus Jakarta Sans 500–700`, `0.875rem–1rem`, `tabular-nums` en racha, fechas y nota `0,0–5,0`.
- **Tono Teens:** directo y respetuoso (*«Hola, Valentina»*, sin signos de exclamación excesivos ni emojis recargados).

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Contenedor `hero-grid`** | Escritorio (`>= 961px`): `grid-template-columns: 1.6fr 1fr`, `gap: 20px`. Tablet (`681–960px`) y móvil (`<= 680px`): `1 columna`. | `margin-bottom: 28px` | En `<= 680px`, `FoxTeensIllustration` oculto para dejar el primer CTA visible sin scroll excesivo. |
| **Hero oscuro (`#2B150A → #3E2011`)** | `min-height: 224px`; botones rápidos **`min-height: 48px`**, `padding: 10px 18px`, `border-radius: 12px`; medallón Zorro `136 × 136 px`. | `padding: 28px 24px`, `border-radius: 20px`, `border: 1.5px solid #4A2511` | Anillo foco `#FFCA3A` obligatorio en los 2 enlaces. |
| **Bitácora semanal** | `min-height: 224px`; rejilla 4 semanas `repeat(4, minmax(0, 1fr))`, celdas `min-height: 48px`. | `padding: 22px`, `border: 1.5px solid #D8C2A8`, `border-radius: 18px`, `box-shadow: 0 2px 8px rgba(43,21,10,0.05)` | — |
| **Filtros (`Todas`, `Por hacer`, `Entregadas`)** | `flex-wrap: wrap; gap: 8px`; cada chip **`min-height: 48px`**, `padding: 10px 18px`, `border-radius: 999px`. | Borde `1.5px solid #D8C2A8` (activo `#4A2511`) | — |
| **Rejilla de Actividades** | Escritorio y Tablet (`>= 681px`): **`2 columnas`** (`gap: 18px`). Móvil (`<= 680px`): **`1 columna`**, `gap: 14px`. | — | — |
| **Tarjeta de Actividad Teens** | `min-height: 228px`, `display: flex; flex-direction: column; justify-content: space-between`. | `padding: 20px`, `border-radius: 16px`, `box-shadow: 0 2px 8px rgba(43,21,10,0.05)` | **Cero** botones «Escuchar» en tarjetas. |
| **CTA inferior de tarjeta** | `width: 100%`, **`min-height: 48px`** (`50px`), `padding: 12px 16px`. | `border: 1.5px solid #4A2511`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` | `:active translateY(1px)` anulado en `prefers-reduced-motion`. |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F3EADA` de altura equivalente (`224px` hero + `228px` tarjetas), *«Cargando tus actividades…»*.
- **Error de red:** `ErrorState` `variant="teens"` (`#FDECE9`, `#B9251D`, botón `Reintentar` `>= 48px`).
- **Vacío:** tarjeta `#FFFFFF`, borde `1.5px solid #D8C2A8`, `FoxTeensIllustration` discreto (`96×96px`), copy *«No tienes actividades pendientes esta semana. Puedes practicar en la Zona de Microjuegos.»* y CTA `>= 48px` hacia `/juegos` si `flags.games`.
- **Error al iniciar (`attemptError`):** `AccessibleModal` estilizado en Teens con botón `Entendido` `>= 48px`.

---

## 6. Plan de implementación paso a paso

1. **Separar la rama Teens en [inicio-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/inicio-client.tsx):** retirar definitivamente `bg-zinc-950 text-zinc-100` en la envoltura `data-theme="teens"` y usar `var(--app-bg)` (`#FAF6EE`).
2. **Construir `StudentInicioTeens`:**
   - Hero `#2B150A → #3E2011` con `FoxTeensIllustration`, accesos rápidos (`>= 48px`) y foco `#FFCA3A`.
   - Bitácora semanal consumiendo datos reales de `/api/v1/me/progress`.
   - Filtros `>= 48px` y rejilla de 2 columnas con tarjetas limpias en `Plus Jakarta Sans`, `lang="en"` en títulos y **sin botones TTS**.
3. **Verificar responsive y foco dual:** confirmar contraste de foco `#FFCA3A` en hero y `#1D4ED8` en el resto de la página.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux` (reglas Teens: sin infantilizar, sin TTS repetido en tarjetas, `48×48px`)
- `upward-english-guardrails` (`check-guardrails.mjs`, cero `'use cache'`)
- `accessibility` y `playwright-best-practices` (`1280×800`, `800×1280`, `390×844` + `axe-core`)
- `verification-before-completion` (`typecheck`, `lint`)

---

## 8. Criterios de aceptación (Checklist)

- [ ] Hero oscuro `#2B150A → #3E2011` con `FoxTeensIllustration` (oculto en `<= 680px`) y foco `#FFCA3A`.
- [ ] Lienzo general `#FAF6EE` (sin `bg-zinc-950`), tarjetas `#FFFFFF` con `border: 1.5px solid #D8C2A8` y `Plus Jakarta Sans` (`tabular-nums`).
- [ ] Cero botones «Escuchar» repetidos en las tarjetas.
- [ ] Todo control interactivo cumple **`>= 48 × 48 px CSS`**.
- [ ] Pasa `typecheck`, `lint`, `axe-core` WCAG 2.2 AA en los 3 viewports y `check-guardrails.mjs`.
