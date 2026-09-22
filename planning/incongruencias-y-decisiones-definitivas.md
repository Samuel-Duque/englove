# Englove — Resolución de Incongruencias e Implementación de Decisiones Definitivas

> **Propósito de este documento.**
> Este es un prompt operativo de alto nivel dirigido a cualquier agente, desarrollador o colaborador que trabaje en el proyecto Englove. Recoge todas las decisiones tomadas en la sesión del 2026-09-22 que corrigen incongruencias existentes en la documentación de planificación, eliminan riesgos futuros y fijan convenciones definitivas que **no pueden ser contradichas, ignoradas ni cuestionadas** sin registrar primero una nueva decisión en `CONTEXT.md §14`.
>
> **Instrucción general de aplicación:** Cada sección de este documento identifica una incongruencia o riesgo, describe la decisión que lo resuelve y ordena explícitamente qué debe modificarse o eliminarse en los documentos de planificación existentes (`CONTEXT.md`, `architecture-overview.md`, `pbp-development.md`, `taskboard.md` y las specs que correspondan). Al final del documento se incluye un **análisis de cierre** que verifica que no queden incongruencias ni riesgos sin resolver.
>
> Ningún agente ni persona puede iniciar trabajo de implementación en un área cubierta por este documento sin haber aplicado primero los cambios aquí ordenados a la documentación de planificación.

---

## Índice

1. Eliminación completa del rol y entidad `Guardian` — datos del acudiente absorbidos por `Student`
2. Eliminación total de todo lo relacionado con consentimiento legal de menores
3. Timestamps de actividad tomados en el servidor, no en el dispositivo
4. Notificación in-app de actualizaciones del aplicativo (PWA)
5. Gestión de calificaciones y feedback vía correo electrónico
6. Alcance del piloto: ítems mixtos de calificación y política de audios
7. Control de acceso al panel estadístico exclusivamente por RBAC
8. Sección de estudiantes bloqueados y recordatorios en el dashboard
9. Algoritmo definitivo de rachas semanales
10. Comportamiento definitivo del `due_at` al iniciar un intento antes del cierre
11. Convención definitiva de ítems no respondidos y publicación de exámenes
12. Normalización automática de pesos en exámenes
13. Restricciones definitivas de duración de audios de speaking
14. Denominador histórico congelado al borrar un alumno
15. Lógica definitiva del `age_segment` y cambio de interfaz
16. Seeds de datos operativos para testing
17. Estados de error en la aplicación
18. Correo de pendientes a la profesora cada 3 días
19. Manual de uso de la aplicación para la profesora
20. Rate limiting y protección de la API contra ataques
21. Almacenamiento: Cloudflare R2 reemplaza Supabase Storage para archivos
22. Compatibilidad cross-browser para grabación de audios de speaking
23. Análisis de cierre — verificación de incongruencias y riesgos restantes

---

## 1. Eliminación completa del rol y entidad `Guardian` — datos del acudiente absorbidos por `Student`

### Incongruencia detectada

Los documentos actuales (`CONTEXT.md §3`, `architecture-overview.md §4.1`, `taskboard.md` tareas ENG-022, ENG-044) hacen referencia al rol `guardian` como un rol con cuenta propia, pantalla de acceso y gestión de T&C. Existen endpoints `GET/POST/PATCH /guardians` y la tarea ENG-022 construye CRUD de `Guardian` con "aceptación de T&C". Esto es incongruente con la decisión de que el único rol activo en el piloto sea `student`.

### Decisión definitiva — Carácter absoluto

**El rol `guardian` y la entidad `Guardian` se eliminan por completo del sistema.** No existirá tabla `Guardian`, no existirá módulo `guardians`, no existirá ningún endpoint relacionado con guardianes, no existirá el valor `guardian` en el enum `Role`, y no existirá ninguna referencia a esta entidad en ninguna capa del sistema: ni en la base de datos, ni en la API, ni en el frontend, ni en la documentación.

**Los datos del acudiente se almacenan directamente en el modelo `Student`** como campos opcionales:

- `guardian_name`: nombre del acudiente (string, nullable).
- `guardian_contact`: medio de contacto del acudiente — teléfono o correo — (string, nullable).

Estos campos se capturan en el formulario de auto-registro del alumno y son editables posteriormente **solo por la profesora** desde el panel de gestión de alumnos. El alumno no puede modificarlos por su cuenta.

No existe ningún otro modelo, tabla, relación ni referencia a acudientes en el sistema. La relación de tutela legal es un asunto externo a la plataforma (ver §2).

**El alumno siempre se registrará con un correo y contraseña creada por él mismo**, con los siguientes requisitos: mínimo 8 caracteres, máximo 16 caracteres, sin espacios. Existe opción de recuperación de contraseña vía correo.

**Cambio de correo desde el perfil del alumno:** hay opción de cambiar el correo con verificación en dos pasos (OTP enviado al correo actual o nuevo) para confirmar que quien realiza el cambio es efectivamente el alumno. Esto cubre el caso en que el alumno se registró con el correo del acudiente y posteriormente desea cambiarlo al suyo propio.

**La profesora no da contraseñas temporales.** La única vía de acceso es el registro autónomo del estudiante. La profesora puede iniciar una recuperación de contraseña en casos de bloqueo o pérdida, enviando el enlace al correo registrado del alumno.

### Qué modificar o eliminar en la documentación

