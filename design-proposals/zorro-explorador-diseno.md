# Upward English Kids — Especificación de Diseño «Zorro Explorador»

> **Alcance del documento:** Profundización visual y de experiencia de usuario (UX/UI) para el tema **Kids/Junior (`data-theme="kids"`)** de **Upward English** (Decisión 146), a partir de la propuesta seleccionada **Zorro Explorador** (`design-proposals/kids-ui-themed-proposals.html`).
>
> **Estado:** Propuesta de diseño profundizada y boceto interactivo de referencia. **No modifica código de producción** ni altera las decisiones vinculantes de `.agents/CONTEXT.md` (§2.4, §3, §5.2–§5.4, §8, §14 y §16).

---

## 1. Identidad de marca y evolución del ícono

### 1.1 Concepto central

**Upward English — Zorro Explorador** transforma el portal del estudiante Kids (7–10 años obligatorio; 11+ opcional cuando la API habilita `can_switch_interface`) en un **diario de campo / pasaporte de expedición cálido, táctil y sin ansiedad**:

- **Nombre definitivo de la aplicación:** `Upward English` (reemplaza el nombre provisional anterior en cabecera, metadatos, manifiesto PWA e íconos; en la barra de navegación se muestra únicamente el emblema y el nombre, sin subtítulo debajo).
- **Lema principal (hero):** *«Explora, habla y descubre tu inglés»*.
- **Metáfora de progreso sin competencia:** cada actividad asignada es una **«Parada»** en la ruta semanal; los microjuegos viven en el **«Campamento de Microjuegos»** abiertos 24/7 para práctica libre sin calificaciones ni rankings visibles para alumnos; la constancia se registra en una **«Bitácora semanal»** con racha perdonable; el feedback docente llega en formato de **postales selladas con stickers**.

### 1.2 Nuevo ícono de la aplicación: «Brújula Ascendente Upward»

En el boceto inicial, el emblema de cabecera repetía la cabeza del zorro junto al nombre provisional *Englove*. Al consolidar la identidad definitiva de **Upward English**, se separa con claridad el **símbolo de marca** (la aplicación) de la **mascota acompañante** (el Zorro Explorador):

| Elemento | Función en la UI | Motivación de diseño |
| --- | --- | --- |
| **Ícono de marca — «Brújula Ascendente Upward»** | Cabecera (`46×46 px`), favicon (`16–32 px`), ícono PWA (`192 px` / `512 px`), pantalla `/offline` y cabecera de login/registro. | Combina una **flecha-aguja de brújula apuntando decididamente hacia arriba** (*Upward*: ascenso, superación, norte claro) impulsada por un **chevrón de sendero ascendente** sobre el sello **Amarillo Campamento (`#FFCA3A`)** con trazo **Tinta Corteza (`#2B150A` / `#4A2511`)**. Es legible desde `16×16 px` sin depender de detalles faciales diminutos. |
| **Mascota — «Zorro Explorador»** | Acompañante ilustrativo en el hero de `/inicio`, estados vacíos amigables y celebraciones puntuales (sin competir con el logo ni bloquear lectura). | Mantiene el carisma cercano de la propuesta elegida: zorro cálido con **bufanda amarilla de explorador (`#FFCA3A`)** que ahora porta un **pin en miniatura de la flecha ascendente Upward (`#B9251D`)**, unificando marca y mascota en un mismo universo visual. |

#### Anatomía y variantes del ícono «Brújula Ascendente Upward»

```text
  ┌─────────────────────────┐  Contenedor sello: #FFCA3A
  │           ▲             │  Borde: 2px solid #4A2511 · radio 14px
  │          ▲◆▲            │  Sombra táctil: 2px 2px 0 #4A2511
  │         ▲▲▲▲▲           │  Aguja ascendente (Upward): #B9251D + rombo brújula #FFFDF5
  │        ╱  ▲  ╲          │  Chevrón de ruta/ascenso: #C6470B
  │       ╱  ╱ ╲  ╲         │  Trazos geométricos limpios: #2B150A (1.8–1.9px)
  └─────────────────────────┘
```

