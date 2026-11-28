# Plan de Implementación — Profesora: Asignaciones (`/asignaciones`)

> **Alcance:** Rediseño de `/asignaciones` en **Estudio Editorial Cálido**, destacando la regla de exclusión de microjuegos (`game` nunca se asigna) y unificando filtros, badges de disponibilidad y barras de cumplimiento ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.3). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/asignaciones` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/page.tsx), [asignaciones-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/asignaciones-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 5 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-04`, Decisiones 60, 98, 99, 111, 130 (`CONTEXT.md` §16) |

---

## 1. Objetivo de la página y alcance

Dar a `/asignaciones` un diseño tabular preciso con **callout visible de regla de dominio** (`game` nunca requiere asignación), filtros por `Grupo` (incluidos archivados con etiqueta `(Archivado)` para consulta histórica) y `Disponibilidad`, badges homologados (`Abierta`, `Programada`, `Cerrada`, `Cancelada`), fechas `America/Bogota` en `tabular-nums`, barra de cumplimiento y acceso directo a `/asignaciones/[id]` y `/asignaciones/nueva`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Encabezado + Callout de regla de dominio:** título `<h1>Asignaciones</h1>`, botón primario **`+ Nueva asignación`** (`/asignaciones/nueva`, `#C6470B`) y callout en `#FFF6E3` con borde `#E4D5C3` explicando que solo se asignan los 4 tipos evaluables (`Completar espacios`, `Pregunta abierta`, `Speaking`, `Examen`) y que los microjuegos publicados quedan abiertos 24/7.
  - **Barra de filtros en `#F6EFE4` (`Nivel 0`):** selector `Grupo` y selector `Disponibilidad` (`Todas`, `Programadas`, `Abiertas`, `Cerradas`, `Canceladas`) con borde `#9A7B5C`, más píldora de resumen `N asignaciones`.
  - **Badges de disponibilidad según §4.2 del diseño:** cambiar `Programada` de azul Tailwind (`bg-blue-50`) a Terracota Suave `#FFF0DE` / `#872E06`, y homologar `Abierta` (`#E6F5EA`/`#166534`), `Cerrada` (`#F6EFE4`/`#5E3E2C`) y `Cancelada` (`#FDECE9`/`#831712`).
  - **Columna `Cumplimiento`:** barra de progreso limpia (`6px` alto, `#C6470B` o `#166534` sobre pista `#F6EFE4`) + fracción `completados / obligados` en `tabular-nums`.
- **Permanece intacto:**
  - Sincronización de `searchParams` (`notice`, `groupId`, `availability`), `groupsQuery` (`/api/v1/groups?limit=100`), `assignmentsQuery` (`/api/v1/assignments`), formato `formatBogotaDateTime` y manejo de códigos `404`/`403`/`429`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Callout regla de exclusión `game`** | `--surface-callout` | `#FFF6E3`, borde `1px solid #E4D5C3`, texto `#2B150A` | **16,09:1 (AAA)** |
| **Barra filtros y `thead`** | `--surface-subtle` | `#F6EFE4`, borde `1px solid #E4D5C3` | **15,14:1 (AAA)** |
| **Badge `Abierta`** | `--status-ok-bg` / `-ink` | `#E6F5EA`, texto `#166534`, borde `#B7DFC2` | **6,32:1 (AA+)** |
| **Badge `Programada`** | `--accent-primary-soft` | `#FFF0DE`, texto `#872E06`, borde `#E7C099` | **7,74:1 (AAA)** |
| **Badge `Cerrada`** | `--surface-subtle` | `#F6EFE4`, texto `#5E3E2C`, borde `#E4D5C3` | **8,35:1 (AAA)** |
| **Badge `Cancelada`** | `--accent-danger-soft` | `#FDECE9`, texto `#831712`, borde `#EABCB5` | **8,75:1 (AAA)** |
| **CTA `+ Nueva asignación` y enlace `Ver detalle`** | `--accent-primary` | `#C6470B` (hover `#A53906`) | **4,88:1 (AA)** |
| **Barra de cumplimiento** | `--accent-primary` / `--surface-subtle` | Relleno `#C6470B` (`#166534` al 100 %) sobre `#F6EFE4` | `>= 4,88:1` |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Títulos de actividad en tabla:** `Plus Jakarta Sans 600`, `0.875rem` (`14px`), **`lang="en"`**.
- **Fechas `Apertura` / `Cierre` y fracción `Cumplimiento`:** `Plus Jakarta Sans 500–600`, `tabular-nums`, zona horaria `America/Bogota`.
- **Etiqueta tipo:** usar `'Completar espacios'` para `ActivityType.fill_blank` (consistencia total con el catálogo).

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas de layout |
| --- | --- | --- | --- |
| **Cabecera + CTA** | Botón `+ Nueva asignación` **`min-height: 44px`** (`48px` tablet), `padding: 10px 18px`. | `border-radius: 10px` | — |
| **Callout regla `game`** | `width: 100%`, `padding: 12px 16px`, `border-radius: 10px`. | `margin-bottom: 16px` | Ícono lineal `Info` (`18px`, `#C6470B`). |
| **Barra de filtros** | `grid-template-columns: 1fr 1fr auto` en `>= 1024px`, `1fr` en `<= 1023px`; selects **`min-height: 42px`** (`48px` tablet). | `padding: 16px`, `border-radius: 12px`, `gap: 14px` | — |
| **Tabla editorial** | `overflow-x: auto`; filas **`min-height: 54px`**, celdas `padding: 12px 16px`; barra cumplimiento `width: 96px; height: 6px; border-radius: 999px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | Enlace `Ver detalle →` con `min-height: 40px` (`48px` tablet). |

---

## 5. Estados obligatorios y casos límite

- **Notice `?notice=...` (p. ej. tras crear o cancelar):** banner cálido `#E6F5EA` o `#FFF6E3` con `role="status"`.
- **Carga (`isLoading`):** esqueleto de 5 filas `#F6EFE4`.
- **Vacío:** tarjeta `#FFFFFF`, mensaje contextual y botón `+ Nueva asignación`.
- **Error (`error`):** banner `#FDECE9` con borde `#B9251D`, `role="alert"` y botón `Reintentar`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [asignaciones-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/asignaciones-client.tsx):**
   - Añadir callout superior `#FFF6E3` sobre exclusión de microjuegos (`game`, Decisiones 111 y 130).
   - Aplicar estilos `Nivel 0` (`#F6EFE4`) a filtros y `Nivel 1` (`#FFFFFF` + `#E4D5C3`) a la tabla editorial, homologando los 4 badges de disponibilidad (`#FFF0DE` para `Programada`) y añadiendo `tabular-nums` + barra de cumplimiento + `lang="en"` en nombres de actividad.
   - Asegurar `min-h-[44px]` (`min-h-[48px]` tablet) en controles interactivos.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`, Decisiones 99, 111, 130), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Callout visible de exclusión de `game` y badges oficiales (`Abierta`, `Programada` en `#FFF0DE`, `Cerrada`, `Cancelada`).
- [ ] Grupos archivados mostrados con etiqueta `(Archivado)` en el filtro histórico.
- [ ] Fechas en `America/Bogota` y cumplimiento con `tabular-nums` en tabla encapsulada (`overflow-x: auto`).
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
