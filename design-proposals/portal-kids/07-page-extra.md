# Plan de Implementación — Kids: Mapa de Recursos (`/extra`)

> **Alcance:** Rediseño de `/extra` en tema **Kids (`data-theme="kids"`)** como **Mapa de Recursos Externos**, respetando `flags.extra_content`, filtrado exclusivo en servidor, validación `https:` estricta y **cero iframes** ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.6). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/extra` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/extra/page.tsx), [extra-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/extra/extra-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 7 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-09` RF-21–RF-22, Decisiones 124, 125, `G-C05` (cero iframes), `G-C13` (`https:` + `noopener noreferrer`) |

---

## 1. Objetivo de la página y alcance

Dar al listado de enlaces externos de `/extra` la identidad visual **Zorro Explorador** (cabecera de mapa cálida, filtros de nivel `>= 48px`, tarjetas con dominio visible, botón «Escuchar» `48×48px` y enlace seguro **`Abrir recurso externo ↗`**), conservando intactas todas las protecciones de red, seguridad de URLs y visibilidad por feature flag.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Estado de flag apagado (`!isExtraContentEnabled || isForbiddenError`): usar `FoxExplorerIllustration` (`112×112px`), borde punteado `#C78E54` y CTA `#C6470B` `Volver al inicio` (`52px`).
  - Cabecera de la página con sello de mapa, píldora de nivel `Nivel A1` (`#FFF0B3`) y filtros (`Todos`, `Tu nivel`, `Para todos`) en chips `min-height: 48px` con borde `#4A2511`.
  - Tarjetas de recurso externo con franja superior punteada (`2px dashed #C78E54`), badge de nivel (`Para todos` en `#E6F5EA` / `#14532D` o `Nivel XX` en `#FFF0B3` / `#543200`), botón «Escuchar» `#FFCA3A` (`48×48px`), dominio destino legible (`getHostname(item.url)`), nota explícita *«Se abre en una nueva pestaña fuera de Upward English»* y CTA `Abrir recurso externo ↗` (`min-height: 52px`).
- **Permanece intacto:**
  - Queries `['feature-flags']`, `['student', 'profile']`, `['resources']` (`GET /api/v1/resources` que ya filtra en servidor por `level = null OR level = student.level`).
  - Validación `isValidHttpsResourceUrl(item.url)`, `target="_blank" rel="noopener noreferrer"`, detección online/offline (`!isOnline`) y limpieza de `speechSynthesis` al desmontar.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjeta de recurso** | `--surface-1` | `#FFFFFF` (`border: 2.5px solid #4A2511`, `4px 4px 0 #4A2511`) | Base de lectura |