| Documento                                                | Acción                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTEXT.md §3` (Usuarios y roles)                       | Eliminar completamente la subsección de Acudientes. En Estudiantes, documentar `guardian_name` y `guardian_contact` como campos opcionales de `Student`. Eliminar `guardian` del enum de roles.                                       |
| `CONTEXT.md §4` (Autenticación)                          | Eliminar toda referencia a "cuenta hija vinculada a un acudiente". El alumno es un usuario independiente con sus propias credenciales.                                                                                                |
| `CONTEXT.md §4.1` (Registro)                             | Reescribir: el formulario captura `guardian_name` y `guardian_contact` como campos del mismo `Student`. No se crea ninguna entidad separada. Agregar requisitos de contraseña (8–16 chars, sin espacios) y flujo de cambio de correo. |
| `CONTEXT.md §2.2` (Fase 2)                               | Eliminar "Rol de acudientes: supervisión del progreso". Si en Fase 2 se desea ese rol, será una decisión nueva en §14.                                                                                                                |
| `architecture-overview.md §1` (diagrama)                 | Eliminar cualquier nodo o referencia a `Guardian` en el diagrama de arquitectura.                                                                                                                                                     |
| `architecture-overview.md §4.1` (módulos)                | **Eliminar el módulo `guardians` completamente** de la tabla de módulos. Sus datos ya viven en `Student`.                                                                                                                             |
| `architecture-overview.md §6.1` (ERD)                    | Eliminar la entidad `Guardian` y todas sus relaciones del diagrama ER.                                                                                                                                                                |
| `architecture-overview.md §6.3` (Enums)                  | Eliminar `guardian` del enum `Role`. Dejar `teacher`, `student`, `parent` (reservado, Fase 2), `admin` (reservado).                                                                                                                   |
| `architecture-overview.md §6.4`                          | Eliminar toda la entrada de `Guardian`. En el modelo `Student`, agregar `guardian_name` (string, nullable) y `guardian_contact` (string, nullable).                                                                                   |
| `architecture-overview.md §7.2` (Flujo de auto-registro) | Reescribir: `POST /auth/signup` crea solo `User` + `Student`. No crea `Guardian`. Los datos del acudiente van en el body como campos de `Student`.                                                                                    |
| `taskboard.md ENG-013`                                   | Eliminar `Guardian` del `schema.prisma`. Agregar `guardian_name` y `guardian_contact` en el modelo `Student`.                                                                                                                         |
| `taskboard.md ENG-022`                                   | **Eliminar la tarea completa.** No existe CRUD de `Guardian`.                                                                                                                                                                         |
| `taskboard.md ENG-029`                                   | Reescribir: `POST /auth/signup` crea `User` + `Student` sin `Guardian`. Los campos del acudiente son parte del body. Agregar requisitos de contraseña.                                                                                |
| `taskboard.md ENG-041`                                   | Reescribir: la gestión de alumnos en el panel edita directamente `guardian_name` y `guardian_contact` en `Student`. No hay pantalla de acudiente separada.                                                                            |
| `taskboard.md ENG-044` (Bandeja de solicitudes)          | Reescribir: al aprobar, la profesora puede editar `guardian_name` y `guardian_contact` del `Student` directamente.                                                                                                                    |
| `packages/shared/enums.ts`                               | Eliminar `guardian` del enum `Role` cuando se cree el archivo.                                                                                                                                                                        |
| `schema.prisma`                                          | No crear tabla `Guardian`. Agregar `guardian_name` y `guardian_contact` en el modelo `Student`.                                                                                                                                       |

---

## 2. Eliminación total de todo lo relacionado con consentimiento legal de menores

### Incongruencia detectada

Los documentos actuales incluyen extensas referencias a: `ConsentRecord`, `consent_status`, `ConsentStatus` enum (`pending`, `signed_paper`, `signed_digital`), `ConsentMethod`, tarea ENG-042 ("ConsentRecord en papel"), tarea ENG-006 ("documentos legales: autorización parental en papel, Ley 1581 de 2012, T&C del acudiente, política de privacidad para padres"), tarea ENG-136 ("consentimientos en papel recogidos y registrados para el 100% de los alumnos activos") y múltiples referencias en `CONTEXT.md §9` a la Ley 1581 y privacidad de menores.

### Decisión definitiva — Carácter absoluto

**La aplicación Englove no tendrá ningún apartado, módulo, tabla, campo, endpoint, pantalla, tarea ni referencia documental relacionada con el consentimiento legal de información de menores, la Ley 1581 de 2012, la autorización parental de tratamiento de datos ni ningún otro aspecto de cumplimiento legal sobre menores.**

Esto es responsabilidad exclusiva de la clienta (la profesora), quien gestiona estos asuntos por fuera de la plataforma. La aplicación **no se hace responsable** del tratamiento de estos aspectos legales y no construirá ninguna funcionalidad relacionada con ellos.

Lo único que permanece en la plataforma en materia de acuerdos es un **Términos y Condiciones convencional** de uso de la aplicación, el cual es aceptado por el alumno al registrarse (checkbox estándar con enlace al documento). No hay consentimiento parental, no hay firma digital de tutores, no hay registro de autorización, no hay campo `consent_status`, no hay tabla `ConsentRecord`.

### Qué modificar o eliminar en la documentación

| Documento                                           | Acción                                                                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CONTEXT.md §9`                                     | Eliminar la sección completa o reemplazarla por una nota que diga: "El tratamiento legal de datos de menores es responsabilidad de la clienta. La plataforma ofrece únicamente T&C convencional de uso."                             |
| `CONTEXT.md §4.1`                                   | Eliminar la frase "el consentimiento de tratamiento de datos del menor sigue siendo el registro en papel que gestiona la profesora". Reemplazar por una indicación de que el formulario incluye aceptación de T&C estándar, sin más. |
| `CONTEXT.md §2.4`                                   | Eliminar la fila "Firma digital de consentimiento / Consentimiento en papel + estado en plataforma". No hay consentimiento de ningún tipo en la plataforma.                                                                          |
| `CONTEXT.md §2.2` (Fase 2)                          | Eliminar "Consentimiento parental con firma digital y checkbox en el registro".                                                                                                                                                      |
| `architecture-overview.md §6.1` (ERD)               | Eliminar la entidad `ConsentRecord` del diagrama.                                                                                                                                                                                    |
| `architecture-overview.md §6.3` (Enums)             | Eliminar `ConsentStatus` y `ConsentMethod` del listado de enums.                                                                                                                                                                     |
| `architecture-overview.md §6.4`                     | Eliminar `Student.consent_status` y toda referencia a `ConsentRecord`.                                                                                                                                                               |
| `architecture-overview.md §4.1` (módulo `students`) | Eliminar `POST /students/:id/consent` de la tabla de endpoints.                                                                                                                                                                      |
| `taskboard.md ENG-006`                              | Eliminar la tarea completa. No se redactan documentos legales de menores.                                                                                                                                                            |
| `taskboard.md ENG-042`                              | Eliminar la tarea completa. No existe `ConsentRecord`.                                                                                                                                                                               |
| `taskboard.md ENG-044`                              | Eliminar la mención a "registrar el consentimiento en papel" del flujo de aprobación.                                                                                                                                                |
| `taskboard.md ENG-136`                              | Eliminar la tarea completa.                                                                                                                                                                                                          |
| `pbp-development.md Etapa 0`                        | Eliminar de los entregables "documentos legales: autorización parental...".                                                                                                                                                          |
| `pbp-development.md Etapa 3`                        | Eliminar la referencia a `ConsentRecord` del alcance.                                                                                                                                                                                |
| `pbp-development.md Etapa 11`                       | Eliminar el criterio de salida relacionado con consentimientos.                                                                                                                                                                      |
| `packages/shared/enums.ts`                          | Eliminar `ConsentStatus` y `ConsentMethod` cuando se creen los archivos.                                                                                                                                                             |
| `schema.prisma`                                     | No crear la tabla `ConsentRecord` cuando se redacte el esquema.                                                                                                                                                                      |

---

## 3. Timestamps de actividad tomados en el servidor, no en el dispositivo

### Incongruencia detectada

Los documentos no especifican explícitamente qué reloj gobierna `started_at` y `ended_at` (o `finished_at`) en `Attempt`. La ausencia de esta especificación abre la puerta a implementar estas marcas de tiempo desde el cliente, lo que permitiría manipulación de los tiempos de inicio y finalización de una actividad.

### Decisión definitiva

Los campos `started_at` y `finished_at` (y cualquier equivalente temporal en `Attempt`, `ProgressEvent` o `Review`) **se asignan exclusivamente en el servidor en el momento en que la API recibe y procesa la petición**. El cliente nunca envía ni sugiere estos valores; si los envía, se ignoran.

La hora del servidor es la fuente única de verdad temporal. Esto elimina la posibilidad de fraude por manipulación del reloj del dispositivo y garantiza coherencia en las estadísticas de duración, validación de plausibilidad (`implausible_duration`) y cálculo de rachas.

### Qué modificar o eliminar en la documentación

| Documento                                      | Acción                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `architecture-overview.md §4.4` (Scoring)      | Agregar nota explícita: "Los campos `started_at` y `finished_at` son asignados por el servidor. El cliente nunca los envía."                                                                           |
| `architecture-overview.md §6.2` (Convenciones) | Agregar convención: "Toda marca de tiempo en tablas de tenant se escribe en el servidor (`now()` de PostgreSQL o `new Date()` de NestJS). Los campos de tiempo no son parte de ningún DTO de entrada." |
| `packages/shared` (cuando se creen DTOs)       | Los DTOs de `start`, `events` y `complete` no incluirán campos de timestamp.                                                                                                                           |
| Specs SPEC-05 y SPEC-07                        | Incluir como regla de negocio explícita: "El reloj es el del servidor. Los eventos `started_at`, `finished_at`, `reviewed_at` y `graded_at` se calculan en NestJS."                                    |

