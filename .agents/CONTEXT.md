# Englove — Contexto raíz del proyecto

> **Propósito de este documento.** Fuente única de verdad sobre visión, alcance, arquitectura y decisiones de Englove. Está pensado para que cualquier agente o persona que entre al proyecto pueda trabajar sin releer conversaciones anteriores.
>
> Cada punto lleva un estado:
>
> - **Decidido**: vinculante. No se cambia sin registrar una nueva decisión en §14.
> - **Propuesto**: recomendación vigente a falta de decisión. Se puede implementar, pero debe quedar marcado como tal.
> - **Pendiente**: requiere decisión humana antes de implementarse.
>
> Última actualización: 2026-10-20 (Ronda 8, decisiones 93–94 aceptadas por el líder: alcance de alumnos en Etapa 2 y bloqueo sin enumeración; SPEC-02 Aprobada, sin implementación y con prerrequisitos operativos por acreditar en su §11). Ronda 7: 2026-10-10 (decisiones 86–92: capacidad operativa por horizonte, Cloudflare Workers como destino único, versiones estables recomendadas, matriz explícita de tenant, acceso controlado a intentos al cambiar de grupo, procedimiento operativo de datos de menores y auditoría administrativa preservada sin datos personales). Ronda anterior: 2026-10-10 (Ronda 6, decisiones 81 y 82: Next.js 16 + React 19 y combo de despliegue gratuito de validación con salto al piloto de bajo coste; sin cambios de alcance, §2.4 intacto).
>
> Ronda 4: 2026-09-28, `planning/decisiones-para-correccion-de-planeacion.md` (decisión 57): cookies de sesión compartidas entre subdominios del mismo entorno, correo globalmente único, tolerancia de 24 h para completar un intento, `Attempt.retry_extend_until`, OTP al correo nuevo, cambio administrativo del correo por la profesora con auditoría, una sola instancia de la API en el piloto, calendario secuencial de las Etapas 0–2 y terminología "cinco tipos de actividad / cinco mecánicas de juego". Las decisiones menores de su §10 quedan como pendientes en §15.
>
> Ronda 3: 2026-09-22, `planning/incongruencias-y-decisiones-definitivas.md` (Ronda 3, decisión 34): eliminación de `Guardian` y de todo consentimiento legal, Cloudflare R2, transcodificación de audios, timestamps en servidor, algoritmo de rachas, rate limiting, `age_segment` y demás decisiones de esa sesión.

---

## Índice

1. Qué es Englove
2. Fases y alcance
3. Usuarios y roles
4. Identidad y autenticación
5. Alcance funcional del piloto
6. Stack tecnológico
7. Arquitectura y modelo de datos
8. Sistema de diseño
9. Tratamiento de datos y retención de archivos
10. Seguridad desde el día 1
11. Calidad, operación y metodología de desarrollo
12. Orden de construcción
13. Estadísticas de rendimiento y constancia
14. Registro de decisiones
15. Pendientes abiertos
16. Convenciones para agentes
17. Glosario

---

## 1. Qué es Englove

- Plataforma web educativa, interactiva y gamificada para enseñar inglés a niños y adolescentes.
- Nace para apoyar la labor pedagógica de **una profesora particular** (el cliente actual) y está diseñada para evolucionar hacia un **SaaS para academias de idiomas** con múltiples profesores y sedes.
- El currículo se organiza según el **MCER** (Marco Común Europeo de Referencia para las lenguas): niveles A1, A2, B1 y B2.
- El nombre "Englove" es provisional.
- Durante el piloto, los precios y cobros a los alumnos los gestiona la profesora fuera de la plataforma. Englove no maneja dinero hasta Fase 2 o 3.

---

## 2. Fases y alcance

### 2.1 Fase piloto (actual) — Decidido

- 1 profesora, con una capacidad objetivo de crecimiento de hasta 100 estudiantes de 7 a 14 años.
- Perfil operativo inicial: aproximadamente 10 estudiantes. Horizonte corto/medio comprometido con la clienta: aproximadamente 30 estudiantes activos. Los 100 son capacidad objetivo de crecimiento, no una carga simultánea exigida al primer despliegue.
- Aplicación web instalable como PWA. Sin publicación en tiendas.
- **La profesora entra primero.** El gestor de contenidos se construye y se entrega antes que el portal del estudiante, para que la plataforma tenga contenido cargado antes de que el primer alumno pueda usarla. Esto no impide que un alumno cree su cuenta antes: el **registro autónomo del estudiante** (§4) queda abierto desde que existe el login, pero la cuenta no se activa hasta que la profesora la aprueba.
- El éxito se observa en uso constante y rendimiento estable o creciente de cada estudiante. No hay una métrica numérica global: la profesora lo evalúa con las estadísticas de rendimiento y constancia por alumno (ver §13).

### 2.2 Fase 2 — Academia

- Múltiples profesores y sedes (multi-tenant real sobre el esquema ya preparado desde el piloto).
- Muro privado de actividades presenciales con fotos (privacidad estricta; fotos sin metadatos EXIF y URLs firmadas).
- Juegos en Phaser.js detrás del mismo contrato de actividad (§7.3).
- Empaquetado móvil con Capacitor y publicación en Google Play / App Store.

### 2.3 Fase 3 — SaaS

- Pasarela de pagos y suscripciones. Opciones de referencia: Wompi o ePayco para Colombia; Stripe si hay expansión internacional.
- Ampliación del rango de edad a 5–18 años.
- Catálogo ampliado de minijuegos.

### 2.4 Explícitamente fuera del piloto — Decidido

| Elemento                                             | Sustituto en el piloto                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| WebSockets / tiempo real                             | Polling cada 30 segundos en el panel de la profesora                       |
| Heartbeat y detección de inactividad de pestaña      | Registro de inicio y fin de cada actividad                                 |
| Pantallas de `parent` y `admin`                      | Enum de roles completo, sin pantallas                                      |
| Capacitor / tiendas de aplicaciones                  | PWA instalable                                                             |
| Muro social / sección de padres                      | Nada                                                                       |
| Motor Phaser                                         | Microjuegos en React puro                                                  |
| Educaplay embebido (iframe)                          | Enlaces externos en "Contenido extra", fuera de calificación               |
| Pasarela de pagos                                    | Nada. Entidades `Organization` / `Subscription` reservadas, no construidas |
| Cualquier gestión de consentimiento legal de menores | Nada. Es responsabilidad de la clienta fuera de la plataforma (§9)         |

Ningún elemento de esta tabla se construye durante el piloto, aunque parezca fácil o rápido.

---

## 3. Usuarios y roles

Roles del enum RBAC, todos definidos desde el día 1: `teacher`, `student`, `parent`, `admin`. En el piloto solo se implementan pantallas de `teacher` y `student`.

### Estudiantes

- Edad actual 7–14; futura 5–18.
- Dos segmentos de experiencia (Decidido 2026-09-22, decisión 34 §15): **Kids/Junior** y **Teens**.
  - De **7 a 10 años**: solo tienen acceso a la interfaz Kids. No pueden cambiar.
  - De **11 años en adelante**: tienen acceso a ambas interfaces y pueden alternar entre Kids y Teens desde su perfil cuantas veces quieran.
  - `age_segment` se calcula automáticamente a partir de `birth_date` al registrarse. Un job mensual recalcula la edad; cuando un alumno cumple 11 años se activa `can_switch_interface` y se le habilita la opción de cambiar. El cambio nunca es automático: el alumno elige.
- Dispositivos: prioridad alta en tablets y smartphones táctiles; soporte completo en escritorio y portátil.
- Son **usuarios independientes** con sus propias credenciales: inician sesión con **correo y contraseña** que ellos mismos fijan al registrarse (§4). No existe cuenta hija ni entidad de acudiente.
- **Datos del acudiente:** `Student` guarda dos campos opcionales, `guardian_name` y `guardian_contact` (teléfono o correo). Se capturan en el auto-registro y después solo la profesora puede editarlos desde el panel; el alumno no puede modificarlos.
- **Se registran por su cuenta (Decidido 2026-09-21, decisión 33)**: el alumno completa un formulario de alta y fija su propia contraseña desde el primer momento. La cuenta queda `pending_approval` hasta que la profesora la revisa (§4, §5.1). Es la **única** vía de alta (decisión 34 §1).
- Nunca ven el leaderboard. Ven su progreso personal: estrellas, insignias, rachas y misiones.

### Profesora / Administradora

- Dispositivo principal: computador o portátil.
- Gestiona currículo por nivel MCER, crea y asigna actividades, califica audios y respuestas abiertas, gestiona alumnos, grupos y cuentas bloqueadas, consulta estadísticas y el leaderboard privado.

### Acudientes

- No existe rol, entidad ni tabla de acudiente en el sistema (Decidido 2026-09-22, decisión 34 §1). Sus datos de contacto viven en `Student.guardian_name` y `Student.guardian_contact`. La tutela legal es un asunto externo a la plataforma (§9). Si en Fase 2 se desea un rol de acudiente, será una decisión nueva en §14; el valor `parent` del enum queda reservado para ello.

---

## 4. Identidad y autenticación — Decidido

- **La autenticación es responsabilidad de NestJS.** No se usa Supabase Auth ni ningún servicio de autenticación del proveedor de base de datos.
- JWT de acceso de vida corta + **refresh tokens rotativos** almacenados en cookie `httpOnly`, `Secure`, `SameSite`. Nunca en `localStorage`.
- **Cookies compartidas entre subdominios del mismo entorno (Decidido 2026-09-28, decisión 58):** las cookies de sesión se emiten con `Domain=.<dominio>`, `Secure`, `HttpOnly` y `SameSite=Lax`, para que `app.<dominio>` (Cloudflare, decisión 82) y `api.<dominio>` (Render) las vean; en staging, el mismo criterio con `app-staging.<dominio>` y `api-staging.<dominio>`. El `proxy.ts` de Next.js 16 (antes `middleware.ts`, decisión 81) solo las usa para redirigir por rol (experiencia); **la autorización real es exclusiva de NestJS**, que valida JWT, rol, sesión y tenant en cada petición. El dominio raíz y todos sus subdominios deben estar bajo control del proyecto; no se publican subdominios no controlados. CORS con credenciales y validación de `Origin` siguen siendo obligatorios. Detalle en architecture §8.2.
- Persistencia prolongada ("Recuérdame") para evitar fricción de login en niños.
- **El alumno es un usuario independiente** con sus propias credenciales. No existe cuenta hija ni vínculo con una cuenta de acudiente (decisión 34 §1).
- **Acceso del alumno (Decidido 2026-09-21): correo y contraseña, con recuperación de contraseña por correo.** Se adopta por convención: es el mecanismo que alumnos, acudientes y profesora ya conocen. El correo puede pertenecer al alumno o ser uno que gestione el acudiente. Queda descartado el acceso por código de aula + PIN o avatar.
- **Correo globalmente único (Decidido 2026-09-28, decisión 59; modifica la decisión 22):** `User.email` es único en toda la plataforma, no solo dentro de cada organización. Por eso el login recibe únicamente correo y contraseña, sin identificador de organización, y el auto-registro rechaza un correo ya usado en cualquier organización. Los endpoints públicos no revelan si un correo existe (login, auto-registro y recuperación responden de forma uniforme). Si en Fase 2 una persona necesita pertenecer a varias organizaciones, se definirá un modelo de membresías; nunca se duplicarán usuarios (diferido a Fase 2, decisión 84).
- **Contraseña (Decidido 2026-09-22, decisión 34 §1):** la crea siempre el propio alumno. Requisitos: mínimo 8 caracteres, máximo 16, sin espacios. Sin otros requisitos de complejidad.
- **La profesora no da contraseñas temporales ni crea cuentas.** La única vía de alta es el auto-registro (§4.1). Ante bloqueo o pérdida, la profesora puede **iniciar una recuperación de contraseña** desde el panel: el sistema envía el enlace de un solo uso al correo registrado del alumno.
- **Cambio de correo desde el perfil del alumno (Decidido 2026-09-22; precisado 2026-09-28, decisión 62):** requiere la contraseña actual y un OTP de un solo uso que se envía **al correo nuevo**, para verificar que el alumno controla la dirección que quiere usar. Una vez completado el cambio se envía un aviso **al correo anterior**, que informa pero no autoriza. El cambio revoca las demás sesiones. Cubre el caso en que se registró con el correo del acudiente y luego quiere usar el suyo.
- **Cambio administrativo del correo por la profesora (Decidido 2026-09-28, decisión 63):** operación excepcional para el alumno que perdió el acceso a su correo y no puede usar el flujo con OTP. Solo una profesora de la misma organización puede hacerlo, desde la ficha del alumno y con confirmación explícita; el correo nuevo debe ser globalmente único; se revocan **todas** las sesiones del alumno; se registra una auditoría (quién, cuándo, alumno afectado, correo anterior y nuevo) y se notifica al correo nuevo y, cuando sea posible, al anterior. La profesora nunca ve ni fija la contraseña. La verificación de identidad del alumno ocurre fuera de la aplicación y es responsabilidad operativa de la profesora. Retención y acceso a la auditoría (Decidido, decisiones 84 y 92): sin pantalla de consulta en el piloto (acceso solo del equipo técnico); al borrar al alumno se conserva el evento técnico en `AuditLog` desvinculando `target_student_id` (`onDelete: SetNull`) y redactando los correos de `details`.
- **Bloqueo por intentos fallidos (Decidido, decisiones 23 y 94):** tras **10 intentos fallidos** consecutivos, la cuenta queda bloqueada **10 minutos**. Credenciales inválidas siempre devuelven `401 AUTH_INVALID_CREDENTIALS`, incluso en una cuenta bloqueada; el décimo fallo persiste contador 10 y `locked_until = now() + 10 minutos`, pero responde ese mismo 401. Solo tras verificar la contraseña correcta se comunica un bloqueo activo (`423 AUTH_ACCOUNT_LOCKED`, segundos restantes en `Retry-After`), sin sesión. Durante el bloqueo no se modifica contador ni plazo. Al vencer, se limpia el bloqueo y reinicia el ciclo antes de evaluar el siguiente login, sin depender del cron: un fallo pasa a 1; un acierto deja el contador en cero y permite entrar si la cuenta está aprobada. Tras validar la contraseña, el bloqueo precede al estado pendiente. Aplica a alumnos y profesora; solo los alumnos tienen desbloqueo administrativo desde `Alumnos → Bloqueados`. El throttling HTTP (`429`) es independiente.
- **Correo transaccional (Decidido 2026-09-21, ampliado 2026-09-22):** un único proveedor y remitente (§6) envía todos los correos de la plataforma: confirmación de solicitud recibida en el auto-registro, aviso de cuenta existente cuando alguien intenta registrarse con un correo ya usado (decisión 59), aviso de cuenta aprobada, **recuperación de contraseña** (enlace de un solo uso con caducidad corta), OTP de cambio de correo, aviso de correo cambiado (decisiones 62 y 63), **notificación de actividad calificada** al alumno (sin nota ni feedback, §5.1) y **resumen de pendientes** a la profesora cada 3 días (§5.1).
- **Rate limiting (Decidido 2026-09-22, decisión 34 §20):** límites por endpoint sensible y globales, detallados en architecture §8.3. Toda entrada se valida con `class-validator` y Zod.

