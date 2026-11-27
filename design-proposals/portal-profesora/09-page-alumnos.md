# Plan de Implementación — Profesora: Directorio de Alumnos (`/alumnos`)

> **Alcance:** Rediseño de `/alumnos` (pestaña `Alumnos activos` y contenedor de las sub-pestañas `Solicitudes de registro` y `Bloqueados`) en **Estudio Editorial Cálido** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/alumnos` *(sub-rutas `?tab=students`, `?tab=requests`, `?tab=locked`)* |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/page.tsx), [alumnos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/alumnos-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 9 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-02`, Decisiones 33, 35 (auto-registro único medio de alta; `guardian_*` en `Student` sin entidad `Guardian`), 73 (grupo único por alumno) |

---

## 1. Objetivo de la página y alcance

Unificar la gestión de alumnos bajo pestañas limpias (`role="tablist"` con enlaces rápidos/contadores), presentando el directorio de alumnos activos en tabla editorial sin botón «Crear alumno» (recordando discretamente que el alta ocurre por auto-registro con aprobación docente) y enlace directo `Ver ficha →` hacia `/alumnos/[id]`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Cabecera + nota de regla de alta:** título `<h1>Alumnos</h1>` y callout sutil en `#FFF6E3` (*«Los estudiantes ingresan mediante auto-registro y aprobación docente en la pestaña Solicitudes.»*).
  - **Barra de pestañas (`role="tablist"`):** `Alumnos activos`, `Solicitudes de registro` (badge `#FFF1C2` / `#543200` si hay pendientes) y `Bloqueados` (badge `#FDECE9` / `#831712` si hay cuentas bloqueadas), con indicador activo `#C6470B`. Incluir además enlace discreto hacia `/grupos`.
  - **Tabla editorial (`#FFFFFF`, `thead` `#F6EFE4`):** columnas `Nombre` (enlace a `/alumnos/[id]`), `Correo`, `Nivel MCER`, `Grupo vigente` (único por alumno, Decisión 73), `Segmento` (`Kids`/`Teens`), `Contacto acudiente` (resumen discreto) y acción `Ver ficha →`.
- **Permanece intacto:**
  - `studentsQuery` (`/api/v1/students?limit=100`), sincronización `?tab=...` con `router.replace`, estado de carga/error y navegación hacia las pestañas documentadas en [10-page-alumnos-solicitudes.md](./10-page-alumnos-solicitudes.md) y [11-page-alumnos-bloqueados.md](./11-page-alumnos-bloqueados.md).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Callout regla auto-registro** | `--surface-callout` | `#FFF6E3`, borde `1px solid #E4D5C3`, texto `#2B150A` | **16,09:1 (AAA)** |
| **Pestaña activa / enlaces de acción** | `--accent-primary` | `#C6470B` (hover `#A53906`) · fondo suave `#FFF0DE` (`#872E06`) | **>= 4,88:1** |
| **Tabla (`thead` / contenedor)** | `--surface-subtle` / `--surface-card` | `#F6EFE4` / `#FFFFFF`, borde `1px solid #E4D5C3` | **15,14–17,29:1 (AAA)** |
| **Badge Segmento (`Kids` / `Teens`) y Nivel** | `--surface-subtle` / `--accent-warm-soft` | `#F6EFE4` (`#5E3E2C`) / `#FFF1C2` (`#543200`) | **>= 8,35:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Pestañas y tabla:** `Plus Jakarta Sans 400–700`, `0.875rem` (`14px`), `tabular-nums` en contadores de pestañas.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Barra de pestañas (`role="tablist"`)** | Cada `role="tab"` **`min-height: 44px`** (`48px` tablet), `padding: 10px 16px`. | `border-bottom: 1px solid #E4D5C3`, borde inferior activo `2.5px solid #C6470B` | Soporte completo de `aria-selected`. |
| **Tabla de alumnos activos** | `overflow-x: auto`; filas **`min-height: 52px`**, celdas `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | Correo largo con `truncate` seguro o `max-width` limpio. |
| **Enlace `Ver ficha →`** | **`min-height: 40px`** (`48px` tablet), `padding: 8px 12px`. | `border-radius: 8px`, color `#C6470B` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueleto de 6 filas `#F6EFE4`.
- **Sin alumnos aprobados:** tarjeta `#FFFFFF` indicando que cuando lleguen registros aparecerán en `Solicitudes de registro`.
- **Error de carga:** banner `#FDECE9` con borde `#B9251D`, `role="alert"` y botón `Reintentar`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [alumnos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/alumnos-client.tsx) (shell de pestañas y vista `activeTab === 'students'`):**
   - Estandarizar las 3 pestañas con `role="tablist"` / `role="tab"` / `aria-selected` y badges contadores.
   - Añadir callout `#FFF6E3` recordando el flujo de auto-registro (sin botón «Crear alumno»).
   - Estilizar la tabla editorial de alumnos activos (`#FFFFFF`, `thead` `#F6EFE4`, bordes `#E4D5C3`) mostrando grupo único vigente y contacto del acudiente como datos de `Student`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C05` sin entidad `Guardian`, `check-guardrails.mjs`), `accessibility` (`tablist` ARIA), `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Sin botón «Crear alumno»; regla de auto-registro visible en `#FFF6E3`.
- [ ] Pestañas `Alumnos activos`, `Solicitudes de registro` y `Bloqueados` con `role="tablist"` y contraste AA/AAA.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
