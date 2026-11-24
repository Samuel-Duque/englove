# Upward English — Especificación de Diseño del Panel Docente

> **Alcance del documento:** Especificación integral de diseño UX/UI para el **Panel Docente** (rol `teacher`) de **Upward English** (Decisión 146), evolucionando la identidad visual aprobada del portal Kids (**Zorro Explorador**, [zorro-explorador-diseno.md](./zorro-explorador-diseno.md)) hacia un **entorno de trabajo académico formal, sereno y de alta legibilidad**.
>
> **Estado:** Propuesta de diseño profundizada y documento de referencia para el boceto interactivo [teacher-portal-proposal.html](./teacher-portal-proposal.html). **No modifica código de producción** ni altera las decisiones vinculantes de `.agents/CONTEXT.md` (§2.4, §3–§5.1, §8–§10, §13, §14 y §16).

---

## 1. Continuidad de marca: puente visual Kids → Panel Docente

### 1.1 Principio rector: una sola marca, dos registros de madurez

El portal del estudiante Kids y el Panel Docente pertenecen inequívocamente a la misma plataforma **Upward English**, pero responden a tareas cognitivas distintas:

- **Portal Kids (*Zorro Explorador*):** acompañamiento lúdico y táctil en formato de diario de expedición para niños de 7 a 10 años, priorizando baja carga cognitiva, refuerzo emocional y botones amplios.
- **Panel Docente (*Estudio Editorial Cálido*):** espacio profesional para una profesora que planifica currículo MCER (A1–B2), evalúa audios y textos abiertos, gestiona grupos/aprobaciones y analiza evolución académica en computador o portátil.

La transición **no** rompe la marca con un tema corporativo azul/oscuro ajeno al producto, ni arrastra ornamentos infantiles a un flujo de trabajo serio. Se traduce el **mismo ADN cromático, tipográfico y simbólico** a un lenguaje editorial sobrio:

| Dimensión visual | Portal Kids (*Zorro Explorador*) | Panel Docente (*Estudio Editorial Cálido*) | Qué se preserva (ADN Upward English) |
| --- | --- | --- | --- |
| **Nombre y emblema** | `Upward English` + lema *«Explora tu inglés»* + ícono **Brújula Ascendente Upward** (`46×46 px`, borde `2px`, sombra sólida `2px 2px 0`). | `Upward English` + píldora contextual `Panel Docente` + ícono **Brújula Ascendente Upward** (`38–40 px`, borde `1.5px solid #4A2511`, sombra sutil `0 1px 2px rgba(43,21,10,0.12)`). | Mismo nombre oficial y geometría exacta del ícono de marca. |
| **Mascota e ilustración** | Zorro Explorador presente en portada, vacíos y celebraciones. | **Cero mascota caricaturesca.** Iconografía lineal sobria (`1.5–1.75px`) y jerarquía tipográfica/tabular limpia. | La calidez proviene del papel marfil y la tinta corteza, no de ilustraciones infantiles. |
| **Lienzo y superficies** | Pergamino `#FFF9EC` con trama punteada de cuaderno + franjas punteadas `2px dashed #C78E54`. | Marfil pergamino limpio **`#FCF9F2`** (sin retícula de puntos ni costuras punteadas), tarjetas `#FFFFFF`, encabezados/rieles `#F6EFE4`, avisos suaves `#FFF6E3`. | Familia cromática cálida y lectura descansada de largo aliento. |
| **Bordes y elevación** | Bordes gruesos `2.5px solid #4A2511` y sombras offset sólidas (`4px 4px 0`). | Bordes finos de **`1px solid #E4D5C3`** (`#CBB499` / `#9A7B5C` en controles) y sombras difusas mínimas (`0 1px 3px rgba(43,21,10,0.06)`). | Tinta corteza `#4A2511` reservada exclusivamente para el emblema y acentos de marca. |
| **Acentos de marca** | Uso vibrante en tarjetas, botones 3D y sellos de pasaporte. | Uso con **contención editorial**: `#C6470B` (CTA primario y navegación activa), `#B9251D` (alertas urgentes de revisión y acciones destructivas), `#FFCA3A` / `#FFF1C2` (emblema, etiquetas destacadas y estrellas de práctica). | El mismo trío cromático Upward English aplicado con precisión funcional. |
| **Tipografía** | `Bricolage Grotesque` (700–800) + `Nunito` (600–800). | **`Bricolage Grotesque`** (600–700, títulos sobrios) + **`Plus Jakarta Sans`** (400–700, densidad tabular y formularios con `tabular-nums`). | `Bricolage Grotesque` actúa como puente identitario inmediato entre ambos portales. |
| **Tono verbal (es-CO)** | Cálido, motivador y cercano para niños. | Profesional, directo, preciso y claro; sin tecnicismos innecesarios ni diminutivos. | Español de Colombia claro y respetuoso; contenido pedagógico en inglés con `lang="en"`. |

### 1.2 Tratamiento del ícono «Brújula Ascendente Upward» en el Panel Docente

El emblema oficial heredado de [zorro-explorador-diseno.md](./zorro-explorador-diseno.md) se mantiene intacto en sus trazos y colores, ajustando únicamente su acabado físico a la estética de escritorio profesional:

- **Geometría y paleta inmutables:**
  - Sello contenedor: **Amarillo Campamento (`#FFCA3A`)**.
  - Aguja ascendente de brújula (*Upward*): **Rojo Brújula (`#B9251D`)** con rombo interno crema (**`#FFFDF5`**).
  - Chevrón de ascenso: **Naranja Zorro (`#C6470B`)**.
  - Trazos estructurales internos: **Tinta Corteza (`#2B150A`)**.
- **Acabado en cabecera docente (`38–40 px`):**
  - Radio de esquina refinado (`10 px`), borde nítido **`1.5px solid #4A2511`** y elevación contenida **`0 1px 2px rgba(43, 21, 10, 0.12)`** (se eliminan las sombras sólidas desplazadas tipo cómic).
  - Junto al ícono aparece el logotipo tipográfico **`Upward English`** (`Bricolage Grotesque 700`, `#2B150A`) acompañado de la etiqueta discreta **`Panel Docente`** (`#5E3E2C` sobre `#F6EFE4` con borde `1px solid #E4D5C3`).
- **Favicon (`16×16` y `32×32 px`) y PWA (`192 px` / `512 px`):** comparte el mismo ícono SVG unificado de la plataforma para que tanto profesora como alumnos reconozcan la pestaña y la aplicación instalada de inmediato.

---

## 2. Sistema de tokens del panel docente

Los tokens se declaran en `:root` (y bajo el ámbito del layout docente cuando convivan en producción con `[data-theme="kids"]` / `[data-theme="teens"]`) para garantizar herencia completa incluso dentro de elementos nativos en *top-layer* como `<dialog>`.

### 2.1 Paleta cromática formalizada y contraste WCAG 2.2 AA

Todos los pares de color han sido verificados matemáticamente según la fórmula de luminancia relativa de WCAG 2.2:

| Token CSS | Nombre visual | Hex | Uso principal en el Panel Docente | Contraste verificado |
| --- | --- | --- | --- | --- |
| `--bg-canvas` | Marfil Pergamino | `#FCF9F2` | Lienzo base de la aplicación (limpio, sin trama de puntos) | Base cálida |
| `--surface-card` | Papel Blanco | `#FFFFFF` | Tarjetas principales, tablas de datos, inspector de revisión, modales | Base de lectura |
| `--surface-subtle` | Lino Cálido | `#F6EFE4` | Barra lateral/rieles, encabezados de tabla (`thead`), áreas de filtro, píldoras neutras | `#2B150A` sobre `#F6EFE4`: **15,14:1 (AAA)** |
| `--surface-callout` | Pergamino Nota | `#FFF6E3` | Callouts informativos, avisos de confidencialidad docente, bloques de práctica en juegos | `#2B150A` sobre `#FFF6E3`: **16,09:1 (AAA)** |
| `--ink-primary` | Tinta Corteza | `#2B150A` | Títulos, encabezados de tabla, datos principales, cifras KPI y notas | Sobre `#FFFFFF`: **17,29:1 (AAA)** · Sobre `#FCF9F2`: **16,45:1 (AAA)** |
| `--ink-secondary` | Tinta Nogal | `#5E3E2C` | Subtítulos, descripciones, etiquetas de formulario, metadatos de tabla | Sobre `#FFFFFF`: **9,54:1 (AAA)** · Sobre `#FCF9F2`: **9,07:1 (AAA)** · Sobre `#F6EFE4`: **8,35:1 (AAA)** |
| `--ink-muted` | Tinta Canela | `#61361F` | Etiquetas contextuales, pies de nota, marcas de tiempo y texto auxiliar | Sobre `#FFFFFF`: **10,22:1 (AAA)** · Sobre `#FCF9F2`: **9,72:1 (AAA)** |
| `--border-hairline` | Borde Pergamino | `#E4D5C3` | Divisores estructurales `1px` de tarjetas, filas de tabla y secciones | Estructural (decorativo) |
| `--border-strong` | Borde Arena | `#CBB499` | Enmarcado de bloques interactivos en reposo y hover suave | Estructural secundario |
| `--border-control` | Borde Control AA | `#9A7B5C` | Borde de inputs, `<select>`, `<textarea>` y checkboxes en reposo (WCAG 1.4.11) | Sobre `#FFFFFF`: **3,92:1 (AA UI ≥ 3:1)** |
| `--border-brand` | Borde Corteza | `#4A2511` | Borde del emblema `1.5px` y marcas de énfasis institucional | Sobre `#FCF9F2`: **12,77:1 (AAA)** |
| `--accent-primary` / `-hover` | Naranja Zorro | `#C6470B` / `#A53906` | Botón CTA primario, ítem activo de navegación, pestaña activa, enlaces principales | `#FFFFFF` sobre `#C6470B`: **4,88:1 (AA)** · sobre `#A53906`: **6,59:1 (AA+)** |
| `--accent-primary-soft` | Terracota Suave | `#FFF0DE` | Fondo suave de navegación activa o selección de fila/elemento (`--ink` `#872E06`) | `#872E06` sobre `#FFF0DE`: **7,74:1 (AAA)** |
| `--accent-danger` / `-hover` | Rojo Brújula | `#B9251D` / `#991D16` | Contadores urgentes de revisión pendiente, alertas críticas y acciones destructivas | `#FFFFFF` sobre `#B9251D`: **6,28:1 (AA+)** · sobre `#991D16`: **8,26:1 (AAA)** |
| `--accent-danger-soft` | Carmín Suave | `#FDECE9` | Fondo de avisos de error, entregas atrasadas, cuentas bloqueadas o peligro (`--ink` `#831712`) | `#831712` sobre `#FDECE9`: **8,75:1 (AAA)** |
| `--accent-warm` / `-soft` | Amarillo Campamento | `#FFCA3A` / `#FFF1C2` | Fondo del ícono de marca, estrellas de práctica en juegos, etiquetas de recordatorio (`--ink` `#543200`) | `#2B150A` sobre `#FFCA3A`: **11,33:1 (AAA)** · `#543200` sobre `#FFF1C2`: **10,15:1 (AAA)** |
| `--status-ok-ink` / `-bg` | Verde Académico | `#166534` / `#E6F5EA` | Estados aprobados, actividades publicadas, intentos calificados y tendencia positiva | `#166534` sobre `#E6F5EA`: **6,32:1 (AA+)** |
| `--focus-ring` | Azul Foco Seguro | `#1D4ED8` | Anillo de foco por teclado (`outline: 3px solid #1D4ED8; outline-offset: 2px`) | Sobre `#FCF9F2`: **6,37:1** · Sobre `#FFFFFF`: **6,70:1** · Sobre `#F6EFE4`: **5,87:1** |

> **Disciplina cromática del panel:** las superficies neutras (`#FCF9F2`, `#FFFFFF`, `#F6EFE4`) cubren más del 85 % del área visual. El color de marca se reserva para señalizar jerarquía de acción (`#C6470B`), prioridad operativa (`#B9251D`), estado validado (`#166534`) y acento identitario (`#FFCA3A`). Ningún estado depende únicamente del color: siempre incluye etiqueta textual e ícono o marcador semántico.

### 2.2 Superficies, bordes y elevación sobria

Se abandonan las sombras sólidas desplazadas de Kids en favor de una elevación laminar y silenciosa:

- **Nivel 0 (plano integrado):** fondo `#F6EFE4`, `border: 1px solid #E4D5C3`, `box-shadow: none` — barras de filtros, encabezados de tabla, contenedores de resumen contextual.
- **Nivel 1 (tarjeta de datos / panel principal):** fondo `#FFFFFF`, `border: 1px solid #E4D5C3`, `box-shadow: 0 1px 3px rgba(43, 21, 10, 0.06)`, `border-radius: 12px` — tarjetas KPI, tablas, columnas del split-view de revisión, formularios.
- **Nivel 2 (panel elevado / menú / diálogo modal):** fondo `#FFFFFF`, `border: 1px solid #CBB499`, `box-shadow: 0 6px 20px rgba(43, 21, 10, 0.08)`, `border-radius: 14px` — modales de confirmación crítica, paneles deslizantes de creación rápida y avisos PWA.
- **Controles de entrada:** `border: 1px solid #9A7B5C` en reposo, `#4A2511` en hover, `outline: 3px solid #1D4ED8; outline-offset: 2px` en `:focus-visible`.

### 2.3 Tipografía y precisión numérica (`tabular-nums`)

| Rol tipográfico | Familia | Pesos | Escala recomendada | Reglas de uso |
| --- | --- | --- | --- | --- |
| **Títulos de página y marca** | `Bricolage Grotesque` | `600`, `700` | `H1`: `1.625rem` (26 px) · `H2`: `1.1875rem` (19 px) · `H3`: `1rem` (16 px) · Marca: `1.125rem` (18 px) | `letter-spacing: -0.015em`, `line-height: 1.2`. Sin pesos excesivos (`800+`) ni mayúsculas forzadas en encabezados largos. |
| **Cuerpo, tablas, formularios y UI** | `Plus Jakarta Sans` | `400`, `500`, `600`, `700` | Cuerpo: `0.9375rem` (15 px) · Tabla/controles: `0.875rem` (14 px) · Metadatos/badges: `0.75rem–0.8125rem` (12–13 px) | `line-height: 1.45–1.55`. Optimizada para lectura sostenida de respuestas abiertas, rúbricas y tablas densas. |
| **Cifras académicas y métricas** | `Plus Jakarta Sans` (`font-variant-numeric: tabular-nums`) | `600`, `700` | KPI: `1.5rem–1.75rem` · Nota destacada: `1.5rem` · Celdas de tabla: `0.875rem` | **Obligatorio** en calificaciones `0,0–5,0`, conteos de pendientes, porcentajes de cumplimiento, duraciones (`mm:ss` / `Xh Ym`), fechas y puestos de rankings privados. |

- **Formato local colombiano:** decimales con coma (`4,6 / 5,0`), fechas y horas evaluadas y formateadas explícitamente en zona horaria **`America/Bogota`**.
- **Atributo de idioma pedagógico:** todo enunciado, instrucción o respuesta en inglés dentro de actividades, exámenes o entregas lleva `lang="en"`.

### 2.4 Densidad, espaciado y puntos de corte

