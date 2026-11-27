# Plan de Implementación — Profesora: Nueva Actividad (`/actividades/nueva`)

> **Alcance:** Rediseño del creador de actividades `/actividades/nueva` (y alias `/contenidos/onboarding`) con **objetivo de onboarding `< 10 minutos`** y sin JSON crudo ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.2). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/actividades/nueva` *(alias `/contenidos/onboarding` redirige aquí)* |
| **Archivos objetivo** | [nueva/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/nueva/page.tsx), [activity-editor.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/activity-editor.tsx), [onboarding/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/contenidos/onboarding/page.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [02-page-actividades.md](./02-page-actividades.md) |
| **Orden de implementación** | **Página 3 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-03`, `SPEC-06`, `CONTEXT.md` §5.1 (`< 10 min`), Decisiones 66, 105, 140 (editor multi-oración/multi-hueco) |

---

## 1. Objetivo de la página y alcance

Vestir el potente `ActivityEditorComponent` (`activity-editor.tsx`) con la claridad y jerarquía del **Estudio Editorial Cálido**, reduciendo fatiga visual en formularios largos: paso claro de selección entre los **5 `ActivityType`** (con descripción de 1 línea y selector de las 5 `GameMechanic` para `game`), metadatos esenciales (`Título`, `Nivel MCER`, `Duración esperada`), constructor estructurado limpio y **pie fijo** con `Guardar borrador` y `Publicar actividad` + vista previa en modal para microjuegos.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Selector visual de los 5 `ActivityType`:** tarjetas limpias Nivel 1 (`#FFFFFF`, borde `1px solid #E4D5C3`; seleccionada `#FFF0DE` + borde `1.5px solid #C6470B`) con `aria-pressed` o `role="radiogroup"`. Para `game`, selector inmediato de las 5 mecánicas (`match`, `order_words`, `drag_drop`, `memory`, `timed_choice`).
  - **Metadatos y constructores estructurados (`fill_blank`, `exam`, `open_question`, `speaking`, `game`):**
    - Inputs/selects/textareas con borde `1px solid #9A7B5C` (`min-height: 42px`), `border-radius: 8px`, foco `#1D4ED8` y `lang="en"` en campos de enunciado en inglés.
    - Bloques de ítem/oración en `#FCF9F2` dentro de tarjeta `#FFFFFF` (`border: 1px solid #E4D5C3`, `border-radius: 12px`).
    - En **`exam`:** barra/tarjeta lateral o superior en `#FFF6E3` mostrando en tiempo real la **normalización de pesos al `100 %`** (`tabular-nums`) y regla mínima de 2 ítems.
    - En **`speaking`:** ayuda clara con límites (`mínimo 2 s`, defecto `120 s`, tope `300 s`).
  - **Pie de acciones sticky discreto (`#FFFFFF`, borde superior `#E4D5C3`):** botón secundario **`Guardar borrador`** (`#FFFFFF`, borde `#9A7B5C`), botón secundario **`Probar vista previa`** (si es `game`) y CTA primario **`Publicar actividad`** (`#C6470B`).
- **Permanece intacto:**
  - Toda la lógica interna de `activity-editor.tsx` (`generateUuid()`, manejo de ítems/blanks/opciones en `fill_blank` y `exam`, validaciones Zod/negocio, `POST /api/v1/activities`, `previewMode` con `<GameRenderer />` en `AccessibleModal`).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjetas de formulario** | `--surface-card` / `--border-hairline` | `#FFFFFF`, borde `1px solid #E4D5C3` | `#2B150A`: **17,29:1 (AAA)** |
