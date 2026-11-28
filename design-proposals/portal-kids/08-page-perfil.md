# Plan de Implementación — Kids: Credencial de Explorador (`/perfil`)

> **Alcance:** Rediseño de `/perfil` en tema **Kids (`data-theme="kids"`)** como **Credencial de Explorador**, con datos de cuenta y acudiente en solo lectura, formulario OTP de cambio de correo y bloque de apariencia del portal controlado exclusivamente por `canSwitchInterface` ([zorro-explorador-diseno.md](../zorro-explorador-diseno.md) §5.7). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/perfil` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/perfil/page.tsx), [perfil-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/perfil/perfil-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) |
| **Orden de implementación** | **Página 8 de 8** del Portal Kids |
| **Contratos / Guardrails** | `SPEC-02`, `SPEC-05`, `SPEC-09` RF-21 y RF-24, `CONTEXT.md` §3 y §8, Decisiones 35, 62, 134 |

---

## 1. Objetivo de la página y alcance

Transformar `/perfil` en la **Credencial de Explorador**, corrigiendo los botones e inputs pequeños actuales (`py-2 text-xs` / `py-2 text-sm` por debajo de `48px`), actualizando el texto descriptivo obsoleto de Teens (*«paleta sobria en tonos oscuros»* → nueva descripción cálida/limpia) y aplicando la estética Zorro Explorador.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Tarjeta Credencial de Explorador:** avatar inicial (`56×56px` en `#FFCA3A` con borde `#4A2511`), nombre, nivel MCER (`Nivel A1`), correo de acceso, fecha de nacimiento (`America/Bogota`) y nota clara indicando que los datos del contacto del acudiente (si la API los expone en el perfil, o la nota explicativa) solo los actualiza la profesora.
  - **Bloque Apariencia del Portal (`canSwitchInterface`):**
    - Si `canSwitchInterface === false` (7–10 años): ficha amigable en `#FFF2D6` con borde `#4A2511` indicando que su interfaz activa es **Kids · Zorro Explorador**, sin controles de cambio ni cálculo local por edad.
    - Si `canSwitchInterface === true` (11+ años): dos botones táctiles grandes (`min-height: 88px`) con `aria-pressed` para alternar entre **Kids (Zorro Explorador)** y **Teens**, corrigiendo la descripción de Teens a *«Interfaz limpia y directa para 11 años o más»* y añadiendo la nota *«Puedes cambiar de apariencia cuando quieras. Cumplir años nunca cambia tu interfaz automáticamente.»*
  - **Cambio de correo con OTP:** elevar botón `Cambiar correo electrónico`, inputs (`#new-email`, `#current-password`, `#otp-code`) y botones `Solicitar cambio` / `Confirmar nuevo correo` / `Cancelar` a **`min-height: 48 px`** y tamaño `16px`.
- **Permanece intacto:**
  - `useQuery(['student', 'profile'])` hacia `GET /api/v1/me`, `themeMutation` (`PATCH /api/v1/me/interface` + `clearSharedProfile()` + `syncUserSegment()`), `requestEmailMutation` (`POST /api/v1/me/email-change`) y `confirmEmailMutation` (`POST /api/v1/me/email-change/confirm`).
  - Prohibido derivar `canSwitchInterface` en el cliente a partir de `birthDate`; leer únicamente `student?.canSwitchInterface`.
  - Cero menciones a entidad `Guardian` o consentimientos legales (`CONTEXT.md` §2.4).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjetas principales (Credencial / Tema / Seguridad)** | `--surface-1` | `#FFFFFF` (`border: 2.5px solid #4A2511`, `4px 4px 0 #4A2511`) | Base de lectura |