| **Badge `Para todos` (General)** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, texto `#14532D`, borde `#4A2511` | **8,3:1 (AAA)** |
| **Badge `Nivel XX`** | `--surface-soft-yellow` | `#FFF0B3`, texto `#543200`, borde `#4A2511` | **9,4:1 (AAA)** |
| **Chip filtro activo / inactivo** | `--orange` / `--surface-1` | Activo `#C6470B` (texto `#FFFFFF`) · Inactivo `#FFFFFF` (texto `#2B150A`) | **4,9:1** / **15,7:1** |
| **Aviso sin conexión (`!isOnline`)** | `--surface-soft-orange` | `#FFE6CC`, borde `2px solid #4A2511`, texto `#872E06` | **6,9:1 (AA+)** |
| **Botón «Escuchar»** | `--yellow` | `#FFCA3A` (`aria-pressed="true"` → `#B9251D`) | **11,7:1 (AAA)** |
| **CTA `Abrir recurso externo ↗`** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`, borde `2px solid #4A2511`) | **4,9:1 (AA)** |
| **Píldora de dominio (`https://…`)** | `--surface-2` | `#FFF2D6`, texto `#61361F`, borde `#E8C79B` | **> 9,0:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 3px`) | **> 5,8:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Mapa de Recursos:** `Bricolage Grotesque 800`, `1.65rem–2rem`.
- **Título de tarjeta (`<h2>`):** `Bricolage Grotesque 700`, `1.1875rem` (`19px`).
- **Descripción y dominio:** `Nunito 600`, `0.95rem` (`15.2px`).
- **Aviso explícito externo:** incluir texto accesible o subtítulo claro indicando que el enlace sale de Upward English en una pestaña nueva.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Toolbar de filtros** | `display: flex; flex-wrap: wrap; gap: 10px`; cada chip **`min-height: 48px`**, `min-width: 96px`. | `padding: 10px 18px`, `border: 2px solid #4A2511`, `border-radius: 999px` | — |
| **Rejilla de recursos** | Escritorio (`>= 961px`): `2–3 columnas` (`repeat(2, minmax(0, 1fr))` o `3` según largo, `gap: 20px`). Tablet (`681–960px`): `2 columnas`. Móvil (`<= 680px`): `1 columna`. | — | Sin desbordamiento horizontal con dominios largos (`break-all` o `truncate` seguro). |
| **Tarjeta de recurso** | `min-height: 240px`, `display: flex; flex-direction: column; justify-content: space-between`. | `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511` | Cabecera punteada `2px dashed #C78E54`. |
| **Botón «Escuchar»** | **`48 × 48 px`**, `shrink-0`. | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 2px 2px 0 #4A2511` | Se oculta limpiamente si `!hasSpeechSupport`. |
| **Enlace `Abrir recurso externo ↗`** | `width: 100%`, **`min-height: 52px`**, `inline-flex items-center justify-center gap-2`. | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 0 4px 0 #4A2511` | Solo se habilita como `<a href>` cuando `isValidHttpsResourceUrl(item.url)` es verdadero. |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Copy |
| --- | --- | --- |
| **Carga (`isLoading`)** | Esqueletos `#FFF2D6` (`240px` alto × 3 tarjetas). | *«Cargando tu mapa de recursos…»* |
| **Flag desactivado / 403** | Tarjeta ilustrada con `FoxExplorerIllustration` + enlace `Volver al inicio` (`52px`). | *«Tu profesora aún está preparando este mapa. Vuelve pronto para explorar nuevos recursos.»* |
| **Lista vacía / filtro vacío** | Tarjeta punteada `#FFF9EC` con mensaje amigable. | *«Aún no hay enlaces en este filtro.»* |
| **URL inválida (fallback defensivo)** | Si `!isValidHttpsResourceUrl`, botón deshabilitado informativo; nunca renderiza `javascript:` ni `http:`. | *«Enlace no disponible»* |
| **Sin conexión (`!isOnline`)** | Banner superior `#FFE6CC` con ícono y aviso breve. | *«Necesitas conexión a internet para abrir enlaces externos.»* |

---

## 6. Plan de implementación paso a paso

1. **Verificar [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/extra/page.tsx)** y fallback de `<Suspense>`.
2. **Actualizar la rama Kids de [extra-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/extra/extra-client.tsx):**
   - Aplicar tarjeta `#FFFFFF` + borde `#4A2511` + sombra `4px 4px 0 #4A2511` + franja punteada `2px dashed #C78E54`.
   - Usar `ListenButton` (`#FFCA3A`, `aria-pressed`) de `48×48px` manteniendo `es-CO` / `speechSegments`.
   - Dar al enlace externo `Abrir recurso externo ↗` altura `min-h-[52px]` y nota visible de salida a nueva pestaña.
   - Mantener estrictamente `isValidHttpsResourceUrl`, `rel="noopener noreferrer"` y **cero iframes**.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`G-C05` sin iframes, `G-C13` solo `https:`), `accessibility` (`>= 48×48px`, `aria-pressed`), `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Respeta `flags.extra_content` y nunca muestra niveles distintos al del alumno ni recursos en `<iframe>`.
- [ ] Todos los enlaces externos validan `isValidHttpsResourceUrl` y abren con `target="_blank" rel="noopener noreferrer"`.
- [ ] Filtros, botón «Escuchar» y enlace CTA cumplen **`>= 48 × 48 px CSS`**.
- [ ] `0` desborde horizontal en `390×844` / `800×1280` / `1280×800`, `0` violaciones `axe-core`, `typecheck`/`lint`/`check-guardrails.mjs` en verde.