### 4.1 Registro autónomo del estudiante y aprobación — Decidido 2026-09-21 (decisión 33)

El alumno crea su propia cuenta; la profesora la aprueba antes de que sirva para algo. Es la **única vía de alta** en el piloto (decisión 34 §1): la profesora no crea cuentas ni entrega contraseñas.

- **Formulario de auto-registro** (pantalla pública `/registro`): correo, contraseña (8–16 caracteres, sin espacios), nombre del alumno, fecha de nacimiento (deriva `age_segment`), datos de contacto del acudiente (`guardian_name` y `guardian_contact`, campos del propio `Student`) y checkbox de aceptación de los **Términos y Condiciones** convencionales de uso, con enlace al documento.
- **Correo ya registrado (Decidido 2026-09-28, decisión 59):** si el correo ya existe en cualquier organización, no se crea nada; la respuesta en pantalla es la misma que en un registro nuevo (para no revelar qué correos tienen cuenta) y al dueño de ese correo le llega un aviso de que ya tiene una cuenta, con enlace a la recuperación de contraseña.
- Al enviarlo se crean solo `User` (rol `student`, correo y contraseña ya fijados por el alumno) y `Student` (con los datos del acudiente como campos propios), en la única organización del piloto. No se crea ninguna entidad separada. El `Student` queda en estado **`pending_approval`**: no tiene nivel MCER ni grupo asignado.
- **Mientras está `pending_approval`, el login se rechaza** con `403 ACCOUNT_PENDING_APPROVAL` solo tras contraseña correcta y sin bloqueo activo (decisión 94). El alumno no entra a nada hasta ser aprobado; credenciales inválidas conservan el 401 uniforme.
- La solicitud aparece en el panel de la profesora (§5.1) como una **solicitud de registro** pendiente. Al revisarla, la profesora:
  1. Confirma o corrige `guardian_name` y `guardian_contact` directamente en el `Student`.
  2. Asigna nivel MCER y **un único grupo** (decisión 73). `age_segment` ya viene calculado desde la fecha de nacimiento; solo lo corrige si la fecha es errónea.
  3. Aprueba la cuenta (`approval_status = approved`) o rechaza una solicitud aún pendiente (se eliminan la cuenta y sus dependientes de identidad). Este rechazo se entrega en Etapa 2; la baja general con historial y R2 queda en Etapa 5 / SPEC-05 / ENG-070 (decisión 93), con las garantías de §10.
- Al aprobar, el alumno recibe un correo de "cuenta aprobada" y puede iniciar sesión.
- La aceptación de T&C es el único acuerdo que existe en la plataforma. No hay consentimiento parental ni registro de autorización de ningún tipo (§9).
- Los Guards de NestJS aplican RBAC y aislamiento por `organization_id` en cada petición.

---

## 5. Alcance funcional del piloto

### 5.1 Panel de la profesora (se construye primero)

**Gestor de contenidos**

- Crear actividades por nivel (A1–B2) y por **tipo de actividad**. **El piloto incluye los cinco tipos de actividad desde su primera versión operativa** (Decidido 2026-09-22, decisión 34 §6; terminología fijada por la decisión 66), con calificación mixta automática y manual. La profesora ve estas cinco opciones principales, que corresponden a los cinco valores de `ActivityType`:
  - **Fill in the blanks:** oraciones con dropdowns en línea. Calificación automática inmediata.
  - **Pregunta abierta:** texto libre. Va a la cola de revisión (calificación manual).
  - **Speaking:** grabación con `MediaRecorder` en el navegador, se sube a Cloudflare R2 y se transcodifica en servidor para reproducción universal (architecture §3.5). Va a la cola de revisión. Duración mínima 2 s; máxima configurable por actividad, 120 s por defecto y 300 s como tope absoluto (decisión 34 §13).
  - **Microjuego (`game`):** un solo tipo de actividad con **cinco mecánicas de juego** (`GameMechanic`, ver §5.3); configuración JSON rellenada mediante formulario. Calificación automática. `fill_blank` es un tipo de actividad propio, no una mecánica de juego.
  - **Examen:** conjunto de ítems con pesos; cada ítem es una oración de fill in the blanks (decisión 70). Mínimo 2 ítems para publicarse; los pesos se normalizan automáticamente al 100 % al guardar; un ítem no respondido vale 0 y su peso entra en el denominador (decisión 34 §11 y §12).
- Objetivo de onboarding: la profesora crea su primera actividad en menos de 10 minutos. Si no se cumple, el piloto fracasa por falta de contenido antes que por bugs.

**Asignación**

- Asignar una actividad a uno o varios grupos con fecha de apertura y fecha de cierre.
- **Regla de `due_at` (Decidido 2026-09-22, decisión 34 §10):** lo que determina si un intento es válido es su momento de inicio, tomado en el servidor. Un intento iniciado antes del cierre puede terminarse después y se guarda normalmente. Un intento que se quiera iniciar después del cierre se rechaza con un aviso al alumno para que hable con su maestra.
- **Tolerancia máxima de 24 horas (Decidido 2026-09-28, decisión 60):** un intento es válido si su `started_at` (servidor) es anterior o igual al cierre efectivo, y el alumno puede completarlo hasta **cierre efectivo + 24 horas**. Pasada esa ventana, el `attemptToken` deja de ser válido y el job nocturno marca el intento como `abandoned`. La tolerancia nunca aplica a intentos que se quieran iniciar después del cierre: esos no se crean. El **cierre efectivo** es `due_at`, salvo en un nuevo intento habilitado con `retry_extend_until` (ver "Habilitar nuevo intento"). La interfaz del alumno informa que empezar antes del cierre le deja terminar dentro de una ventana adicional limitada.
- **Inicio antes de `opens_at` (Decidido, decisión 84):** se rechaza con `409 ATTEMPT_NOT_OPEN` sin crear el intento, informando la fecha de apertura.

**Cola de revisión y feedback**

- Lista de audios y respuestas abiertas pendientes de calificar.
- Calificación + **comentario personal de retroalimentación por cada intento calificado** + stickers. El comentario es obligatorio en la revisión manual (pregunta abierta y speaking) y opcional en las actividades autocalificadas (Decidido, decisión 84).
- La profesora puede **descargar el audio** de speaking a su dispositivo antes de que venza la retención (decisión 34 §6).
- **Notificación por correo (Decidido 2026-09-22, decisión 34 §5):** al calificar, el alumno recibe un correo que le avisa que su actividad ya fue calificada, con un enlace a la sección de feedback de la app. **El correo no incluye la nota ni el feedback**; ambos se ven únicamente dentro de la aplicación.
- **Habilitar nuevo intento (Decidido 2026-09-21):** en el área de calificación y feedback, la profesora dispone de un campo para autorizar a ese estudiante un intento adicional sobre esa asignación. Si no lo hace, el estudiante tiene **un solo intento** por asignación. Aplica a todo tipo de actividad calificable, incluidas las autocalificadas (fichas, exámenes y microjuegos), cuyos intentos también aparecen en esta área aunque no requieran revisión manual.
- **Plazo del nuevo intento (Decidido 2026-09-28, decisión 61):** al habilitarlo, la profesora puede fijar opcionalmente una nueva fecha límite para iniciarlo, que se guarda en `Attempt.retry_extend_until` del intento que concede la autorización. Si queda vacía, el nuevo intento usa el `due_at` original; si tiene valor, esa fecha es su cierre efectivo (y la tolerancia de 24 h se cuenta desde ella). La fecha no puede ser anterior al momento de conceder la habilitación. Solo la profesora puede concederla; no se concede otra mientras haya una sin usar; la habilitación se consume de forma atómica al crear el nuevo intento, que enlaza al anterior con `previous_attempt_id`. La interfaz muestra al alumno y a la profesora el límite efectivo.
- El alumno recibe el comentario en la vista de esa actividad. El ciclo grabar → calificar → recibir feedback es el corazón pedagógico del producto.

**Escala de calificación — Decidido 2026-09-21**

- Toda calificación (fichas, exámenes, microjuegos, actividades asignadas y revisiones manuales) se expresa en la **escala colombiana de 0,0 a 5,0**, con un decimal.
- El puntaje automático se calcula en servidor y se normaliza a esa escala; la calificación manual se introduce directamente en ella.
- Umbral de aprobación 3,0, configurable por organización (Decidido). Las estrellas y el progreso del alumno se derivan de esta escala.

**Estudiantes y grupos**

- **Solicitudes de registro (Decidido 2026-09-21):** bandeja con los auto-registros en `pending_approval`. Aprobar asigna nivel y un único grupo (y corrige `guardian_name`, `guardian_contact` o `age_segment` si hace falta) y activa la cuenta; rechazar borra la solicitud. Es la única vía de alta.
- Edición de alumnos: nivel, segmento, datos del acudiente (`guardian_name`, `guardian_contact`, solo la profesora). Iniciar recuperación de contraseña del alumno (envía el enlace a su correo; no hay contraseñas temporales).
- **Cambio administrativo del correo del alumno (Decidido 2026-09-28, decisión 63):** acción excepcional en la ficha del alumno, con confirmación explícita, auditoría, revocación de todas sus sesiones y aviso a ambos correos (§4).
- **Sección de bloqueados (Decidido 2026-09-22, decisión 34 §8):** pestaña dedicada dentro de `Alumnos` con el listado de cuentas bloqueadas por intentos fallidos y desbloqueo manual en un clic.
- Grupos y membresías. **Cada alumno pertenece a un solo grupo a la vez (Decidido 2026-09-28, decisión 73):** la profesora puede cambiarlo de grupo; el historial de membresías se conserva, el alumno pasa a ver solo las asignaciones del grupo nuevo y los intentos que ya había empezado se pueden terminar. Un grupo con historia se archiva, no se borra.

