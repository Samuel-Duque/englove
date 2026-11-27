# Plan de Implementación — Kids: Mi Progreso / Diario de Logros (`/progreso`)

> **Alcance:** Rediseño de `/progreso` en tema **Kids (`data-theme="kids"`)** como el **Diario de Logros**, con racha semanal perdonable, álbum de sellos/insignias e historial de entregas ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.4). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/progreso` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/progreso/page.tsx), [progreso-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/progreso/progreso-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 5 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-08` (racha semanal perdonable e insignias `BadgeRule`/`BadgeAward`), `SPEC-09` RF-21, Decisión 43, Decisión 101 |

---

## 1. Objetivo de la página y alcance

Transformar `/progreso` en un **Diario de Logros** motivador sin ansiedad de rachas diarias: destacar la racha por semanas con el **Escudo de perdón**, convertir la galería de insignias en un **Álbum de Sellos** (diferenciando los obtenidos con marco sólido de los próximos hitos con borde punteado si la API expone próximos objetivos o mostrando vacío ilustrado) y presentar el historial con notas `0,0–5,0` en `tabular-nums`, estrellas SVG y botones táctiles `>= 48×48px`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Encabezado con `Bricolage Grotesque 800`, botón «Escuchar resumen» opcional (`48×48px`).
  - **Tarjeta ampliada de Racha Semanal:** fondo `#FFF0C4 → #FFE0A3` o `#FFFFFF` con borde `2.5px solid #4A2511` y sombra `5px 5px 0 #4A2511`; insignia de fuego/brújula `64×64px`, cifra de semanas en `tabular-nums`, tira visual de estado del **Escudo de perdón** (`Escudo activo` en `#E6F5EA` / `#14532D` vs. `Recuperando escudo: X / 2 semanas` en `#FFF0B3` / `#543200`) y explicación amigable sin culpa.
  - **Álbum de Sellos e Insignias:** tarjetas de pasaporte (`border: 2.5px solid #4A2511`, `3px 3px 0 #4A2511`, fondo `#FFFDF5`), medalla `52×52px` en `#FFCA3A`, fecha formateada en `America/Bogota`; si no hay insignias aún, estado vacío con `FoxExplorerIllustration` y borde punteado `2px dashed #C78E54`.
  - **Historial de Actividades Entregadas:** filas con altura cómoda (`>= 64px`), estrellas SVG (`role="img"`), nota `0,0–5,0` en `tabular-nums` y enlace **`Ver detalles`** elevado a **`min-height: 48px`** (hoy es `py-1.5 text-xs`).
- **Permanece intacto:**
  - Query `['student', 'progress']` hacia `GET /api/v1/me/progress` (`StudentProgressViewSchema`), `renderBadgeIcon(b.icon)` de `apps/web/src/lib/badges.ts` y enlaces `/actividad/${act.attemptId}`.
  - Cero rankings de clase ni tiempos comparativos frente a compañeros (`CONTEXT.md` §2.4).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjeta de Racha Semanal** | `--surface-hero-start` → `--surface-hero-end` (o `--surface-1`) | `#FFF0C4` → `#FFE0A3` | `#2B150A` sobre `#FFE0A3`: **12,4:1 (AAA)** |