---

## 4. Notificación in-app de actualizaciones del aplicativo (PWA)

### Incongruencia detectada

Los documentos de planificación no contemplan ningún mecanismo para notificar al usuario cuando hay una nueva versión del aplicativo disponible. Esto es un riesgo operativo en una PWA: si el service worker actualiza silenciosamente, el usuario puede quedar en un estado inconsistente. Si no se notifica, el usuario puede seguir usando una versión desactualizada indefinidamente.

### Decisión definitiva

Cuando el service worker detecte que existe una nueva versión del frontend o cuando la API responda con un header indicando una nueva versión de backend incompatible, **la aplicación mostrará una notificación in-app** (no un pop-up bloqueante del sistema) que le indique al usuario: _"Hay una actualización disponible. La aplicación necesita reiniciarse para aplicar los cambios."_ La notificación incluirá un botón de acción para reiniciar y aplicar la actualización de manera inmediata.

Este mecanismo aplica tanto al panel de la profesora como al portal del alumno, con el texto adaptado al tono de cada interfaz (más simple y visual en Kids).

### Qué modificar o eliminar en la documentación

| Documento                            | Acción                                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §10` (PWA) | Agregar apartado de "Gestión de actualizaciones": detección de nueva versión del SW, notificación in-app, botón de reinicio y aplicación de cambios. |
| `taskboard.md ENG-110`               | Ampliar el alcance del service worker para incluir la lógica de detección de actualización y la notificación in-app.                                 |
| `pbp-development.md Etapa 9`         | Incluir en el alcance la notificación de actualizaciones como parte del trabajo del service worker.                                                  |

---

## 5. Gestión de calificaciones y feedback vía correo electrónico

### Incongruencia detectada

Los documentos actuales no especifican con precisión el canal de notificación cuando una actividad es calificada. Existe ambigüedad sobre si la nota y el feedback se envían por correo o solo dentro de la app.

### Decisión definitiva

Cuando una actividad del alumno es calificada por la profesora:

1. **Se envía un correo de notificación al alumno** informándole que su actividad ya fue calificada y que puede ingresar a la aplicación a verla.
2. **El correo no incluye la nota ni el feedback.** Solo contiene la notificación y un enlace a la sección de feedback dentro de la app.
3. **La nota y el feedback se visualizan únicamente dentro de la aplicación**, en la sección de feedback del portal del alumno.

Este diseño protege la privacidad de las calificaciones en el correo y obliga al alumno a volver a la aplicación para ver el detalle, lo que refuerza el engagement con la plataforma.

### Qué modificar o eliminar en la documentación

| Documento                                                          | Acción                                                                                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §4.5` (Jobs) y `§4.1` (módulo `reviews`) | Agregar: al completar una revisión, se dispara `MailService.sendGradingNotification(studentEmail)` con el correo de notificación sin nota ni feedback.     |
| `taskboard.md ENG-092`                                             | Agregar como criterio: "Al calificar, se envía correo de notificación al alumno sin incluir nota ni feedback."                                             |
| `taskboard.md ENG-019`                                             | Agregar plantilla de correo `grading-notification` al `MailService`.                                                                                       |
| Spec SPEC-07                                                       | Incluir como RF: "El correo de notificación de calificación no contiene la nota ni el feedback. Contiene únicamente la notificación y el enlace a la app." |

---

## 6. Alcance del piloto: ítems mixtos de calificación y política de audios

### Incongruencia detectada

Los documentos mencionan los tipos de actividad del piloto pero no confirman explícitamente que **el piloto incluirá todos los tipos mixtos de calificación en su primera versión**: juegos, preguntas abiertas, exámenes gramaticales tipo fill the blank y audios de speaking. Tampoco está claramente documentada la política de retención y descarga de audios desde el panel de la profesora.

### Decisión definitiva

**El piloto incluye todos los siguientes tipos de ítem desde su primera versión operativa:**

- Juegos (mecánicas: match, order_words, drag_drop, memory, timed_choice)
- Preguntas abiertas (calificación manual)
- Exámenes gramaticales tipo fill the blank (calificación automática)
- Audios de speaking (calificación manual)

**Política de audios:**

- Los audios se almacenan en Cloudflare R2 (ver §21) por un máximo de **30 días tras ser calificados** (`retention_until = graded_at + 30 días`).
- La profesora, desde su panel de revisión, tiene la opción de **descargar el audio localmente** a su dispositivo antes de que se cumpla el plazo de retención. Esto le permite conservar un registro del progreso de speaking del estudiante si así lo desea.
- Los audios en estado `pending_upload` se eliminan a los 7 días si no fueron confirmados.

### Qué modificar o eliminar en la documentación

| Documento                       | Acción                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `CONTEXT.md §5.1`               | Confirmar que el piloto incluye los cuatro tipos desde el inicio.                            |
| `architecture-overview.md §4.5` | Confirmar la política de retención: 30 días post-calificación, 7 días para `pending_upload`. |
| `taskboard.md ENG-091`          | Agregar el botón de descarga de audio en el panel de revisión de la profesora.               |
| `taskboard.md ENG-095`          | Confirmar que el job de retención respeta los 30 días definidos.                             |

---

## 7. Control de acceso al panel estadístico exclusivamente por RBAC

### Incongruencia detectada

Los documentos hacen referencia a feature flags (`stats`, `leaderboard`) para controlar el acceso al panel estadístico. Esto introduce una capa de control adicional innecesaria para el piloto, donde la profesora es la única que verá estas secciones.

### Decisión definitiva

El acceso al panel estadístico completo (leaderboard, dashboard estadístico, vistas de rendimiento y constancia) se controla **únicamente por RBAC**: si el rol del JWT es `teacher`, se concede acceso; de lo contrario, se responde `403 Forbidden`. No se usa `FeatureFlag` para controlar el acceso a estas secciones.

Los flags `stats` y `leaderboard` **se eliminan** del listado de feature flags iniciales. Los únicos feature flags que permanecen son: `games`, `extra_content`, configuración `passing_score`, `retention_days` y `pending_upload_ttl_days`.

Justificación: la profesora es la única usuaria del panel estadístico en toda la vida del piloto. Agregar una capa de feature flag sobre el RBAC es sobreingeniería que añade complejidad sin beneficio real.

### Qué modificar o eliminar en la documentación