**Dashboard de la profesora — recordatorios (Decidido 2026-09-22, decisión 34 §8 y §18)**

- Tarjetas minimalistas (contador + enlace directo) para: solicitudes de registro pendientes, y actividades sin calificar hace más de N días (umbral configurable, 3 días por defecto).
- **Correo de pendientes cada 3 días:** el sistema evalúa esas mismas categorías y, solo si hay al menos un pendiente, envía a la profesora un correo de resumen con enlaces a cada sección. Si no hay pendientes, no envía nada.

**Estadísticas (polling cada 30 s)**

- Acceso **exclusivamente por RBAC** (Decidido 2026-09-22, decisión 34 §7): si el rol del JWT es `teacher` se concede; si no, `403`. No hay feature flags `stats` ni `leaderboard`.
- Foco (Decidido 2026-09-21): **rendimiento y constancia por estudiante** para que la profesora vea cómo ha avanzado cada alumno durante su proceso (§13).
- Rendimiento: evolución de la calificación (0,0–5,0) por alumno a lo largo del tiempo, por tipo de actividad y por nivel; promedio por grupo y por nivel.
- Constancia: semanas activas, racha vigente, actividades completadas por semana y tasa de finalización de lo asignado.
- Tiempo por actividad calculado con inicio y fin de cada intento; agregados diario, semanal y mensual.
- **Leaderboard privado**, visible exclusivamente para la profesora.

**Contenido extra**

- Sección de enlaces externos (Educaplay u otras plataformas), fuera del flujo de calificación y sin iframe.

### 5.2 Portal del estudiante

- **Navegación de 2 a 4 clics según la zona (Decidido 2026-09-21):** las actividades asignadas quedan a 2 clics desde la home; las zonas secundarias (juegos, progreso, feedback, contenido extra) admiten hasta 4 clics hasta el contenido final, sin perder la simpleza. El rango por zona se detalla en architecture §3.1.
- Tema visual según segmento de edad (§8).
- Zonas: Juegos (microjuegos), Classroom (fichas interactivas), progreso personal, feedback recibido.
- **Perfil del alumno:** cambio de correo con OTP enviado al correo nuevo (§4) y, si tiene 11 años o más, alternar entre las interfaces Kids y Teens (§3).
- **Plazos visibles (decisiones 60 y 61):** cada tarjeta de asignación muestra el cierre efectivo y, si el alumno ya empezó, hasta cuándo puede terminar (cierre efectivo + 24 h).
- **Tolerancia a conexión débil:** las respuestas se guardan localmente y se reintenta el envío; una grabación de audio no se pierde si falla la subida.
- **Estados de error (Decidido 2026-09-22, decisión 34 §17):** toda situación indeseada (red, servidor, acceso no autorizado, recurso no encontrado, actividad cerrada, intento ya existente, fallo de subida de audio) tiene un mensaje claro y contextual, sin detalles técnicos. En Kids los mensajes son más visuales y simpáticos; en Teens y en el panel, más directos.
- **Actualizaciones de la PWA (Decidido 2026-09-22, decisión 34 §4):** cuando hay una nueva versión, la app muestra una notificación in-app no bloqueante con un botón para reiniciar y aplicar los cambios. Aplica también al panel de la profesora.
- **Accesibilidad:** texto a voz en las consignas del tema Kids, contraste verificado, objetivos táctiles grandes.
- Sin analítica de terceros, píxeles ni publicidad. Solo eventos propios.

### 5.3 Microjuegos — Decidido

- Implementados en **React puro** (con `@atlaskit/pragmatic-drag-and-drop` para las mecánicas de arrastrar y soltar, y CSS), no en Canvas, durante el piloto (decisión 81).
- Los microjuegos son **un tipo de actividad** (`game`) con **cinco mecánicas de juego** (`GameMechanic`, decisión 66): emparejar (`match`), ordenar palabras (`order_words`), arrastrar y soltar (`drag_drop`), memoria de tarjetas (`memory`) y elección múltiple con temporizador (`timed_choice`).
- Cada mecánica lee un JSON de configuración que la profesora rellena desde un formulario. Eso ya cumple el requisito de "contenido editable por la profesora".
- Todos cumplen el **contrato de actividad** (§7.3). Phaser entra en Fase 2 como una implementación más del mismo contrato, sin cambios en backend ni en el panel.
- **El puntaje se calcula en el servidor.** El cliente envía respuestas y eventos; el backend compara contra la clave, valida duraciones plausibles y asigna el puntaje. Nunca se acepta un puntaje calculado en el cliente.

### 5.4 Gamificación — Decidido

- **Fuente única de verdad:** tabla `ProgressEvent` append-only. Puntos, insignias y rachas se derivan de los eventos y se pueden recalcular si cambian las reglas.
- Insignias por hitos simples: primera tarea completada, primer audio enviado, y similares.
- Insignias por permanencia: rachas de **4, 8 y 12 semanas**; insignia de **5 años** con la aplicación.
- Las **rachas son semanales y perdonables**, no diarias. Las rachas diarias generan ansiedad en niños pequeños y dependen de los padres. Algoritmo vinculante (Decidido 2026-09-22, decisión 34 §9): solo las semanas activas suman; el perdón solo se puede usar con una racha activa (racha 0 no se perdona); tras usarlo se recupera al completar dos semanas activas consecutivas; nunca hay más de un perdón disponible. Detalle en architecture §9.3.
- Las reglas de insignias viven en una tabla de configuración editable (`BadgeRule`), no en código.
- El leaderboard es visible solo por la profesora.

---

## 6. Stack tecnológico — Decidido

**Frontend**

- **Next.js 16.4 (App Router) + React 19.3**, TypeScript 5.9, enfoque mobile-first. Los parches exactos quedan fijados por el lockfile.
- **Entorno de desarrollo y producción:** Node.js 24 LTS y pnpm 11. No se usa Node Current en producción.
- **Bundler y compilador:** Turbopack por defecto (`next dev` y `next build`) y **React Compiler** habilitado (`reactCompiler: true` en `next.config.ts` con `babel-plugin-react-compiler`). Si el adaptador de Cloudflare elegido en ENG-140 compila con Vite en lugar de Turbopack (decisión 82), Turbopack aplica al desarrollo local y el compilador de producción lo fija esa tarea.
- **Convenciones de Next.js 16:** `proxy.ts` sustituye a `middleware.ts` (runtime Node.js, no admite Edge); modelo de caché explícito con la directiva `use cache` (requiere `cacheComponents: true`); ninguna ruta ni caché se asume por defecto.
- Tailwind CSS 4 + shadcn/ui (Radix UI) para el panel y los formularios.
- **Framer Motion sin restricción de uso.** El público objetivo no tiene limitaciones de rendimiento en sus dispositivos. Los bundles de animación de Kids y Teens se cargan de forma diferida por separado, para que cada audiencia descargue solo lo suyo.
- Howler.js (efectos de sonido) y canvas-confetti (celebraciones).
- **Arrastrar y soltar:** `@atlaskit/pragmatic-drag-and-drop` (agnóstico de framework y ligero) sustituye a `@dnd-kit` en los microjuegos de la Etapa 6 (decisión 81). Usa el arrastre nativo del navegador: en iOS, iPadOS y Android tiene limitaciones táctiles conocidas, por lo que se prueba en tablet real desde el primer día y SPEC-06 evalúa si hace falta una alternativa sin arrastre.
- PWA con manifest e instalación. Capacitor queda preparado para Fase 2.

**Backend**

- NestJS 11 (TypeScript), **módulos planos** sin capas abstractas innecesarias para 15–20 endpoints.
- Prisma ORM 7. Migraciones con Prisma Migrate ejecutadas en CI. Nunca `db push` contra producción.
- JWT + Guards RBAC. DTOs con `class-validator` en todos los endpoints.
- Swagger / OpenAPI generado automáticamente, sin decorar campo por campo.
- Sin WebSockets en el piloto.

**Datos e infraestructura**

- **PostgreSQL 18 en Neon (recomendación estable 2026-10-10; sustituye a Supabase Cloud).** Neon se usa exclusivamente como Postgres, sin RLS como fuente de autorización (la autorización es de NestJS). Prisma usa dos cadenas: `DATABASE_URL` por el pooler (PgBouncer) y `MIGRATION_DATABASE_URL` directa, solo para migraciones en CI. Siguen prohibidos Supabase Auth, Realtime, RLS y Storage (decisión 34 §21).
- **Almacenamiento de archivos: Cloudflare R2 (Decidido 2026-09-22, decisión 34 §21).** API compatible con S3 (`@aws-sdk/client-s3`), bucket privado por entorno, URLs firmadas de corta duración generadas por el backend. Sustituye a Supabase Storage por los límites de su capa gratuita. Variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
- **Hosting (Decidido, decisión 87): frontend en Cloudflare Workers mediante `vinext`, backend en Render.** Cloudflare Pages no forma parte de la topología de producción. Ambos servicios usan dominio propio bajo la misma raíz (`app.` y `api.`), despliegue desde Git y entornos staging y producción. La API (NestJS) **no** se mueve a Cloudflare Workers: no admite `ffmpeg` ni procesos largos. La imagen Docker de la API incluye `ffmpeg` para la transcodificación de audios (architecture §3.5).
- **Entornos y costes (Decidido 2026-10-10, decisión 82; condicionado al PoC ENG-140):**

  | Entorno | Web | API | Postgres | Archivos | Correo | Coste |
  | --- | --- | --- | --- | --- | --- | --- |
  | `local` | `next dev` | `nest start` | Docker | R2 dev o MinIO | log | $0 |
  | `staging` y **demo** | Cloudflare Free | Render Free | Neon Free | R2 Free | Resend Free | **$0** |
  | `production` (piloto inicial ~10 alumnos; preparado para ~30 activos) | Cloudflare Workers Paid | Render Starter | Neon Launch | R2 | Resend Free | **~$16–19/mes** |

  La demo gratuita (1 profesora + ~10 alumnos, 1–2 semanas, sesiones guiadas) **no es apta para clases reales**: Render Free duerme a los 15 minutos (~60 s de arranque) y no ejecuta los jobs de `@nestjs/schedule` dormido; Neon Free suspende el cómputo a los 5 minutos; el bundle de Workers Free tiene un límite de 3 MB comprimido (10 MB en Paid). Piloto real: Render Starter siempre activo (decisión 64 intacta), Neon Launch con scale-to-zero desactivado en horario de clase y respaldo semanal de `pg_dump` a R2 además del historial de Neon. El salto de demo a piloto no cambia la arquitectura: solo planes.
- **Una sola instancia de la API durante el piloto (Decidido 2026-09-28, decisión 64):** Render ejecuta una única instancia activa, siempre encendida en producción y sin autoescalado. La cola de transcodificación y el rate limiting en memoria se aceptan **solo bajo esta restricción**: la cola no sobrevive a un reinicio o despliegue, por lo que al arrancar la API una rutina de recuperación reprograma las conversiones interrumpidas (`MediaAsset.status = ready` sin `converted_key`), y los contadores de rate limiting se reinician con la instancia. El perfil inicial es de aproximadamente 10 alumnos; el compromiso operativo de corto/medio plazo es de aproximadamente 30 alumnos activos y los 100 alumnos son una meta de crecimiento. Antes de habilitar varias instancias hay que externalizar la cola de trabajos y el rate limiting a un almacén compartido (Redis o Postgres), con una decisión nueva en §14.
- **Correo transaccional: Resend (Decidido 2026-09-21).** Un solo remitente y dominio verificado para todos los correos: solicitud recibida, cuenta aprobada, recuperación de contraseña, OTP de cambio de correo, notificación de calificación y resumen de pendientes a la profesora. Nunca marketing.