| **Escudo activo** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, texto `#14532D`, borde `#166534` | **8,3:1 (AAA)** |
| **Escudo en recuperación** | `--surface-soft-yellow` | `#FFF0B3`, texto `#543200`, borde `#4A2511` | **9,4:1 (AAA)** |
| **Sello de insignia obtenida** | `--surface-1` / `--yellow` | Fondo `#FFFDF5`, medalla `#FFCA3A`, borde `2.5px solid #4A2511` | **11,7:1** en medalla · **15,7:1** en tarjeta |
| **Próximo sello / estado vacío** | `--app-bg` / `--border-dashed` | Fondo `#FFF9EC`, borde `2px dashed #C78E54`, texto `#61361F` | **8,7:1 (AAA)** |
| **Fila historial / badge `En revisión`** | `--surface-1` / `--surface-2` | Fila `#FFFFFF` (`hover #FFF9EC`); badge `#FFF2D6` texto `#61361F` | **> 9,0:1 (AAA)** |
| **Botón `Ver detalles`** | `--surface-2` | `#FFF2D6`, texto `#2B150A`, borde `2px solid #4A2511`, `2px 2px 0 #4A2511` | **> 13,5:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 3px`) | **> 5,8:1** |

---

## 3. Tipografía y reglas de texto

- **Título `<h1>`:** `Bricolage Grotesque 800`, `1.65rem–2rem` (`26–32px`).
- **Cifra de semanas y notas `0,0–5,0`:** `Bricolage Grotesque 800` / `Nunito 800` con `font-variant-numeric: tabular-nums`.
- **Títulos de actividades en historial (`<h4>`):** `Nunito 800`, `1rem`, con **`lang="en"`** si es título de actividad en inglés.
- **Fechas:** formato colombiano (`America/Bogota`), p. ej. *«Ganada el 12 nov 2026»*.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Tarjeta de Racha Semanal** | `width: 100%`, `min-height: 168px`; insignia izquierda `64 × 64 px`; píldora escudo `min-height: 44px`. | `padding: 24px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 5px 5px 0 #4A2511` | En `390×844` apila píldora de escudo debajo del contador sin recorte. |
| **Rejilla Álbum de Sellos** | Escritorio (`>= 961px`): `3 columnas` (`gap: 16px`). Tablet (`681–960px`): `2 columnas`. Móvil (`<= 680px`): `1 columna`. | — | — |
| **Tarjeta de Sello** | `min-height: 112px`; medalla ícono **`52 × 52 px`** (`border: 2px solid #4A2511`, `border-radius: 14px`). | `padding: 18px`, `border: 2.5px solid #4A2511`, `border-radius: 20px`, `box-shadow: 3px 3px 0 #4A2511` | — |
| **Lista Historial de Entregas** | Contenedor `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511`, fondo `#FFFFFF`. | Cada fila `padding: 16px 20px`, `border-bottom: 1.5px solid #E8C79B` | En móvil la fila pasa a disposición vertical limpia con el botón `Ver detalles` a ancho completo o `min-width: 132px`. |
| **Enlace `Ver detalles`** | **`min-height: 48px`**, **`min-width: 124px`** (`inline-flex items-center justify-center`). | `padding: 10px 16px`, `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 2px 2px 0 #4A2511` | Corrige el enlace actual de `< 36px` de altura. |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Copy |
| --- | --- | --- |
| **Carga (`isLoading`)** | Esqueletos cálidos `#FFF2D6` para racha (`168px`) + 3 sellos (`112px`) + 3 filas (`72px`). | *«Abriendo tu diario de logros…»* |
| **Error (`error || !progress`)** | `ErrorState` `variant="kids"` (`#FFE6E1`, borde `#B9251D`, botón `Reintentar` `52px` llamando `refetch()`). | *«No pudimos cargar tu progreso. Revisa tu conexión e inténtalo de nuevo.»* |
| **Sin insignias (`badges.length === 0`)** | Tarjeta punteada `#FFF9EC` con `FoxExplorerIllustration` (`112×112px`) y motivación breve. | *«¡Tu álbum está listo! Completa tu primera parada para ganar tu primer sello.»* |
| **Sin historial (`activities.length === 0`)** | Tarjeta punteada + CTA `Ir a mi ruta` (`/inicio`, `52px`). | *«Aún no has entregado actividades. ¡Empieza una parada desde Inicio!»* |

---

## 6. Plan de implementación paso a paso

1. **Verificar [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/progreso/page.tsx):** asegurar metadata y `<Suspense>` con fallback cálido.
2. **Actualizar [progreso-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/progreso/progreso-client.tsx):**
   - Exponer `refetch` desde `useQuery(['student', 'progress'])` para que `ErrorState` permita reintentar.
   - Rediseñar la rama `isKids` con el bloque **Racha Semanal**, **Álbum de Sellos** y **Historial de Actividades** usando los tokens de `00-orden-y-base-compartida.md`.
   - Reemplazar las estrellas Unicode `★`/`☆` por el componente SVG accesible con `role="img"` y `aria-label`.
   - Elevar el enlace `Ver detalles` a `min-h-12 min-w-12` y agregar `tabular-nums` en notas y fechas.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`check-guardrails.mjs`), `accessibility` (`role="img"` en estrellas, contraste `#543200`/`#14532D`, objetivos `>= 48px`), `playwright-best-practices` y `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Tarjeta de racha muestra semanas activas y estado claro del escudo de perdón sin mensajes de culpa.
- [ ] Álbum de sellos usa `renderBadgeIcon` sobre tarjetas `#FFFDF5` con borde `#4A2511` y `3px 3px 0 #4A2511`.
- [ ] Todos los enlaces `Ver detalles` y botón `Reintentar` miden **`>= 48 × 48 px CSS`**.
- [ ] Cero rankings entre alumnos; estrellas SVG con `role="img"` y nota `0,0–5,0` en `tabular-nums`.
- [ ] `0` desborde horizontal en `390×844`, `800×1280` y `1280×800`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
