# Upward English — Especificación de Diseño de la Landing Page Pública

> **Alcance del documento:** Especificación UX/UI para la **Landing Page pública** de **Upward English** (Decisión 146), pensada como puerta de entrada alegre, clara y confiable para **niños y jóvenes de 7 a 14 años** —y las familias que los acompañan— en su primer contacto con la plataforma.
>
> **Estado:** Propuesta de diseño actualizada y alineada con el boceto interactivo [landing-page-proposal.html](./landing-page-proposal.html) y sus ilustraciones en `design-proposals/landing-assets/`. **No modifica código de producción** ni altera las decisiones vinculantes de `.agents/CONTEXT.md` (§1, §2.4, §3, §5.2–§5.4, §8, §14 y §16).

---

## 1. Propósito, audiencia y voz de marca

### 1.1 Objetivo de la página de bienvenida

La Landing Page de **Upward English** cumple tres objetivos concretos en un recorrido ágil y visual:

1. **Atrapar desde el primer vistazo** a niños y jóvenes (7–14 años) con un universo cálido, ilustrado y amigable que transmite diversión y confianza.
2. **Explicar sin rodeos ni jerga técnica** qué es la plataforma, el beneficio de aprender inglés jugando y el valor de contar con una educación más personalizada junto a la profesora.
3. **Conducir sin fricción** hacia el acceso real: **crear cuenta** (`/registro`) o **entrar** (`/login`) si el estudiante ya tiene usuario.

### 1.2 Identidad unificada y voz verbal (cero jerga técnica)

La landing comparte exactamente el mismo ADN visual del ecosistema **Upward English** ([zorro-explorador-diseno.md](./zorro-explorador-diseno.md), [teens-portal-diseno.md](./teens-portal-diseno.md) y [teacher-portal-diseno.md](./teacher-portal-diseno.md)):

- **Marca definitiva:** `Upward English` (en la barra de navegación aparece únicamente el emblema y el nombre **Upward English**, sin subtítulo debajo).
- **Emblema oficial:** **«Brújula Ascendente Upward»** (`#FFCA3A`, aguja ascendente `#B9251D` con rombo `#FFFDF5`, chevrón `#C6470B` y trazos `#2B150A`).
- **Lema en footer:** *«Explora, habla y descubre tu inglés»*.
- **Regla de lenguaje (es-CO):** todo el texto visible debe ser **cercano, alegre, breve y comprensible para un niño de 8 años**, respetuoso para un joven de 14 y tranquilizador para sus familias. Los juegos se nombran siempre simplemente como **«juegos»** (sin usar «microjuegos» ni enumerarlos técnicamente).

| Qué SÍ dice la Landing Page | Qué NUNCA aparece en la Landing Page |
| --- | --- |
| *«Aprende inglés jugando, sin presión y con ganas de volver»* | Términos técnicos (*Next.js, API, cookies, PWA, IndexedDB, RBAC, backend, base de datos*) o jerga de procesos internos. |
| *«Graba tu voz y recibe comentarios y stickers de tu profesora»* | Precios, planes, suscripciones, pruebas gratis o botones de pago (`CONTEXT.md` §2.4). |
| *«Funciona en celular, tablet o computador desde el navegador»* | Badges o promesas de descarga en Google Play o App Store (`CONTEXT.md` §2.4). |
| *«Regístrate, juega y practica, aprende y crece»* | Portales de padres, cuentas de acudiente o textos legales de consentimiento (`CONTEXT.md` §2.4 y §9). |
| *«Cuida tu racha semanal con el escudo de perdón, sin presión»* | Rankings públicos, tablas de posición o competencia entre niños (`CONTEXT.md` §3 y §5.4). |

---

## 2. Sistema visual, tokens y dirección de ilustraciones

### 2.1 Paleta cálida compartida y contraste WCAG 2.2 AA

Los tokens se declaran en `:root` para garantizar consistencia total entre secciones claras, el banner final oscuro y los diálogos `<dialog>` de demostración:

| Token CSS | Nombre visual | Hex | Uso principal en la Landing | Contraste verificado |
| --- | --- | --- | --- | --- |
| `--app-bg` | Pergamino Claro | `#FFF9EC` | Lienzo principal cálido y acogedor | Base cálida |
| `--surface-1` | Papel Blanco | `#FFFFFF` | Tarjetas de pilares, beneficios de jugar, educación personalizada y pasos | Base de lectura |
| `--surface-2` | Pergamino Suave | `#FFF2D6` | Bandas de respiro visual alternadas (`section--warm`) y fondos de apoyo | `#2B150A` sobre `#FFF2D6`: **14,50:1 (AAA)** |
| `--bark-bg` | Tinta Corteza Profunda | `#2B150A` → `#3E2011` | Banner CTA final y contraste de cierre | `#FFF9EC` sobre `#3E2011`: **14,10:1 (AAA)** |
| `--ink-1` | Tinta Corteza | `#2B150A` | Títulos, encabezados, texto principal y trazos de marca | Sobre `#FFFFFF`: **17,29:1 (AAA)** · Sobre `#FFF9EC`: **16,48:1 (AAA)** |
| `--ink-2` | Tinta Canela | `#61361F` | Subtítulos, explicaciones breves y cuerpo secundario | Sobre `#FFFFFF`: **10,22:1 (AAA)** · Sobre `#FFF9EC`: **9,73:1 (AAA)** |
| `--red` / `--red-hover` | Rojo Brújula | `#B9251D` / `#991D16` | CTA principal prioritario (*«Empezar mi aventura»*), aguja del ícono | `#FFFFFF` sobre `#B9251D`: **6,28:1 (AA+)** · sobre `#991D16`: **8,26:1 (AAA)** |
| `--orange` / `--orange-hover` | Naranja Zorro | `#C6470B` / `#A53906` | CTA de registro en cabecera, acentos de cita docente y chevrón del ícono | `#FFFFFF` sobre `#C6470B`: **4,88:1 (AA)** · sobre `#A53906`: **6,59:1 (AA+)** |
| `--yellow` / `--yellow-soft` | Amarillo Campamento | `#FFCA3A` / `#FFF1C2` | Emblema de marca, CTA secundario del hero, stickers y numeración de pasos | `#2B150A` sobre `#FFCA3A`: **11,33:1 (AAA)** · `#FFCA3A` sobre `#3E2011`: **9,69:1 (AAA)** |
| `--ok-ink` / `--ok-bg` | Verde Logro | `#166534` / `#E6F5EA` | Sellos de confianza y confirmaciones | `#166534` sobre `#E6F5EA`: **6,32:1 (AA+)** |
| `--border-strong` | Borde Corteza | `#4A2511` | Enmarcado expresivo de CTAs táctiles, emblema, marcos de ilustración y tarjetas | Sobre `#FFF9EC`: **12,77:1 (AAA)** |
| `--border-soft` | Borde Arena | `#E4C9A5` | Divisores suaves entre secciones y bloques secundarios | Estructural |
| `--focus-ring` | Azul Foco Seguro | `#1D4ED8` | Anillo de foco en superficies claras (`outline: 3px solid #1D4ED8; outline-offset: 2px`) | Sobre `#FFF9EC`: **6,37:1** · Sobre `#FFFFFF`: **6,70:1** |
| `--focus-ring-dark` | Foco sobre Oscuro | `#FFCA3A` | Anillo de foco en banner CTA final oscuro y footer | Sobre `#2B150A`: **11,33:1** · Sobre `#3E2011`: **9,69:1** |

### 2.2 Tipografía amigable y expresiva

- **Titulares, héroe y botones principales:** **`Bricolage Grotesque`** (`700`, `800`), `letter-spacing: -0.02em`, `line-height: 1.08–1.2`. Genera energía inmediata y une visualmente la landing con Kids, Teens y el Panel Docente.
- **Cuerpo, descripciones y navegación:** **`Nunito`** (`600`, `700`, `800`) para lectura cálida y **`Plus Jakarta Sans`** (`500`, `600`, `700`) para enlaces de navegación, etiquetas y footer, manteniendo líneas cómodas de `50–65 ch`.

### 2.3 Dirección de arte de las 3 ilustraciones editoriales (`design-proposals/landing-assets/`)

La landing integra tres ilustraciones editoriales vectoriales creadas específicamente con la paleta cálida de **Upward English** (`#FFF9EC`, `#FFCA3A`, `#E85D04`, `#C6470B`, `#B9251D`, `#2B150A`), con contornos definidos `#4A2511` y **estrictamente sin texto ni letras dentro de las imágenes**:

| Archivo | Ubicación en la Landing | Escena representada | Reglas de presentación y `alt` |
| --- | --- | --- | --- |
| `./landing-assets/hero-expedition.png` (`1376×768`) | Bloque 2 · Hero principal | El Zorro Explorador (con pañoleta amarilla y pin rojo ascendente) guiando a una niña y a un joven por un sendero soleado hacia un campamento, con burbujas de íconos (estrella, nota musical, brújula y micrófono). | Protagonismo amplio en la columna derecha (`1.18fr`, `aspect-ratio: 16/10` y `min-height: 360px` en escritorio), ocupando limpiamente el espacio sin badges debajo. |
| `./landing-assets/games-adventure.png` (`1200×896`) | Bloque 4 · Beneficios de aprender jugando | Escena alegre del Zorro Explorador celebrando junto a una tableta luminosa con fichas táctiles, tarjetas de memoria ilustradas, rompecabezas y estrellas doradas. | Marco cálido `4:3`, armonizado junto a las 3 tarjetas de beneficios pedagógicos del juego. |
| `./landing-assets/speaking-journey.png` (`1200×896`) | Bloque 6 · Cómo empiezas en 3 pasos | Estudiante sonriente con tableta practicando con un micrófono de ondas cálidas, estrellas, escudo dorado e insignias mientras el Zorro Explorador anima cerca. | Marco cálido `4:3`, refuerza el mensaje de hablar inglés con confianza y avanzar semana a semana. |

---

## 3. Arquitectura de la Landing Page (6 bloques de contenido + cabecera + footer)

La página mantiene un ritmo visual alternado entre fondo claro (`#FFF9EC`) y bandas cálidas suaves (`#FFF2D6`), eliminando bloques redundantes o técnicos para priorizar claridad e impacto visual:

### Bloque 1 — Cabecera pública sticky

- **Izquierda:** emblema **Brújula Ascendente Upward** (`42×42 px`, dentro de objetivo `>= 48×48px`) + únicamente el nombre **`Upward English`** (sin subtítulo debajo).
- **Centro (escritorio `>= 960px`):** navegación directa por anclas: `Qué es` (`#que-es`), `Juegos` (`#juegos`), `Personalizada` (`#personalizada`) y `Cómo empezar` (`#como-funciona`).
- **Derecha:** dos acciones claras (`>= 48px` de alto): botón secundario **`Entrar`** (`/login`) y botón primario **`Crear mi cuenta`** (`#C6470B`, `/registro`).
- **Móvil (`<= 680px` / `390×844`):** conserva la marca limpia y ofrece botón accesible **`Menú`** (`>= 48×48px`, `aria-expanded`, `aria-controls`) que despliega los 4 enlaces y ambos botones de acceso sin desbordar la pantalla.

### Bloque 2 — Hero dinámico de bienvenida (`#inicio`)

- **Composición:** dos columnas asimétricas en escritorio (`0.92fr / 1.18fr`, apilado en tablet y celular) dando mayor protagonismo visual a la ilustración principal.
- **Columna izquierda (mensaje y acción):**
  - Etiqueta alegre: **`Inglés para explorar · 7 a 14 años · Niveles A1 a B2`**.
  - Titular `<h1>`: *«Aprende inglés jugando, hablando y descubriendo nuevas palabras»*.
  - Resumen breve en 2 líneas claras sobre qué ofrece **Upward English**: juegos interactivos, grabaciones cortas de voz y comentarios con stickers de la profesora cada semana.
  - **Dos CTAs táctiles (`min-height: 54px`):**
    1. **`Empezar mi aventura`** (`#B9251D`, abre el diálogo de registro `/registro`).
    2. **`Descubre los juegos`** (`#FFCA3A` con texto `#2B150A`, enlaza suavemente a `#juegos`).
- **Columna derecha:** ilustración **`./landing-assets/hero-expedition.png`** ampliada en marco cálido redondeado (`24px`, borde `2px solid #4A2511`, sombra `5px 5px 0 #4A2511`), **sin badges ni píldoras debajo** para mantener un lienzo limpio y directo.

### Bloque 3 — Resumen educativo «¿Qué hace especial a Upward English?» (`#que-es`)

Banda cálida (`section--warm`) con tres tarjetas en rejilla (`3 columnas` en escritorio, `2` en tablet, `1` en móvil):

1. **Aprende jugando a tu ritmo:** entra a los **juegos** a cualquier hora y practica las veces que quieras ganando estrellas de práctica, sin notas ni presión.
2. **Habla inglés con confianza:** graba tu voz contando historias o respondiendo preguntas cortas y recibe comentarios amables y stickers de tu profesora.
3. **Avanza semana a semana:** colecciona insignias, progresa de **A1 a B2** y cuenta con un escudo de perdón que cuida tu racha si una semana te ausentas.

### Bloque 4 — Beneficios de aprender jugando (`#juegos`)

En lugar de enumerar mecánicas técnicas o insertar un minijuego extenso en la portada, esta sección menciona los **juegos** por encima (*juegos interactivos de palabras, memoria, asociación y retos ágiles*) y se enfoca en **por qué aprender jugando transforma la experiencia de niños y jóvenes**:

- **Composición:** ilustración **`./landing-assets/games-adventure.png`** a la izquierda junto a **3 tarjetas de beneficios** a la derecha:
  1. **Recuerdas palabras de forma natural:** jugar con vocabulario y frases cortas conecta significados con diversión y retiene mucho más que memorizar listas.
  2. **Practicas sin miedo a equivocarte:** los juegos suman estrellas de práctica a tu ritmo, sin notas que afecten tu promedio ni límites de intentos.
  3. **Mantienes la motivación cada semana:** convertir unos minutos al día en un reto entretenido despierta la curiosidad y hace que los estudiantes quieran volver a practicar.

### Bloque 5 — «Una educación más personalizada» (`#personalizada`)

Banda cálida (`section--warm`) dedicada a explicar el **trato cercano estudiante–profesora** que permite la aplicación:

- **Mensaje central:** *«En Upward English no estudias frente a una máquina fría: tu profesora acompaña tu proceso de cerca, escucha tu progreso y adapta el apoyo a lo que realmente necesitas para avanzar.»*
- **Composición en 2 columnas (`personal-layout`):**
  - **Izquierda — Postal ilustrativa de acompañamiento docente:** muestra un ejemplo vivo de mensaje personal cálido de la profesora tras escuchar una historia de voz, acompañado de stickers motivacionales (*«🌟 ¡Excelente trabajo!»*, *«🎙️ ¡Muy buena pronunciación!»*).
  - **Derecha — Rejilla `2×2` con los 4 pilares del trato estudiante–profesora:**
    1. **Comentarios hechos para ti:** la profesora escucha tus audios y lee tus respuestas para darte consejos claros y amables pensados solo para tu avance.
    2. **Stickers que motivan:** cada logro se celebra con mensajes y stickers especiales que refuerzan la confianza al hablar y escribir en inglés.
    3. **Oportunidades para mejorar:** si un tema cuesta un poco más, tu profesora puede darte un nuevo intento para que practiques y superes tu propia marca.
    4. **Adaptado a tu nivel y edad:** progresas de A1 a B2 en un espacio cómodo para tu edad (con seguimiento constante y sin compararte con otros compañeros).

### Bloque 6 — «Así empiezas tu aventura en 3 pasos» + Tranquilidad para familias (`#como-funciona`)

Presenta el recorrido de entrada de forma **general, clara y amigable** (sin exponer procesos internos administrativos detrás de cámaras):

- **Columna izquierda — 3 pasos generales:**
  1. **Regístrate:** crea tu cuenta en pocos pasos y prepárate para entrar a tu propio espacio de inglés.
  2. **Juega y practica:** diviértete con juegos interactivos, graba tu voz y completa retos cortos a tu ritmo.
  3. **Aprende y crece:** recibe apoyo cercano, colecciona estrellas e insignias y nota cómo mejora tu inglés cada semana.
- **Columna derecha:** ilustración **`./landing-assets/speaking-journey.png`**.
- **Franja inferior de tranquilidad (`trust-strip`):** cuatro garantías claras: *Cero anuncios y cero distracciones externas · Sin rankings que presionen ni comparen a los niños · Funciona en celular, tablet o computador desde el navegador · Acompañamiento cercano y personal de tu profesora*.

### Bloque 7 — Banner CTA final + Footer completo (`<footer>`)

- **Banner CTA final (`#2B150A` → `#3E2011`):** titular *«¿Listo para descubrir cuánto inglés puedes aprender jugando?»* y dos botones `>= 54px` (foco `#FFCA3A`): **`Crear mi cuenta`** y **`Ya tengo cuenta`**.
- **Footer en 4 columnas (2 en tablet, 1 en celular):**
  1. **Marca:** emblema **Brújula Ascendente Upward**, **`Upward English`**, lema *«Explora, habla y descubre tu inglés»* y breve descripción.
  2. **Explora:** `Qué es Upward English` (`#que-es`), `Aprender jugando` (`#juegos`), `Educación personalizada` (`#personalizada`) y `Cómo empezar` (`#como-funciona`).
  3. **Mi cuenta:** `Crear cuenta` (`/registro`), `Iniciar sesión` (`/login`) y `Recuperar contraseña` (`/recuperar-contrasena`).
  4. **Niveles y confianza:** `Niveles MCER A1 · A2 · B1 · B2`, `Términos y condiciones` (`/terminos`) y `Plataforma educativa sin publicidad`.
- **Franja inferior:** `© 2026 Upward English · Aprende inglés explorando` · `Disponible desde cualquier navegador · Sin descargas obligatorias`.

---

## 4. Responsive, ergonomía táctil y accesibilidad WCAG 2.2 AA