**Repositorio**

- Monorepo (pnpm workspaces + Turborepo) con `apps/web`, `apps/api` y `packages/shared`. Estructura detallada en architecture §2.
- Paquete compartido de tipos y esquemas (Zod). Un esquema por tipo de actividad, usado en el formulario de la profesora, en la validación del backend y en el renderizador del alumno. Un cambio, un lugar.

---

## 7. Arquitectura y modelo de datos

### 7.1 Principios — Decidido

1. NestJS es el único backend de negocio.
2. **Multi-tenant desde el esquema:** toda tabla de tenant lleva `organization_id`, aunque en el piloto exista una sola organización. Añadirlo después obliga a reescribir cada consulta.
3. Núcleo de tres entidades para todo flujo de aprendizaje: `Activity` → `Assignment` → `Attempt` (plantilla → asignación a grupo → intento de un alumno).
4. **Tabla base + tablas de detalle por tipo** para las actividades. El núcleo se comparte para asignación y estadísticas; los campos propios de cada tipo (juego, examen, ficha) viven en su propia tabla 1:1. Añadir un tipo nuevo es añadir una tabla de detalle, sin tocar el núcleo ni el panel estadístico. Esto resuelve la trazabilidad por tipo sin triplicar las consultas de estadísticas.
5. Progreso como eventos append-only, nunca contadores editados a mano.
6. Puntaje calculado en servidor.
7. Feature flags por organización en base de datos.

### 7.2 Entidades núcleo

Esquema orientativo. Cuando exista, el archivo `schema.prisma` es la referencia autoritativa y este apartado debe mantenerse alineado con él. Campos, índices y política de borrado completos en architecture §6 (auditado y completado por la decisión 67).

- `Organization` — tenant. Una sola en el piloto.
- `User` — `name` (obligatorio, todos los roles; decisión 79), `email` (obligatorio, **único en toda la plataforma**, decisión 59), `password_hash`, `role` (enum), `organization_id`, `terms_accepted_at` y `terms_version`, contador y marca de bloqueo por intentos fallidos.
- `AuthSession` — una fila por familia de sesión: su `id` es el `sid` del JWT; `refresh_token_hash` del refresh vigente, `expires_at`, `rotated_at`, `revoked_at`. Sostiene la rotación con detección de reutilización, el logout y la revocación de sesiones (decisión 68).
- `PasswordResetToken` — token de un solo uso para recuperación de contraseña.
- `EmailChangeRequest` — OTP de un solo uso para el cambio de correo del alumno (`user_id`, `new_email`, `otp_hash`, `expires_at`, `used_at`, `failed_attempts`; decisión 69).
- `Student` — `user_id`, `birth_date`, `guardian_name` (nullable), `guardian_contact` (nullable), `level` (A1–B2, nullable hasta la aprobación), `age_segment` (`kids` / `teens`), `can_switch_interface` (boolean), **`approval_status`** (`pending_approval` / `approved`; rechazar borra la solicitud, decisión 77). El nombre y el correo de acceso viven en `User`. No hay entidad de acudiente ni campo de consentimiento.
- `Group` (con `archived_at`) y `GroupMembership` (`joined_at`, `left_at`): **un solo grupo vigente por alumno**, con historial de cambios (decisión 73).
- `Activity` — `type` (uno de los cinco tipos de actividad de `ActivityType`: `fill_blank`, `open_question`, `speaking`, `game`, `exam`), `level`, `title`, `created_by`, `version`, `parent_id`, `status`, `expected_duration_seconds` y `min_plausible_seconds` (decisión 79).
- Detalle 1:1 por tipo de actividad (cinco tablas), con `config` pública y `answer_key` en columnas separadas donde hay clave (decisión 75): `FillBlankDetail`, `OpenQuestionDetail`, `SpeakingDetail` (`min_duration_seconds`, `max_duration_seconds`), `GameDetail` (con `mechanic`, una de las cinco mecánicas de juego de `GameMechanic`), `ExamDetail` (ítems exclusivamente `fill_blank`, pesos normalizados; decisión 70).
- `Assignment` — `activity_id`, `group_id`, `opens_at`, `due_at`, `historical_student_count` (denominador congelado al borrar alumnos, decisión 34 §14).
- `Attempt` — `assignment_id`, `student_id`, `attempt_number` (1 para el primero; único por asignación y alumno, decisión 74), `started_at`, `finished_at` (ambos asignados por el servidor, decisión 34 §3), `status`, `score` (0,0–5,0) y `graded_at` (fuente única de la calificación, decisión 72), `payload` (respuestas crudas en JSON), `flags`, `retry_granted_at`, `retry_granted_by`, `retry_extend_until` (nullable; fecha límite efectiva del intento hijo, decisión 61), `previous_attempt_id`.
- `Review` — solo feedback: `attempt_id`, `reviewer_id`, `comment`, `stickers` (códigos de un catálogo fijo). Sin nota (decisión 72).
- `ProgressEvent` — append-only: `student_id`, `type`, `value` (solo magnitudes), `attempt_id` (nullable), `payload`, `period_key`, `occurred_at` (servidor) (decisión 71).
- `BadgeRule` (configurable, por organización), `BadgeAward` (una por alumno y regla).
- `MediaAsset` — clave del archivo raw en R2, `converted_key` (MP4/AAC, nullable), propietario, `mime_type`, `duration_seconds`, `status`, `retention_until`, `transcode_attempts` y `transcode_failed_at` (registro de reintentos y fallos de conversión, decisión 64). Como máximo un audio `ready` por intento.
- `AuditLog` — registro append-only de operaciones administrativas sobre datos sensibles: `organization_id`, `actor_user_id`, `action` (en el piloto solo `student_email_changed`), `target_student_id` (nullable, `onDelete: SetNull`), `details` (correo anterior y nuevo; redactado al borrar al alumno), `created_at` (servidor). Decisiones 63 y 92: sin pantalla de consulta en el piloto; al borrar al alumno se conserva el evento técnico desvinculado del alumno.
- `ScheduledJobRun` — registro persistente de ejecución de las tareas periódicas, único por organización, tarea y periodo; garantiza su idempotencia tras reinicios (decisión 76).
- `ExternalResource` — enlaces de "Contenido extra" (`title`, `url`, `description`, `level`, `position`, `created_by`).
- `FeatureFlag` — por organización; incluye la configuración `passing_score`, `retention_days`, `pending_upload_ttl_days` y `ungraded_reminder_days`.

### 7.3 Contrato de actividad — Decidido

Toda actividad jugable o calificable implementa la misma interfaz, definida en el paquete compartido:

- **Entrada:** configuración JSON validada por su esquema Zod + token de intento.
- **Salida:** eventos `started`, `answered`, `completed` enviados al backend.
- El backend valida, califica y registra el `Attempt` y los `ProgressEvent` correspondientes.
- Cualquier motor futuro (Phaser) se integra como una implementación más del contrato. Nada del backend ni del panel de la profesora cambia.

---

## 8. Sistema de diseño — Decidido

- **Dos temas visuales**, uno por segmento de edad. Es una decisión de producto firme: las necesidades de un niño de 7 años y un adolescente de 14 son distintas en densidad de información, tono y refuerzo.
  - **Kids/Junior (7–10):** colorido, botones táctiles grandes, animaciones lúdicas, refuerzo sonoro, confeti en celebraciones.
  - **Teens (11–14+):** moderno y limpio, estilo Duolingo/Kahoot, motivador sin infantilizar.
- **Implementación:** un solo sistema de tokens de diseño (color, tipografía, espaciado, radios, intensidad de movimiento, sonido) con dos conjuntos de valores. Los componentes se construyen una vez y leen el conjunto activo según `age_segment`. Solo se crean variantes estructurales de componente donde la diferencia lo exige (por ejemplo, el layout de la zona de juegos). Esto entrega dos temas sin mantener dos aplicaciones visuales.
- Framer Motion se usa libremente; los bundles de animación por tema se cargan de forma diferida.
- Antes de cerrar el diseño visual: sesiones de observación con 3 niños reales por segmento de edad usando un prototipo.

---

## 9. Tratamiento de datos y retención de archivos — Decidido

- **El tratamiento legal de datos de menores es responsabilidad de la clienta (la profesora), fuera de la plataforma (Decidido 2026-09-22, decisión 34 §2).** Englove no tiene ni tendrá ningún módulo, tabla, campo, endpoint, pantalla, tarea ni referencia documental sobre consentimiento legal de menores, autorización parental de tratamiento de datos ni ningún otro aspecto de cumplimiento legal sobre menores. La aplicación no se hace responsable de esos aspectos y no construirá funcionalidad relacionada.
- **Lo único que existe en materia de acuerdos es un Términos y Condiciones convencional** de uso de la aplicación, aceptado por el alumno al registrarse mediante un checkbox estándar con enlace al documento (`User.terms_accepted_at`, `terms_version`).
- **Política de retención de audios (Decidido 2026-09-21, decisión 27):** un audio se borra de R2 30 días después de ser calificado (`retention_until = graded_at + 30 días`); una subida nunca confirmada se borra a los 7 días. Ambos plazos son configurables por organización. Antes de que venza el plazo, la profesora puede descargar el audio a su dispositivo desde el panel de revisión. La calificación y el comentario se conservan; solo desaparece el archivo. El borrado en cascada de un alumno se prueba automáticamente.
- Sin analítica de terceros, píxeles ni publicidad en el portal del estudiante. Ningún log ni reporte de error incluye datos personales (architecture §8.5).

---

## 10. Seguridad desde el día 1 — Decidido

- Refresh tokens rotativos en cookie `httpOnly`; nunca `localStorage`.
- Cookies de sesión con `Domain=.<dominio>` compartidas solo entre subdominios controlados del mismo entorno (decisión 58). El `proxy.ts` del frontend no es un control de seguridad: la API valida JWT, rol, sesión y tenant en cada petición.
- Los endpoints públicos no permiten enumerar cuentas: respuestas uniformes en login, auto-registro y recuperación de contraseña (decisión 59).
- Toda operación administrativa sobre datos sensibles del alumno (en el piloto, el cambio de su correo por la profesora) queda en `AuditLog` y revoca sus sesiones (decisión 63). La auditoría vive en base de datos, nunca en los logs de la aplicación.
- URLs firmadas de expiración corta, emitidas por el backend tras verificar que el solicitante tiene derecho a ese recurso.
- Puntaje y calificación en servidor; validación de rangos y duraciones plausibles.
- **Reloj del servidor como única fuente temporal (Decidido 2026-09-22, decisión 34 §3):** `started_at`, `finished_at`, `graded_at`, `occurred_at` y toda marca de tiempo de tenant se asignan en NestJS o en PostgreSQL al procesar la petición. El cliente nunca los envía; si los envía, se ignoran. Elimina el fraude por manipulación del reloj del dispositivo.
- DTOs validados en todos los endpoints (`class-validator` + Zod); RBAC en Guards; `organization_id` en toda consulta.
- **Rate limiting (Decidido 2026-09-22, decisión 34 §20):** login 10 intentos / 15 min por IP; signup 10 / hora por IP; forgot-password 5 / hora por IP y por correo; API autenticada 120 peticiones / min por usuario; API no autenticada 30 / min por IP. Los contadores viven en memoria y solo son globales porque la API corre en una sola instancia (decisión 64); con varias instancias deben migrarse a un almacén compartido.
- Borrado en cascada (alumno → intentos, audios en R2, eventos) con prueba automatizada escrita antes de la función, congelando antes el denominador histórico de sus asignaciones (§7.2).
- Secretos solo en variables de entorno. Nunca en el repositorio.

---

## 11. Calidad, operación y metodología de desarrollo — Decidido

### 11.1 Metodología: Spec-Driven Development (SDD) — Decidido 2026-09-21

