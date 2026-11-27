# Plan de Implementación — Teens: Mi Perfil (`/perfil`)

> **Alcance:** Rediseño de `/perfil` en tema **Teens (`data-theme="teens"`)**, con credencial de estudiante limpia, datos del acudiente en estricta solo lectura, cambio de correo OTP con controles `>= 48px` y selector **Teens / Kids** regido por `canSwitchInterface` ([teens-portal-diseno.md](../teens-portal-diseno.md) §5.7). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/perfil` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/perfil/page.tsx), [perfil-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/perfil/perfil-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 8 de 8** del Portal Teens |
| **Contratos / Guardrails** | `SPEC-02`, `SPEC-05`, `SPEC-09` RF-21 y RF-24, `CONTEXT.md` §3 y §8, Decisiones 35, 62, 134 |

---

## 1. Objetivo de la página y alcance

Migrar `perfil-client.tsx` en Teens desde las tarjetas oscuras `zinc-900 / indigo-950` hacia tarjetas `#FFFFFF` sobre `#FAF6EE`, **actualizando obligatoriamente el texto de la opción Teens** (hoy dice *«paleta sobria en tonos oscuros»*, que quedó obsoleto tras la Decisión 146) y elevando todos los botones e inputs del flujo OTP por debajo de `48px` a **`>= 48 × 48 px CSS`**.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Credencial de estudiante:** avatar inicial (`52×52px` en `#2B150A` texto `#FFCA3A` o `#F3EADA` borde `#4A2511`), nombre, edad/fecha (`America/Bogota`), nivel MCER, correo actual y bloque informativo de solo lectura sobre contacto del acudiente (sin mencionar entidad `Guardian`).
  - **Conmutador de apariencia del portal (`canSwitchInterface === true`):**
    - Dos tarjetas interactivas `>= 92px` de alto con `aria-pressed`:
      - **`Teens`:** *«Interfaz limpia y directa para 11 años o más.»* (en `#FFF0DE` con borde `#C6470B` cuando está activo).
      - **`Kids (Zorro Explorador)`:** *«Interfaz más ilustrada con botón Escuchar en cada consigna.»*
    - Nota visible: *«Puedes cambiar de apariencia cuando quieras. Cumplir años nunca cambia tu interfaz automáticamente.»*
  - **Flujo cambio de correo OTP:** botón `Cambiar correo electrónico`, inputs `#new-email`, `#current-password`, `#otp-code` y botones de envío/cancelación todos en **`min-height: 48px`**, `font-size: 16px` y borde `#9A7B5C`.
- **Permanece intacto:**
  - `useQuery(['student', 'profile'])` (`/api/v1/me`), `themeMutation` (`PATCH /api/v1/me/interface` + `clearSharedProfile()` + `syncUserSegment()`), `requestEmailMutation`, `confirmEmailMutation` y prohibición absoluta de calcular `canSwitchInterface` en el cliente.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjetas Credencial / Apariencia / Seguridad** | `--surface-1` / `--border-rest` | `#FFFFFF`, borde `1.5px solid #D8C2A8` | `#2B150A` sobre `#FFFFFF`: **17,29:1 (AAA)** |
