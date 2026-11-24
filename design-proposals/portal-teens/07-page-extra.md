# Plan de Implementación — Teens: Contenido Extra (`/extra`)

> **Alcance:** Rediseño de `/extra` en tema **Teens (`data-theme="teens"`)** con tarjetas limpias de recursos externos `https://`, respeto estricto de `flags.extra_content`, filtrado en servidor y **cero botones TTS repetidos** ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.6). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/extra` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/extra/page.tsx), [extra-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/extra/extra-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 7 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-09` RF-21, Decisiones 124 y 125, `G-C05` (cero iframes), `G-C13` (`https:` + `noopener noreferrer`) |

---

## 1. Objetivo de la página y alcance

Migrar el tema Teens de `extra-client.tsx` de `zinc-900 / indigo-600` hacia tarjetas `#FFFFFF` sobre `#FAF6EE`, ocultando en Teens los botones «Escuchar» de las tarjetas de recurso (ya que actualmente el botón TTS se renderiza sin filtrar por `isKids` cuando `hasSpeechSupport` es verdadero) y manteniendo la seguridad de enlaces externos `https://`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - En `extra-client.tsx`, condicionar el botón TTS a `hasSpeechSupport && isKids` (en Teens la interfaz es limpia sin botones «Escuchar» repetidos).
  - Reemplazar estilos oscuros `zinc-800` / `indigo-*` por tarjetas `#FFFFFF` (`border: 1.5px solid #D8C2A8`, `border-radius: 16px`), badges `#F3EADA` / `#E6F5EA`, dominio destino visible y CTA **`Abrir recurso externo ↗`** en `#C6470B` (`min-height: 48px`) con nota clara de salida a pestaña nueva.
  - Estado flag apagado con `FoxTeensIllustration` discreto (`96×96px`) y enlace `Volver a inicio` (`>= 48px`).
- **Permanece intacto:**
  - Queries `['feature-flags']`, `['student', 'profile']`, `['resources']`, filtros `Todos / Tu nivel / Generales`, validación `isValidHttpsResourceUrl`, `rel="noopener noreferrer"`, detección offline `!isOnline` y **cero iframes**.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjeta recurso** | `--surface-1` / `--border-rest` | `#FFFFFF`, borde `1.5px solid #D8C2A8` | `#2B150A` sobre `#FFFFFF`: **17,29:1 (AAA)** |
| **Badge `Todos los niveles` (General)** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, texto `#166534` | **6,32:1 (AA+)** |
| **Badge `Nivel B1` / Chip filtro inactivo** | `--surface-2` | `#F3EADA`, texto `#5E3E2C` / `#2B150A` | **7,99–14,49:1 (AAA)** |
| **Filtro activo y CTA `Abrir recurso externo ↗`** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`, borde `1.5px solid #4A2511`) | **4,88:1 (AA)** |
| **Aviso sin conexión (`!isOnline`)** | `--tint-orange-bg` / `-ink` | `#FFF0DE`, borde `#C6470B`, texto `#872E06` | **7,74:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Contenido Extra:** `Bricolage Grotesque 800`, `1.55rem–1.95rem`.
- **Título recurso (`<h2>`):** `Bricolage Grotesque 700`, `1.125rem`.
- **Descripción y dominio (`https://…`):** `Plus Jakarta Sans 500–600`, `0.9rem–0.95rem`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Barra de filtros** | `flex-wrap: wrap; gap: 8px`; cada botón **`min-height: 48px`**, `min-width: 96px`. | `padding: 10px 16px`, `border-radius: 999px` | — |
| **Rejilla de recursos** | Escritorio (`>= 961px`) y Tablet (`681–960px`): **`2 columnas`** (`gap: 18px`). Móvil (`<= 680px`): **`1 columna`**, `gap: 14px`. | — | Dominios con `break-all` seguro en `390px`. |
| **Tarjeta de recurso** | `min-height: 220px`, `display: flex; flex-direction: column; justify-content: space-between`. | `padding: 20px`, `border-radius: 16px`, `border: 1.5px solid #D8C2A8` | **Sin botón TTS en Teens.** |
| **Botón `Abrir recurso externo ↗`** | `width: 100%`, **`min-height: 48px`**, `inline-flex items-center justify-center`. | `border: 1.5px solid #4A2511`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` | Solo `<a href>` si `isValidHttpsResourceUrl(item.url)`. |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F3EADA` (`220px`), *«Cargando recursos extra…»*.
- **Flag apagado (`!isExtraContentEnabled` o `403`):** tarjeta `#FFFFFF` con `FoxTeensIllustration`, texto directo y CTA `Volver a inicio` (`>= 48px`).
- **Sin red (`!isOnline`):** banner `#FFF0DE` informando que se requiere internet para abrir enlaces externos.

---

## 6. Plan de implementación paso a paso

1. **Actualizar la rama Teens de [extra-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/extra/extra-client.tsx):**
   - Condicionar el botón «Escuchar» a `hasSpeechSupport && isKids`.
   - Reemplazar todas las clases `bg-zinc-*` / `bg-indigo-*` en Teens por tokens `#FAF6EE`, `#FFFFFF`, `#F3EADA`, `#C6470B`, `#166534`.
   - Verificar `min-h-12` en filtros, CTA externo y botón de retorno cuando el flag está desactivado.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`G-C05`, `G-C13`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Sin clases oscuras heredadas (`zinc-900/800`, `indigo-*`) ni botones TTS en Teens.
- [ ] Validación `isValidHttpsResourceUrl`, `rel="noopener noreferrer"`, filtrado por servidor y cero `<iframe>`.
- [ ] Todos los botones y enlaces CTA miden **`>= 48 × 48 px CSS`**.
- [ ] `0` violaciones `axe-core`, `0` desborde horizontal en los 3 viewports, `typecheck` y `lint` en verde.