| Documento                                                   | Acción                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §6.4` (FeatureFlag)               | Eliminar `stats` y `leaderboard` de las claves iniciales de `FeatureFlag`.                                                                              |
| `taskboard.md ENG-018`                                      | Eliminar `stats` y `leaderboard` de las claves iniciales del seed de `FeatureFlag`.                                                                     |
| `taskboard.md ENG-102`                                      | El test de 403 para `student` en el leaderboard se mantiene, pero la restricción viene del `RolesGuard`, no de un feature flag. Actualizar descripción. |
| `architecture-overview.md §9` (Gamificación y estadísticas) | Clarificar que el acceso es solo por RBAC, sin doble capa de flags.                                                                                     |

---

## 8. Sección de estudiantes bloqueados y recordatorios en el dashboard

### Incongruencia detectada

Los documentos no contemplan una sección dedicada para la administración rápida de estudiantes bloqueados ni recordatorios contextuales en el dashboard de la profesora que la alerten de situaciones pendientes de atención.

### Decisión definitiva

**Sección de estudiantes bloqueados:** Se agrega una sección dedicada en el panel de la profesora (`/alumnos/bloqueados` o como pestaña dentro de `/alumnos`) donde puede ver el listado de alumnos con cuenta bloqueada por intentos fallidos, con la opción de desbloquear manualmente y de manera ágil.

**Recordatorios en el dashboard:** El dashboard de la profesora mostrará tarjetas de recordatorio contextuales para:

- Solicitudes de registro de alumnos pendientes de aprobación (con contador).
- Actividades sin calificar hace más de N días (umbral configurable, valor por defecto: 3 días).

Estos recordatorios son simples, no invasivos, y no sobrecargan el dashboard. Su diseño es minimalista: contador + enlace directo a la sección correspondiente.

### Qué modificar o eliminar en la documentación

| Documento                                           | Acción                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §3.1` (Rutas del teacher) | Agregar la sección de estudiantes bloqueados en la estructura de rutas: `/alumnos/bloqueados` o como pestaña en `/alumnos`.            |
| `taskboard.md ENG-041`                              | Agregar la sección de estudiantes bloqueados como parte del alcance de gestión de alumnos.                                             |
| `taskboard.md ENG-101` (Panel estadístico)          | Separar la lógica del dashboard de recordatorios del panel estadístico. Crear tarea específica para los recordatorios en el dashboard. |
| `pbp-development.md Etapa 3`                        | Incluir en el alcance la sección de estudiantes bloqueados y los recordatorios del dashboard.                                          |

---

## 9. Algoritmo definitivo de rachas semanales

### Incongruencia detectada

Los documentos mencionan el concepto de "racha perdonable" pero no documentan con precisión suficiente el algoritmo completo, lo que deja margen de interpretación en la implementación.

### Decisión definitiva — Algoritmo vinculante

El algoritmo de rachas funciona de la siguiente manera:

1. **Solo las semanas activas cuentan para la racha.** Las semanas perdonadas no suman a la racha; son semanas neutras.
2. **El perdón de racha solo se puede usar si hay una racha activa.** Si el estudiante tiene 0 semanas de racha (no ha iniciado su proceso), el perdón no puede aplicarse. No hay racha que perdonar.
3. **Para conseguir un perdón de racha tras haberlo usado,** el estudiante debe completar dos semanas activas consecutivas. Solo entonces recupera el derecho a un nuevo perdón.
4. **Los perdones de racha no son acumulables.** El máximo en cualquier momento es uno (1). Completar dos semanas activas tras un perdón usado restaura el perdón; completar más semanas activas no suma perdones adicionales.

### Qué modificar o eliminar en la documentación

| Documento                                    | Acción                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §9` (Gamificación) | Documentar el algoritmo completo de rachas con estas cuatro reglas de manera explícita.                                                                                                                                                                          |
| `taskboard.md ENG-068`                       | Agregar como criterio: "El motor de rachas implementa el algoritmo de 4 reglas documentado en §9 de incongruencias. Incluye tests unitarios para cada caso: racha 0 sin perdón posible, perdón usado requiere 2 semanas activas para recuperar, no acumulación." |
| `packages/shared/enums.ts`                   | Verificar que los estados del sistema de rachas cubran los casos del algoritmo.                                                                                                                                                                                  |
| Spec SPEC-05                                 | Incluir como RF con criterios Dado/Cuando/Entonces para cada una de las 4 reglas del algoritmo.                                                                                                                                                                  |

---

## 10. Comportamiento definitivo del `due_at` al iniciar un intento antes del cierre

### Incongruencia detectada

Los documentos no especifican qué sucede cuando un alumno inicia una actividad antes de `due_at` pero la termina después de ese límite. La ausencia de esta regla puede llevar a implementaciones inconsistentes.

### Decisión definitiva

**Si el alumno inicia un intento antes de `due_at` y lo termina después del cierre**, el intento se guarda normalmente. El sistema respeta que el alumno comenzó dentro del tiempo permitido. El intento es válido.

**Si el alumno intenta iniciar un intento después de `due_at`**, el endpoint rechaza la creación del intento. Se muestra una notificación al usuario: _"No fue posible tomar tu intento porque la actividad ya cerró. Comunícate con tu maestra para ver si hay opción de volver a habilitarla."_ El intento queda marcado como abandonado o simplemente no se crea.

La lógica de validación es: **el momento de inicio (`started_at` en el servidor) es el que determina si el intento es válido**, no el momento de finalización.

### Qué modificar o eliminar en la documentación

| Documento                                    | Acción                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §7` (Flujos clave) | Agregar flujo: "Intento iniciado antes de `due_at` pero finalizado después → válido. Intento iniciado después de `due_at` → rechazado con notificación al alumno."                                            |
| `taskboard.md ENG-062`                       | Agregar como criterio: "La validación de `due_at` se aplica al momento de `started_at` (asignado en el servidor). Un intento iniciado antes del cierre siempre puede completarse aunque se finalice después." |
| Spec SPEC-05                                 | Incluir como RF con criterios Dado/Cuando/Entonces para ambos casos.                                                                                                                                          |

---

## 11. Convención definitiva de ítems no respondidos y publicación de exámenes

### Incongruencia detectada

Los documentos no especifican explícitamente qué puntaje recibe un ítem no respondido, ni cuándo se valida si un examen tiene los ítems mínimos para publicarse.

### Decisión definitiva — Dos reglas vinculantes

**Regla 1: Ítems no respondidos.**
Un ítem no respondido recibe puntaje 0 en su scorer. El peso de ese ítem **sí entra en el denominador** del cálculo de la nota final. Esta es la convención estándar en evaluación educativa: no responder equivale a responder incorrectamente. Esta regla aplica a todos los tipos de ítem sin excepción.

**Regla 2: Mínimo de ítems para publicar un examen.**
Un examen requiere **mínimo 2 ítems** para poder publicarse. La validación de este mínimo ocurre en el endpoint `POST /activities/:id/publish`, no al crear la actividad. Esto permite que la profesora guarde un examen incompleto como borrador sin restricciones.

### Qué modificar o eliminar en la documentación

| Documento                                 | Acción                                                                                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §4.4` (Scoring) | Agregar explícitamente: "Ítem no respondido = puntaje 0. El peso entra en el denominador." y "Examen requiere mínimo 2 ítems para publicarse; validación en `POST /activities/:id/publish`." |
| `taskboard.md ENG-064`                    | Agregar casos de prueba: ítem sin respuesta con puntaje 0 y peso en denominador.                                                                                                             |
| `taskboard.md ENG-032`                    | Agregar validación de mínimo 2 ítems en el endpoint de publicación de exámenes.                                                                                                              |
| Spec SPEC-03 y SPEC-05                    | Incluir estas dos reglas como RF con criterios Dado/Cuando/Entonces.                                                                                                                         |

---

## 12. Normalización automática de pesos en exámenes

### Incongruencia detectada

Los documentos no describen qué sucede cuando la suma de pesos de los ítems de un examen no es exactamente 100%. Esto puede generar exámenes con notas incalculables o con resultados inesperados.

### Decisión definitiva

**Los pesos de los ítems de un examen se normalizan automáticamente al guardar**, de manera que siempre sumen exactamente 100%. Si la suma es 99 o 101 (o cualquier valor distinto de 100), el sistema los ajusta proporcionalmente y muestra el valor ajustado en el formulario de la profesora, informándole del ajuste realizado.

El formulario mostrará siempre el peso real de cada ítem tras la normalización. El campo de peso muestra el valor efectivo, no el ingresado antes del ajuste.

Esta normalización respeta la escala de calificación colombiana de 0.0 a 5.0, con umbral de aprobación en 3.0.

### Qué modificar o eliminar en la documentación

| Documento                                 | Acción                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §4.4` (Scoring) | Agregar: "Los pesos de ítems en exámenes se normalizan automáticamente al guardar. La normalización es proporcional y el formulario refleja los valores ajustados." |
| `taskboard.md ENG-038`                    | Agregar como criterio: "Al guardar un examen, los pesos se normalizan a 100%. El formulario muestra el peso ajustado con un mensaje de confirmación del ajuste."    |
| Spec SPEC-03                              | Incluir como RF: "El sistema normaliza los pesos al guardar y notifica el ajuste."                                                                                  |

