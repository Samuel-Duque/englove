# Portal Teens (`data-theme="teens"`) — Orden Paulatino y Base Compartida

> **Alcance:** Arquitectura visual y hoja de ruta ordenada para implementar el diseño **Upward English Teens** ([teens-portal-diseno.md](../teens-portal-diseno.md)) sobre `[data-theme="teens"]`, reemplazando el tema oscuro genérico heredado (`bg-zinc-950` + `indigo-600`) por el sistema de tokens compartido cálido, directo y maduro (11–14+ años). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Tema objetivo** | `data-theme="teens"` (11–14+ años; intercambiable con Kids solo cuando `canSwitchInterface === true`) |
| **Archivos base objetivo** | [globals.css](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/globals.css), [student-shell.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/student-shell.tsx), [student-nav.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/student-nav.tsx), [offline-status-banner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/offline-status-banner.tsx), [pwa-update-banner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/pwa-update-banner.tsx), [modal.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/ui/modal.tsx), [error-state.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/error-state.tsx), [confetti.ts](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/lib/confetti.ts) |
| **Fuente de diseño** | [teens-portal-diseno.md](../teens-portal-diseno.md) §1–§4 y §6 |
| **Specs / Guardrails** | `CONTEXT.md` §2.4, §3, §5.2–§5.4, §8, §16 · `SPEC-05`, `SPEC-06`, `SPEC-09` RF-19–RF-24 |

---

## 1. Orden paulatino recomendado de implementación (Page por Page)

| Paso | Archivo del plan | Ruta / Alcance | Por qué en este orden |
| --- | --- | --- | --- |
| **Paso 0** | **Este documento (`00-orden-y-base-compartida.md`)** | Tokens `[data-theme="teens"]`, `StudentShell` (migrar `bg-zinc-950` → `#FAF6EE`), `StudentNav` (`42×42px` + etiqueta `Teens` + barra móvil `52px`), banners, `Modal`, `ErrorState`, `FoxTeensIllustration`, `confetti.ts` | Desacopla la estructura compartida de Kids y retira los colores oscuros heredados (`zinc-950`, `indigo-600`). |
| **Paso 1** | [01-page-inicio.md](./01-page-inicio.md) | `/inicio` | Instala el hero oscuro cálido (`#2B150A → #3E2011`) con foco `#FFCA3A`, Bitácora semanal y tarjetas Teens sin TTS repetido. |
| **Paso 2** | [02-page-juegos.md](./02-page-juegos.md) | `/juegos` | Zona de Microjuegos Teens 24/7 con íconos geométricos sobrios y estrellas sin notas ni rankings. |
| **Paso 3** | [03-page-juego-detalle.md](./03-page-juego-detalle.md) | `/juegos/[activityId]` + `GameRenderer` + 5 mecánicas | Adapta los tableros híbridos a superficie limpia `#FFFFFF`, bordes `#D8C2A8`/`#4A2511` y `Plus Jakarta Sans`. |
| **Paso 4** | [04-page-actividad.md](./04-page-actividad.md) | `/actividad/[attemptId]` | Modo enfocado limpio para B1/B2, grabadora `Speaking`, selectores `>= 48px` y aplazamiento PWA. |
| **Paso 5** | [05-page-progreso.md](./05-page-progreso.md) | `/progreso` | Racha semanal perdonable, colección de insignias modernas e historial `tabular-nums`. |
| **Paso 6** | [06-page-feedback.md](./06-page-feedback.md) | `/feedback` | Tarjetas sobrias con stickers como **badges horizontales planos** (cero inclinación infantil). |
| **Paso 7** | [07-page-extra.md](./07-page-extra.md) | `/extra` | Recursos `https://` filtrados en servidor sin botones TTS repetidos. |
| **Paso 8** | [08-page-perfil.md](./08-page-perfil.md) | `/perfil` | Credencial Teens + conmutador Kids/Teens actualizado (sin texto obsoleto de «tema oscuro»). |

