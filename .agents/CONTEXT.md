# Englove — Contexto raíz del proyecto

> **Propósito de este documento.** Fuente única de verdad sobre visión, alcance, arquitectura y decisiones de Englove. Está pensado para que cualquier agente o persona que entre al proyecto pueda trabajar sin releer conversaciones anteriores.
>
> Cada punto lleva un estado:
> - **Decidido**: vinculante. No se cambia sin registrar una nueva decisión en §14.
> - **Propuesto**: recomendación vigente a falta de decisión. Se puede implementar, pero debe quedar marcado como tal.
> - **Pendiente**: requiere decisión humana antes de implementarse.
>
> Última actualización: 2026-09-22, tras aplicar `planning/incongruencias-y-decisiones-definitivas.md` (Ronda 3, decisión 34): eliminación de `Guardian` y de todo consentimiento legal, Cloudflare R2, transcodificación de audios, timestamps en servidor, algoritmo de rachas, rate limiting, `age_segment` y demás decisiones de esa sesión.

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

- 1 profesora, hasta 100 estudiantes de 7 a 14 años.
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

| Elemento | Sustituto en el piloto |
|---|---|
| WebSockets / tiempo real | Polling cada 30 segundos en el panel de la profesora |
| Heartbeat y detección de inactividad de pestaña | Registro de inicio y fin de cada actividad |
| Pantallas de `parent` y `admin` | Enum de roles completo, sin pantallas |
| Capacitor / tiendas de aplicaciones | PWA instalable |
| Muro social / sección de padres | Nada |
| Motor Phaser | Microjuegos en React puro |
| Educaplay embebido (iframe) | Enlaces externos en "Contenido extra", fuera de calificación |
| Pasarela de pagos | Nada. Entidades `Organization` / `Subscription` reservadas, no construidas |
| Cualquier gestión de consentimiento legal de menores | Nada. Es responsabilidad de la clienta fuera de la plataforma (§9) |

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

- **La autenticación es responsabilidad de NestJS.** No se usa Supabase Auth.
- JWT de acceso de vida corta + **refresh tokens rotativos** almacenados en cookie `httpOnly`, `Secure`, `SameSite`. Nunca en `localStorage`.
- Persistencia prolongada ("Recuérdame") para evitar fricción de login en niños.
- **El alumno es un usuario independiente** con sus propias credenciales. No existe cuenta hija ni vínculo con una cuenta de acudiente (decisión 34 §1).
- **Acceso del alumno (Decidido 2026-09-21): correo y contraseña, con recuperación de contraseña por correo.** Se adopta por convención: es el mecanismo que alumnos, acudientes y profesora ya conocen. El correo puede pertenecer al alumno o ser uno que gestione el acudiente; debe ser único dentro de la organización. Queda descartado el acceso por código de aula + PIN o avatar.
- **Contraseña (Decidido 2026-09-22, decisión 34 §1):** la crea siempre el propio alumno. Requisitos: mínimo 8 caracteres, máximo 16, sin espacios. Sin otros requisitos de complejidad.
- **La profesora no da contraseñas temporales ni crea cuentas.** La única vía de alta es el auto-registro (§4.1). Ante bloqueo o pérdida, la profesora puede **iniciar una recuperación de contraseña** desde el panel: el sistema envía el enlace de un solo uso al correo registrado del alumno.
- **Cambio de correo desde el perfil del alumno (Decidido 2026-09-22):** verificación en dos pasos con un OTP enviado al correo (actual o nuevo) para confirmar que quien hace el cambio es el alumno. Cubre el caso en que se registró con el correo del acudiente y luego quiere usar el suyo.
- **Bloqueo por intentos fallidos (Decidido 2026-09-21):** tras **10 intentos fallidos** consecutivos, la cuenta queda bloqueada **10 minutos**. Aplica a alumnos y a la profesora. El bloqueo de alumnos es visible para la profesora en una sección dedicada del panel (`Alumnos → Bloqueados`), desde donde puede levantarlo de forma ágil.
- **Correo transaccional (Decidido 2026-09-21, ampliado 2026-09-22):** un único proveedor y remitente (§6) envía todos los correos de la plataforma: confirmación de solicitud recibida en el auto-registro, aviso de cuenta aprobada, **recuperación de contraseña** (enlace de un solo uso con caducidad corta), OTP de cambio de correo, **notificación de actividad calificada** al alumno (sin nota ni feedback, §5.1) y **resumen de pendientes** a la profesora cada 3 días (§5.1).
- **Rate limiting (Decidido 2026-09-22, decisión 34 §20):** límites por endpoint sensible y globales, detallados en architecture §8.3. Toda entrada se valida con `class-validator` y Zod.