| **Bloque de ítem / pregunta interna** | `--bg-canvas` / `--surface-subtle` | `#FCF9F2` (encabezado ítem `#F6EFE4`), borde `#E4D5C3` | **16,45:1 (AAA)** |
| **Tarjeta de tipo/mecánica seleccionada** | `--accent-primary-soft` / `--accent-primary` | `#FFF0DE`, borde `1.5px solid #C6470B`, texto `#2B150A` | **> 14:1 (AAA)** |
| **Barra normalización pesos (`exam`) / tips** | `--surface-callout` | `#FFF6E3`, borde `#E4D5C3`, texto `#2B150A` | **16,09:1 (AAA)** |
| **Controles de entrada (`input`, `select`, `textarea`)** | `--border-control` | `#FFFFFF`, borde `1px solid #9A7B5C` (hover `#4A2511`) | **3,92:1 (AA UI)** |
| **Botón `Publicar actividad`** | `--accent-primary` / `-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,88:1 (AA)** |
| **Botón `Guardar borrador`** | `--surface-card` | `#FFFFFF`, borde `1px solid #9A7B5C`, texto `#2B150A` | **17,29:1 (AAA)** |
| **Acciones quitar ítem / opción** | `--accent-danger` | `#B9251D` sobre `#FFFFFF` / `#FDECE9` | **>= 6,28:1** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Crear Actividad:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Títulos de sección / bloque (`<h2>`):** `Bricolage Grotesque 600`, `1.125rem` (`18px`).
- **Labels y campos:** `Plus Jakarta Sans 500–600`, `0.875rem` (`14px`); `tabular-nums` en duración esperada (`s`), pesos de examen (`%`) y conteos de opciones.
- **Atributo `lang="en"`** en inputs de título de actividad y enunciados en inglés.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas de layout |
| --- | --- | --- | --- |
| **Contenedor editor** | `max-width: 1024px` (o `1100px` con resumen lateral en `exam`) | `gap: 24px` | Mantiene lectura enfocada sin líneas interminables. |
| **Selector de 5 `ActivityType`** | `>= 1024px`: `5 columnas` (o `3+2`) · Tablet: `2–3 columnas`; cada tarjeta **`min-height: 88px`**, `padding: 14px`. | `border-radius: 12px` | — |
| **Metadatos (`Título`, `Nivel`, `Duración`)** | Grid `2fr 1fr 1fr` en `>= 768px`; controles **`min-height: 42px`** (`48px` tablet). | `padding: 20px`, `border-radius: 12px` | — |
| **Constructor de ítem (`fill_blank` / `exam` / `game`)** | Botones `+ Agregar oración / hueco / opción` **`min-height: 40px`** (`48px` tablet). | `padding: 18px`, `border-radius: 12px`, `gap: 14px` | Opciones alineadas en filas flex con botón `Eliminar` `>= 40px` (`48px` tablet) y radio/checkbox claro de respuesta correcta. |
| **Pie de acciones sticky** | `position: sticky; bottom: 0; z-index: 30`; botones **`min-height: 44px`** (`48px` tablet), `padding: 10px 20px`. | `padding: 14px 20px`, `border-top: 1px solid #E4D5C3`, fondo `rgba(255,255,255,0.96)` | En `820px` los botones se agrupan sin desbordar. |

---

## 5. Estados obligatorios y casos límite

- **Validación al publicar (`exam` < 2 ítems, huecos sin opción correcta, `speaking` fuera de `2–300 s`, título vacío):** alerta focalizada `role="alert"` en `#FDECE9` con mensaje claro en español.
- **Guardando (`isPending`):** botones deshabilitados con texto *«Guardando borrador…»* / *«Publicando…»*.
- **Modal vista previa de juego:** `AccessibleModal` (`max-width: 780px`) mostrando `<GameRenderer previewMode />` con botones de cierre `>= 44px`.

---

## 6. Plan de implementación paso a paso

1. **Conservar [nueva/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/nueva/page.tsx) y [onboarding/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/contenidos/onboarding/page.tsx)** como envoltorios limpios (añadiendo breadcrumb `Actividades / Nueva actividad` en `nueva/page.tsx` o dentro del editor cuando `!initialActivity`).
2. **Estilizar progresivamente [activity-editor.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/activity-editor.tsx)** (sin alterar los helpers ni schemas):
   - Unificar la paleta visual de secciones, selector de `ActivityType` y `GameMechanic`, metadatos, constructores por tipo (`fill_blank`, `exam`, `open_question`, `speaking`, `game`), indicador en vivo de pesos de `exam` (`100 %`), vista previa en modal y pie sticky de guardado/publicación.
   - Asegurar `border-[#9A7B5C]` en inputs/selects/textareas y foco `#1D4ED8`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C04` `answer_key` separado en backend, `G-C08` tipado estricto sin `any`), `accessibility`, `frontend-design`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Creación fluida de los 5 `ActivityType` sin JSON crudo y con paleta editorial cálida (`#FCF9F2`, `#FFFFFF`, `#F6EFE4`, `#C6470B`, `#9A7B5C`).
- [ ] `exam` muestra normalización proporcional al `100 %` y bloquea publicar con menos de 2 ítems.
- [ ] Preview de microjuegos en `AccessibleModal` funciona sin llamadas de red.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
