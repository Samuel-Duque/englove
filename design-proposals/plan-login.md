# Plan de Implementación — Página de Inicio de Sesión (`/login`)

> **Alcance:** Rediseño visual, ergonómico y accesible de `/login` alineado con la identidad **Upward English** ([landing-page-diseno.md](./landing-page-diseno.md) y [zorro-explorador-diseno.md](./zorro-explorador-diseno.md)). Este documento es únicamente un plan de implementación; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/login` |
| **Archivos objetivo** | [layout.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/layout.tsx), [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/login/page.tsx), [login-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/login/login-client.tsx) |
| **Componentes compartidos** | `UpwardCompassEmblem` ([brand-emblem.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/landing/brand-emblem.tsx)) |
| **Diseño de referencia** | [landing-page-diseno.md](./landing-page-diseno.md) §1–§2 y [zorro-explorador-diseno.md](./zorro-explorador-diseno.md) §1.2, §2 |
| **Orden sugerido** | **Paso 1 de acceso público** (junto con `PublicLayout`, antes o en paralelo a `/registro`) |
| **Contratos / Guardrails** | `SPEC-01`, `SPEC-09` RF-17–RF-21, Decisión 122 (`auth-hygiene`), `CONTEXT.md` §16 |

---

## 1. Objetivo de la página y alcance

Transformar `/login` de su tarjeta neutra actual (`bg-zinc-50` + botones `bg-blue-600`) en una puerta de acceso cálida, clara y táctil perteneciente inequívocamente a **Upward English**, usable por niños desde 7 años, adolescentes y la profesora.

### Qué cambia vs. qué permanece intacto

- **Cambia (capa visual, accesibilidad y ergonomía):**
  - Contenedor público `(public)/layout.tsx` con lienzo `#FFF9EC` (Pergamino Claro) y retícula sutil de cuaderno de campo (sin romper `/recuperar-contrasena`, `/restablecer/[token]` ni `/terminos`).
  - Cabecera de marca con **Brújula Ascendente Upward** (`UpwardCompassEmblem`) + `Upward English`, enlace claro `← Volver al inicio` (`/`) y tarjeta elevada con borde corteza `#4A2511` y sombra sólida cálida.
  - Botón primario `#C6470B` (hover `#A53906`) o `#B9251D`, inputs con borde `#9A7B5C` (AA UI `3,92:1`), foco `#1D4ED8` (`3px`, offset `2px`) y objetivos táctiles `>= 48 × 48 px CSS` en todos los controles (incluido el enlace a `/recuperar-contrasena` y `/registro`).
- **Permanece intacto (lógica y contratos):**
  - `useQuery` de comprobación silenciosa (`['auth', 'silent-refresh', nextParam]`) con `isLogoutPending()`, `reconcilePendingLogout()`, lectura de `session_hint` y `requestSharedRefresh()`.
  - `useMutation` a `POST ${apiUrl}/api/v1/auth/login` con `credentials: 'include'`, `getAuthErrorMessage(code)`, `purgeOtherUsersEntries(data.user.id)`, `setSharedSession(data)`, `clearSharedProfile()`, `clearSharedFeatureFlags()`, `getQueryClient().clear()` y validación `isSafeNextDestination(nextParam)`.
  - Bloque condicional de credenciales rápidas **solo cuando** `NEXT_PUBLIC_APP_ENV === 'local' || APP_ENV === 'local'`.

---

## 2. Paleta de colores exacta y contraste WCAG 2.2 AA