### 4.1 Registro autónomo del estudiante y aprobación — Decidido 2026-09-21 (decisión 33)

El alumno crea su propia cuenta; la profesora la aprueba antes de que sirva para algo. Es la **única vía de alta** en el piloto (decisión 34 §1): la profesora no crea cuentas ni entrega contraseñas.

- **Formulario de auto-registro** (pantalla pública `/registro`): correo, contraseña (8–16 caracteres, sin espacios), nombre del alumno, fecha de nacimiento (deriva `age_segment`), datos de contacto del acudiente (`guardian_name` y `guardian_contact`, campos del propio `Student`) y checkbox de aceptación de los **Términos y Condiciones** convencionales de uso, con enlace al documento.
- Al enviarlo se crean solo `User` (rol `student`, correo y contraseña ya fijados por el alumno) y `Student` (con los datos del acudiente como campos propios), en la única organización del piloto. No se crea ninguna entidad separada. El `Student` queda en estado **`pending_approval`**: no tiene nivel MCER ni grupo asignado.
- **Mientras está `pending_approval`, el login se rechaza** con un mensaje propio (`ACCOUNT_PENDING_APPROVAL`), aunque la contraseña sea correcta. El alumno no entra a nada hasta ser aprobado.
- La solicitud aparece en el panel de la profesora (§5.1) como una **solicitud de registro** pendiente. Al revisarla, la profesora:
  1. Confirma o corrige `guardian_name` y `guardian_contact` directamente en el `Student`.
  2. Asigna nivel MCER y grupo. `age_segment` ya viene calculado desde la fecha de nacimiento; solo lo corrige si la fecha es errónea.
  3. Aprueba la cuenta (`approval_status = approved`) o la rechaza (la cuenta y sus datos se borran, mismo mecanismo que el borrado en cascada de §10).
- Al aprobar, el alumno recibe un correo de "cuenta aprobada" y puede iniciar sesión.
- La aceptación de T&C es el único acuerdo que existe en la plataforma. No hay consentimiento parental ni registro de autorización de ningún tipo (§9).
- Los Guards de NestJS aplican RBAC y aislamiento por `organization_id` en cada petición.

---

## 5. Alcance funcional del piloto

### 5.1 Panel de la profesora (se construye primero)

**Gestor de contenidos**

- Crear actividades por nivel (A1–B2) y por tipo. **El piloto incluye los cinco tipos desde su primera versión operativa** (Decidido 2026-09-22, decisión 34 §6), con calificación mixta automática y manual:
  - **Fill in the blanks:** oraciones con dropdowns en línea. Calificación automática inmediata.
  - **Pregunta abierta:** texto libre. Va a la cola de revisión (calificación manual).
  - **Speaking:** grabación con `MediaRecorder` en el navegador, se sube a Cloudflare R2 y se transcodifica en servidor para reproducción universal (architecture §3.5). Va a la cola de revisión. Duración mínima 2 s; máxima configurable por actividad, 120 s por defecto y 300 s como tope absoluto (decisión 34 §13).
  - **Microjuego:** configuración JSON rellenada mediante formulario (ver §5.3). Calificación automática.
  - **Examen:** conjunto de ítems con pesos. Mínimo 2 ítems para publicarse; los pesos se normalizan automáticamente al 100 % al guardar; un ítem no respondido vale 0 y su peso entra en el denominador (decisión 34 §11 y §12).
- Objetivo de onboarding: la profesora crea su primera actividad en menos de 10 minutos. Si no se cumple, el piloto fracasa por falta de contenido antes que por bugs.

**Asignación**

- Asignar una actividad a uno o varios grupos con fecha de apertura y fecha de cierre.
- **Regla de `due_at` (Decidido 2026-09-22, decisión 34 §10):** lo que determina si un intento es válido es su momento de inicio, tomado en el servidor. Un intento iniciado antes del cierre puede terminarse después y se guarda normalmente. Un intento que se quiera iniciar después del cierre se rechaza con un aviso al alumno para que hable con su maestra.

