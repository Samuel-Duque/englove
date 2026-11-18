# Plan de implementación de la UI Origami — Upward English

**Alcance:** referencia visual de [SPEC-12](../specs/SPEC-12-ui-origami.md) para los portales público, Kids, Teens y docente. Origami se implementará y probará completo en la rama `UI` antes de decidir su adopción (decisión 147 de CONTEXT). Aprobar el contrato habilita la implementación; no convierte el diseño en definitivo.

## 1. Dirección visual: una identidad, cuatro maneras de usarla

El [boceto original](C:/Users/1/Downloads/boceto2_kids_1794864368554.jpg) y la [lámina de Juegos en claro y oscuro](C:/Users/1/.codex/generated_images/01a1e6c9-534e-7272-8a17-00b40e0224c3/exec-e7766941-e883-40ce-b773-e96f7f1c90b3.png) fijan la identidad: **grulla dorada, papel plegado, madera cálida, títulos redondeados y controles que parecen piezas que se pueden pulsar**. La mesa de juegos es la expresión más lúdica de Origami, no la plantilla de todas las páginas.

| Experiencia | Qué debe reconocer la persona | Aplicación del diseño |
|---|---|---|
| **Pública** | «Aquí se aprende inglés; entiendo cómo funciona y dónde entrar». | Una ilustración protagonista, composición amplia y ejemplos concretos. Lenguaje comprensible para niños y adultos. |
| **Kids** | «Veo qué puedo hacer y cuál es mi siguiente paso». | Controles grandes, instrucciones cortas, ilustraciones didácticas y gabinetes de madera en Juegos. Más relieve, no más acciones simultáneas. |
| **Teens** | «Es mi espacio de práctica, no una interfaz para niños pequeños». | Misma grulla y colores; tarjetas más planas, menos adornos y prioridad a títulos, fechas, acciones y progreso. |
| **Docente** | «Puedo localizar una entrega, revisarla y continuar». | El pliegue identifica la cabecera y la selección; las superficies de trabajo son lisas. Sin mascotas, confeti ni marcos de juguete en tablas, estadísticas o editores. |

**Invariante:** la misma acción conserva nombre, icono, color y comportamiento en todos los portales. Lo que cambia por audiencia es la densidad, el tamaño, la composición y la cantidad de ilustración.

Los enlaces a los bocetos apuntan a archivos locales de referencia. Las tablas, medidas y descripciones de este documento son la referencia normativa y no requieren acceso a esos archivos.

## 2. Sistema visual normativo

### Paleta exacta

Estos HEX son los valores **de implementación**, no una supuesta extracción exacta de una imagen con textura e iluminación. Se definirán una sola vez como variables semánticas. Las páginas no introducirán colores propios.

| Token y uso | Claro | Oscuro |
|---|---|---|
| `canvas` · fondo general | `#FFF1D6` | `#241B16` |
| `surface` · papel de lectura, navegación, campos | `#FFF8E8` | `#35271F` |
| `surface-raised` · menús y diálogos | `#FFFFFF` | `#483326` |
| `surface-soft` · agrupaciones secundarias | `#FFE6B8` | `#443126` |
| `text-primary` · títulos y contenido | `#48230F` | `#FFF4DD` |
| `text-secondary` · ayuda y metadatos | `#75513D` | `#D8BFA3` |
| `border-subtle` · separación decorativa | `#E0B887` | `#75563E` |
| `border-control` · campos y controles | `#A97544` | `#AF8962` |
| `primary` / `on-primary` · acción principal | `#B92C35` / `#FFF8E8` | `#B92C35` / `#FFF8E8` |
| `primary-hover` / `primary-pressed` | `#AB2931` / `#9B252D` | `#AB2931` / `#9B252D` |
| `primary-outline` · borde del botón rojo | `#B92C35` | `#F36B6F` |
| `honey` / `on-honey` · selección y estrellas | `#FFD343` / `#48230F` | `#FFD343` / `#48230F` |
| `orange` / `on-orange` · pliegues y acentos | `#F88A17` / `#48230F` | `#F88A17` / `#48230F` |
| `origami-red` · grulla secundaria, ilustración | `#E5363C` | `#E5363C` |
| `paper-blue` · barco y detalles ilustrados | `#238EA8` | `#67C4DB` |
| `focus` · foco de teclado | `#2563EB` | `#87BCFF` |
| `disabled-bg` / `disabled-text` | `#E8D6BC` / `#75513D` | `#513F32` / `#D8BFA3` |