---

## 2. Sistema de tokens `[data-theme="teens"]` en `globals.css`

Según `CONTEXT.md` §8, Teens usa el **mismo sistema de tokens** que Kids con su propio juego de valores bajo `[data-theme="teens"]`:

| Token CSS | Valor Hex (Teens) | Uso principal | Contraste verificado |
| --- | --- | --- | --- |
| `--app-bg` | `#FAF6EE` | Lienzo Papel Arena Claro (limpio, **sin trama de puntos ni costuras punteadas**) | Base cálida |
| `--surface-1` | `#FFFFFF` | Tarjetas principales, juegos, progreso, feedback, perfil | Base de lectura |
| `--surface-2` | `#F3EADA` | Chips secundarios, barras de metadatos, pestañas inactivas, esqueletos | `#2B150A` sobre `#F3EADA`: **14,49:1 (AAA)** |
| `--hero-start` / `--hero-end` | `#2B150A` / `#3E2011` | Hero oscuro cálido de `/inicio` y banner `PwaUpdateBanner` | `#FFF9EC` sobre `#3E2011`: **14,10:1 (AAA)** |
| `--hero-ink` / `--hero-muted` | `#FFF9EC` / `#F3EADA` | Títulos y subtítulos dentro de hero oscuro | `#F3EADA` sobre `#3E2011`: **12,39:1 (AAA)** |
| `--hero-accent-graphic` | `#E85D04` | Separadores gráficos y acentos grandes sobre hero *(no usar en texto chico)* | Sobre `#3E2011`: **4,23:1 (AA gráfico)** |
| `--ink-1` | `#2B150A` | Títulos, texto principal, notas `0,0–5,0`, rachas y estrellas | Sobre `#FFFFFF`: **17,29:1 (AAA)** · `#FAF6EE`: **16,04:1 (AAA)** |
| `--ink-2` | `#5E3E2C` | Subtítulos, fechas límite, descripciones | Sobre `#FFFFFF`: **9,54:1 (AAA)** · `#F3EADA`: **7,99:1 (AAA)** |
| `--orange` / `--orange-hover` | `#C6470B` / `#A53906` | Navegación activa, CTA de inicio de actividad/juego | `#FFFFFF` sobre `#C6470B`: **4,88:1 (AA)** · `#A53906`: **6,59:1 (AA+)** |
| `--red` / `--red-hover` | `#B9251D` / `#991D16` | CTA prioritario (continuar/entregar), error | `#FFFFFF` sobre `#B9251D`: **6,28:1 (AA+)** |
| `--yellow` / `--yellow-soft` | `#FFCA3A` / `#FFF1C2` | Emblema, CTA reintento/práctica, acento en hero (`--ink` `#543200`) | `#2B150A` sobre `#FFCA3A`: **11,33:1 (AAA)** · `#543200` sobre `#FFF1C2`: **10,15:1 (AAA)** |
| `--status-ok-ink` / `--status-ok-bg` | `#166534` / `#E6F5EA` | Confirmación real en servidor, actividad calificada, escudo activo | **6,32:1 (AA+)** |
| `--tint-orange-bg` / `-ink` | `#FFF0DE` / `#872E06` | Etiquetas de tipo, selección activa, aviso offline | **7,74:1 (AAA)** |
| `--tint-red-bg` / `-ink` | `#FDECE9` / `#831712` | Aviso `retry_extend_until`, errores recuperables | **8,75:1 (AAA)** |
| `--border-rest` | `#D8C2A8` | Borde limpio `1.5px` de tarjetas en reposo | Estructural |
| `--border-control` | `#9A7B5C` | Borde de `<input>`, `<select>`, `<textarea>` (WCAG 1.4.11) | Sobre `#FFFFFF`: **3,92:1 (AA UI)** |
| `--border-active` | `#4A2511` | Controles activos, emblema `1.5px` y sombra táctil `0 2px 0 #4A2511` | Sobre `#FAF6EE`: **12,46:1 (AAA)** |
| `--focus-ring` | `#1D4ED8` | Anillo de foco en superficies claras (`3px solid #1D4ED8; offset: 2px`) | Sobre `#F3EADA`: **5,61:1** · `#FFFFFF`: **6,70:1** |
| `--focus-ring-dark` | `#FFCA3A` | **Obligatorio** sobre hero `#2B150A→#3E2011` y banner oscuro (`3px solid #FFCA3A; offset: 2px`) | Sobre `#3E2011`: **9,69:1 (AAA)** |