- **Favicon (`16×16` y `32×32 px`):** elimina el sombreado externo y conserva únicamente el sello `#FFCA3A`, el trazo `#4A2511`, la aguja ascendente `#B9251D` y el chevrón `#C6470B` para máxima nitidez en pestañas.
- **Emblema de cabecera (`46×46 px` dentro de objetivo táctil `>= 48×48 px`):** versión completa con borde `2px solid #4A2511`, sombra sólida `2px 2px 0 #4A2511`, aguja bicolor con brillo crema `#FFFDF5` y chevrón de ruta.
- **Ícono PWA (`192×192` y `512×512 px`, `maskable`):** conserva una zona segura del 15 % alrededor del emblema sobre fondo `#FFCA3A` plano para que Android/iPadOS puedan recortar en círculo o squircle sin cortar la punta ascendente.
- **Modo alto contraste (`forced-colors: active`):** respeta `CanvasText` y `Highlight` sin perder la dirección ascendente de la flecha.

---

## 2. Sistema de tokens de diseño (fiel a la paleta Zorro Explorador)

Todos los valores se organizan como **tokens compartidos** bajo `[data-theme="kids"]` (CONTEXT §8), permitiendo que los mismos componentes cambien a `[data-theme="teens"]` sin duplicar estructura ni romper la arquitectura de tokens existente.

### 2.1 Paleta cromática y verificación WCAG 2.2 AA

| Token CSS | Nombre visual | Hex | Uso principal | Contraste verificado |
| --- | --- | --- | --- | --- |
| `--app-bg` | Pergamino Claro | `#FFF9EC` | Lienzo base de cuaderno de campo | Base cálida |
| `--surface-1` | Papel Blanco | `#FFFFFF` | Tarjetas de actividades, microjuegos, postales y formularios | Base de lectura |
| `--surface-2` | Pergamino Suave | `#FFF2D6` | Botones secundarios, metadatos, barras de estrellas | `#2B150A` sobre `#FFF2D6`: **> 13,5:1 (AAA)** |
| `--surface-featured` | Nota Destacada | `#FFF9E6` | Parada en curso (`mission-card--featured`) | `#2B150A` sobre `#FFF9E6`: **> 14:1 (AAA)** |
| `--surface-hero-start` / `--end` | Sol de Expedición | `#FFF0C4` → `#FFE0A3` | Degradado cálido de la portada del diario (Hero) | `#2B150A` sobre `#FFE0A3`: **12,4:1 (AAA)** |
| `--surface-games-start` / `--end` | Campamento Cálido | `#FFE2B3` → `#FFD494` | Banner del Campamento de Microjuegos | `#2B150A` sobre `#FFD494`: **11,3:1 (AAA)** |
| `--surface-soft-red` | Sello Speaking | `#FFE6E1` / `#FFE2DD` | Franja de pasaporte Speaking y aviso de reintento | `#831712` sobre `#FFE2DD`: **6,7:1 (AA+)** |
| `--surface-soft-orange` | Sello Completar | `#FFECD6` / `#FFE6CC` | Franja de pasaporte Fill in the blanks | `#872E06` sobre `#FFE6CC`: **6,9:1 (AA+)** |
| `--surface-soft-yellow` | Sello Abierta | `#FFF2B3` / `#FFF0B3` | Franja Pregunta abierta, hover de chips, píldora de nivel | `#543200` sobre `#FFF0B3`: **9,4:1 (AAA)** |
| `--surface-soft-exam` | Sello Examen | `#FFEAD5` | Franja Examen calificado | `#6B2809` sobre `#FFEAD5`: **8,5:1 (AAA)** |
| `--ink-1` | Tinta Corteza | `#2B150A` | Títulos, texto principal, trazos del ícono y mascota | Sobre `#FFF9EC`: **14,9:1 (AAA)** · Sobre `#FFFFFF`: **15,7:1 (AAA)** |
| `--ink-2` | Tinta Canela | `#61361F` | Subtítulos, plazos, metadatos secundarios | Sobre `#FFFFFF`: **9,2:1 (AAA)** · Sobre `#FFF9EC`: **8,7:1 (AAA)** |
| `--red` / `--red-hover` | Rojo Brújula | `#B9251D` / `#991D16` | CTA prioritario (continuar/reanudar), aguja del ícono, estado activo TTS | `#FFFFFF` sobre `#B9251D`: **5,9:1 (AA)** |
| `--orange` / `--orange-hover` | Naranja Zorro | `#C6470B` / `#A53906` | Navegación activa, filtro activo, CTA de inicio, chevrón del ícono | `#FFFFFF` sobre `#C6470B`: **4,9:1 (AA)** |
| `--yellow` / `--yellow-hover` | Amarillo Campamento | `#FFCA3A` / `#FFD55C` | Fondo del ícono, botón «Escuchar», estrellas, CTA reintento/práctica | `#2B150A` sobre `#FFCA3A`: **11,7:1 (AAA)** |
| `--border-strong` | Borde Tinta | `#4A2511` | Bordes de tarjetas (`2.5px`), botones (`2px`) y sombras offset sólidas | Sobre `#FFF9EC`: **11,5:1 (AAA)** |
| `--border-dashed` | Costura Pasaporte | `#C78E54` | Separadores punteados (`2px dashed`) en cabecera y sellos de tarjetas | Decorativo estructural (sin texto crítico) |
| `--border-soft` | Borde Arena | `#E8C79B` | Divisores internos suaves y bordes de tablas/listas secundarias | Auxiliar |
| `--focus-ring` | Azul Foco Seguro | `#1D4ED8` | Anillo de foco por teclado (`outline: 3px solid #1D4ED8; outline-offset: 3px`) | Contraste **> 5,8:1** sobre crema/amarillo/blanco (supera mínimo 3:1 de SPEC-09 RF-20) |
| `--status-ok-bg` / `--status-ok-ink` | Sello Confirmado | `#E6F5EA` / `#14532D` | Exclusivamente para confirmación real de guardado en servidor / logro completado | **8,3:1 (AAA)** — se reserva con moderación para no diluir la paleta cálida |