| Elemento / Rol | Token CSS sugerido | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Lienzo público** | `--app-bg` | `#FFF9EC` | Base cálida |
| **Trama de puntos sutil** | — | `rgba(198, 71, 11, 0.08)` | Decorativa (`24×24 px`, `pointer-events: none`) |
| **Tarjeta principal / fallback** | `--surface-1` | `#FFFFFF` | Base de lectura |
| **Superficie secundaria / botón Dev** | `--surface-2` | `#FFF2D6` | `#2B150A` sobre `#FFF2D6`: **14,50:1 (AAA)** |
| **Tinta principal (H1, labels, inputs)** | `--ink-1` | `#2B150A` | Sobre `#FFFFFF`: **17,29:1 (AAA)** · Sobre `#FFF9EC`: **16,48:1 (AAA)** |
| **Tinta secundaria (subtítulo, ayuda)** | `--ink-2` | `#61361F` | Sobre `#FFFFFF`: **10,22:1 (AAA)** · Sobre `#FFF9EC`: **9,73:1 (AAA)** |
| **Borde estructural de tarjeta y botones CTA** | `--border-strong` | `#4A2511` | Sobre `#FFF9EC`: **12,77:1 (AAA)** |
| **Borde suave / divisor interno** | `--border-soft` | `#E4C9A5` | Divisor no interactivo |
| **Borde de inputs en reposo** | `--border-control` | `#9A7B5C` | Sobre `#FFFFFF`: **3,92:1 (AA UI ≥ 3:1)** |
| **Emblema Upward** | `--yellow` | `#FFCA3A` | `#2B150A` sobre `#FFCA3A`: **11,33:1 (AAA)** |
| **CTA primario («Entrar»)** | `--orange` / `--orange-hover` | `#C6470B` / `#A53906` | `#FFFFFF` sobre `#C6470B`: **4,88:1 (AA)** · `#A53906`: **6,59:1 (AA+)** |
| **Enlaces de texto (`/recuperar-contrasena`, `/registro`, `/`)** | `--orange` / `--orange-hover` | `#A53906` / `#872E06` | `#A53906` sobre `#FFFFFF`: **6,59:1 (AA+)** · sobre `#FFF9EC`: **6,27:1 (AA+)** |
| **Banner de error (`role="alert"`)** | `--red-soft` / `--red` | Fondo `#FDECE9` · Borde `#B9251D` · Texto `#831712` | `#831712` sobre `#FDECE9`: **8,75:1 (AAA)** |
| **Anillo de foco por teclado** | `--focus-ring` | `#1D4ED8` | `outline: 3px solid #1D4ED8; outline-offset: 2px` (**6,70:1** sobre `#FFFFFF`) |

---

## 3. Tipografía y reglas de texto

| Rol | Variable CSS (ya en `layout.tsx`) | Peso | Tamaño exacto | Reglas |
| --- | --- | --- | --- | --- |
| **Marca y título `<h1>`** | `--font-upward-display` (`Bricolage Grotesque`) | `700` / `800` | Marca: `1.25rem` (`20px`) · `H1`: `1.625rem–1.875rem` (`26–30px`) | `letter-spacing: -0.02em`, `line-height: 1.15`. Título claro: *«Inicia sesión»* o *«¡Hola de nuevo!»*. |
| **Subtítulo y labels** | `--font-upward-body` (`Nunito`) | `600` / `700` | Subtítulo: `0.95rem` (`15.2px`) · Label: `0.9375rem` (`15px`) | `line-height: 1.45`. Español de Colombia cercano y breve. |
| **Inputs, botones y enlaces** | `--font-upward-ui` / `--font-upward-body` | `600` / `700` | Inputs: **`1rem` (`16px` mínimo para evitar zoom automático en iOS)** · Botón CTA: `1rem` (`16px`) | Nunca usar font-size `< 16px` en `<input>` en móvil. |
| **Botones dev locales** | `--font-upward-ui` (`Plus Jakarta Sans`) | `600` / `700` | `0.8125rem` (`13px`) | Solo visibles con `APP_ENV=local`. |

---

## 4. Anatomía y tamaño exacto de cada componente

### Breakpoints de referencia
- **Escritorio (`>= 961px`, ref. `1280×800`):** tarjeta centrada vertical y horizontalmente, espacio holgado alrededor.
- **Tablet (`681px–960px`, ref. `800×1280`):** misma tarjeta centrada con `padding` lateral `24px`.
- **Móvil (`<= 680px`, ref. `390×844`):** tarjeta fluida al `100%` del ancho con margen lateral `16px`, sin desbordamiento horizontal (`scrollWidth <= clientWidth`).

### Tabla de dimensiones por componente

