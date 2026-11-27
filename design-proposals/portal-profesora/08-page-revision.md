# Plan de Implementación — Profesora: Cola de Revisión y Feedback (`/revision`)

> **Alcance:** Rediseño de `/revision` (vista insignia de trabajo diario) como **espacio de evaluación en pantalla dividida (*split-view*)**, con reproductor `Speaking` + descarga R2 + aviso de retención 30 días, selector de 3 de 6 stickers, nota `0,0–5,0` inmutable tras calificar, conmutador de nuevo intento con `retry_extend_until` e indicador de polling cada 30 s ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §4.3–§4.6 y §5.4). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/revision` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/revision/page.tsx), [revision-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/revision/revision-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 8 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-07` (`Speaking` R2 + retención 30d + fallback `compatibilityWarning`), `SPEC-05`, `SPEC-08`, Decisiones 27, 39, 61, 84, 108, 109, `G-C02`, `G-C03` |

---

## 1. Objetivo de la página y alcance

Convertir `/revision` en una estación de evaluación fluida sin saltos de página: **42 % cola izquierda / 58 % inspector derecho** en escritorio, con todas las herramientas docentes visibles y accesibles sin fricción ni ambigüedad.

### Qué cambia vs. qué permanece intacto

- **Cambia (organización visual, split-view y componentes especializados):**
  - **Cabecera + Barra de polling 30 s:** título `<h1>Revisión y Retroalimentación</h1>`, pestañas con `role="tablist"` (`Pendientes (N)` y `Calificados (M)`), píldora verde `#166534` de polling (*«Actualizado HH:mm:ss · cada 30 s»* + botón **`Refrescar`**), y barra de filtros `#F6EFE4` (`Grupo`, `Tipo de actividad` — los 4 evaluables —, `Desde`, `Hasta`).
  - **Columna izquierda (Cola de entregas, `42 %`):** tarjetas compactas `#FFFFFF` (`border: 1px solid #E4D5C3`); seleccionada con `border: 1.5px solid #C6470B` y fondo `#FFF0DE`, mostrando alumno, grupo, segmento (`Kids`/`Teens`), tipo, título (`lang="en"`), fecha `America/Bogota` y badge (`Por revisar`, alerta `Atrasada` en `#FDECE9` si `> 3 días`, o nota `4,5 / 5,0`). En tablet (`768–1023px`), conmutador rápido `Lista de entregas` / `Inspector` para evitar scroll infinito apilado.
  - **Columna derecha (Inspector, `58 %`):**
    1. Encabezado `Intento #N`, título (`lang="en"`), alumno + grupo y tarjeta derecha con nota `0,0–5,0` + estrellas si ya está calificado.
    2. **Reproductor `Speaking` (§4.3):** superficie `#FFF6E3`, borde `#E4D5C3`, duración `tabular-nums`, `<audio controls>` accesible, botón **`Descargar audio`** (`handleDownloadAudio`), aviso obligatorio de **retención de 30 días** (`retention_until`), callout `#FFF1C2` si `audioWarning` (`compatibilityWarning`), y nota serena `#F6EFE4` cuando `mediaAsset.status === 'deleted'`.
    3. **Respuestas del estudiante y guía docente:** pregunta, respuesta registrada en `#FFFFFF`, bloque **Rúbrica / Criterio** (`#FFF6E3`) y bloque **Respuesta modelo / correcta** (`#E6F5EA`) diferenciados visualmente.
    4. **Calificación `0,0–5,0` e inmutabilidad (§4.5):** en `pending_review`, input `120px` `tabular-nums` + ayuda *«Umbral de aprobación: 3,0»*; en `graded` (Decisión 109), **sello bloqueado inmutable** en `#F6EFE4` con ícono de candado y nota explícita de que solo pueden editarse comentario y stickers.
    5. **Comentario (`0 / 2000`):** badge explícito **`Obligatorio`** en `speaking` / `open_question` y **`Opcional`** en `fill_blank` / `exam`.
    6. **Selector de 6 stickers oficiales (§4.4):** rejilla `3×2` (`2` cols en tablet) con `aria-pressed`, contador **`Seleccionados: X / 3`** y anuncio `aria-live="polite"` al intentar elegir un cuarto sin bloquear deselección.
    7. **Conmutador «Habilitar nuevo intento» + `retry_extend_until` (§4.6):** solo para actividades asignables; al activarse despliega `datetime-local` (`America/Bogota`) y alerta viva `#FFF1C2` si `due_at` ya venció y `retryExtendUntil` está vacío; si `retryGrantedAt !== null`, muestra píldora verde informativa.
    8. **Pie de confirmación:** nota de privacidad del correo (Decisión 39: no incluye nota ni texto del comentario) y CTA **`Guardar revisión y retroalimentación`** (`#C6470B`).
- **Permanece intacto:**
  - `pendingQuery` (`/api/v1/reviews/queue`), `gradedQuery` (`/api/v1/reviews/graded`) con `POLLING_INTERVAL_MS` (`30 s`), `detailQuery` (`/api/v1/attempts/:id/review-detail` + `/api/v1/media/:id/url`), `handleDownloadAudio` (`/api/v1/media/:id/download-url`), `reviewMutation` (`POST /api/v1/attempts/:id/review`) y reglas `SCORE_OUT_OF_RANGE`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Barra filtros / sello nota inmutable / audio borrado** | `--surface-subtle` | `#F6EFE4`, borde `#E4D5C3` | **15,14:1 (AAA)** |