**Cola de revisión y feedback**

- Lista de audios y respuestas abiertas pendientes de calificar.
- Calificación + **comentario personal de retroalimentación por cada intento calificado** + stickers.
- La profesora puede **descargar el audio** de speaking a su dispositivo antes de que venza la retención (decisión 34 §6).
- **Notificación por correo (Decidido 2026-09-22, decisión 34 §5):** al calificar, el alumno recibe un correo que le avisa que su actividad ya fue calificada, con un enlace a la sección de feedback de la app. **El correo no incluye la nota ni el feedback**; ambos se ven únicamente dentro de la aplicación.
- **Habilitar nuevo intento (Decidido 2026-09-21):** en el área de calificación y feedback, la profesora dispone de un campo para autorizar a ese estudiante un intento adicional sobre esa asignación. Si no lo hace, el estudiante tiene **un solo intento** por asignación. Aplica a todo tipo de actividad calificable, incluidas las autocalificadas (fichas, exámenes y microjuegos), cuyos intentos también aparecen en esta área aunque no requieran revisión manual.
- El alumno recibe el comentario en la vista de esa actividad. El ciclo grabar → calificar → recibir feedback es el corazón pedagógico del producto.

**Escala de calificación — Decidido 2026-09-21**

- Toda calificación (fichas, exámenes, microjuegos, actividades asignadas y revisiones manuales) se expresa en la **escala colombiana de 0,0 a 5,0**, con un decimal.
- El puntaje automático se calcula en servidor y se normaliza a esa escala; la calificación manual se introduce directamente en ella.
- Umbral de aprobación 3,0, configurable por organización (Decidido). Las estrellas y el progreso del alumno se derivan de esta escala.

**Estudiantes y grupos**

- **Solicitudes de registro (Decidido 2026-09-21):** bandeja con los auto-registros en `pending_approval`. Aprobar asigna nivel y grupo (y corrige `guardian_name`, `guardian_contact` o `age_segment` si hace falta) y activa la cuenta; rechazar borra la solicitud. Es la única vía de alta.
- Edición de alumnos: nivel, segmento, datos del acudiente (`guardian_name`, `guardian_contact`, solo la profesora). Iniciar recuperación de contraseña del alumno (envía el enlace a su correo; no hay contraseñas temporales).
- **Sección de bloqueados (Decidido 2026-09-22, decisión 34 §8):** pestaña dedicada dentro de `Alumnos` con el listado de cuentas bloqueadas por intentos fallidos y desbloqueo manual en un clic.
- Grupos y membresías.

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
- **Perfil del alumno:** cambio de correo con OTP (§4) y, si tiene 11 años o más, alternar entre las interfaces Kids y Teens (§3).
- **Tolerancia a conexión débil:** las respuestas se guardan localmente y se reintenta el envío; una grabación de audio no se pierde si falla la subida.
- **Estados de error (Decidido 2026-09-22, decisión 34 §17):** toda situación indeseada (red, servidor, acceso no autorizado, recurso no encontrado, actividad cerrada, intento ya existente, fallo de subida de audio) tiene un mensaje claro y contextual, sin detalles técnicos. En Kids los mensajes son más visuales y simpáticos; en Teens y en el panel, más directos.
- **Actualizaciones de la PWA (Decidido 2026-09-22, decisión 34 §4):** cuando hay una nueva versión, la app muestra una notificación in-app no bloqueante con un botón para reiniciar y aplicar los cambios. Aplica también al panel de la profesora.
- **Accesibilidad:** texto a voz en las consignas del tema Kids, contraste verificado, objetivos táctiles grandes.
- Sin analítica de terceros, píxeles ni publicidad. Solo eventos propios.

### 5.3 Microjuegos — Decidido

- Implementados en **React puro** (con dnd-kit y CSS), no en Canvas, durante el piloto.
- Mecánicas iniciales: emparejar, ordenar palabras, arrastrar y soltar, memoria de tarjetas, elección múltiple con temporizador.
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

- Next.js 14+ / React 19, TypeScript, enfoque mobile-first.
- Tailwind CSS + shadcn/ui (Radix UI) para el panel y los formularios.
- **Framer Motion sin restricción de uso.** El público objetivo no tiene limitaciones de rendimiento en sus dispositivos. Los bundles de animación de Kids y Teens se cargan de forma diferida por separado, para que cada audiencia descargue solo lo suyo.
- Howler.js (efectos de sonido) y canvas-confetti (celebraciones).
- PWA con manifest e instalación. Capacitor queda preparado para Fase 2.