| Componente | Ancho / Alto | Padding / Gap | Borde / Radio / Sombra | Comportamiento táctil y responsivo |
| --- | --- | --- | --- | --- |
| **Contenedor raíz `(public)/layout.tsx`** | `min-height: 100dvh`, `width: 100%` | `padding: 24px 16px` (`32px 24px` en `>= 640px`) | Fondo `#FFF9EC` + trama de puntos `24×24px` | Flex columna centrado; `overflow-x: clip`. |
| **Enlace superior `← Volver al inicio`** | `min-height: 48px`, `min-width: 48px` (`inline-flex`) | `padding: 0 12px`, `gap: 8px`, `margin-bottom: 12px` | `border-radius: 12px`, hover `#FFF2D6` | Alineado a la izquierda sobre la tarjeta dentro de `max-width: 460px`. |
| **Tarjeta principal (`LoginCard`)** | `width: 100%`, `max-width: 460px` | `padding: 24px` móvil · `32px` `sm+`; `gap: 20px` | `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511`, fondo `#FFFFFF` | En `<= 390px`, ocupa `358px` reales sin compresión. |
| **Cabecera de marca (`BrandHeader`)** | Emblema `46 × 46 px` dentro de enlace/contenedor `>= 48px` | `gap: 12px`, `margin-bottom: 20px` | Contenedor emblema `#FFCA3A`, `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 2px 2px 0 #4A2511` | Usa `<UpwardCompassEmblem size={28} />` dentro del sello `46×46px` para igualar a Kids. |
| **Banner de error (`role="alert"`)** | `width: 100%`, `min-height: 48px` | `padding: 12px 16px`, `gap: 10px` | `border: 1.5px solid #B9251D`, `border-radius: 14px`, fondo `#FDECE9` | Texto `#831712` + ícono de alerta; sin detalles técnicos. |
| **Input `Correo electrónico` y `Contraseña`** | `width: 100%`, **`min-height: 48px`** (`height: 50px` recomendado) | `padding: 12px 14px` | `border: 1.5px solid #9A7B5C` (hover/focus `#4A2511`), `border-radius: 12px`, fondo `#FFFFFF` | Letra `16px`; añadir botón opcional «Mostrar / Ocultar contraseña» de **`48 × 48 px`** si se incluye en la derecha del input (si no, mantener simple). |
| **Enlace `¿Olvidaste tu contraseña?`** | **`min-height: 48px`** (`inline-flex items-center`) en área táctil | `padding: 4px 6px` | `border-radius: 8px`, foco `#1D4ED8` | Separado del input para no chocar el foco ni violar `48×48px` (SC 2.5.8 / RF-21). |
| **Botón primario `Entrar`** | `width: 100%`, **`min-height: 52px`** | `padding: 12px 20px` | Fondo `#C6470B`, `border: 2px solid #4A2511`, `border-radius: 14px`, `box-shadow: 0 3px 0 #4A2511` | Al pulsar: `translateY(2px)` + `box-shadow: 0 1px 0 #4A2511` (anulado en `prefers-reduced-motion`). |
| **Pie de tarjeta `¿No tienes cuenta? Regístrate aquí`** | Contenedor `min-height: 48px` con enlace táctil `min-height: 48px` | `padding-top: 16px`, `gap: 6px` | `border-top: 1.5px solid #E4C9A5` | El enlace `/registro` debe tener área clicable `>= 48px` de alto (`inline-flex items-center px-2 py-2`). |
| **Bloque Dev (`APP_ENV === 'local'`)** | `width: 100%`, cada botón `min-height: 52px` | `gap: 8px`, `padding: 10px 14px` | `border: 1.5px solid #D8C2A8`, `border-radius: 12px`, fondo `#FFF2D6` / `#FFF9EC` | 1 columna en móvil, `grid-cols-1` limpio; nunca renderizado en staging/producción. |
| **Estado `isCheckingSession` (Suspense y query)** | Tarjeta `max-width: 420px`, `min-height: 140px` | `padding: 28px` | Mismo marco `#FFFFFF` + `#4A2511` | Spinner CSS en `#C6470B` (estático en `prefers-reduced-motion`) + *«Comprobando tu sesión…»*. |

---

## 5. Estados obligatorios y casos límite

| Estado | Presentación visual | Copy exacto y comportamiento |
| --- | --- | --- |
| **Comprobando sesión (`isCheckingSession` / `<Suspense>`)** | Tarjeta centrada `#FFFFFF` sobre `#FFF9EC`, emblema Upward y texto legible `#2B150A`. | *«Comprobando tu sesión…»*. Preserva altura estable para evitar saltos visuales (`CLS <= 0,10`). |
| **Logout pendiente (`isLogoutPending()`)** | Banner `role="alert"` en `#FDECE9` si falla la reconciliación. | Conserva exactamente el mensaje existente de `login-client.tsx`: *«No se pudo confirmar el cierre de sesión. Reintenta cuando haya conexión; la cuenta anterior permanece bloqueada en este dispositivo.»* |
| **Error de credenciales / bloqueo 10 min / `pending_approval`** | Banner `#FDECE9` con borde `#B9251D`, ícono de aviso y `role="alert"`. | Usa `getAuthErrorMessage(code)` sin revelar si el correo existe ni exponer códigos internos crudos. |
| **Enviando (`loginMutation.isPending`)** | Botón `#A53906` deshabilitado (`opacity: 0.7`, `aria-busy="true"`). | Texto *«Entrando…»* (sin permitir doble envío). |
| **Sin conexión al enviar** | Mensaje de error claro en `role="alert"`. | *«No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.»* |

---

## 6. Plan de implementación paso a paso

