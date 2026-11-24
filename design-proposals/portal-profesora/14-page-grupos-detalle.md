# Plan de Implementación — Profesora: Detalle de Grupo (`/grupos/[id]`)

> **Alcance:** Rediseño de `/grupos/[id]` en **Estudio Editorial Cálido**, mostrando ficha del grupo, renombrado, archivo seguro (`GROUP_HAS_ACTIVE_STUDENTS`), directorio de miembros vigentes y accesos hacia estadísticas y asignaciones ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/grupos/[id]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx), [grupo-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/grupos/[id]/grupo-detail-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [13-page-grupos.md](./13-page-grupos.md) |
| **Orden de implementación** | **Página 14 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-02`, Decisión 96 (`GROUP_HAS_ACTIVE_STUDENTS`), `G-A06` |

---

## 1. Objetivo de la página y alcance

Ofrecer una vista focalizada por aula/grupo con acciones rápidas (`Renombrar`, `Archivar`, enlace a `/asignaciones?groupId=${id}` y `/estadisticas?tab=groups`) y la tabla limpia de estudiantes miembros con enlace directo a su ficha `/alumnos/[id]`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Breadcrumb `Grupos / [Nombre del grupo]`, badge de estado (`Activo` `#E6F5EA`/`#166534` o `Archivado` `#FFF1C2`/`#543200`) y botones de cabecera (`Renombrar`, `Ver asignaciones`, `Archivar grupo`).
  - Edición inline de nombre con input `#9A7B5C` (`min-height: 42px`), botón `Guardar` (`#C6470B`) y `Cancelar`.
  - Tabla editorial de miembros vigentes (`Nombre`, `Correo`, `Nivel MCER`, `Segmento`, acción `Ver ficha →`) sobre `#FFFFFF` con `thead` `#F6EFE4`.
  - Bloque informativo `#FFF6E3` si el grupo tiene alumnos activos explicando por qué el archivo requiere trasladarlos primero desde su ficha.
- **Permanece intacto:**
  - `groupQuery` (`/api/v1/groups/${id}`), `membersQuery` (`/api/v1/groups/${id}/members`), `renameMutation`, `archiveMutation` (`GROUP_HAS_ACTIVE_STUDENTS`) y `ConfirmDialog`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

- Superficies `#FCF9F2`, `#FFFFFF`, `#F6EFE4`, `#FFF6E3`, borde `#E4D5C3` / `#9A7B5C`.
- Badges: `Activo` `#E6F5EA`/`#166534` (**6,32:1 AA+**); `Archivado` `#FFF1C2`/`#543200` (**10,15:1 AAA**).
- CTA primario `#C6470B`; botón destructivo/archivo con borde `#B9251D` texto `#831712`; foco `#1D4ED8`.

---

## 3. Tipografía y reglas de texto

- **`<h1>` nombre del grupo:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Tabla miembros y conteos:** `Plus Jakarta Sans 400–600`, `0.875rem`, `tabular-nums`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Cabecera + acciones** | Flex `space-between` (`flex-wrap` en `820px`); botones **`min-height: 42px`** (`48px` tablet). | `margin-bottom: 20px` | — |
| **Tabla miembros vigentes** | `overflow-x: auto`; filas **`min-height: 50px`**, `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueleto `#F6EFE4`.
- **Grupo vacío (0 miembros):** tarjeta `#FFFFFF` indicando que este grupo puede archivarse con seguridad si ya no se usará.
- **Error `GROUP_HAS_ACTIVE_STUDENTS` / `404`:** alerta `role="alert"` en `#FDECE9`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [grupo-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/grupos/[id]/grupo-detail-client.tsx):**
   - Añadir breadcrumb `Grupos / [Nombre]`, aplicar tarjetas `Nivel 1`, tabla editorial de miembros con `tabular-nums`, enlaces a `/alumnos/[id]` y `/asignaciones?groupId=${id}`, e integrar `ConfirmDialog` estilizado.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`, Decisión 96), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Tabla de miembros vigente encapsulada (`overflow-x: auto`) con enlace directo a `/alumnos/[id]`.
- [ ] Renombrado bloqueado en grupos archivados y archivo protegido con `GROUP_HAS_ACTIVE_STUDENTS`.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
