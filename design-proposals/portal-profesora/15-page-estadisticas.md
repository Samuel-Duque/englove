# Plan de Implementación — Profesora: Estadísticas y Rankings Privados (`/estadisticas`)

> **Alcance:** Rediseño integral de `/estadisticas` en **Estudio Editorial Cálido**, cubriendo sus 4 pestañas reales (`Vista General`, `Por Grupo` + gráfico SVG + bloque `Práctica en Juegos del Grupo`, `Leaderboard privado de notas` y `Ranking privado de juegos`), polling cada 30 s y cintillo obligatorio de confidencialidad ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.6). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/estadisticas` *(tabs `?tab=overview\|groups\|leaderboard\|games-leaderboard`)* |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/estadisticas/page.tsx), [estadisticas-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/estadisticas/estadisticas-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 15 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-08`, Decisiones 41 (sin flags `stats`/`leaderboard`), 112 (umbral `±0,2`), 115, 137 y 143 (ranking juegos privado separado de notas, exclusión `implausible_duration`), `G-C06` |

---

## 1. Objetivo de la página y alcance

Convertir las 1.100+ líneas de `estadisticas-client.tsx` en un tablero analítico cálido y altamente legible: cifras KPI alineadas con `tabular-nums`, alertas de inactividad (`>= 14 días`) en `#FDECE9`, gráfico SVG editorial de tendencia `0,0–5,0` (con línea umbral `3,0`), bloque diferenciado para **Práctica en juegos** (`#FFF6E3`, aclarando exclusión de notas) y **cintillo obligatorio de confidencialidad** en los rankings privados.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Cabecera + Barra de polling 30 s + Selector de periodo:** título `<h1>Estadísticas</h1>`, indicador verde `#166534` (*«Actualizado HH:mm:ss · cada 30 s»* + botón **`Refrescar`**), selector de periodo (`Últimos 7 días`, `Últimos 30 días`, `Últimos 90 días`, `Personalizado` con inputs `#9A7B5C`) y 4 pestañas `role="tablist"`: `Vista General`, `Por Grupo`, `Leaderboard privado (Notas)` y `Ranking privado (Juegos)`.
  - **Pestaña `Vista General`:** 6 KPIs compactos en `#FFFFFF` (`tabular-nums`), tarjetas de alerta de inactividad (`>= 14 días`) en `#FDECE9` con borde `#EABCB5` y enlace a `/estadisticas/estudiantes/[id]`, más tablas editoriales de desglose por **Nivel MCER (`A1–B2`)** y **Comparativa entre Grupos Activos**.
  - **Pestaña `Por Grupo`:** selector de grupo + conmutador `Cada 30 días (30d)` vs `Semanal (7d)`, **gráfico SVG limpio (`0,0–5,0`)** con trazo principal `#C6470B`, línea punteada de umbral `3,0` en `#9A7B5C` y nota *«Excluye microjuegos del promedio académico»*; tabla ordenable (`aria-sort`) con `TrendBadge` homologado (`↑` `#166534`/`#E6F5EA`, `↓` `#831712`/`#FDECE9`, `→` `#5E3E2C`/`#F6EFE4`); y bloque **`Práctica en Juegos del Grupo`** en `#FFF6E3` con nota *«Práctica autónoma · excluida de notas académicas»*.
  - **Pestañas `Leaderboard privado de notas` y `Ranking privado de juegos`:** **cintillo superior de confidencialidad obligatorio** en `#FFF6E3` (`border: 1px solid #CBB499`) con ícono de candado (*«Solo visible para la profesora · nunca para estudiantes. Los alumnos no ven puestos ni comparativas entre compañeros.»*), filtros MCER/Grupo y tablas con `tabular-nums` (en juegos: `Puntos de juego`, `Estrellas totales`, `Partidas`, `Juegos distintos`, `Tiempo` y `Última partida`, manteniendo la exclusión de servidor de `implausible_duration`).
- **Permanece intacto:**
  - Queries `['stats', 'overview', ...]`, `['stats', 'group', ...]`, `['stats', 'leaderboard', ...]`, `['stats', 'games-leaderboard', ...]` con `POLLING_INTERVAL_MS` (`30 s`), sincronización `?tab=...`, ordenamiento `groupSortBy`/`groupSortOrder`, `formatScore` (coma decimal), `formatDuration` y reglas de negocio de Decisiones 112, 137 y 143.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjetas KPI y tablas** | `--surface-card` / `--surface-subtle` | `#FFFFFF` (`thead` `#F6EFE4`), borde `#E4D5C3` | **15,14–17,29:1 (AAA)** |