- Englove se construye con **desarrollo guiado por especificaciones**: cada capacidad tiene una spec escrita, revisada y aprobada antes de escribir código. El código implementa la spec y las pruebas verifican sus criterios de aceptación.
- Las specs viven en `specs/`, una por etapa de construcción (`SPEC-01` a `SPEC-10`), se redactan una etapa por delante de la implementación y siguen la plantilla y el ciclo de vida definidos en [`planning/sdd-process.md`](../planning/sdd-process.md).
- Jerarquía: `CONTEXT.md` → `architecture-overview.md` → `sdd-process.md` → `pbp-development.md` → `taskboard.md` → `specs/` → código. Una spec nunca contradice un documento superior; si necesita hacerlo, primero se cambia la decisión en §14.
- Ninguna tarea del taskboard pasa a "En curso" sin su spec Aprobada. La Definición de Hecho de `pbp-development.md` §3 lo exige.
- **La redacción de las specs empezó durante la Etapa 0.** A 2026-10-20, SPEC-00 está Hecho y [`SPEC-01 — Scaffold`](../specs/SPEC-01-scaffold.md) figura Verificada por solicitud explícita del líder tras el cierre técnico del scaffold; su §9/§12 distinguen este cambio documental de nueva evidencia de CI. [`SPEC-02 — Identidad y sesión`](../specs/SPEC-02-identidad-y-sesion.md) está Aprobada por el líder tras aceptar Q-01/Q-02 (decisiones 93 y 94); su tarea de redacción y aprobación está Hecho. No quedan preguntas funcionales bloqueantes; su §11 separa los prerrequisitos operativos aún por acreditar. La aprobación del contrato no inicia la Etapa 2 ni sustituye sus compuertas. El índice vigente está en [`specs/README.md`](../specs/README.md); se mantiene el calendario de `sdd-process.md` §7.

### 11.2 Calidad y operación

- Pruebas end-to-end de los tres flujos que sostienen el piloto:
  1. La profesora crea y asigna una actividad.
  2. El alumno la completa.
  3. La profesora califica y el alumno ve el feedback.
- Captura de errores de frontend con rol y versión, con alertas al equipo. Los niños no reportan bugs; simplemente dejan de entrar.
- Logging estructurado en backend.
- Verificar el historial de restauración de Neon (6 h en Free; hasta 7 días en Launch), programar un respaldo semanal con `pg_dump` a R2 y ensayar una restauración al menos una vez.
- Medir rendimiento en al menos una tablet Android real de gama media o baja como control de higiene. Esto no restringe el uso de Framer Motion.
- Feature flags por organización para activar módulos. Es la forma más barata de tener piloto y futuro SaaS en el mismo código.

---

## 12. Orden de construcción — Decidido

1. Scaffold del monorepo, paquete compartido, `schema.prisma` núcleo, CI con migraciones.
2. Autenticación con correo y contraseña (profesora y alumno), recuperación de contraseña, cambio de correo con OTP, roles, rate limiting, **auto-registro del estudiante en `pending_approval`**, `Organization`, consulta/edición de `Student` y aprobación/rechazo de solicitudes; sin baja general (decisión 93).
3. **Gestor de contenidos de la profesora:** los cinco tipos de actividad (con las cinco mecánicas de juego), niveles, grupos, **bandeja de solicitudes de registro**, alumnos (con datos del acudiente y cambio administrativo del correo con auditoría), sección de bloqueados, recordatorios del dashboard.
4. Asignación a grupos.
5. Portal del estudiante: acceso, Classroom (fill in the blanks, pregunta abierta, speaking con transcodificación), progreso personal, perfil, job mensual de `age_segment` y baja general de alumnos con cascada completa (SPEC-05 / ENG-070, decisión 93).
6. Microjuegos en React tras el contrato de actividad.
7. Cola de revisión y feedback personal, correo de notificación de calificación, descarga de audios, habilitación de nuevo intento, retención de audios.
8. Panel estadístico (polling) de rendimiento y constancia por estudiante, leaderboard privado, correo de pendientes a la profesora.
9. PWA con notificación de actualizaciones, tolerancia offline, pase de accesibilidad.
10. Sección "Contenido extra".
11. Lanzamiento del piloto. Condiciones previas: contenido cargado por la profesora, estadísticas de rendimiento y constancia operativas, manual de uso de la profesora entregado.

Cada etapa comienza con la redacción y aprobación de su spec (§11.1).

**Arranque y secuencia (Decidido 2026-09-28, decisión 65).** Antes de la etapa 1 existe una Etapa 0 de arranque (`pbp-development.md`), que no es paralela al desarrollo de las etapas 1 y 2 en lo que respecta a sus dependencias obligatorias: cuentas, dominio, repositorio, tokens de diseño y observación con niños pueden prepararse en paralelo, pero **la etapa 1 comienza después de aprobar `SPEC-01`** y **la etapa 2 comienza después de aprobar `SPEC-02` y de entregar las dependencias técnicas de la etapa 1**. El taskboard refleja esta secuencia.

---

## 13. Estadísticas de rendimiento y constancia — Decidido 2026-09-21

- **Una métrica numérica global de éxito del piloto no es relevante para la profesora** y deja de ser requisito del panel y condición de lanzamiento. Se retira el pendiente anterior.
- Lo que la profesora necesita ver, por estudiante, es **cómo ha avanzado durante su proceso educativo**, en dos ejes:
  - **Rendimiento:** evolución de la calificación (0,0–5,0) a lo largo del tiempo, desglosable por tipo de actividad y por nivel MCER; comparación con el promedio de su grupo.
  - **Constancia:** semanas activas, racha vigente y mejor racha, actividades completadas por semana, tasa de finalización de lo asignado, tiempo dedicado.
- Vistas: una por estudiante (línea de tiempo de rendimiento y calendario de constancia) y una por grupo (tabla con ambos ejes para todos sus alumnos). El leaderboard privado se mantiene como vista aparte.
- Las gráficas se diseñan directamente a partir de estos dos ejes; no dependen de ninguna otra decisión.

---

## 14. Registro de decisiones

### Ronda 1 — 2026-09-18

| #   | Decisión                                                                                                                      | Estado                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Supabase solo como Postgres + Storage; NestJS único backend de negocio                                                        | Decidido. Modificada por la decisión 34 §21: Supabase solo como Postgres; los archivos van a Cloudflare R2. La decisión 82 sustituye a Supabase por Neon como motor SQL |
| 2   | Pasarela de pagos y suscripciones en Fase 2/3; precios fuera de plataforma en piloto                                          | Decidido                                                                                                                           |
| 3   | Jurisdicción Colombia (Ley 1581/2012); T&C en registro del acudiente                                                          | Sustituida por la decisión 34 §2: el cumplimiento legal queda fuera de la plataforma; solo T&C convencional aceptado por el alumno |
| 4   | Cuenta hija vinculada a acudiente. (Modificada por la decisión 22: el correo de acceso vive en `User.email` y es obligatorio) | Sustituida por la decisión 34 §1: no existe `Guardian`; el alumno es un usuario independiente                                      |
| 5   | Actividades: tabla base + tablas de detalle por tipo (juegos, exámenes, fichas)                                               | Decidido. Precisada por las decisiones 70 (ítems de examen `fill_blank`) y 75 (`answer_key` en columna propia) |
| 6   | Insignias por hitos simples y permanencia (4/8/12 semanas, 5 años); rachas semanales                                          | Decidido                                                                                                                           |
| 7   | Feedback personal por intento calificado                                                                                      | Decidido. Precisada por la decisión 72: `Review` guarda solo el feedback; la nota vive en `Attempt.score` |
| 8   | La profesora carga contenido antes de que entre el primer alumno                                                              | Decidido                                                                                                                           |
| 9   | Polling cada 30 s; sin WebSockets en piloto                                                                                   | Decidido                                                                                                                           |
| 10  | Registro de inicio/fin de actividad; sin heartbeat                                                                            | Decidido                                                                                                                           |
| 11  | Enum de roles completo; solo pantallas `teacher` y `student`                                                                  | Decidido                                                                                                                           |
| 12  | PWA instalable; Capacitor a Fase 2                                                                                            | Decidido                                                                                                                           |
| 13  | Módulos NestJS planos; Swagger automático                                                                                     | Decidido                                                                                                                           |
| 14  | Muro social y sección de padres fuera del piloto                                                                              | Decidido                                                                                                                           |
| 15  | Dos temas visuales (Kids / Teens) sobre tokens compartidos                                                                    | Decidido                                                                                                                           |
| 16  | Framer Motion sin restricción; carga diferida por tema                                                                        | Decidido                                                                                                                           |
| 17  | Microjuegos React en piloto; Phaser en Fase 2; Educaplay como enlaces en "Contenido extra"                                    | Decidido                                                                                                                           |
| 18  | Consentimiento en papel en piloto; firma digital al escalar a academia                                                        | Retirada por la decisión 34 §2                                                                                                     |
| 19  | Métrica numérica de éxito del piloto                                                                                          | Retirada por la decisión 28                                                                                                        |

### Ronda 2 — 2026-09-21

| #   | Decisión                                                                                                                                                                                                                                                                                                                                                                          | Estado                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 20  | Se aceptan en su totalidad las 15 propuestas de arquitectura A1–A15 de `architecture-overview.md` §14 (monorepo, datos y estado, validación en dos niveles, guards y tenant, scoring, tareas programadas, convenciones, enums, endurecimiento HTTP, cookies y CORS, motor de insignias, rachas perdonables, PWA, accesibilidad, entornos, pipeline, convenciones de código y API) | Decidido                                                                                                                                                                 |
| 21  | Metodología de desarrollo: Spec-Driven Development según `planning/sdd-process.md`. La redacción de specs empieza con la Etapa 0                                                                                                                                                                                                                                                  | Decidido                                                                                                                                                                 |
| 22  | Acceso del alumno con correo y contraseña, con recuperación de contraseña. Se descarta código de aula + PIN / avatar. `User.email` obligatorio y único por organización                                                                                                                                                                                                           | Decidido. Modificada por la decisión 59: `User.email` es único en toda la plataforma                                                                                    |
| 23  | Bloqueo de 10 minutos tras 10 intentos fallidos de inicio de sesión (sustituye a 5 intentos / 10 min). Misma regla para alumnos y profesora | Decidido. Precisada por la decisión 94: bloqueo sin enumeración y reinicio del ciclo al vencer |
| 24  | Escala de calificación colombiana 0,0–5,0 para toda actividad: fichas, exámenes, microjuegos y revisión manual. Umbral de aprobación 3,0 configurable                                                                                                                                                                                                                             | Decidido                                                                                                                                                                 |
| 25  | Un solo intento por asignación. La profesora puede habilitar un intento adicional a un estudiante desde el área de calificación y feedback. Sustituye a `Assignment.max_attempts`                                                                                                                                                                                                 | Decidido. Implementada con `Attempt.attempt_number` (decisión 74) |
| 26  | Hosting: frontend en Vercel, backend en Render, dominio propio `app.` / `api.`                                                                                                                                                                                                                                                                                                    | Decidido. Precisada por las decisiones 58 (cookies con `Domain=.<dominio>`) y 64 (una sola instancia de la API en el piloto). **Modificada por la decisión 82: el frontend pasa de Vercel a Cloudflare; Render se mantiene** |
| 27  | Retención de audios: borrar tras un plazo módico los audios calificados y los que nunca confirmaron subida. Plazos 30 días / 7 días, configurables                                                                                                                                                                                                                                | Decidido                                                                                                                                                                 |
| 28  | La métrica numérica global de éxito deja de ser requisito. El panel estadístico se centra en rendimiento y constancia por estudiante                                                                                                                                                                                                                                              | Decidido                                                                                                                                                                 |
| 29  | Navegación del portal del alumno: entre 2 y 4 clics según la zona; actividades asignadas a 2 clics                                                                                                                                                                                                                                                                                | Decidido                                                                                                                                                                 |
| 30  | Correo transaccional con Resend. El mismo proveedor y remitente envía el correo de registro (bienvenida y fijar contraseña) y el de recuperación de contraseña                                                                                                                                                                                                                    | Decidido                                                                                                                                                                 |
| 31  | Se rechaza intercambiar las Etapas 6 y 7. El orden de construcción de §12 se mantiene: microjuegos antes que calificación y feedback                                                                                                                                                                                                                                              | Decidido                                                                                                                                                                 |
| 32  | Se aceptan los detalles A16–A23 de `architecture-overview.md` §14.2 (conversión a 0,0–5,0 y tramos de estrellas, recuperación de contraseña, bloqueo, nuevo intento, retención, Resend, techos de clics, Render siempre activo)                                                                                                                                                   | Decidido                                                                                                                                                                 |
| 33  | El registro autónomo del estudiante entra al piloto (antes reservado para Fase 2 y solo para el acudiente). El alumno crea su cuenta con correo y contraseña; queda `pending_approval` hasta que la profesora la revisa, asigna nivel y grupo y la aprueba                                                                                                                        | Decidido. Modificada por la decisión 34: desaparecen la gestión del consentimiento en papel y el alta directa por la profesora; el auto-registro es la única vía de alta. Precisada por las decisiones 73 (un solo grupo al aprobar) y 77 (sin estado `rejected`) |