- **Espaciado base:** escala modular de `4px` (`8 / 12 / 16 / 20 / 24 / 32 px`). Relleno de tarjetas principales `20–24 px`; celdas de tabla `12 px` vertical × `16 px` horizontal para equilibrar densidad de escritorio con legibilidad.
- **Radios refinados:** tarjetas `12 px`, botones e inputs `8–10 px`, badges de estado `6 px` o píldora `999px` (para contadores y nivel MCER), modales `14 px`.
- **Objetivos interactivos:** controles primarios y botones de acción con altura mínima `40–44 px` en escritorio (`48 × 48 px` en vista tablet/táctil y en controles clave de `Contenido Extra` y modales, superando holgadamente el mínimo `24 × 24 px` de WCAG 2.2 SC 2.5.8).
- **Puntos de corte objetivo:**
  - **Escritorio (`>= 1280px`, referencia `1440×900`):** barra lateral fija de `248 px` (`#F6EFE4`, borde derecho `1px solid #E4D5C3`) + área principal fluida con ancho máximo útil `1200 px`; split-view de revisión en proporción `42% / 58%` (`5 / 7` columnas); tablas completas sin recorte.
  - **Portátil (`1024px–1279px`, referencia `1280×800`):** barra lateral compacta `224 px` o barra superior unificada + split-view `44% / 56%`; KPIs en rejilla de 3–4 columnas.
  - **Tablet (`768px–1023px`, referencia `820×1080`):** navegación superior colapsada en rejilla limpia accesible (o cajón lateral con botón `>= 48px`), split-view de revisión apilado con conmutador rápido entre cola y detalle, tablas dentro de contenedor con desplazamiento horizontal controlado (`overflow-x: auto` sin romper el viewport de página).

---

## 3. Arquitectura de navegación docente

### 3.1 Mapa de rutas reales del panel

El diseño refleja exactamente las rutas implementadas en `apps/web/src/components/teacher-nav.tsx`, `apps/web/src/app/inicio/` y `apps/web/src/app/(teacher)/`:

| Sección visible | Ruta real principal | Rutas hijas / alias reales | Propósito operativo |
| --- | --- | --- | --- |
| **Inicio** | `/inicio` | — *(dashboard docente cuando `role === 'teacher'`)* | Recordatorios prioritarios (solicitudes y entregas atrasadas), resumen de grupos activos y accesos rápidos. |
| **Actividades** | `/actividades` | `/actividades/nueva`, `/actividades/[id]`; alias `/contenidos` → `/actividades`, `/contenidos/onboarding` → `/actividades/nueva` | Catálogo MCER (A1–B2) de los 5 tipos de actividad, edición, duplicado, archivo y creación guiada (< 10 min). |
| **Asignaciones** | `/asignaciones` | `/asignaciones/nueva`, `/asignaciones/[id]` | Programación a grupos (solo 4 tipos asignables; nunca `game`), seguimiento de cumplimiento y cancelación definitiva. |
| **Revisión** | `/revision` | — *(split-view maestro-detalle en una sola vista)* | Cola de calificación manual (`speaking`, `open_question`), historial de calificados, stickers y habilitación de nuevo intento. |
| **Alumnos** | `/alumnos` | `/alumnos/solicitudes`, `/alumnos/bloqueados`, `/alumnos/[id]` | Directorio de alumnos activos, bandeja `pending_approval`, desbloqueo de cuentas y ficha integral del estudiante. |
| **Grupos** | `/grupos` | `/grupos/[id]` *(también enlazable como sub-vista dentro de Alumnos y Grupos)* | Creación, renombrado, consulta de miembros vigentes y archivo seguro de grupos sin alumnos activos. |
| **Estadísticas** | `/estadisticas` | `/estadisticas/estudiantes/[id]` | Rendimiento y constancia por organización, grupo y estudiante, Práctica en juegos y rankings privados. |
| **Contenido extra** | `/contenido-extra` | — | Gestión de enlaces externos `https://` fuera de calificación, ordenamiento Subir/Bajar y conmutador de visibilidad `extra_content`. |

> **Nota sobre agrupación en navegación:** en el código actual `Grupos` y `Alumnos` aparecen como enlaces de primer nivel en `TeacherNav` (8 ítems totales). En una barra lateral vertical de escritorio los 8 destinos caben con total holgura en dos grupos semánticos claros: **Docencia** (`Inicio`, `Actividades`, `Asignaciones`, `Revisión`) y **Gestión y seguimiento** (`Alumnos`, `Grupos`, `Estadísticas`, `Contenido extra`). En pantallas compactas o en la propuesta consolidada de 7 vistas principales, `Grupos` puede integrarse como sub-pestaña de `Alumnos y Grupos` conservando su ruta directa `/grupos`.

### 3.2 Estructura de cabecera y barra lateral

1. **Barra lateral izquierda (escritorio/portátil):**
   - Cabecera de marca: emblema **Brújula Ascendente Upward** (`38×38 px`), texto **`Upward English`** y subtítulo/píldora **`Panel Docente`**.
   - Lista de navegación vertical con ícono lineal (`18px`), etiqueta en español y **contadores discretos** únicamente donde exigen acción inmediata: `Revisión` (badge `#B9251D` sobre `#FDECE9` cuando existen pendientes) y `Alumnos` (badge `#543200` sobre `#FFF1C2` cuando hay solicitudes `pending_approval` o cuentas bloqueadas).
   - Ítem activo: fondo `#FFF0DE`, texto `#872E06` (`700`), indicador lateral izquierdo `3px solid #C6470B` y `aria-current="page"`.
   - Pie de barra lateral: perfil de la profesora (nombre + rol `Profesora · Organización piloto`) y botón sobrio **`Cerrar sesión`** que ejecuta la limpieza completa de sesión y caché (`logoutSharedDevice()`).
2. **Franja superior del espacio de trabajo (top utility bar):**
   - Migas de pan (*breadcrumbs*) en vistas de detalle (`/alumnos/[id]`, `/estadisticas/estudiantes/[id]`, `/actividades/[id]`).
   - **Indicador de actualización por polling (cada 30 s):** píldora sutil en las vistas con refresco automático (`/revision`, `/estadisticas` y `/estadisticas/estudiantes/[id]`) que muestra un punto verde `#166534`, la hora exacta de última actualización en `America/Bogota` (*«Actualizado 14:32:10 · cada 30 s»*) y un botón manual **`Refrescar`**. Nunca afirma «tiempo real» por WebSockets (exclusión explícita de `CONTEXT.md` §2.4).

### 3.3 Avisos PWA no bloqueantes e higiene de sesión

- **Aviso de nueva versión PWA (`PwaUpdateBanner`):** barra inferior o superior fija no bloqueante (`role="status"`, superficie `#FFF6E3`, borde `1px solid #CBB499`, sombra Nivel 2) con el mensaje *«Hay una nueva versión de Upward English disponible.»* y dos acciones: botón primario **`Reiniciar y actualizar`** (`#C6470B`) y botón secundario **`Ahora no`** (omitido únicamente si el backend exige actualización mínima mediante cabecera `X-App-Min-Version`). Nunca interrumpe ni borra un formulario de calificación o edición en curso sin confirmación de la profesora.
- **Aviso sin conexión (`OfflineStatusBanner`):** franja sobria en `#FFF0DE` con borde `#C6470B` cuando se pierde conectividad, informando honestamente que los cambios del panel requieren conexión con el servidor para guardarse.
- **Seguridad y rol:** la redirección de `proxy.ts` es solo de experiencia; toda vista consume la API de NestJS mediante TanStack Query, que aplica autenticación por cookies `httpOnly`, RBAC estricto (`teacher`) y aislamiento por `organization_id`.

---

## 4. Catálogo de componentes formales

### 4.1 Tablas de datos editoriales

- **Estructura:** contenedor `#FFFFFF` con `border: 1px solid #E4D5C3`, `border-radius: 12px`, `overflow: hidden` y envoltorio interno `overflow-x: auto` para tablet/portátil estrecho.
- **Encabezado (`thead`):** fondo `#F6EFE4`, texto `#5E3E2C` (`0.75rem`, peso `700`, `letter-spacing: 0.03em`), borde inferior `1px solid #E4D5C3`. Las columnas ordenables incluyen botón nativo dentro del `<th>` con `aria-sort` y flecha discreta (`↑` / `↓`).
- **Filas (`tbody`):** separador `1px solid #E4D5C3`, hover sutil `#FCF9F2`, altura de fila cómoda (`>= 48px`) y alineación derecha con `tabular-nums` para notas, porcentajes, conteos y duraciones.
- **Celdas de acción:** enlaces directos en `#C6470B` (`hover: #A53906`, subrayado al pasar o enfocar) o botones secundarios con borde `#9A7B5C`.

