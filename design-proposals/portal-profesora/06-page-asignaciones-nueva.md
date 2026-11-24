# Plan de Implementación — Profesora: Nueva Asignación (`/asignaciones/nueva`)

> **Alcance:** Rediseño de `/asignaciones/nueva` en **Estudio Editorial Cálido**, manteniendo la exclusión estricta de `ActivityType.game`, la selección multigrupo con verificación atómica de duplicado (`ASSIGNMENT_ALREADY_ACTIVE`), fechas iniciales en `America/Bogota` y aviso de tolerancia de 24 h ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.3). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/asignaciones/nueva` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/nueva/page.tsx), [nueva-asignacion-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/nueva/nueva-asignacion-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [05-page-asignaciones.md](./05-page-asignaciones.md) |
| **Orden de implementación** | **Página 6 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-04`, Decisiones 60, 99 (`ASSIGNMENT_ALREADY_ACTIVE` atómico), 111 y 130 (sin `game`), `G-C08` |

---

## 1. Objetivo de la página y alcance

Presentar un formulario estructurado, sereno y rápido para asignar una actividad publicada a uno o varios grupos en una sola pantalla, con selección clara de fechas en hora Colombia (`America/Bogota`), vista previa del cierre con tolerancia de 24 h (`getExtendedDueAt`) y manejo focalizado de errores de conflicto.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Breadcrumb superior `Asignaciones / Nueva asignación`, título `<h1>Nueva asignación</h1>` y callout `#FFF6E3` recordando que los **microjuegos no aparecen** porque están publicados 24/7.
  - **Bloque 1 — Selección de actividad:** filtros rápidos por `Nivel MCER` y `Tipo` (solo 4 tipos asignables), tarjetas o filas seleccionables con borde `#E4D5C3` (activa `#FFF0DE` + `1.5px solid #C6470B`), título con `lang="en"` y nivel visible.
  - **Bloque 2 — Selección multigrupo:** checkboxes accesibles (`min-height: 44px` escritorio / `48px` tablet) sobre tarjetas `#FFFFFF` con borde `#9A7B5C` en reposo.
  - **Bloque 3 — Ventana temporal (hora Colombia):** inputs `datetime-local` para `opens_at` y `due_at` con borde `#9A7B5C` y caja informativa `#FFF6E3` mostrando el límite con tolerancia de 24 h (`getExtendedDueAt`).
  - **Pie de acciones:** `Cancelar` (hacia `/asignaciones`) y CTA primario **`Programar asignación`** (`#C6470B`).
- **Permanece intacto:**
  - `activitiesQuery` (`status=published`, filtrado `.filter((a) => a.type !== ActivityType.game)`), `groupsQuery` (`archived=false`), defaults de fecha en hora Bogotá, `POST /api/v1/assignments`, manejo atómico de `ASSIGNMENT_ALREADY_ACTIVE` con foco programático en `errorAlertRef`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjetas de bloque** | `--surface-card` / `--border-hairline` | `#FFFFFF`, borde `1px solid #E4D5C3` | `#2B150A`: **17,29:1 (AAA)** |
| **Actividad o grupo seleccionado** | `--accent-primary-soft` / `--accent-primary` | `#FFF0DE`, borde `1.5px solid #C6470B`, texto `#2B150A` | **> 14:1 (AAA)** |
| **Callout regla `game` / tolerancia 24h** | `--surface-callout` | `#FFF6E3`, borde `1px solid #E4D5C3`, texto `#2B150A` | **16,09:1 (AAA)** |
| **Inputs, selects y checkboxes** | `--border-control` | `#FFFFFF`, borde `1px solid #9A7B5C`, texto `#2B150A` | **3,92:1 (AA UI)** |
| **Alerta conflicto (`errorAlertRef`)** | `--accent-danger-soft` / `--accent-danger` | `#FDECE9`, borde `1px solid #B9251D`, texto `#831712` | **8,75:1 (AAA)** |
| **CTA `Programar asignación`** | `--accent-primary` / `-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,88:1 (AA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **`<h2>` de los 3 pasos/bloques:** `Bricolage Grotesque 600`, `1.125rem` (`18px`).
- **Títulos de actividad:** `Plus Jakarta Sans 600`, `0.9375rem`, **`lang="en"`**.
- **Fechas y horas (`formatBogotaDateTime`, `getExtendedDueAt`):** `Plus Jakarta Sans 600`, `tabular-nums`, explicitando hora Colombia.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas responsivas |
| --- | --- | --- | --- |
| **Contenedor formulario** | `max-width: 960px`, `gap: 20px` | — | 1 columna ordenada en secciones numeradas (`1`, `2`, `3`). |
| **Filtros y lista de actividades** | Lista desplazable `max-height: 320px` (con `tabindex="0"` y `role="region"` si tiene scroll); cada opción `min-height: 48px`. | `padding: 12px 14px`, `border-radius: 10px` | — |
| **Rejilla de grupos (checkboxes)** | `>= 768px`: `2 columnas` (`gap: 10px`); `< 768px`: `1 columna`; cada label-botón **`min-height: 48px`**. | `padding: 10px 14px`, `border-radius: 10px` | — |
| **Inputs `opens_at` y `due_at`** | `grid-template-columns: 1fr 1fr` (`gap: 16px`) en `>= 768px`; controles **`min-height: 44px`** (`48px` tablet). | `padding: 10px 12px`, `border-radius: 8px` | — |
| **Botones pie** | `Cancelar` (`#FFFFFF`, borde `#9A7B5C`) y `Programar asignación` (`#C6470B`) con **`min-height: 44px`** (`48px` tablet). | `padding: 10px 20px`, `border-radius: 10px` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F6EFE4` (`220px`), *«Cargando actividades y grupos…»*.
- **Sin actividades publicadas asignables / sin grupos activos:** estado vacío sereno en `#FFF6E3` con enlace directo a `/actividades/nueva` o `/grupos`.
- **Conflicto de negocio (`ASSIGNMENT_ALREADY_ACTIVE`, fechas inválidas):** alerta `#FDECE9` con `tabIndex={-1}` y `errorAlertRef.current?.focus()` automático para lectores de pantalla.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [nueva-asignacion-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/nueva/nueva-asignacion-client.tsx):**
   - Añadir breadcrumb `Asignaciones / Nueva asignación` y callout `#FFF6E3` de exclusión de `game`.
   - Aplicar contenedores `Nivel 1` (`#FFFFFF`, `#E4D5C3`) a los 3 bloques del formulario, bordes `#9A7B5C` en inputs/selects/checkboxes y foco `#1D4ED8`.
   - Homologar `'Completar espacios'` en `typeLabels` y añadir `lang="en"` + `tabular-nums` en fechas `America/Bogota`.
   - Mantener intactos el filtro `.filter((a) => a.type !== ActivityType.game)`, `errorAlertRef` y mutación atómica.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`, Decisiones 99, 111, 130), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] `ActivityType.game` excluido en filtros y listado de actividades asignables.
- [ ] Alerta de conflicto (`ASSIGNMENT_ALREADY_ACTIVE`) recibe foco programático y usa contraste `#831712` sobre `#FDECE9`.
- [ ] Preview en vivo de tolerancia 24h en `America/Bogota` con `tabular-nums`.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