**Backend**

- NestJS (TypeScript), **módulos planos** sin capas abstractas innecesarias para 15–20 endpoints.
- Prisma ORM. Migraciones con Prisma Migrate ejecutadas en CI. Nunca `db push` contra producción.
- JWT + Guards RBAC. DTOs con `class-validator` en todos los endpoints.
- Swagger / OpenAPI generado automáticamente, sin decorar campo por campo.
- Sin WebSockets en el piloto.

**Datos e infraestructura**

- PostgreSQL 16 en Supabase Cloud. **Supabase se usa exclusivamente como Postgres**: sin Supabase Auth, sin Realtime, sin RLS como fuente de autorización, sin Supabase Storage.
- **Almacenamiento de archivos: Cloudflare R2 (Decidido 2026-09-22, decisión 34 §21).** API compatible con S3 (`@aws-sdk/client-s3`), bucket privado por entorno, URLs firmadas de corta duración generadas por el backend. Sustituye a Supabase Storage por los límites de su capa gratuita. Variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
- **Hosting (Decidido 2026-09-21): frontend en Vercel, backend en Render.** Ambos con dominio propio bajo la misma raíz (`app.` y `api.`), despliegue desde Git y entornos staging y producción. La imagen Docker de la API incluye `ffmpeg` para la transcodificación de audios (architecture §3.5).
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

Esquema orientativo. Cuando exista, el archivo `schema.prisma` es la referencia autoritativa y este apartado debe mantenerse alineado con él.

- `Organization` — tenant. Una sola en el piloto.
- `User` — `email` (obligatorio, único por organización), `password_hash`, `role` (enum), `organization_id`, `terms_accepted_at` y `terms_version`, contador y marca de bloqueo por intentos fallidos.
- `PasswordResetToken` — token de un solo uso para recuperación de contraseña.
- `EmailChangeRequest` — OTP de un solo uso para el cambio de correo del alumno (`user_id`, `new_email`, `otp_hash`, `expires_at`, `used_at`).
- `Student` — `user_id`, `name`, `birth_date`, `guardian_name` (nullable), `guardian_contact` (nullable), `level` (A1–B2, nullable hasta la aprobación), `age_segment` (`kids` / `teens`), `can_switch_interface` (boolean), **`approval_status`** (`pending_approval` / `approved` / `rejected`). El correo de acceso vive en `User.email`. No hay entidad de acudiente ni campo de consentimiento.
- `Group`, `GroupMembership`.
- `Activity` — `type`, `level`, `title`, `created_by`, `version`, `status`.
- Detalle 1:1 por tipo: `FillBlankDetail`, `OpenQuestionDetail`, `SpeakingDetail` (`min_duration_seconds`, `max_duration_seconds`), `GameDetail`, `ExamDetail` (pesos normalizados).
- `Assignment` — `activity_id`, `group_id`, `opens_at`, `due_at`, `historical_student_count` (denominador congelado al borrar alumnos, decisión 34 §14).
- `Attempt` — `assignment_id`, `student_id`, `started_at`, `finished_at` (ambos asignados por el servidor, decisión 34 §3), `status`, `score` (0,0–5,0), `payload` (respuestas crudas en JSON), `flags`, `retry_granted_at`, `retry_granted_by`, `previous_attempt_id`.
- `Review` — `attempt_id`, `reviewer_id`, `score` (0,0–5,0), `comment`, `stickers`, `graded_at` (servidor).
- `ProgressEvent` — append-only: `student_id`, `type`, `value`, `occurred_at` (servidor), `source`.
- `BadgeRule` (configurable), `BadgeAward`.
- `MediaAsset` — clave del archivo raw en R2, `converted_key` (MP4/AAC, nullable), propietario, `mime_type`, `duration_seconds`, `status`, `retention_until`.
- `ExternalResource` — enlaces de "Contenido extra".
- `FeatureFlag` — por organización.

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
- URLs firmadas de expiración corta, emitidas por el backend tras verificar que el solicitante tiene derecho a ese recurso.
- Puntaje y calificación en servidor; validación de rangos y duraciones plausibles.
- **Reloj del servidor como única fuente temporal (Decidido 2026-09-22, decisión 34 §3):** `started_at`, `finished_at`, `graded_at`, `occurred_at` y toda marca de tiempo de tenant se asignan en NestJS o en PostgreSQL al procesar la petición. El cliente nunca los envía; si los envía, se ignoran. Elimina el fraude por manipulación del reloj del dispositivo.
- DTOs validados en todos los endpoints (`class-validator` + Zod); RBAC en Guards; `organization_id` en toda consulta.
- **Rate limiting (Decidido 2026-09-22, decisión 34 §20):** login 10 intentos / 15 min por IP; signup 10 / hora por IP; forgot-password 5 / hora por IP y por correo; API autenticada 120 peticiones / min por usuario; API no autenticada 30 / min por IP.
- Borrado en cascada (alumno → intentos, audios en R2, eventos) con prueba automatizada escrita antes de la función, congelando antes el denominador histórico de sus asignaciones (§7.2).
- Secretos solo en variables de entorno. Nunca en el repositorio.

