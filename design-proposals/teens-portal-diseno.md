# Upward English Teens — Especificación de Diseño (`data-theme="teens"`)

> **Alcance del documento:** Especificación integral de diseño UX/UI para el tema **Teens (`data-theme="teens"`, 11–14+ años)** de **Upward English** (Decisión 146), completando la trilogía visual de la plataforma junto con el portal Kids (**Zorro Explorador**, [zorro-explorador-diseno.md](./zorro-explorador-diseno.md)) y el Panel Docente (**Estudio Editorial Cálido**, [teacher-portal-diseno.md](./teacher-portal-diseno.md)).
>
> **Estado:** Propuesta de diseño profundizada y documento de referencia para el boceto interactivo [teens-portal-proposal.html](./teens-portal-proposal.html). **No modifica código de producción** ni altera las decisiones vinculantes de `.agents/CONTEXT.md` (§2.4, §3–§5.4, §8–§10, §14 y §16).

---

## 1. Trilogía visual Upward English y evolución de la mascota

### 1.1 Posicionamiento de Teens dentro de la misma marca

En **Upward English**, los estudiantes de 11 años en adelante tienen acceso a una experiencia **moderna, limpia y motivadora sin infantilizar** (`CONTEXT.md` §8), y pueden alternar voluntariamente entre **Kids** y **Teens** desde `/perfil` cuando la API habilita `can_switch_interface = true` (`CONTEXT.md` §3).

Para evitar que Teens se perciba como un producto distinto (por ejemplo, un tema oscuro genérico azul/neón desconectado de la marca), el diseño ocupa el **punto exacto de madurez intermedia** dentro del mismo ADN cálido de **Upward English**:

| Dimensión visual | Kids (`data-theme="kids"`, 7–10 / opcional 11+) | Teens (`data-theme="teens"`, opcional 11–14+) | Panel Docente (`teacher`) |
| --- | --- | --- | --- |
| **Registro de experiencia** | Diario de expedición lúdico y táctil | Estudio juvenil ágil, directo y enérgico (sin infantilizar) | Estudio editorial académico formal y sereno |
| **Emblema «Brújula Ascendente Upward»** | `46×46 px`, `#FFCA3A`, borde `2px solid #4A2511`, sombra `2px 2px 0 #4A2511` + `Upward English` | **`42×42 px`**, `#FFCA3A`, borde `1.5px solid #4A2511`, sombra nítida `2px 2px 0 #4A2511` + etiqueta sutil **`Teens`** | `38–40 px`, `#FFCA3A`, borde `1.5px solid #4A2511`, sombra difusa `0 1px 2px rgba(43,21,10,0.12)` + píldora `Panel Docente` |
| **Lienzo y superficies** | Pergamino `#FFF9EC` con trama de puntos + `#FFFFFF` + `#FFF2D6` + franjas punteadas `2px dashed` | Lienzo limpio **`#FAF6EE`** (sin trama de puntos ni costuras punteadas), tarjetas `#FFFFFF`, arena cálida **`#F3EADA`** y hero en **Tinta Corteza profunda (`#2B150A` → `#3E2011`)** | Marfil pergamino limpio `#FCF9F2`, `#FFFFFF`, lino `#F6EFE4`, callout `#FFF6E3` |
| **Bordes y elevación** | Bordes `2.5px solid #4A2511`, sombras cómic `4–5px` | Bordes limpios **`1.5px solid #D8C2A8`** en reposo (`#9A7B5C` en inputs AA), `#4A2511` en activos y CTAs con profundidad compacta **`0 2px 0 #4A2511`** | Bordes finos `1px solid #E4D5C3`, elevación difusa `0 1px 3px rgba(43,21,10,0.06)` |
| **Mascota** | Zorro Explorador ilustrado (hero, vacíos, celebraciones) | **Zorro Explorador (versión Teens)**: trazos orgánicos naturales, expresión más madura y serena en medallón circular sobrio, usado con moderación solo en el hero y estados vacíos | Cero mascota caricaturesca |
| **Tipografía** | `Bricolage Grotesque` (700–800) + `Nunito` (600–800) | **`Bricolage Grotesque`** (700–800) + **`Plus Jakarta Sans`** (500–700, `tabular-nums`) | `Bricolage Grotesque` (600–700) + `Plus Jakarta Sans` (400–700, `tabular-nums`) |
| **Texto a voz (TTS)** | Botón «Escuchar» (`48×48 px`) en cada consigna y tarjeta | **Sin botones TTS repetidos** en cada tarjeta (UI más limpia; `Speaking` conserva grabación y reproducción de audio) | Reproductor y descarga de audio solo en revisión de `Speaking` |
| **Tono verbal (es-CO)** | Cálido, expresivo y guiado paso a paso | Directo, cercano y respetuoso; sin diminutivos, sermones ni mensajes de culpa | Profesional, preciso y operativo |

### 1.2 Evolución de la mascota: «Zorro Explorador (versión Teens)»

Para mantener el vínculo afectivo con **Upward English** sin resultar infantil para estudiantes de 11 a 14+ años, la mascota conserva proporciones orgánicas y naturales de zorro —evitando deformaciones geométricas— pero evoluciona hacia un retrato más sereno y maduro:

- **Construcción orgánica y coherente:** trazos curvos limpios en degradado **Naranja Llama (`#F2721B` → `#C94B0B`)**, orejas erguidas con puntas terracota oscura (`#7D2607`), mejillas crema continuas (`#FFFDF5`) con puente nasal estilizado, cejas sutiles, ojos expresivos y despiertos, y sonrisa segura y sobria.
- **Vínculo directo con la marca:** conserva la **pañoleta en Amarillo Campamento (`#FFCA3A`)** portando el **mini pin ascendente Upward (`#B9251D`)**, enmarcada dentro de un **medallón circular oscuro (`#522B16` → `#261209`) con aro dorado `#FFCA3A`** sobre el hero `#2B150A` → `#3E2011`.
- **Moderación estricta de uso:** aparece únicamente en el **hero de `/inicio`** (oculto en móvil `<= 680px` para priorizar la primera acción) y en **estados vacíos** discretos. Nunca compite con el emblema «Brújula Ascendente Upward» de la cabecera ni distrae durante la resolución de actividades o microjuegos.

---

## 2. Sistema de tokens `[data-theme="teens"]`

Los tokens se organizan como un conjunto de valores alterno del **mismo sistema de tokens compartidos** (`CONTEXT.md` §8), definido en `:root` y acotado por `[data-theme="teens"]` de forma que `<dialog>` y los componentes compartidos con Kids hereden los valores sin duplicar estructura.

### 2.1 Paleta cromática y verificación WCAG 2.2 AA

Todos los contrastes siguientes han sido verificados matemáticamente según la luminancia relativa de WCAG 2.2:

| Token CSS | Nombre visual | Hex | Uso principal en Teens | Contraste verificado |
| --- | --- | --- | --- | --- |
| `--app-bg` | Papel Arena Claro | `#FAF6EE` | Lienzo principal (limpio, sin trama de puntos) | Base cálida |
| `--surface-1` | Papel Blanco | `#FFFFFF` | Tarjetas de actividades, microjuegos, progreso, feedback y perfil | Base de lectura |
| `--surface-2` | Arena Cálida | `#F3EADA` | Chips secundarios, barras de metadatos, pestañas inactivas, bloques de apoyo | `#2B150A` sobre `#F3EADA`: **14,49:1 (AAA)** |
| `--hero-start` / `--hero-end` | Tinta Corteza Profunda | `#2B150A` → `#3E2011` | Hero de `/inicio` y banner principal del espacio Teens | `#FFF9EC` sobre `#2B150A`: **16,48:1 (AAA)** · sobre `#3E2011`: **14,10:1 (AAA)** |
| `--hero-ink` / `--hero-muted` | Crema sobre Corteza | `#FFF9EC` / `#F3EADA` | Títulos y subtítulos dentro del hero oscuro cálido | `#F3EADA` sobre `#3E2011`: **12,39:1 (AAA)** |
| `--hero-accent-graphic` | Naranja Llama | `#E85D04` | Facetas del Zorro Teens, separadores gráficos y acentos grandes en hero oscuro *(no usar en texto pequeño sobre `#3E2011`)* | Sobre `#2B150A`: **4,94:1 (AA)** · sobre `#3E2011`: **4,23:1 (AA gráfico/grande ≥ 3:1)** |
| `--ink-1` | Tinta Corteza | `#2B150A` | Títulos, texto principal, notas `0,0–5,0`, cifras de racha y estrellas | Sobre `#FFFFFF`: **17,29:1 (AAA)** · Sobre `#FAF6EE`: **16,04:1 (AAA)** |
| `--ink-2` | Tinta Nogal | `#5E3E2C` | Subtítulos, fechas límite, descripciones y metadatos secundarios | Sobre `#FFFFFF`: **9,54:1 (AAA)** · Sobre `#FAF6EE`: **8,85:1 (AAA)** · Sobre `#F3EADA`: **7,99:1 (AAA)** |
| `--orange` / `--orange-hover` | Naranja Zorro | `#C6470B` / `#A53906` | Navegación activa, CTA de inicio de actividad/juego, acento primario | `#FFFFFF` sobre `#C6470B`: **4,88:1 (AA)** · sobre `#A53906`: **6,59:1 (AA+)** |
| `--red` / `--red-hover` | Rojo Brújula | `#B9251D` / `#991D16` | CTA prioritario (continuar/reanudar/entregar), aguja del ícono, alerta de error | `#FFFFFF` sobre `#B9251D`: **6,28:1 (AA+)** · sobre `#991D16`: **8,26:1 (AAA)** |
| `--yellow` / `--yellow-soft` | Amarillo Campamento | `#FFCA3A` / `#FFF1C2` | Fondo del emblema, CTA de reintento/práctica, estrellas de práctica, acento luminoso en hero oscuro (`--ink` `#543200`) | `#2B150A` sobre `#FFCA3A`: **11,33:1 (AAA)** · `#FFCA3A` sobre `#3E2011`: **9,69:1 (AAA)** · `#543200` sobre `#FFF1C2`: **10,15:1 (AAA)** |
| `--status-ok-ink` / `--status-ok-bg` | Verde Confirmación | `#166534` / `#E6F5EA` | Confirmación real de guardado en servidor, actividad calificada y escudo activo | `#166534` sobre `#E6F5EA`: **6,32:1 (AA+)** |
| `--tint-orange-bg` / `-ink` | Terracota Suave | `#FFF0DE` / `#872E06` | Etiquetas de tipo, selección activa y avisos de sincronización offline | `#872E06` sobre `#FFF0DE`: **7,74:1 (AAA)** |
| `--tint-red-bg` / `-ink` | Carmín Suave | `#FDECE9` / `#831712` | Aviso de reintento autorizado (`retry_extend_until`) y errores recuperables | `#831712` sobre `#FDECE9`: **8,75:1 (AAA)** |
| `--border-rest` | Borde Arena | `#D8C2A8` | Bordes limpios `1.5px` de tarjetas y contenedores en reposo | Estructural |
| `--border-control` | Borde Control AA | `#9A7B5C` | Bordes de `<input>`, `<select>`, `<textarea>` y controles en reposo (WCAG 1.4.11) | Sobre `#FFFFFF`: **3,92:1** · Sobre `#FAF6EE`: **3,63:1 (AA UI ≥ 3:1)** |
| `--border-active` | Borde Corteza | `#4A2511` | Controles activos, emblema `1.5px` y sombra táctil compacta `0 2px 0 #4A2511` | Sobre `#FAF6EE`: **12,46:1 (AAA)** |
| `--focus-ring` | Azul Foco Seguro | `#1D4ED8` | Anillo de foco en superficies claras (`outline: 3px solid #1D4ED8; outline-offset: 2px`) | Sobre `#FFFFFF`: **6,70:1** · Sobre `#FAF6EE`: **6,22:1** · Sobre `#F3EADA`: **5,61:1** |
| `--focus-ring-dark` | Foco sobre Hero Oscuro | `#FFCA3A` | Anillo de foco para enlaces y botones situados sobre el hero `#2B150A` → `#3E2011` | Sobre `#2B150A`: **11,33:1** · Sobre `#3E2011`: **9,69:1 (AAA)** |