| **Avatar inicial Teens** | `--hero-start` / `--yellow` | Fondo `#2B150A`, inicial `#FFCA3A`, borde `#4A2511` | **11,33:1 (AAA)** |
| **Opción apariencia seleccionada** | `--tint-orange-bg` / `--orange` | `#FFF0DE`, borde `2px solid #C6470B`, texto `#2B150A` | **> 14:1 (AAA)** |
| **Opción apariencia disponible** | `--surface-1` / `--border-rest` | `#FFFFFF`, borde `1.5px solid #D8C2A8` (hover `#4A2511`) | **17,29:1 (AAA)** |
| **Inputs (`new-email`, `current-password`, `otp-code`)** | `--border-control` | `#FFFFFF`, borde `1.5px solid #9A7B5C` (focus `#4A2511`), texto `#2B150A` | **3,92:1 (AA UI)** |
| **Éxito (`themeSuccess` / `emailSuccess`)** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, borde `#166534`, texto `#166534` | **6,32:1 (AA+)** |
| **Error (`themeError` / `emailError`)** | `--tint-red-bg` / `-ink` | `#FDECE9`, borde `#B9251D`, texto `#831712` | **8,75:1 (AAA)** |
| **Botón primario (`Solicitar cambio` / `Confirmar`)** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`, `0 2px 0 #4A2511`) | **4,88:1 (AA)** |
| **Botón secundario (`Cambiar correo`, `Cancelar`)** | `--surface-2` | `#F3EADA`, texto `#2B150A`, borde `1.5px solid #D8C2A8` | **14,49:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,61–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Mi Perfil:** `Bricolage Grotesque 800`, `1.55rem–1.95rem`.
- **Encabezados `<h2>`:** `Bricolage Grotesque 700`, `1.1875rem`.
- **Labels, cuerpo e inputs:** `Plus Jakarta Sans 500–700`; inputs con **`1rem` (`16px`)** y `#otp-code` con `tabular-nums tracking-widest`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Contenedor central** | `max-width: 820px`, `margin: 0 auto`, `gap: 20px` | — | 1 columna centrada. |
| **Tarjeta Credencial** | Avatar `52 × 52 px`; datos en `2 columnas` `sm+`, `1` en móvil. | `padding: 24px`, `border-radius: 16px`, `border: 1.5px solid #D8C2A8` | Correo con `break-all` seguro en `390px`. |
| **Selector Kids / Teens** | `2 columnas` `sm+`, `1` en móvil; cada botón **`min-height: 92px`**. | `padding: 18px`, `border-radius: 14px` | `aria-pressed={currentSegment === '...'}`. |
| **Botón `Cambiar correo electrónico`** | **`min-height: 48px`**, `min-width: 210px` (`100%` en móvil). | `padding: 10px 18px`, `border-radius: 12px` | Corrige `py-2 text-xs` actual. |
| **Inputs y botones formulario OTP** | Inputs **`min-height: 48px`** (`font-size: 16px`); botones **`min-height: 48px`**, `min-width: 120px`. | `padding: 10px 14px`, `border-radius: 12px` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F3EADA` (`180px`), *«Cargando tu perfil…»*.
- **Error carga perfil:** `ErrorState` `variant="teens"` con botón `Reintentar` `>= 48px`.
- **Actualizando tema / OTP:** botones deshabilitados con feedback claro y alertas `role="status"` / `role="alert"`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar la rama Teens de [perfil-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/perfil/perfil-client.tsx):**
   - Retirar todas las clases oscuras (`bg-zinc-900`, `bg-indigo-950`, `bg-zinc-800`) de la rama Teens.
   - Actualizar el texto descriptivo de la tarjeta Teens a *«Interfaz limpia y directa para 11 años o más.»* (sin mención a tema oscuro).
   - Aplicar tokens `#FFFFFF`, `#FAF6EE`, `#F3EADA`, `#D8C2A8`, `#9A7B5C`, `#C6470B`, `#166534`, `#B9251D`.
   - Elevar todos los inputs y botones del flujo OTP y selector de tema a `min-h-12` (`>= 48px`) y fuente `16px`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux`, `upward-english-guardrails` (`G-C05` sin `Guardian`, `check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Sin clases `zinc-900` / `indigo-950` ni textos obsoletos sobre «tema oscuro».
- [ ] `canSwitchInterface` leído estrictamente del backend sin cálculo local por edad.
- [ ] Todos los controles (selector de tema, botón abrir OTP, 3 inputs, botones confirmar/cancelar) miden **`>= 48 × 48 px CSS`**.
- [ ] Cero referencias a entidad `Guardian` o consentimientos legales.
- [ ] `0` violaciones `axe-core`, `0` desborde horizontal en `390×844` / `800×1280` / `1280×800`, `typecheck` y `lint` en verde.