### Ronda 3 — 2026-09-22

| #   | Decisión                                                                                                                                                                                                                                                                                                                                       | Estado   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 34  | Se aplica en su totalidad `planning/incongruencias-y-decisiones-definitivas.md` (§1–§22) a `CONTEXT.md`, `architecture-overview.md`, `pbp-development.md` y `taskboard.md`. Ese documento es vinculante; sus decisiones no se contradicen sin una nueva fila en esta tabla. Las filas 35–56 resumen cada sección                               | Decidido |
| 35  | §1: se elimina el rol y la entidad `Guardian`. `Student.guardian_name` y `Student.guardian_contact` (opcionales, editables solo por la profesora). El alumno crea su contraseña (8–16 caracteres, sin espacios); cambio de correo con OTP; la profesora no da contraseñas temporales ni crea cuentas: el auto-registro es la única vía de alta | Decidido. Precisada por las decisiones 62 (OTP al correo nuevo, aviso al anterior) y 63 (cambio administrativo del correo por la profesora) |
| 36  | §2: se elimina todo lo relativo a consentimiento legal de menores (`ConsentRecord`, `ConsentStatus`, `ConsentMethod`, documentos legales, Ley 1581). Responsabilidad de la clienta. Solo T&C convencional aceptado por el alumno                                                                                                               | Decidido |
| 37  | §3: `started_at`, `finished_at`, `graded_at` y toda marca de tiempo se asignan en el servidor. Ningún DTO de entrada lleva timestamps                                                                                                                                                                                                          | Decidido. Precisada por la decisión 72: `graded_at` vive en `Attempt` |
| 38  | §4: notificación in-app de nueva versión de la PWA con botón de reinicio, en ambas interfaces                                                                                                                                                                                                                                                  | Decidido |
| 39  | §5: al calificar se envía correo de notificación al alumno sin nota ni feedback; ambos se ven solo en la app                                                                                                                                                                                                                                   | Decidido |
| 40  | §6: el piloto incluye los cinco tipos de ítem desde la primera versión. Audios en R2 30 días tras calificar, 7 días para `pending_upload`; la profesora puede descargar el audio                                                                                                                                                               | Decidido. Terminología precisada por la decisión 66: "cinco tipos de actividad" y "cinco mecánicas de juego" |
| 41  | §7: acceso al panel estadístico y leaderboard solo por RBAC (`teacher`). Se eliminan los flags `stats` y `leaderboard`                                                                                                                                                                                                                         | Decidido |
| 42  | §8: sección de alumnos bloqueados en `Alumnos` y tarjetas de recordatorio en el dashboard (solicitudes pendientes, sin calificar > N días, N = 3 configurable)                                                                                                                                                                                 | Decidido |
| 43  | §9: algoritmo de rachas de 4 reglas (solo semanas activas cuentan; perdón solo con racha activa; se recupera tras 2 semanas activas consecutivas; máximo 1 perdón)                                                                                                                                                                             | Decidido |
| 44  | §10: la validez de un intento la decide `started_at` del servidor frente a `due_at`. Iniciado antes y terminado después: válido. Iniciar después del cierre: rechazado con aviso al alumno                                                                                                                                                     | Decidido. Complementada por las decisiones 60 (tolerancia máxima de 24 h) y 61 (`retry_extend_until`) |
| 45  | §11: ítem no respondido = 0 con su peso en el denominador; un examen requiere mínimo 2 ítems, validado en `POST /activities/:id/publish`                                                                                                                                                                                                       | Decidido. Precisada por la decisión 70: los ítems de examen son `fill_blank` |
| 46  | §12: los pesos de un examen se normalizan proporcionalmente al 100 % al guardar y el formulario muestra el valor ajustado                                                                                                                                                                                                                      | Decidido |
| 47  | §13: audios de speaking: mínimo 2 s (fijo), máximo 120 s por defecto, tope absoluto 300 s, configurable por actividad                                                                                                                                                                                                                          | Decidido |
| 48  | §14: al borrar un alumno se congela el denominador histórico de sus asignaciones (`Assignment.historical_student_count`)                                                                                                                                                                                                                       | Decidido. Precisada por la decisión 73: el conteo usa los alumnos obligados por solape de membresía |
| 49  | §15: Kids 7–10 sin cambio de interfaz; 11+ puede alternar Kids/Teens; job mensual activa `can_switch_interface`; `age_segment` inicial derivado de `birth_date`                                                                                                                                                                                | Decidido |
| 50  | §16: seeds operativos (`seed-dev.ts`) y de volumen (`seed-volume.ts`) además del seed mínimo                                                                                                                                                                                                                                                   | Decidido |
| 51  | §17: estados de error claros y contextuales en toda la interfaz, sin detalles técnicos; `ErrorBoundary` global                                                                                                                                                                                                                                 | Decidido |
| 52  | §18: correo de pendientes a la profesora cada 3 días, solo si hay pendientes                                                                                                                                                                                                                                                                   | Decidido |
| 53  | §19: manual de uso de la profesora en español y tono casual (tarea DOC-06)                                                                                                                                                                                                                                                                     | Decidido |
| 54  | §20: política de rate limiting por endpoint y global (architecture §8.3)                                                                                                                                                                                                                                                                       | Decidido |
| 55  | §21: Cloudflare R2 sustituye a Supabase Storage para archivos; Supabase sigue siendo el único motor SQL                                                                                                                                                                                                                                        | Decidido. El motor SQL pasa a Neon por la decisión 82 |
| 56  | §22: detección de codec en el cliente (`getSupportedMimeType`) y transcodificación asíncrona a MP4/AAC en servidor con `ffmpeg`; `MediaAsset.converted_key`; fallback al raw con aviso                                                                                                                                                         | Decidido |

### Ronda 4 — 2026-09-28

| #   | Decisión | Estado |
| --- | -------- | ------ |
| 57  | Se aplica en su totalidad `planning/decisiones-para-correccion-de-planeacion.md` (§1–§9, fechado el 2026-09-25) a `CONTEXT.md`, `architecture-overview.md`, `sdd-process.md`, `pbp-development.md` y `taskboard.md`. Ese documento es vinculante en lo decidido; sus decisiones no se contradicen sin una nueva fila en esta tabla. Las filas 58–66 resumen cada sección. Las decisiones menores de su §10 no se deciden en esta ronda: quedan como pendientes en §15, cada una con una propuesta vigente y la spec que debe cerrarla | Decidido |
| 58  | §1: cookies de sesión compartidas entre los subdominios del mismo entorno con `Domain=.<dominio>`, `Secure`, `HttpOnly`, `SameSite=Lax` (igual en staging con `app-staging.` / `api-staging.`). `middleware.ts` solo redirige; la autorización es exclusiva de NestJS. Dominio raíz y subdominios bajo control del proyecto; CORS con credenciales y validación de `Origin` obligatorios; las vistas previas de Vercel siguen sin sesión | Decidido. Precisada por las decisiones 81 (`proxy.ts` sustituye a `middleware.ts`, con la misma regla: solo redirige) y 82 (las vistas previas son de Cloudflare y siguen sin sesión) |
| 59  | §2: `User.email` globalmente único (índice único sin `organization_id`). `POST /auth/login` solo recibe correo y contraseña; `POST /auth/signup` rechaza un correo usado en cualquier organización sin enumerar cuentas. Multi-organización futura mediante membresías, nunca duplicando usuarios. Modifica la decisión 22 | Decidido |
| 60  | §3: tolerancia máxima de 24 h después del cierre efectivo para completar un intento iniciado a tiempo (`started_at ≤ due_at`). Después, el `attemptToken` caduca y el job nocturno puede marcar el intento `abandoned`. Nunca aplica a intentos iniciados después del cierre, que no se crean | Decidido |
| 61  | §4: `Attempt.retry_extend_until` (opcional) en el intento que concede la autorización: `null` → el nuevo intento usa el `due_at` original; con valor → es su límite efectivo para iniciar. No anterior al momento de conceder; solo la profesora concede; no hay otra autorización mientras exista una sin consumir; consumo atómico al crear el nuevo intento; historial por `previous_attempt_id`. Sustituye al parámetro `extendUntil` de A19 | Decidido. Los índices únicos parciales se sustituyen por el único con `attempt_number` (decisión 74), sin cambio de comportamiento |
| 62  | §5: en el cambio de correo del alumno el OTP va al correo nuevo; tras el cambio se notifica al correo anterior, que no autoriza el cambio. Se mantienen contraseña actual, OTP de un solo uso y revocación de sesiones | Decidido |
| 63  | §6: la profesora puede modificar el correo de un alumno como operación administrativa excepcional: misma organización, correo globalmente único, revocación de todas las sesiones del alumno, auditoría (quién, cuándo, alumno, correo anterior y nuevo), confirmación explícita, aviso al correo nuevo y, cuando sea posible, al anterior. Nunca ve ni fija la contraseña. Endpoint propio `POST /students/:id/change-email` y tabla `AuditLog` | Decidido |
| 64  | §7: una sola instancia activa de la API durante el piloto. Cola de transcodificación y rate limiting en memoria aceptados solo bajo esa restricción; rutina de recuperación al arrancar para conversiones interrumpidas; operación idempotente con registro de reintentos y fallos; el raw se conserva hasta confirmar la conversión. Render con una instancia siempre activa en producción. Antes de escalar horizontalmente, externalizar cola y rate limiting | Decidido. Complementada por la decisión 76 (`ScheduledJobRun`) |
| 65  | §8: la Etapa 0 se mantiene como arranque, pero no es paralela a las Etapas 1 y 2 en sus dependencias obligatorias: la Etapa 1 empieza al aprobar `SPEC-01`; la Etapa 2, al aprobar `SPEC-02` y entregar las dependencias técnicas de la Etapa 1. Cuentas, dominio, repositorio, tokens y observación se preparan en paralelo | Decidido |
| 66  | §9: terminología oficial: "tipo de actividad" para los cinco valores de `ActivityType` (`fill_blank`, `open_question`, `speaking`, `game`, `exam`) y "mecánica de juego" para los cinco de `GameMechanic` (`match`, `order_words`, `drag_drop`, `memory`, `timed_choice`). "Cinco tipos de actividad" reemplaza a "cuatro tipos" y a "tipos de ítem". Corrección editorial y de trazabilidad, sin cambio de alcance | Decidido |

### Ronda 5 — 2026-09-28 (modelo de datos)