> **Regla de contraste en hero oscuro:** nunca usar `--focus-ring` (`#1D4ED8`) directamente sobre el fondo `#2B150A` / `#3E2011` porque su contraste caería por debajo de 3:1; los controles sobre el hero aplican `--focus-ring-dark` (`#FFCA3A`, `>= 9,69:1`), preservando además la armonía cromática de la marca.

### 2.2 Superficies, bordes y profundidad táctil sobria

- **Lienzo limpio (`#FAF6EE`):** sin textura de puntos ni fondos recargados.
- **Tarjetas en reposo:** `background: #FFFFFF`, `border: 1.5px solid #D8C2A8`, `border-radius: 16px`, `box-shadow: 0 2px 8px rgba(43, 21, 10, 0.05)`.
- **Tarjetas destacadas (actividad en progreso / elemento seleccionado):** `border: 1.5px solid #4A2511`, banda lateral o superior sólida de `3px` en `#C6470B` o `#B9251D` (cero franjas punteadas de pasaporte).
- **Botones CTA táctiles:** `border: 1.5px solid #4A2511`, `border-radius: 12px`, `box-shadow: 0 2px 0 #4A2511` (profundidad compacta y nítida que conecta con Kids sin parecer un botón de juguete). Al pulsar (`:active`), desciende `1px` y reduce la sombra a `0 1px 0 #4A2511`.

### 2.3 Tipografía y reglas de legibilidad

| Rol | Familia | Pesos | Escala recomendada | Reglas de uso |
| --- | --- | --- | --- | --- |
| **Display / Títulos / Marca** | `Bricolage Grotesque` | `700`, `800` | Hero `clamp(1.55rem, 2.5vw, 2.05rem)` · Sección `1.3rem` · Tarjeta `1.1rem` | `letter-spacing: -0.02em`, `line-height: 1.15–1.22`. Dinámica y segura, idéntica familia que Kids y Docente. |
| **Cuerpo / UI / Consignas** | `Plus Jakarta Sans` | `500`, `600`, `700` | Base `0.95–1rem` (`15–16px`) · Subtítulos `0.875–0.92rem` · Badges `0.78–0.82rem` | `line-height: 1.45–1.55`. Lectura nítida para consignas B1/B2 y textos de feedback sin rasgos redondeados infantiles. |
| **Datos numéricos** | `Plus Jakarta Sans` (`font-variant-numeric: tabular-nums`) | `600`, `700` | Notas `0,0–5,0`, rachas semanales, contadores de partidas, temporizadores y pasos | Garantiza alineación vertical limpia en tarjetas, historiales y grabadora `Speaking`. |

- **Idioma:** español de Colombia natural, directo y respetuoso. Todo enunciado, opción o texto pedagógico en inglés incluye explícitamente `lang="en"`.