> **Regla de disciplina cromática:** la identidad vive en el trío **Rojo Brújula (`#B9251D`) + Naranja Zorro (`#C6470B`) + Amarillo Campamento (`#FFCA3A`)** sobre **Pergamino Claro (`#FFF9EC`)** y **Tinta Corteza (`#2B150A`)**. Nunca se comunican estados solo por color: siempre se acompañan de ícono y texto explícito.

### 2.2 Textura de cuaderno, bordes y sistema de elevación táctil

La firma táctil de **Zorro Explorador** evita sombras difusas genéricas de SaaS y utiliza **bordes de tinta y desplazamientos sólidos estilo cuaderno ilustrado / sello de pasaporte**:

- **Trama de fondo (`::before` sobre el lienzo):** retícula sutil de puntos de cuaderno de campo (`radial-gradient(rgba(198, 71, 11, 0.08) 1.2px, transparent 1.2px)` cada `24px × 24px`), `pointer-events: none`.
- **Jerarquía de elevación:**
  - **Nivel 0 (plano / secundario):** `border: 1.5px solid #4A2511`, sin sombra (píldoras de nivel, escudo de perdón, celdas de semana).
  - **Nivel 1 (controles de cabecera / chips / TTS):** `border: 2px solid #4A2511`, `box-shadow: 2px 2px 0 #4A2511`.
  - **Nivel 2 (tarjetas de parada, microjuegos, postales, botones CTA):** `border: 2.5px solid #4A2511`, `box-shadow: 4px 4px 0 #4A2511` (en botones: `0 4px 0 #4A2511`, que se comprime a `0 1px 0 #4A2511` + `translateY(2px)` al pulsar).
  - **Nivel 3 (Hero Diario, Bitácora semanal, Banner de juegos):** `border: 2.5px solid #4A2511`, `box-shadow: 5px 5px 0 #4A2511`.
- **Franja de pasaporte (`expedition-strip` / `game-top`):** `border-bottom: 2px dashed #C78E54` para diferenciar inmediatamente el encabezado de tipo/parada del cuerpo de lectura.

### 2.3 Tipografía y reglas de legibilidad

| Rol | Familia | Pesos | Escala recomendada | Reglas de uso |
| --- | --- | --- | --- | --- |
| **Display / Títulos / Botones CTA** | `Bricolage Grotesque` | `700`, `800` | Hero `clamp(1.65rem, 2.7vw, 2.2rem)` · Sección `1.45rem` · Tarjeta `1.22rem` · CTA `1rem` | `letter-spacing: -0.02em`, `line-height: 1.15–1.22`. Nunca usar `ALL-CAPS` en bloques largos ni etiquetas decorativas innecesarias. |
| **Cuerpo / Consignas / Metadatos** | `Nunito` | `600`, `700`, `800` | Base `1rem` (`16px`) · Subtítulos `0.95rem` · Callouts `0.84rem` · Etiquetas `0.78–0.82rem` | `line-height: 1.45–1.55`. Longitud máxima `50–65 ch` en consignas y descripciones. |