### 4.2 Badges y etiquetas de estado

Todos los badges combinan texto conciso + indicador visual (punto o ícono) y garantizan contraste `>= 4,5:1`:

| Categoría | Estado | Fondo | Texto | Borde | Uso |
| --- | --- | --- | --- | --- | --- |
| **Actividades** | `Publicada` | `#E6F5EA` | `#166534` | `#B7DFC2` | Disponible para asignar (o abierta 24/7 si es `game`). |
| **Actividades** | `Borrador` | `#F6EFE4` | `#5E3E2C` | `#E4D5C3` | Editable y eliminable si no tiene asignaciones. |
| **Actividades** | `Archivada` | `#FFF1C2` | `#543200` | `#E5C97B` | Oculta del catálogo activo; restaurable sin cancelar asignaciones. |
| **Asignaciones** | `Abierta` | `#E6F5EA` | `#166534` | `#B7DFC2` | Dentro de `[opens_at, due_at]` y no cancelada. |
| **Asignaciones** | `Programada` | `#FFF0DE` | `#872E06` | `#E7C099` | Aún antes de `opens_at`. |
| **Asignaciones** | `Cerrada` | `#F6EFE4` | `#5E3E2C` | `#E4D5C3` | Superó `due_at`. |
| **Asignaciones** | `Cancelada` | `#FDECE9` | `#831712` | `#EABCB5` | Revocada definitivamente (`cancelled_at` no nulo). |
| **Revisión** | `Por revisar` / `Atrasada` | `#FDECE9` | `#831712` | `#EABCB5` | Intento `pending_review` esperando calificación manual. |
| **Revisión** | `Calificada` | `#E6F5EA` | `#166534` | `#B7DFC2` | Intento `graded` con nota inmutable `0,0–5,0`. |
| **Estudiantes** | `Pendiente de aprobación` | `#FFF1C2` | `#543200` | `#E5C97B` | Auto-registro `pending_approval` esperando nivel y grupo. |
| **Estudiantes** | `Bloqueada (10 min)` | `#FDECE9` | `#831712` | `#EABCB5` | Cuenta bloqueada tras 10 intentos fallidos consecutivos. |
| **Constancia** | `Activa` / `Perdón aplicado` | `#E6F5EA` / `#FFF1C2` | `#166534` / `#543200` | `#B7DFC2` / `#E5C97B` | Semanas ISO en calendario de constancia del alumno. |

### 4.3 Reproductor de audio `Speaking` con descarga y retención de 30 días

Componente especializado del inspector de `/revision` para entregas `ActivityType.speaking`:

- **Contenedor:** superficie `#FFF6E3`, borde `1px solid #E4D5C3`, `border-radius: 10px`, relleno `16px`.
- **Cabecera del reproductor:** título *«Grabación de Speaking»*, metadatos en `tabular-nums` (duración validada por `ffprobe` en servidor, p. ej. `00:42 / 02:00`, formato `MP4/AAC`) y botón secundario **`Descargar audio`** (`GET /api/v1/media/:id/download-url`, URL firmada de corta duración en Cloudflare R2).
- **Controles de reproducción:** botón reproducir/pausar (`40×40 px`, `#C6470B`), visualización sobria de barras de progreso o `<audio controls>` nativo accesible con tiempo transcurrido/total (`tabular-nums`) y control de velocidad opcional del navegador.
- **Aviso de retención obligatoria (Decisión 27):** línea informativa persistente bajo el reproductor indicando la fecha exacta de expiración en R2: *«Retención en la nube: disponible hasta 30 días después de calificar (`retention_until`). La nota y el comentario se conservan tras la eliminación del archivo.»*
- **Estados degradados explícitos:**
  - *Fallback de transcodificación:* si `compatibilityWarning` es verdadero (conversión `ffmpeg` falló tras 3 intentos y se entrega el archivo original), muestra callout suave `#FFF1C2`: *«El audio original no pudo convertirse a MP4 estándar. Si tu navegador no lo reproduce directamente, usa el botón Descargar audio.»*
  - *Audio expirado (`status === 'deleted'`):* reemplaza el reproductor por una nota serena en `#F6EFE4`: *«El audio cumplió los 30 días de retención tras la calificación y fue eliminado automáticamente de la nube.»*

### 4.4 Selector de stickers oficiales (máximo 3 de 6)

Mapea exactamente el catálogo cerrado de `packages/shared/src/api/reviews.ts` (Decisión 108):

| Código (`StickerCode`) | Etiqueta oficial en UI | Ícono |
| --- | --- | --- |
| `great_job` | ¡Excelente trabajo! | 🌟 |
| `good_pronunciation` | ¡Muy buena pronunciación! | 🎙️ |
| `creative_answer` | ¡Respuesta muy creativa! | 💡 |
| `grammar_star` | ¡Estrella de la gramática! | 📚 |
| `super_effort` | ¡Súper esfuerzo! | 🚀 |
| `keep_practicing` | ¡Sigue practicando! | 💪 |

- **Presentación formal:** rejilla de `3 columnas × 2 filas` en escritorio (`2 columnas` en tablet) con botones `type="button"` y `aria-pressed="true|false"`.
- **Estado seleccionado:** borde `1.5px solid #C6470B`, fondo `#FFF0DE`, texto `#2B150A` (`600`) y marca discreta de verificación; contador explícito **`Seleccionados: X / 3`** en la cabecera del campo.
- **Límite sin frustración:** al alcanzar 3 stickers, los 3 botones restantes muestran estado visual atenuado y un aviso en `aria-live="polite"` si la profesora intenta elegir un cuarto (*«Puedes seleccionar hasta 3 stickers por revisión.»*), sin bloquear deseleccionar alguno de los activos.

### 4.5 Calificación `0,0–5,0` e inmutabilidad tras revisión

- **En intento `pending_review`:** campo numérico de entrada (`inputMode="decimal"`, ancho compacto `120 px`, tipografía `1.125rem` `700` `tabular-nums`) con etiqueta `Calificación (0,0 – 5,0)`, ayuda contextual *«Acepta un decimal (ej. 4,5). Umbral de aprobación: 3,0.»* y vista previa orientativa de aprobación/estrellas (el cálculo definitivo de estrellas siempre proviene del servidor).
- **En intento `graded` (Decisión 109):** el campo deja de ser editable y se reemplaza por un **sello de calificación inmutable** en `#F6EFE4` con borde `#E4D5C3`, ícono de candado sobrio, nota en `tabular-nums` (`4,6 / 5,0`) y microcopy: *«Calificación bloqueada tras la primera revisión. Puedes actualizar el comentario y los stickers en cualquier momento.»*
- **Validación de comentario (Decisión 84):** el área de retroalimentación (`maxLength={2000}`, con contador en vivo `X / 2000`) muestra indicador **`Obligatorio`** en `open_question` y `speaking`, y **`Opcional`** en `fill_blank` y `exam`.

### 4.6 Conmutador «Habilitar nuevo intento» y `retry_extend_until`

Disponible únicamente en actividades asignables (`fill_blank`, `open_question`, `speaking`, `exam`); nunca en microjuegos (`game`, Decisión 111):