### 2.4 Ergonomía táctil y puntos de corte (`1280×800`, `800×1280`, `390×844`)

- **Regla innegociable de objetivos táctiles (`SPEC-09 RF-21` y `upward-english-kids-ux`):** **todo** control interactivo del alumno (enlaces de navegación, filtros, tarjetas clicables o sus botones, controles de microjuegos, selects de huecos, botones de grabadora, interruptores, enlaces externos y botones de modal) mide **como mínimo `48 × 48 px CSS`** en los tres viewports, con la única excepción de enlaces incrustados dentro de párrafos de texto corrido. No se rebaja a `24px` ni a `44px`.
- **Breakpoints y comportamiento responsivo:**
  - **Escritorio / Tablet horizontal (`>= 961px`, referencia `1280×800` / `1280×900`):** contenedor máximo `1160px`, cabecera completa horizontal con los 5 destinos + nivel + perfil + salir; bloque superior de `/inicio` en `1.6fr / 1fr` (Hero oscuro + Bitácora semanal); tarjetas de actividades en `2 columnas`; catálogo de microjuegos en `3 columnas`.
  - **Tablet vertical (`681px–960px`, referencia `800×1280` / `820px`):** bloque superior apilado `1 columna`, rejillas de actividades y microjuegos en `2 columnas`, cabecera adaptada sin desbordamiento manteniendo todos los controles `>= 48 × 48 px`.
  - **Celular / Móvil (`<= 680px`, referencia `390×844`):** diseño íntegro a `1 columna` con `0` desbordamiento horizontal (`scrollWidth <= clientWidth`), mascota del hero oculta para mostrar el primer CTA en el primer pantallazo, cabecera superior compacta (`Emblema + Upward English + Perfil + Salir`, todos `>= 48×48px`) y **barra inferior fija de 5 destinos (`min-height: 52px`)** con `padding-bottom` seguro en `<main>` para evitar cualquier recorte o solapamiento.

---

## 3. Arquitectura de navegación y techos de clics

Cumple holgadamente los techos definidos en `CONTEXT.md` §5.2 y `planning/architecture-overview.md` §3.1, conservando las mismas rutas y reglas de feature flags que Kids:

| Destino | Ruta real | Techo permitido (`architecture §3.1`) | Clics en Teens desde `/inicio` | Condición de visibilidad |
| --- | --- | --- | --- | --- |
| **Inicio** | `/inicio` | Actividades asignadas `<= 2 clics` | `0` (**1 clic** a abrir/continuar actividad) | Siempre visible |
| **Juegos** | `/juegos` | `<= 3 clics` | **1 clic** al catálogo · **2 clics** a jugar | Solo si `flags.games === true` |
| **Progreso** | `/progreso` | `<= 3 clics` | **1 clic** (racha, insignias e historial) | Siempre visible |
| **Feedback** | `/feedback` | `<= 3–4 clics` | **1 clic** a bandeja · **2 clics** a reintento/detalle | Siempre visible |
| **Extra** | `/extra` | `<= 3 clics` | **1 clic** a recursos · **2 clics** a abrir enlace | Solo si `flags.extra_content === true` |
| **Perfil** | `/perfil` | Acceso directo en cabecera | **1 clic** desde chip de perfil (`V · Valentina`) | Siempre visible |

### Reglas de cabecera y barra inferior móvil

1. **Cabecera sticky (`rgba(250, 246, 238, 0.96)`, `border-bottom: 1.5px solid #D8C2A8`):**
   - **Izquierda:** emblema **Brújula Ascendente Upward** (`42×42 px` dentro de objetivo `>= 48×48px`) + **`Upward English`** + etiqueta discreta **`Teens`**.
   - **Centro (escritorio y tablet):** enlaces `Inicio`, `Juegos` (si `flags.games`), `Progreso`, `Feedback`, `Extra` (si `flags.extra_content`). Ítem activo (`aria-current="page"`): fondo `#C6470B`, texto `#FFFFFF`, borde `1.5px solid #4A2511`, sombra compacta `0 2px 0 #4A2511`.
   - **Derecha:** píldora de nivel (`Nivel B1` en `#F3EADA`), botón/enlace de perfil (`V · Valentina`, `>= 48px`) y botón **`Salir`** (`>= 48×48px`, dispara `logoutSharedDevice()` con diálogo de resguardo si existen eventos pendientes sin red).
2. **Barra inferior móvil (`<= 680px` / `390×844`):**
   - Barra fija inferior en `#FFFFFF` con borde superior `1.5px solid #D8C2A8` y rejilla fluida `grid-template-columns: repeat(auto-fit, minmax(64px, 1fr))` para mostrar simultáneamente los **5 destinos activos** (`Inicio`, `Juegos`, `Progreso`, `Feedback`, `Extra`), cada uno con ícono lineal (`20px`) + etiqueta de 1 palabra y altura mínima **`52px`** (`>= 48×48px`), sin menús hamburguesa anidados.
   - En el prototipo interactivo, cualquier control flotante de restauración de barra de estudio se ubica por encima de la barra móvil (`bottom >= 76px`) para garantizar **cero solapamiento**.

