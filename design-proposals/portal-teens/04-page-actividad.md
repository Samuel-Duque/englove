# Plan de Implementación — Teens: Entorno de Estudio / Actividad (`/actividad/[attemptId]`)

> **Alcance:** Rediseño de `/actividad/[attemptId]` en tema **Teens (`data-theme="teens"`)** como **Entorno de Estudio enfocado** para actividades B1/B2 (`fill_blank`, `open_question`, `speaking`, `exam`) y cierre de microjuegos ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.3). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/actividad/[attemptId]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/page.tsx), [actividad-runner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx), [CorrectionFeedback.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/CorrectionFeedback.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [03-page-juego-detalle.md](./03-page-juego-detalle.md) |
| **Orden de implementación** | **Página 4 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-06`, `SPEC-07` (`Speaking` R2 `2–300s`), `SPEC-09` RF-20–RF-22, Decisiones 118, 122, `G-C02`, `G-C03`, `G-C04` |

---

## 1. Objetivo de la página y alcance

Brindar al estudiante Teens un espacio de resolución **despejado, limpio y maduro** sobre papel blanco `#FFFFFF` y arena `#FAF6EE`, retirando botones TTS repetidos en cada consigna, manteniendo intacta la grabadora `Speaking` (con preescucha local y tope real `maxDurationSeconds`), el indicador honesto de guardado en servidor vs. dispositivo, y el aplazamiento estricto de `PwaUpdateBanner` durante intentos `in_progress`.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Cabecera del entorno: enlace `← Volver a inicio` (`>= 48×48px`), título `lang="en"`, píldora `Nivel XX · Intento #N`, fecha límite `completeUntil` en `America/Bogota`, interruptor `Sonido` (solo en `game`, `>= 48×48px`) y píldora honesta **`Respuesta guardada en el servidor`** (`#E6F5EA` / `#166534`) vs. **`Guardado en este dispositivo`** (`#FFF0DE` / `#872E06`).
  - **En `theme === 'teens'`:** retirar los botones TTS repetidos («Escuchar» en título y por cada pregunta), dejando una lectura limpia y directa en `Plus Jakarta Sans`; conservar grabación y preescucha `<audio controls>` en `Speaking`.
  - Selectores e inputs de `fill_blank` / `exam` con borde `1.5px solid #9A7B5C` (`min-height: 48px`, texto `16px`), `open_question` despejado con contador de caracteres en `tabular-nums`, y grabadora `Speaking` con botón `>= 56×56px` en `#B9251D` y límite real `maxDurationSeconds`.
  - Tarjetas de cierre (online y `isOfflineSaved`) con estética Teens (`#FFFFFF`, borde `#D8C2A8` / `#4A2511`) y `CorrectionFeedback.tsx` sin clases `zinc-800` fijas.
- **Permanece intacto:**
  - Toda la lógica de `RuntimeView`, `x-attempt-token`, `enqueueEvent` / `enqueueUpload`, `uploadAudioBlob` + `/media/:id/confirm`, `setActiveAttemptState` y protección de `answer_key`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Contenedor de estudio** | `--surface-1` | `#FFFFFF`, borde `1.5px solid #D8C2A8`, `border-radius: 16px` | Base de lectura |
| **Bloque de ítem / pregunta** | `--app-bg` | `#FAF6EE`, borde `1.5px solid #D8C2A8`, `border-radius: 14px` | `#2B150A` sobre `#FAF6EE`: **16,04:1 (AAA)** |
| **Selects / Inputs / Textarea** | `--border-control` | `#FFFFFF`, borde `1.5px solid #9A7B5C` (focus `#4A2511`), texto `#2B150A` | Borde **3,92:1 (AA UI)** |
| **Guardado en servidor** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, borde `#166534`, texto `#166534` | **6,32:1 (AA+)** |
| **Guardado en dispositivo (offline)** | `--tint-orange-bg` / `-ink` | `#FFF0DE`, borde `#C6470B`, texto `#872E06` | **7,74:1 (AAA)** |
| **Botón `Grabar audio` / `Entregar actividad`** | `--red` / `--orange` | `#B9251D` (grabar) · `#C6470B` (entregar) | **6,28:1** / **4,88:1** |
| **Botón `Detener grabación`** | `--hero-start` | `#2B150A` (texto `#FFF9EC`) | **16,48:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **Título `<h1>`:** `Bricolage Grotesque 700`, `1.4rem–1.75rem`, `lang="en"`.
- **Enunciados y respuestas:** `Plus Jakarta Sans 500–600`, `1rem` (`16px`), `line-height: 1.55`, `lang="en"` en ítems en inglés.
- **Reloj `Speaking`, contadores y nota:** `Plus Jakarta Sans 700` con `tabular-nums`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Contenedor central** | `max-width: 840px`, `margin: 0 auto` | `gap: 20px` | 1 columna enfocada. |
| **Cabecera interna** | Botón `← Volver a inicio` **`min-height: 48px`**; píldora estado guardado `min-height: 36px`; botón `Sonido` (solo `game`) **`>= 48 × 48 px`**. | `padding: 18px 20px`, `border: 1.5px solid #D8C2A8`, `border-radius: 16px` | En `390px` se apila limpiamente sin desbordar. |
| **Select / Input hueco** | `width: 100%`, **`min-height: 48px`**, `font-size: 16px`; rejilla `2 columnas` `sm+`, `1` en móvil. | `padding: 10px 14px`, `border: 1.5px solid #9A7B5C`, `border-radius: 12px` | `label htmlFor` visible arriba del control. |
| **Textarea `open_question`** | `width: 100%`, `min-height: 148px`, `font-size: 16px`. | `padding: 14px 16px`, `border: 1.5px solid #9A7B5C`, `border-radius: 14px` | Contador `X / maxLength` en `tabular-nums`. |
| **Grabadora `Speaking`** | Botón **`Grabar audio`** **`min-height: 56px`**, **`min-width: 210px`** (`100%` en `390px`); `<audio controls>` `width: 100%; max-width: 420px; min-height: 48px`. | `padding: 22px`, `border: 1.5px solid #D8C2A8`, `border-radius: 16px`, fondo `#FAF6EE` | Muestra `00:24 / MM:SS` real (`maxDurationSeconds`). |
| **Botón `Entregar actividad`** | **`min-height: 48px`** (`52px`), `min-width: 220px` (`100%` en móvil). | `border: 1.5px solid #4A2511`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F3EADA` (`360px`), *«Cargando actividad…»*.
- **Error / intento cerrado:** `ErrorState` `variant="teens"` (`#FDECE9`, `#B9251D`, botón `Volver a inicio` `>= 48px`).
- **Offline (`isOfflineSaved`):** *«Guardado en este dispositivo. Se enviará cuando vuelva la conexión.»* (sin nota ni estrellas simuladas).
- **Aplazamiento PWA:** `setActiveAttemptState(true)` activo mientras `status === 'in_progress'`.

---

## 6. Plan de implementación paso a paso

1. **Adaptar [actividad-runner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx)** cuando `theme === 'teens'`:
   - Condicionar los botones «Escuchar» de título e ítems a `hasTtsSupport && theme === 'kids'`.
   - Aplicar tokens Teens (`#FAF6EE`, `#FFFFFF`, `#F3EADA`, `#9A7B5C`, `#C6470B`, `#B9251D`, `#1D4ED8`) al runner, grabadora `Speaking` (con preescucha y `maxDurationSeconds` dinámico), alerta `runnerAlert` (`min-h-12 min-w-12` cerrar), entrega offline y pantalla de cierre.
2. **Actualizar [CorrectionFeedback.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/CorrectionFeedback.tsx)** para usar `var(--ink-1)`, `#E6F5EA` y `#FDECE9`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`G-B10`, `G-C02`, `G-C03`, `G-C04`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Entorno limpio en paleta Teens (`#FAF6EE` / `#FFFFFF`) sin botones TTS repetidos.
- [ ] Grabadora `Speaking` (`>= 56px`), `<audio controls>` preescucha, duración máxima dinámica y subida R2 intacta.
- [ ] Píldora honesta servidor vs. dispositivo y aplazamiento estricto de `PwaUpdateBanner` durante `in_progress`.
- [ ] Todos los controles `>= 48 × 48 px CSS`; `0` violaciones `axe-core`; `typecheck`, `lint`, `CorrectionFeedback.test.tsx` y `check-guardrails.mjs` en verde.
