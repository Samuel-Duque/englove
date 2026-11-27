# Plan de Implementación — Profesora: Ficha Estadística del Estudiante (`/estadisticas/estudiantes/[id]`)

> **Alcance:** Rediseño de `/estadisticas/estudiantes/[id]` en **Estudio Editorial Cálido**, cubriendo el eje de **Rendimiento**, el eje de **Constancia** (calendario de **12 semanas ISO** `America/Bogota`, desglose Día/Semana/Mes y sección **«Entregas que no llegaron a tiempo» `offline_sync`**) y la sección **«Práctica en juegos»** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.6). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/estadisticas/estudiantes/[id]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/estadisticas/estudiantes/[id]/page.tsx), [estudiante-stats-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/estadisticas/estudiantes/[id]/estudiante-stats-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [15-page-estadisticas.md](./15-page-estadisticas.md) |
| **Orden de implementación** | **Página 16 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-08`, `SPEC-09` RF-17 (`offline_sync`), Decisiones 43, 137 (práctica en juegos recortada a `expected_duration_seconds × 3`), `G-C06`, `G-C08` |

---

## 1. Objetivo de la página y alcance

Ofrecer a la profesora una lectura diagnóstica completa de un estudiante específico: comparación contra el promedio del grupo, evolución `0,0–5,0` filtrable por tipo evaluable y nivel, **calendario de las últimas 12 semanas ISO**, envíos tardíos offline (`offline_sync`) y bitácora cronológica de práctica en juegos con los tokens editoriales cálidos.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Breadcrumb + cabecera + polling 30 s:** `Estadísticas / [Nombre del estudiante]`, enlace rápido **`Ver ficha de alumno →`** (`/alumnos/[id]`), indicador verde de polling cada 30 s + botón `Refrescar` y barra de filtros `#F6EFE4` (`Desde`, `Hasta`, `Tipo evaluable`, `Nivel`).
  - **Eje de Rendimiento:** tarjetas KPI Nivel 1 (`Promedio del alumno`, `Promedio del grupo`, `Tasa de aprobación`, `Actividades completadas`) en `tabular-nums` + gráfico/lista de evolución `0,0–5,0` sin incluir microjuegos.
  - **Eje de Constancia (12 semanas ISO):** rejilla visual de las 12 semanas con `WeekStatusBadge` homologados (`Activa` `#E6F5EA`/`#166534`, `Perdón aplicado` `#FFF1C2`/`#543200`, `En curso` `#FFF0DE`/`#872E06` — reemplazando el `bg-blue-100` actual — e `Inactiva` `#F6EFE4`/`#5E3E2C`); conmutador de tiempo `Por Día` / `Por Semana` / `Por Mes` (`tabular-nums`).
  - **Sección «Entregas que no llegaron a tiempo» (`offline_sync`, SPEC-09 RF-17):** bloque destacado en `#FFF6E3` o `#FDECE9` enumerando intentos iniciados antes del cierre cuya sincronización sin red llegó tras `completeUntil`.
  - **Sección «Práctica en juegos»:** bloque claramente separado en `#FFF6E3` con historial cronológico `America/Bogota` (fecha/hora, microjuego, mecánica, estrellas `0–3` y duración acotada a `expected_duration_seconds × 3`).
- **Permanece intacto:**
  - `studentStatsQuery` (`/api/v1/stats/students/${studentId}`) con `POLLING_INTERVAL_MS` (`30 s`), filtros `fromDate`, `toDate`, `selectedType`, `selectedLevel` y `timeBucketMode`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

- `WeekStatusBadge`:
  - `Activa`: `#E6F5EA` / `#166534` / borde `#B7DFC2` (**6,32:1 AA+**).
  - `Perdón aplicado`: `#FFF1C2` / `#543200` / borde `#E5C97B` (**10,15:1 AAA**).
  - `En curso`: `#FFF0DE` / `#872E06` / borde `#E7C099` (**7,74:1 AAA**).
  - `Inactiva`: `#F6EFE4` / `#5E3E2C` / borde `#E4D5C3` (**8,35:1 AAA**).
- Secciones `offline_sync` y `Práctica en juegos`: `#FFF6E3`, borde `#E4D5C3` (o `#EABCB5` / `#FDECE9` en `offline_sync` crítico).
- Controles filtro: `#FFFFFF`, borde `#9A7B5C` (**3,92:1 AA UI**); foco `#1D4ED8`.

---

## 3. Tipografía y reglas de texto

- **`<h1>` nombre estudiante:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Notas, duraciones, semanas ISO y fechas `America/Bogota`:** `Plus Jakarta Sans 600–700`, **`tabular-nums`**.
- **Títulos de actividades y juegos:** **`lang="en"`** si están en inglés.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas responsivas |
| --- | --- | --- | --- |
| **KPIs Rendimiento (4 tarjetas)** | `>= 1024px`: `4 columnas` (`gap: 16px`); `820px`: `2 columnas`. | `padding: 18px`, `border-radius: 12px` | — |
| **Calendario 12 semanas ISO** | `>= 1024px`: `6 columnas × 2 filas` (o `4×3`, `gap: 10px`); `820px`: `3×4` columnas. | Cada celda `min-height: 74px`, `padding: 10px 12px`, `border-radius: 10px` | — |
| **Conmutador `Día / Semana / Mes`** | Botones **`min-height: 40px`** (`48px` tablet), `padding: 8px 14px`. | `border-radius: 8px` | — |
| **Tablas (`offline_sync`, historial juegos)** | `overflow-x: auto`; filas `min-height: 48px`, `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F6EFE4` respetando altura de KPIs y calendario (`CLS <= 0,10`).
- **Sin entregas tardías (`offline_sync`) / sin partidas de juego:** mensaje sereno en `#FFFFFF` sin mostrar alarma innecesaria.
- **Error de carga o `404`:** banner `#FDECE9` con botón `Reintentar` y enlace a `/estadisticas`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [estudiante-stats-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/estadisticas/estudiantes/[id]/estudiante-stats-client.tsx):**
   - Homologar `WeekStatusBadge` (`En curso` en `#FFF0DE`, `Perdón aplicado` en `#FFF1C2`, `Activa` en `#E6F5EA`, `Inactiva` en `#F6EFE4`) y aplicar estilo editorial a filtros `#F6EFE4`, KPIs `#FFFFFF`, `offline_sync` y sección `Práctica en juegos` `#FFF6E3`.
   - Incorporar barra de polling `30 s` con botón `Refrescar`, enlace cruzado a `/alumnos/${studentId}` y `tabular-nums` en todas las cifras y tablas.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C06`, Decisión 137, `check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Calendario 12 semanas ISO (`America/Bogota`), eje rendimiento, `offline_sync` (RF-17) y `Práctica en juegos` claramente diferenciados.
- [ ] `WeekStatusBadge` sin colores azules heredados; `tabular-nums` en todas las notas, fechas y duraciones.
- [ ] Polling `30 s` + botón `Refrescar` (cero WebSockets).
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