- **Estado base:** bloque en `#FCF9F2` con borde `1px solid #E4D5C3`, título *«Habilitar nuevo intento»*, subtítulo *«Autoriza un intento adicional (#N+1) para este estudiante en esta asignación.»* y conmutador accesible (`role="switch"` o checkbox estilizado con foco `#1D4ED8`).
- **Al activarse:** despliega el campo opcional **`Extender fecha límite hasta (hora Colombia)`** (`datetime-local`, mapeado a `retry_extend_until`, Decisión 61).
- **Regla de advertencia en vivo:** si la fecha `due_at` original de la asignación ya venció y `retry_extend_until` permanece vacío, aparece inmediatamente una alerta en `#FFF1C2` con texto `#543200`: *«La asignación ya cerró. Si no defines una nueva fecha límite, el estudiante no podrá iniciar este nuevo intento.»*
- **Estado ya concedido (`retryGrantedAt !== null`):** reemplaza el conmutador por una píldora verde `#E6F5EA` / `#166534` (*«Nuevo intento habilitado · límite efectivo: DD/MM/AAAA HH:mm»*), evitando conceder una segunda habilitación sin consumir la vigente.

### 4.7 Diálogos de confirmación crítica

Todos los diálogos críticos usan `<dialog>` o modal accesible con foco atrapado, cierre por `Escape` (deshabilitado solo durante mutación en curso) y botón de acción destructiva en `#B9251D`:

1. **Traslado de grupo con pérdida definitiva de reintentos (Decisiones 131 y 144):**
   - Se dispara cuando `PUT /api/v1/students/:id/group` devuelve `UNCONSUMED_RETRY_WARNING`.
   - Muestra el listado exacto de `affectedActivities` (título de actividad + número de intento) y advierte de forma inequívoca que las autorizaciones pendientes se revocarán de manera definitiva e irreversible dentro de la misma transacción, incluso si el alumno regresara luego al grupo anterior.
   - Botones: **`Cancelar`** y **`Confirmar traslado definitivo`** (`confirmLostRetries: true`).
2. **Cambio administrativo de correo del alumno (Decisiones 63 y 92):**
   - Muestra el correo actual (solo lectura), input para el nuevo correo (validación de unicidad global `EMAIL_TAKEN`), **casilla obligatoria desmarcada por defecto**: *«Confirmo que verifiqué la identidad del alumno fuera de la plataforma.»*
   - Nota explícita de efectos: revoca todas las sesiones activas del alumno, envía notificación al correo nuevo y al anterior, y registra el evento en `AuditLog` (`student_email_changed`). El botón **`Confirmar cambio de correo`** permanece deshabilitado hasta marcar la casilla e ingresar un correo válido.
3. **Cancelación definitiva de asignación (Decisión 98):**
   - Explica que la asignación **no se borra**: bloquea nuevos inicios y habilitaciones pendientes, permite concluir los intentos ya iniciados dentro de su ventana (`cierre efectivo + 24 h`), conserva notas/feedback/audios y la excluye del denominador de cumplimiento. Acción irreversible.
4. **Baja definitiva de estudiante (Decisión 103):**
   - Zona de peligro en la ficha `/alumnos/[id]`. Enumera en lista concisa los 4 efectos atómicos (congelación de `historical_student_count`, anonimización/redacción de correos en `AuditLog`, borrado de audios en Cloudflare R2 y cascada completa de usuario/intentos) y exige escribir exactamente **`ELIMINAR`** para habilitar **`Confirmar baja definitiva`**.

---

## 5. Profundización pantalla por pantalla

### 5.1 Inicio / Resumen operativo y recordatorios (`/inicio`)

*(Nota de rutas: la pantalla inicial del docente vive en `/inicio`; las rutas legadas `/contenidos` y `/contenidos/onboarding` redirigen a `/actividades` y `/actividades/nueva`, respectivamente.)*

- **Encabezado sobrio:** saludo contextual (*«Buen día, Prof. Camila»*), fecha actual en `America/Bogota`, botón primario **`+ Nueva actividad`** (`/actividades/nueva`) y píldora de estado de actualización automática cada `30 s` (sin WebSockets).
- **Franja de recordatorios prioritarios (Decisiones 42 y 110):** dos tarjetas minimalistas en rejilla `2 columnas` alimentadas por `/api/v1/dashboard/reminders`:
  1. **Solicitudes de registro pendientes:** contador grande en `tabular-nums`, estado visual en `#FFF6E3` / borde `#C6470B` si `> 0` (neutro en `#FFFFFF` con check verde si `0`) y enlace directo **`Revisar solicitudes →`** (`/alumnos/solicitudes`).
  2. **Entregas sin calificar (`> N días`, `N = 3` configurable):** contador medido desde el cierre efectivo (`effectiveDueAt`), acento `#B9251D` sobre `#FDECE9` cuando hay atraso, nota discreta del resumen automático por correo cada 3 días (solo enviado cuando hay pendientes) y enlace directo **`Ir a revisión →`** (`/revision`).
- **Resumen operativo de grupos activos:** tabla compacta con columnas `Grupo`, `Nivel principal`, `Alumnos activos`, `Asignaciones abiertas`, `Cumplimiento reciente` y acción `Ver grupo →` (`/grupos/[id]`).
- **Accesos rápidos secundarios:** tarjetas limpias de 1 línea hacia `Asignaciones`, `Catálogo de Actividades`, `Alumnos`, `Estadísticas` y `Contenido extra` para llegar en 1 clic a cualquier flujo diario.

### 5.2 Gestor de Actividades (`/actividades`, `/actividades/nueva`, `/actividades/[id]`)

- **Barra de herramientas superior:** título *«Catálogo de Actividades»*, subtítulo de alcance curricular MCER (`A1–B2`) y botón primario **`+ Crear actividad`** (`/actividades/nueva`).
- **Filtros estructurados en superficie `#F6EFE4`:**
  - Segmentador de estado: **`Catálogo activo`** (publicadas + borradores) y **`Archivadas`**.
  - Selector de **Tipo de actividad** con los **5 valores oficiales de `ActivityType`** (Decisión 66):
    1. `fill_blank` — **Completar espacios** *(calificación automática)*
    2. `open_question` — **Pregunta abierta** *(revisión manual)*
    3. `speaking` — **Expresión oral (Speaking)** *(audio en R2 + revisión manual; mínimo 2 s, defecto 120 s, tope 300 s)*
    4. `game` — **Microjuego** *(calificación automática + estrellas de práctica; muestra su **`GameMechanic`** entre las 5 mecánicas: `match`, `order_words`, `drag_drop`, `memory`, `timed_choice`)*
    5. `exam` — **Examen** *(mínimo 2 ítems `fill_blank`, pesos normalizados proporcionalmente al 100 %, ítem sin responder = 0)*
  - Selector de **Nivel MCER**: `Todos`, `A1`, `A2`, `B1`, `B2`.
- **Tabla de catálogo:** columnas `Título` (en inglés `lang="en"`), `Tipo / Mecánica`, `Nivel`, `Estado`, `Duración esperada` (`tabular-nums`), y acciones contextuales (`Editar`, `Duplicar`, `Archivar` / `Restaurar`, y `Eliminar` habilitado únicamente para borradores sin asignaciones). Nota aclaratoria: archivar una actividad no cancela sus asignaciones existentes (Decisión 95).
- **Experiencia de creación y edición — Objetivo onboarding `< 10 minutos` (CONTEXT §5.1):**
  - Paso 1 claro: elección visual en tarjetas sobrias de los 5 tipos de actividad (si se elige `game`, selector inmediato de una de las 5 mecánicas con descripción de 1 línea).
  - Paso 2 en una sola página sin pasos burocráticos: metadatos esenciales (`Título`, `Nivel MCER`, `Duración esperada`) y **constructor estructurado sin JSON crudo**:
    - En **`fill_blank` y `exam`**: editor multi-oración (`items[]`) y multi-hueco (`blanks[]`) con opciones dinámicas (`>= 2`) preservando estrictamente los UUIDs existentes (`item.id`, `blank.id`, `option.id`) al editar (Decisión 140). En `exam`, barra lateral o pie que muestra en tiempo real la normalización automática de pesos al `100 %` y bloquea publicar con menos de 2 ítems.
    - En **`speaking`**: enunciado (`lang="en"`), rúbrica guía para revisión y selector de duración máxima (`120 s` por defecto, tope `300 s`).
    - En **`open_question`**: consigna y rúbrica / respuesta modelo opcional.
    - En **`game`**: formulario tipado por mecánica respaldado por esquemas Zod de `packages/shared`.
  - Pie fijo con **`Guardar borrador`** y **`Publicar actividad`**.

### 5.3 Asignaciones (`/asignaciones`, `/asignaciones/nueva`, `/asignaciones/[id]`)

- **Regla de dominio visible desde el encabezado:** callout informativo sutil en `#FFF6E3`: *«Solo se asignan actividades evaluables (`Completar espacios`, `Pregunta abierta`, `Speaking` y `Examen`). Los **microjuegos** nunca requieren asignación: al publicarse quedan disponibles 24/7 en el portal del estudiante para práctica autónoma.»* (Decisiones 111 y 130).
- **Barra de filtros:** `Grupo` (incluyendo grupos archivados con etiqueta `(Archivado)` para consulta histórica) y `Disponibilidad` (`Todas`, `Programadas`, `Abiertas`, `Cerradas`, `Canceladas`), más CTA primario **`+ Nueva asignación`**.
- **Tabla de asignaciones:** columnas `Actividad` (título + tipo), `Grupo`, `Apertura` y `Cierre` (formato `America/Bogota`, `tabular-nums`), `Disponibilidad` (badge de estado), `Cumplimiento` (barra de progreso sobria + fracción `completados / obligados` respetando `historical_student_count`) y acciones (`Ver detalle` y `Cancelar asignación`).
- **Formulario `+ Nueva asignación` (`/asignaciones/nueva`):**
  - Selector filtrado exclusivamente a actividades `published` de los **4 tipos asignables** (`game` excluido tanto en UI como en backend).
  - Selección multigrupo con verificación atómica de **duplicado activo** (`ASSIGNMENT_ALREADY_ACTIVE`: máximo una asignación no cancelada con `due_at >= ahora` por actividad y grupo; sin éxito parcial, Decisión 99).
  - Fechas `opens_at` y `due_at` con valores iniciales sugeridos en `America/Bogota` y recordatorio de **tolerancia de 24 h** tras el cierre para intentos iniciados antes de `due_at` (Decisión 60).
- **Flujo «Cancelar asignación»:** abre el diálogo de confirmación crítica (§4.7), registra `cancelled_at` del servidor sin eliminar la fila ni borrar entregas, y actualiza la fila al estado `Cancelada`.

### 5.4 Cola de Revisión y Feedback (`/revision`)

Es la vista insignia de trabajo diario de la profesora, diseñada como **espacio de evaluación en pantalla dividida (*split-view*)** sin saltos de página:

- **Cabecera y pestañas con contadores:**
  - **`Pendientes (N)`**: intentos `pending_review` (`speaking` y `open_question`) ordenados por prioridad/antigüedad.
  - **`Calificados (M)`**: intentos `graded`, incluyendo actividades autocalificadas (`fill_blank` y `exam`) para añadir comentario/stickers o habilitar un nuevo intento, además de revisiones manuales previas.
  - Indicador de polling automático cada `30 s` y filtros combinables por `Grupo`, `Tipo de actividad` (los 4 evaluables) y rango `Desde / Hasta`.
- **Columna izquierda (Cola de entregas, `~42 %` en escritorio):**
  - Lista desplazable de tarjetas compactas y escaneables (`border: 1px solid #E4D5C3`; seleccionada con borde `#C6470B` y fondo `#FFF0DE`).
  - Cada ítem muestra: nombre del alumno, grupo y segmento (`Kids` / `Teens`), tipo de actividad, título (`lang="en"`), fecha de entrega (`America/Bogota`) y badge de estado (`Por revisar`, alerta si `> 3 días`, o nota `4,5 / 5,0`).
- **Columna derecha (Inspector de evaluación, `~58 %` en escritorio):**
  1. **Encabezado del intento:** `Intento #N`, título de la actividad (`lang="en"`), alumno + grupo y, si ya está calificado, tarjeta resumen derecha con nota en `tabular-nums` (`4,8 / 5,0`) y estrellas derivadas (0–3).
  2. **Reproductor de audio `Speaking`** (cuando aplica, §4.3) con botón **`Descargar audio`** y aviso de retención de 30 días.
  3. **Respuestas del estudiante y guía docente:** cada ítem muestra la consigna, la respuesta registrada del alumno en bloque legible `#FFFFFF` y, diferenciados visualmente, la **Rúbrica / Criterio** (tint `#FFF6E3`) y la **Respuesta modelo / correcta** (tint `#E6F5EA`).
  4. **Formulario de calificación y feedback:**
     - Campo **`Calificación (0,0 – 5,0)`** o sello **`Calificación inmutable`** (§4.5).
     - **`Comentario de retroalimentación`** (obligatorio en `speaking` y `open_question`, opcional en `fill_blank` y `exam`, contador `0 / 2000`).
     - **Selector de stickers** (máximo 3 de los 6 oficiales, §4.4).
     - **Bloque «Habilitar nuevo intento»** con `retry_extend_until` opcional y aviso de cierre vencido (§4.6).
  5. **Pie de confirmación:** nota sobria *«Al guardar la primera calificación, enviaremos un correo al alumno avisando que su revisión está lista (sin incluir la nota ni el texto del comentario).»* (Decisión 39) y botón primario **`Guardar revisión y retroalimentación`** (`#C6470B`).

### 5.5 Alumnos y Grupos (`/alumnos`, `/alumnos/[id]`, `/grupos`)

- **Organización por sub-pestañas claras (con rutas directas equivalentes):**
  1. **`Alumnos activos` (`/alumnos`):** tabla con `Nombre` (enlace a ficha), `Correo`, `Nivel MCER`, `Grupo vigente` (único por alumno, Decisión 73), `Segmento` (`Kids` / `Teens`), `Contacto acudiente` (resumen discreto) y acción `Ver ficha →`. Sin botón «Crear alumno»: recuerda discretamente que el **auto-registro con aprobación** es la única vía de alta (Decisión 33/35).
  2. **`Solicitudes de registro` (`/alumnos/solicitudes`, badge contador):** listado de cuentas en `pending_approval` mostrando nombre, correo, fecha de nacimiento / segmento calculado y datos del acudiente capturados en el registro.
     - Acción **`Aprobar`**: abre diálogo limpio para confirmar/corregir `guardian_name` y `guardian_contact`, asignar **Nivel MCER (`A1–B2`)** y elegir **un único grupo activo** (obligatorio). Al confirmar, activa la cuenta y dispara el correo de cuenta aprobada.
     - Acción **`Rechazar`**: confirmación breve que elimina la solicitud pendiente.
  3. **`Bloqueados` (`/alumnos/bloqueados`, badge contador rojo):** cuentas bloqueadas automáticamente por 10 intentos fallidos (10 minutos) mostrando tiempo restante y botón directo de un clic **`Desbloquear cuenta`**.
  4. **`Grupos` (`/grupos` y `/grupos/[id]`):** filtro `Activos` / `Archivados`, creación y renombrado en línea, conteo de alumnos vigentes y acción **`Archivar grupo`** (bloqueada con mensaje claro si aún tiene alumnos activos: `GROUP_HAS_ACTIVE_STUDENTS`, Decisión 96; sin borrado destructivo si posee historial).
- **Ficha del alumno (`/alumnos/[id]`):**
  - **Datos personales y pedagógicos:** edición controlada por la profesora de nombre, fecha de nacimiento, nivel MCER y **datos de contacto del acudiente** (`guardian_name`, `guardian_contact`, campos propios de `Student`, **editables exclusivamente por la profesora** — sin cuenta, rol ni entidad `Guardian`, Decisión 35).
  - **Membresía de grupo y traslado:** selector del único grupo activo + historial de membresías (`joined_at` / `left_at`). Al cambiar de grupo, invoca la comprobación `UNCONSUMED_RETRY_WARNING` y muestra el diálogo crítico si existen reintentos pendientes (Decisiones 131 y 144).
  - **Seguridad y soporte de acceso:** botón **`Enviar enlace de recuperación de contraseña`** (nunca contraseñas temporales) y botón **`Cambiar correo de acceso`** (abre diálogo administrativo con verificación de identidad, revocación de sesiones y `AuditLog`, Decisión 63).
  - **Zona de peligro separada visualmente (borde `#EABCB5`, fondo `#FDECE9`):** botón **`Dar de baja al estudiante`** con confirmación escrita `ELIMINAR` (§4.7).

### 5.6 Estadísticas (`/estadisticas` y `/estadisticas/estudiantes/[id]`)

Acceso gobernado exclusivamente por **RBAC `teacher`** (sin feature flags `stats` ni `leaderboard`, Decisión 41), con polling cada `30 s` y selector global de periodo (`Últimos 7 días`, `Últimos 30 días`, `Últimos 90 días`, `Personalizado`).

- **Pestaña 1 — `Vista General` (Rendimiento y constancia global):**
  - Fila de 6 KPIs compactos en `tabular-nums`: `Alumnos aprobados`, `Activos en periodo`, `Nota promedio general (0,0–5,0)`, `% Cumplimiento`, `Tiempo total de estudio` y `Alumnos en riesgo (≥ 14 días inactivos)`.
  - **Bloque de alertas de inactividad (`>= 14 días`):** tarjetas en `#FDECE9` con nombre del alumno (enlace a ficha estadística), grupo, nivel y días sin actividad.
  - **Desglose por Nivel MCER (`A1–B2`)** y **Comparativa entre Grupos Activos:** tablas sobrias con nota promedio (excluyendo microjuegos, Decisión 137), asignadas vs. completadas, cumplimiento y tiempo dedicado.
- **Pestaña 2 — `Por Grupo` (y evolución por estudiante):**
  - Selector de grupo + conmutador de tendencia comparada: **`Cada 30 días (trend30d)`** vs. **`Semanal (trend7d)`** (umbral `±0,2`, Decisión 112).
  - **Gráfico de tendencia académica (SVG limpio, `0,0–5,0`):** línea principal en `#C6470B`, línea de referencia del umbral de aprobación (`3,0`) en `#9A7B5C` punteada, etiquetas claras y nota explícita *«Excluye microjuegos del promedio académico»*.
  - **Tabla de alumnos del grupo** (columnas ordenables): `Alumno` (enlace a `/estadisticas/estudiantes/[id]`), `Nivel`, `Segmento`, `Promedio`, `Tendencia 30d / 7d` (badge `↑ +0,4`, `→ 0,0`, `↓ -0,3`), `Semanas activas`, `Racha vigente` (indicando si tiene `Perdón disp.`), `Cumplimiento`, `Tiempo` y `Última actividad`.
  - **Bloque «Práctica en Juegos del Grupo» (Decisión 137):** tarjeta en `#FFF6E3` claramente etiquetada *«Práctica autónoma · excluida de notas académicas»* con KPIs (`Partidas jugadas`, `Juegos distintos explorados`, `Tiempo total de práctica`) y tabla desglosada por `GameMechanic`.
- **Ficha estadística individual (`/estadisticas/estudiantes/[id]`):**
  - **Eje de Rendimiento:** promedio del alumno vs. promedio del grupo, tasa de aprobación, evolución temporal `0,0–5,0` filtrable por tipo evaluable y nivel.
  - **Eje de Constancia:** calendario de las últimas **12 semanas ISO** (`America/Bogota`) con estados `Activa`, `Perdón aplicado`, `En curso` e `Inactiva`, desglose de tiempo `Por Día` / `Por Semana` / `Por Mes` y sección dedicada **«Entregas que no llegaron a tiempo» (`offline_sync`, SPEC-09 RF-17)** que enumera intentos iniciados antes del cierre cuyo envío sin conexión llegó después del límite (`completeUntil`).
  - **Sección «Práctica en juegos» del estudiante:** historial cronológico de partidas en `America/Bogota` (fecha/hora, microjuego, mecánica, estrellas `0–3` y duración recortada a `expected_duration_seconds × 3`), conservando visibilidad diagnóstica.
- **Pestaña 3 — `Leaderboard privado de notas` y Pestaña 4 — `Ranking privado de juegos` (o vista comparativa «Rankings privados»):**
  - **Cintillo de confidencialidad obligatorio** en la parte superior (`#FFF6E3`, borde `#CBB499`, ícono de candado): *«Solo visible para la profesora · nunca para estudiantes. Los alumnos no ven puestos ni comparativas entre compañeros.»*
  - Filtros independientes por **Nivel MCER (`Todos`, `A1`, `A2`, `B1`, `B2`)** y por **Grupo** (Decisión 115).
  - **Leaderboard privado de notas:** ordena alumnos `approved` por promedio académico (`0,0–5,0`, excluyendo microjuegos), mostrando `Puesto`, `Alumno`, `Nivel`, `Segmento`, `Grupo`, `Nota promedio`, `Actividades completadas`, `Racha actual` e `Insignias`.
  - **Ranking privado de juegos (Decisiones 137 y 143):** independiente de las notas; ordena por **`Puntos de juego`** derivados en servidor desde las estrellas de práctica, mostrando `Puesto`, `Alumno`, `Nivel`, `Grupo`, `Puntos de juego`, `Estrellas totales`, `Partidas`, `Juegos distintos`, `Tiempo de práctica` y `Última partida`. Excluye íntegramente de todas las métricas de fila cualquier partida marcada con `implausible_duration`.

### 5.7 Contenido Extra (`/contenido-extra`)

- **Control de visibilidad del feature flag `extra_content` (Decisión 124):**
  - Cuando el flag está apagado, muestra en la parte superior un banner no bloqueante en `#FFF6E3` con borde `#C6470B`: *«Sección oculta para los estudiantes. Puedes preparar y ordenar los enlaces ahora y activarla cuando estés lista.»* junto al botón **`Habilitar sección para estudiantes`** (`PATCH /api/v1/feature-flags/extra_content`).
  - En la cabecera coexisten el botón conmutador de estado (`aria-pressed`: **`✓ Visible para estudiantes`** / **`○ Oculto para estudiantes`**), el contador de cupo **`X / 200 enlaces`** en `tabular-nums` (tope estricto de 200 recursos por organización, Decisión 126) y el CTA primario **`+ Nuevo enlace`**.
- **Filtros por segmento MCER (Decisión 125):** barra de botones `Todos`, `General` (`level = null`, visible para todos los estudiantes), `Nivel A1`, `Nivel A2`, `Nivel B1`, `Nivel B2`.
- **Listado ordenado determinísticamente (`position ASC, created_at ASC, id ASC`):**
  - Cada fila/tarjeta muestra número de orden (`1, 2, 3…`), título, badge de nivel (`General` en `#E6F5EA` / `#166534` o `Nivel A1–B2` en `#FFF0DE` / `#872E06`), descripción breve, dominio destino visible (`educaplay.com`, etc.) y enlace de verificación externa (`target="_blank" rel="noopener noreferrer"`, validación estricta `https://` y **cero iframes embebidos**).
  - **Controles de reordenamiento atómico (`PUT /api/v1/resources/reorder`):** botones explícitos **`Subir ↑`** y **`Bajar ↓`** (`min-height: 44–48px`), deshabilitados en el primer/último elemento o mientras se guarda. Si la profesora filtra por un nivel distinto de `Todos`, los botones de reordenamiento se deshabilitan con una nota explicativa clara (*«Selecciona el filtro «Todos» para reordenar el catálogo completo.»*).
  - Acciones **`Editar`** y **`Eliminar`** (con diálogo de confirmación).

---

## 6. Accesibilidad WCAG 2.2 AA, estados límite y exclusiones del piloto

### 6.1 Matriz de estados límite formales

| Estado | Tratamiento visual en el Panel Docente | Tono de copy (es-CO) |
| --- | --- | --- |
| **Carga inicial / cambio de pestaña** | Esqueletos cálidos en `#F6EFE4` (pulso suave desactivado en `prefers-reduced-motion`) preservando altura de KPIs y tablas (`CLS <= 0,10`). | *«Cargando datos del panel…»* |
| **Vacío contextual** | Contenedor `#FFFFFF` con borde `1px solid #E4D5C3`, ícono lineal neutro (sin mascota), explicación precisa y una sola acción principal si corresponde. | *«No hay entregas pendientes de revisión con los filtros actuales.»* |
| **Error recuperable de API/red** | Banner en `#FDECE9` con borde `#B9251D`, `role="alert"`, sin stack traces ni códigos internos expuestos, y botón **`Reintentar`**. | *«No pudimos cargar las estadísticas. Verifica tu conexión e inténtalo de nuevo.»* |
| **Conflicto de negocio** | Alerta focalizada (`focus()` programático) explicando la regla incumplida (`ASSIGNMENT_ALREADY_ACTIVE`, `GROUP_HAS_ACTIVE_STUDENTS`, `EMAIL_TAKEN`, `ACTIVITY_DELETE_NOT_ALLOWED`). | *«La actividad ya tiene una asignación activa en el grupo seleccionado.»* |
| **Sin red** | Banner superior no bloqueante en `#FFF0DE` indicando pérdida de señal y suspensión temporal del polling de 30 s. | *«Sin conexión con el servidor. Reintentaremos actualizar automáticamente al recuperar señal.»* |
| **Sesión vencida** | Aviso directo tras limpiar estado de TanStack Query y almacenamiento local sensible, con botón único **`Iniciar sesión nuevamente`**. | *«Tu sesión venció por seguridad. Inicia sesión para continuar.»* |

### 6.2 Checklist obligatorio WCAG 2.2 AA (Decisión 133)

- [x] **Contraste verificado:** texto normal `>= 4,5:1` (tinta principal `17,29:1`, secundaria `9,54:1`), componentes de interfaz y bordes de controles `>= 3:1` (`#9A7B5C` = `3,92:1` sobre blanco; foco `#1D4ED8` = `5,87–6,70:1`).
- [x] **Foco visible y orden lógico:** `outline: 3px solid #1D4ED8; outline-offset: 2px` en todo enlace, botón, pestaña, input y control de tabla; sin `tabindex` positivos y con enlace *«Saltar al contenido principal»* hacia `#main-content`.
- [x] **Tamaño de objetivo (SC 2.5.8):** todo botón y control cumple ampliamente `>= 24 × 24 px`, elevándose a `40–48 px` en navegación, acciones de tabla, selector de stickers, reordenamiento Subir/Bajar y diálogos.
- [x] **Semántica ARIA estricta:** uso de `role="tablist"` / `role="tab"` / `aria-selected` en pestañas, `aria-current="page"` en navegación, `aria-pressed` en toggles y stickers, `aria-live="polite"` para confirmaciones y `role="alert"` para errores; prohibido colocar `aria-label` sobre `<div>` sin rol semántico o provocar *label-content-name-mismatch*.
- [x] **Movimiento y alto contraste:** animaciones mínimas en CSS puro (`120–160 ms`, sin Framer Motion); `@media (prefers-reduced-motion: reduce)` desactiva pulsos y transiciones; soporte `@media (forced-colors: active)` preservando bordes, foco y estados activos.
- [x] **Sin desbordamiento horizontal:** `scrollWidth <= clientWidth` garantizado en `1440×900`, `1280×800` y `820×1080` mediante tablas encapsuladas y rejillas adaptativas.

### 6.3 Verificación estricta de exclusiones del piloto (`CONTEXT.md` §2.4)

Ninguna pantalla, componente, etiqueta ni flujo del Panel Docente puede reintroducir elementos excluidos del piloto:

| Exclusión de `CONTEXT.md` §2.4 | Regla verificada en este diseño |
| --- | --- |
| **WebSockets / tiempo real** | Prohibidos. Se muestra explícitamente el indicador de **polling cada 30 s** y botón manual `Refrescar`. |
| **Heartbeat e inactividad de pestaña** | Prohibidos. El tiempo dedicado se deriva exclusivamente de `started_at` y `finished_at` del servidor. |
| **Pantallas de `parent` y `admin`** | Sin menús, selectores de vista ni pantallas para esos roles (el enum existe en backend sin UI en piloto). |
| **Capacitor / tiendas de apps** | Solo PWA instalable con Serwist y banner in-app no bloqueante. |
| **Muro social / sección de padres** | Inexistentes en navegación, inicio y fichas. |
| **Motor Phaser** | Los microjuegos se gestionan como `ActivityType.game` con sus 5 mecánicas en React puro. |
| **Educaplay embebido (`iframe`)** | Prohibido todo `<iframe>`. `/contenido-extra` solo renderiza tarjetas con enlaces externos `https://` (`target="_blank" rel="noopener noreferrer"`). |
| **Pasarela de pagos / suscripciones** | Cero menús de facturación, planes o cobros en el panel docente. |
| **Consentimiento legal de menores / entidad `Guardian`** | Cero menciones a `ConsentRecord`, Ley 1581 o cuentas de acudiente; únicamente los dos campos opcionales `guardian_name` y `guardian_contact` en `Student`, editables solo por la profesora. |
| **Privacidad de rankings y correos** | Rankings estrictamente privados del docente; correos de calificación jamás incluyen nota ni comentario; cero PII en logs o capturas de error. |

---

## 7. Relación con el boceto interactivo `teacher-portal-proposal.html`

El prototipo interactivo autónomo en [teacher-portal-proposal.html](./teacher-portal-proposal.html) materializa esta especificación para evaluación visual y funcional antes de aplicar los tokens al código de producción:

1. **Sistema de tokens unificado en `:root`:** implementa exactamente la paleta formalizada (`#FCF9F2`, `#FFFFFF`, `#F6EFE4`, `#FFF6E3`, `#2B150A`, `#5E3E2C`, `#C6470B`, `#B9251D`, `#FFCA3A`, `#166534`, `#1D4ED8`), las fuentes `Bricolage Grotesque` + `Plus Jakarta Sans` con `tabular-nums`, y la herencia limpia en elementos `<dialog>`.
2. **Emblema compartido:** integra el SVG exacto de **«Brújula Ascendente Upward»** en la cabecera del panel (`38–40 px`, borde `1.5px solid #4A2511`) y en el `<link rel="icon">` embebido.
3. **Recorrido interactivo de las 7 pantallas:** permite navegar entre **Inicio**, **Actividades** (con vista previa de creación rápida `< 10 min` multi-oración/huecos), **Asignaciones** (con nota de exclusión de `game` y confirmación de cancelación), **Revisión y Feedback** (split-view operativo con reproductor simulado, descarga, retención 30 días, nota `0,0–5,0`, selector interactivo de 3 de 6 stickers y conmutador de nuevo intento con `retry_extend_until`), **Alumnos y Grupos** (pestañas Activos, Solicitudes, Bloqueados y Grupos, más diálogos de traslado con pérdida de reintentos y cambio administrativo de correo), **Estadísticas** (rendimiento y constancia con gráfico SVG y sección `offline_sync`, Práctica en juegos y Rankings privados) y **Contenido Extra** (toggle `extra_content`, botones funcionales **Subir / Bajar** y contador sobre 200).
4. **Barra de estudio y puente visual Kids ↔ Docente:** incluye una barra superior ocultable para alternar vistas de pantalla, cambiar entre **Escritorio (`1440px`)**, **Portátil (`1280px`)** y **Tablet (`820px`)**, y abrir el modal comparativo **«Puente visual Kids ↔ Docente»** que contrasta lado a lado la evolución de marca desde *Zorro Explorador* hasta el *Panel Docente*.
