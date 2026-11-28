# Plan de Implementación — Página de Registro de Estudiante (`/registro`)

> **Alcance:** Rediseño visual, ergonómico y accesible de `/registro` alineado con **Upward English** ([landing-page-diseno.md](./landing-page-diseno.md) y [zorro-explorador-diseno.md](./zorro-explorador-diseno.md)). Este documento es únicamente un plan de implementación; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/registro` |
| **Archivos objetivo** | [layout.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/layout.tsx), [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/registro/page.tsx), [registro-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/registro/registro-client.tsx) |
| **Componentes compartidos** | `UpwardCompassEmblem` ([brand-emblem.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/landing/brand-emblem.tsx)) |
| **Diseño de referencia** | [landing-page-diseno.md](./landing-page-diseno.md) §1–§2 y [zorro-explorador-diseno.md](./zorro-explorador-diseno.md) §1.2, §2 |
| **Orden sugerido** | **Paso 2 de acceso público** (después o en paralelo a `plan-login.md`, compartiendo `(public)/layout.tsx`) |
| **Contratos / Guardrails** | `SPEC-01`, `SPEC-02`, `SPEC-09` RF-21, Decisiones 33, 35, 76, 134, `CONTEXT.md` §2.4 y §16 |

---

## 1. Objetivo de la página y alcance

Convertir el formulario actual de registro (`bg-zinc-50` + botones `bg-blue-600`, donde los inputs opcionales del acudiente miden `min-h-[40px]` por debajo del estándar táctil) en una experiencia cálida, clara y sin fricción para estudiantes de 7 a 14 años y sus familias, cumpliendo **48 × 48 px CSS mínimos en todo control** y respetando las exclusiones del piloto (`CONTEXT.md` §2.4).

### Qué cambia vs. qué permanece intacto

- **Cambia (capa visual y ergonomía):**
  - Tarjeta editorial cálida `#FFFFFF` sobre `#FFF9EC`, con `UpwardCompassEmblem`, enlace `← Volver al inicio` (`/`) y secciones visualmente agrupadas: **Datos del estudiante**, **Contacto del acudiente (opcional)** y **Confirmación**.
  - Corrección ergonómica de `guardianName` y `guardianContact` de `min-h-[40px]` → **`min-h-[48px]`**, y del checkbox `acceptTerms` a una caja interactiva cómoda de **`>= 48 × 48 px`** alrededor del control (o caja `24×24px` centrada en contenedor táctil `min-h-[48px]`) con borde visible `#9A7B5C`.
  - Tarjeta de confirmación exitosa (`pending_approval`) con sello de éxito `#E6F5EA` / `#166534`, ícono cálido de brújula/check y botón primario `#C6470B` hacia `/login`.
- **Permanece intacto (lógica y reglas de negocio):**
  - `useMutation` hacia `POST ${apiUrl}/api/v1/auth/signup` con `credentials: 'include'` y `getAuthErrorMessage(code)`.
  - Validación cliente de contraseña: **8 a 16 caracteres, sin espacios**.
  - Campos `guardianName` y `guardianContact` opcionales (pertenecientes a `Student`; **prohibido** introducir textos legales de consentimiento Ley 1581, entidad `Guardian` o `ConsentRecord` — Decisión 35).
  - Checkbox obligatorio `acceptTerms` con enlace a `/terminos`.

---

## 2. Paleta de colores exacta y contraste WCAG 2.2 AA

| Elemento / Rol | Token CSS sugerido | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Lienzo público** | `--app-bg` | `#FFF9EC` | Base cálida |
| **Tarjeta del formulario y éxito** | `--surface-1` | `#FFFFFF` | Base de lectura |
| **Sub-bloque «Datos del Acudiente (Opcional)»** | `--surface-2` | `#FFF2D6` | `#2B150A` sobre `#FFF2D6`: **14,50:1 (AAA)** |
| **Sello de confirmación enviada** | `--ok-bg` / `--ok-ink` | Fondo `#E6F5EA` · Texto `#166534` · Borde `#B7DFC2` | `#166534` sobre `#E6F5EA`: **6,32:1 (AA+)** |
| **Tinta principal (títulos, labels, inputs)** | `--ink-1` | `#2B150A` | Sobre `#FFFFFF`: **17,29:1 (AAA)** |
| **Tinta secundaria (ayuda edad/contraseña)** | `--ink-2` | `#61361F` | Sobre `#FFFFFF`: **10,22:1 (AAA)** · Sobre `#FFF2D6`: **9,01:1 (AAA)** |
| **Borde tarjeta y botones CTA** | `--border-strong` | `#4A2511` | Sobre `#FFF9EC`: **12,77:1 (AAA)** |
| **Borde suave de secciones** | `--border-soft` | `#E4C9A5` | Estructural |
| **Borde de inputs, checkbox y date picker** | `--border-control` | `#9A7B5C` | Sobre `#FFFFFF`: **3,92:1 (AA UI ≥ 3:1)** |
| **CTA primario («Enviar solicitud» / «Ir al inicio de sesión»)** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` | `#FFFFFF` sobre `#C6470B`: **4,88:1 (AA)** · `#A53906`: **6,59:1 (AA+)** |
| **Enlaces (`/terminos`, `/login`, `/`)** | `--orange-hover` | `#A53906` | Sobre `#FFFFFF`: **6,59:1 (AA+)** |
| **Alerta de error (`role="alert"`)** | `--red-soft` / `--red` | Fondo `#FDECE9` · Borde `#B9251D` · Texto `#831712` | `#831712` sobre `#FDECE9`: **8,75:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` | `outline: 3px solid #1D4ED8; outline-offset: 2px` (**6,70:1** sobre `#FFFFFF`) |