| #   | Decisión | Estado |
| --- | -------- | ------ |
| 67  | Se aplica `planning/decisiones-modelo-de-datos.md` (§1–§14), resultado de la auditoría del modelo entidad-relación que cierra la etapa de planeación, a `CONTEXT.md`, `architecture-overview.md` (§6 reescrito y detalles A56–A70 en §14.5), `pbp-development.md` y `taskboard.md`. Ese documento es vinculante en lo decidido. Las filas 68–80 resumen §1–§13; §14 ratifica lo revisado sin cambios (tablas de detalle, `payload` en JSON con escritura atómica, campos de habilitación en el intento que concede, `can_switch_interface`, `historical_student_count`). **No se adopta** su §15: los parámetros de organización siguen en `FeatureFlag.config` y la zona horaria sigue fija en America/Bogota | Decidido |
| 68  | §1: entidad `AuthSession`, una fila por familia de sesión (`id` = `sid`, `refresh_token_hash` del refresh vigente, `expires_at`, `rotated_at`, `revoked_at`). Sostiene rotación con detección de reutilización, logout y revocación de sesiones; `JwtAuthGuard` rechaza sesiones revocadas; limpieza nocturna; entra en el borrado en cascada | Decidido |
| 69  | §2: `EmailChangeRequest.failed_attempts`; el tercer OTP incorrecto invalida la solicitud | Decidido |
| 70  | §3: los ítems de un examen son exclusivamente de tipo `fill_blank`; `ExamDetail` guarda los ítems en `config` y la clave por ítem en `answer_key`; el scorer de examen reutiliza el de `fill_blank`. Otros subtipos requieren decisión nueva | Decidido |
| 71  | §4: `ProgressEvent` con `value` (numeric, solo magnitudes), `attempt_id`, `payload` y `period_key`; sin `source`. Rendimiento se calcula sobre `Attempt`; constancia y gamificación, sobre `ProgressEvent` | Decidido |
| 72  | §5: `Attempt.score` y `Attempt.graded_at` son la única fuente de la calificación para los cinco tipos de actividad; `Review` queda solo como feedback (`comment`, `stickers`, `reviewer_id`), sin `score` ni `graded_at`; sobre un autocalificado no se acepta nota (`SCORE_NOT_EDITABLE`) | Decidido |
| 73  | §6 (decisión de producto): un alumno aprobado pertenece a **un solo grupo a la vez**. `GroupMembership` con `joined_at` / `left_at` y único parcial de membresía vigente; la aprobación recibe un `groupId`; cambio de grupo con `PUT /students/:id/group`; el alumno solo ve e inicia asignaciones de su grupo vigente y conserva sus intentos ya empezados; los alumnos obligados por una asignación son los que tuvieron membresía solapada con `[opens_at, due_at]` | Decidido |
| 74  | §7: `Attempt.attempt_number` con único `(assignment_id, student_id, attempt_number)`; sustituye a los dos índices únicos parciales de la decisión 61 sin cambiar su comportamiento | Decidido |
| 75  | §8: `config` y `answer_key` en columnas separadas en las tablas de detalle con clave; Prisma omite `answer_key` por defecto | Decidido |
| 76  | §9: tabla `ScheduledJobRun` (único por organización, tarea y periodo) para la idempotencia persistente de las tareas periódicas; únicos `BadgeAward(student_id, badge_rule_id)` y `ProgressEvent(student_id, type, period_key)` | Decidido |
| 77  | §10: `ApprovalStatus` queda con `pending_approval` y `approved`; se elimina `rejected`, que nunca llegaba a persistirse | Decidido |
| 78  | §11: índices en claves foráneas, único parcial de un audio `ready` por intento, sustitución de los índices de intentos y membresías, retirada de `User(locked_until)` y `Student(organization_id, birth_date)` | Decidido |
| 79  | §12: `Activity.expected_duration_seconds` y `min_plausible_seconds`; `User.name` para todos los roles y sin `Student.name`; `BadgeRule` por organización; `Review.stickers` como catálogo fijo; campos de `ExternalResource`; `Group.archived_at`; diagrama entidad-relación completo | Decidido |
| 80  | §13: política de `onDelete` por relación: `Restrict` para organización, autoría de la profesora, actividades asignadas, grupos con historia, asignaciones con intentos y reglas de insignia; `Cascade` como red de seguridad bajo el alumno y el intento; `NoAction` en `previous_attempt_id` | Decidido |

### Ronda 6 — 2026-10-10 (stack de frontend y despliegue de bajo coste)

| #   | Decisión | Estado |
| --- | -------- | ------ |
| 81  | Formalización histórica de **Next.js 16 (App Router) + React 19**, TypeScript >= 5.1, Node.js >= 20.9 (LTS) y pnpm >= 9 (supersedida en versiones por la decisión 88), que corrige la inconsistencia "Next.js 14+ / React 19" (peer-dependencies en pnpm). Convenciones asociadas: Turbopack por defecto; React Compiler habilitado; **`proxy.ts` sustituye a `middleware.ts`** (runtime Node.js, sin Edge; conserva la regla de la decisión 58: solo redirige, la autorización es de NestJS); **modelo de caché explícito con `use cache`** (requiere `cacheComponents: true`); **`@atlaskit/pragmatic-drag-and-drop` sustituye a `@dnd-kit`** en los microjuegos de arrastrar y soltar de la Etapa 6, con prueba en tablet real y evaluación en SPEC-06 de una alternativa sin arrastre. Sin cambio de alcance ni de lógica de negocio | Decidido. Su compatibilidad con el adaptador de Cloudflare (`proxy.ts`, React Compiler, tamaño de bundle) se verifica en el PoC ENG-140 |
| 82  | **Despliegue de bajo coste.** (a) Frontend: Vercel → **Cloudflare** (Pages/Workers) con `vinext` u OpenNext (`@opennextjs/cloudflare`), decisión histórica supersedida por la decisión 87. (b) Postgres: Supabase → **Neon** (pooler PgBouncer para el runtime, conexión directa para migraciones). (c) Backend: **Render se mantiene** (Railway descartado: mayor coste por uso con `ffmpeg` y sin dominios propios en su plan gratuito). (d) R2 y Resend sin cambios. (e) **`staging` y la demo usan el combo gratuito** (Cloudflare Free + Render Free + Neon Free + R2 + Resend Free, $0) para ~11 personas, 1–2 semanas, con protocolo (llamar a `/health` 5 min antes, entradas escalonadas, máximo 2–3 audios a la vez, audios de demo de 60–90 s, una consulta semanal contra el frío); **no es apta para clases reales** y no se usa en producción. (f) **`production`** del piloto (1 profesora, ~30 alumnos) usa Cloudflare Workers Paid ($5), Render Starter ($7, siempre activo) y Neon Launch (~$5, scale-to-zero desactivado en horario de clase), ~$16–19/mes. (g) Criterio de salto de la demo al piloto: más de 15 usuarios activos, horario de clases fijo de 2 o más veces por semana, o un incidente de suspensión en vivo. (h) La decisión 64 (una sola instancia, cola y rate limit en memoria) **queda intacta**; el sueño de Render Free solo se acepta en demo. (i) Modifica las decisiones 1, 26, 55 y 58 solo en lo que nombran proveedores. (j) Contingencia: si el PoC falla, se registra una decisión nueva (por ejemplo, volver a Vercel o a Supabase) en lugar de ajustar el código en silencio | Decidido, **condicionado al PoC go/no-go ENG-140** (7 comprobaciones, architecture §11.5) |
| 83  | Cierre de preguntas de scaffold Q-1 y Q-2 (decidido por el líder del proyecto): (a) **Prefijo de API y documentación (Q-1):** excepción explícita a la regla de prefijo de architecture §13: `/health` y `/docs` se exponen en la raíz de la API (`GET /health` y `GET /docs`), sin prefijo `/api/v1`. La documentación interactiva (`GET /docs`) queda deshabilitada en producción (`APP_ENV === 'production'`) respondiendo `404`. Todo endpoint funcional de negocio reside bajo `/api/v1`. (b) **Configuración canónica en `FeatureFlag` (Q-2):** las únicas claves iniciales de `FeatureFlag` son `games` y `extra_content` (ambas `enabled: false` en los seeds). Los cuatro parámetros generales de la organización (`passing_score = 3.0`, `retention_days = 30`, `pending_upload_ttl_days = 7`, `ungraded_reminder_days = 3`) se almacenan canónicamente en `games.config`, mientras que `extra_content.config = {}`. El servicio de configuración los lee de `games.config` independientemente de si `enabled` es `true` o `false`. Evita duplicar datos o añadir claves no autorizadas en el esquema | Decidido |
| 84 | Cierre y ratificación de los pendientes P-1 a P-5 de CONTEXT §15. **La parte P-4 quedó supersedida por la decisión 92**; las demás resoluciones siguen vigentes. | Decidido |
| 85  | **Elección definitiva de adaptador Cloudflare para Next.js 16 (`vinext`) tras el PoC ENG-140.** (a) El prototipo desechable evaluó empíricamente `@opennextjs/cloudflare` vs `vinext`. OpenNext quedó descartado por incompatibilidad de symlinks en Windows (`EPERM`) y falta de soporte oficial de `proxy.ts`. (b) `vinext` superó el 100% de `vinext check`, compiló Worker de 91.69 kB gzip (apenas ~3% del techo de 3 MB) y validó redirecciones de `proxy.ts` con cookies `Domain=.englove.org`. (c) Las siete comprobaciones de ENG-140 quedaron en VERDE (informe en `planning/poc-eng-140-informe.md`), desbloqueando la aprobación de SPEC-01 | Decidido |

### Ronda 7 — 2026-10-10 (correcciones de capacidad, arquitectura y operación)

| # | Decisión | Estado |
|---|---|---|
| 86 | La capacidad se expresa por horizonte: inicio probable de 1 profesora y ~10 estudiantes; compromiso operativo de corto/medio plazo de ~30 estudiantes activos; capacidad objetivo de crecimiento de hasta 100 estudiantes. Los 100 no representan concurrencia exigida al primer despliegue. | Decidido |
| 87 | La web se despliega únicamente como Cloudflare Worker mediante `vinext` y Wrangler. Pages queda fuera de la topología; la API permanece en Render. | Decidido |
| 88 | Versiones base recomendadas: Next.js 16.4, React 19.3, Node.js 24 LTS, TypeScript 5.9, pnpm 11, Tailwind CSS 4, NestJS 11, Prisma 7, PostgreSQL 18 y Turborepo 2. Los parches exactos se fijan en el lockfile. | Decidido |
| 89 | Todas las tablas de tenant incluyen `organization_id` directo, incluidas `Attempt`, `Review`, `MediaAsset`, `ProgressEvent`, `BadgeAward`, `GroupMembership`, `Assignment`, `AuthSession`, `PasswordResetToken` y `EmailChangeRequest`. Las restricciones y consultas no dependen de inferencia por joins. | Decidido |
| 90 | Al cambiar de grupo, el alumno no puede iniciar asignaciones antiguas, pero conserva acceso de lectura y puede completar los intentos ya iniciados hasta su cierre efectivo + 24 horas. | Decidido |
| 91 | Antes del piloto debe existir un procedimiento operativo externo para autorización de participación de menores, solicitudes de privacidad y borrado coordinado en Neon y R2. No se implementa como módulo ni pantalla. | Decidido |
| 92 | `AuditLog` conserva el evento técnico cuando se elimina un alumno, pero se desvincula del alumno y se redactan los correos de `details`; no se borran los registros de auditoría por cascada. | Decidido |

### Ronda 8 — 2026-10-20 (cierre de SPEC-02)

| # | Decisión | Estado |
| --- | --- | --- |
| 93 | **Alcance de alumnos en Etapa 2 (Q-01 de SPEC-02):** ENG-023 entrega lista, ficha, edición y solicitudes con aprobación/rechazo. El alta sigue siendo exclusivamente `POST /auth/signup`. La única eliminación en esta etapa es `POST /students/:id/reject` sobre `pending_approval`, sin historial pedagógico. `DELETE /students/:id` y la cascada completa permanecen en SPEC-05 / ENG-070 / Etapa 5, con borrado de objetos R2 antes de filas, congelación del denominador histórico y redacción/desvinculación de `AuditLog` (decisión 92). Se precisa «CRUD Student» en PBP/taskboard; no se permite un DELETE parcial basado solo en FK ni adelantar multimedia. No cambia el alcance de grupos ni la UI de SPEC-03. | Decidido por el líder del proyecto |
| 94 | **Bloqueo sin enumeración (Q-02 de SPEC-02):** correo inexistente o contraseña incorrecta siempre producen `401 AUTH_INVALID_CREDENTIALS`, también durante un bloqueo. Verificar contraseña antes de revelar bloqueo: solo credenciales correctas con bloqueo activo reciben `423 AUTH_ACCOUNT_LOCKED` y segundos restantes en `Retry-After`, sin sesión. El décimo fallo devuelve 401 y persiste contador 10 con bloqueo de 10 minutos. Durante el bloqueo, contador/plazo no cambian. Al vencer, reiniciar el ciclo antes de evaluar el siguiente login, independientemente del cron; el siguiente fallo cuenta 1 y el acierto deja cero. Tras contraseña correcta, comprobar bloqueo antes que aprobación. Misma política para profesora/alumno; solo alumnos admiten desbloqueo administrativo. El throttling HTTP 429 sigue separado. Precisa la decisión 23 y sustituye la comprobación de bloqueo sin contraseña de architecture §7.1. | Decidido por el líder del proyecto |

