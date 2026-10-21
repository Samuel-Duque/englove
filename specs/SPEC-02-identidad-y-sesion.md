# SPEC-02 — Identidad y sesión

| Campo | Valor |
| --- | --- |
| Estado | Verificada |
| Etapa | 2 — Identidad y roles |
| Tareas | ENG-020, ENG-021, ENG-023, ENG-024, ENG-025, ENG-026, ENG-027, ENG-028, ENG-029 |
| Referencias | CONTEXT §2.4, §3–§4.1, §9–§12, §14–§17 · architecture §3.1–§3.2, §3.6, §3.8, §4.1–§4.3, §4.5–§4.6, §6.2–§6.5, §7.1–§7.4, §8, §13, §15 · pbp §2.1, §3, Etapas 1–3 y 5 · sdd-process §5–§9 |
| Aprobada por / fecha | Líder del proyecto / 2026-10-20 |

## 1. Contexto y objetivo

Identidad permite entrar, solicitar cuenta, recuperar acceso y cambiar correo. La aprobación separa registro de acceso ([CONTEXT §4](../.agents/CONTEXT.md#4-identidad-y-autenticación--decidido)); NestJS autentica y autoriza.

Consume esquema/configuración/correo de [SPEC-01](./SPEC-01-scaffold.md), sin adelantar gestor ni portal. Aprobada con decisiones 93–94; iniciar Etapa 2 exige las dependencias de decisión 65 y §11.

## 2. Alcance

- Incluye: login/sesiones/guards/tenant, bloqueo, auto-registro, APIs de alumnos/solicitudes, recuperación/cambio propio de correo, flags, HTTP seguro, mantenimiento y pruebas.
- Pantallas: `/login`, `/registro`, `/recuperar-contrasena`, `/restablecer/[token]` y destino vacío por rol. Aprobación, rechazo y desbloqueo tienen API, no interfaz de gestión.
- No incluye: panel, grupos y cambio administrativo de correo (SPEC-03); perfil, selector de interfaz, job mensual y cascada con historial (SPEC-05 / ENG-070, decisión 93); capacidades pedagógicas, PWA/offline y demás módulos posteriores. Nada de CONTEXT §2.4 ni pantallas de `parent`/`admin`.

## 3. Requisitos funcionales

**RF-1 — Login único.** ENG-020; decisiones 22 y 59, architecture §7.1.

- **Dado** una profesora o un alumno aprobado sin bloqueo activo **Cuando** presenta correo normalizado y contraseña correcta **Entonces** recibe `200`, identidad de §5 y cookies de §4; se crea una `AuthSession` y el contador de fallos vuelve a cero.
- **Dado** correo inexistente o contraseña incorrecta, incluso con cuenta bloqueada **Cuando** intenta entrar **Entonces** recibe idéntico `401 AUTH_INVALID_CREDENTIALS`, sin cookies ni información de organización. No se acepta organización ni rol del cliente.

**RF-2 — Pendientes sin acceso.** ENG-020; decisiones 33 y 77.

- **Dado** una cuenta pendiente sin bloqueo activo **Cuando** presenta la contraseña correcta **Entonces** recibe `403 ACCOUNT_PENDING_APPROVAL`, sin crear sesión; con contraseña incorrecta recibe el error uniforme de RF-1. Una cuenta eliminada responde como inexistente. Ningún guard permite acceso de un alumno pendiente, tampoco con JWT sintético firmado de pruebas.

**RF-3 — Rotación y revocación efectivas.** ENG-020; decisión 68.

- **Dado** un refresh vigente **Cuando** se renueva **Entonces** recibe `200`, nuevo par de cookies y hash persistido, conservando el `sid`; se fijan `rotated_at` y `last_used_at` del servidor.
- **Dado** ese refresh ya consumido **Cuando** se reutiliza **Entonces** recibe `401 AUTH_UNAUTHORIZED`, se revoca la familia y también se rechaza su access aún no caducado. Una sesión caducada/revocada nunca se renueva.

**RF-4 — Bloqueo 10/10 sin enumeración.** ENG-024; decisiones 23 y 94, architecture §7.1.

- **Dado** nueve fallos consecutivos **Cuando** falla otra vez **Entonces** recibe `401 AUTH_INVALID_CREDENTIALS` uniforme; persiste contador 10 y `locked_until = now() + 10 minutos`.
- **Dado** bloqueo activo **Cuando** intenta entrar **Entonces** contraseña incorrecta devuelve el mismo 401; correcta, `423 AUTH_ACCOUNT_LOCKED` con segundos restantes en `Retry-After`, antes de comprobar aprobación. Nunca crea sesión ni modifica contador/plazo.
- **Dado** bloqueo vencido **Cuando** llega otro login **Entonces** limpia bloqueo/reinicia contador antes de evaluarlo, sin esperar al cron: contraseña incorrecta cuenta 1; correcta deja cero/null y permite entrar si está aprobada. Igual para profesora/alumno; sin desbloqueo administrativo de profesora. Concurrencia no pierde incrementos ni extiende bloqueos.

**RF-5 — Desbloqueo de alumnos.** ENG-024.

- **Dado** una profesora **Cuando** lista bloqueados **Entonces** solo recibe alumnos de su organización con `locked_until > now()`; desbloquear uno devuelve `204`, contador cero y bloqueo null. Repetir es inocuo; otro tenant da `404 NOT_FOUND` y un alumno da `403 FORBIDDEN`.

**RF-6 — Registro transaccional.** ENG-029; decisiones 33, 35, 37, 49 y 79.

- **Dado** datos válidos, correo nuevo y T&C aceptados **Cuando** se registra **Entonces** se crean exclusivamente `User` y `Student` en la organización piloto, con contraseña argon2id, nombre en `User`, T&C versionados por servidor, contactos opcionales y estado pendiente sin nivel/membresía. Segmento y permiso de alternancia se derivan de nacimiento. Responde `201`, sin cookies, y solicita `signup-received`.

**RF-7 — Registro sin enumeración.** ENG-029; decisión 59.

- **Dado** correo usado en cualquier organización **Cuando** se registra con entrada válida **Entonces** no modifica ni crea filas, responde igual que RF-6 y solicita `signup-existing-account` al dueño. Dos registros simultáneos crean un solo par de filas; la colisión única se trata como correo existente, no como `409`/`500`.

**RF-8 — Validación de identidad.** ENG-025/ENG-029; decisiones 35 y 37, architecture A71.

- **Dado** registro o restablecimiento **Cuando** la contraseña incumple 8–16 caracteres o contiene espacios en blanco **Entonces** responde `400 PASSWORD_POLICY` antes de consultar la existencia del correo. T&C no aceptados, fecha inválida o datos mal formados dan `400 VALIDATION_ERROR`.
- **Dado** campos extra como `role`, `organizationId`, `approvalStatus` o `createdAt` **Cuando** llega una petición **Entonces** se descartan, nunca alteran privilegios ni tiempos; la fecha civil `birthDate` sí es dato de entrada válido.

**RF-9 — Consulta y edición de alumnos.** ENG-023; decisiones 35, 73 y 79.

- **Dado** profesora del tenant **Cuando** lista, consulta o edita un alumno **Entonces** obtiene la proyección de §5; nombre se edita en `User`, contactos en `Student`, atómicamente. No se cambia correo, contraseña, aprobación ni grupo mediante PATCH. Un pendiente sigue sin nivel; un aprobado no puede quedar sin nivel/grupo. `student` recibe `403`; ID ajeno, `404`.

**RF-10 — Aprobación y rechazo por API.** ENG-023; decisiones 33, 73 y 77.

- **Dado** solicitud pendiente **Cuando** la profesora aprueba con nivel y un grupo propio no archivado **Entonces** una transacción crea exactamente una membresía vigente, aplica correcciones permitidas y aprueba; solicita `approved` después del commit y permite login. Grupo ajeno/inexistente da `404`; archivado, `409 GROUP_ARCHIVED`; carreras no duplican membresía ni aprobación.
- **Dado** solicitud pendiente **Cuando** la rechaza **Entonces** devuelve `204`, elimina cuenta y datos dependientes de identidad sin huérfanos ni correo de rechazo; permite re-registro. Sobre aprobado no rechaza ni borra: `409 STUDENT_NOT_PENDING`. La baja general completa corresponde a SPEC-05 / ENG-070 (decisión 93); no se sustituye por rechazo ni por DELETE parcial.

**RF-11 — Solicitud de recuperación uniforme.** ENG-028; architecture §7.3–§7.4.

- **Dado** correo válido existente o inexistente **Cuando** solicita recuperación **Entonces** obtiene idéntico `202` y cuerpo de §5. Solo si existe se guarda hash de token aleatorio de 32 bytes, válido 30 minutos, y se solicita `password-reset` al correo registrado. Visitar el enlace no consume el token.
- **Dado** profesora del tenant **Cuando** inicia recuperación de un alumno **Entonces** genera el mismo enlace para él, nunca lo recibe ni fija contraseña. Recurso ajeno da `404`; rol alumno, `403`.

**RF-12 — Restablecimiento de un solo uso.** ENG-028; decisiones 32 y 68.

- **Dado** token vigente sin usar y contraseña válida **Cuando** restablece **Entonces** en una transacción cambia el hash, consume el token, invalida recuperaciones pendientes y revoca todas las sesiones; responde `200`, sin autenticar automáticamente. Token usado, caducado o desconocido da `400 PASSWORD_RESET_INVALID`; dos consumos concurrentes solo permiten uno.

**RF-13 — Solicitud de cambio propio de correo.** ENG-028; decisiones 62 y 69.

- **Dado** alumno autenticado y contraseña actual correcta **Cuando** solicita correo nuevo libre **Entonces** crea solicitud con OTP criptográficamente aleatorio de seis dígitos, hash, diez minutos y cero fallos; envía `email-change-otp` al correo nuevo y responde `202`. No cambia correo todavía. Contraseña incorrecta da `401 AUTH_INVALID_CREDENTIALS`; correo ocupado, `409 EMAIL_TAKEN`.

**RF-14 — Confirmación de correo atómica.** ENG-028; decisiones 59, 62, 68 y 69.

- **Dado** solicitud vigente propia **Cuando** confirma OTP correcto **Entonces** consume solicitud, cambia correo manteniendo unicidad global, invalida recuperaciones anteriores y revoca las demás sesiones, no la actual; devuelve `200` y solicita aviso al correo anterior. El anterior no autoriza ni puede deshacer el cambio. Si el correo fue ocupado entre pasos, `409 EMAIL_TAKEN` sin cambio parcial.
- **Dado** OTP incorrecto **Cuando** acumula el tercer fallo **Entonces** invalida la solicitud. Código incorrecto, agotado, caducado, usado o sin solicitud da `400 OTP_INVALID`; concurrencia no pierde fallos ni permite doble consumo.

**RF-15 — Autorización y aislamiento.** ENG-021/ENG-026; decisiones 59, 68 y 89, architecture §4.3.

- **Dado** JWT ausente, manipulado, caducado o sesión revocada **Cuando** solicita API protegida **Entonces** recibe `401 AUTH_UNAUTHORIZED`; rol no permitido, `403 FORBIDDEN`; ID de otro tenant, `404`, y listas sin datos ajenos. Se verifica sobre `Student` y `AuthSession`, incluidas mutaciones. Un cuerpo nunca selecciona tenant ni usuario para `/me`.

**RF-16 — HTTP y límites.** ENG-027; architecture §8.2–§8.3.

- **Dado** petición mutante **Cuando** `Origin` falta o no pertenece a la allowlist exacta del entorno **Entonces** responde `403 FORBIDDEN` sin efectos. CORS permite credenciales solo a esos orígenes; Helmet y límite JSON 1 MB están activos; exceso de cuerpo da `413 PAYLOAD_TOO_LARGE`.
- **Dado** cada contador de §4 **Cuando** supera su límite **Entonces** responde `429 RATE_LIMITED` y `Retry-After` entero positivo, sin ejecutar la operación. Respuestas autenticadas y de sesión llevan `Cache-Control: no-store`.

**RF-17 — Redirección y reanudación.** ENG-020/ENG-025; decisiones 58 y 81.

- **Dado** access ausente **Cuando** abre ruta privada **Entonces** llega a `/login?next=…`, intenta un refresh silencioso y, si funciona, vuelve al destino sin formulario. Si falla, muestra login sin bucle. `next` solo admite ruta interna del mismo origen; se descartan URLs externas y destinos públicos de auth. Token manipulado nunca concede acceso a API.

**RF-18 — Logout e higiene compartida.** ENG-020; CONTEXT §16.

- **Dado** una sesión **Cuando** cierra sesión **Entonces** revoca la familia y expira cookies con sus atributos originales. Cancela peticiones/reintentos y vacía TanStack Query e IndexedDB `pendingEvents`/`pendingUploads` antes de otra cuenta. Con access caducado intenta refresh; si recibe `401`, elimina cookies y completa limpieza sin exigir login. Logout sin sesión vigente devuelve `204`. Un fallo de red limpia datos locales pero no confirma cierre remoto ni reanuda sesión silenciosamente.

**RF-19 — Configuración al entrar.** ENG-021; SPEC-01 RF-14.

- **Dado** sesión válida **Cuando** carga flags **Entonces** obtiene exactamente el contrato de SPEC-01 §5 para su tenant, incluidos parámetros en `games.config` aunque esté desactivado. Configuración ausente/inválida devuelve `500 INTERNAL_ERROR`, sin activar módulos ni elegir otro tenant.

**RF-20 — Pantallas públicas y errores.** ENG-025/ENG-029; architecture §3.6.

- **Dado** cada pantalla de §7 **Cuando** valida, envía o recibe error/éxito **Entonces** muestra el estado/texto previsto, sin detalles técnicos, permite teclado y anuncia errores. Solicitudes en curso no se duplican; contraseñas/tokens no se conservan en caché del cliente.

**RF-21 — Mantenimiento de identidad.** ENG-020/ENG-024/ENG-028; decisiones 68 y 76, architecture §4.5.

- **Dado** reloj del servidor y dos ejecuciones nocturnas del mismo periodo **Cuando** se ejecuta mantenimiento **Entonces** limpia bloqueos vencidos, sesiones caducadas o revocadas hace más de 30 días y recuperaciones/solicitudes de correo caducadas, sin borrar sesiones vigentes. Registra y retoma `ScheduledJobRun` según architecture §4.5 sin duplicar efectos.

## 4. Reglas de negocio

- Normalizar correo: recorte exterior/minúsculas, sin blancos internos ni reglas de proveedor; máximo 254 caracteres. Contraseña sin transformación, longitud Unicode. Nombre recortado 1–100; contactos opcionales/null hasta 200. Límites del contrato.
- Nacimiento: fecha civil `YYYY-MM-DD`, real/no futura; edad por calendario America/Bogota. Alta: hasta 10 → Kids/sin alternancia; 11+ → Teens/con alternancia, sin añadir límites de admisión no decididos. Corregir nacimiento recalcula permiso y fuerza Kids si menor de 11. En aprobación, `ageSegment` solo se corrige por nacimiento rectificado, nunca como preferencia administrativa; elección posterior corresponde al alumno (decisión 49).
- Access 15 min; refresh/sesión 30 días profesora/90 alumno, persistencia implícita. Vencimiento absoluto al login, no prolongado al rotar. Cookies `${COOKIE_PREFIX}access_token` (Path `/`) y `${COOKIE_PREFIX}refresh_token` (Path `/api/v1/auth/refresh`), HttpOnly/Secure/SameSite=Lax; Domain omitido local (sesión probada sobre HTTPS), configurado fuera. Expirar con mismo nombre/Domain/Path. JWT: secretos por entorno, firma/algoritmo/expiración validados en API.
- Refresh `sid` + secreto aleatorio, hash vigente persistido y rotación serializada. Concurrencia: un ganador, segundo detectado como reutilización. Cliente coordina renovaciones sin reintento automático de rotación fallida. Claims de architecture §4.3; access no vence después de la sesión.
- Pedir recuperación no invalida enlaces anteriores: cada token conserva caducidad/uso único. Reset exitoso o cambio de correo invalida recuperaciones previas. Nueva solicitud de correo sustituye la anterior; confirmar opera solo sobre la vigente del usuario autenticado. `used_at`/tres fallos impiden uso; `expires_at <= now()` es caducado, sin columnas nuevas.
- Mutaciones atómicas. Aprobar nuevamente da `409 STUDENT_NOT_PENDING`, sin cambiar grupo/reenviar correo. Login: credenciales → bloqueo → aprobación (decisión 94); throttling HTTP 429 es independiente del bloqueo persistente.

| Contador | Límite / clave |
| --- | --- |
| Login | 10 / 15 min por IP, además de bloqueo persistente de cuenta |
| Signup | 10 / hora por IP |
| Forgot-password | 5 / hora por IP y, separadamente, por correo normalizado, exista o no |
| Solicitar cambio de correo | 5 / hora por usuario |
| API autenticada | 120 / min por usuario validado |
| API anónima | 30 / min por IP |

Límites específicos y generales se acumulan; la primera petición por encima del umbral se rechaza. Memoria solo en la instancia única de Render (decisión 64); reinicio pierde contadores HTTP, no bloqueo en PostgreSQL. Determinar IP confiable según el proxy de Render, sin aceptar `X-Forwarded-For` arbitrario. No se añade CAPTCHA ni servicio distribuido.

## 5. Contrato de API

Todas las rutas siguientes llevan `/api/v1`. JSON de entrada en camelCase; UUID válidos; `whitelist: true`, `transform: true`, sin rechazo de campos desconocidos. Contratos únicos en `packages/shared`, derivados de esta sección; `class-validator` valida HTTP, Zod de actividades no aplica aquí. No se crean esquemas ni endpoints pedagógicos.

`SessionView = { user: { id, name, email, role }, student: null | { id, ageSegment, canSwitchInterface } }`. Login/refresh devuelven esa forma, nunca tokens. `StudentView = { id, userId, name, email, birthDate, level, ageSegment, canSwitchInterface, approvalStatus, guardianName, guardianContact, groupId, lockedUntil }`; null donde corresponda. Listas: `{ items: StudentView[], total, offset, limit }`, offset entero ≥0, limit 1–100/default 20; orden `created_at DESC, id ASC`. Fechas de hechos ISO UTC; nacimiento permanece fecha civil. Solo endpoints de profesora exponen `StudentView`.

| Método/ruta | Acceso / entrada | Éxito | Errores propios |
| --- | --- | --- | --- |
| `POST /auth/login` | Público; `{ email, password }`, strings no vacíos | `200 SessionView` + cookies | `401 AUTH_INVALID_CREDENTIALS`, `403 ACCOUNT_PENDING_APPROVAL`, `423 AUTH_ACCOUNT_LOCKED` (orden RF-4) |
| `POST /auth/refresh` | Cookie refresh; sin body, no exige access vigente | `200 SessionView` + cookies | `401 AUTH_UNAUTHORIZED`; elimina cookies inválidas |
| `POST /auth/logout` | Sin body; revoca solo familia autenticada si existe; Origin obligatorio | `204` + expiración cookies, incluso sin sesión vigente | Errores comunes salvo 401 por ausencia/caducidad de sesión |
| `POST /auth/signup` | Público; `{ email, password, name, birthDate, guardianName?, guardianContact?, acceptTerms: true }` | `201 { message: "Recibimos tu solicitud. Revisa tu correo." }`, sin cookies | `400 PASSWORD_POLICY`/`VALIDATION_ERROR`; nunca `EMAIL_TAKEN` |
| `POST /auth/forgot-password` | Público; `{ email }` | `202 { message: "Si el correo tiene una cuenta, recibirás un enlace para restablecer tu contraseña." }` | `400 VALIDATION_ERROR` |
| `POST /auth/reset-password` | Público; `{ token, newPassword }` | `200 { message: "Contraseña actualizada. Inicia sesión." }` | `400 PASSWORD_POLICY`/`PASSWORD_RESET_INVALID` |
| `POST /me/email-change` | `student`; `{ newEmail, password }` | `202 { message: "Enviamos un código a tu nuevo correo." }` | `401 AUTH_INVALID_CREDENTIALS`, `409 EMAIL_TAKEN`; correo igual al actual: `400 VALIDATION_ERROR` |
| `POST /me/email-change/confirm` | `student`; `{ otp }`, string de seis dígitos | `200 { message: "Tu correo fue actualizado." }` | `400 OTP_INVALID`, `409 EMAIL_TAKEN` |
| `GET /students`, `GET /students/:id` | `teacher`; lista con offset/limit o ID | `200` lista / `StudentView` | `404 NOT_FOUND` en ficha |
| `PATCH /students/:id` | `teacher`; `{ name?, birthDate?, level?, ageSegment?, guardianName?, guardianContact? }`, al menos un campo permitido | `200 StudentView` | `400 VALIDATION_ERROR` ante transición inválida |
| `GET /students/requests`, `GET /students/locked` | `teacher`; offset/limit; rutas estáticas antes de `:id` | `200` lista filtrada | Errores comunes |
| `POST /students/:id/approve` | `teacher`; `{ level, groupId, birthDate?, ageSegment?, guardianName?, guardianContact? }` | `200 StudentView` | `404 NOT_FOUND`, `409 GROUP_ARCHIVED`/`STUDENT_NOT_PENDING` |
| `POST /students/:id/reject` | `teacher`; sin body | `204` | `409 STUDENT_NOT_PENDING` |
| `POST /students/:id/unlock` | `teacher`; sin body | `204` | Errores comunes |
| `POST /students/:id/reset-password` | `teacher`; sin body | `202 { message: "Solicitamos el envío del enlace al correo del alumno." }` | Errores comunes |
| `GET /feature-flags` | `teacher`/`student`; sin body | `200` contrato SPEC-01 §5 | `500 INTERNAL_ERROR` si configuración inválida |

Guard común: JWT → roles → tenant; públicos conservan validación/Origin/throttler. Refresh autentica secreto/usuario/tenant/estado; logout admite sesión ausente sin revocar un `sid` no autenticado. Listas vacías: `200`. `DELETE /students/:id` queda fuera: SPEC-05 / ENG-070, cascada completa de architecture §8.4 (decisión 93); sin `POST /students`, cambio administrativo ni `PATCH /me/interface`.

Errores comunes: `{ statusCode, code, message }`, sin detalles internos; `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `413 PAYLOAD_TOO_LARGE`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`. `Retry-After` expresa espera sin añadir campos al envelope. Códigos/estados concretados en este contrato y sincronizados con architecture §13; `NOT_FOUND`/`INTERNAL_ERROR` conservan SPEC-01.

Correos: MailService/plantillas de SPEC-01 §5, después del commit, clave opaca por envío lógico; `{ error }` del SDK es fallo. Transporte fallido no revierte mutaciones ni diferencia respuestas públicas; resultado sanitizado. Sin entrega durable, cola/outbox/reintentos generales. Nueva solicitud implica envío lógico y secreto nuevos, sujeto a límites. GET nunca confirma cambios.

## 6. Modelo de datos

Sin tablas, columnas, enums ni migraciones nuevas previstas: reutilizar [schema.prisma](../apps/api/prisma/schema.prisma) y architecture §6. Identidad usa `Organization`, `User`, `Student`, `AuthSession`, `PasswordResetToken`, `EmailChangeRequest`; aprobación usa `Group`/`GroupMembership`, configuración `FeatureFlag` y mantenimiento `ScheduledJobRun`.

Conservar UUID/tenant directo, únicos de correo/hash/membresía y tipos existentes. Organización Restrict, dependientes de User Cascade, grupo con historia Restrict; tiempos del servidor. Auditoría SetNull con redacción (decisión 92), sin cambios pedagógicos. Correcciones justificadas contra architecture mediante Prisma Migrate, nunca alterando la migración inicial.

## 7. Interfaz

| Ruta | Vacío / cargando / resultado |
| --- | --- |
| `/login` | Correo/contraseña, «Entrar», enlaces «Crear cuenta» y «Olvidé mi contraseña». Primero «Comprobando tu sesión…» si procede refresh; después formulario o destino por rol. |
| `/registro` | Campos RF-6; contactos opcionales; T&C sin premarcar y enlace al texto vigente. «Enviar solicitud» → «Enviando…» → mensaje uniforme de §5. No entra automáticamente. |
| `/recuperar-contrasena` | Correo; «Enviar enlace» → «Enviando…» → mensaje uniforme de §5; enlace a login. |
| `/restablecer/[token]` | Nueva contraseña y confirmación solo local; «Guardar contraseña» → «Guardando…» → éxito de §5. Inválido: «El enlace no es válido o ya venció. Solicita uno nuevo». |

Login no cuenta en los techos de navegación pedagógica. Desde login: un enlace a registro/recuperación; restablecer se abre desde correo. Tras entrar, `/inicio` presenta el contenedor vacío apropiado y «Cerrar sesión»; no crear dos páginas `/inicio` colisionantes en grupos de rutas. El mecanismo de composición no autoriza datos. Perfil y panel completos conservan su etapa; el cambio propio de correo se valida por API ahora.

Mapa único en español: credenciales → «El correo o la contraseña no son correctos»; pendiente → «Tu cuenta está pendiente de aprobación por tu profesora»; bloqueo → «Demasiados intentos. Intenta de nuevo en unos minutos»; política → «Usa entre 8 y 16 caracteres, sin espacios»; correo ocupado → «Ese correo no está disponible»; OTP → «El código no es válido o ya venció. Solicita uno nuevo»; límite → «Has hecho varios intentos. Espera un momento y vuelve a intentar»; 401 de sesión → «Tu sesión terminó. Inicia sesión de nuevo»; 403 → «No tienes acceso a esta sección»; conflicto de solicitud → «La solicitud ya no está pendiente. Actualiza la lista». Validación resalta campos sin devolver su contenido; demás errores usan SPEC-01 §7.

Formularios públicos neutrales porque aún no se conoce el segmento; ayuda memorable Kids sin requisitos extra. Etiquetas visibles, foco/teclado, autocompletado apropiado, permitir pegar contraseñas, error anunciado y controles táctiles ≥48 px. Componentes servidor por defecto, hojas cliente para interacción; TanStack Query con credenciales, sin reintentos automáticos de mutaciones sensibles ni caché persistente de identidad.

## 8. Seguridad y privacidad

- Tenant: AsyncLocalStorage y extensión Prisma más filtro explícito en servicio, también relaciones/transacciones. Sin contexto confiable no operar sobre tenant. Búsqueda pública de User por correo y comprobación global de unicidad son excepciones acotadas de decisión 59: no aceptar un tenant del cliente ni usar cliente sin filtro para el resto. Reset/refresh resuelven credencial opaca y validan el tenant de su propietario antes de mutar.
- Guard comprueba correspondencia sesión/usuario/tenant y aprobación actual, no solo claims. `/me` siempre usa identidad autenticada. Sin CRUD de organizaciones, membresías multi-organización ni permisos de roles reservados.
- Argon2id, secretos de tokens/OTP aleatorios y hashes; comparación segura. Respuestas públicas uniformes también ante fallos de correo; evitar diferencias de tiempo triviales entre correo inexistente y contraseña incorrecta mediante verificación de hash equivalente. Bloqueo/estado pendiente solo tras contraseña correcta (decisión 94).
- Cero nombres, contactos, fechas de nacimiento, correos, contraseñas, cookies, tokens, OTP, cuerpos ni URLs de restablecimiento en logs/Sentry. Local registra solo plantilla/resultado/ID (SPEC-01 RF-16, architecture §7.4). Página de reset sin recursos terceros ni filtración del token por Referer (`no-referrer`). Secretos y allowlist validados al arrancar.
- No se usa caché compartida ni directiva `use cache` en autenticado. Logout garantiza RF-18; no se implementa cola offline. T&C procede del documento aprobado, su versión de configuración de servidor, nunca del body; disponer de texto/enlace es compuerta previa (pbp Etapa 0). Envío real comparte con Resend solo dirección y contenido necesarios; no añade analítica.

## 9. Pruebas

ENG-026: matriz por implementar conforme al contrato aprobado; no son pruebas ejecutadas. PostgreSQL 18/dos tenants sintéticos, reloj controlado, MailService simulado; sin correos de prueba a destinatarios ajenos.

| RF | Nivel | Prueba trazable / casos mínimos |
| --- | --- | --- |
| RF-1 | Integración | `RF-1: login normaliza correo y emite sesión sin elegir tenant`; contraseña errónea/inexistente uniformes |
| RF-2 | Integración | `RF-2: pendiente no obtiene sesión ni supera guard`; rechazo previo y contraseña errónea |
| RF-3 | Integración | `RF-3: refresh rotativo y reutilización revocan access`; carrera, expiración absoluta, hash y sid |
| RF-4 | Integración | `RF-4: bloqueo no enumera y reinicia ciclo al vencer`; décimo 401, bloqueo activo 401/423, contador/plazo congelados, prioridad sobre pendiente, vencimiento exacto con/sin cron, primer fallo 1/acierto 0, concurrencia y profesora |
| RF-5 | Integración | `RF-5: lista y desbloquea solo alumnos bloqueados propios`; repetición, 403/404 |
| RF-6 | Integración | `RF-6: signup crea exactamente User y Student`; T&C servidor, contactos y cumpleaños 10/11 |
| RF-7 | Integración | `RF-7: duplicado global y carrera mantienen respuesta uniforme`; unicidad PostgreSQL, correo y fallo de transporte |
| RF-8 | Unitaria/integración | `RF-8: valida contraseña y fecha sin aceptar privilegios`; longitudes 7/8/16/17, blancos, Unicode, T&C falso y extras |
| RF-9 | Integración | `RF-9: edición de nombre y contactos mantiene invariantes`; lista/ficha, paginación, 403/404, correo ignorado |
| RF-10 | Integración | `RF-10: aprueba una membresía o rechaza sin huérfanos`; grupo ajeno/archivado, carreras y re-registro |
| RF-11 | Integración | `RF-11: recuperación uniforme y envío iniciado por profesora`; hash/32 bytes/30 min, mismo remitente, sin token para profesora |
| RF-12 | Integración | `RF-12: reset consume una vez y revoca todas las sesiones`; usado/caducado, carrera y otros enlaces invalidados |
| RF-13 | Integración | `RF-13: OTP va al correo nuevo tras contraseña actual`; seis dígitos/ceros, hash, reemplazo y EMAIL_TAKEN |
| RF-14 | Integración | `RF-14: confirma correo y revoca solo otras sesiones`; aviso anterior, 3 fallos concurrentes, caducidad, doble confirmación y carrera de email |
| RF-15 | Integración | `RF-15: guards y extensión aíslan Student y AuthSession`; JWT alterado/revocado, tenant/usuario discordantes, lectura y mutación |
| RF-16 | Integración HTTP | `RF-16: cada límite devuelve 429 y Retry-After`; umbral y ventana por cada clave, Origin ausente/ajeno, CORS, Helmet, 1 MB y no-store |
| RF-17 | Componente/integración | `RF-17: refresh silencioso vuelve a next interno`; sin bucles, next externo y token manipulado |
| RF-18 | Componente/integración | `RF-18: logout revoca y limpia datos`; Paths, stores, sesión ya caducada/revocada y fallo de red |
| RF-19 | Integración | `RF-19: flags y parámetros pertenecen al tenant validado`; fila/config inválida, games apagado |
| RF-20 | Componente | `RF-20: formularios accesibles muestran estados y mensajes`; tabulación, pegado, errores, confirmación local, sin persistir secretos |
| RF-21 | Integración | `RF-21: limpieza nocturna idempotente conserva sesiones vigentes`; 30 días, dos ejecuciones y recuperación de job fallido |

Staging: RF-1/RF-3/RF-11/RF-16/RF-17/RF-18/RF-20 con cookies reales entre subdominios, Paths/prefijos/secretos aislados; tablet Android/escritorio y correo a cuentas controladas. Registrar commit/CI y navegación. Sin E2E pedagógicos anticipados (SPEC-04/05/07); Cerrar Etapa 2 requiere SPEC-03 Aprobada, no iniciarla.

## 10. Fuera de alcance y decisiones diferidas

Se mantienen las exclusiones de §2: gestión visual/grupos/cambio administrativo en SPEC-03; perfil/alternancia/cascada en SPEC-05. Decisión 93 excluye DELETE parcial y adelanto de multimedia.

Excluidos: cambio de contraseña desde perfil (architecture §15), alta directa/contraseña temporal, registro de profesora, roles reservados, identidad multi-organización (Fase 2), verificación adicional de correo, MFA, consentimiento legal/entidades de acudiente y CONTEXT §2.4. Sin analítica, visor de auditoría, webhooks de correo, marketing, outbox ni nuevos proveedores.

## 11. Preguntas abiertas

**Ninguna pregunta funcional abierta.** Sin P-n pendientes para el piloto (CONTEXT §15). El líder confirmó ambas propuestas el 2026-10-20:

| Pregunta cerrada | Decisión tomada | Aplicación |
| --- | --- | --- |
| Q-01 — API de alumnos | **Decidida, CONTEXT §14 n.º 93:** Etapa 2 elimina solo pendientes mediante `reject`; baja general completa en SPEC-05 / ENG-070 | RF-9/RF-10, §2/§5/§10; PBP/taskboard precisados |
| Q-02 — Bloqueo sin enumeración | **Decidida, CONTEXT §14 n.º 94:** credenciales inválidas 401; correctas bloqueadas 423; décimo fallo 401; ciclo nuevo al vencer | RF-1/RF-2/RF-4, §4/§8/§9; architecture §7.1 alineada |

**Contrato Aprobado ≠ compuertas operativas acreditadas.** Sin comprobación externa ni cierre de ENG:

| Prerrequisito / evidencia pendiente | Responsable | Momento exigible |
| --- | --- | --- |
| T&C aprobados: faltan texto/enlace/versión autoritativa. El `v1.0` sintético del seed no los sustituye | Líder/clienta | **Antes de iniciar Etapa 2**, PBP Etapa 0 |
| ENG-001/003/004 Por hacer: repositorio, dominio/subdominios controlados, proyectos/secretos aislados. Acreditar web/API y migración del mismo commit en staging y CI; ENG-015 Hecho no sustituye evidencia operativa | Líder/equipo técnico | Dependencias previas de Etapa 1; ENG-003 antes de ENG-020; decisión 65 |
| Acreditar dominio/remitente Resend verificado, SPF/DKIM y entrega controlada; ENG-019 Hecho no certifica disponibilidad externa | Equipo técnico | Dependencia de Etapa 1; prueba real antes de validar recuperación/OTP en staging |
| Preparar HTTPS local para cookies Secure; README documenta HTTP | Equipo técnico | Preparación ENG-020/ENG-025, antes de validar sesión local |

SPEC-03 Aprobada es criterio de salida, no de inicio. Los insumos/evidencias anteriores siguen siendo obligatorios.

## 12. Registro de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-10-20 | Creación del borrador: 21 RF, contrato API, límites, modelo existente, pantallas públicas, seguridad y matriz de pruebas | Redacción de SPEC-02; cobertura de ENG-020, ENG-021 y ENG-023 a ENG-029 sin implementación ni ampliación de etapas |
| 2026-10-20 | Borrador con Q-01/Q-02 bloqueantes y dependencias operativas | Respetar jerarquía hasta decisión del líder |
| 2026-10-20 | Revisión semántica del borrador: logout caducado, segmento acotado y recuperación sin invalidación por terceros | Precisar casos límite sin adelantar implementación |
| 2026-10-20 | Q-01/Q-02 Decididas por el líder (CONTEXT 93–94); integradas en RF, API y pruebas; fuentes superiores sincronizadas | Aceptación explícita de ambas propuestas |
| 2026-10-20 | Borrador → En revisión → Aprobada por el líder; prerrequisitos operativos en §11 | Contrato listo, sin implementar ni certificar dependencias externas |
| 2026-10-21 | Estado Aprobada → Implementada: implementación completa de ENG-020, ENG-021, ENG-023 a ENG-029 con conexión de PrismaService a la extensión de tenant, pruebas frontend (RF-17, RF-18, RF-20) y 108/108 tests unitarios/integración en monorepo (69 en API, 26 en web) | Ejecución de la implementación de SPEC-02 |
| 2026-10-21 | Estado Implementada → Verificada y sincronización del índice y seguimiento | Solicitud explícita del líder del proyecto; se confirma el estado verificado de SPEC-02 tras verificación completa |