---

## 4. Catálogo de componentes Teens y microinteracciones CSS puras

### 4.1 Jerarquía de botones táctiles (`>= 48 × 48 px CSS`)

- **Primario prioritario (`btn--red`, `#B9251D`, hover `#991D16`):** acciones en curso o entrega definitiva (*«Continuar actividad»*, *«Entregar actividad»*).
- **Primario de acción (`btn--orange`, `#C6470B`, hover `#A53906`):** iniciar actividad asignada o microjuego (*«Empezar actividad»*, *«Jugar ahora»*).
- **Práctica / reintento (`btn--yellow`, `#FFCA3A`, texto `#2B150A`):** nuevo intento autorizado o repetir microjuego (*«Intentar de nuevo»*, *«Practicar otra vez»*).
- **Secundario limpio (`btn--secondary`, `#F3EADA`, texto `#2B150A`):** consultar entrega calificada, cancelar o volver (*«Ver entrega y feedback»*).
- **Microinteracción CSS pura (sin Framer Motion):** transiciones de `120–140ms ease-out` únicamente en `transform`, `background-color` y `box-shadow`. Bajo `@media (prefers-reduced-motion: reduce)`, se anulan traslaciones, pulsos y confeti animado, manteniendo intacta la confirmación textual y visual.

### 4.2 Tarjetas de actividad asignable vs. microjuegos

- **Tarjeta de actividad asignable:** contenedor limpio `#FFFFFF` con borde `1.5px solid #D8C2A8`, etiqueta superior discreta de tipo (`Speaking`, `Completar espacios`, `Pregunta abierta`, `Examen`) y estado (`En progreso`, `Pendiente`, `Reintento habilitado`, `Calificada`), título en inglés (`lang="en"`), fecha límite en `America/Bogota`, callout contextual cuando aplica (tolerancia 24 h en `#FFF1C2` o `retry_extend_until` en `#FDECE9`) y tira de nota `0,0–5,0` + estrellas del servidor cuando ya fue calificada. **No incluye botones «Escuchar» (TTS) en tarjetas.**
- **Tarjeta de microjuego:** muestra ícono geométrico sobrio de la mecánica, insignia de mecánica (`Ordenar palabras`, `Memoria`, `Emparejar`, `Arrastrar y soltar`, `Elección con tiempo`), nivel orientativo, **0 a 3 estrellas de práctica** (`role="img"` con `aria-label` claro) y conteo de partidas. **Nunca muestra nota numérica ni posición en ranking** (Decisiones 132 y 137).

### 4.3 Celebraciones, sonido y voz responsables

- **Celebraciones (`confetti.ts`):** reutiliza `fireCelebrationConfetti({ theme: 'teens' })` con paleta contenida (`#C6470B`, `#FFCA3A`, `#B9251D`, `#2B150A`), omitido automáticamente bajo `prefers-reduced-motion: reduce`.
- **Sonido (`sound.ts`, Web Audio API):** efectos sutiles y opcionales con interruptor explícito `Sonido: Activado / Silenciado` (`>= 48×48px`, `aria-pressed`) dentro de microjuegos; funciona íntegramente silenciado o sin `AudioContext` y nunca importa Howler.js.
- **Voz:** Teens retira el botón TTS redundante de las tarjetas generales para ofrecer una interfaz más despejada y madura; la grabación y reproducción de voz permanecen intactas en `Speaking` y en la escucha de grabaciones propias dentro de `/feedback`.

### 4.4 Banners resilientes y cierre de sesión en dispositivos compartidos

- **Banner sin conexión (`OfflineStatusBanner`):** barra sobria en `#FFF0DE` con borde `#C6470B`, contador de respuestas en cola local y copia directa: *«Sin conexión. Tus respuestas se guardan en este dispositivo y se enviarán cuando vuelva la red.»* Nunca presenta un guardado local como si ya estuviera confirmado en el servidor.
- **Aviso de actualización PWA (`PwaUpdateBanner`):** barra fija no bloqueante (`role="status"`, superficie `#2B150A` con texto `#FFF9EC` y botón `#FFCA3A` de `>= 48px`) con *«Hay una nueva versión disponible»*, botones **`Actualizar ahora`** y **`Más tarde`** (omitido si aplica `X-App-Min-Version`). Se **aplaza obligatoriamente** mientras existe un intento `in_progress` en `/actividad/[attemptId]` (`SPEC-09`, Decisión 118).
- **Salida segura en tablet/computador compartido:** al pulsar **`Salir`** con trabajo pendiente en IndexedDB (`pendingEvents` / `pendingUploads`), tras el intento de vaciado se presenta un `<dialog>` claro con **`Esperar conexión`** o **`Salir y limpiar este dispositivo`** para proteger la sesión del siguiente estudiante (`auth-hygiene.ts`, Decisión 122).

---

## 5. Profundización de las 7 pantallas reales

*(Perfil de referencia coherente con el prototipo: **Valentina Cruz**, 13 años, **Nivel B1**, **Grupo B1 · Conversación**, `can_switch_interface = true`.)*

### 5.1 Inicio (`/inicio`)

