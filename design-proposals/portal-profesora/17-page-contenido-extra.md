# Plan de Implementación — Profesora: Contenido Extra (`/contenido-extra`)

> **Alcance:** Rediseño de `/contenido-extra` en **Estudio Editorial Cálido**, cubriendo el conmutador de visibilidad `extra_content` (`aria-pressed`), cupo máximo `X / 200 enlaces`, filtros por nivel MCER, verificación de enlaces `https://` (**cero iframes**), y reordenamiento atómico con botones explícitos **`Subir ↑`** y **`Bajar ↓`** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.7). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/contenido-extra` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/contenido-extra/page.tsx), [contenido-extra-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/contenido-extra/contenido-extra-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 17 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-05`, Decisiones 124 (flag `extra_content`), 125 (filtro por nivel), 126 (tope 200 enlaces), `G-C05` (sin iframes), `G-C13` (`https:` + `noopener noreferrer`) |

---

## 1. Objetivo de la página y alcance

Dar a la profesora control claro y ergonómico sobre la biblioteca externa de la organización: saber de un vistazo si la sección está **Visible** u **Oculta** para los alumnos, cuántas plazas quedan del tope de **200 enlaces**, crear/editar URLs `https://` válidas y reordenarlas de forma segura mediante **`Subir ↑`** y **`Bajar ↓`** (deshabilitados cuando hay un filtro de nivel distinto de `Todos`).

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Banner contextual cuando `extra_content === false`:** aviso no bloqueante en `#FFF6E3` con borde `#C6470B`: *«Sección oculta para los estudiantes. Puedes preparar y ordenar los enlaces ahora y activarla cuando estés lista.»* + botón **`Habilitar sección para estudiantes`** (`#C6470B`).
  - **Cabecera operativa:** título `<h1>Contenido Extra</h1>`, toggle de estado con `aria-pressed` (`✓ Visible para estudiantes` en `#E6F5EA`/`#166534` vs. `○ Oculto para estudiantes` en `#F6EFE4`/`#5E3E2C`), contador de cupo **`X / 200 enlaces`** en `tabular-nums`, y CTA **`+ Nuevo enlace`** (`#C6470B`, deshabilitado al llegar a 200).
  - **Filtros por segmento MCER:** botones `Todos`, `General`, `Nivel A1`, `Nivel A2`, `Nivel B1`, `Nivel B2` (`min-height: 40px` escritorio / `48px` tablet).
  - **Lista / Tabla ordenada:** número de orden (`1, 2, 3…`), título, badge de nivel (`General` `#E6F5EA`/`#166534` o `Nivel A1–B2` `#FFF0DE`/`#872E06`), descripción breve, dominio destino visible (`new URL(url).hostname`) + enlace de prueba `Abrir ↗` (`target="_blank" rel="noopener noreferrer"`), botones explícitos **`Subir ↑`** y **`Bajar ↓`** (`min-height: 44–48px`, deshabilitados en extremos, mientras muta o si `levelFilter !== 'todos'` mostrando la nota explicativa *«Selecciona el filtro «Todos» para reordenar el catálogo completo.»*), y acciones **`Editar`** / **`Eliminar`** (`ConfirmDialog`).
  - **Modal Crear / Editar enlace (`AccessibleModal` Nivel 2):** inputs `#9A7B5C` (`Título`, `URL https://...`, `Nivel` opcional, `Descripción`) validados con `isValidHttpsResourceUrl`.
- **Permanece intacto:**
  - `flagsQuery`, `resourcesQuery` (`/api/v1/resources`), `toggleFlagMutation` (`PATCH /api/v1/feature-flags/extra_content`), `createResourceMutation`, `updateResourceMutation`, `deleteResourceMutation` y `reorderMutation` (`PUT /api/v1/resources/reorder`).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Banner sección oculta** | `--surface-callout` / `--accent-primary` | `#FFF6E3`, borde `1px solid #C6470B`, texto `#2B150A` | **16,09:1 (AAA)** |
