# SPEC-12 — UI Origami

| Campo | Valor |
| --- | --- |
| Estado | Aprobada |
| Etapa | 13 — UI Origami |
| Tareas | ENG-163, ENG-164, ENG-165, ENG-166 |
| Referencias | [CONTEXT §8, §12 y §14](../.agents/CONTEXT.md#8-sistema-de-diseño--decidido), decisión 147 · [architecture §3 y §10](../planning/architecture-overview.md#3-frontend-appsweb) · [plan Origami](../planning/plan-implementacion-ui-origami.md) |
| Aprobada por / fecha | Líder del proyecto / 2026-11-17 |

## 1. Contexto y objetivo

Origami unifica la identidad visual del sitio público, Kids, Teens y la profesora sin convertirlos en la misma interfaz. El objetivo es que el alumno encuentre su siguiente acción, que la profesora revise y gestione sin ruido visual y que un visitante entienda el producto antes de iniciar sesión.

Esta especificación habilita el trabajo en la rama `UI` una vez aprobada. El diseño vigente fuera de esa rama no se reemplaza hasta implementar, verificar y evaluar la totalidad del candidato, según la decisión 147.

## 2. Alcance

- **Incluye:** identidad y recursos locales, colores claro/oscuro, componentes y navegación compartidos, los 30 destinos con interfaz, los cuatro de compatibilidad y los estados de error. Los estilos, medidas, composición y movimientos normativos se mantienen en las §§1–6 del [plan](../planning/plan-implementacion-ui-origami.md).
- **No incluye:** nuevos permisos, rutas funcionales, modelos, endpoints, contenido evaluable, reglas de calificación ni cambios en el lanzamiento del piloto. Se conserva [CONTEXT §2.4](../.agents/CONTEXT.md#24-explícitamente-fuera-del-piloto--decidido).

## 3. Requisitos funcionales

**RF-1 — Sistema visual compartido y adaptable.** **Dado** un destino público, Kids, Teens, docente o de sistema, **Cuando** se abre en claro u oscuro, **Entonces** aplica la paleta, tipografía local y jerarquía del plan sin depender de recursos remotos para leer o actuar. A 320 px y con zoom del 200 %, el contenido refluye sin desplazamiento horizontal de toda la página; una tabla comparativa puede desplazarse dentro de su propio contenedor. Los controles principales conservan sus tamaños y estados.

**RF-2 — Apariencia independiente y temporal.** **Dado** un navegador sin elección explícita, **Cuando** abre o recarga la interfaz, **Entonces** se aplica `prefers-color-scheme` desde el primer pintado. **Dado** que la persona elige claro u oscuro, **Cuando** navega o recarga en la misma pestaña, **Entonces** se conserva su elección en `sessionStorage` con clave `upward_english_appearance`, sin cambiar `data-theme`, permisos, flags ni perfil. Si el almacenamiento no está disponible, la elección funciona en memoria mientras dure la instancia de la aplicación.

**RF-3 — Reinicio de apariencia en dispositivos compartidos.** **Dado** que una pestaña tiene una elección explícita, **Cuando** se renueva la misma sesión, **Entonces** se conserva. **Cuando** se cierra o invalida la sesión autenticada o se sustituye por otra cuenta, **Entonces** se borra la elección en memoria y almacenamiento y se vuelve al sistema antes de pintar con la nueva identidad. El acceso inicial desde una visita anónima sin una identidad autenticada previa puede conservar la elección de esa pestaña.

**RF-4 — Portada y acceso conectados.** **Dado** un visitante, **Cuando** abre `/`, **Entonces** encuentra la secuencia ilustrada de aprendizaje, ejemplos editoriales identificados como tales y enlaces operativos a `/login`, `/registro` y `/terminos`. En móvil el menú de anclas no oculta los controles de acceso y apariencia. El ejemplo público no crea intentos ni usa datos de cuentas; login, registro, recuperación y restablecimiento mantienen sus estados y destinos.

**RF-5 — Navegación de ambos roles.** **Dado** un usuario autorizado, **Cuando** entra por `/inicio` o cambia de tamaño, **Entonces** ve la navegación de su rol y una sola instancia visible del menú principal. Kids conserva la barra inferior; Teens la usa por debajo de 1024 px y pasa a barra superior desde ese ancho. La profesora tiene menú modal por debajo de 1024 px y lateral desde ese ancho. Las entradas deshabilitadas por organización no aparecen; la selección tiene texto y `aria-current`. Escape cierra el menú modal y devuelve el foco al control que lo abrió.

**RF-6 — Práctica y seguimiento del estudiante.** **Dado** un alumno, **Cuando** usa Juegos, un intento, Progreso, Feedback, Extra o Perfil, **Entonces** recibe el tratamiento de su segmento autorizado y conserva los flujos vigentes de actividades, filtros, audio, práctica y revisión. Las estrellas de práctica vienen del resultado real, no representan una nota; la acción de reintento solo aparece cuando está autorizada. Una operación en cola se muestra como pendiente, no como guardada.

**RF-7 — Trabajo docente sin pérdida de contexto.** **Dado** un usuario docente, **Cuando** usa listados, editores, Revisión, Estadísticas o Gestión, **Entonces** conserva filtros, acciones y confirmaciones vigentes. Desde 1024 px, Revisión presenta la cola de 320 px junto al detalle; en móvil, abrir y volver conserva la selección. Los listados operativos usan fichas cuando no cabe la tabla; los comparativos conservan encabezados y desplazamiento local. Las series no se distinguen solo por color. La vista previa reutiliza el renderizador didáctico en modo de previsualización, sin crear ni enviar intentos de alumno.

**RF-8 — Recuperación, compatibilidad y accesibilidad.** **Dado** un estado de carga, vacío, error, ausencia o desconexión, **Cuando** se presenta, **Entonces** explica su estado, ofrece la acción real disponible y no muestra datos simulados. Las cuatro rutas de compatibilidad conservan sus redirecciones. Con teclado, táctil y movimiento reducido se pueden completar las mismas acciones; la interfaz no agrega audio automático, animaciones repetitivas ni barras que oculten el foco. Se conservan las alternativas al arrastre y los controles sonoros de los juegos.

**RF-9 — Evidencia de aceptación en `UI`.** **Dado** el candidato completo, **Cuando** se presenta para adopción, **Entonces** el informe al final del plan identifica la versión probada, cada ruta y estado cubierto, los resultados por audiencia/apariencia/tamaño y los fallos o pruebas pendientes. No se acepta un candidato con diseño faltante, regresiones sin resolver o pruebas obligatorias sin evidencia.

## 4. Reglas de negocio

- La decisión 147 cambia la presentación en `UI`. Se preservan el acceso según rol y organización, la elección de segmento autorizada, los límites de navegación de SPEC-05, los contratos de actividades y revisión y el alcance de la PWA.
- La API sigue asignando los timestamps, notas y resultados. El ranking permanece privado del panel. Las pruebas y ejemplos no usan expedientes reales de menores.
- El movimiento de Origami no modifica la mecánica ni anula la retroalimentación didáctica de [SPEC-06 RF-9](./SPEC-06-microjuegos.md#rf-9--efectos-de-sonido-con-web-audio-api-nativo-y-confeti-canvas-confetti-por-segmento-decisión-107). Las estrellas se revelan una vez tras confirmar el resultado, nunca en el historial ni para la profesora. Si corresponde una celebración ya aprobada, su efecto empieza después de los 240 ms de la revelación, sin retrasar el texto, el foco ni la siguiente acción. Con movimiento reducido, ambos efectos se omiten.

## 5. Contrato de API

No aplica: no se crean ni cambian endpoints, DTO, errores ni llamadas para persistir la apariencia. Se reutilizan los contratos de [SPEC-02 a SPEC-11](./README.md).

## 6. Modelo de datos

No aplica: sin tablas, columnas ni migraciones. La preferencia de apariencia de pestaña almacena solo `light` o `dark`; nunca se incluye en el perfil ni se sincroniza entre cuentas.

## 7. Interfaz

| Familia | Destinos y estados |
| --- | --- |
| Público | `/`, `/login`, `/registro`, `/recuperar-contrasena`, `/restablecer/[token]`, `/terminos`. Mantener texto legal y respuestas de envío y aprobación; contenido de portada según el plan §4. |
| Inicio | `/inicio` compartido. Alumno: misiones y filtros. Profesora: cola de solicitudes y entregas con datos reales. |
| Alumno | `/juegos`, `/actividad/[attemptId]`, `/progreso`, `/feedback`, `/extra`, `/perfil`. En ejercicios la barra de acciones sustituye al pie informativo, no a los destinos de navegación; se reserva espacio para ambas barras y el área segura. |
| Profesora | `/actividades`, `/actividades/nueva`, `/actividades/[id]`, `/asignaciones`, `/asignaciones/nueva`, `/asignaciones/[id]`, `/revision`, `/estadisticas`, `/estadisticas/estudiantes/[id]`, `/grupos`, `/grupos/[id]`, `/alumnos`, `/alumnos/[id]`, `/alumnos/solicitudes`, `/alumnos/bloqueados`, `/contenido-extra`. Superficies de lectura planas, acciones explícitas y feedback de operación. |
| Sistema | `/offline`, no encontrada, error de segmento y error global. `/recuperar` → `/recuperar-contrasena`; `/contenidos` → `/actividades`; `/contenidos/onboarding` → `/actividades/nueva`; `/juegos/[activityId]` → `/juegos`. |

Los componentes reutilizan las etiquetas de las acciones existentes. Los destinos, accesos por avatar y distancias máximas permanecen como en [architecture §3.1](../planning/architecture-overview.md#31-estructura-de-rutas--decidido). Los estados comúnmente aplicables son carga, vacío, error, éxito y deshabilitado; en diálogos se conserva foco, Escape y retorno.

## 8. Seguridad y privacidad

Origami no modifica guards, filtros por tenant o alumno, URLs de audio, política de caché, ni CSP. La apariencia no concede acceso y no almacena identificadores. Se conservan la limpieza de datos al cerrar sesión y la omisión de datos personales en logs. Las capturas para aprobación se generan con datos sintéticos.

## 9. Pruebas

| RF | Tarea | Nivel y prueba prevista |
| --- | --- | --- |
| RF-1 | ENG-163, ENG-166 | Navegador: `RF-1: matriz de tokens y reflujo`, capturas a 390 × 844, 800 × 1280 y 1280 × 800; comprobaciones a 320 px, zoom 200 % y con textos largos. |
| RF-2 | ENG-163 | Navegador: `RF-2: sistema, elección, recarga y almacenamiento bloqueado`, en público, Kids, Teens y docente sin mutación de perfil ni destello de la apariencia contraria. |
| RF-3 | ENG-163 | Navegador: `RF-3: renovación conserva; salida y cambio de cuenta limpian`, incluida una tablet compartida y un cierre de sesión recibido desde otra pestaña mediante la coordinación existente. |
| RF-4 | ENG-164, ENG-165 | Navegador: `RF-4: portada, accesos y estados de identidad`, incluyendo anclas a tamaño móvil, destinos reales y ausencia de intentos desde los ejemplos. |
| RF-5 | ENG-163, ENG-166 | Navegador y teclado: `RF-5: navegación por rol, flags y punto de quiebre`, verificando foco, destinos y máximos de clics a ambos lados de 1024 px. |
| RF-6 | ENG-164, ENG-165 | E2E de regresión: `RF-6: actividad y seguimiento sin cambios de negocio`, cubriendo las cinco mecánicas de juego, los cinco tipos de actividad, audio, notas, estrellas y desconexión/reintento. |
| RF-7 | ENG-164, ENG-165 | E2E de regresión: `RF-7: asignar y revisar con selección persistente`, más controles de autoría, vista previa, estadísticas y gestión por ruta. |
| RF-8 | ENG-165, ENG-166 | Navegador, axe y revisión manual: `RF-8: estados de sistema, redirecciones y WCAG 2.2 AA`, con teclado, lector de pantalla, tacto, contraste y movimiento reducido. |
| RF-9 | ENG-166 | Inspección del informe: `RF-9: cobertura completa del candidato UI`, contra el inventario de rutas y la matriz de aceptación del plan §7. |

La extensión de las referencias no espera la prueba física ([architecture §14.9](../planning/architecture-overview.md#149-secuencia-de-validación-de-origami-en-ui--decidido-2026-11-18)). Para la aceptación final se prueba una consigna Kids, una misión Teens y una corrección docente en tablet compartida, en claro y oscuro, junto con las demás rutas del candidato completo. También se comprueba grabación y reproducción en dispositivos reales del piloto (incluido Safari en iOS y tablet Android) y se documenta la observación con tres niños por segmento. La emulación no reemplaza esta evidencia.

## 10. Fuera de alcance y decisiones diferidas

- La adopción final, fusión y despliegue no forman parte de la aprobación de SPEC-12. Requieren evidencia de la rama y una decisión posterior del líder.
- No se añaden registro docente, pantallas de familias, gamificación pública, nuevos datos académicos ni capacidades excluidas por CONTEXT §2.4.

## 11. Preguntas abiertas

No quedan preguntas abiertas que bloqueen el contrato. La aprobación habilita las tareas ENG en `UI`. La adopción sigue pendiente de una decisión del líder tras recibir la evidencia completa de la rama.

## 12. Registro de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-11-17 | Creación y propuesta En revisión | Documentar el candidato Origami, delimitar la rama y separar aprobación de implementación de aceptación definitiva. |
| 2026-11-17 | Aprobada por el líder del proyecto | Habilitar ENG-163 a ENG-166 en `UI`, según sus dependencias, sin aprobar la adopción, fusión ni publicación. |
| 2026-11-18 | Secuencia de validación física actualizada por autorización del líder | Ejecutar los recorridos físicos de las referencias junto con los de las demás rutas, sin omitir las pruebas de aceptación. |