---

## 3. Tipografía, bordes y microinteracción Teens

- **Display / Títulos (`--font-upward-display`, `Bricolage Grotesque`, `700`/`800`):** `letter-spacing: -0.02em`, `line-height: 1.15–1.22`.
- **Cuerpo / UI (`--font-upward-ui`, `Plus Jakarta Sans`, `500`/`600`/`700`):** base `0.95–1rem` (`15–16px`), `line-height: 1.45–1.55`. **Importante:** usar `Plus Jakarta Sans` (no `Nunito`) en Teens para eliminar rasgos redondeados infantiles, y `tabular-nums` en notas, rachas, partidas y relojes.
- **Superficies y profundidad compacta:**
  - Tarjeta en reposo: `background: #FFFFFF`, `border: 1.5px solid #D8C2A8`, `border-radius: 16px`, `box-shadow: 0 2px 8px rgba(43, 21, 10, 0.05)`.
  - Tarjeta destacada (`in_progress`): `border: 1.5px solid #4A2511` + banda sólida de `3px` (`#B9251D` o `#C6470B`, **cero costuras punteadas**).
  - Botones CTA: `border: 1.5px solid #4A2511`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` (`:active` → `translateY(1px)` + `0 1px 0 #4A2511`; `120–140ms ease-out`, anulado bajo `prefers-reduced-motion`).
- **Regla TTS en Teens:** **NO** renderizar botones repetidos «Escuchar» en tarjetas generales; mantener intacta la grabación y reproducción en `Speaking` y audio propio en `/feedback`.

---

## 4. Componentes base compartidos y tamaños exactos