---

## 11. Calidad, operación y metodología de desarrollo — Decidido

### 11.1 Metodología: Spec-Driven Development (SDD) — Decidido 2026-09-21

- Englove se construye con **desarrollo guiado por especificaciones**: cada capacidad tiene una spec escrita, revisada y aprobada antes de escribir código. El código implementa la spec y las pruebas verifican sus criterios de aceptación.
- Las specs viven en `specs/`, una por etapa de construcción (`SPEC-01` a `SPEC-10`), se redactan una etapa por delante de la implementación y siguen la plantilla y el ciclo de vida definidos en [`planning/sdd-process.md`](../planning/sdd-process.md).
- Jerarquía: `CONTEXT.md` → `architecture-overview.md` → `sdd-process.md` → `pbp-development.md` → `taskboard.md` → `specs/` → código. Una spec nunca contradice un documento superior; si necesita hacerlo, primero se cambia la decisión en §14.
- Ninguna tarea del taskboard pasa a "En curso" sin su spec Aprobada. La Definición de Hecho de `pbp-development.md` §3 lo exige.
- **La redacción de las specs aún no ha empezado.** Arranca con la Etapa 0 según el calendario de `sdd-process.md` §7.

### 11.2 Calidad y operación

- Pruebas end-to-end de los tres flujos que sostienen el piloto:
  1. La profesora crea y asigna una actividad.
  2. El alumno la completa.
  3. La profesora califica y el alumno ve el feedback.
- Captura de errores de frontend con rol y versión, con alertas al equipo. Los niños no reportan bugs; simplemente dejan de entrar.
- Logging estructurado en backend.
- Verificar el plan de backups de Supabase y ensayar una restauración al menos una vez.
- Medir rendimiento en al menos una tablet Android real de gama media o baja como control de higiene. Esto no restringe el uso de Framer Motion.
- Feature flags por organización para activar módulos. Es la forma más barata de tener piloto y futuro SaaS en el mismo código.

---

## 12. Orden de construcción — Decidido

1. Scaffold del monorepo, paquete compartido, `schema.prisma` núcleo, CI con migraciones.
2. Autenticación con correo y contraseña (profesora y alumno), recuperación de contraseña, cambio de correo con OTP, roles, rate limiting, **auto-registro del estudiante en `pending_approval`**, `Organization`, `Student`.
3. **Gestor de contenidos de la profesora:** tipos de actividad, niveles, grupos, **bandeja de solicitudes de registro**, alumnos (con datos del acudiente), sección de bloqueados, recordatorios del dashboard.
4. Asignación a grupos.
5. Portal del estudiante: acceso, Classroom (fill in the blanks, pregunta abierta, speaking con transcodificación), progreso personal, perfil, job mensual de `age_segment`.
6. Microjuegos en React tras el contrato de actividad.
7. Cola de revisión y feedback personal, correo de notificación de calificación, descarga de audios, habilitación de nuevo intento, retención de audios.
8. Panel estadístico (polling) de rendimiento y constancia por estudiante, leaderboard privado, correo de pendientes a la profesora.
9. PWA con notificación de actualizaciones, tolerancia offline, pase de accesibilidad.
10. Sección "Contenido extra".
11. Lanzamiento del piloto. Condiciones previas: contenido cargado por la profesora, estadísticas de rendimiento y constancia operativas, manual de uso de la profesora entregado.

