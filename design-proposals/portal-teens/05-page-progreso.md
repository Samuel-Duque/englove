# Plan de Implementación — Teens: Mi Progreso (`/progreso`)

> **Alcance:** Rediseño de `/progreso` en tema **Teens (`data-theme="teens"`)**, con panel sobrio de racha semanal perdonable, colección geométrica moderna de insignias e historial limpio en `tabular-nums` ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.4). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/progreso` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/progreso/page.tsx), [progreso-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/progreso/progreso-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 5 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-08`, `SPEC-09` RF-21, Decisiones 43 y 101 |

---

## 1. Objetivo de la página y alcance

Migrar la rama Teens de `progreso-client.tsx` desde `bg-zinc-900 / border-zinc-800` hacia tarjetas luminosas `#FFFFFF` sobre `#FAF6EE`, con **Racha semanal perdonable** directa (explicación concisa de las reglas del escudo), rejilla sobria de **Insignias** con medallas `#FFCA3A` / `#4A2511` y lista limpia de **Historial de actividades calificadas** con enlaces `Ver detalles` de `>= 48px`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Retirar clases `bg-zinc-900`, `bg-zinc-800`, `text-zinc-100` en la rama Teens y usar tokens `--surface-1` (`#FFFFFF`), `--surface-2` (`#F3EADA`), `--border-rest` (`#D8C2A8`) y `--border-active` (`#4A2511`).
  - **Panel de Racha Semanal:** cifra destacada `N semanas seguidas` en `tabular-nums`, píldora de estado del escudo (`Escudo de perdón activo` en `#E6F5EA`/`#166534` o `Recuperando escudo: X de 2 semanas` en `#FFF1C2`/`#543200`) y resumen de las reglas del perdón sin tono infantil.
  - **Colección de Insignias:** rejilla `3` / `2` / `1` columnas; tarjetas `#FFFFFF` con borde `1.5px solid #4A2511`, medalla `48×48px` en `#FFCA3A`, título, criterio y fecha en `America/Bogota`.
  - **Historial de actividades:** tabla/lista en `#FFFFFF` (`border: 1.5px solid #D8C2A8`, `border-radius: 16px`), estrellas SVG (`role="img"`), nota `0,0–5,0` en `tabular-nums` y botón `Ver detalles` **`>= 48 × 48 px`**.
- **Permanece intacto:**
  - Queries `['student', 'profile', 'shell']` y `['student', 'progress']` (`/api/v1/me/progress`), `renderBadgeIcon(b.icon)` y enlaces `/actividad/${act.attemptId}`. Cero rankings entre alumnos.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjetas Racha / Insignia / Historial** | `--surface-1` / `--border-rest` | `#FFFFFF`, borde `1.5px solid #D8C2A8` (`#4A2511` en insignias ganadas) | `#2B150A` sobre `#FFFFFF`: **17,29:1 (AAA)** |
| **Subtítulos / fechas / metadatos** | `--ink-2` | `#5E3E2C` | Sobre `#FFFFFF`: **9,54:1 (AAA)** |
| **Escudo activo** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, texto `#166534`, borde `#B7DFC2` | **6,32:1 (AA+)** |
| **Escudo recuperando** | `--yellow-soft` | `#FFF1C2`, texto `#543200`, borde `#E5C97B` | **10,15:1 (AAA)** |
| **Medalla de insignia ganada** | `--yellow` / `--border-active` | `#FFCA3A`, borde `1.5px solid #4A2511` | **11,33:1 (AAA)** |
| **Botón `Ver detalles` / Estado vacío** | `--surface-2` | `#F3EADA`, texto `#2B150A`, borde `1.5px solid #D8C2A8` | **14,49:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Mi Progreso:** `Bricolage Grotesque 800`, `1.55rem–1.95rem`.
- **Subtítulos `<h2>`:** `Bricolage Grotesque 700`, `1.2rem–1.3rem`.
- **Cifras de racha, notas `0,0–5,0` y fechas:** `Plus Jakarta Sans 600–700` con `tabular-nums`.
- **Títulos de actividades en historial:** **`lang="en"`** si están en inglés.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Tarjeta de Racha Semanal** | `width: 100%`, `min-height: 152px`; ícono `56 × 56 px`; píldora escudo `min-height: 40px`. | `padding: 24px`, `border-radius: 16px`, `border: 1.5px solid #D8C2A8` | — |
| **Rejilla de Insignias** | Escritorio (`>= 961px`): `3 columnas` (`gap: 16px`). Tablet (`681–960px`): `2 columnas`. Móvil (`<= 680px`): `1 columna`. | Tarjeta `padding: 18px`, `border-radius: 16px`, `border: 1.5px solid #4A2511` | Medalla `48 × 48 px` (`border-radius: 12px`). |
| **Lista Historial** | Contenedor `border: 1.5px solid #D8C2A8`, `border-radius: 16px`; fila `min-height: 68px`, `padding: 16px 20px`. | Divisor `1px solid #F3EADA`, hover `#FAF6EE` | En `390px` apila nota y botón limpiamente sin recorte. |
| **Enlace `Ver detalles`** | **`min-height: 48px`**, **`min-width: 120px`**, `inline-flex items-center justify-center`. | `padding: 10px 16px`, `border: 1.5px solid #D8C2A8`, `border-radius: 12px` | Corrige el tamaño actual `< 48px`. |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F3EADA`, *«Cargando tu progreso…»*.
- **Error (`error || !progress`):** `ErrorState` `variant="teens"` (`#FDECE9`, `#B9251D`, botón `Reintentar` `>= 48px`).
- **Sin insignias / sin historial:** tarjeta `#FFFFFF`, borde `1.5px solid #D8C2A8`, `FoxTeensIllustration` discreto y CTA `>= 48px` hacia `/inicio`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar la rama Teens en [progreso-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/progreso/progreso-client.tsx):**
   - Retirar todas las clases `bg-zinc-900`, `bg-zinc-800`, `text-indigo-*` en el tema Teens.
   - Aplicar tokens `[data-theme="teens"]` (`#FFFFFF`, `#F3EADA`, `#D8C2A8`, `#4A2511`, `#FFCA3A`, `#E6F5EA`, `#FFF1C2`).
   - Elevar `Ver detalles` y botón `Reintentar` de `ErrorState` a `min-h-12`.
   - Reemplazar estrellas Unicode por SVG con `role="img"` y `aria-label`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Paleta Teens cálida aplicada (`#FAF6EE` / `#FFFFFF` / `#F3EADA`), cero fondos `zinc-900/950`.
- [ ] Todos los enlaces `Ver detalles` y `Reintentar` miden **`>= 48 × 48 px CSS`**.
- [ ] Estrellas SVG accesibles, `tabular-nums` en rachas/notas/fechas y cero rankings.
- [ ] `0` violaciones `axe-core`, `0` desborde horizontal en los 3 viewports, `typecheck` y `lint` en verde.