| Estado | Claro: fondo / texto e icono | Oscuro: fondo / texto e icono |
|---|---|---|
| Éxito | `#E6F3DD` / `#23613E` | `#193629` / `#A9D990` |
| Error | `#FDE7E2` / `#B92735` | `#482323` / `#FFB0A6` |
| Advertencia o envío pendiente | `#FFF0BC` / `#7A4C00` | `#44351A` / `#FFD477` |
| Información | `#E4F4FB` / `#245D7A` | `#203D48` / `#A6DFF3` |

**Cómo usarla:** el rojo indica la acción principal; el miel identifica la selección; el naranja da carácter a las ilustraciones. No alternar el color de «Jugar ahora» entre tarjetas: se alterna el color del marco, no el significado del botón. El rojo de marca tampoco convierte una acción en destructiva: «Eliminar» necesita texto explícito y la confirmación correspondiente.

En colores sólidos, el contraste calculado es **13,03:1** para texto principal sobre papel claro, **13,16:1** en oscuro, **5,71:1** en el botón rojo y **9,62:1** para cacao sobre miel. No poner texto blanco sobre naranja o miel. Los resultados no certifican pantallas completas: revisar controles, iconos y foco sobre su fondo real. [Contraste de texto, W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [Contraste no textual, W3C](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

### Tipografía, geometría y materiales

**Familia única: [Nunito variable](https://github.com/google/fonts/tree/main/ofl/nunito)**, alojada localmente con su licencia y caracteres españoles. Su forma redondeada aproxima el boceto; no se presenta como identificación de su fuente original. Respaldo: `system-ui, "Segoe UI", sans-serif`. Implementar en `rem`, respetar el tamaño base del navegador y no incrustar texto funcional en imágenes.

| Uso · tamaño/interlineado en px equivalentes | Kids | Teens, docente y público |
|---|---:|---:|
| Título de página, móvil → escritorio | 28/36 → 32/40, peso 900 | 24/32 → 28/36, peso 800 |
| Título de sección | 24/32, 800 | 22/30, 800 |
| Título de tarjeta | 22/28, 800 | 20/28, 800 |
| Texto de lectura | 18/28, 400 | 16/24, 400 |
| Botón | 18/24, 800 | 16/24, 700 |
| Etiqueta de campo | 16/24, 700 | 16/24, 700 |
| Ayuda o metadatos | 16/24, 600 | 14/20, 600 |

La portada tiene una sola excepción: titular de **40/44 en móvil y 64/68 en escritorio**, peso 900. Texto alineado a la izquierda y párrafos de hasta 70 caracteres por línea. Usar cifras tabulares en notas y columnas numéricas de la profesora; no cambiar de fuente.

- **Espaciado:** escala de `4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px`. Interior de tarjeta: 16 px en móvil, 24 px en escritorio. Entre campos: 20 px. Entre secciones de portal: 32 px.
- **Radios:** control/tarjeta/diálogo de `16/20/24 px` en Kids y `12/16/20 px` en el resto. Forma de píldora solo para filtros y selectores breves; no para todo botón.
- **Relieve:** borde decorativo de 1 px, borde de control de 2 px. Sombra de pulsador `0 2px 0 #C79A65` en claro y `0 2px 0 #17100C` en oscuro. Añadir un segundo escalón de 4 px únicamente a gabinetes y tarjetas destacadas. Listas, tablas y campos quedan planos.
- **Material:** veta de madera limitada a marcos y a la escena ilustrada; opacidad máxima 12 % en claro y 8 % en oscuro. Formularios, consignas, notas y comentarios siempre sobre papel opaco. En oscuro se redibujan superficies y contornos; no se invierte una captura.
- **Pliegue:** triángulo decorativo a 45°, de 16 px en tarjetas destacadas y 24 px en cabeceras ilustradas. Nunca sobre texto, en cada fila de una tabla ni como único indicador de selección.

### Iconografía e ilustración

Usar **Lucide** para operaciones y **SVG propios** para identidad y material educativo. No mezclar emojis, iconos de varias familias y dibujos para representar la misma acción.

| Familia | Asignación |
|---|---|
| Navegación del alumno | Inicio `House` · Juegos `Gamepad2` · Progreso `ChartColumn` · Feedback `MessageSquare` · Extra `BookOpen` · Perfil `UserRound` |
| Gestión docente | Actividades `BookOpen` · Asignaciones `ClipboardList` · Revisión `ClipboardCheck` · Estadísticas `ChartColumn` · Grupos `Users` · Alumnos `UserRound` |
| Controles | Claro/oscuro `Sun`/`Moon` · Escuchar `Volume2` · Grabar `Mic` · Reproducir `Play` · Reintentar `RotateCcw` · Sin conexión `WifiOff` |
| Identidad | Grulla miel/naranja para la marca; grulla roja y barco azul como adornos secundarios; animales, fichas, libro y sobre para ejemplos con significado. |

Trazo de **2 px**; iconos de **20 px** en metadatos, **24 px** en controles y **28 px** en navegación Kids. Iconos funcionales con texto visible en navegación; si un botón solo lleva icono, debe tener nombre accesible. Una ilustración ornamental se oculta al lector de pantalla; una que forma parte de una pregunta necesita alternativa equivalente que no revele la respuesta.

## 3. Arquitectura de las interfaces y componentes compartidos

**Orden de composición:** tokens → controles básicos → componentes de dominio → estructuras de navegación → páginas. Mantener la biblioteca en la aplicación web. Cada página elige el contenido y la distribución, no una paleta, fuente o juego de botones.

**Tres ejes independientes:** el rol determina permisos y destinos; Kids/Teens determina densidad y refuerzo; claro/oscuro determina color. Conservar `data-theme="kids|teens"` y añadir `data-appearance="light|dark"` en la raíz. El interruptor de apariencia nunca cambia de segmento, modifica el perfil ni habilita permisos.

Primera visita: seguir `prefers-color-scheme`. La elección explícita y las transiciones de sesión siguen [SPEC-12 RF-2 y RF-3](../specs/SPEC-12-ui-origami.md#3-requisitos-funcionales): conservar por pestaña, volver al sistema al cerrar, invalidar o sustituir una sesión autenticada y no reiniciar por renovación. Resolver antes del primer pintado, sin relajar la política de seguridad. **No se proponen APIs, migraciones ni cambios de autenticación.**

| Elemento | Especificación de implementación |
|---|---|
| **Rejilla** | Menos de 640 px: una columna y margen de 16 px. De 640 a 1023 px: dos columnas cuando quepan, margen y separación de 24 px. Desde 1024 px: rejilla de 12 columnas, margen de 32 px y separación de 24 px. Ancho máximo: alumno 1152 px; docente y portada 1280 px; lectura 720 px; acceso 480 px; registro 640 px. |
| **Navbar / `AppHeader`** | Altura mínima 64 px móvil y 80 px escritorio. Grulla de 32/40 px a la izquierda, nombre de producto, selector de apariencia y cuenta según contexto. A 320 px se compacta la marca al símbolo con nombre accesible antes de recortar controles. No duplicar el `h1` ni exponer correo de alumnos. |
| **Navegación del alumno** | Inicio, Juegos, Progreso, Feedback y Extra, respetando las opciones habilitadas por organización. Kids: barra inferior de 72 px más área segura. Teens: misma barra en móvil/tablet y superior de 64 px desde 1024 px. Un solo menú principal visible. Activo mediante miel, icono, texto y `aria-current`. |
| **Navegación docente** | Lateral de 256 px desde 1024 px. Por debajo, menú desde cabecera con panel de hasta 288 px. Filas de al menos 48 px. Mantener el orden de las áreas existentes. Panel móvil con foco contenido, cierre con Escape, fondo inerte y devolución de foco. |
| **Pie de página** | `PublicFooter`: marca, enlace a términos y vuelta a los accesos existentes; 24 px de relleno vertical. `ContextFooter`: versión discreta de 16 px en portales. En ejercicios se omite el pie informativo: `ActivityActionBar` contiene solo acciones de la tarea. Reservar espacio para que barras y avisos no tapen contenido. |
| **Botones y formularios** | Primario rojo, secundario de papel con borde y terciario de texto. Controles interactivos de al menos 48 × 48 px; acción principal Kids de 56 px de alto. Separación mínima de 8 px. Campo con etiqueta persistente y ayuda/error asociado; área de texto de 144 px de alto mínimo. |
| **Tarjetas** | Base común con título, contenido y acción. `GameCabinetCard` conserva marco, arte 4:3, título, escucha cuando corresponda, estrellas reales y acción. `MissionCard` prioriza consigna, estado y fecha. `ResourceCard` identifica enlaces externos. Altura por contenido, no por recorte de títulos. |
| **Datos y revisión** | Tabla con cabecera de 48 px, filas de al menos 64 px y acciones con nombre. En móvil, listas operativas se convierten en fichas; las tablas comparativas conservan encabezados y desplazamiento horizontal local. Una nota `4,7 / 5,0` nunca se representa mediante estrellas de práctica. |
| **Mensajes y capas** | Vacío: explicación y siguiente acción disponible. Error: qué falló y cómo continuar. Carga: reservar espacio sin inventar datos. Diálogo normal de hasta 560 px; amplio de hasta 800 px. Avisos offline y de sincronización se apilan en el flujo sin ocultar el foco. |

Todos los controles deben resolver reposo, foco, pulsación, selección, deshabilitado, carga y error cuando corresponda. El *hover* solo mejora la respuesta en dispositivos compatibles. El foco usa anillo de **3 px** con separación de **3 px**; si el fondo varía, se añade una base opaca de separación. No comunicar ningún estado solo con color, sonido o animación.

## 4. Landing page: «Una hoja, una palabra, una grulla»

La portada pública `/` no debe parecer un panel escolar ni un catálogo de tarjetas. Su pieza central será **una hoja en tres momentos: la palabra inglesa “bird”, el pliegue y la grulla terminada**. Un niño puede reconocer la transformación; un adulto puede entender qué enseña la plataforma y cómo se practica. El ejemplo es editorial: no crea un intento, no guarda respuestas y no solicita datos.

| Orden | Diseño y contenido |
|---|---|
| **1. Cabecera** | Grulla + Upward English, anclas «Cómo se aprende» y «Por dentro», selector de apariencia y «Iniciar sesión» → `/login`. En móvil, las anclas pasan a un menú; acceso y apariencia siguen disponibles. |
| **2. Primera pantalla** | Escritorio: texto en 5 columnas, escena 4:3 en 7. Móvil: titular, descripción, acciones y después la escena. Titular propuesto: **«Una palabra, un pliegue, una nueva forma de aprender inglés.»** Bajada: «Actividades de inglés para estudiantes de 7 a 14 años, con práctica de escucha, juegos y acompañamiento de su profesora». Principal: **«Entrar a mi portal»** → `/login`. Secundario: **«Crear cuenta de estudiante»** → `/registro`. |
| **3. Cómo se aprende** | Una secuencia de tres pliegues: **Escucha** una palabra, **practica** con una actividad, **revisa** lo aprendido. Una muestra ilustrada por paso. En escritorio se leen de izquierda a derecha; en móvil, de arriba abajo. El orden también se entiende sin la línea decorativa que los conecta. |
| **4. Por dentro** | Un ejemplo de gabinete Kids y una misión Teens muestran la misma actividad con distinta densidad. A continuación, una muestra sobria de revisión explica al público adulto qué hace la profesora. Rotular «Ejemplo de actividad»; sin nombres de menores, notas ficticias que parezcan reales ni capturas de cuentas. |
| **5. Cierre** | Una franja de papel liso con la pregunta «¿Ya tienes una cuenta?» y el enlace de acceso; debajo, registro de estudiante con indicación de aprobación cuando corresponda. Termina el pie público. Sin testimonios inventados, cifras de éxito, registro docente ni portal familiar inexistente. |

**Composición:** 64 px entre bloques en escritorio y 40 px en móvil. Un único elemento de gran escala: la grulla del primer bloque. En claro descansa sobre papel crema; en oscuro, sobre cacao, con la cara miel iluminada y los pliegues interiores naranja. Reservar la proporción del SVG para evitar saltos. El titular, el acceso y el registro estarán disponibles sin esperar animaciones, cargar fuentes remotas ni ejecutar la escena.

## 5. Aplicación a todas las páginas existentes

| Superficie | Rutas y tratamiento |
|---|---|
| **Acceso público** | `/login`, `/registro`, `/recuperar-contrasena`, `/restablecer/[token]`: formulario en hoja lisa, una sola acción principal, ayudas visibles y estados reales de envío, token y aprobación. `/terminos`: composición de lectura sin alterar texto legal. |
| **Inicio por rol** | `/inicio` sigue siendo el acceso compartido. Alumno: siguiente actividad, filtros y misiones disponibles. Docente: solicitudes y entregas pendientes antes de accesos de gestión. No fabricar contadores para llenar una tarjeta. |
| **Práctica del alumno** | `/juegos`: la pantalla más fiel al boceto, con gabinetes en 1/2/3 columnas. `/actividad/[attemptId]`: retirar la ornamentación del catálogo; priorizar consigna, respuesta, audio cuando corresponda, estado de envío y acción. Cubrir juegos, huecos, respuesta abierta, grabación y exámenes sin modificar sus mecánicas. |
| **Seguimiento del alumno** | `/progreso`: separar racha, escudo, insignias, historial académico y práctica. `/feedback`: comentario escrito, nota, stickers y reintento solo cuando esté permitido. `/extra`: recursos por nivel. `/perfil`: separar cuenta, apariencia y elección Kids/Teens autorizada por la API. |
| **Autoría y asignación** | `/actividades`, `/actividades/nueva`, `/actividades/[id]`, `/asignaciones`, `/asignaciones/nueva`, `/asignaciones/[id]`: patrón común de listado, editor y detalle. Título y acción arriba; filtros debajo; campos agrupados por tarea. La previsualización reproduce el componente del alumno, no una copia dibujada. |
| **Revisión y estadísticas** | `/revision`: desde 1024 px, cola de 320 px y entrega al lado; en móvil, lista y detalle conservan selección. `/estadisticas` y `/estadisticas/estudiantes/[id]`: filtros, cifras y comparaciones sobre superficies planas; series identificables por etiqueta y forma, no solo por color. Rankings únicamente para la profesora. |
| **Gestión docente** | `/grupos`, `/grupos/[id]`, `/alumnos`, `/alumnos/[id]`, `/alumnos/solicitudes`, `/alumnos/bloqueados`, `/contenido-extra`: mismos encabezados, búsqueda, filas, paginación cuando exista y confirmaciones. La identidad procede de la marca y la selección miel, no de adornos detrás de datos. |
| **Sistema y compatibilidad** | `/offline`, página no encontrada y error de aplicación: una hoja, explicación breve y recuperación disponible. Mantener `/recuperar`, `/contenidos`, `/contenidos/onboarding` y `/juegos/[activityId]` como redirecciones, sin pantallas nuevas. |

## 6. Movimiento: simple, perceptible y con propósito

Usar CSS y las utilidades existentes; no incorporar bibliotecas de animación. Curva común de entrada `cubic-bezier(0.2, 0, 0, 1)`. Animar `transform` y `opacity`, no dimensiones de contenido. El foco, la lectura y las acciones nunca esperan al final de una transición.

| Momento | Movimiento | Con movimiento reducido |
|---|---|---|
| **Grulla de portada** | Una vez por entrada: dos caras del ala pasan de −8° a 0° en 420 ms, con desfase de 60 ms. El cuerpo permanece visible desde el primer fotograma. Sin vuelo continuo ni paralaje. | Mostrar directamente la grulla terminada. |
| **Pulsar un control** | Descenso de 1 px durante 100 ms; la sombra inferior se acorta para dar sensación de pulsador. El foco por teclado aparece de inmediato. | Cambio de borde o relleno, sin desplazamiento. |
| **Elegir pestaña o filtro** | La superficie miel aparece en 160 ms dentro del control seleccionado. El contenido y el nombre accesible se actualizan inmediatamente. | Selección instantánea con texto o marca visible. |
| **Abrir menú o diálogo** | Entrada de 180 ms, opacidad y desplazamiento máximo de 8 px; salida de 120 ms. Una segunda interacción invierte o cancela la transición. | Apertura y cierre inmediatos; mismas reglas de foco. |
| **Completar una práctica** | Tras confirmación real, las estrellas obtenidas se revelan una vez, en 240 ms. Sin animar valores anteriores al volver a abrir la página. La profesora recibe confirmación textual, no celebración. | Mostrar resultado, estrellas y texto finales sin movimiento. |

Nada parpadea para pedir atención ni se incorpora audio de fondo o reproducción automática al entrar. Se conservan el control de audio y la retroalimentación de juego ya aprobados; [SPEC-12 §4](../specs/SPEC-12-ui-origami.md#4-reglas-de-negocio) define cómo conviven la revelación de estrellas y las celebraciones existentes. Los juegos de arrastre conservan alternativas de toque y teclado. No animar filas al filtrar una tabla docente ni reordenar respuestas mientras un alumno está trabajando.

## 7. Secuencia de implementación y aceptación

El primer hito es **aprobar SPEC-12** para trabajar en `UI`. El segundo es **decidir la adopción** después de implementar y probar todo en esa rama. La prueba temprana de referencias reduce el retrabajo; no sustituye la verificación del candidato completo.

| Fase | Entrega | Condición para avanzar |
|---|---|---|
| **1. Base y contratos** | Aprobar SPEC-12 y preparar tokens, fuente local, marca y recursos (ENG-163). | No escribir código de producción hasta aprobar SPEC-12. Claro y oscuro no alteran permisos ni requieren backend. |
| **2. Componentes y navegación** | Implementar controles, estados, cabeceras, barras, pies y plantillas de página. | Una misma ficha, formulario y diálogo funcionan en los cuatro contextos y en ambas apariencias, con teclado y tacto. |
| **3. Pantallas de referencia** | Construir `/`, Juegos Kids/Teens y Revisión docente. | Verificar las referencias localmente. Las tres superficies se reconocen como Origami sin confundir al público: la portada explica, el catálogo invita a practicar y la revisión facilita trabajar. La validación en tablet compartida se hace en la fase 5. |
| **4. Extensión por familias** | Migrar el resto de rutas de la matriz, incluidos errores, desconexión, formularios y redirecciones. | Ninguna página conserva por accidente una paleta anterior; siguen operando filtros, navegación, intentos, audio y acciones autorizadas. |
| **5. Verificación y cierre** | Ejecutar en `UI` la matriz completa en el candidato integrado. | Registrar versión, evidencia, pendientes y fallos por ruta, rol, apariencia y tamaño. Sin cobertura completa no se propone adoptarlo. |

**Pruebas de aceptación:**

- **Visuales:** público, Kids, Teens y docente × claro/oscuro. Capturas de referencia a 390 × 844, 800 × 1280 y 1280 × 800; comprobar además reflujo a 320 px, zoom del 200 %, textos largos y navegación de cinco destinos. Ninguna barra tapa el último control.
- **Apariencia y privacidad:** cambiar a oscuro en Kids no activa Teens ni envía una modificación de perfil; recargar conserva la elección de pestaña; cambiar de cuenta la limpia; almacenamiento bloqueado no impide usar la interfaz.
- **Funcionales:** entrada y registro de la portada llegan a sus destinos reales. Las páginas autenticadas conservan banderas de organización, permisos, intentos y aislamiento por rol. «Pendiente de sincronización» nunca aparece como «Guardado». Nota del servidor y estrellas de práctica siguen siendo conceptos distintos.
- **Accesibilidad:** recorrer portada, formulario, panel móvil, ejercicio y revisión con teclado; comprobar devolución de foco, lector de pantalla, controles táctiles de 48 px, alternativa al arrastre y movimiento reducido. Verificar contraste en ambas apariencias, incluidos avisos y selección.
- **Cierre con personas:** observar a **tres niños por segmento**, como exige el proyecto, y probar las tareas críticas en tablet real. No dar por validadas ergonomía o legibilidad con emulación de escritorio. Estas pruebas corresponden a la implementación futura; no se han ejecutado en esta planificación.

## 8. Recomendaciones finales aceptadas

1. **Usar Juegos y Revisión como pareja de referencia.** Si para reconocer Origami en la pantalla docente hace falta añadirle juguetes, la marca, la tipografía o la selección aún no están resolviendo bien la identidad. Si Juegos parece una tabla administrativa, se perdió el carácter del boceto.
2. **Invertir el detalle ilustrado donde enseña algo.** Una grulla que nace de la palabra *bird* da a la portada una imagen memorable y explica el producto. Repetir grullas detrás de formularios, comentarios o notas solo dificulta leerlos.
3. **Verificar las referencias antes de replicar.** Usar las pruebas locales para corregir medidas, contraste o navegación antes de extender. Según architecture §14.9, la prueba física de las referencias se ejecuta junto al resto de rutas sobre el candidato completo.

## 9. Estado de implementación y pendientes — 2026-11-18

**Contrato aprobado para `UI`.** El líder aprobó [SPEC-12](../specs/SPEC-12-ui-origami.md) el 2026-11-17. La aprobación habilita la implementación; no acredita la adopción del diseño. La base de ENG-163 incluye tokens, marca vectorial, apariencia por pestaña, navegación por rol y Nunito variable alojada con su licencia OFL.

### Comprobaciones estáticas

- Los 34 archivos `page.tsx` del App Router corresponden a rutas ya contempladas en las secciones 4 y 5: 30 superficies con interfaz y cuatro entradas de compatibilidad. También existen los componentes de página no encontrada, error de segmento y error global.
- Los destinos de compatibilidad ya coinciden con el alcance: `/recuperar` → `/recuperar-contrasena`; `/contenidos` → `/actividades`; `/contenidos/onboarding` → `/actividades/nueva`; `/juegos/[activityId]` → `/juegos`. No requieren una pantalla propia.
- Los cuatro contrastes de texto de la sección 2 coinciden con el recálculo en colores sólidos. En oscuro, sobre `surface`, el rojo base da **2,38:1** y el contorno previsto **4,89:1**: conservar `primary-outline` y comprobar el control renderizado. Esto no sustituye la auditoría de accesibilidad.
- La validación estructural de SPEC-12 comprobó las 12 secciones, el índice, las tareas y la trazabilidad de pruebas de sus nueve requisitos: 0 errores y 0 avisos.

### Pendientes para cerrar

| Paso | Trabajo pendiente | Evidencia necesaria |
|---|---|---|
| 1. Aprobar el contrato (hecho) | Registrar la aprobación de SPEC-12. | Aprobación explícita del líder y transición registrada en la spec, el índice y el taskboard. |
| 2. Construir y probar las referencias (implementadas en local) | Portada, Juegos Kids/Teens y Revisión probadas localmente. | Los recorridos físicos de las referencias se incorporan a la validación del candidato completo. |
| 3. Completar y conectar las superficies (implementadas en local) | Extensión a las restantes rutas, formularios, ejercicios y estados del sistema. | Regresión local en verde; no se publicó el candidato. |
| 4. Verificar el candidato completo (parcial) | Matriz local por ruta, rol, apariencia y tamaño ejecutada en `UI`. | Quedan zoom de navegador al 200 %, lector de pantalla, dispositivos físicos y observación con tres niños por segmento. |
| 5. Decidir la adopción | Evaluar la evidencia completa sin asumir fusión ni despliegue. | Decisión explícita después de resolver fallos, diseños faltantes y pruebas obligatorias pendientes. |

### Evidencia local de las referencias

**Versión:** rama `UI`, base `738f2cb`, cambios locales sin commit. Huella SHA-256 agregada del árbol web de 43 archivos: `35606dcc6be1a6e477be1aedcff27555dfb751b00aabcc84b11bc2858c48dda9`.

| Referencia | Comprobación local con datos sintéticos | Pendiente de aceptación |
| --- | --- | --- |
| `/` | 4/4 en Chromium: accesos, anclas, teclado, ejemplos sin intentos; claro y oscuro a 390, 800 y 1280 px, reflujo adicional a 320 px. Axe sin hallazgos en los estados probados. | No sustituye lector de pantalla, zoom físico ni observación con usuarios. |
| `/juegos` | 9/9 con regresión SPEC-06: Kids y Teens, claro y oscuro, flag, voz simulada, catálogo y acciones reales de práctica. Axe sin hallazgos en los estados probados. | Consigna Kids y misión Teens en tablet compartida; audio del dispositivo. |
| `/revision` | 3/3 con regresión SPEC-07: cola de 320 px, vuelta móvil con foco/borrador, reproducción y pausa de audio sintético, nota y envío. | Corrección docente en tablet compartida; no se probó reproducción desde R2. |

**Comprobaciones integradas:** Vitest web 294/294, typecheck, lint y build local sin errores. Chromium: 74/76 en el recorrido inicial. Los dos fallos fueron localizadores de prueba que coincidían con enlaces en el pie; después de acotarlos a la acción en `main`, la suite focalizada SPEC-01/02 pasó 5/5. No se ejecutaron el Worker, la matriz de ENG-166, CI, dispositivos físicos ni observación con alumnos. No se declara conformidad integral ni se propone la adopción. Véase la [bitácora](../odd/tasks/ui-origami.md).

### Validación física del candidato completo

En una **tablet compartida física**, abrir el candidato de `UI` en un entorno de pruebas autorizado con cuentas y entregas sintéticas. Ejecutar cada recorrido en **claro y oscuro**. Registrar modelo, sistema, navegador, fecha, apariencia y resultado; no incluir nombres ni información de alumnos. Entre cuentas, comprobar que se restaura la apariencia del sistema.

| Audiencia | Recorrido | Comprobación | Claro | Oscuro |
| --- | --- | --- | --- | --- |
| Kids | Abrir Juegos, elegir una consigna y comenzar la práctica. | Entiende dónde tocar, puede usar la escucha disponible y ninguna barra tapa la acción. | Pendiente | Pendiente |
| Teens | Entrar a su misión desde Inicio y abrirla. | Conserva el segmento, encuentra la misión y puede iniciar sin desplazamiento horizontal. | Pendiente | Pendiente |
| Docente | Elegir un envío en Revisión, escribir una corrección, volver a la cola y reabrirlo. | Se recuperan selección, borrador y foco; la nota sigue separada de las estrellas de práctica. | Pendiente | Pendiente |

Estos seis recorridos forman parte de ENG-166 y se ejecutan junto con las demás rutas. La aceptación sigue sujeta a toda la evidencia de la sección 7 y de SPEC-12 §9.

### Cobertura local de la extensión

**Candidato actual:** rama `UI`, base `738f2cb`, cambios locales sin commit. Huella SHA-256 agregada del árbol web de 126 archivos: `64ed856888ddde98076e4424fe805e9e6c0dc07a054e21ab5db00e8cde9fa154`.

**Resultados:** Chromium 112/112 con API simulada; matriz de rutas y redirecciones 9/9 incluida. Vitest web 298/298 con prefijo de cookies predeterminado. Verificación independiente 6/6 de previsualización y celebración. TypeScript, ESLint y build local vinext correctos. Guardrails: 0 errores, 24 avisos y 72 supresiones en el repositorio. La primera corrida de Vitest heredó el prefijo del servidor de Playwright y falló en diez pruebas de cookie; la corrida completa en el entorno correcto pasó sin cambios de producto. No se ejecutó CI ni se desplegó.

La matriz `apps/web/e2e/origami-route-matrix.spec.ts` comprueba destino, encabezado principal, paleta y reflujo a 320 px con datos sintéticos en Chromium. En cada combinación de audiencia y apariencia guarda capturas de su referencia a 390 × 844, 800 × 1280 y 1280 × 800, y ejecuta axe sobre ese contenido principal. No equivale a una auditoría WCAG completa.

| Audiencia | Destinos cubiertos, claro y oscuro | Estado o comportamiento adicional observado |
| --- | --- | --- |
| Pública | `/`, `/login`, `/registro`, `/recuperar-contrasena`, `/restablecer/[token]`, `/terminos`, `/offline`, no encontrada | Acceso, confirmaciones, recuperación y estados de error. Límites global y de segmento comprobados mediante render estático y llamada de reintento. |
| Kids y Teens | `/inicio`, `/juegos`, `/actividad/[attemptId]`, `/progreso`, `/feedback`, `/extra`, `/perfil` | Cinco tipos de actividad en las suites de alumno; cinco mecánicas completables por teclado; entrega en cola, práctica, movimiento reducido y selección de apariencia independiente del segmento. |
| Docente | `/inicio`, `/actividades`, `/actividades/nueva`, `/actividades/[id]`, `/asignaciones`, `/asignaciones/nueva`, `/asignaciones/[id]`, `/revision`, `/estadisticas`, `/estadisticas/estudiantes/[id]`, `/grupos`, `/grupos/[id]`, `/alumnos`, `/alumnos/[id]`, `/alumnos/solicitudes`, `/alumnos/bloqueados`, `/contenido-extra` | Fichas de gestión, tablas comparativas con desplazamiento local, selección y borrador de Revisión, previsualización sin crear intentos o subir archivos; solicitudes y bloqueados abren su pestaña correspondiente. |
| Compatibilidad | `/recuperar`, `/contenidos`, `/contenidos/onboarding`, `/juegos/[activityId]` | Redirección a los destinos existentes. |

Las pruebas de aceptación pendientes incluyen lector de pantalla, zoom del navegador al 200 %, navegadores y dispositivos reales del piloto, audio real de extremo a extremo y observación con tres niños por segmento. Las capturas son de Chromium local, no evidencia de tablets físicas.