### 4.1 Puntos de corte y comportamiento por pantalla

| Viewport de referencia | Disposición esperada | Reglas de control |
| --- | --- | --- |
| **Escritorio (`>= 1024px`, ref. `1280×900`)** | Contenedor máximo `1160px`, cabecera horizontal limpia sin subtítulo, hero `0.92fr / 1.18fr` con ilustración ampliada (`573×393px`), pilares en 3 columnas, bloques de juegos, personalizada y 3 pasos en 2 columnas, footer en 4 columnas. | `scrollWidth <= clientWidth`; `scroll-margin-top` compensando la cabecera sticky. |
| **Tablet (`681px–1023px`, ref. `800×1280`)** | Hero, juegos, educación personalizada y 3 pasos en 1 columna cómoda con imágenes fluidas a ancho completo; pilares, tranquilidad y footer en 2 columnas. | Todos los controles `>= 48×48px`; cabecera compacta sin recortes. |
| **Celular (`<= 680px`, ref. `390×844`)** | Todo apilado en 1 columna fluida, cabecera limpia con botón `Menú` colapsable (`>= 48×48px`), CTAs cómodos, imágenes fluidas `width: 100%; height: auto` y footer en 1 columna. | `0` desbordamiento horizontal; `0` controles por debajo de `48×48px CSS`. |

### 4.2 Checklist WCAG 2.2 AA

- [x] **Contraste verificado:** texto normal `>= 4,5:1` y texto grande / controles UI `>= 3:1` en todos los bloques claros y oscuros.
- [x] **Objetivos táctiles `>= 48 × 48 px CSS`:** en enlaces de cabecera, menú móvil, CTAs, controles de diálogo y enlaces del footer.
- [x] **Foco visible por teclado:** `3px solid #1D4ED8` en superficies claras y `3px solid #FFCA3A` en bloques oscuros, más enlace *«Ir al contenido principal»*.
- [x] **Movimiento, imágenes y alto contraste:** transiciones CSS puras; `@media (prefers-reduced-motion: reduce)` y `@media (forced-colors: active)` aplicados; las 3 ilustraciones llevan `alt` descriptivo en español y cero texto incrustado.
- [x] **Semántica limpia:** jerarquía `h1` → `h2` → `h3`, `<blockquote class="postcard-quote">`, roles ARIA válidos y `0` violaciones `axe-core` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`).

---

## 5. Cumplimiento estricto de exclusiones del piloto (`CONTEXT.md` §2.4)

| Exclusión de `CONTEXT.md` §2.4 | Verificación en la Landing Page |
| --- | --- |
| **Pasarela de pagos / precios / suscripciones** | Cero secciones de planes, tarifas, descuentos o botones de compra. |
| **Capacitor / Google Play / App Store** | Cero insignias o enlaces de tiendas móviles; acceso directo desde navegador. |
| **Cuentas o sección de padres / `Guardian` / consentimiento legal** | Cero referencias a cuentas de padres o consentimientos legales; enlace convencional a `/terminos`. |
| **Rankings públicos entre alumnos** | Cero tablas de líderes ni competencia entre niños; énfasis en estrellas de práctica, insignias y racha semanal perdonable. |
| **Educaplay embebido (`iframe`)** | Prohibido todo `<iframe>`. |
| **Analítica de terceros / publicidad** | Cero rastreadores o publicidad; entorno educativo explícitamente libre de anuncios. |

---

## 6. Relación con el boceto interactivo `landing-page-proposal.html`

El prototipo autónomo en [landing-page-proposal.html](./landing-page-proposal.html) materializa esta especificación para revisión visual y funcional (sin tocar código de producción):

1. **Integra las 3 ilustraciones editoriales** en `./landing-assets/hero-expedition.png` (ampliada en el hero sin badges debajo), `./landing-assets/games-adventure.png` y `./landing-assets/speaking-journey.png`, junto al emblema SVG exacto **«Brújula Ascendente Upward»** y su favicon data-URI.
2. **Presenta la narrativa depurada** enfocada en los beneficios de aprender jugando (sin enumerar mecánicas), **«Una educación más personalizada»** sobre el trato estudiante–profesora, los **3 pasos generales** (*Regístrate*, *Juega y practica*, *Aprende y crece*), diálogos demo (`/registro`, `/login`, `/recuperar-contrasena`, `/terminos`) y cabecera limpia sin subtítulo bajo el nombre.
3. **Incluye barra de estudio ocultable** con selector **Escritorio (`1280px`)**, **Tablet (`800px`)** y **Celular (`390px`)**, verificada en Chromium con `0` errores, `0` desbordes y `0` violaciones WCAG 2.2 AA.
