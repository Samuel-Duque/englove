# Portal Kids (`data-theme="kids"`) — Orden Paulatino y Base Compartida

> **Alcance:** Arquitectura visual y hoja de ruta ordenada para implementar la identidad **Zorro Explorador** ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md)) en el portal del alumno `kids` **sin romper la convivencia con `[data-theme="teens"]`** ni alterar reglas de negocio. Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Tema objetivo** | `data-theme="kids"` (7–10 años obligatorio; 11+ opcional cuando la API entrega `canSwitchInterface`) |
| **Archivos base objetivo** | [globals.css](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/globals.css), [student-shell.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/student-shell.tsx), [student-nav.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/student-nav.tsx), [offline-status-banner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/offline-status-banner.tsx), [pwa-update-banner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/pwa-update-banner.tsx), [modal.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/ui/modal.tsx), [error-state.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/error-state.tsx), [confetti.ts](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/confetti.ts) |
| **Fuente de diseño** | [zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §1–§4 y §6 |
| **Specs / Guardrails** | `CONTEXT.md` §2.4, §3, §5.2–§5.4, §8, §16 · `SPEC-05`, `SPEC-06`, `SPEC-09` RF-19–RF-24 |

---

## 1. Orden paulatino recomendado de implementación (Page por Page)

Implementar exactamente en este orden para que la base visual, navegación y helpers estén listos antes de cada pantalla:

| Paso | Archivo del plan | Ruta / Alcance | Por qué en este orden |
| --- | --- | --- | --- |
| **Paso 0** | **Este documento (`00-orden-y-base-compartida.md`)** | Tokens `[data-theme="kids"]`, `StudentShell`, `StudentNav` (+ barra móvil `52px`), banners, `Modal`, `ErrorState`, `FoxExplorerIllustration`, `confetti.ts` | Define los tokens compartidos y envuelve todas las páginas `(student)` y `/inicio`. |
| **Paso 1** | [01-page-inicio.md](./01-page-inicio.md) | `/inicio` | Pantalla principal del alumno (`<= 2 clics` a actividades); define el lenguaje de tarjetas de parada, bitácora semanal y botón «Escuchar». |
| **Paso 2** | [02-page-juegos.md](./02-page-juegos.md) | `/juegos` | Catálogo del «Campamento de Microjuegos» abierto 24/7 con 0–3 estrellas de práctica y respeto a `flags.games`. |
| **Paso 3** | [03-page-juego-detalle.md](./03-page-juego-detalle.md) | `/juegos/[activityId]` + `GameRenderer` + 5 mecánicas | Estandariza los tableros híbridos (drag + 2 pasos + teclado), controles `48×48px`, sonido Web Audio y confeti. |
| **Paso 4** | [04-page-actividad.md](./04-page-actividad.md) | `/actividad/[attemptId]` | «Cuaderno de campo» para los 4 tipos asignables (`fill_blank`, `open_question`, `speaking`, `exam`), grabación R2 y aplazamiento PWA. |
| **Paso 5** | [05-page-progreso.md](./05-page-progreso.md) | `/progreso` | Racha semanal con escudo de perdón, álbum de sellos/insignias e historial `0,0–5,0`. |
| **Paso 6** | [06-page-feedback.md](./06-page-feedback.md) | `/feedback` | Postales docentes con nota `0,0–5,0`, hasta 3 stickers sellados, audio propio y botón de reintento. |
| **Paso 7** | [07-page-extra.md](./07-page-extra.md) | `/extra` | Mapa de recursos externos `https://` filtrados en servidor según `flags.extra_content`. |
| **Paso 8** | [08-page-perfil.md](./08-page-perfil.md) | `/perfil` | Credencial del explorador, OTP de cambio de correo y lector de `canSwitchInterface`. |

---

## 2. Sistema de tokens `[data-theme="kids"]` en `globals.css`

Según `CONTEXT.md` §8 y [zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §2, los componentes compartidos consumen variables CSS bajo `[data-theme="kids"]` (y heredan hacia portales/diálogos):

| Token CSS | Valor Hex (Kids) | Uso exacto | Contraste verificado |
| --- | --- | --- | --- |
| `--app-bg` | `#FFF9EC` | Lienzo pergamino con trama sutil de puntos (`24×24px`, `rgba(198, 71, 11, 0.08)`) | Base cálida |
| `--surface-1` | `#FFFFFF` | Tarjetas de parada, juegos, postales, formularios | Base de lectura |
| `--surface-2` | `#FFF2D6` | Botones secundarios, barras de metadatos, esqueletos | `#2B150A` sobre `#FFF2D6`: **> 13,5:1 (AAA)** |
| `--surface-featured` | `#FFF9E6` | Parada en curso destacada | `#2B150A` sobre `#FFF9E6`: **> 14:1 (AAA)** |
| `--surface-hero-start` / `--surface-hero-end` | `#FFF0C4` / `#FFE0A3` | Gradiente cálido de portada del diario | `#2B150A` sobre `#FFE0A3`: **12,4:1 (AAA)** |
| `--surface-games-start` / `--surface-games-end` | `#FFE2B3` / `#FFD494` | Banner del Campamento de Microjuegos | `#2B150A` sobre `#FFD494`: **11,3:1 (AAA)** |
| `--surface-soft-red` | `#FFE2DD` | Franja `Speaking`, aviso `retry_extend_until`, error | `#831712` sobre `#FFE2DD`: **6,7:1 (AA+)** |
| `--surface-soft-orange` | `#FFE6CC` | Franja `Completar espacios`, aviso offline | `#872E06` sobre `#FFE6CC`: **6,9:1 (AA+)** |
| `--surface-soft-yellow` | `#FFF0B3` | Franja `Pregunta abierta`, píldora nivel, tolerancia 24h | `#543200` sobre `#FFF0B3`: **9,4:1 (AAA)** |
| `--surface-soft-exam` | `#FFEAD5` | Franja `Examen` | `#6B2809` sobre `#FFEAD5`: **8,5:1 (AAA)** |
| `--ink-1` | `#2B150A` | Títulos, texto principal, trazos | Sobre `#FFF9EC`: **14,9:1 (AAA)** · `#FFFFFF`: **15,7:1 (AAA)** |
| `--ink-2` | `#61361F` | Subtítulos, fechas, metadatos | Sobre `#FFFFFF`: **9,2:1 (AAA)** · `#FFF9EC`: **8,7:1 (AAA)** |
| `--red` / `--red-hover` | `#B9251D` / `#991D16` | CTA prioritario (continuar/enviar), TTS activo | `#FFFFFF` sobre `#B9251D`: **5,9:1 (AA)** |
| `--orange` / `--orange-hover` | `#C6470B` / `#A53906` | Navegación activa, chip activo, CTA inicio | `#FFFFFF` sobre `#C6470B`: **4,9:1 (AA)** |
| `--yellow` / `--yellow-hover` | `#FFCA3A` / `#FFD55C` | Emblema, botón «Escuchar», estrellas, CTA reintento | `#2B150A` sobre `#FFCA3A`: **11,7:1 (AAA)** |
| `--border-strong` | `#4A2511` | Bordes de tarjetas (`2.5px`), botones (`2px`) y sombras offset | Sobre `#FFF9EC`: **11,5:1 (AAA)** |
| `--border-dashed` | `#C78E54` | Costuras de pasaporte (`2px dashed`) | Decorativo estructural |
| `--border-soft` | `#E8C79B` | Divisores internos | Estructural auxiliar |
| `--border-control` | `#9A7B5C` | Borde mínimo AA para inputs/selects | **3,92:1 (AA UI)** |
| `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA` / `#14532D` | Guardado real en servidor, logro completado | **8,3:1 (AAA)** |
| `--focus-ring` | `#1D4ED8` | Anillo de foco (`3px solid #1D4ED8; outline-offset: 3px`) | **> 5,8:1** sobre crema/amarillo/blanco |

---

## 3. Tipografía y sistema de elevación táctil Kids

- **Display y CTA (`--font-upward-display`, `Bricolage Grotesque`, `700`/`800`):** `letter-spacing: -0.02em`, `line-height: 1.15–1.22`.
- **Cuerpo y consignas (`--font-upward-body`, `Nunito`, `600`/`700`/`800`):** base `1rem` (`16px`), `line-height: 1.45–1.55`, medida cómoda `50–65 ch`.
- **Idioma pedagógico:** todo enunciado, título o frase en inglés lleva `lang="en"`.
- **Niveles de elevación táctil (cero sombras difusas SaaS):**
  - Nivel 0: `border: 1.5px solid #4A2511`, sin sombra (píldoras, escudo, celdas de semana).
  - Nivel 1: `border: 2px solid #4A2511`, `box-shadow: 2px 2px 0 #4A2511` (chips, botones «Escuchar», navegación activa).
  - Nivel 2: `border: 2.5px solid #4A2511`, `box-shadow: 4px 4px 0 #4A2511` (tarjetas de parada, juegos, postales; botones CTA con `0 4px 0 #4A2511` → `:active` `translateY(2px)` + `0 1px 0 #4A2511`).
  - Nivel 3: `border: 2.5px solid #4A2511`, `box-shadow: 5px 5px 0 #4A2511` (Hero Diario, Bitácora semanal, Banner de juegos).
- **Radios:** tarjetas `22px` (`--radius-card`), botones `14px` (`--radius-btn`), sellos internos `12–14px`, píldoras `999px`.

---

## 4. Componentes base compartidos y tamaños exactos

| Componente / Archivo | Dimensiones exactas (`1280×800` / `800×1280` / `390×844`) | Cambios requeridos sobre el código actual |
| --- | --- | --- |
| **`StudentShell`** (`student-shell.tsx`) | Contenedor raíz `min-height: 100dvh`; `<main>` `max-width: 1140px`, `padding: 24px 20px` (y **`padding-bottom: 84px`** en `<= 680px` para despejar barra inferior móvil). | Reemplazar `bg-amber-50/40` por `bg-[var(--app-bg)] text-[var(--ink-1)]` + trama de puntos `24×24px` (`pointer-events: none`). |
| **`StudentNav` — Cabecera sticky** (`student-nav.tsx`) | Altura `72px` (`h-[72px]`), fondo `rgba(255, 249, 236, 0.96)`, `border-bottom: 2px dashed #C78E54`. | Emblema `UpwardCompassEmblem` dentro de sello **`46 × 46 px`** (`#FFCA3A`, `border: 2px solid #4A2511`, `2px 2px 0 #4A2511`) + texto **`Upward English`** (sin subtítulo). En `<= 680px` oculta la fila central de links para usar la barra inferior, dejando `Perfil` (`>= 48×48px`) y `Salir` (`>= 48×48px`). |
| **`StudentNav` — Links escritorio/tablet (`>= 681px`)** | Cada enlace `min-height: 48px`, `min-width: 48px`, `padding: 0 14px`, `border-radius: 14px`. | Activo: fondo `#C6470B`, texto `#FFFFFF`, `border: 2px solid #4A2511`, `box-shadow: 2px 2px 0 #4A2511`, `aria-current="page"`. |
| **`StudentNav` — Barra inferior móvil (`<= 680px`)** | `position: fixed; bottom: 0; left: 0; right: 0; z-index: 45`; `grid-template-columns: repeat(auto-fit, minmax(64px, 1fr))`; cada ítem **`min-height: 52px`** (`padding: 6px 4px`), ícono `20px` + etiqueta corta. | **Nuevo elemento** requerido por [zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §3. Muestra hasta 5 destinos activos (`Inicio`, `Juegos` si flag, `Progreso`, `Feedback`, `Extra` si flag). |
| **Píldora nivel + Chip Perfil + Botón `Salir`** | Nivel: `min-height: 36px` (no interactivo, `#FFF0B3`, borde `1.5px solid #4A2511`). Perfil y `Salir`: **`min-height: 48px`**, **`min-width: 48px`**, `border-radius: 14px`. | `Salir` con borde `2px solid #4A2511`, sombra `2px 2px 0 #4A2511`, hover suave `#FFE2DD` / `#831712`. Mantiene lógica `hasPendingWork` + `triggerFlush` (10s) + `ConfirmDialog`. |
| **Botón «Escuchar» (`ListenButton` nuevo)** | **`48 × 48 px`** (`min-w-[48px] min-h-[48px]`), fondo `#FFCA3A` (`aria-pressed="true"` → `#B9251D` texto blanco), `border: 2px solid #4A2511`, `box-shadow: 2px 2px 0 #4A2511`, `border-radius: 14px`. | Extraer componente reutilizable que envuelve `speak()` de `apps/web/src/lib/speech.ts`; si no existe `speechSynthesis` o no hay voces, se oculta sin error. |
| **Mascota `FoxExplorerIllustration` (nuevo SVG)** | Hero desktop: `150 × 150 px`; Estados vacíos: `112 × 112 px`. | SVG propio con pañoleta `#FFCA3A` + pin rojo `#B9251D`. Oculto decorativamente en móvil hero (`<= 680px`) para priorizar primer CTA. |
| **`OfflineStatusBanner`** (`offline-status-banner.tsx`) | Ancho completo bajo cabecera, `min-height: 48px`, `padding: 10px 16px`, botón `Sincronizar ahora` **`>= 48 × 48 px`**. | Tema Kids: sin red/pendiente → `#FFE6CC` con borde `2px solid #4A2511` y texto `#2B150A`; recién sincronizado → `#E6F5EA` con texto `#14532D` y borde `#166534`. |
| **`PwaUpdateBanner`** (`pwa-update-banner.tsx`) | Barra fija inferior (`bottom: 0`, o `bottom: 64px` en móvil sobre barra inferior para evitar solapamiento), botones **`>= 48 × 48 px`**. | Superficie `#FFF9EC` o `#2B150A` con alto contraste, botón primario `#FFCA3A` texto `#2B150A` o `#C6470B` texto `#FFFFFF`. **Obligatorio:** suprimido mientras existe intento `in_progress` en `/actividad/[attemptId]`. |
| **`AccessibleModal` / `ConfirmDialog`** (`modal.tsx`) | `max-width: 480px`, `padding: 24px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 5px 5px 0 #4A2511`; botón cerrar `✕` y botones de acción **`>= 48 × 48 px`**. | **Corrección obligatoria:** actualmente el botón `✕`, `Cancelar` y `Confirmar` de `modal.tsx` son pequeños (`p-1.5` / `py-2`); subirlos todos a `min-h-12 min-w-12`. |
| **`ErrorState`** (`error-state.tsx`) | `max-width: 520px`, `padding: 28px`, `border: 2.5px solid #B9251D`, `border-radius: 22px`, fondo `#FFE6E1`, botones **`>= 48 × 48 px`**. | Sustituir la clase inexistente `font-comic` por `font-[var(--font-upward-display)]` y usar la paleta Kids oficial. |
| **`fireCelebrationConfetti`** (`confetti.ts`) | N/A (canvas-confetti). | En `theme === 'kids'`, reemplazar colores neón por paleta oficial: `['#C6470B', '#FFCA3A', '#B9251D', '#2B150A', '#166534']`, respetando `prefers-reduced-motion: reduce`. |

---

## 5. Reglas transversales no negociables (Checklist previo a cada página)

1. **Tacto ≥ 48 × 48 px CSS (`SPEC-09 RF-21`):** ningún control interactivo (links de nav, botones de filtro, «Escuchar», acciones de tarjeta, barra móvil, botones de modal) puede medir menos de `48 × 48 px` en `390×844`, `800×1280` o `1280×800`.
2. **Solo CSS/Tailwind para movimiento:** cero Framer Motion, cero Howler.js, cero `@dnd-kit`. Usar `@media (prefers-reduced-motion: reduce)` para anular traslaciones, pulsos y confeti.
3. **Respeto a `CONTEXT.md` §2.4 y §16:** cero rankings para alumnos, cero notas numéricas en microjuegos, cero `answer_key` o cálculo de notas en el cliente, `logoutSharedDevice()` limpiando IndexedDB al salir, cero `'use cache'` en datos autenticados.
4. **Higiene con `[data-theme="teens"]`:** no romper la estructura compartida de componentes usados por Teens; toda variación visual entre Kids y Teens debe pasar por tokens CSS (`[data-theme="kids"]` vs. `[data-theme="teens"]`) o props explícitas limpias.

---

## 6. Criterios de aceptación de la Base Compartida Kids

- [ ] Variables `--app-bg`..`--focus-ring` declaradas bajo `[data-theme="kids"]` en `globals.css` con contraste verificado.
- [ ] `StudentShell` renderiza pergamino `#FFF9EC` con trama `24×24px` y reserva espacio inferior móvil para la barra fija.
- [ ] `StudentNav` usa `UpwardCompassEmblem` (`46×46px`), cabecera limpia `Upward English` sin subtítulo y barra inferior móvil `>= 52px` en `<= 680px`.
- [ ] `AccessibleModal`, `ConfirmDialog`, `ErrorState`, `OfflineStatusBanner` y `PwaUpdateBanner` tienen todos sus controles `>= 48 × 48 px` y cero solapamiento con la barra inferior móvil.
- [ ] `confetti.ts` usa la paleta cálida oficial y respeta `prefers-reduced-motion`.
- [ ] Pasa `pnpm --filter web typecheck`, `pnpm --filter web lint` y `node .agents/skills/upward-english-guardrails/scripts/check-guardrails.mjs`.