| **Avatar inicial** | `--yellow` | `#FFCA3A`, texto `#2B150A`, borde `2px solid #4A2511` | **11,7:1 (AAA)** |
| **Etiquetas de campo / subtítulos** | `--ink-2` | `#61361F` | Sobre `#FFFFFF`: **9,2:1 (AAA)** |
| **Valor de datos (`user.name`, etc.)** | `--ink-1` | `#2B150A` | Sobre `#FFFFFF`: **15,7:1 (AAA)** |
| **Opción de tema seleccionada** | `--surface-soft-yellow` | `#FFF0B3`, borde `2.5px solid #C6470B`, `3px 3px 0 #4A2511` | **> 12,0:1 (AAA)** |
| **Inputs (`new-email`, `current-password`, `otp-code`)** | `--border-control` | Fondo `#FFFFFF`, borde `2px solid #9A7B5C` (focus `#4A2511`), texto `#2B150A` | Borde **3,92:1 (AA UI)** |
| **Alerta éxito (`themeSuccess` / `emailSuccess`)** | `--status-ok-bg` / `--status-ok-ink` | `#E6F5EA`, borde `#166534`, texto `#14532D` | **8,3:1 (AAA)** |
| **Alerta error (`themeError` / `emailError`)** | `--surface-soft-red` | `#FFE2DD`, borde `#B9251D`, texto `#831712` | **6,7:1 (AA+)** |
| **Botón primario formulario (`Solicitar cambio` / `Confirmar`)** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`, borde `2px solid #4A2511`) | **4,9:1 (AA)** |
| **Botón secundario (`Cambiar correo`, `Cancelar`)** | `--surface-2` | `#FFF2D6`, texto `#2B150A`, borde `2px solid #4A2511` | **> 13,5:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 3px`) | **> 5,8:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Mi Perfil — Credencial de Explorador:** `Bricolage Grotesque 800`, `1.65rem–2rem`.
- **`<h2>` de tarjetas:** `Bricolage Grotesque 700`, `1.2rem` (`19.2px`).
- **Inputs OTP y correo:** `font-size: 1rem` (`16px` obligatorio en móvil); `#otp-code` con `tabular-nums tracking-widest`.
- **Copy actualizado de opción Teens:** *«Interfaz limpia y directa para 11 años o más»* (retirar definitivamente la referencia obsoleta a *«tonos oscuros»*).

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1280×800` / `800×1280` / `390×844`) | Padding / Radio / Borde | Reglas táctiles |
| --- | --- | --- | --- |
| **Contenedor página** | `max-width: 820px`, `margin: 0 auto`, `gap: 24px` | `padding: 16px 0 32px` | 1 columna centrada. |
| **Tarjeta Credencial** | Avatar `56 × 56 px`; rejilla datos `2 columnas` en `>= 640px`, `1 columna` en móvil (`gap: 16px`). | `padding: 24px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511` | Correo con `break-all` para no desbordar `390px`. |
| **Tarjetas selectoras Kids / Teens** | `2 columnas` en `>= 640px`, `1 columna` en móvil; cada botón **`min-height: 96px`**, `width: 100%`. | `padding: 18px`, `border-radius: 18px` | `aria-pressed={currentSegment === '...'}` explícito. |
| **Botón `Cambiar correo electrónico`** | **`min-height: 48px`**, `min-width: 210px` (`100%` en móvil). | `padding: 12px 18px`, `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 2px 2px 0 #4A2511` | — |
| **Inputs y botones de formulario OTP** | Todos los `<input>` **`min-height: 48px`**; todos los `<button>` (`Solicitar cambio`, `Confirmar`, `Cancelar`) **`min-height: 48px`** (`52px` primario), `min-width: 120px`. | `padding: 10px 14px`, `border-radius: 14px` | Corrige botones/inputs actuales `< 48px`. |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Regla |
| --- | --- | --- |
| **Carga (`isLoading`)** | 3 tarjetas esqueleto `#FFF2D6` (`180px` alto cada una). | `CLS <= 0,10`. |
| **Error carga perfil (`error || !profile`)** | `ErrorState` `variant="kids"` con botón `Reintentar` `52px`. | Sin detalles técnicos. |
| **Cambiando apariencia (`isUpdatingTheme`)** | Botones deshabilitados con feedback claro y limpieza de caché tras `PATCH /api/v1/me/interface`. | Solo activo si `student?.canSwitchInterface === true`. |
| **Flujo OTP de correo** | Paso 1 (`newEmail` + `currentPassword`) → Paso 2 (`otpCode` 6 dígitos), con alertas `role="status"` / `role="alert"` accesibles. | Limpia contraseña inmediatamente al enviar Paso 1. |

---

## 6. Plan de implementación paso a paso

1. **Verificar [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/perfil/page.tsx)** y fallback cálido.
2. **Actualizar [perfil-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(student)/perfil/perfil-client.tsx) (rama Kids):**
   - Exponer `refetch` en `useQuery(['student', 'profile'])` para `ErrorState`.
   - Construir tarjeta de **Credencial de Explorador** con avatar inicial `56×56px`, datos y nota de solo lectura del acudiente sin mencionar entidad `Guardian`.
   - Rediseñar bloque **Apariencia del Portal** con tarjetas `aria-pressed` (actualizando la descripción de Teens y manteniendo lectura estricta de `student?.canSwitchInterface`).
   - Elevar todos los `<input>` (`#new-email`, `#current-password`, `#otp-code`) y botones (`Cambiar correo electrónico`, `Solicitar cambio`, `Confirmar nuevo correo`, `Cancelar`) a `min-h-12` (`48px`) y fuente `16px`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-kids-ux` (regla de segmento: no derivar permiso desde la edad en el cliente)
- `upward-english-guardrails` (`G-C05` sin `Guardian`/`ConsentRecord`, `check-guardrails.mjs`)
- `accessibility` (`aria-pressed`, `role="alert"`, `48×48px` en inputs/botones)
- `playwright-best-practices` y `verification-before-completion`

---

## 8. Criterios de aceptación (Checklist)

- [ ] `canSwitchInterface` se lee exclusivamente del backend; 7–10 años nunca ve selector de cambio.
- [ ] Texto de la tarjeta Teens actualizado al nuevo diseño limpio y directo (sin mencionar tema oscuro).
- [ ] Todos los botones e inputs del flujo OTP y apariencia miden **`>= 48 × 48 px CSS`** y inputs tienen `font-size >= 16px`.
- [ ] Cero referencias a entidad `Guardian` o consentimientos legales.
- [ ] Pasa `typecheck`, `lint`, `axe-core` WCAG 2.2 AA en `390×844` / `800×1280` / `1280×800` y `check-guardrails.mjs`.
