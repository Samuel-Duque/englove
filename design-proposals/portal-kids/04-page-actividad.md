# Plan de Implementación — Kids: Cuaderno de Campo / Actividad (`/actividad/[attemptId]`)

> **Alcance:** Rediseño de `/actividad/[attemptId]` en tema **Kids (`data-theme="kids"`)** como el **Cuaderno de Campo sin distracciones** para los 4 tipos evaluables (`fill_blank`, `open_question`, `speaking`, `exam`) y soporte de cierre para microjuegos ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.3). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/actividad/[attemptId]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/page.tsx), [actividad-runner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx), [CorrectionFeedback.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/CorrectionFeedback.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [03-page-juego-detalle.md](./03-page-juego-detalle.md) |
| **Orden de implementación** | **Página 4 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-05`, `SPEC-06`, `SPEC-07` (`Speaking` R2 `2–300s`), `SPEC-09` RF-19–RF-22, Decisiones 101, 118 (`PwaUpdateBanner`), 122 (`offline-queue`), `G-C02`, `G-C03`, `G-C04` |

---

## 1. Objetivo de la página y alcance

Convertir el runner actual (`actividad-runner.tsx`) en un **Cuaderno de Campo enfocado**: cabecera interna con retorno seguro, barra de estado honesta de sincronización, consigna guiada con botón «Escuchar» (`48×48px`), controles táctiles de alto contraste por tipo de actividad, grabadora `Speaking` clara con preescucha y tarjetas de entrega (online y offline) fieles a **Zorro Explorador**.

### Qué cambia vs. qué permanece intacto

- **Cambia (visual, claridad de feedback y ergonomía):**
  - Cabecera enfocada del cuaderno: enlace `← Volver a mi ruta` (`/inicio` o `/juegos` si es `game`, **`>= 48×48px`**), título (`lang="en"`), píldora `Nivel XX`, `Intento #N`, aviso de ventana `completeUntil` en `America/Bogota`, interruptor `Sonido` (solo en `game`) y botón «Escuchar» `#FFCA3A` (`48×48px`).
  - Indicador honesto de guardado: píldora explícita **`Guardado en este dispositivo`** (`#FFE6CC` / `#872E06`) vs. **`Sincronizado con el servidor`** (`#E6F5EA` / `#14532D`), sin fingir confirmación de red cuando está offline.
  - Grabadora `Speaking`: tarjeta cálida con botón grande **`Grabar audio` / `Detener grabación`** (`>= 56×56px` táctil), reloj `mm:ss` en `tabular-nums` (mínimo `2s`, tope dinámico de `speakingConfig?.maxDurationSeconds ?? 120` hasta `300s` — corregir texto fijo actual `máx 2:00 min`), **reproductor `<audio controls>` de preescucha local** desde `URL.createObjectURL(recordedAudioBlob)` (limpiado en `useEffect`) antes de enviar.
  - Botón cerrar alerta (`runnerAlert`) elevado a **`>= 48 × 48 px`** (hoy es `p-1`).
  - `CorrectionFeedback.tsx` sin clases grises descontrastadas (`text-zinc-800` → `--ink-1`), tarjetas de acierto `#E6F5EA` y desacierto `#FFE2DD` con ícono y texto claro.
- **Permanece intacto (seguridad, R2, cola offline y servidor):**
  - `RuntimeView` (`GET /api/v1/attempts/:id`), `x-attempt-token`, `enqueueEvent` / `enqueueUpload` / `triggerFlush`, `uploadAudioBlob` hacia URL prefirmada R2 + `POST /api/v1/media/:id/confirm`, `setActiveAttemptState(true/false)` para suprimir `PwaUpdateBanner` mientras `status === 'in_progress'`.
  - Cero cálculo de notas o exposición de `answer_key` en el cliente; en entrega offline (`isOfflineSaved`), **nunca** mostrar nota ni estrellas ficticias.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Contenedor de cuaderno** | `--surface-1` | `#FFFFFF` (`border: 2.5px solid #4A2511`, `4px 4px 0 #4A2511`) | Base de lectura |
| **Tarjeta de pregunta / ítem** | `--app-bg` / `--surface-featured` | `#FFF9EC` (`border: 2px solid #E8C79B`, `border-radius: 18px`) | `#2B150A` sobre `#FFF9EC`: **14,9:1 (AAA)** |
| **Inputs / Selects / Textarea** | `--border-control` | Fondo `#FFFFFF`, borde `2px solid #9A7B5C` (focus `#4A2511`), texto `#2B150A` | Borde **3,92:1 (AA UI)** · Texto **15,7:1 (AAA)** |
| **Botón «Escuchar» (`48×48px`)** | `--yellow` | `#FFCA3A` (`#B9251D` cuando `aria-pressed="true"`) | **11,7:1** / **5,9:1** |
| **Botón `Grabar audio` (`>= 56×56px`)** | `--red` / `--red-hover` | `#B9251D` / `#991D16` (texto `#FFFFFF`) | **5,9:1 (AA)** |
| **Botón `Detener grabación`** | `--ink-1` | `#2B150A` (texto `#FFF9EC`) | **14,9:1 (AAA)** |
| **Estado guardado local (`offline`)** | `--surface-soft-orange` | `#FFE6CC`, borde `#C6470B`, texto `#872E06` | **6,9:1 (AA+)** |
| **Estado guardado servidor / audio listo** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, borde `#166534`, texto `#14532D` | **8,3:1 (AAA)** |
| **CTA `Entregar actividad`** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,9:1 (AA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`outline: 3px solid #1D4ED8; offset: 3px`) | **> 5,8:1** |

---

## 3. Tipografía y reglas de texto

- **Título `<h1>`:** `Bricolage Grotesque 800`, `1.45rem–1.75rem` (`23–28px`), `lang="en"` si es título pedagógico en inglés.
- **Oraciones `fill_blank` / `exam` y consigna `speaking` / `open_question`:** `Nunito 700`, `1.0625rem–1.1875rem` (`17–19px`), `line-height: 1.55`, `lang="en"` en el texto en inglés.
- **Selects, inputs y `<textarea>`:** `font-size: 1rem` (`16px` mínimo), `Nunito 600`.
- **Reloj de grabación `00:18 / 02:00` y nota de cierre `4,8 / 5,0`:** `tabular-nums`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Contenedor principal** | `max-width: 820px`, centrado (`margin: 0 auto`) | `padding: 0` (hereda de `StudentShell`) | Mantiene lectura enfocada sin sidebar. |
| **Barra superior del cuaderno** | Botón `← Volver a mi ruta` **`min-height: 48px`**, `min-width: 48px`; píldoras de nivel e intento; botones `Sonido` y `Escuchar` **`>= 48 × 48 px`**. | `padding: 18px 20px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511` | En `390px`, controles de audio/retorno se acomodan en `flex-wrap` sin desbordar. |
| **Selector `fill_blank` / `exam`** | `width: 100%`, **`min-height: 48px`** (`52px` recomendado); grid `2 columnas` en `>= 640px`, `1` en móvil. | `padding: 10px 14px`, `border: 2px solid #9A7B5C`, `border-radius: 14px` | Etiqueta explícita `Espacio N` asociada con `htmlFor`. |
| **Área de texto `open_question`** | `width: 100%`, `min-height: 140px` (`rows={5}`), contador `X / maxLength` abajo. | `padding: 14px 16px`, `border: 2px solid #9A7B5C`, `border-radius: 16px` | Consigna con botón `Escuchar` `48×48px` a la derecha. |
| **Panel grabadora `Speaking`** | Botón principal **`Grabar audio`** **`min-height: 56px`**, **`min-width: 220px`** (`100%` en `390px`); reloj `1.35rem` `tabular-nums`; `<audio controls>` `width: 100%; max-width: 420px; min-height: 48px`. | `padding: 24px`, `border: 2px dashed #C78E54`, `border-radius: 20px`, fondo `#FFF9EC` | Muestra duración mínima `2 s` y tope real `maxDurationSeconds`. |
| **Pie de entrega (`Entregar actividad`)** | `width: 100%` móvil / `min-width: 240px` escritorio, **`min-height: 52px`**. | `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 0 4px 0 #4A2511` | Deshabilitado durante subida o si falta grabación en `speaking`. |
| **Tarjeta de entrega (`completion` / `isOfflineSaved`)** | `max-width: 640px`, centrado; ícono sello `80 × 80 px`; botones inferiores **`min-height: 52px`**. | `padding: 28px 24px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 5px 5px 0 #4A2511` | Si es `game`, solo 0–3 estrellas + motivación; si es actividad calificada, nota `0,0–5,0` + estrellas + `CorrectionFeedback` (sin exponer `answer_key`). |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Regla crítica |
| --- | --- | --- |
| **Cargando intento (`isLoading`)** | Esqueleto `#FFF2D6` de cabecera + tarjeta (`360px` alto), texto *«Preparando tu cuaderno de campo…»*. | Sin salto de layout (`CLS <= 0,10`). |
| **Error / intento no disponible (`!runtime`)** | `ErrorState` `variant="kids"` (`#FFE6E1`, borde `#B9251D`, botón `Volver al inicio` `52px`). | Sin detalles técnicos ni stack traces. |
| **Audio subiendo / fallo subida R2** | Indicador progreso claro + botón `Reintentar envío` (`>= 48×48px`) o cola offline automática si se cae la red. | Usa `uploadAudioBlob` + `/media/:id/confirm`. |
| **Aplazamiento PWA (`in_progress`)** | `setActiveAttemptState(true)` activo mientras `status === 'in_progress'`. | `PwaUpdateBanner` permanece oculto hasta entregar o salir. |
| **Entrega offline (`isOfflineSaved`)** | Tarjeta sello naranja suave `#FFE6CC` explicando que quedó guardada en la tablet/dispositivo y se enviará al volver la señal. | Prohibido mostrar nota o estrellas ficticias. |

---

## 6. Plan de implementación paso a paso

1. **Actualizar fallback de [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/page.tsx)** con contenedor cálido Kids.
2. **Refactorizar el render de [actividad-runner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx)** respetando el estado `theme` (`'kids'` vs `'teens'`):
   - Agregar botón de retorno seguro `← Volver a mi ruta` (`/juegos` si `activity.type === ActivityType.game`, `/inicio` en los demás) con `min-h-12`.
   - Añadir píldora de estado de guardado honesto (`pendingEventsRef` / `navigator.onLine`).
   - Elevar botón cerrar de `runnerAlert` a `min-h-12 min-w-12`.
   - En `Speaking`: calcular el límite dinámico real desde `speakingConfig?.maxDurationSeconds ?? 120` en la etiqueta (`máx MM:SS`), agregar `<audio controls>` de preescucha local y limpiar `URL.revokeObjectURL` al cambiar grabación o desmontar.
   - Reemplazar estilos `amber-50/50` / `amber-300` / `rose-600` por las clases de tokens Zorro Explorador (`#4A2511`, `#9A7B5C`, `#FFCA3A`, `#C6470B`, `#B9251D`, `#E6F5EA`).
   - Añadir `lang="en"` en prompts de `fill_blank`, `exam`, `open_question` y `speaking`.
3. **Actualizar [CorrectionFeedback.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/activities/CorrectionFeedback.tsx):** aplicar tokens Kids/Teens de texto (`--ink-1`) y badges `#E6F5EA` / `#FFE2DD` sin revelar respuestas correctas cuando el alumno falló (`answer_key` protegido).

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux` (grabación, TTS `ListenButton`, feedback honesto online/offline)
- `upward-english-guardrails` (`G-B10` R2 sin guardar audio definitivo en disco ni API, `G-C02`, `G-C03`, `G-C04`)
- `accessibility` (`<audio controls>`, `aria-live`, `lang="en"`, foco `#1D4ED8`, `48×48px`)
- `verification-before-completion` (`pnpm --filter web typecheck`, `pnpm --filter web lint`, `CorrectionFeedback.test.tsx`)

---

## 8. Criterios de aceptación (Checklist)

- [ ] Controles de cabecera,retorno, «Escuchar», `Sonido`, selects, inputs, grabadora (`>= 56px`), `<audio controls>` y `Entregar actividad` (`52px`) cumplen `>= 48 × 48 px CSS`.
- [ ] `Speaking` muestra duración máxima real (`maxDurationSeconds`) y permite preescuchar la grabación antes de entregar.
- [ ] Estado offline muestra confirmación local honesta sin nota ni estrellas inventadas.
- [ ] `PwaUpdateBanner` se aplaza estrictamente mientras el intento está `in_progress`.
- [ ] Cero exposición de `answer_key` y cero cálculos de nota en el cliente.
- [ ] Pasa `typecheck`, `lint`, `CorrectionFeedback.test.tsx`, `axe-core` y `check-guardrails.mjs`.