- **Idioma y accesibilidad lingüística:** toda la UI en **español de Colombia, claro, cálido y breve** (sin diminutivos excesivos ni mensajes de culpa). Todo texto pedagógico en inglés lleva atributo explícito `lang="en"` para que lectores de pantalla y la síntesis de voz pronuncien correctamente.

### 2.4 Espaciado, radios y puntos de corte

- **Radios:** tarjetas `--radius-card: 22px`; botones y controles `--radius-btn: 14px`; fichas de pasaporte internas `12–14px`; chips y píldoras `999px`.
- **Objetivos táctiles obligatorios (SPEC-09 RF-21):** todo control interactivo del alumno mide al menos **`48 × 48 px CSS`** (`52 px` de alto en botones primarios y en la barra inferior móvil), verificado en `390×844` (móvil), `800×1280` / `820px` (tablet vertical) y `1280×800` (tablet horizontal / escritorio).
- **Puntos de corte:**
  - **Escritorio / Tablet horizontal (`>= 961px`):** contenedor máximo `1140px`, hero `1.55fr / 1fr`, rejilla de paradas en `2 columnas`, microjuegos en `3 columnas`, navegación completa en cabecera.
  - **Tablet vertical (`681px–960px`):** hero apilado `1 columna`, paradas y microjuegos en `2 columnas`, cabecera compacta conservando los 5 destinos visibles y objetivos `>= 48px`.
  - **Móvil (`<= 680px`):** todo en `1 columna`, mascota decorativa del hero oculta para priorizar la primera acción en el primer pantallazo, barra inferior fija (`mobile-bottom-nav`) con objetivos de `52px` de alto y acceso visible a `Perfil` y `Salir` en cabecera.

---

## 3. Arquitectura de navegación y techos de clics

Cumple estrictamente los techos de navegación desde `/inicio` definidos en `CONTEXT.md` §5.2 y `planning/architecture-overview.md` §3.1:

| Zona del portal | Ruta real | Clics desde `/inicio` | Condición de visibilidad |
| --- | --- | --- | --- |
| **Inicio (Ruta de expedición)** | `/inicio` | `0` (actividad asignada a **1–2 clics**) | Siempre visible |
| **Juegos (Campamento de Microjuegos)** | `/juegos` | **1 clic** al catálogo · **2 clics** a jugar | Solo si `flags.games === true` |
| **Progreso (Diario de logros)** | `/progreso` | **1 clic** (historial a **2 clics**) | Siempre visible |
| **Feedback (Postales docentes)** | `/feedback` | **1 clic** a bandeja · **2 clics** al detalle/reintento | Siempre visible |
| **Extra (Mapa de recursos)** | `/extra` | **1 clic** a lista · **2 clics** al recurso externo | Solo si `flags.extra_content === true` |
| **Perfil (Credencial del explorador)** | `/perfil` | **1 clic** desde el chip de perfil en cabecera | Siempre visible |

### Reglas de cabecera y barra móvil

1. **Cabecera sticky (`rgba(255, 249, 236, 0.96)` + `border-bottom: 2px dashed #C78E54`):**
   - Izquierda: emblema **Brújula Ascendente Upward** + nombre `Upward English` (limpio, sin subtítulo debajo).
   - Centro: `Inicio`, `Juegos` (si flag activo), `Progreso`, `Feedback`, `Extra` (si flag activo). El ítem activo usa `Naranja Zorro (#C6470B)`, texto blanco, borde `#4A2511` y sombra `2px 2px 0 #4A2511`.
   - Derecha: píldora de nivel MCER (`Nivel A1`), chip de perfil (`M · Mateo`), botón `Salir` (`48×48px`, hover suave rojo).
2. **Barra inferior móvil (`<= 680px`):**
   - Muestra los destinos activos (`Inicio`, `Juegos`, `Progreso`, `Feedback` y `Extra` cuando el flag está activo, usando rejilla fluida `repeat(auto-fit, minmax(64px, 1fr))`), cada uno con ícono + etiqueta corta de 1 palabra y altura mínima `52px`, evitando menús ocultos anidados.

---

## 4. Catálogo de componentes y estados

### 4.1 Botones táctiles y jerarquía de acción