1. **Actualizar el layout público ([layout.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/layout.tsx)):**
   - Reemplazar `bg-zinc-50` por lienzo `#FFF9EC`, tinta base `#2B150A` y la trama de puntos cálida (`radial-gradient(rgba(198, 71, 11, 0.08) 1.2px, transparent 1.2px)` cada `24px × 24px`) mediante clase scoped en `globals.css` (o contenedor con `::before` `pointer-events-none`) respetando `@media (forced-colors: active)`.
2. **Alinear el fallback de SSR ([page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/login/page.tsx)):**
   - Reemplazar el texto gris genérico de `<Suspense fallback={...}>` por la tarjeta centrada en `#FFFFFF` con borde `#4A2511` y texto `#2B150A`, evitando parpadeo gris→pergamino al hidratar.
3. **Rediseñar la UI de [login-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(public)/login/login-client.tsx) sin alterar su lógica:**
   - Importar `UpwardCompassEmblem` desde `../../../components/landing/brand-emblem`.
   - Construir la cabecera superior de navegación de retorno (`← Volver al inicio`, `href="/"`, `min-h-12`) y la insignia de marca (`46×46px` `#FFCA3A` + `Upward English`).
   - Aplicar a los inputs `Correo electrónico` y `Contraseña` las clases con `min-h-12` (`48px`), `text-base` (`16px`), borde `#9A7B5C` y foco `3px solid #1D4ED8`.
   - Dar al enlace `/recuperar-contrasena` un contenedor táctil `min-h-12 inline-flex items-center` y color `#A53906`.
   - Estilizar el botón `Entrar` con `--orange` (`#C6470B`), borde `#4A2511` (`2px`), sombra `0 3px 0 #4A2511`, `min-h-[52px]` y transición respetando `prefers-reduced-motion`.
   - Adaptar los 3 botones de desarrollo local (`local` only) a la paleta cálida (`#FFF2D6` / `#FFF9EC` / `#4A2511`) manteniendo `min-h-[48px]`.
4. **Verificar teclado, foco y responsive:**
   - Comprobar tabulación lógica: `Saltar al contenido principal` → `← Volver al inicio` → `Correo` → `¿Olvidaste tu contraseña?` (o después de contraseña según orden DOM natural; preferible mantener label + input arriba y enlace accesible con `min-h-12`) → `Contraseña` → `Entrar` → `Regístrate aquí`.

---

## 7. Skills, herramientas y guardrails recomendados

| Recurso | Para qué consultarlo al implementar |
| --- | --- |
| `upward-english-guardrails` | Verificar `G-B02` (`proxy.ts` sin autorización de negocio), `G-C08` (sin `any`/aserciones), `G-C10` (cero PII en logs) y ejecutar `node .agents/skills/upward-english-guardrails/scripts/check-guardrails.mjs`. |
| `accessibility` | Validar contraste WCAG 2.2 AA, `role="alert"`, `<label htmlFor>` y objetivos `>= 48×48px` (SC 2.5.8). |
| `frontend-design` | Cuidar jerarquía visual y acabado artesanal del cuaderno cálido sin perder limpieza. |
| `playwright-best-practices` | Probar en `1280×800`, `800×1280` y `390×844` con `axe-core` y verificar `scrollWidth <= clientWidth`. |
| `verification-before-completion` | Correr `pnpm --filter web typecheck`, `pnpm --filter web lint` y test de login antes de dar la página por terminada. |

---

## 8. Criterios de aceptación (Checklist)

- [ ] Fondo `#FFF9EC`, tarjeta `#FFFFFF` (`max-width: 460px`, `border: 2.5px solid #4A2511`, `border-radius: 22px`, `box-shadow: 4px 4px 0 #4A2511`) y emblema `UpwardCompassEmblem` (`46×46px` `#FFCA3A`).
- [ ] Todos los controles interactivos (inputs, enlaces, botón `Entrar`, enlace volver) tienen tamaño táctil **`>= 48 × 48 px CSS`** en `1280×800`, `800×1280` y `390×844`.
- [ ] Contraste verificado: textos `>= 4,5:1`, bordes de inputs `#9A7B5C` (`>= 3:1`), foco `#1D4ED8` (`3px solid`, `offset: 2px`).
- [ ] `scrollWidth <= clientWidth` en los 3 viewports y `0` violaciones `axe-core` WCAG 2.2 AA.
- [ ] Lógica intacta: silent refresh con `session_hint`, `reconcilePendingLogout()`, `purgeOtherUsersEntries()`, `isSafeNextDestination()` y credenciales demo estrictamente bajo `APP_ENV === 'local'`.
- [ ] Pasa `pnpm --filter web typecheck`, `pnpm --filter web lint` y `check-guardrails.mjs`.