Para registrar una decisión nueva: añadir una fila en la ronda vigente (o abrir una ronda nueva con fecha) y actualizar la sección afectada de este documento en el mismo cambio.

---

## 15. Pendientes abiertos

**Pendientes (requieren decisión humana):**

- Nombre definitivo del producto.

**Decisiones de planeación cerradas:** Todos los pendientes técnicos y de dominio P-1 a P-5 de esta sección han sido formalizados y confirmados por el líder del proyecto el 2026-10-10 (decisión 84, con P-4 actualizado por la decisión 92). No quedan P-n abiertos para el piloto.

**Cerrados el 2026-10-10 y actualizados el 2026-10-19 (decisiones 83, 84 y 92):** P-1 (rechazo `409 ATTEMPT_NOT_OPEN` antes de `opens_at`), P-2 (comentario obligatorio solo en revisión manual; opcional en autocalificados), P-3 (máximo 3 intentos de transcodificación y fallback permanente a raw), P-4 (`AuditLog` sin pantalla de consulta; al borrar al alumno se conserva el evento técnico con `target_student_id` en `SetNull` y `details` redactado, decisión 92), P-5 (multi-organización aplazado a Fase 2), Q-1 (excepción para `/health` y `/docs` sin prefijo; `/docs` 404 en producción) y Q-2 (fuente canónica de configuración en `games.config` con `enabled: false` inicial).

**Cerrados el 2026-10-20 (SPEC-02, decisiones 93 y 94):** Q-01 (rechazo de pendientes en Etapa 2; baja general completa en SPEC-05 / ENG-070) y Q-02 (bloqueo sin enumeración, décimo fallo uniforme y reinicio del ciclo al vencer). Los prerrequisitos operativos de SPEC-02 §11 no son nuevos P-n ni se dan por entregados al aprobar el contrato.

**Cerrados el 2026-09-21:** métrica numérica del piloto (retirada), UX de acceso del alumno, retención de audios y sus plazos, política de reintentos, hosting por capa, umbral de aprobación, bloqueo para la profesora, proveedor de correo transaccional, intercambio de etapas 6 y 7 (rechazado), registro autónomo del estudiante en el piloto con aprobación de la profesora.

**Cerrados el 2026-09-22 (decisión 34):** entidad de acudiente, consentimiento legal, reloj de los intentos, actualizaciones de la PWA, canal de notificación de calificaciones, alcance de tipos del piloto, control de acceso al panel estadístico, bloqueados y recordatorios, algoritmo de rachas, `due_at`, ítems no respondidos y mínimo de ítems, normalización de pesos, duración de audios, denominador histórico, `age_segment`, seeds, estados de error, correo de pendientes, manual de la profesora, rate limiting, almacenamiento en R2, compatibilidad de audio entre navegadores.

**Cerrados el 2026-09-28 (decisión 67, auditoría del modelo de datos):** persistencia de sesiones, contador de OTP, subtipos de ítem de examen, forma de `ProgressEvent`, fuente única de la calificación, alumnos en varios grupos (un solo grupo vigente), unicidad de intentos, ubicación de la clave de respuestas, idempotencia de tareas tras reinicios, estado `rejected`, índices, campos faltantes y política de borrado de claves foráneas.

---

## 16. Convenciones para agentes que trabajen en este repositorio

- Respetar todo lo marcado como **Decidido**. Si una tarea exige cambiarlo, proponerlo como nueva entrada en §14, no implementarlo en silencio.
- **Trabajar bajo SDD (§11.1):** antes de implementar, leer la spec Aprobada de la capacidad en `specs/` y las secciones que enlaza. No escribir código de producción sin spec Aprobada. Lo que la spec no pide no se construye; lo que falta se anota en sus preguntas abiertas. Reglas completas en `planning/sdd-process.md` §9.
- No construir nada listado en §2.4 durante el piloto.
- Idioma (Decidido con las convenciones de código y API, decisión 20): identificadores de código, nombres de tablas y columnas en inglés; documentación y textos de interfaz en español. El idioma de los mensajes de commit es libre (español o inglés). El contenido pedagógico es en inglés por naturaleza del producto.
- Todo tipo de actividad nuevo requiere tres piezas: esquema Zod en el paquete compartido, tabla de detalle 1:1 en Prisma, e implementación del contrato de actividad (§7.3).
- Tipado estricto sin `any`, `@ts-ignore`, `@ts-nocheck` ni aserciones ciegas (`as Type`). Contratos únicos en `packages/shared`.
- Validación en dos niveles: `class-validator` para envoltura HTTP en NestJS con `whitelist: true` y `transform: true` (sin `forbidNonWhitelisted: true`, respetando A71); `Zod` en `packages/shared` para actividades.
- Toda consulta a datos de tenant filtra por `organization_id`. Prohibido `findUnique` por id en tablas de tenant sin validar `organization_id` (anti-IDOR); en rutas de alumno, aislar por `student_id = currentUser.studentId` en `Attempt`, `MediaAsset` y `ProgressEvent`. Mutaciones concurrentes sobre JSON (`Attempt.payload`) atómicas en base de datos.
- Todo puntaje se calcula en el backend y se expresa en la escala 0,0–5,0. Ningún endpoint acepta un puntaje enviado por el cliente.
- Toda marca de tiempo se asigna en el servidor. Ningún DTO de entrada acepta `started_at`, `finished_at` ni equivalentes (decisión 34 §3).
- No introducir ninguna referencia a `Guardian`, `ConsentRecord`, `ConsentStatus`, `ConsentMethod`, Supabase Storage ni a los flags `stats` o `leaderboard`. Están eliminados (decisión 34).
- Los archivos binarios van siempre a Cloudflare R2 mediante URLs firmadas por el backend con validación de MIME y límite de 10 MB, verificando `HEAD` antes de transcodificar.
- Transcodificación de audio: proceso `ffmpeg` invocado con argumentos estructurados (`shell: false`), archivos temporales en `os.tmpdir()` limpiados en `finally` y cola serial (1 tarea a la vez en 512 MB de Render).
- Terminología (decisión 66): "tipo de actividad" solo para los cinco valores de `ActivityType`; "mecánica de juego" solo para los cinco valores de `GameMechanic`. `fill_blank` y `exam` son tipos de actividad, no mecánicas.
- `User.email` es globalmente único: ninguna consulta ni restricción de correo lleva `organization_id` (decisión 59). Ningún endpoint público revela si un correo existe.
- La autorización nunca depende del `proxy.ts` de Next.js: solo redirige (decisiones 58 y 81).
- Next.js 16.4 y React 19.3 (decisiones 81 y 88): no crear `middleware.ts` (se usa `proxy.ts`); no usar `@dnd-kit`; toda caché se declara con `use cache` (con `cacheComponents: true`), nunca implícita y jamás en datos autenticados; Server Components (RSC) por defecto y componentes cliente en las hojas; API consumida con TanStack Query (sin Server Actions como backend de negocio); Node.js 24 LTS y TypeScript 5.9. Ningún ajuste de código se hace en silencio para que algo "compile" en Cloudflare: si el PoC ENG-140 revela una incompatibilidad, se registra una decisión nueva (decisión 82 (j)).
- Privacidad y seguridad: cero PII en logs y Sentry; sin `dangerouslySetInnerHTML`; limpiar IndexedDB (`pendingEvents`, `pendingUploads`) y caché de TanStack Query al hacer logout en tablets compartidas; enlaces externos con `https:` estricto.
- Proveedores (decisión 82): frontend en Cloudflare, API en Render, Postgres en Neon, archivos en R2. No introducir Vercel ni Supabase en configuración, scripts ni documentación nuevos. La demo gratuita (Render Free, Neon Free) no se usa para clases reales.
- No introducir ningún estado de proceso que asuma varias instancias ni habilitar más de una instancia de la API sin externalizar antes la cola de trabajos y el rate limiting (decisión 64). Toda tarea asíncrona debe ser idempotente.
- La creación de un nuevo intento consume la habilitación de forma atómica; nunca dos intentos hijos para una misma autorización (decisión 61), garantizado por el único con `attempt_number` (decisión 74).
- Modelo de datos (decisión 67): la calificación solo se escribe en `Attempt.score` / `graded_at`, nunca en `Review`; `answer_key` nunca se selecciona en consultas del alumno; un alumno tiene exactamente una membresía de grupo vigente; toda clave foránea declara su `onDelete` según architecture §6.2; toda tarea periódica registra su ejecución en `ScheduledJobRun`; ninguna consulta usa `Student.name` (el nombre vive en `User.name`).
- Al cerrar un pendiente de §15 o cambiar una decisión de §14, actualizar este documento en el mismo cambio.

---

## 17. Glosario

- **MCER:** Marco Común Europeo de Referencia para las lenguas (A1–C2). Englove usa A1–B2.
- **Activity / Assignment / Attempt:** plantilla de actividad, asignación de esa plantilla a un grupo con fechas, e intento de un alumno sobre una asignación.
- **Kids / Teens:** segmentos de edad 7–10 (solo Kids) y 11+ (puede alternar entre ambos), cada uno con su tema visual.
- **Contenido extra:** sección de enlaces externos (Educaplay y otros) fuera del flujo de calificación.
- **Contrato de actividad:** interfaz común que toda actividad implementa (§7.3).
- **ProgressEvent:** evento append-only del que se derivan puntos, insignias y rachas.
- **Acudiente:** padre, madre o representante legal del alumno. En la plataforma solo existe como datos de contacto en `Student.guardian_name` y `Student.guardian_contact`; no tiene cuenta, rol ni entidad propia.
- **Perdón de racha:** semana inactiva que no rompe la racha. Máximo uno disponible; solo se usa con racha activa y se recupera tras dos semanas activas consecutivas (§5.4).
- **`can_switch_interface`:** marca del alumno que se activa al cumplir 11 años y le permite alternar entre Kids y Teens desde su perfil.
- **Cola de revisión:** lista de intentos (audios y respuestas abiertas) pendientes de calificación manual por la profesora. El área de calificación y feedback también muestra los intentos autocalificados para comentar o habilitar un nuevo intento.
- **Spec / SDD:** especificación de una capacidad, aprobada antes de implementarla; Spec-Driven Development es la metodología del proyecto (§11.1, `planning/sdd-process.md`).
- **Escala 0,0–5,0:** escala colombiana de calificación usada en toda la plataforma; 3,0 es el umbral de aprobación.
- **Solicitud de registro / `pending_approval`:** cuenta de estudiante creada por auto-registro, activa solo tras la revisión y aprobación de la profesora (§4.1).
- **Tipo de actividad:** cada uno de los cinco valores de `ActivityType` (`fill_blank`, `open_question`, `speaking`, `game`, `exam`). Son las cinco opciones principales que ve la profesora.
- **Mecánica de juego:** cada una de las cinco variantes del tipo `game` (`match`, `order_words`, `drag_drop`, `memory`, `timed_choice`).
- **Cierre efectivo:** fecha límite para iniciar un intento: `Assignment.due_at`, o `retry_extend_until` del intento anterior si la profesora fijó un plazo al habilitar un nuevo intento (§5.1).
- **Tolerancia de 24 h:** ventana tras el cierre efectivo en la que un intento iniciado a tiempo todavía puede completarse (§5.1).
- **Grupo vigente / alumnos obligados:** cada alumno aprobado tiene una sola membresía de grupo vigente (`left_at` nulo); una asignación obliga a los alumnos que tuvieron membresía en su grupo durante `[opens_at, due_at]` (decisión 73).
- **Demo / piloto lean:** la **demo** es el entorno gratuito ($0) de validación con ~11 personas (Cloudflare Free + Render Free + Neon Free); el **piloto lean** es `production` con planes mínimos de pago (~$16–19/mes) para ~10 alumnos inicialmente, preparado para ~30 alumnos activos (decisión 86).
- **`proxy.ts`:** archivo de Next.js 16 que sustituye a `middleware.ts`; en Englove solo redirige por rol y nunca autoriza (decisiones 58 y 81).
- **`AuthSession`:** familia de sesión de un usuario; su `id` es el `sid` del JWT y revocarla cierra esa sesión en todos los dispositivos que la compartan (decisión 68).
- **`AuditLog`:** registro en base de datos de operaciones administrativas sobre datos sensibles del alumno, como el cambio de su correo por la profesora (§4).