Cada etapa comienza con la redacción y aprobación de su spec (§11.1).

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

| # | Decisión | Estado |
|---|---|---|
| 1 | Supabase solo como Postgres + Storage; NestJS único backend de negocio | Decidido. Modificada por la decisión 34 §21: Supabase solo como Postgres; los archivos van a Cloudflare R2 |
| 2 | Pasarela de pagos y suscripciones en Fase 2/3; precios fuera de plataforma en piloto | Decidido |
| 3 | Jurisdicción Colombia (Ley 1581/2012); T&C en registro del acudiente | Sustituida por la decisión 34 §2: el cumplimiento legal queda fuera de la plataforma; solo T&C convencional aceptado por el alumno |
| 4 | Cuenta hija vinculada a acudiente. (Modificada por la decisión 22: el correo de acceso vive en `User.email` y es obligatorio) | Sustituida por la decisión 34 §1: no existe `Guardian`; el alumno es un usuario independiente |
| 5 | Actividades: tabla base + tablas de detalle por tipo (juegos, exámenes, fichas) | Decidido |
| 6 | Insignias por hitos simples y permanencia (4/8/12 semanas, 5 años); rachas semanales | Decidido |
| 7 | Feedback personal por intento calificado | Decidido |
| 8 | La profesora carga contenido antes de que entre el primer alumno | Decidido |
| 9 | Polling cada 30 s; sin WebSockets en piloto | Decidido |
| 10 | Registro de inicio/fin de actividad; sin heartbeat | Decidido |
| 11 | Enum de roles completo; solo pantallas `teacher` y `student` | Decidido |
| 12 | PWA instalable; Capacitor a Fase 2 | Decidido |
| 13 | Módulos NestJS planos; Swagger automático | Decidido |
| 14 | Muro social y sección de padres fuera del piloto | Decidido |
| 15 | Dos temas visuales (Kids / Teens) sobre tokens compartidos | Decidido |
| 16 | Framer Motion sin restricción; carga diferida por tema | Decidido |
| 17 | Microjuegos React en piloto; Phaser en Fase 2; Educaplay como enlaces en "Contenido extra" | Decidido |
| 18 | Consentimiento en papel en piloto; firma digital al escalar a academia | Retirada por la decisión 34 §2 |
| 19 | Métrica numérica de éxito del piloto | Retirada por la decisión 28 |

### Ronda 2 — 2026-09-21

| # | Decisión | Estado |
|---|---|---|
| 20 | Se aceptan en su totalidad las 15 propuestas de arquitectura A1–A15 de `architecture-overview.md` §14 (monorepo, datos y estado, validación en dos niveles, guards y tenant, scoring, tareas programadas, convenciones, enums, endurecimiento HTTP, cookies y CORS, motor de insignias, rachas perdonables, PWA, accesibilidad, entornos, pipeline, convenciones de código y API) | Decidido |
| 21 | Metodología de desarrollo: Spec-Driven Development según `planning/sdd-process.md`. La redacción de specs empieza con la Etapa 0 | Decidido |
| 22 | Acceso del alumno con correo y contraseña, con recuperación de contraseña. Se descarta código de aula + PIN / avatar. `User.email` obligatorio y único por organización | Decidido |
| 23 | Bloqueo de 10 minutos tras 10 intentos fallidos de inicio de sesión (sustituye a 5 intentos / 10 min). Misma regla para alumnos y profesora | Decidido |
| 24 | Escala de calificación colombiana 0,0–5,0 para toda actividad: fichas, exámenes, microjuegos y revisión manual. Umbral de aprobación 3,0 configurable | Decidido |
| 25 | Un solo intento por asignación. La profesora puede habilitar un intento adicional a un estudiante desde el área de calificación y feedback. Sustituye a `Assignment.max_attempts` | Decidido |
| 26 | Hosting: frontend en Vercel, backend en Render, dominio propio `app.` / `api.` | Decidido |
| 27 | Retención de audios: borrar tras un plazo módico los audios calificados y los que nunca confirmaron subida. Plazos 30 días / 7 días, configurables | Decidido |
| 28 | La métrica numérica global de éxito deja de ser requisito. El panel estadístico se centra en rendimiento y constancia por estudiante | Decidido |
| 29 | Navegación del portal del alumno: entre 2 y 4 clics según la zona; actividades asignadas a 2 clics | Decidido |
| 30 | Correo transaccional con Resend. El mismo proveedor y remitente envía el correo de registro (bienvenida y fijar contraseña) y el de recuperación de contraseña | Decidido |
| 31 | Se rechaza intercambiar las Etapas 6 y 7. El orden de construcción de §12 se mantiene: microjuegos antes que calificación y feedback | Decidido |
| 32 | Se aceptan los detalles A16–A23 de `architecture-overview.md` §14.2 (conversión a 0,0–5,0 y tramos de estrellas, recuperación de contraseña, bloqueo, nuevo intento, retención, Resend, techos de clics, Render siempre activo) | Decidido |
| 33 | El registro autónomo del estudiante entra al piloto (antes reservado para Fase 2 y solo para el acudiente). El alumno crea su cuenta con correo y contraseña; queda `pending_approval` hasta que la profesora la revisa, asigna nivel y grupo y la aprueba | Decidido. Modificada por la decisión 34: desaparecen la gestión del consentimiento en papel y el alta directa por la profesora; el auto-registro es la única vía de alta |