---

## 3. Tipografía y reglas de texto

| Rol | Variable CSS (`layout.tsx`) | Peso | Tamaño exacto | Reglas |
| --- | --- | --- | --- | --- |
| **Marca y `<h1>`** | `--font-upward-display` (`Bricolage Grotesque`) | `700` / `800` | `H1`: `1.625rem–1.875rem` (`26–30px`) | `letter-spacing: -0.02em`, `line-height: 1.15`. Título: *«Crea tu cuenta»*. |
| **Subtítulo de sección (`<h2>` Acudiente)** | `--font-upward-display` | `700` | `1rem` (`16px`) | Tono claro y breve. |
| **Labels y texto de ayuda** | `--font-upward-body` (`Nunito`) | `600` / `700` | Label: `0.9375rem` (`15px`) · Ayuda: `0.8125rem` (`13px`) | Ayuda de nacimiento: *«Tu fecha de nacimiento ayuda a preparar tu espacio según tu edad.»* |
| **Inputs (`text`, `email`, `date`, `password`) y CTAs** | `--font-upward-body` | `600` / `700` | **`1rem` (`16px` obligatorio)** | Evita auto-zoom en Safari iOS/iPadOS y mejora legibilidad infantil. |

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Ancho / Alto | Padding / Gap | Borde / Radio / Sombra | Comportamiento en `1280px` / `800px` / `390px` |
| --- | --- | --- | --- | --- |
| **Enlace superior `← Volver al inicio`** | `min-height: 48px`, `min-width: 48px` | `padding: 0 12px`, `gap: 8px` | `border-radius: 12px` | Contenedor centrado `max-width: 560px` sobre la tarjeta. |
| **Tarjeta principal (`SignupCard`)** | `width: 100%`, `max-width: 560px` | `padding: 24px` móvil · `32px` `sm+`; `gap: 20px` | `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511`, fondo `#FFFFFF` | En `390×844` ocupa `358px` con `0` desborde horizontal. |
| **Cabecera de marca** | Emblema `46 × 46 px` + texto | `gap: 12px`, `margin-bottom: 20px` | Sello `#FFCA3A`, `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 2px 2px 0 #4A2511` | Usa `<UpwardCompassEmblem size={28} />`. |
| **Rejilla superior de campos (`Nombre`, `Correo`, `Fecha nac.`, `Contraseña`)** | En `>= 640px`: `Correo` y `Fecha` pueden ir en 2 columnas (`grid-cols-2`, `gap: 14px`) o 1 columna cómoda | `gap: 16px` vertical entre filas | Inputs `#FFFFFF`, `border: 1.5px solid #9A7B5C`, `border-radius: 12px` | Todos los inputs (`#name-input`, `#email-input`, `#birthdate-input`, `#password-input`) tienen **`min-height: 48px`** y `padding: 12px 14px`. |
| **Caja «Datos del acudiente (Opcional)»** | `width: 100%` | `padding: 16px`, `gap: 12px` | Fondo `#FFF2D6`, `border: 1.5px dashed #C78E54`, `border-radius: 16px` | En `>= 640px`, 2 columnas (`Nombre acudiente` + `Teléfono o correo`); en móvil `1 columna`. **Corregir ambos inputs de `40px` → `min-height: 48px`** y texto `16px`. |
| **Checkbox `acceptTerms`** | Área clicable **`min-height: 48px`**, caja visual `24 × 24 px` con envoltorio táctil `48 × 48 px` | `gap: 12px` | Borde `#9A7B5C`, `border-radius: 6px`, acento `#C6470B` | El enlace `/terminos` dentro del label conserva subrayado claro (`#A53906`) y `target="_blank" rel="noopener noreferrer"`. |
| **Botón `Enviar solicitud`** | `width: 100%`, **`min-height: 52px`** | `padding: 12px 20px` | Fondo `#C6470B`, `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 0 3px 0 #4A2511` | `active: translateY(2px)` (desactivado en `prefers-reduced-motion`). |
| **Tarjeta de éxito (`successMessage`)** | `width: 100%`, `max-width: 480px` | `padding: 32px 24px`, `gap: 16px` | Fondo `#FFFFFF`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511` | Insignia circular `64 × 64 px` en `#E6F5EA` con borde `#166534`, título `<h1>`, mensaje claro y botón `Ir al inicio de sesión` (`min-height: 52px`). |
| **Enlace pie `¿Ya tienes una cuenta? Inicia sesión`** | `min-height: 48px` | `padding-top: 16px` | `border-top: 1.5px solid #E4C9A5` | Enlace `/login` con área clicable `min-height: 48px` (`inline-flex items-center px-2`). |