- **Primario prioritario (`btn--red`, `#B9251D`):** acciones en curso o urgentes (*«Continuar actividad»*, *«Reanudar partida»*, *«Enviar entrega»*).
- **Primario de inicio (`btn--orange`, `#C6470B`):** comenzar una nueva parada o un juego nuevo (*«Empezar actividad»*, *«Jugar»*).
- **Práctica / reintento (`btn--yellow`, `#FFCA3A`, texto `#2B150A`):** volver a practicar o usar un nuevo intento autorizado (*«Intentar de nuevo»*, *«Jugar de nuevo»*).
- **Secundario informativo (`btn--secondary`, `#FFF2D6`, texto `#2B150A`):** consultar entregas ya calificadas, volver atrás o cancelar (*«Ver entrega y feedback»*).
- **Microinteracción CSS pura:** transición `120ms ease-out` sobre `transform` y `box-shadow`; al activar (`:active`), el botón desciende `2px` reduciendo la sombra inferior de `4px` a `2px`. Bajo `prefers-reduced-motion: reduce`, la traslación se elimina y permanece el cambio de color.

### 4.2 Botón «Escuchar» (Texto a Voz — `speech.ts`)

- Disponible en cada título/consigna del tema **Kids** (`48×48px`, fondo `#FFCA3A`, borde `2px solid #4A2511`, sombra `2px 2px 0 #4A2511`).
- Pronuncia en `en-US` para consignas/títulos en inglés y `es-CO` para instrucciones en español.
- Al reproducir cambia a `aria-pressed="true"` (fondo `#B9251D`, ícono blanco) y detiene cualquier lectura previa; al volver a tocar se cancela limpiamente.
- **Degradación honesta:** si el navegador no soporta `speechSynthesis` o no dispone de voces, el botón se oculta sin error y el texto completo permanece siempre legible.

### 4.3 Tiras de estado, calificaciones y estrellas

- **Tira de nota (solo actividades asignadas):** muestra la calificación en escala colombiana **`0,0–5,0`** con un decimal (`4,8 / 5,0`), subtítulo de estado (*«Con sticker y feedback»* / *«Intento anterior»*) y las **0 a 3 estrellas** derivadas en el servidor.
- **Barra de estrellas de práctica (solo microjuegos):** muestra únicamente **0 a 3 estrellas**, conteo de partidas (`4 partidas`, `¡Nuevo!`, `En curso`) y mensaje motivador. **Nunca** muestra nota numérica ni posición de ranking (Decisiones 132 y 137).
- **Callouts de plazo y estado:**
  - *Tolerancia 24 h (`callout--grace`, `#FFF2C2`)*: explica con claridad que iniciar antes del cierre otorga hasta 24 h adicionales para terminar.
  - *Nuevo intento autorizado (`callout--retry`, `#FFE6E3`)*: destaca la nueva fecha límite efectiva (`retry_extend_until`) concedida por la profesora.
  - *Guardado local / sincronización (`callout--offline`, `#FFE6CC`)*: distingue explícitamente *«Guardado en este dispositivo»* frente a *«Respuesta guardada en el servidor»*, sin fingir entrega cuando no hay red.

### 4.4 Banners resilientes y salida en tablet compartida

- **Banner sin conexión (`OfflineStatusBanner`):** barra cálida no bloqueante bajo la cabecera (`#FFE6CC`, borde `2px solid #4A2511`) con ícono de nube/brújula desconectada, contador de respuestas pendientes en cola local y mensaje tranquilizador: *«Sin conexión. Tus respuestas se guardan en este dispositivo y se enviarán al volver la señal.»*
- **Aviso de actualización PWA (`PwaUpdateBanner`):** barra inferior fija no bloqueante (`role="status"`) con botones `>= 48px` *«Reiniciar y actualizar»* y *«Ahora no»* (se omite «Ahora no» solo cuando la API exige `X-App-Min-Version`; se aplaza estrictamente mientras existe un intento `in_progress`).
- **Confirmación de salida en tablet compartida:** si el alumno pulsa `Salir` con trabajo pendiente en IndexedDB tras intentar vaciar hasta 10 s, se muestra un diálogo claro con opción de *«Quedarme y esperar señal»* o *«Salir y limpiar este dispositivo»*, protegiendo la privacidad del siguiente niño que use la tablet (Decisión 122).

---

## 5. Profundización pantalla por pantalla

### 5.1 Inicio — Ruta de Expedición (`/inicio`)