### Ronda 3 — 2026-09-22

| # | Decisión | Estado |
|---|---|---|
| 34 | Se aplica en su totalidad `planning/incongruencias-y-decisiones-definitivas.md` (§1–§22) a `CONTEXT.md`, `architecture-overview.md`, `pbp-development.md` y `taskboard.md`. Ese documento es vinculante; sus decisiones no se contradicen sin una nueva fila en esta tabla. Las filas 35–56 resumen cada sección | Decidido |
| 35 | §1: se elimina el rol y la entidad `Guardian`. `Student.guardian_name` y `Student.guardian_contact` (opcionales, editables solo por la profesora). El alumno crea su contraseña (8–16 caracteres, sin espacios); cambio de correo con OTP; la profesora no da contraseñas temporales ni crea cuentas: el auto-registro es la única vía de alta | Decidido |
| 36 | §2: se elimina todo lo relativo a consentimiento legal de menores (`ConsentRecord`, `ConsentStatus`, `ConsentMethod`, documentos legales, Ley 1581). Responsabilidad de la clienta. Solo T&C convencional aceptado por el alumno | Decidido |
| 37 | §3: `started_at`, `finished_at`, `graded_at` y toda marca de tiempo se asignan en el servidor. Ningún DTO de entrada lleva timestamps | Decidido |
| 38 | §4: notificación in-app de nueva versión de la PWA con botón de reinicio, en ambas interfaces | Decidido |
| 39 | §5: al calificar se envía correo de notificación al alumno sin nota ni feedback; ambos se ven solo en la app | Decidido |
| 40 | §6: el piloto incluye los cinco tipos de ítem desde la primera versión. Audios en R2 30 días tras calificar, 7 días para `pending_upload`; la profesora puede descargar el audio | Decidido |
| 41 | §7: acceso al panel estadístico y leaderboard solo por RBAC (`teacher`). Se eliminan los flags `stats` y `leaderboard` | Decidido |
| 42 | §8: sección de alumnos bloqueados en `Alumnos` y tarjetas de recordatorio en el dashboard (solicitudes pendientes, sin calificar > N días, N = 3 configurable) | Decidido |
| 43 | §9: algoritmo de rachas de 4 reglas (solo semanas activas cuentan; perdón solo con racha activa; se recupera tras 2 semanas activas consecutivas; máximo 1 perdón) | Decidido |
| 44 | §10: la validez de un intento la decide `started_at` del servidor frente a `due_at`. Iniciado antes y terminado después: válido. Iniciar después del cierre: rechazado con aviso al alumno | Decidido |
| 45 | §11: ítem no respondido = 0 con su peso en el denominador; un examen requiere mínimo 2 ítems, validado en `POST /activities/:id/publish` | Decidido |
| 46 | §12: los pesos de un examen se normalizan proporcionalmente al 100 % al guardar y el formulario muestra el valor ajustado | Decidido |
| 47 | §13: audios de speaking: mínimo 2 s (fijo), máximo 120 s por defecto, tope absoluto 300 s, configurable por actividad | Decidido |
| 48 | §14: al borrar un alumno se congela el denominador histórico de sus asignaciones (`Assignment.historical_student_count`) | Decidido |
| 49 | §15: Kids 7–10 sin cambio de interfaz; 11+ puede alternar Kids/Teens; job mensual activa `can_switch_interface`; `age_segment` inicial derivado de `birth_date` | Decidido |
| 50 | §16: seeds operativos (`seed-dev.ts`) y de volumen (`seed-volume.ts`) además del seed mínimo | Decidido |
| 51 | §17: estados de error claros y contextuales en toda la interfaz, sin detalles técnicos; `ErrorBoundary` global | Decidido |
| 52 | §18: correo de pendientes a la profesora cada 3 días, solo si hay pendientes | Decidido |
| 53 | §19: manual de uso de la profesora en español y tono casual (tarea DOC-06) | Decidido |
| 54 | §20: política de rate limiting por endpoint y global (architecture §8.3) | Decidido |
| 55 | §21: Cloudflare R2 sustituye a Supabase Storage para archivos; Supabase sigue siendo el único motor SQL | Decidido |
| 56 | §22: detección de codec en el cliente (`getSupportedMimeType`) y transcodificación asíncrona a MP4/AAC en servidor con `ffmpeg`; `MediaAsset.converted_key`; fallback al raw con aviso | Decidido |

