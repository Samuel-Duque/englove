# Plan de Implementación — Profesora: Gestión de Grupos (`/grupos`)

> **Alcance:** Rediseño de `/grupos` en **Estudio Editorial Cálido**, con filtro `Activos` / `Archivados`, creación y renombrado en línea, conteo de alumnos vigentes y archivo seguro bloqueado si hay alumnos activos (`GROUP_HAS_ACTIVE_STUDENTS`) ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/grupos` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/grupos/page.tsx), [grupos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/grupos/grupos-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 13 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-02`, Decisión 96 (`GROUP_HAS_ACTIVE_STUDENTS`, sin borrado destructivo con historial), `G-A06` |

---

## 1. Objetivo de la página y alcance

Presentar un directorio claro de grupos escolares con creación rápida, renombrado limpio en línea, conteo de alumnos activos (`tabular-nums`), enlace directo al detalle `/grupos/[id]` y manejo comprensible de la regla de archivo seguro.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Encabezado:** `<h1>Grupos</h1>`, subtítulo breve y CTA primario **`+ Nuevo grupo`** (`#C6470B`, `min-height: 44px`).
  - **Barra de filtro en `#F6EFE4` (`Nivel 0`):** segmentador `Activos` / `Archivados` / `Todos` (con píldora activa `#FFFFFF` + borde `#C6470B` + texto `#872E06`).
  - **Formulario inline / tarjeta `Crear grupo`:** tarjeta `#FFFFFF` (`border: 1px solid #CBB499`), input con borde `#9A7B5C` y botones `Crear grupo` / `Cancelar`.
  - **Tabla editorial (o tarjetas ordenadas Nivel 1):** columnas `Nombre del grupo`, `Estado` (`Activo` `#E6F5EA`/`#166534` o `Archivado` `#FFF1C2`/`#543200`), `Alumnos vigentes` (`tabular-nums`), y acciones (`Ver detalle →`, `Renombrar`, `Archivar` con `ConfirmDialog`).
- **Permanece intacto:**
  - `groupsQuery` (`/api/v1/groups`), `createGroupMutation`, `renameGroupMutation` (`GROUP_ARCHIVED`), `archiveGroupMutation` (`GROUP_HAS_ACTIVE_STUDENTS`) y `ConfirmDialog`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

- Superficies `#FCF9F2`, `#FFFFFF`, `#F6EFE4`, borde `#E4D5C3` / `#9A7B5C` en inputs.
- Badges: `Activo` `#E6F5EA` / `#166534` (**6,32:1 AA+**); `Archivado` `#FFF1C2` / `#543200` (**10,15:1 AAA**).
- Botón `+ Nuevo grupo` / `Guardar`: `#C6470B` (hover `#A53906`, **4,88:1 AA**).
- Error `GROUP_HAS_ACTIVE_STUDENTS`: `#FDECE9` / `#831712` / borde `#B9251D` (**8,75:1 AAA**).
- Foco: `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`).

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Tabla y formularios:** `Plus Jakarta Sans 400–600`, `0.875rem–0.9375rem`, `tabular-nums` en conteos de alumnos.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Segmentador filtros** | Botones **`min-height: 40px`** (`48px` tablet), `padding: 8px 16px`. | `border-radius: 8px` | — |
| **Formulario crear / renombrar** | Inputs **`min-height: 42px`** (`48px` tablet); botones `min-height: 42px` (`48px` tablet). | `padding: 18px 20px`, `border-radius: 12px` | — |
| **Tabla editorial de grupos** | `overflow-x: auto`; filas **`min-height: 52px`**, `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | En `Archivar`, explicar con `GROUP_HAS_ACTIVE_STUDENTS` cómo trasladar antes en `/alumnos`. |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueleto `#F6EFE4` de 4 filas.
- **Vacío:** tarjeta `#FFFFFF` invitando a crear el primer grupo.
- **Conflicto `GROUP_HAS_ACTIVE_STUDENTS` o `GROUP_ARCHIVED`:** alerta focalizada `role="alert"` en `#FDECE9` con enlace rápido hacia `/alumnos`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [grupos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/grupos/grupos-client.tsx):**
   - Aplicar barra de filtros `Nivel 0` (`#F6EFE4`), tarjeta de creación con borde `#9A7B5C`, tabla editorial `#FFFFFF` + `#E4D5C3`, badges oficiales y `tabular-nums` en conteos.
   - Estilizar `ConfirmDialog` de archivo con `Nivel 2` (`#CBB499`) y garantizar mensajes claros para `GROUP_HAS_ACTIVE_STUDENTS`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`, Decisión 96), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Creación, renombrado (bloqueado en archivados) y archivo seguro (`GROUP_HAS_ACTIVE_STUDENTS`) claros y accesibles.
- [ ] Conteos de alumnos vigentes con `tabular-nums` y badges `Activo`/`Archivado` en paleta oficial.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