- **Bloque superior (`hero-grid`):**
  - **Portada del Diario (izquierda):** etiqueta `Club Exploradores · Diario A1`, saludo `¡Hola, Mateo!`, lema `«Explora, habla y descubre tu inglés»`, resumen accionable (paradas listas + aviso de feedback nuevo), dos accesos rápidos de `48px` (`Ir al campamento de juegos`, `Ver mi feedback (1 nuevo)`) y la mascota **Zorro Explorador** portando el pin **Upward** en su bufanda.
  - **Bitácora Semanal (derecha):** contador de racha semanal (`4 semanas seguidas`), pista de las 4 semanas con sellos de tinta (`Sem 1`–`Esta`) y estado del **Escudo de perdón** (dos estados claros: *«Escudo de perdón activo esta semana»* o *«Recuperando escudo: 1 de 2 semanas activas»*, sin ansiedad de rachas diarias).
- **Sección `Tu ruta de expedición`:**
  - Chips de filtro con contador (`Todas`, `Por hacer`, `Entregadas`), mínimo `48px` de alto.
  - Rejilla de **2 columnas** en escritorio/tablet (`1 columna` en móvil) con **Paradas numeradas** según el orden real de la ruta semanal y franja superior tipo sello de pasaporte:
    1. **Parada 01 · Speaking (En progreso):** tarjeta destacada (`#FFF9E6`), franja `#FFE2DD`, aviso de tolerancia de 24 h y botón rojo `Continuar actividad`.
    2. **Parada 02 · Completar espacios (`fill_blank`):** franja `#FFE6CC`, límite en hora Colombia y botón naranja `Empezar actividad`.
    3. **Parada 03 · Pregunta abierta (`open_question`):** franja `#FFF0B3`, aviso de reintento habilitado con fecha efectiva, tira de intento anterior (`3,4 / 5,0`) y botón amarillo `Intentar de nuevo`.
    4. **Parada 04 · Examen sellado (`exam`):** franja `#FFEAD5`, tira calificada (`4,8 / 5,0` + 3 estrellas) y botón secundario `Ver entrega y feedback`.

### 5.2 Campamento de Microjuegos (`/juegos`)

- **Banner superior:** identidad *«Campamento de práctica · Abierto 24/7»*, copy claro sin evaluación (*«Juega para practicar inglés a tu ritmo, colecciona estrellas de práctica y repite tantas partidas como quieras»*) y dos píldoras de constancia personal: `Estrellas de práctica (6 / 15)` y `Partidas jugadas (7)`.
- **Catálogo abierto a todos los niveles (Decisión 130):** filtros `Todos`, `Por practicar` y `Jugados` sobre las **5 mecánicas reales** (`Ordenar palabras`, `Memoria`, `Emparejar`, `Arrastrar y soltar`, `Elección con tiempo`), cada una con ícono táctil enmarcado (`52×52px`), insignia de mecánica, nivel MCER orientativo, botón «Escuchar», barra de 0–3 estrellas y CTA de acción.
- **Patrón de interacción híbrida en microjuegos (SPEC-06, Decisión 105):**
  - Todo juego con piezas movibles (`match`, `drag_drop`, `order_words`) soporta simultáneamente: **arrastre (`@atlaskit/pragmatic-drag-and-drop`) + toque/clic en dos pasos (origen → destino) + operación por teclado**, convergiendo en la misma acción de dominio y anunciando cambios en `aria-live="polite"`.
  - El botón de sonido (`sound.ts`, Web Audio API) permite silenciar efectos en cualquier momento sin afectar el juego.

### 5.3 Cuaderno de Campo — Ejecución de Actividad (`/actividad/[attemptId]`)

- **Modo enfocado sin distracciones:** cabecera interna con botón `← Volver a mi ruta`, etiqueta de parada y nivel, barra de progreso por pasos (`Paso 1 de 3`) e indicador honesto de sincronización (*«Guardado en este dispositivo»* / *«Sincronizado con el servidor»*).
- **Consigna guiada:** tarjeta de pregunta con texto claro en español + enunciado en inglés (`lang="en"`) y botón `Escuchar` (`48×48px`).
- **Adaptación por tipo de actividad asignable:**
  - **`fill_blank` y `exam`:** oración con huecos táctiles de alto contraste (`min-height: 48px`), selector accesible con borde `#4A2511` y confirmación visual sin revelar `answer_key`.
  - **`open_question`:** área de escritura amplia (`font-size: 1.05rem`), contador orientativo de palabras y guardado borrador local honesto.
  - **`speaking`:** panel de grabación cálido con botón grande `Grabar audio` (`>= 56×56px`), indicador de tiempo (`00:18 / 02:00`, mínimo `2 s`, máximo configurado hasta `120–300 s`), previsualización de reproducción antes de enviar y estado explícito de subida segura a R2 (*«Audio guardado en este dispositivo · listo para enviar»*).
