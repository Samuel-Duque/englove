# Plan de Implementación — Profesora: Detalle de Asignación (`/asignaciones/[id]`)

> **Alcance:** Rediseño de `/asignaciones/[id]` en **Estudio Editorial Cálido**, destacando la ficha de cumplimiento, el detalle por estudiante y el **diálogo crítico de cancelación definitiva** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §4.7 y §5.3). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/asignaciones/[id]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/[id]/page.tsx), [asignacion-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/[id]/asignacion-detail-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [05-page-asignaciones.md](./05-page-asignaciones.md) |
| **Orden de implementación** | **Página 7 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-04`, Decisión 98 (cancelación definitiva sin borrado), Decisión 60 (tolerancia 24h) |

---

## 1. Objetivo de la página y alcance

Mostrar la ficha completa de una asignación (actividad, grupo, ventana `opens_at`–`due_at` + tolerancia 24h, cumplimiento sobre `historical_student_count`, tabla de entregas de alumnos) con la paleta editorial cálida y el **diálogo crítico de cancelación** que explica claramente las consecuencias irreversibles de confirmar `cancelled_at`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Breadcrumb `Asignaciones / [Título]`, badge oficial de disponibilidad (`Programada` `#FFF0DE`, `Abierta` `#E6F5EA`, `Cerrada` `#F6EFE4`, `Cancelada` `#FDECE9`) y tarjetas resumen Nivel 1 (`#FFFFFF`, borde `#E4D5C3`).
  - Tabla editorial de estudiantes/entregas del grupo (`#F6EFE4` en `thead`, filas `>= 48px`, notas `0,0–5,0` y fechas en `tabular-nums`, enlaces directos a `/alumnos/[id]` o `/revision`).
  - Botón **`Cancelar asignación`** en `#B9251D` (solo cuando no está ya cancelada) abriendo `AccessibleModal` Nivel 2 (`border: 1px solid #CBB499`) que detalla: no borra la fila, bloquea nuevos inicios y reintentos pendientes, permite concluir intentos iniciados dentro de `cierre efectivo + 24 h`, conserva notas/audios y la excluye del cumplimiento.
- **Permanece intacto:**
  - `assignmentQuery` (`/api/v1/assignments/${id}`, `AssignmentViewSchema`), `cancelMutation` (`POST /api/v1/assignments/${id}/cancel`), restauración de foco en `cancelButtonRef` y manejo de `404`/`403`/`429`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

- Mismos tokens de disponibilidad de [05-page-asignaciones.md](./05-page-asignaciones.md) más:
  - **Botón destructivo `Cancelar asignación` / confirmar cancelación:** `#B9251D` (hover `#991D16`), texto `#FFFFFF` (**6,28:1 AA+**).
  - **Callout de consecuencias dentro del modal:** `#FDECE9`, borde `#EABCB5`, texto `#831712` (**8,75:1 AAA**).
  - **Banner éxito tras cancelar:** `#E6F5EA`, borde `#B7DFC2`, texto `#166534` (**6,32:1 AA+**).
  - **Foco:** `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`).

---

## 3. Tipografía y reglas de texto

- **`<h1>` título actividad:** `Bricolage Grotesque 700`, `1.625rem` (`26px`), **`lang="en"`**.
- **KPIs de ventana, cumplimiento y notas `0,0–5,0`:** `Plus Jakarta Sans 600–700`, `tabular-nums`, formato `America/Bogota`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Cabecera + botón cancelar** | Flex `space-between`; botón `Cancelar asignación` **`min-height: 44px`** (`48px` tablet). | `border-radius: 10px` | — |
| **Tarjetas de métricas (3–4 KPIs)** | `>= 1024px`: `3–4 columnas` (`gap: 16px`); Tablet (`820px`): `2 columnas`. | `padding: 18px 20px`, `border-radius: 12px` | — |
| **Tabla de entregas de alumnos** | `overflow-x: auto`; filas **`min-height: 48px`**, `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | — |
| **Modal de cancelación** | `max-width: 520px`, `padding: 24px`; botones **`min-height: 44px`** (`48px` tablet). | `border: 1px solid #CBB499`, `border-radius: 14px` | Foco atrapado; `Escape` deshabilitado mientras `cancelMutation.isPending`. |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F6EFE4` de cabecera y tabla.
- **Error / `404`:** banner `#FDECE9` con borde `#B9251D` y enlace `Volver a asignaciones`.
- **Asignación cancelada:** oculta el botón `Cancelar asignación` y muestra sello `#FDECE9` con fecha/hora `cancelledAt` en `America/Bogota`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [asignacion-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/asignaciones/[id]/asignacion-detail-client.tsx):**
   - Aplicar breadcrumb, tokens de disponibilidad (`#FFF0DE`, `#E6F5EA`, `#F6EFE4`, `#FDECE9`), tarjetas Nivel 1 y tabla editorial con `tabular-nums` y `lang="en"`.
   - Reemplazar estilos del modal de cancelación por `Nivel 2` (`#CBB499`), lista explícita de efectos irreversibles (Decisión 98) y botón `#B9251D`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`, Decisión 98), `accessibility` (foco modal y retorno a `cancelButtonRef`), `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Modal de cancelación explica que no borra la asignación, respeta `cierre efectivo + 24 h` y la excluye del denominador de cumplimiento.
- [ ] Al cancelar, el estado cambia en vivo a `Cancelada` (`#FDECE9`) y el botón desaparece sin borrar registros.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