---

## 13. Restricciones definitivas de duración de audios de speaking

### Incongruencia detectada

Los documentos no especifican los límites de duración mínima y máxima de los audios de speaking, ni si estos límites son configurables por la profesora.

### Decisión definitiva

**Parámetros de duración de audios (valores por defecto, todos configurables):**

- **Duración mínima:** 2 segundos. Un audio de menos de 2 segundos se marca como `implausible_duration` y no se acepta.
- **Duración máxima por defecto:** 2 minutos (120 segundos).
- **Duración máxima absoluta:** 5 minutos (300 segundos). Este es el límite que no puede ser superado bajo ninguna configuración.

**La profesora puede modificar la duración máxima** (dentro del rango 2 seg – 5 min) desde un panel de configuración en cada actividad que requiera audios. Esto le permite delimitar el almacenamiento y la calidad esperada de las respuestas.

### Qué modificar o eliminar en la documentación

| Documento                                  | Acción                                                                                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §3.5` (Speaking) | Agregar los tres parámetros de duración con sus valores por defecto.                                                                                                                                          |
| `taskboard.md ENG-036`                     | Agregar al formulario de speaking: campo de duración mínima (fija, 2 seg) y campo de duración máxima configurable (default 120 seg, max 300 seg).                                                             |
| `taskboard.md ENG-066` (módulo media)      | Agregar validación de duración en el endpoint de confirmación de subida. Audio < 2 seg → rechazado con `AUDIO_IMPLAUSIBLE_DURATION`. Audio > límite configurado → rechazado con `AUDIO_EXCEEDS_MAX_DURATION`. |
| `architecture-overview.md §6.4`            | Agregar campos `min_duration_seconds`, `default_max_duration_seconds` en la configuración de `SpeakingDetail`.                                                                                                |
| Spec SPEC-05                               | Incluir como RF con criterios de rechazo por duración.                                                                                                                                                        |

---

## 14. Denominador histórico congelado al borrar un alumno

### Incongruencia detectada

Los documentos describen el borrado en cascada de un alumno pero no especifican cómo se preservan las estadísticas históricas de asignaciones cuando el alumno que participaba en ellas es eliminado. Esto puede distorsionar promedios y porcentajes históricos.

### Decisión definitiva

**Al borrar un alumno**, se debe registrar en `Assignment` (o en una tabla de auditoría separada) cuántos alumnos tenía cada asignación relevante **en el momento del borrado**, congelando así el denominador histórico. Las estadísticas usan ese denominador congelado para datos del pasado y el denominador actual (alumnos activos) para datos del presente.

Esto garantiza que eliminar a un alumno no altere retroactivamente los promedios de participación o rendimiento de actividades anteriores.

### Qué modificar o eliminar en la documentación

| Documento                                       | Acción                                                                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §6.1` (ERD)           | Agregar campo `historical_student_count` en `Assignment` o crear tabla `AssignmentAuditSnapshot`.                                                                                                        |
| `taskboard.md ENG-070` (Borrado en cascada)     | Agregar como paso del borrado: "Antes de borrar, registrar el denominador histórico de las asignaciones del alumno."                                                                                     |
| `taskboard.md ENG-100` (Consultas estadísticas) | Agregar en la lógica de agregación: "Para datos históricos, usar el denominador congelado de `Assignment.historical_student_count`. Para datos actuales, usar el conteo de alumnos activos en el grupo." |
| Spec SPEC-05 y SPEC-08                          | Documentar la regla del denominador congelado.                                                                                                                                                           |

---

## 15. Lógica definitiva del `age_segment` y cambio de interfaz

### Incongruencia detectada

Los documentos mencionan los segmentos `kids` y `teens` y que se derivan de la fecha de nacimiento, pero no especifican con precisión cuándo se actualiza el segmento ni si el estudiante puede cambiar de interfaz manualmente.

### Decisión definitiva — Lógica vinculante

1. **Interfaz por defecto según edad:**
   - De 7 a 10 años: solo tienen acceso a la interfaz **Kids**. No pueden cambiar.
   - De 11 años en adelante: tienen acceso a **ambas interfaces** (Kids y Teens) y pueden alternar entre ellas desde su perfil.

2. **Actualización automática mensual:** La base de datos ejecuta un job mensual que recalcula la edad de cada estudiante según su `birthDate`. Si un estudiante pasa de 10 a 11 años en ese mes, se le habilita automáticamente la opción de cambiar de interfaz. El cambio no es automático; solo se habilita la opción. El estudiante elige.

3. **Cambio manual de interfaz:** Si el estudiante tiene 11 años o más y elige cambiar de interfaz, se le instala la nueva interfaz correspondiente. Puede alternar entre Kids y Teens cuantas veces quiera desde su perfil.

4. **Valor inicial:** Al registrarse, el `age_segment` se calcula automáticamente a partir de `birthDate`. No requiere que la profesora lo seleccione manualmente en el formulario de aprobación (aunque puede corregirlo si la fecha de nacimiento es errónea).

### Qué modificar o eliminar en la documentación

| Documento                                          | Acción                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTEXT.md §3` (Estudiantes)                      | Actualizar la descripción de segmentos: Kids = 7–10, solo kids; Teens = 11+, puede elegir ambas.                                             |
| `architecture-overview.md §6.3` (Enums)            | Mantener `AgeSegment: kids, teens`. Documentar que un estudiante de 11+ puede tener `age_segment = kids` si eligió quedarse en esa interfaz. |
| `architecture-overview.md §6.4`                    | Agregar campo `can_switch_interface: boolean` en `Student`, que se activa cuando el job mensual detecta que el estudiante cumplió 11 años.   |
| `architecture-overview.md §4.5` (Jobs programados) | Agregar job mensual: "Recalcular edad de estudiantes y activar `can_switch_interface` para quienes cumplen 11 años."                         |
| `taskboard.md ENG-068` o nueva tarea               | Crear tarea para el job mensual de actualización de `age_segment` y activación de `can_switch_interface`.                                    |
| Spec SPEC-05                                       | Incluir como RF el comportamiento del cambio de interfaz y el job mensual.                                                                   |

---

## 16. Seeds de datos operativos para testing

### Incongruencia detectada

Los documentos contemplan un seed mínimo (organización piloto y usuaria profesora) pero no seeds de datos operativos completos para testing del aplicativo con datos realistas.

### Decisión definitiva

Se deben crear seeds completos que cubran:

- **Seed de la profesora:** cuenta activa con datos de acceso funcionales.
- **Seeds de estudiantes:** al menos 10 estudiantes de prueba con distintas características: diferentes niveles MCER (A1–B2), diferentes `age_segment` (kids y teens), diferentes estados (`pending_approval`, `approved`), con intentos de actividad en distintos estados (`graded`, `pending_review`, `abandoned`), con rachas activas y perdonadas.
- **Seeds de actividades:** al menos una actividad de cada tipo (`fill_blank`, `open_question`, `speaking`, `game` × mecánicas, `exam`) en estado `published`.
- **Seeds de asignaciones:** actividades asignadas a grupos con diferentes fechas (abiertas, cerradas, próximas).
- **Seed de volumen** (para pruebas de rendimiento): 100 estudiantes, 3 meses de intentos, como se menciona en ENG-100.

### Qué modificar o eliminar en la documentación

| Documento                    | Acción                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskboard.md ENG-013`       | Ampliar el seed para incluir los datos operativos descritos. Separar en `seed-dev.ts` (datos operativos para desarrollo) y `seed-volume.ts` (datos de volumen para pruebas de rendimiento). |
| `pbp-development.md Etapa 1` | Incluir los seeds operativos como parte del entregable del scaffold.                                                                                                                        |