- **Pie de acción claro:** botones `Anterior`, `Siguiente` y `Entregar actividad` (`52px` de alto), nunca calculando nota en el cliente.

### 5.4 Mi Progreso — Diario de Logros (`/progreso`)

- **Tarjeta de Racha Semanal ampliada:** combina el número de semanas activas consecutivas, la línea de semanas del mes y la explicación visual del **Escudo de perdón** (activo o en recuperación `1/2 semanas`), con tono alentador.
- **Álbum de Sellos e Insignias (`BadgeRule` / `BadgeAward`):** rejilla de pasaporte (`2–3 columnas`) diferenciando con claridad:
  - *Sellos obtenidos:* fondo `#FFFDF5`, borde sólido `2.5px solid #4A2511`, sombra `3px 3px 0 #4A2511`, ícono en medalla `#FFCA3A`, fecha de obtención y texto de logro (*«Primer paso»*, *«Primera voz»*, *«4 semanas en ruta»*).
  - *Próximos sellos por desbloquear:* fondo `#FFF9EC`, borde punteado `2px dashed #C78E54`, ícono atenuado con contraste accesible y meta concreta (*«8 semanas en ruta — te faltan 4 semanas»*).
- **Historial de actividades entregadas:** lista escaneable de entregas calificadas y en revisión, mostrando tipo, fecha, estado (`Calificada` / `En revisión docente`), nota `0,0–5,0` (cuando exista) y acceso directo a la entrega.

### 5.5 Mi Feedback — Postales de tu Profesora (`/feedback`)

- **Encabezado claro:** resume cuántas revisiones nuevas y totales tiene el alumno.
- **Tarjetas tipo postal de expedición:**
  - Cabecera punteada con tipo de actividad, título en inglés (`lang="en"`) y fecha de calificación.
  - **Sello de nota (`0,0–5,0`)** + estrellas (0–3) en la esquina superior derecha.
  - **Bandeja de stickers de la profesora** (hasta 3 stickers del catálogo oficial, presentados como sellos físicos inclinados sutilmente `±2°` — desactivado bajo `prefers-reduced-motion` — con etiqueta textual legible: *«¡Excelente trabajo!»*, *«Gran pronunciación»*, *«Sigue explorando»*).
  - **Comentario personal:** bloque en papel crema `#FFFDF5` con borde izquierdo `#C6470B`, botón «Escuchar comentario» (`es-CO`) y, en actividades `speaking`, acceso a volver a oír la propia grabación mientras esté dentro de retención.
  - **Reintento autorizado (cuando aplica):** callout rojo suave con el plazo efectivo (`retry_extend_until`) y CTA amarillo `Intentar de nuevo`, además de acordeón accesible para consultar intentos anteriores si existen varios.

### 5.6 Contenido Extra — Mapa de Recursos (`/extra`)

- **Visible solo cuando `flags.extra_content === true`** (si está apagado, muestra un estado ilustrado amigable con el Zorro Explorador indicando que la profesora aún está preparando este mapa).
- **Filtrado respetado en servidor (Decisión 125):** muestra recursos generales (`Todos los niveles`) y del nivel vigente del alumno (`Nivel A1`), sin exponer enlaces de otros niveles y **sin iframes**.
- **Tarjetas de recurso externo:** título claro, descripción breve de la profesora, píldora de nivel (`Para todos` o `Nivel A1`), dominio destino visible y botón `Abrir recurso externo ↗` (`target="_blank" rel="noopener noreferrer"`, validación `https:` estricta) que avisa explícitamente que se abrirá una nueva pestaña fuera de Upward English.

### 5.7 Mi Perfil — Credencial de Explorador (`/perfil`)

- **Tarjeta de identidad del alumno:** avatar inicial, nombre (`Mateo`), nivel MCER (`A1`), grupo activo (`A1 · Tarde`), correo de acceso y texto explicativo de solo lectura sobre los datos de contacto del acudiente (editables únicamente por la profesora).
- **Cambio de correo con OTP (Decisión 62):** botón expansible `Cambiar mi correo` con flujo guiado en dos pasos claros: (1) nuevo correo + contraseña actual → (2) ingreso del código OTP de 6 dígitos enviado al correo nuevo, con mensajes de estado claros y sin revelar datos técnicos.
- **Selector de apariencia Kids / Teens (CONTEXT §3):**
  - Para **7–10 años (`can_switch_interface = false`)**: se muestra una ficha informativa amigable indicando que su interfaz activa es **Kids · Zorro Explorador**, sin botón de cambio ni deriva local por edad.
  - Para **11+ años (`can_switch_interface = true`)**: habilita el conmutador táctil entre **Kids (Zorro Explorador)** y **Teens**, recordando que el alumno siempre decide cuándo cambiar.