- **Hero oscuro cálido (`#2B150A` → `#3E2011`):**
  - Saludo directo sin tono infantil: etiqueta `Nivel B1 · Grupo B1 Conversación`, título **`Hola, Valentina`**, resumen accionable (*«Tienes 1 actividad en progreso, 2 por iniciar y 1 comentario nuevo de tu profesora.»*), dos accesos rápidos de `>= 48px` (**`Practicar en microjuegos`** en `#FFCA3A` con texto `#2B150A` y **`Revisar feedback (1 nuevo)`** con borde `#F3EADA` y texto `#FFF9EC`) y el **Zorro Explorador (versión Teens)** en su medallón circular sobrio.
- **Tarjeta lateral — Bitácora semanal:**
  - Contador destacado en `tabular-nums`: **`6 semanas activas`**, tira limpia de las últimas 4 semanas (`Sem 1`–`Esta`) y estado claro del **Escudo de perdón** (sin ansiedad de rachas diarias, Decisión 43): alterna entre *«Escudo de perdón activo»* y *«Recuperando escudo: 1 de 2 semanas activas»*.
- **Sección `Actividades asignadas`:**
  - Barra de filtros (`Todas`, `Por hacer`, `Entregadas`, cada chip `>= 48px`) y rejilla de **2 columnas** en escritorio/tablet (`1 columna` en móvil) con los **4 tipos asignables reales**:
    1. **`Speaking` (En progreso):** tarjeta destacada con aviso de **tolerancia de 24 h** tras el cierre y CTA rojo **`Continuar actividad`**.
    2. **`Fill in the blanks` (Pendiente · B1):** fecha límite en hora Colombia y CTA naranja **`Empezar actividad`**.
    3. **`Pregunta abierta` (Nuevo intento habilitado):** muestra nota del intento anterior (`3,8 / 5,0`), callout en `#FDECE9` con fecha límite efectiva (`retry_extend_until`) y CTA amarillo **`Intentar de nuevo`**.
    4. **`Examen` (Calificada):** muestra calificación `4,6 / 5,0` + 3 estrellas del servidor y CTA secundario **`Ver entrega y feedback`**.

### 5.2 Zona de Microjuegos (`/juegos`)

- **Banner superior moderno:** identidad **`Zona de Microjuegos · Práctica libre 24/7`**, copy directo (*«Practica vocabulario y estructuras a tu ritmo. Los microjuegos dan estrellas de práctica y nunca afectan tus notas.»*) y dos indicadores personales en `tabular-nums`: **`Estrellas de práctica: 10 / 15`** y **`Partidas jugadas: 12`** (**cero rankings ni posiciones**).
- **Catálogo abierto a todos los niveles sin `Assignment` (Decisiones 111 y 130):** filtros `Todos`, `Por practicar` y `Jugados` sobre las **5 mecánicas reales (`GameMechanic`)** con títulos de nivel B1: `Ordenar palabras`, `Memoria`, `Emparejar`, `Arrastrar y soltar` y `Elección con tiempo`.
- **Interacción híbrida garantizada (Decisión 105):** toda mecánica con piezas movibles (`order_words`, `match`, `drag_drop`) soporta simultáneamente **arrastre (`@atlaskit/pragmatic-drag-and-drop`) + toque/clic en dos pasos (origen → destino) + operación por teclado**, convergiendo en una única acción de dominio con anuncios en `aria-live="polite"`. En `timed_choice`, recargar o reanudar reinicia desde la primera pregunta y restablece `timeLimitSeconds` por equidad (Decisión 106).

### 5.3 Entorno de Estudio — Ejecución de Actividad (`/actividad/[attemptId]`)

- **Modo enfocado limpio:** cabecera interna con botón `← Volver a inicio` (`>= 48px`), título en inglés (`lang="en"`), barra de progreso por pasos (`Paso 1 de 3`) e indicador honesto de estado (**`Respuesta guardada en el servidor`** en verde `#E6F5EA` / `#166534` vs. **`Guardado en este dispositivo`** en `#FFF0DE` / `#872E06` cuando no hay red).
- **Soporte por tipo asignable:**
  - **`Speaking`:** panel de grabación limpio con botón principal **`Grabar audio`** (`>= 56×56px`), temporizador en `tabular-nums` (`00:24 / 02:00`, mínimo `2 s`, máximo configurado hasta `120–300 s`), visualización sobria de onda, escucha previa antes de entregar y confirmación honesta del estado de subida a Cloudflare R2.
  - **`Fill in the blanks` y `Examen`:** enunciados B1 (`lang="en"`) con selectores de hueco de alto contraste (`min-height: 48px`, borde `#9A7B5C`, foco `#1D4ED8`), sin revelar `answer_key` ni calcular notas en el cliente.
  - **`Pregunta abierta`:** área de respuesta despejada con contador orientativo de palabras y borrador local seguro.
- **Aplazamiento estricto de actualización PWA:** mientras el intento está `in_progress`, el banner `PwaUpdateBanner` se mantiene oculto para no interrumpir la entrega.

### 5.4 Mi Progreso (`/progreso`)