Para registrar una decisión nueva: añadir una fila en la ronda vigente (o abrir una ronda nueva con fecha) y actualizar la sección afectada de este documento en el mismo cambio.

---

## 15. Pendientes abiertos

**Pendientes (requieren decisión humana):**

- Nombre definitivo del producto.

**Cerrados el 2026-09-21:** métrica numérica del piloto (retirada), UX de acceso del alumno, retención de audios y sus plazos, política de reintentos, hosting por capa, umbral de aprobación, bloqueo para la profesora, proveedor de correo transaccional, intercambio de etapas 6 y 7 (rechazado), registro autónomo del estudiante en el piloto con aprobación de la profesora.

**Cerrados el 2026-09-22 (decisión 34):** entidad de acudiente, consentimiento legal, reloj de los intentos, actualizaciones de la PWA, canal de notificación de calificaciones, alcance de tipos del piloto, control de acceso al panel estadístico, bloqueados y recordatorios, algoritmo de rachas, `due_at`, ítems no respondidos y mínimo de ítems, normalización de pesos, duración de audios, denominador histórico, `age_segment`, seeds, estados de error, correo de pendientes, manual de la profesora, rate limiting, almacenamiento en R2, compatibilidad de audio entre navegadores.

---

## 16. Convenciones para agentes que trabajen en este repositorio

- Respetar todo lo marcado como **Decidido**. Si una tarea exige cambiarlo, proponerlo como nueva entrada en §14, no implementarlo en silencio.
- **Trabajar bajo SDD (§11.1):** antes de implementar, leer la spec Aprobada de la capacidad en `specs/` y las secciones que enlaza. No escribir código de producción sin spec Aprobada. Lo que la spec no pide no se construye; lo que falta se anota en sus preguntas abiertas. Reglas completas en `planning/sdd-process.md` §9.
- No construir nada listado en §2.4 durante el piloto.
- Idioma (Decidido con las convenciones de código y API, decisión 20): identificadores de código, nombres de tablas y columnas en inglés; documentación, mensajes de commit y textos de interfaz en español. El contenido pedagógico es en inglés por naturaleza del producto.
- Todo tipo de actividad nuevo requiere tres piezas: esquema Zod en el paquete compartido, tabla de detalle 1:1 en Prisma, e implementación del contrato de actividad (§7.3).
- Toda consulta a datos de tenant filtra por `organization_id`.
- Todo puntaje se calcula en el backend y se expresa en la escala 0,0–5,0. Ningún endpoint acepta un puntaje enviado por el cliente.
- Toda marca de tiempo se asigna en el servidor. Ningún DTO de entrada acepta `started_at`, `finished_at` ni equivalentes (decisión 34 §3).
- No introducir ninguna referencia a `Guardian`, `ConsentRecord`, `ConsentStatus`, `ConsentMethod`, Supabase Storage ni a los flags `stats` o `leaderboard`. Están eliminados (decisión 34).
- Los archivos binarios van siempre a Cloudflare R2 mediante URLs firmadas por el backend.
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