---

## 5. Estados obligatorios y casos límite

| Estado | Tratamiento visual | Regla funcional |
| --- | --- | --- |
| **Carga inicial (Suspense)** | Tarjeta centrada `#FFFFFF` con borde `#4A2511` y texto `#2B150A`. | *«Cargando formulario de registro…»* |
| **Error de validación cliente (contraseña / términos)** | Banner `role="alert"` arriba del formulario en `#FDECE9`, foco movido o anunciado vía `aria-live="assertive"`. | Contraseña 8–16 caracteres sin espacios; `acceptTerms === true`. |
| **Error del servidor (`EMAIL_TAKEN`, edad fuera de rango, red)** | Mismo banner `role="alert"` en `#FDECE9` sin detalles técnicos. | Usa `getAuthErrorMessage(code)`. |
| **Enviando solicitud** | Botón `Enviar solicitud` deshabilitado con texto *«Enviando…»*. | Previene múltiples `POST /api/v1/auth/signup`. |
| **Solicitud enviada (`pending_approval`)** | Pantalla de éxito serena explicando que la profesora revisará y aprobará la cuenta antes de ingresar. | **Sin redirección automática ni autologin.** CTA claro hacia `/login`. |

---

## 6. Plan de implementación paso a paso

1. **Reutilizar el fondo público de `(public)/layout.tsx`** configurado en `plan-login.md` (`#FFF9EC` + retícula suave).
2. **Actualizar el fallback de [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/registro/page.tsx):** reemplazar `text-zinc-600` sobre blanco por tarjeta cálida `#FFFFFF` sobre `#FFF9EC`.
3. **Rediseñar [registro-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/registro/registro-client.tsx):**
   - Añadir cabecera con `UpwardCompassEmblem` (`46×46px`), nombre `Upward English` y enlace superior `← Volver al inicio` (`min-h-12`).
   - Estandarizar todos los `<input>` (incluidos `#guardian-name-input` y `#guardian-contact-input`) a `min-h-[48px] text-base border-[1.5px] border-[#9A7B5C] rounded-xl`.
   - Envolver la sección «Datos del Acudiente (Opcional)» en contenedor `#FFF2D6` con borde `1.5px dashed #C78E54`, manteniendo el copy respetuoso y **sin** menciones a entidad `Guardian` ni consentimiento de menores.
   - Asegurar que el checkbox `#accept-terms-checkbox` tenga contenedor táctil de `48px` de alto y que el texto no mencione leyes ni consentimiento parental legal, conservando el enlace a `/terminos` con `rel="noopener noreferrer"`.
   - Rediseñar la vista de `successMessage` con sello verde `#E6F5EA` / `#166534` (`64×64px`), título en `Bricolage Grotesque` y CTA `Ir al inicio de sesión` (`min-h-[52px]`).

---

## 7. Skills, herramientas y guardrails recomendados

| Recurso | Aplicación concreta |
| --- | --- |
| `upward-english-guardrails` | Verificar `G-C05` (cero `Guardian`/`ConsentRecord`/consentimiento de menores), `G-C08` (sin `any`/aserciones), `G-C13` (enlaces seguros, sin `dangerouslySetInnerHTML`). Ejecutar `check-guardrails.mjs`. |
| `accessibility` | Verificar SC 2.5.8 (`>= 48×48px` especialmente en `guardianName`, `guardianContact` y checkbox), labels asociados y contraste `#9A7B5C` (`3,92:1`). |
| `playwright-best-practices` | Validar formulario completo y estado `successMessage` en `1280×800`, `800×1280` y `390×844` + `axe-core`. |
| `verification-before-completion` | Ejecutar `pnpm --filter web typecheck`, `pnpm --filter web lint` y pruebas unitarias/E2E de registro. |

---

## 8. Criterios de aceptación (Checklist)

- [ ] Todos los campos de texto, fecha, contraseña, acudiente, checkbox, enlaces y botones tienen área táctil **`>= 48 × 48 px CSS`**.
- [ ] Los inputs `#guardian-name-input` y `#guardian-contact-input` subieron de `40px` a `>= 48px` y tamaño `16px`.
- [ ] La paleta usa `#FFF9EC`, `#FFFFFF`, `#FFF2D6`, `#2B150A`, `#61361F`, `#C6470B`, `#4A2511`, `#9A7B5C` y `#1D4ED8` en foco.
- [ ] Cero referencias a entidad `Guardian`, `ConsentRecord` o textos legales de consentimiento de menores (`CONTEXT.md` §2.4 y §16).
- [ ] Cero desbordamiento horizontal en `390×844`, `800×1280` y `1280×800`, y `0` violaciones `axe-core` WCAG 2.2 AA.
- [ ] Pasa `pnpm --filter web typecheck`, `pnpm --filter web lint` y `check-guardrails.mjs`.