- **Panel de Racha semanal perdonable:** cifra principal (`6 semanas seguidas`), línea temporal de semanas activas con marca de escudo y explicación directa de las 4 reglas del perdón (solo con racha activa, máximo 1 disponible, se recupera tras 2 semanas activas consecutivas).
- **Colección de Insignias (`BadgeRule` / `BadgeAward`):** rejilla sobria (`2–3 columnas`, `1 columna` en móvil) con emblemas geométricos modernos diferenciando:
  - *Desbloqueadas (3):* superficie `#FFFFFF`, borde `1.5px solid #4A2511`, medalla `#FFCA3A`, fecha de obtención y criterio cumplido (*«Primer paso»*, *«Primera grabación»*, *«4 semanas en ruta»*).
  - *Próximo hito:* superficie `#F3EADA`, borde `1.5px solid #D8C2A8`, barra de progreso concreta en `tabular-nums` (*«12 semanas en ruta — 6 / 12 semanas»*).
- **Historial de actividades calificadas:** tabla o lista responsiva escaneable con tipo, título (`lang="en"`), fecha (`America/Bogota`), estado (`Calificada` / `En revisión docente`), nota **`0,0–5,0`** en `tabular-nums` y enlace directo al detalle.

### 5.5 Mi Feedback (`/feedback`)

- **Resumen superior:** conteo de revisiones nuevas y totales sin clutter visual.
- **Tarjetas limpias de retroalimentación docente:**
  - Encabezado estructurado con tipo de actividad, título (`lang="en"`), fecha de revisión y bloque de calificación a la derecha (`4,6 / 5,0` + estrellas 0–3 en `role="img"`).
  - **Stickers oficiales (hasta 3 de los 6 de `packages/shared`):** presentados como **badges horizontales planos y limpios** (`#F3EADA` con borde `#D8C2A8` e ícono + etiqueta oficial, **sin inclinaciones infantiles ni estilo pegatina de cuaderno**).
  - **Comentario de la profesora:** bloque limpio con borde izquierdo `3px solid #C6470B`, texto directo y legible en `Plus Jakarta Sans`, más reproducción de la grabación propia en entregas `Speaking` mientras siga vigente la retención de 30 días.
  - **Nuevo intento habilitado (cuando aplica):** callout en `#FDECE9` mostrando el plazo efectivo (`retry_extend_until`) y CTA **`Intentar de nuevo`** (`>= 48px`), junto a acordeón accesible para consultar intentos previos si existen.

### 5.6 Contenido Extra (`/extra`)

- **Controlado por `flags.extra_content`:** si el flag está desactivado, muestra un estado vacío limpio (con el Zorro Explorador Teens) informando que la profesora aún está preparando recursos para esta sección.
- **Filtrado exclusivo en servidor (Decisión 125):** muestra únicamente enlaces etiquetados como **`Todos los niveles`** o **`Nivel B1`** (nivel vigente de Valentina), sin exponer enlaces de otros niveles y **sin iframes**.
- **Tarjetas de recurso externo:** título claro, descripción breve, badge de nivel, dominio destino visible (`https://…`) y botón **`Abrir recurso externo ↗`** (`>= 48px`, `target="_blank" rel="noopener noreferrer"`, validación estricta `https:`) advirtiendo que se abrirá una nueva pestaña fuera de Upward English.

### 5.7 Mi Perfil (`/perfil`)

- **Credencial de estudiante:** avatar inicial (`V`), nombre (**Valentina Cruz**), edad (`13 años`), **Nivel B1**, **Grupo B1 · Conversación**, correo actual y bloque de **datos de contacto del acudiente** en estricta **solo lectura** (aclarando que solo la profesora puede editarlos desde el panel, sin cuenta ni entidad `Guardian`).
- **Cambio de correo con OTP (Decisión 62):** formulario guiado en 2 pasos: (1) nuevo correo + contraseña actual → (2) código OTP de 6 dígitos enviado al correo nuevo, con aviso al correo anterior y revocación de otras sesiones.
- **Conmutador de apariencia del portal (`can_switch_interface = true`, CONTEXT §3):**
  - Bloque destacado **`Apariencia del portal`** que lee exclusivamente el permiso entregado por la API (`canSwitchInterface`).
  - Al tener 11+ años con `can_switch_interface = true`, presenta las dos opciones seleccionables (`>= 48px`, `aria-pressed` / `role="radiogroup"`):
    - **`Teens` (Activo):** *«Interfaz limpia y directa para 11 años o más.»*
    - **`Kids (Zorro Explorador)`:** *«Interfaz más ilustrada con botón Escuchar en cada consigna.»*
  - Incluye nota transparente: *«Puedes cambiar de apariencia cuando quieras. Cumplir años nunca cambia tu interfaz automáticamente.»*

---

## 6. Estados límite, accesibilidad WCAG 2.2 AA, privacidad y prototipo HTML

### 6.1 Matriz de estados límite (tono Teens directo y respetuoso)