| Componente / Archivo | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Cambios requeridos sobre el código actual |
| --- | --- | --- |
| **`StudentShell`** (`student-shell.tsx`) | Contenedor raíz `min-height: 100dvh`; `<main>` `max-width: 1160px`, `padding: 24px 20px` (**`padding-bottom: 84px`** en `<= 680px`). | **Migración clave:** reemplazar `bg-zinc-950 text-zinc-100` en Teens por `bg-[var(--app-bg)] text-[var(--ink-1)] font-[var(--font-upward-ui)]` (lienzos claros `#FAF6EE`, sin trama de puntos). |
| **`StudentNav` — Cabecera sticky** (`student-nav.tsx`) | Altura `72px`, fondo `rgba(250, 246, 238, 0.96)`, `border-bottom: 1.5px solid #D8C2A8`. | Emblema `UpwardCompassEmblem` en sello **`42 × 42 px`** (`#FFCA3A`, `border: 1.5px solid #4A2511`, `2px 2px 0 #4A2511`) dentro de enlace `>= 48×48px` + texto **`Upward English`** + píldora discreta **`Teens`** (`#F3EADA`, `#5E3E2C`, borde `#D8C2A8`). Reemplazar `bg-zinc-900` / `bg-indigo-600` actuales. |
| **`StudentNav` — Links (`>= 681px`) y Barra inferior (`<= 680px`)** | Enlaces desktop/tablet: **`min-height: 48px`**, `min-width: 48px`, `padding: 0 14px`, `border-radius: 12px`. Barra móvil `<= 680px`: fija inferior `#FFFFFF`, `border-top: 1.5px solid #D8C2A8`, `grid-template-columns: repeat(auto-fit, minmax(64px, 1fr))`, ítems **`min-height: 52px`**. | Activo: fondo `#C6470B`, texto `#FFFFFF`, `border: 1.5px solid #4A2511`, `box-shadow: 0 2px 0 #4A2511`, `aria-current="page"`. |
| **Nivel, Perfil y `Salir`** | Nivel `#F3EADA` (`#5E3E2C`); Perfil (`V · Valentina`) y `Salir` **`>= 48 × 48 px`** (`border-radius: 12px`, `border: 1.5px solid #D8C2A8`). | Mantiene flujo `logoutSharedDevice()` + `hasPendingWork` + `ConfirmDialog` de salida compartida. |
| **`FoxTeensIllustration` (nuevo SVG)** | Medallón circular `136 × 136 px` en hero desktop (oculto en `<= 680px`); `96 × 96 px` en vacíos. | Zorro Teens orgánico con pañoleta `#FFCA3A` + pin `#B9251D` en medallón `#522B16 → #261209` con aro `#FFCA3A`. Uso exclusivo en `/inicio` hero y vacíos. |
| **`OfflineStatusBanner`** (`offline-status-banner.tsx`) | `min-height: 48px`, botón `Sincronizar ahora` **`>= 48 × 48 px`**. | Tema Teens: offline/pendiente en `#FFF0DE`, borde `#C6470B`, texto `#872E06` / `#2B150A`; recién sincronizado `#E6F5EA` / `#166534`. |
| **`PwaUpdateBanner`** (`pwa-update-banner.tsx`) | Barra fija (`bottom: 0`, o `bottom: 68px` en `<= 680px`), botones **`>= 48 × 48 px`**. | Superficie `#2B150A`, texto `#FFF9EC`, botón primario `#FFCA3A` texto `#2B150A`, foco `#FFCA3A` (`--focus-ring-dark`). Aplazado estrictamente si hay intento `in_progress`. |
| **`AccessibleModal` / `ConfirmDialog`** (`modal.tsx`) | `max-width: 480px`, `padding: 24px`, `border: 1.5px solid #4A2511`, `border-radius: 16px`, botones **`>= 48 × 48 px`**. | Adaptado por `data-theme="teens"` con foco `#1D4ED8` y acción destructiva `#B9251D`. |
| **`ErrorState`** (`error-state.tsx`) | `max-width: 480px`, `padding: 24px`, `border: 1.5px solid #B9251D`, fondo `#FDECE9`, texto `#831712`, botones **`>= 48 × 48 px`**. | **Corrección obligatoria:** actualmente en `error-state.tsx` línea 120 el botón `variant !== 'kids'` mide `min-w-[40px] min-h-[40px]` — subirlo a **`min-h-[48px] min-w-[48px]`** cuando `variant === 'teens'` (`SPEC-09 RF-21`). |
| **`fireCelebrationConfetti`** (`confetti.ts`) | N/A (canvas-confetti). | En `theme === 'teens'`, reemplazar colores neón por paleta oficial Teens: `['#C6470B', '#FFCA3A', '#B9251D', '#2B150A']`, omitido en `prefers-reduced-motion`. |

---

## 5. Criterios de aceptación de la Base Compartida Teens

- [ ] `[data-theme="teens"]` declarado en `globals.css` con lienzo `#FAF6EE` (sin `bg-zinc-950`), `Plus Jakarta Sans` y todos los pares WCAG 2.2 AA verificados.
- [ ] `StudentShell` y `StudentNav` renderizan `UpwardCompassEmblem` (`42×42px` + etiqueta `Teens`), links `>= 48px` y barra inferior móvil `>= 52px`.
- [ ] Todo control interactivo (incluyendo `ErrorState` en `variant="teens"` y botones de `Modal`) mide **`>= 48 × 48 px CSS`**.
- [ ] `--focus-ring-dark` (`#FFCA3A`) aplicado en superficies oscuras (`PwaUpdateBanner` y hero).
- [ ] Pasa `pnpm --filter web typecheck`, `pnpm --filter web lint` y `check-guardrails.mjs`.