| **Estado `✓ Visible para estudiantes` / badge `General`** | `--status-ok-bg` / `-ink` | `#E6F5EA`, texto `#166534`, borde `#B7DFC2` | **6,32:1 (AA+)** |
| **Estado `○ Oculto` / barra filtros** | `--surface-subtle` | `#F6EFE4`, texto `#5E3E2C`, borde `#E4D5C3` | **8,35:1 (AAA)** |
| **Badge `Nivel A1–B2` / filtro activo** | `--accent-primary-soft` / `--accent-primary` | `#FFF0DE` (`#872E06`) o `#C6470B` (texto `#FFFFFF`) | **>= 4,88:1** |
| **Botones `Subir ↑` / `Bajar ↓` / `Editar`** | `--surface-card` / `--border-control` | `#FFFFFF`, borde `1px solid #9A7B5C`, texto `#2B150A` (hover `#F6EFE4`) | **17,29:1 (AAA)** |
| **Acción `Eliminar` / error URL inválida** | `--accent-danger` / `-soft` | Botón `#B9251D` texto `#FFFFFF` en modal · `#831712` sobre `#FDECE9` | **6,28–8,75:1** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Cupo `X / 200 enlaces` y numeración de orden `1, 2, 3…`:** `Plus Jakarta Sans 600–700`, **`tabular-nums`**.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Cabecera operativa** | Flex `space-between` (`flex-wrap` en `820px`); toggle `aria-pressed` y CTA `+ Nuevo enlace` **`min-height: 44px`** (`48px` tablet). | `border-radius: 10px` | — |
| **Filtros MCER** | 6 botones en `flex-wrap; gap: 8px`; **`min-height: 40px`** (`48px` tablet). | `padding: 8px 14px`, `border-radius: 8px` | — |
| **Filas / tarjetas de recurso** | Contenedor `#FFFFFF`, `border: 1px solid #E4D5C3`, `border-radius: 12px`; cada ítem `padding: 16px 20px`. | — | Dominio con `break-all` seguro en `820px`. |
| **Botones `Subir ↑` y `Bajar ↓`** | **`min-height: 44px`** (`48px` tablet), **`min-width: 92px`**. | `padding: 8px 12px`, `border: 1px solid #9A7B5C`, `border-radius: 8px` | Deshabilitados claramente en primer/último elemento, cargando o si `levelFilter !== 'todos'`. |
| **Modal Crear/Editar y `ConfirmDialog`** | `max-width: 520px`, `padding: 24px`; inputs **`min-height: 42px`** (`48px` tablet); botones **`min-height: 44px`** (`48px` tablet). | `border: 1px solid #CBB499`, `border-radius: 14px` | Foco inicial en `firstInputRef` / `cancelDeleteRef`. |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F6EFE4` de cabecera y 4 filas.
- **Sin recursos en el catálogo / filtro:** tarjeta `#FFFFFF` invitando a agregar el primer enlace `https://`.
- **Cupo lleno (`200 / 200`):** botón `+ Nuevo enlace` deshabilitado con nota aclaratoria en `#FFF1C2`.
- **URL no `https:`:** validación `isValidHttpsResourceUrl` con mensaje claro en `#FDECE9` (`role="alert"`).

---

## 6. Plan de implementación paso a paso

1. **Actualizar [contenido-extra-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/contenido-extra/contenido-extra-client.tsx):**
   - Aplicar banner `#FFF6E3` cuando `!isExtraContentEnabled`, toggle `aria-pressed`, contador `X / 200` en `tabular-nums`, filtros `#F6EFE4` y tarjetas/lista editorial `#FFFFFF` + `#E4D5C3`.
   - Elevar botones `Subir ↑` / `Bajar ↓` a `min-h-[44px]` (`min-h-[48px]` tablet) y mostrar la nota aclaratoria cuando `levelFilter !== 'todos'`.
   - Estilizar el modal de creación/edición y confirmación de eliminación con `Nivel 2` (`#CBB499`), borde `#9A7B5C` en inputs y **cero iframes**.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C05` sin iframes, `G-C13` solo `https:`, Decisiones 124–126, `check-guardrails.mjs`), `accessibility` (`aria-pressed`, controles `>= 44–48px`), `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Conmutador `extra_content` con `aria-pressed` y banner no bloqueante cuando está oculto.
- [ ] Contador `X / 200 enlaces` con `tabular-nums` y bloqueo al alcanzar tope 200.
- [ ] Botones `Subir ↑` / `Bajar ↓` (`>= 44–48px`) deshabilitados con aviso si hay filtro distinto de `Todos`.
- [ ] Validación estricta `https://` (`isValidHttpsResourceUrl`), `rel="noopener noreferrer"` y cero `<iframe>`.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