---

## 17. Estados de error en la aplicación

### Incongruencia detectada

Los documentos no contemplan explícitamente el manejo de estados de error en la interfaz del usuario, lo que puede generar experiencias frustrantes cuando algo sale mal.

### Decisión definitiva

La aplicación debe tener estados de error claros, amigables y contextuales para **toda situación indeseada**, incluyendo:

- Errores de red o servidor (500, 503).
- Acceso no autorizado (401, 403) — con mensaje diferenciado para el alumno ("No tienes acceso a esta sección") sin revelar detalles técnicos.
- Recurso no encontrado (404).
- Actividad cerrada o expirada.
- Intento ya existente sin habilitación.
- Fallo en la subida de audio.
- Cualquier otro error operativo.

Los mensajes de error **no revelan detalles técnicos** (stack traces, códigos internos) al usuario final. En la interfaz Kids, los mensajes son más visuales y simpáticos. En la interfaz Teens y en el panel de la profesora, son más directos pero igualmente claros.

### Qué modificar o eliminar en la documentación

| Documento                                            | Acción                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §3` (Frontend)             | Agregar apartado de manejo de errores en el cliente: componentes de error globales (`ErrorBoundary`), estados de error por zona, mensajes diferenciados por rol e interfaz. |
| `architecture-overview.md §13` (Convenciones de API) | Confirmar que todos los errores devuelven `{ code: string, message: string }` sin datos técnicos internos.                                                                  |
| `taskboard.md ENG-011`                               | Agregar como parte del scaffold del frontend: `ErrorBoundary` global y componentes de estado de error reutilizables.                                                        |
| `pbp-development.md Etapa 1`                         | Incluir los componentes de error como parte del entregable del scaffold del frontend.                                                                                       |

---

## 18. Correo de pendientes a la profesora cada 3 días

### Incongruencia detectada

Los documentos no contemplan un mecanismo de recordatorio periódico a la profesora para alertarla de tareas pendientes en la plataforma.

### Decisión definitiva

**Cada 3 días**, el sistema evaluará si la profesora tiene pendientes en alguna de estas categorías:

- Solicitudes de registro de alumnos sin aprobar.
- Actividades sin calificar con más de N días desde su cierre (valor por defecto: 3 días).

**Si hay al menos un pendiente en cualquiera de estas categorías**, se envía un correo de resumen a la profesora con el detalle de los pendientes y un enlace directo a cada sección.

**Si no hay ningún pendiente**, no se envía ningún correo. El sistema solo envía el correo cuando hay algo que atender.

### Qué modificar o eliminar en la documentación

| Documento                                          | Acción                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `architecture-overview.md §4.5` (Jobs programados) | Agregar job cada 3 días: evaluación de pendientes de la profesora y envío de correo condicional. |
| `taskboard.md ENG-019`                             | Agregar plantilla de correo `teacher-pending-summary` al `MailService`.                          |
| Nueva tarea en el taskboard                        | Crear tarea ENG para el job de pendientes de la profesora, ubicada en la Etapa 8 o 11.           |

---

## 19. Manual de uso de la aplicación para la profesora

### Incongruencia detectada

Los documentos de planificación no contemplan la creación de un manual de uso para la profesora. El onboarding está cubierto por la sesión cronometrada (ENG-043) pero no existe documentación de referencia que la profesora pueda consultar.

### Decisión definitiva

Se creará un **manual de uso explícito, completo y en tono casual** dirigido exclusivamente a la profesora, documentando todas las funcionalidades del panel. El manual debe:

- Estar escrito en español, en tono conversacional y accesible (no técnico).
- Cubrir todas las funcionalidades del panel: gestión de alumnos, grupos, actividades, asignaciones, calificación, feedback, estadísticas, gestión de cuentas bloqueadas y configuración.
- Incluir capturas de pantalla o descripciones claras de cada flujo.
- Estar disponible en formato que la profesora pueda consultar fácilmente (dentro de la app o como documento externo).

### Qué modificar o eliminar en la documentación

| Documento                     | Acción                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskboard.md` (Etapa 11)     | Crear tarea `DOC-06`: redacción del manual de uso de la profesora, con entrega como documento `.md` o como sección de ayuda dentro del panel. |
| `pbp-development.md Etapa 11` | Incluir el manual de uso como entregable de lanzamiento.                                                                                      |

---

## 20. Rate limiting y protección de la API contra ataques

### Incongruencia detectada

Los documentos mencionan `@nestjs/throttler` en la Etapa 2 pero no especifican una política clara y completa de rate limiting que proteja todos los endpoints sensibles y la API en general.

### Decisión definitiva

La API implementará las siguientes políticas de rate limiting para proteger contra ataques de fuerza bruta y abuso:

| Endpoint / Grupo                           | Límite por defecto                       |
| ------------------------------------------ | ---------------------------------------- |
| `POST /auth/login`                         | 10 intentos / 15 minutos por IP          |
| `POST /auth/signup`                        | 10 registros / hora por IP               |
| `POST /auth/forgot-password`               | 5 solicitudes / hora por IP y por correo |
| Endpoints de API general (autenticados)    | 120 peticiones / minuto por usuario      |
| Endpoints de API general (no autenticados) | 30 peticiones / minuto por IP            |

Además, todos los formularios de entrada implementarán validación estricta con `class-validator` y `Zod` para prevenir inyecciones y datos malformados. Los límites son moderados: suficientes para bloquear ataques automatizados sin afectar el uso normal de la aplicación.

### Qué modificar o eliminar en la documentación

| Documento                                 | Acción                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `architecture-overview.md §8` (Seguridad) | Documentar la tabla de rate limits por endpoint y los límites globales.   |
| `taskboard.md ENG-027`                    | Ampliar el alcance del throttler con los límites específicos de la tabla. |
| Spec SPEC-02                              | Incluir la política de rate limiting como requisito de seguridad.         |

---

## 21. Almacenamiento: Cloudflare R2 reemplaza Supabase Storage para archivos

### Incongruencia detectada

Los documentos actuales indican que el almacenamiento de archivos (audios de speaking) se realiza en Supabase Storage. Sin embargo, la capa gratuita de Supabase tiene límites de almacenamiento que pueden generar desbordamiento durante el piloto.

### Decisión definitiva

**El almacenamiento de archivos (audios de speaking y cualquier otro archivo binario) se migra de Supabase Storage a Cloudflare R2.** Cloudflare R2 ofrece mayor almacenamiento en su capa gratuita, lo que evita desbordamientos durante el piloto.