| Estado | Tratamiento visual en Teens | Tono de copy (es-CO) |
| --- | --- | --- |
| **Carga** | Esqueletos en `#F3EADA` (pulso desactivable en `reduced-motion`) preservando altura para mantener `CLS <= 0,10`. | *«Cargando tus actividades…»* |
| **Vacío** | Tarjeta limpia `#FFFFFF` con borde `#D8C2A8`, Zorro Explorador Teens discreto y una única acción sugerida. | *«No tienes actividades pendientes esta semana. Puedes practicar en la Zona de Microjuegos.»* |
| **Error recuperable** | Tarjeta en `#FDECE9` con borde `#B9251D`, `role="alert"`, cero detalles técnicos y botón **`Reintentar`** (`>= 48px`). | *«No pudimos cargar tus actividades. Revisa tu conexión e inténtalo de nuevo.»* |
| **Actividad cerrada** | Aviso neutro sin culpa con fecha de cierre en `America/Bogota` y botón **`Volver a inicio`**. | *«Esta actividad ya cerró. Habla con tu profesora si necesitas un nuevo intento.»* |
| **Sin red / cola offline** | Banner `#FFF0DE` no bloqueante + estado honesto por respuesta o audio. | *«Guardado en este dispositivo. Lo enviaremos automáticamente al recuperar conexión.»* |
| **Falta de permiso / recurso inexistente** | Pantalla directa sin exponer datos de otros usuarios ni stack traces. | *«No tienes acceso a esta actividad o el enlace ya no está disponible.»* |
| **Sesión vencida** | Aviso limpio tras higiene de caché/IndexedDB y CTA único **`Iniciar sesión`**. | *«Tu sesión terminó por seguridad. Vuelve a iniciar sesión para continuar.»* |

### 6.2 Checklist WCAG 2.2 AA, privacidad y exclusiones del piloto

- [x] **Contraste verificado (`>= 4,5:1` texto, `>= 3:1` UI/foco):** validado tanto sobre lienzo claro (`#FAF6EE` / `#FFFFFF` / `#F3EADA`, foco `#1D4ED8` = `5,61–6,70:1`, bordes de input `#9A7B5C` = `3,92:1`) como sobre el hero oscuro (`#2B150A` → `#3E2011`, texto `#FFF9EC` = `14,10–16,48:1`, foco `#FFCA3A` = `9,69–11,33:1`).
- [x] **Objetivos táctiles `>= 48 × 48 px CSS` (`SPEC-09 RF-21`):** verificado en los tres viewports (`1280×800`, `800×1280` y `390×844`) para todo control interactivo del alumno; barra inferior móvil `>= 52px`.
- [x] **Sin arrastre obligatorio ni dependencia de hover:** `order_words`, `match` y `drag_drop` operan en paridad por arrastre, toque/clic en dos pasos y teclado.
- [x] **Semántica ARIA rigurosa:** `role="img"` en filas de estrellas, `role="group"` en conjuntos con `aria-label`, `tabindex="0"` + `role="region"` en regiones con scroll horizontal, sin `label-content-name-mismatch`, soporte `prefers-reduced-motion` y `forced-colors: active`.
- [x] **Cumplimiento estricto de `CONTEXT.md` §2.4 y privacidad:** cero rankings visibles para alumnos, cero notas en microjuegos, cero WebSockets/heartbeat, cero analítica externa o píxeles, cero PII en logs, cero iframes en `/extra`, cero referencias a entidad `Guardian` o consentimientos legales, y limpieza de IndexedDB/caché al salir en dispositivos compartidos.

### 6.3 Relación con el boceto interactivo `teens-portal-proposal.html`

El prototipo interactivo en [teens-portal-proposal.html](./teens-portal-proposal.html) materializa esta especificación como pieza final de la trilogía visual (sin modificar código de producción):

1. **Identidad unificada y tokens en `:root`:** incorpora el emblema SVG exacto **«Brújula Ascendente Upward»** (en cabecera `42px` y favicon SVG data-URI), el **Zorro Explorador (versión Teens)** de trazos orgánicos en medallón circular, la paleta cálida con hero `#2B150A` → `#3E2011` y `Bricolage Grotesque` + `Plus Jakarta Sans` (`tabular-nums`).
2. **Las 7 pantallas navegables completas:** **Inicio**, **Juegos** (incluyendo práctica interactiva en vivo de *Ordenar palabras* por toque y teclado), **Actividad** (alternador `Speaking` / `Completar espacios` B1), **Progreso**, **Feedback**, **Extra** y **Perfil** (con conmutador funcional **Teens / Kids** bajo `can_switch_interface = true`).
3. **Barra de estudio, responsive hasta celular (`390×844`) y modal de trilogía:** barra superior compacta ocultable con cambio rápido de pantalla, selector **`Escritorio (1280px)` / `Tablet (820px)` / `Celular (390px)`** (con barra inferior móvil de 5 destinos `>= 52px` y botón restaurar sin solapamiento), simuladores **`Simular sin red`** (incluyendo diálogo de salida segura al pulsar `Salir`) y **`Aviso PWA`** (aplazado en `/actividad`), y el modal comparativo **«Trilogía Upward: Kids · Teens · Docente»**.
