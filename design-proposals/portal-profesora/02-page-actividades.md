# Plan de Implementación — Profesora: Catálogo de Actividades (`/actividades`)

> **Alcance:** Rediseño de `/actividades` (y verificación de redirección limpia en `/contenidos`) en **Estudio Editorial Cálido** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.2). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/actividades` *(alias heredado `/contenidos` redirige aquí)* |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/page.tsx), [actividades-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/actividades-client.tsx), [contenidos/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/contenidos/page.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 2 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-03`, `SPEC-06`, Decisiones 66 (5 `ActivityType` y 5 `GameMechanic`), 95 (archivar no cancela asignaciones) |

---

## 1. Objetivo de la página y alcance

Transformar el catálogo de actividades actual en una **tabla editorial limpia** con barra de filtros integrada en `#F6EFE4`, badges estandarizados (`Publicada`, `Borrador`, `Archivada`), columna `Título` con `lang="en"`, nota aclaratoria sobre archivo vs. asignaciones y diálogo de borrado accesible.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Cabecera:** `<h1>Catálogo de Actividades</h1>`, subtítulo de alcance curricular MCER (`A1–B2`) y botón primario **`+ Crear actividad`** (`/actividades/nueva`, `#C6470B`).
  - **Barra de filtros en `#F6EFE4` (`Nivel 0`):** segmentador `Catálogo activo` vs. `Archivadas`, selector **Tipo de actividad** con los **5 valores oficiales** (`Completar espacios`, `Pregunta abierta`, `Expresión oral (Speaking)`, `Microjuego`, `Examen` — alinear la etiqueta actual *«Rellenar huecos»* a *«Completar espacios»* para unificar nomenclatura) y selector **Nivel MCER** (`Todos`, `A1`, `A2`, `B1`, `B2`).
  - **Tabla editorial (`#FFFFFF`, `border: 1px solid #E4D5C3`):** columnas `Título` (`lang="en"`), `Tipo / Mecánica`, `Nivel`, `Estado` (badges §4.2 del diseño), `Duración` (`tabular-nums`) y acciones claras (`Editar`, `Duplicar`, `Archivar`/`Restaurar`, `Eliminar` habilitado solo en borradores sin asignaciones).
  - **Nota informativa discreta en `#FFF6E3`:** *«Archivar una actividad la oculta del catálogo activo, pero no cancela sus asignaciones existentes ni elimina las entregas.»* (Decisión 95).
- **Permanece intacto:**
  - `activitiesQuery`, `duplicateMutation`, `archiveMutation`, `restoreMutation`, `deleteMutation` (`ACTIVITY_DELETE_NOT_ALLOWED`), `ConfirmDialog` de eliminación y redirección de `/contenidos/page.tsx`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Barra de filtros y `thead`** | `--surface-subtle` | `#F6EFE4`, borde `1px solid #E4D5C3` | `#2B150A`: **15,14:1 (AAA)** |
| **Segmentador activo** | `--surface-card` / `--accent-primary` | `#FFFFFF`, borde `#C6470B`, texto `#872E06` | **7,74:1 (AAA)** |
| **Badge `Publicada`** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, texto `#166534`, borde `#B7DFC2` | **6,32:1 (AA+)** |
| **Badge `Borrador`** | `--surface-subtle` | `#F6EFE4`, texto `#5E3E2C`, borde `#E4D5C3` | **8,35:1 (AAA)** |
| **Badge `Archivada`** | `--accent-warm-soft` | `#FFF1C2`, texto `#543200`, borde `#E5C97B` | **10,15:1 (AAA)** |
| **Selectores de filtro** | `--border-control` | `#FFFFFF`, borde `1px solid #9A7B5C`, texto `#2B150A` | **3,92:1 (AA UI)** |
| **Botón `+ Crear actividad` y enlaces `Editar`** | `--accent-primary` | `#C6470B` (hover `#A53906`) | **4,88:1 (AA)** |
| **Acción `Eliminar` (borradores)** | `--accent-danger` | `#B9251D` sobre `#FFFFFF` (hover `#FDECE9`) | **6,01:1 (AA+)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Encabezados `<th>`:** `Plus Jakarta Sans 700`, `0.75rem` (`12px`), `letter-spacing: 0.03em`, color `#5E3E2C`.
- **Celdas:** `Plus Jakarta Sans 400–600`, `0.875rem` (`14px`), **`lang="en"`** en títulos de actividad y `tabular-nums` en duración esperada.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas responsivas |
| --- | --- | --- | --- |
| **Barra superior** | Flex `space-between`; botón `+ Crear actividad` **`min-height: 44px`** (`48px` tablet). | `margin-bottom: 20px` | — |
| **Barra de filtros** | Flex/Grid de 3 controles (`Catálogo activo/Archivadas`, `Tipo`, `Nivel`); cada control **`min-height: 42px`** (`48px` tablet). | `padding: 16px`, `border-radius: 12px`, `border: 1px solid #E4D5C3` | En `820px` se distribuye en 2 filas limpias. |
| **Tabla editorial** | `width: 100%`; envoltorio `overflow-x: auto`; filas **`min-height: 52px`**, celdas `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px`, `0 1px 3px rgba(43,21,10,0.06)` | Botones de acción fila `min-height: 36–40px` (`48px` en tablet o con `gap: 8px`). |

---

## 5. Estados obligatorios y casos límite

- **Carga:** filas skeleton en `#F6EFE4`.
- **Vacío:** tarjeta `#FFFFFF`, ícono lineal neutro, *«No hay actividades que coincidan con estos filtros.»* y CTA `+ Crear actividad`.
- **Error de negocio (`ACTIVITY_DELETE_NOT_ALLOWED`) o red:** banner `#FDECE9` con borde `#B9251D`, `role="alert"` y botón cerrar accesible.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [actividades-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/actividades-client.tsx):**
   - Estandarizar `typeLabels[ActivityType.fill_blank]` a `'Completar espacios'` y badges de estado según paleta oficial.
   - Reemplazar filtros y tabla por `Nivel 0` (`#F6EFE4`) y tabla editorial (`#FFFFFF` + `#E4D5C3`), añadiendo `lang="en"` en títulos y `tabular-nums` en duración.
   - Incluir nota discreta `#FFF6E3` sobre Decisión 95 y asegurar confirmación `ConfirmDialog` estilizada al eliminar borrador.
2. **Conservar intacto [contenidos/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/contenidos/page.tsx)** como redirección a `/actividades`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`, `G-C01` nomenclatura exacta de 5 `ActivityType`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Los 5 `ActivityType` y estados usan badges con contraste `>= 4,5:1` y etiquetas exactas.
- [ ] Tabla encapsulada en `overflow-x: auto` sin desborde de viewport en `1440×900`, `1280×800` y `820×1080`.
- [ ] Botón eliminar solo habilitado en borradores sin asignaciones (`ACTIVITY_DELETE_NOT_ALLOWED` manejado).
- [ ] Pasa `typecheck`, `lint`, `axe-core` y `check-guardrails.mjs`.