---

## 6. Estados límite, movimiento, sonido y accesibilidad WCAG 2.2 AA

### 6.1 Matriz de estados obligatorios

| Estado | Tratamiento visual en Zorro Explorador | Tono de copy (es-CO) |
| --- | --- | --- |
| **Carga** | Esqueletos cálidos (`#FFF2D6` con pulso suave desactivable en `reduced-motion`) respetando altura de tarjetas para mantener `CLS <= 0,10`. | *«Preparando tu ruta de hoy…»* |
| **Vacío** | Tarjeta con borde punteado `#C78E54`, mascota Zorro Explorador tranquila y una sola invitación clara a actuar. | *«No tienes paradas pendientes esta semana. Puedes practicar en el Campamento de Microjuegos.»* |
| **Error recuperable** | Tarjeta en `#FFE6E1` con borde `#B9251D`, sin stack traces ni códigos técnicos, y botón `Reintentar` de `52px`. | *«No pudimos cargar tus paradas. Revisa tu conexión e inténtalo de nuevo.»* |
| **Actividad cerrada** | Sello informativo neutro sin culpa, fecha de cierre legible y botón `Volver a mi ruta`. | *«Esta actividad ya cerró. Habla con tu profesora si necesitas una nueva oportunidad.»* |
| **Sin red / cola offline** | Banner cálido no bloqueante + estado honesto por tarjeta/respuesta. | *«Guardado en este dispositivo. Lo enviaremos cuando vuelva tu conexión.»* |
| **Sesión vencida** | Aviso directo y botón único `Volver a iniciar sesión` tras limpiar caché sensible. | *«Tu sesión terminó por seguridad. Inicia sesión otra vez para continuar.»* |

### 6.2 Checklist de calidad WCAG 2.2 AA y ergonomía táctil

- [x] **Contraste de texto y UI:** todo texto normal `>= 4,5:1`, texto grande y bordes/foco `>= 3:1` (ver tabla §2.1).
- [x] **Objetivos táctiles `>= 48 × 48 px CSS`:** aplicado en navegación, chips, botones «Escuchar», acciones de tarjeta, controles de juego y barra móvil (`52px`).
- [x] **Foco visible:** `outline: 3px solid #1D4ED8; outline-offset: 3px` en todo elemento enfocable, más soporte `forced-colors: active`.
- [x] **Alternativa al arrastre:** ningún microjuego depende solo de drag-and-drop ni de hover; toque origen→destino y teclado operan en paridad.
- [x] **Movimiento y audio responsables:** únicamente CSS/Tailwind (`transform`/`opacity`), sin Framer Motion ni Howler.js; `@media (prefers-reduced-motion: reduce)` neutraliza transiciones y rotaciones; el audio es opcional y funciona silenciado.
- [x] **Privacidad y alcance del piloto:** cero rankings visibles para estudiantes, cero calificaciones en microjuegos, cero PII en capturas/logs, cero iframes externos y cero referencias a `Guardian` o consentimientos legales.

---

## 7. Relación con el boceto interactivo HTML

El boceto actualizado en [kids-ui-themed-proposals.html](./kids-ui-themed-proposals.html) refleja todos los cambios definidos en este documento y funciona como **prototipo vivo de revisión** (sin tocar código de producción):

1. Retira por completo la propuesta descartada (*Cohete Sol*) y conserva exclusivamente **Upward English Kids — Zorro Explorador**.
2. Incorpora el nuevo ícono **«Brújula Ascendente Upward»** en la cabecera, el favicon SVG y el modal de *«Identidad, ícono y paleta»* (en escalas `24px`, `46px` y `72px`), además de actualizar la marca a **Upward English** y añadir el pin Upward en la bufanda del Zorro Explorador.
3. Permite recorrer de forma interactiva todas las pantallas profundizadas: **Inicio**, **Juegos** (con mini-demo interactiva de toque origen→destino en *Ordenar palabras*), **Actividad (Cuaderno de campo)**, **Progreso**, **Feedback**, **Extra** y **Perfil**, junto con el simulador de **Escritorio / Tablet / Móvil** y la vista previa de **Estado Sin Red / Aviso PWA**.