| **Alertas inactividad (`>= 14 d`) y `TrendBadge` bajada** | `--accent-danger-soft` | `#FDECE9`, borde `#EABCB5`, texto `#831712` | **8,75:1 (AAA)** |
| **Bloque «Práctica en Juegos» y cintillo confidencialidad** | `--surface-callout` | `#FFF6E3`, borde `#CBB499`, texto `#2B150A` | **16,09:1 (AAA)** |
| **`TrendBadge` subida** | `--status-ok-bg` / `-ink` | `#E6F5EA`, texto `#166534` | **6,32:1 (AA+)** |
| **Línea principal gráfico SVG y tab activo** | `--accent-primary` | `#C6470B` (hover `#A53906`) | **4,88:1 (AA)** |
| **Línea referencia `3,0` en SVG** | `--border-control` | `#9A7B5C` (punteada `stroke-dasharray="4 4"`) + etiqueta `#5E3E2C` | **>= 3,92:1** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Cifras KPI:** `Plus Jakarta Sans 700`, `1.5rem–1.75rem` (`24–28px`), **`tabular-nums`**.
- **Notas `0,0–5,0`, tendencias (`+0,4`), puestos (`#1`), porcentajes y tiempos:** `tabular-nums` obligatorio.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas responsivas |
| --- | --- | --- | --- |
| **Fila 6 KPIs (`Vista General`)** | `>= 1280px`: `6 columnas` (o `3×2` holgadas) · `1024px`: `3 columnas` · `820px`: `2 columnas`, `gap: 14px`. | `padding: 16px 18px`, `border-radius: 12px` | `min-height: 98px` cada tarjeta KPI. |
| **Pestañas y selector periodo** | Cada tab `min-height: 44px` (`48px` tablet); botones periodo `min-height: 40px` (`48px` tablet). | `border-radius: 8–10px` | En `820px` los controles de periodo hacen `flex-wrap` sin desbordar. |
| **Gráfico SVG tendencia (`0,0–5,0`)** | Contenedor fluido `width: 100%; height: 240px`, `viewBox` escalable con `aria-label` descriptivo y resumen textual alternativo. | `padding: 20px`, `border: 1px solid #E4D5C3`, `border-radius: 12px` | Sin desbordamiento en `820×1080`. |
| **Tablas ordenables y Rankings** | `overflow-x: auto`; filas `min-height: 48px`; encabezados ordenables con `<button>` + `aria-sort`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F6EFE4` respetando altura de KPIs y tablas (`CLS <= 0,10`).
- **Sin datos en periodo / sin grupo seleccionado:** estado vacío sereno en `#FFFFFF`.
- **Error de red:** banner `role="alert"` en `#FDECE9` con botón `Reintentar`.
- **Polling 30 s:** indicador explícito con última hora `America/Bogota` + botón `Refrescar` (cero WebSockets).

---

## 6. Plan de implementación paso a paso

1. **Actualizar [estadisticas-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/estadisticas/estadisticas-client.tsx):**
   - Estandarizar `TrendBadge` y colores de KPIs/alertas a la paleta editorial (`#FFFFFF`, `#F6EFE4`, `#FFF6E3`, `#FDECE9`, `#E6F5EA`, `#C6470B`, `#9A7B5C`).
   - Incorporar barra de polling `30 s` con botón `Refrescar` e implementar `tabular-nums` en todas las cifras y celdas numéricas.
   - Asegurar que el gráfico SVG use `#C6470B` + línea umbral `#9A7B5C` (`3,0`), que el bloque **Práctica en Juegos del Grupo** use `#FFF6E3` con nota de exclusión académica, y que ambas pestañas de ranking muestren el **cintillo de confidencialidad obligatorio** arriba.
   - Verificar `aria-sort` en columnas ordenables y botones nativos dentro de `<th>`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C06` sin flags `stats`/`leaderboard` ni WebSockets, Decisiones 137 y 143, `check-guardrails.mjs`), `accessibility` (`tablist`, `aria-sort`, SVG accesible), `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Cintillo obligatorio de confidencialidad en ambas pestañas de ranking privado (notas y juegos).
- [ ] Bloque **Práctica en Juegos** en `#FFF6E3` etiquetado explícitamente como excluido de notas académicas.
- [ ] Gráfico SVG (`0,0–5,0`) con umbral `3,0`, `TrendBadge` con flecha + texto (no solo color) y `tabular-nums` en todas las métricas.
- [ ] Polling `30 s` explícito + botón `Refrescar`; cero WebSockets ni feature flags en `/estadisticas`.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