**Supabase sigue siendo el único motor SQL del aplicativo** (PostgreSQL vía Prisma). Solo cambia el destino del almacenamiento de objetos.

| Componente                 | Plataforma               | Capa         |
| -------------------------- | ------------------------ | ------------ |
| Base de datos SQL          | Supabase (PostgreSQL 16) | Gratuita     |
| Frontend                   | Vercel                   | Gratuita     |
| API Backend                | Render                   | Gratuita     |
| Almacenamiento de archivos | **Cloudflare R2**        | **Gratuita** |

**Impacto en la implementación:**

- El módulo `media` de NestJS (`apps/api/src/media`) utilizará el SDK de Cloudflare R2 (`@aws-sdk/client-s3` compatible con S3 API) en lugar del cliente de Supabase Storage.
- Las URLs firmadas se generan con el SDK de R2.
- Las variables de entorno cambiarán de `SUPABASE_STORAGE_*` a `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
- Los buckets en Supabase Storage dejan de usarse.

### Qué modificar o eliminar en la documentación

| Documento                                     | Acción                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `CONTEXT.md §6` (Stack tecnológico)           | Reemplazar "Supabase Storage" por "Cloudflare R2" en la capa de almacenamiento de archivos.                           |
| `architecture-overview.md §1` (Vista general) | Actualizar el diagrama de arquitectura: reemplazar el nodo "Storage privado / audio" de Supabase por "Cloudflare R2". |
| `architecture-overview.md §11` (Despliegue)   | Agregar Cloudflare R2 como plataforma de despliegue. Actualizar la tabla de entornos.                                 |
| `taskboard.md ENG-004`                        | Modificar: ya no se crean buckets en Supabase. Se crea el bucket en Cloudflare R2 y se configuran las credenciales.   |
| `taskboard.md ENG-066` (módulo media)         | Actualizar para usar el SDK de R2 compatible con S3 en lugar del cliente de Supabase Storage.                         |
| `architecture-overview.md §3.5` (Speaking)    | Actualizar la referencia a Supabase Storage por Cloudflare R2.                                                        |
| `.env.example` (cuando se cree)               | Incluir variables de R2 en lugar de las de Supabase Storage.                                                          |

---

## 22. Compatibilidad cross-browser para grabación de audios de speaking

### Incongruencia detectada

El documento `architecture-overview.md §3.5` documenta un riesgo conocido y aceptado: la reproducción de audios grabados en Chrome/Android (`audio/webm;codecs=opus`) es irregular en Safari de escritorio, que es el navegador que puede usar la profesora. La mitigación propuesta era "recomendar Chrome o Edge para el panel de la profesora; evaluar transcodificación en Fase 2". Este enfoque deja el problema sin resolver en el piloto y transfiere la carga operativa al usuario.

El problema raíz no es solo de reproducción sino de **fragmentación de codecs**: cada plataforma graba en un formato distinto y no todos los navegadores reproducen todos los formatos.

| Plataforma del alumno   | Formato grabado          |
| ----------------------- | ------------------------ |
| Chrome / Edge / Android | `audio/webm;codecs=opus` |
| Safari iOS / macOS      | `audio/mp4` (AAC)        |
| Firefox                 | `audio/ogg;codecs=opus`  |

### Decisión definitiva — Dos capas complementarias

Se adopta una solución de **dos capas** que resuelve el problema tanto en el lado del alumno (grabación) como en el de la profesora (reproducción), sin cambiar la arquitectura de R2 ni el contrato de la API.

**Capa 1 — Cliente (grabación óptima por dispositivo):**

Antes de iniciar la grabación, el `useAttempt` hook detecta el formato soportado por el navegador del alumno con `MediaRecorder.isTypeSupported()` y selecciona el mejor codec disponible en el orden de preferencia definido:

```ts
function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}
```

El `mime_type` detectado se envía junto a la confirmación de subida y se persiste en `MediaAsset.mime_type`. El alumno siempre graba en el codec nativo óptimo de su dispositivo, sin fallbacks manuales ni librerías de terceros en este punto.

**Capa 2 — Servidor (transcodificación a MP4/AAC para reproducción universal):**

Al confirmar una subida exitosa (`MediaAsset.status` pasa a `ready`), el módulo `media` de NestJS encola una tarea de transcodificación asíncrona con `ffmpeg` (vía `fluent-ffmpeg`) que convierte el archivo original al formato `audio/mp4` (AAC, mono, 64 kbps). El archivo transcodificado se guarda en R2 como una variante del mismo `MediaAsset` bajo la clave `<assetId>_converted.mp4`. El archivo raw se conserva durante el proceso y se elimina una vez confirmada la conversión exitosa.

La profesora siempre recibe la URL firmada del archivo `_converted.mp4`, que es reproducible en cualquier navegador (Chrome, Safari, Firefox, Edge, iOS, Android). El alumno no recibe ningún audio de vuelta; no hay reproducción en el portal del alumno.

```
Alumno graba
  → WebM | MP4 | OGG (nativo del dispositivo)
  → sube a R2 (raw, clave: <assetId>.<ext>)
  → MediaAsset.status = ready
  → job de transcodificación → MP4/AAC (R2, clave: <assetId>_converted.mp4)
  → MediaAsset.converted_key actualizado
  → profesora reproduce <assetId>_converted.mp4 en cualquier navegador
