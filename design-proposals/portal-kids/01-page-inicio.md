# Plan de Implementación — Kids: Inicio / Ruta de Expedición (`/inicio`)

> **Alcance:** Rediseño de la pantalla `/inicio` cuando `session.user.role === 'student'` y `ageSegment === 'kids'`, siguiendo [zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.1. Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/inicio` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/page.tsx), [inicio-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/inicio-client.tsx) (rama estudiante) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) completado |
| **Orden de implementación** | **Página 1 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-08` (racha/perdón), `SPEC-09` RF-20–RF-22, Decisiones 43, 60, 101, 130 |

---

## 1. Objetivo de la página y alcance

Transformar la portada actual (`bg-white` genérico + botones `bg-amber-500`) en la **Portada del Diario de Expedición** + **Bitácora Semanal** + **Tu ruta de expedición** con paradas numeradas y franjas tipo sello de pasaporte.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Bloque superior `hero-grid` (`1.55fr / 1fr` en escritorio): izquierda **Portada del Diario** (gradiente `#FFF0C4 → #FFE0A3`, etiqueta nivel/grupo, saludo `¡Hola, [Nombre]!`, lema *«Explora, habla y descubre tu inglés»*, 2 CTAs rápidos `Ir al campamento de juegos` — si `flags.games` — y `Ver mi feedback`, más el **Zorro Explorador**); derecha **Bitácora Semanal** (racha actual en semanas, tira visual de 4 semanas y estado del **Escudo de perdón**).
  - Chips de filtro `Todas`, `Por hacer`, `Entregadas` a `min-height: 48px`.
  - Tarjetas de actividad en rejilla **2 columnas** (`1 columna` en móvil) con franja superior punteada (`2px dashed #C78E54`) coloreada según `ActivityType`, **botón «Escuchar» (`48×48px`)** para el título en inglés (`lang="en"`), badges de tolerancia 24h / reintento autorizado, tira de nota `0,0–5,0` + estrellas y botón táctil por estado.
- **Permanece intacto:**
  - `sessionQuery`, `cardsQuery` (`GET /api/v1/me/assignments`), `profileQuery` (`fetchSharedProfile()`), `startAttemptMutation` (`POST /api/v1/assignments/:id/attempts`), verificación de `isGracePeriod` y cálculo visual de estrellas sobre `latestAttempt.score` del servidor.
  - Si el endpoint de perfil/progreso requerido para la **Bitácora semanal** (`GET /api/v1/me/progress` o datos incluidos en el resumen) ya existe en la API, conectarlo vía `useQuery` dedicada sin inventar campos; si la tarjeta muestra solo racha semanal vigente del backend, usar los datos reales devueltos por el API.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Color / Token | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Portada del Diario (Hero)** | `--surface-hero-start` → `--surface-hero-end` | `#FFF0C4` → `#FFE0A3` | `#2B150A` sobre `#FFE0A3`: **12,4:1 (AAA)** |
| **Bitácora semanal** | `--surface-1` / `--surface-2` | `#FFFFFF` (píldoras semana `#FFF2D6`) | `#2B150A` sobre `#FFF2D6`: **13,5:1 (AAA)** |
| **Franja `Speaking`** | `--surface-soft-red` | `#FFE2DD`, texto `#831712` | **6,7:1 (AA+)** |
| **Franja `Completar espacios`** | `--surface-soft-orange` | `#FFE6CC`, texto `#872E06` | **6,9:1 (AA+)** |
| **Franja `Pregunta abierta` / Nivel** | `--surface-soft-yellow` | `#FFF0B3`, texto `#543200` | **9,4:1 (AAA)** |
| **Franja `Examen`** | `--surface-soft-exam` | `#FFEAD5`, texto `#6B2809` | **8,5:1 (AAA)** |
| **Tarjeta en progreso (`featured`)** | `--surface-featured` | `#FFF9E6` | `#2B150A` sobre `#FFF9E6`: **> 14:1 (AAA)** |
| **CTA `Continuar actividad`** | `--red` / `--red-hover` | `#B9251D` / `#991D16` (texto `#FFFFFF`) | **5,9:1 (AA)** |
| **CTA `Empezar actividad` / Filtro activo** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,9:1 (AA)** |
| **CTA `Intentar de nuevo` / Botón «Escuchar»** | `--yellow` / `--yellow-hover` | `#FFCA3A` / `#FFD55C` (texto `#2B150A`) | **11,7:1 (AAA)** |
| **CTA `Ver entrega y feedback`** | `--surface-2` | `#FFF2D6` (texto `#2B150A`) | **> 13,5:1 (AAA)** |
| **Callout tolerancia 24h / reintento / revisión** | — | `#FFF2C2` (`#543200`) / `#FFE6E3` (`#831712`) / `#FFF2D6` (`#61361F`) | Todos **>= 6,7:1** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` | `3px solid #1D4ED8; offset: 3px` |

---

## 3. Tipografía y reglas de texto

- **Saludo `<h1>`:** `Bricolage Grotesque 800`, `clamp(1.65rem, 2.7vw, 2.2rem)` (`26.4–35.2px`), `line-height: 1.15`, `letter-spacing: -0.02em`.
- **Encabezado sección *«Tu ruta de expedición»* (`<h2>`):** `Bricolage Grotesque 800`, `1.45rem` (`23.2px`).
- **Título de tarjeta (`<h3>`):** `Bricolage Grotesque 700`, `1.22rem` (`19.5px`), con atributo **`lang="en"`** cuando el título está en inglés.
- **Consignas / metadatos:** `Nunito 600–700`, `0.95rem–1rem`, fechas formateadas en `America/Bogota` y notas con coma decimal (`4,8 / 5,0`) y `tabular-nums`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones y grid (`1280×800` / `800×1280` / `390×844`) | Padding / Borde / Sombra | Reglas clave |
| --- | --- | --- | --- |
| **Contenedor `hero-grid`** | Escritorio (`>= 961px`): `grid-template-columns: 1.55fr 1fr`, `gap: 20px`. Tablet y móvil (`<= 960px`): `1 columna`. | `margin-bottom: 28px` | — |
| **Portada del Diario (izquierda)** | `min-height: 220px`, ilustración Zorro `140×140px` en escritorio (oculta en `<= 680px`). | `padding: 24px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 5px 5px 0 #4A2511` | Los 2 botones de acceso rápido tienen **`min-height: 48px`**, `padding: 10px 16px`, `border-radius: 14px`. |
| **Bitácora Semanal (derecha)** | `min-height: 220px`; tira de 4 semanas en `grid-template-columns: repeat(4, minmax(0, 1fr))`, `gap: 8px`, cada celda `min-height: 54px`. | `padding: 22px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 5px 5px 0 #4A2511`, fondo `#FFFFFF` | Escudo de perdón en píldora `min-height: 40px` (`border: 1.5px solid #4A2511`). |
| **Chips de filtro (`Todas`, `Por hacer`, `Entregadas`)** | `display: flex; flex-wrap: wrap; gap: 10px`; cada botón **`min-height: 48px`**, `min-width: 88px`. | `padding: 10px 18px`, `border: 2px solid #4A2511`, `border-radius: 999px` | Activo: `#C6470B` + `box-shadow: 2px 2px 0 #4A2511`. Inactivo: `#FFFFFF` + `#2B150A`. |
| **Rejilla de Paradas** | Escritorio y Tablet (`>= 681px`): **`grid-template-columns: repeat(2, minmax(0, 1fr))`**, `gap: 20px`. Móvil (`<= 680px`): `1 columna`, `gap: 16px`. | — | Cambia del `lg:grid-cols-3` actual a 2 columnas amplias para mayor legibilidad infantil. |
| **Tarjeta de Parada (`mission-card`)** | Ancho fluido `100%` de columna, `display: flex; flex-direction: column; justify-content: space-between`. | `overflow: hidden`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511` | En progreso: fondo `#FFF9E6`; resto: `#FFFFFF`. |
| **Franja pasaporte (`expedition-strip`)** | Ancho `100%`, `min-height: 44px`, `display: flex; justify-content: space-between; align-items: center`. | `padding: 10px 18px`, `border-bottom: 2px dashed #C78E54` | Izquierda: `Parada 01 · Tipo`; Derecha: `Nivel A1`. |
| **Cuerpo tarjeta + Botón «Escuchar»** | Botón «Escuchar» a la derecha del título: **`48 × 48 px`**, `shrink-0`. | Cuerpo `padding: 18px`, `gap: 12px` | `aria-pressed` alterna entre `#FFCA3A` (`Escuchar`) y `#B9251D` (`Detener`). |
| **Tira de nota `0,0–5,0` + Estrellas** | `min-height: 46px`, `padding: 10px 14px`, `border-radius: 14px`. | `border: 1.5px solid #E8C79B`, fondo `#FFF2D6` | Estrellas con `role="img"` y `aria-label="X de 3 estrellas"`. |
| **Botón CTA inferior de tarjeta** | `width: 100%`, **`min-height: 52px`** (`padding: 12px 18px`). | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 0 4px 0 #4A2511` | `Continuar actividad` (`#B9251D`), `Empezar actividad` (`#C6470B`), `Intentar de nuevo` (`#FFCA3A`), `Ver entrega y feedback` (`#FFF2D6`). |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual Kids | Copy |
| --- | --- | --- |
| **Carga (`isLoading`)** | Esqueletos cálidos `#FFF2D6` con altura aproximada del Hero (`220px`) + 2 tarjetas (`260px`) para evitar `CLS > 0,10`; sin pulso bajo `prefers-reduced-motion`. | *«Preparando tu ruta de hoy…»* |
| **Error de red (`networkError`)** | Usa `ErrorState` con `variant="kids"` sobre `#FFF9EC`, botón `Reintentar` `>= 52px`. | *«No pudimos cargar tus paradas. Revisa tu conexión e inténtalo de nuevo.»* |
| **Modal error al iniciar (`attemptError`)** | `AccessibleModal` estilizado en Kids, botón `Entendido` `>= 48px`. | Muestra el mensaje del backend (p. ej. actividad cerrada). |
| **Sin paradas (`filteredCards.length === 0`)** | Tarjeta `#FFFFFF` con `border: 2px dashed #C78E54`, `FoxExplorerIllustration` (`112×112px`) y enlace `Ir al campamento de juegos` (`>= 48px`) si `flags.games`. | *«No tienes paradas pendientes esta semana. Puedes practicar en el Campamento de Microjuegos.»* |

---

## 6. Plan de implementación paso a paso

1. **Actualizar fallback de [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/page.tsx):** reemplazar `bg-zinc-50` por esqueleto cálido `#FFF9EC` / `#FFF2D6`.
2. **Conectar datos de racha semanal en [inicio-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/inicio-client.tsx):** agregar `useQuery` hacia el resumen de progreso del estudiante (`/api/v1/me/progress`) solo cuando `session?.user.role === 'student'` (o reutilizar datos reales existentes de racha/escudo) para poblar la **Bitácora Semanal** sin inventar métricas.
3. **Estructurar el layout Kids en `inicio-client.tsx`** (preferiblemente extrayendo subcomponentes presentacionales limpios para no mezclar Kids/Teens/Docente en un bloque monolítico de 600+ líneas):
   - `StudentInicioKids` usando las clases/tokens `[data-theme="kids"]`.
   - Construir `hero-grid` con Portada del Diario (`FoxExplorerIllustration` oculto en móvil) y Bitácora Semanal (4 semanas + escudo de perdón).
   - Construir barra de filtros `min-h-12` con contadores en `tabular-nums`.
   - Reemplazar las tarjetas actuales por `MissionCard` con `expedition-strip` (color por `card.activity.type`), `ListenButton` (`48×48px`), `lang="en"` en el título, callouts 24h / reintento, tira `0,0–5,0` + estrellas y botón `52px`.
4. **Limpieza al desmontar:** cancelar `window.speechSynthesis.cancel()` al salir de la página si un título se estaba reproduciendo.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux` (reglas de consigna, TTS, tono Kids y contraste)
- `upward-english-guardrails` (`check-guardrails.mjs`, cero `'use cache'`, no calcular notas en cliente, tiempos en `America/Bogota`)
- `accessibility` y `playwright-best-practices` (probar `1280×800`, `800×1280`, `390×844` + `axe-core`)
- `verification-before-completion` (`pnpm --filter web typecheck`, `pnpm --filter web lint`, test de `/inicio`)

---

## 8. Criterios de aceptación (Checklist)

- [ ] Hero de diario (`#FFF0C4 → #FFE0A3`) + Bitácora semanal (`#FFFFFF`) en `1.55fr / 1fr` en escritorio y `1 columna` en `<= 960px`; mascota oculta en `<= 680px`.
- [ ] Rejilla de paradas en 2 columnas en escritorio/tablet y 1 en móvil, con franja punteada `2px dashed #C78E54` según tipo de actividad.
- [ ] Botón «Escuchar» (`48×48px`) funcional en cada parada (oculto limpiamente si no hay `speechSynthesis`) y `lang="en"` en títulos en inglés.
- [ ] Todos los filtros, links y CTAs `>= 48 × 48 px CSS` (CTAs de tarjeta `52px`).
- [ ] `0` rankings entre alumnos, `0` desbordamiento horizontal y `0` violaciones WCAG 2.2 AA en los 3 viewports.
- [ ] Pasa `typecheck`, `lint` y `check-guardrails.mjs`.