| **Ítem de cola seleccionado / sticker activo** | `--accent-primary-soft` / `--accent-primary` | `#FFF0DE`, borde `1.5px solid #C6470B` | **7,74:1 (AAA)** |
| **Reproductor `Speaking` / Rúbrica** | `--surface-callout` | `#FFF6E3`, borde `#E4D5C3` | **16,09:1 (AAA)** |
| **Respuesta modelo / calificada / retry concedido** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, texto `#166534`, borde `#B7DFC2` | **6,32:1 (AA+)** |
| **Fallback `compatibilityWarning` / alerta `due_at` vencido** | `--accent-warm-soft` | `#FFF1C2`, texto `#543200`, borde `#E5C97B` | **10,15:1 (AAA)** |
| **Badge `Por revisar` / error envío** | `--accent-danger-soft` / `--accent-danger` | `#FDECE9`, texto `#831712`, borde `#EABCB5` | **8,75:1 (AAA)** |
| **Inputs (`scoreInput`, `commentInput`, fechas)** | `--border-control` | `#FFFFFF`, borde `1px solid #9A7B5C` | **3,92:1 (AA UI)** |
| **CTA `Guardar revisión y retroalimentación`** | `--accent-primary` / `-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,88:1 (AA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>`:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Nota `4,6 / 5,0`, duración `00:42 / 02:00`, contadores `X / 3` y `X / 2000`:** `Plus Jakarta Sans 600–700`, `tabular-nums`.
- **Consignas y respuestas de estudiante en inglés:** **`lang="en"`** explícito.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Split-view maestro-detalle** | `>= 1280px`: `grid-template-columns: 42% 58%` (`gap: 20px`). `1024–1279px`: `44% 56%`. Tablet (`768–1023px`): apilado o pestañas `Cola` / `Inspector` (`min-height: 48px`). | — | En desktop, columna izquierda con `max-height: calc(100dvh - 220px); overflow-y: auto`. |
| **Tarjeta de cola (izquierda)** | `min-height: 92px`, botón nativo o tarjeta interactiva `width: 100%`, `text-align: left`. | `padding: 14px 16px`, `border-radius: 10px` | No usar `<div onClick>`; usar `<button type="button">` limpio para accesibilidad por teclado. |
| **Reproductor `Speaking`** | `<audio controls>` `width: 100%; min-height: 44px`; botón `Descargar audio` **`min-height: 40px`** (`48px` tablet). | `padding: 16px`, `border-radius: 10px` | — |
| **Input nota `0,0–5,0`** | `width: 120px`, **`min-height: 44px`** (`48px` tablet), fuente `1.125rem` `700` `tabular-nums`. | `border-radius: 8px`, `border: 1px solid #9A7B5C` | Sello inmutable en `graded`: `min-height: 48px`. |
| **Selector 6 stickers** | `grid-template-columns: repeat(3, 1fr)` (`2` cols en tablet); cada botón **`min-height: 48px`**, `aria-pressed`. | `padding: 10px 12px`, `border-radius: 10px`, `gap: 10px` | Anuncio `aria-live="polite"` al alcanzar `3 / 3`. |
| **Botón `Guardar revisión y retroalimentación`** | **`min-height: 48px`**, `min-width: 240px` (`100%` en tablet estrecha). | `border-radius: 10px`, `padding: 12px 22px` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga inicial / cambio de detalle:** esqueletos `#F6EFE4` en ambas columnas (`CLS <= 0,10`).
- **Cola vacía:** tarjeta `#FFFFFF` en columna izquierda explicando que no hay entregas con los filtros actuales.
- **Audio expirado (`mediaAsset.status === 'deleted'`):** nota serena `#F6EFE4` explicando la eliminación automática a los 30 días sin romper la revisión.
- **Audio con fallback (`audioWarning`):** callout `#FFF1C2` recomendando usar `Descargar audio`.
- **Error al guardar o rango `0,0–5,0` inválido:** banner `role="alert"` en `#FDECE9`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [revision-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/revision/revision-client.tsx):**
   - Añadir barra de estado de polling `30 s` con última hora (`America/Bogota`) y botón manual `Refrescar` (invocando `pendingQuery.refetch()`, `gradedQuery.refetch()` y `detailQuery.refetch()`).
   - Estructurar el grid `42% / 58%` (con conmutador móvil/tablet `< 1024px`) y reemplazar tarjetas `div` clicables de la cola por `<button type="button">` accesibles.
   - Estilizar el reproductor `Speaking` (`#FFF6E3`, descarga, `retentionUntil`, fallback `audioWarning`, estado `deleted`), rúbrica vs. respuesta modelo, campo/sello inmutable `0,0–5,0`, contador de comentario con indicador `Obligatorio` / `Opcional`, grid `3×2` de 6 stickers (`aria-live` al límite 3), conmutador `allowRetry` con alerta viva si `due_at` venció y nota de privacidad del correo (Decisión 39).

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C02`, `G-C03` nota 0.0–5.0 y prohibido editar nota en autocalificados, `G-B10`), `accessibility` (`tablist`, `aria-pressed`, `aria-live`, botones en cola), `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Split-view `42% / 58%` en escritorio (`>= 1280px`), `44% / 56%` en portátil y conmutador accesible en tablet (`820px`).
- [ ] Reproductor `Speaking` muestra duración, descarga R2, aviso retención 30 d, fallback `compatibilityWarning` y estado `deleted`.
- [ ] En `graded`, la nota es estrictamente de solo lectura (candado `#F6EFE4`), manteniendo editables comentario y hasta 3 de 6 stickers.
- [ ] Polling explícito cada `30 s` + botón `Refrescar` (cero WebSockets).
- [ ] Pasa `typecheck`, `lint`, `axe-core` y `check-guardrails.mjs`.
