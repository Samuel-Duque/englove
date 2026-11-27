# Plan de Implementación — Teens: Mi Feedback (`/feedback`)

> **Alcance:** Rediseño de `/feedback` en tema **Teens (`data-theme="teens"`)**, con tarjetas limpias y estructuradas, **stickers como badges horizontales planos** (sin inclinación infantil) y controles `>= 48×48px` ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/feedback` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/feedback/page.tsx), [feedback-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/feedback/feedback-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 6 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-08` (stickers oficiales máx. 3), `SPEC-09` RF-21, Decisiones 61, 84, 108 |

---

## 1. Objetivo de la página y alcance

Dar soporte nativo a `data-theme="teens"` en `feedback-client.tsx` (que actualmente no consulta el tema del estudiante), ofreciendo tarjetas editoriales claras, calificación `0,0–5,0` en `tabular-nums`, comentario destacado con barra lateral `#C6470B`, **stickers horizontales planos en `#F3EADA`** (cero inclinaciones `rotate` ni estilo pegatina infantil) y botón `Intentar de nuevo` `>= 48px`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Conectar `fetchSharedProfile()` en `feedback-client.tsx` para aplicar estilos Teens cuando `ageSegment === 'teens'`.
  - **En Teens, NO mostrar botones TTS** («Escuchar comentario»), manteniendo una interfaz despejada (`teens-portal-diseno.md` §1.1).
  - **Stickers oficiales:** badges horizontales rectos en `#F3EADA` con borde `1.5px solid #D8C2A8` y texto `#2B150A` (sin `bg-indigo-50` ni rotaciones).
  - **Comentario de la profesora:** bloque limpio `#FAF6EE` con **`border-left: 3px solid #C6470B`** en `Plus Jakarta Sans`.
  - **Reintento autorizado (`hasAvailableRetry`):** callout en `#FDECE9` con borde `#B9251D`, texto `#831712` y CTA `Intentar de nuevo` en `#FFCA3A` (`texto #2B150A`, `border: 1.5px solid #4A2511`, `0 2px 0 #4A2511`, `min-height: 48px`).
  - **Acordeón de intentos anteriores:** botón `min-height: 48px` con `aria-expanded` explícito.
- **Permanece intacto:**
  - `useQuery(['student', 'feedback'])` (`/api/v1/student/feedback`), `retryMutation`, `AccessibleModal` para `retryError` y formato de fechas `America/Bogota`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjeta de retroalimentación** | `--surface-1` / `--border-rest` | `#FFFFFF`, borde `1.5px solid #D8C2A8` | `#2B150A` sobre `#FFFFFF`: **17,29:1 (AAA)** |
| **Bloque nota (`0,0–5,0` + estrellas)** | `--surface-2` | `#F3EADA`, borde `1.5px solid #D8C2A8`, texto `#2B150A` | **14,49:1 (AAA)** |
| **Bloque comentario docente** | `--app-bg` / `--orange` | `#FAF6EE` con `border-left: 3px solid #C6470B`, texto `#2B150A` | **16,04:1 (AAA)** |
| **Badges de stickers (planos)** | `--surface-2` / `--border-rest` | `#F3EADA`, borde `1.5px solid #D8C2A8`, texto `#2B150A` | **14,49:1 (AAA)** |
| **Callout nuevo intento** | `--tint-red-bg` / `-ink` | `#FDECE9`, borde `1.5px solid #B9251D`, texto `#831712` | **8,75:1 (AAA)** |
| **CTA `Intentar de nuevo`** | `--yellow` | `#FFCA3A`, texto `#2B150A`, borde `1.5px solid #4A2511` | **11,33:1 (AAA)** |
| **Acordeón historial** | `--surface-2` | `#F3EADA`, texto `#2B150A` | **14,49:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Mi Feedback:** `Bricolage Grotesque 800`, `1.55rem–1.95rem`.
- **Título actividad (`<h2>`):** `Bricolage Grotesque 700`, `1.15rem`, **`lang="en"`**.
- **Comentario, stickers y nota `4,6 / 5,0`:** `Plus Jakarta Sans 500–700`, `tabular-nums` en notas y fechas `America/Bogota`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Lista de tarjetas** | `max-width: 960px`, `gap: 20px` | `margin: 0 auto` | 1 columna limpia. |
| **Tarjeta de Feedback** | `padding: 22px 24px`, `border: 1.5px solid #D8C2A8`, `border-radius: 16px`, `box-shadow: 0 2px 8px rgba(43,21,10,0.05)` | Cabecera `padding-bottom: 14px`, `border-bottom: 1px solid #F3EADA` | En `390px`, bloque de nota baja limpiamente bajo el título. |
| **Stickers horizontales planos** | `display: flex; flex-wrap: wrap; gap: 8px`; cada badge `min-height: 36px` (no interactivo), `border-radius: 8px`. | `padding: 6px 12px`, `border: 1.5px solid #D8C2A8` | **Cero rotación CSS.** |
| **CTA `Intentar de nuevo`** | **`min-height: 48px`**, `min-width: 180px` (`100%` móvil). | `padding: 10px 18px`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` | — |
| **Botón acordeón intentos** | **`min-height: 48px`**, `padding: 10px 14px`, `aria-expanded={isHistoryOpen}`. | `border-radius: 10px`, `border: 1px solid #D8C2A8` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F3EADA` (`220px` alto), *«Cargando tu retroalimentación…»*.
- **Error:** `ErrorState` `variant="teens"` con botón `Reintentar` `>= 48px`.
- **Vacío:** tarjeta `#FFFFFF` con `FoxTeensIllustration` (`96×96px`), copy directo *«Aún no tienes actividades calificadas. Cuando tu profesora revise tus entregas, verás aquí su feedback.»*
- **Modal `retryError`:** `AccessibleModal` con botón `Entendido` `>= 48px`.

---

## 6. Plan de implementación paso a paso

1. **En [feedback-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/feedback/feedback-client.tsx):**
   - Consultar `fetchSharedProfile()` para separar la vista Kids de la vista Teens.
   - En la vista Teens: aplicar tarjetas `#FFFFFF`, stickers planos `#F3EADA`, comentario `#FAF6EE` con borde izquierdo `#C6470B`, botones `Intentar de nuevo` (`#FFCA3A`) y acordeón `>= 48px` con `aria-expanded`, sin botones TTS.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails`, `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] `feedback-client.tsx` renderiza tema Teens limpio sin rotación de stickers ni `bg-indigo-50`.
- [ ] Todos los botones (`Intentar de nuevo`, acordeón, `Reintentar`, modal `Entendido`) miden **`>= 48 × 48 px CSS`**.
- [ ] Estrellas SVG (`role="img"`), `lang="en"` en títulos, notas `tabular-nums` en `0,0–5,0`.
- [ ] `0` violaciones `axe-core`, `0` desborde horizontal en `390×844` / `800×1280` / `1280×800`, `typecheck` y `lint` en verde.