```

**Manejo de errores de transcodificación:**

Si la transcodificación falla, `MediaAsset` queda con `converted_key = null` y el panel de la profesora muestra el audio raw como fallback, con un aviso visual de que el archivo puede no reproducirse en todos los navegadores. El intento no se bloquea ni se pierde.

**Impacto en la política de retención (§6 y §21):**

- El job de retención elimina tanto el archivo raw como el `_converted.mp4` cuando se cumple `retention_until`.
- El campo `MediaAsset.converted_key` (string nullable) se agrega al modelo.

### Por qué no se usa una librería de encoder WASM en el cliente

Opciones como `extendable-media-recorder` (con encoder WAV) o `RecordRTC` en modo WAV eliminan la fragmentación de codecs en origen, pero producen archivos WAV sin compresión (~10× más pesados que MP4 para la misma duración). Con los límites de duración definidos en §13 (máximo 5 min), un audio en WAV puede pesar hasta ~50 MB, lo que es inviable para alumnos en conexiones móviles. La transcodificación en servidor es más eficiente en términos de peso transferido y no añade dependencias al bundle del cliente.

### Qué modificar o eliminar en la documentación

| Documento                                                  | Acción                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `architecture-overview.md §3.5` (Speaking en el navegador) | Reemplazar la sección completa. Documentar la detección de `mimeType` con `getSupportedMimeType()` y la transcodificación asíncrona en servidor. Eliminar el riesgo conocido de WebM/Opus en Safari y la recomendación de usar Chrome en el panel. |
| `architecture-overview.md §4.1` (módulo `media`)           | Agregar la responsabilidad de transcodificación al módulo `media`: `POST /media/transcode/:id` (interno, no expuesto a clientes) o tarea disparada tras confirmar la subida.                                                                       |
| `architecture-overview.md §4.5` (Jobs programados)         | Agregar el job de transcodificación: "Al confirmar una subida, se encola una tarea `ffmpeg` que convierte el raw a MP4/AAC y actualiza `MediaAsset.converted_key`."                                                                                |
| `architecture-overview.md §6.4` (campos `MediaAsset`)      | Agregar campo `converted_key: string?` (nullable) al modelo `MediaAsset`.                                                                                                                                                                          |
| `taskboard.md ENG-066` (módulo media)                      | Ampliar el alcance para incluir: detección de formato en cliente (`getSupportedMimeType`), endpoint/job de transcodificación en servidor, campo `converted_key`, manejo de fallo con fallback al raw.                                              |
| `taskboard.md ENG-091` (panel de revisión de la profesora) | Actualizar: la URL de reproducción apunta a `converted_key` cuando existe; si es null, apunta al raw con aviso visual.                                                                                                                             |
| `pbp-development.md Etapa 5`                               | Incluir la transcodificación como parte del alcance del módulo de media en la etapa de speaking.                                                                                                                                                   |
| Spec SPEC-05 (speaking)                                    | Agregar como RF: "El audio se transcodifica a MP4/AAC en el servidor tras la subida. La profesora reproduce siempre el archivo convertido. Si la conversión falla, se reproduce el raw con aviso."                                                 |
| `architecture-overview.md §22` (Riesgos residuales)        | Eliminar el punto 1 de riesgos residuales ("Reproducción de WebM/Opus en Safari de escritorio"). Este riesgo queda resuelto con la transcodificación.                                                                                              |

---

## 23. Análisis de cierre — Verificación de incongruencias y riesgos restantes

Este análisis verifica que todas las decisiones tomadas en este documento hayan sido registradas y que no queden incongruencias ni riesgos sin resolver en los documentos de planificación de Englove.

### Lista de verificación por área

| #   | Área                                                                   | Decisión registrada | Documentos afectados identificados      | Estado      |
| --- | ---------------------------------------------------------------------- | ------------------- | --------------------------------------- | ----------- |
| 1   | Eliminación completa del rol y entidad `Guardian` — datos en `Student` | ✓ §1                | CONTEXT, architecture, taskboard        | ✅ Resuelto |
| 2   | Consentimiento legal de menores eliminado completamente                | ✓ §2                | CONTEXT, architecture, taskboard, pbp   | ✅ Resuelto |
| 3   | Timestamps en servidor                                                 | ✓ §3                | architecture, shared, specs             | ✅ Resuelto |
| 4   | Notificación in-app de actualizaciones PWA                             | ✓ §4                | architecture, taskboard, pbp            | ✅ Resuelto |
| 5   | Calificaciones y feedback solo dentro de la app                        | ✓ §5                | architecture, taskboard, specs          | ✅ Resuelto |
| 6   | Piloto incluye todos los tipos mixtos + política de audios             | ✓ §6                | CONTEXT, architecture, taskboard        | ✅ Resuelto |
| 7   | Panel estadístico solo por RBAC, sin feature flags dobles              | ✓ §7                | architecture, taskboard                 | ✅ Resuelto |
| 8   | Estudiantes bloqueados + recordatorios en dashboard                    | ✓ §8                | architecture, taskboard, pbp            | ✅ Resuelto |
| 9   | Algoritmo de rachas (4 reglas)                                         | ✓ §9                | architecture, taskboard, specs          | ✅ Resuelto |
| 10  | `due_at`: validación sobre `started_at` del servidor                   | ✓ §10               | architecture, taskboard, specs          | ✅ Resuelto |
| 11  | Ítems no respondidos = 0 + mínimo 2 ítems para publicar                | ✓ §11               | architecture, taskboard, specs          | ✅ Resuelto |
| 12  | Normalización de pesos en exámenes                                     | ✓ §12               | architecture, taskboard, specs          | ✅ Resuelto |
| 13  | Restricciones de duración de audios                                    | ✓ §13               | architecture, taskboard, specs          | ✅ Resuelto |
| 14  | Denominador histórico congelado al borrar alumno                       | ✓ §14               | architecture, taskboard, specs          | ✅ Resuelto |
| 15  | Lógica de `age_segment` y cambio de interfaz                           | ✓ §15               | CONTEXT, architecture, taskboard, specs | ✅ Resuelto |
| 16  | Seeds de datos operativos para testing                                 | ✓ §16               | taskboard, pbp                          | ✅ Resuelto |
| 17  | Estados de error en la aplicación                                      | ✓ §17               | architecture, taskboard, pbp            | ✅ Resuelto |
| 18  | Correo de pendientes a la profesora cada 3 días                        | ✓ §18               | architecture, taskboard                 | ✅ Resuelto |
| 19  | Manual de uso para la profesora                                        | ✓ §19               | taskboard, pbp                          | ✅ Resuelto |
| 20  | Rate limiting y protección de la API                                   | ✓ §20               | architecture, taskboard, specs          | ✅ Resuelto |
| 21  | Cloudflare R2 reemplaza Supabase Storage                               | ✓ §21               | CONTEXT, architecture, taskboard        | ✅ Resuelto |
| 22  | Compatibilidad cross-browser para grabación y reproducción de audios   | ✓ §22               | architecture, taskboard, specs          | ✅ Resuelto |

### Riesgos residuales conocidos y aceptados

Los siguientes riesgos existen en el proyecto pero son conocidos, documentados y **aceptados conscientemente**. No requieren acción inmediata, pero deben ser monitoreados:

1. **Límites de la capa gratuita de Render (API):** las instancias gratuitas de Render se duermen tras inactividad. Esto es aceptable en staging. En producción, se contrata una instancia activa antes del lanzamiento del piloto.

2. **Límites de la capa gratuita de Supabase (PostgreSQL):** con hasta 100 estudiantes y 3 meses de piloto, los límites de la capa gratuita de Supabase son suficientes. Se monitorea el uso y se evalúa la actualización si el piloto supera las expectativas.

3. **Formulario de auto-registro abusado por bots:** el throttler estricto en `POST /auth/signup` (10 por hora por IP) es la primera línea de defensa. Si se detecta abuso sistemático, se puede agregar un CAPTCHA en la Etapa 2 sin cambios de arquitectura.

4. **Disponibilidad de dispositivos iOS para pruebas de speaking:** `MediaRecorder` en iOS Safari tiene comportamiento irregular. La mitigación es probar en dispositivo real en la primera semana de la Etapa 5.

### Conclusión del análisis

**No quedan incongruencias ni riesgos desconocidos sin resolver en la documentación de planificación de Englove** una vez aplicados todos los cambios ordenados en este documento. Todos los riesgos residuales listados arriba son conocidos, tienen mitigación documentada y son aceptables para el piloto.

---

## Instrucción final de aplicación

Antes de iniciar cualquier spec (SPEC-01 en adelante), el líder del proyecto o el agente responsable de la documentación debe:

1. Aplicar **todos** los cambios ordenados en las tablas "Qué modificar o eliminar" de cada sección de este documento a `CONTEXT.md`, `architecture-overview.md`, `pbp-development.md` y `taskboard.md`.
2. Verificar que ningún documento de planificación contenga referencias a: rol `guardian` con cuenta propia, `ConsentRecord`, `ConsentStatus`, `ConsentMethod`, Supabase Storage para archivos, feature flags `stats` y `leaderboard`, ni ningún otro elemento marcado para eliminación en este documento.
3. Registrar en `CONTEXT.md §14` una entrada que confirme la aplicación de este documento como decisión de proyecto.
4. Solo después de completar los pasos 1–3, se puede iniciar la redacción de SPEC-01.

**Este documento es vinculante. Sus decisiones no pueden ser contradichas, ignoradas ni cuestionadas sin registrar primero una nueva decisión en `CONTEXT.md §14` que explique el motivo del cambio y lo apruebe el líder del proyecto.**

---

_Documento creado: 2026-09-22. Aplicable desde esta fecha a toda la documentación de planificación de Englove._
