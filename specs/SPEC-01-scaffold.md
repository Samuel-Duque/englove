# SPEC-01 — Scaffold

| Campo | Valor |
| --- | --- |
| Estado | Implementada |
| Etapa | 1 — Scaffold |
| Tareas | ENG-010, ENG-011, ENG-012, ENG-013, ENG-014, ENG-015, ENG-016, ENG-017, ENG-018, ENG-019 |
| Referencias | CONTEXT §2.4, §4, §6–§11, §14–§17 · architecture §2–§6, §8.5, §11–§14 · decisiones 20, 21, 23–27, 30, 32–56, 58–85 · pbp §2.1, §3, Etapa 1 · sdd-process §5–§9 |
| Aprobada por / fecha | Líder del proyecto / 2026-10-20 |

## 1. Contexto y objetivo

El equipo necesita una base reproducible para el panel de la profesora y el portal Kids/Teens, sin improvisar esquema ni seguridad. Se entrega infraestructura, no funciones pedagógicas ([CONTEXT §12](../.agents/CONTEXT.md#12-orden-de-construcción--decidido)).

Se redacta durante la Etapa 0 y se implementa en la Etapa 1. Su aprobación y ENG-001 son la compuerta de inicio; completar el scaffold no autoriza por sí solo la Etapa 2: esta requiere SPEC-02 Aprobada y ENG-011 a ENG-015 y ENG-019 en Hecho ([pbp §2.1](../planning/pbp-development.md#21-secuencia-y-paralelismo), decisión 65).

## 2. Alcance

- Incluye: monorepo, web vacía y estados de error, API operacional, configuración y logging, imagen Docker, esquema núcleo completo con migración, tres seeds, contrato compartido, servicio de configuración, correo transaccional preparado, CI y staging.
- No incluye: login ni guards funcionales (SPEC-02), editor/alumnos/grupos (SPEC-03), asignación (SPEC-04), intentos/subidas/transcodificación (SPEC-05), microjuegos (SPEC-06), revisión/retención (SPEC-07), estadísticas/jobs de pendientes (SPEC-08), PWA/offline (SPEC-09), contenido extra (SPEC-10). Se crean sus estructuras de datos, no sus flujos.
- No incluye pantallas funcionales ni elementos de [CONTEXT §2.4](../.agents/CONTEXT.md#24-explícitamente-fuera-del-piloto--decidido). Sentry, backups, monitor y promoción efectiva a producción se verifican en el lanzamiento; no se adelantan sus tareas.

## 3. Requisitos funcionales

**RF-1 — Monorepo reproducible.** ENG-010; [architecture §2](../planning/architecture-overview.md#2-estructura-del-monorepo--decidido-a1).

- **Dado** un checkout limpio con las versiones de Node y pnpm documentadas **Cuando** se instala con lockfile congelado y se ejecutan `pnpm build`, `pnpm lint`, `pnpm typecheck` y `pnpm test` **Entonces** se procesan web, API y shared con configuración común de TypeScript estricto, ESLint y Prettier; shared no importa aplicaciones ni Prisma. Las versiones estables elegidas quedan fijadas en manifiestos/lockfile; no se depende de `latest` durante CI. Los manifiestos declaran Next.js 16.4, React 19.3, TypeScript 5.9, Node 24 LTS y pnpm 11 (decisión 88), sin errores de peer-dependencies ni `@dnd-kit/*`.

**RF-2 — Web base y errores reutilizables.** ENG-011; architecture §3.3 y §3.6, decisión 51.

- **Dado** el scaffold Next.js 16.4 (App Router, React 19.3) con Tailwind y shadcn/ui sobre Radix **Cuando** carga la web **Entonces** presenta el estado vacío de §7 y existen los tres grupos de rutas vacíos, sin páginas pedagógicas ni de autenticación. `next.config.ts` habilita `reactCompiler` y `cacheComponents` y no existe `middleware.ts` (la convención es `proxy.ts`, que implementa SPEC-02; decisión 81).
- **Dado** un fallo de render o una condición de error simulada **Cuando** se activa el boundary global o `ErrorState` **Entonces** aparece el mensaje de §7 para Kids, Teens o panel, sin excepción técnica; un código desconocido usa el genérico.

**RF-3 — Configuración validada por entorno.** ENG-012 y ENG-016; architecture §4.6 y §11.1, decisión 58.

- **Dado** `local`, `staging` o `production` **Cuando** falta una variable obligatoria de §5 o tiene formato inválido **Entonces** la API termina con código distinto de cero antes de escuchar, indicando únicamente los nombres inválidos, nunca sus valores. En local no se exige una clave de envío de Resend.

**RF-4 — Health y documentación operacional.** ENG-012; architecture §4.1 y §12, pbp Etapa 1.

- **Dado** Postgres disponible **Cuando** se consulta health **Entonces** devuelve `200` con la forma de §5; con error o timeout devuelve `503 HEALTH_UNAVAILABLE` sin datos de infraestructura.
- **Dado** local o staging **Cuando** se abre docs **Entonces** responde `200` con Swagger generado automáticamente, sin decorar campo por campo; en producción responde `404` (decisión 83).

**RF-5 — Errores y logs seguros.** ENG-012; architecture §4.6, §8.5 y §13.

- **Dado** una petición o excepción que contiene correo, nombre, contraseña, token o respuestas **Cuando** se registra el resultado **Entonces** el log JSON contiene solo metadatos operativos permitidos y no esos valores, cuerpos ni URL sensibles. Las excepciones inesperadas devuelven `500 INTERNAL_ERROR` y el texto neutro de §5; no se serializa el error original.

**RF-6 — Contenedor operativo.** ENG-012; architecture §11.3, decisión 55.

- **Dado** la imagen final construida desde el monorepo **Cuando** se ejecuta **Entonces** arranca la API con sus dependencias de shared y `ffmpeg`/`ffprobe` disponibles. Se excluyen secretos del contexto y de las capas; el proceso escucha en `0.0.0.0` y el puerto configurado, y cierra sus conexiones al terminar.

**RF-7 — Esquema núcleo íntegro.** ENG-013; [architecture §6](../planning/architecture-overview.md#6-modelo-de-datos), decisiones 67–80.

- **Dado** PostgreSQL 18 vacío **Cuando** se aplica la migración inicial con `prisma migrate deploy` **Entonces** existen todas las entidades, campos y enums referenciados en §6, con tipos/nulabilidad compatibles, UUID, tiempos del servidor y `organization_id` en cada tabla de tenant. Se puede generar Prisma Client; no se crean entidades retiradas o de fases futuras.

**RF-8 — Restricciones y relaciones verificadas.** ENG-013 y ENG-017; architecture §6.2 y §6.5.

- **Dado** la base migrada **Cuando** se prueban los casos de §9 **Entonces** se rechazan un correo normalizado duplicado incluso entre organizaciones, una segunda membresía vigente, un número de intento repetido, dos audios `ready` del mismo intento y una nota fuera de 0,0–5,0. Historial de membresías y eventos con `period_key` nulo siguen permitidos.
- **Dado** `schema.prisma` y el catálogo PostgreSQL **Cuando** se contrastan con architecture §6.2/§6.5 **Entonces** toda FK declara explícitamente `onDelete` y su comportamiento efectivo coincide, incluido `NoAction` entre intentos; auditoría aplica P-4 (**Decidido**, decisión 84).

**RF-9 — Claves omitidas por defecto.** ENG-013 y ENG-017; decisión 75.

- **Dado** detalles con claves sintéticas **Cuando** se consultan con el Prisma Client común, directa o anidadamente **Entonces** no aparece `answer_key`; su lectura requiere selección explícita autorizada. `config` y `answer_key` no se fusionan al almacenar ni se importan claves en shared/web.

**RF-10 — Seed mínimo.** ENG-013 y ENG-016; decisión 50.

- **Dado** una base migrada vacía y datos de profesora suministrados de forma segura **Cuando** se ejecuta `pnpm seed` **Entonces** crea organización piloto, profesora con hash argon2id y configuración de RF-14, sin alumnos ni contenido de prueba. T&C de profesora quedan nulos; no hay contraseña pública, correo ni credenciales impresas.

**RF-11 — Seed operativo.** ENG-013 y ENG-016; pbp Etapa 1 y decisiones 50, 66.

- **Dado** una base local de pruebas migrada **Cuando** se ejecuta `pnpm seed:dev` **Entonces** deja ≥10 alumnos sintéticos, ambos segmentos, aprobados con niveles A1–B2 y pendientes sin nivel/grupo; actividades publicadas de los cinco tipos y de las cinco mecánicas; asignaciones abiertas/cerradas/próximas; intentos `graded`, `pending_review`, `abandoned`; rachas activas/perdonadas y una autorización sin consumir con `retry_extend_until`. Todo cumple §4 y no se crean audios reales en R2.

**RF-12 — Seed de volumen.** ENG-013 y ENG-016; decisión 50.

- **Dado** una base de pruebas migrada vacía **Cuando** se ejecuta `pnpm seed:volume` **Entonces** deja 100 alumnos sintéticos y tres meses de intentos distribuidos entre niveles y segmentos, sin fallar restricciones ni contactar servicios externos. Los scripts de datos sintéticos rechazan `production` y no borran datos preexistentes silenciosamente.

**RF-13 — Contrato compartido sin lógica adelantada.** ENG-014; [architecture §5](../planning/architecture-overview.md#5-paquete-compartido-y-contrato-de-actividad).

- **Dado** shared **Cuando** web/API importan sus enums y contrato **Entonces** los valores coinciden con architecture §6.3; se conserva `ActivityRuntimeProps` y `ActivityEvent` de §5.2, pero `at` es exclusivamente local. Los tipos de entrada de intentos excluyen timestamps y puntaje calculado por el alumno. El registro Zod es un esqueleto sin esquemas ni scorers funcionales; un tipo aún no registrado no se considera validado.

**RF-14 — Flags y parámetros por organización.** ENG-018; architecture §6.4, pbp Etapa 1, decisiones 41 y 67.

- **Dado** una organización confiable **Cuando** el servicio obtiene su configuración **Entonces** devuelve solo sus flags/parámetros de §5. Organización, fila o parámetro ausentes o inválidos producen `ConfigurationError` interno, sin habilitar módulos ni sustituir valores silenciosamente. La carga al iniciar sesión queda preparada; endpoint y guards llegan en SPEC-02.
- **Dado** los parámetros iniciales **Cuando** se leen **Entonces** son `3.0`, `30`, `7` y `3`, respectivamente; la configuración no se condiciona a que un módulo esté activo. Almacenamiento canónico y valores iniciales de activación son **Decidido** (decisión 83, cierra Q-2): claves iniciales `games` y `extra_content` (ambas `enabled: false`), parámetros organizacionales en `games.config`, `extra_content.config = {}`.

**RF-15 — Ocho plantillas transaccionales.** ENG-019; decisiones 30, 39, 52, 59, 62 y 63.

- **Dado** cada plantilla de §5 y entradas sintéticas **Cuando** se renderiza **Entonces** produce HTML/texto plano equivalentes en español, diseño/pie común, enlaces descriptivos y contenido definido allí. `grading-notification` no acepta ni incluye nota, feedback, respuestas o audio; abrir un enlace no ejecuta cambios de cuenta.

**RF-16 — Transporte de correo y modo local.** ENG-019; CONTEXT §9 y architecture §8.5.

- **Dado** local **Cuando** se solicita un envío **Entonces** no llama a Resend y registra solo plantilla/resultado e identificador operativo; no destinatario, cuerpo, OTP ni token.
- **Dado** transporte de staging simulado **Cuando** el SDK acepta o devuelve `{ error }` sin excepción **Entonces** distingue aceptación de fallo, sin afirmar entrega. Usa remitente común, error sanitizado y clave/payload estables en reintentos del consumidor. Un resumen vacío devuelve `skipped` sin transporte. SPF/DKIM se verifican aparte; no hay reintentos generales ni cola persistente.

**RF-17 — Gates de calidad y migración.** ENG-015; architecture §11.2 y pbp Etapa 1.

- **Dado** un PR **Cuando** corre CI **Entonces** exige lint, typecheck, tests y el check que prohíbe `db push` en scripts/configuración ejecutable versionados; introducir esa invocación hace fallar el check. No se confunden las menciones documentales de la prohibición con comandos ejecutables.
- **Dado** un commit de `main` con un gate, build o migración fallidos **Cuando** corre el pipeline **Entonces** no despliega ese candidato. Migración, seeds y despliegues no se omiten por caché de Turborepo.

**RF-18 — Staging aislado y ordenado.** ENG-015; decisiones 26, 58, 64 y 82.

- **Dado** ENG-003/ENG-004 entregadas y un commit con gates/build válidos **Cuando** CI migra staging (conexión directa de Neon) y despliega ese mismo commit en Cloudflare/Render **Entonces** cargan la web vacía y health; Render tiene una instancia, sin autoescalado, y recursos/secretos separados de producción. Despliegues independientes desde Git no pueden saltarse esos gates; commits concurrentes no ejecutan migraciones en carrera.

**RF-19 — Arranque local documentado.** ENG-016; pbp Etapa 1.

- **Dado** un desarrollador con los prerrequisitos del README **Cuando** sigue sus pasos **Entonces** en menos de 30 minutos instala, levanta PostgreSQL 18, migra, ejecuta `seed:dev` y `pnpm dev`, y accede a web/health/docs. Cada seed se valida por separado sobre base migrada vacía; no se encadenan ni se hace reset implícito. README y `.env.example` documentan versiones, ffmpeg/ffprobe y §5 sin secretos; MinIO es opcional.

## 4. Reglas de negocio

Esquema y fixtures respetan las reglas enlazadas; sus consumidores no se implementan aquí.

| Invariante del scaffold | Fuente normativa |
| --- | --- |
| Correo global normalizado, nombre en `User`, hashes; pendientes sin nivel/grupo | architecture §6.4; decisiones 35, 59, 68, 69, 77 y 79 |
| Nota solo en `Attempt`, 0,0–5,0/un decimal; manual de profesora o cálculo servidor, nunca puntaje del alumno | architecture §4.4; decisiones 24 y 72 |
| Un grupo vigente, intentos numerados y consumo atómico; cierre efectivo/tolerancia 24 h en fixtures | architecture §6.4, §7.5; decisiones 60, 61, 73 y 74 |
| Hechos temporales del servidor en UTC; fechas civiles/plazos de negocio diferenciados; America/Bogota | architecture §6.2; decisiones 37 y 67 |
| Cinco tipos/cinco mecánicas; examen solo fill_blank, publicación/pesos/omisiones y speaking 2/120/300 s | architecture §4.4, §6.4; decisiones 45–47, 66 y 70 |
| Eventos append-only; fixtures de racha cumplen las cuatro reglas y rendimiento usa último calificado | architecture §9.1–§9.3; decisiones 43, 71 y 76 |
| Kids 7–10 sin alternancia; 11+ puede alternar sin cambio automático | CONTEXT §3; decisión 49 |
| Retención 30/7 días; R2 y denominador congelado antes de cascada, no garantizados por FK; auditoría Propuesto P-4 | architecture §6.4, §8.4; decisiones 27, 48, 63 y 80 |
| Instancia única; idempotencia y registro persistente de jobs, sin ejecutarlos | architecture §4.5; decisiones 64 y 76 |

## 5. Contrato de API

### Superficie operacional

**Decidido (decisión 83, cierra Q-1):** negocio bajo `/api/v1`; `/health` y `/docs` fuera del prefijo, en la raíz de la API, conforme a los entregables de pbp y los monitores de infraestructura. `GET /docs` (Swagger UI) queda deshabilitado en producción (`APP_ENV === 'production'`) respondiendo `404`.

| Método/ruta | Acceso y entrada | Respuesta/errores |
| --- | --- | --- |
| `GET /health` | Público, sin sesión, cuerpo ni datos de tenant; consulta mínima a Postgres, timeout 5 s | `200 { "status": "ok" }`; `503 { "statusCode": 503, "code": "HEALTH_UNAVAILABLE", "message": "Servicio no disponible temporalmente" }`. No comprueba R2 ni correo. |
| `GET /docs` | Público en local/staging, sin cuerpo; no crea endpoints de negocio | `200` Swagger UI en local/staging; deshabilitado en producción (`404 NOT_FOUND`, decisión 83). |

Filtro común: `{ statusCode: number, code: string, message: string }`; `500 INTERNAL_ERROR`, mensaje «Ocurrió un error inesperado». Estos dos códigos son concreciones nuevas para revisar. Validación HTTP global con `whitelist: true`, sin rechazo de campos desconocidos (architecture A71); esquemas Zod funcionales diferidos.

### Configuración de arranque

Nombres adicionales son concreciones técnicas; los `R2_*` y `COOKIE_*` provienen de la planeación.

| Variables | Contrato |
| --- | --- |
| `APP_ENV`, `PORT` | Enum `local/staging/production`; puerto entero 1–65535. `NODE_ENV` es distinto: staging ejecuta build de producción. |
| `DATABASE_URL`, `MIGRATION_DATABASE_URL` | Conexión runtime obligatoria; segunda conexión obligatoria para CI, apta para migraciones, no entregada a web. Neon (decisión 82): runtime por el pooler (host `-pooler`, PgBouncer) con `connection_limit` bajo en Prisma; migraciones por la conexión directa. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Strings no vacíos; bucket privado por entorno. `R2_PUBLIC_URL` opcional/vacía en el piloto: no habilita acceso público. |
| `COOKIE_DOMAIN`, `COOKIE_PREFIX` | Dominio vacío local; `.<dominio>` controlado en staging/producción; prefijos documentados distintos. No se emiten cookies hasta SPEC-02. |
| `WEB_BASE_URL`, `NEXT_PUBLIC_API_URL` | Orígenes del entorno; HTTPS fuera de local. Solo dirección pública de API va al bundle web, nunca secretos. |
| `MAIL_FROM`, `RESEND_API_KEY` | Obligatorios para envío en staging/producción; local usa transporte de log sin clave. Remitente de dominio verificado, común a todas las plantillas del entorno; no se fija aquí un dominio real inexistente. |

Secretos JWT y allowlist: SPEC-02, sin autenticación simulada.

### Servicio interno de configuración

Sin ruta pública en esta etapa. Contrato preparado para `GET /api/v1/feature-flags` autenticado en SPEC-02: `{ flags: { games: boolean, extra_content: boolean }, config: { passing_score: number, retention_days: number, pending_upload_ttl_days: number, ungraded_reminder_days: number } }`. Tenant confiable, nunca recibido del cuerpo del cliente. `passing_score` entre 0 y 5; plazos enteros positivos. Valores iniciales 3.0/30/7/3. Persistencia **Propuesto**, Q-2; no se trasladan a columnas de `Organization`.

### Servicio interno de correo

Sin endpoint: entrada interna `{ template, to, variables, idempotencyKey }`, clave opaca por envío lógico, sin HTML libre. URLs del origen configurado, texto escapado, sin seguimiento. No consulta alumnos ni genera tokens. Resultado `logged/accepted/skipped/failed`; resumen vacío devuelve `skipped`. Disparadores/reintentos son del consumidor (calificación: uno, SPEC-07).

| Plantilla | Entradas de contenido / acción | Asunto y contenido mínimo |
| --- | --- | --- |
| `signup-received` | Sin token ni contraseña | «Recibimos tu solicitud en Englove». Cuenta pendiente de aprobación; se avisará cuando pueda entrar. |
| `signup-existing-account` | `recoveryUrl` a `/recuperar-contrasena` | «Ya tienes una cuenta en Englove». Solicitar recuperación; ignorar si no pidió registrarse. No revela organización ni genera reset automático. |
| `approved` | `loginUrl` a `/login` | «Tu cuenta de Englove fue aprobada». Entrar con credenciales elegidas al registrarse. |
| `password-reset` | `resetUrl` a `/restablecer/<token>` | «Restablece tu contraseña de Englove». Enlace de un uso, 30 min desde emisión; no consume token por GET. |
| `email-change-otp` | `otp` string de 6 dígitos, ceros conservados; destino nuevo | «Confirma tu nuevo correo en Englove». Código de un uso, 10 min desde emisión; no compartir. |
| `email-changed` | `changeSource` (`student/teacher`), `recipientKind` (`previous/new`) | «Tu correo de acceso a Englove cambió». Aviso informativo; no permite deshacer. Alumno: anterior; profesora: nuevo y anterior cuando sea posible. |
| `grading-notification` | `activityTitle`, `feedbackUrl` a `/feedback` | «Tu actividad ya fue calificada». «Entra a Englove para consultar el resultado». Sin evaluación en asunto, HTML, texto o URL. |
| `teacher-pending-summary` | Contadores por categoría y enlaces a solicitudes/revisión | «Tienes pendientes en Englove». Desglose sin nombres ni respuestas; no envía si no hay pendientes. Cómputo y cadencia se fijan en SPEC-08. |

## 6. Modelo de datos

Creación inicial conforme a decisión 67. Inventario/campos: [CONTEXT §7.2](../.agents/CONTEXT.md#72-entidades-núcleo) y [architecture §6.1–§6.5](../planning/architecture-overview.md#6-modelo-de-datos), sin copiar sus tablas completas.

- Identidad: `Organization`, `User`, `AuthSession`, `PasswordResetToken`, `EmailChangeRequest`, `Student`.
- Aprendizaje: `Group`, `GroupMembership`, `Activity`, `FillBlankDetail`, `OpenQuestionDetail`, `SpeakingDetail`, `GameDetail`, `ExamDetail`, `Assignment`, `Attempt`, `Review`.
- Progreso/operación: `ProgressEvent`, `BadgeRule`, `BadgeAward`, `MediaAsset`, `AuditLog`, `ScheduledJobRun`, `ExternalResource`, `FeatureFlag`.

Enums, FK e índices: architecture §6.2/§6.3/§6.5. Solo `Organization` carece de `organization_id`; configuración añade único `(organization_id, key)`.

Concreciones para la migración y generación del cliente:

| Campos | Tipo, nulabilidad y default |
| --- | --- |
| Identificadores/FK; textos | `uuid`; FK nullable solo donde el modelo lo indica. Texto `text`, columnas en `snake_case` con `@map`. `Student.user_id`, detalles `activity_id` y `Review.attempt_id` únicos por sus cardinalidades. |
| Fechas comunes y de hechos | `timestamptz` UTC, `created_at` del servidor y `updated_at` gestionado al escribir; campos futuros de finalización/revocación y plazos opcionales nullable, sin default ficticio. `birth_date`: `date`. |
| `User` / `Student` | `name/email/password_hash` obligatorios; contador de fallos entero default 0, `locked_until` nullable. `level` nullable; contactos nullable; `can_switch_interface` default false y aprobación default `pending_approval`. `terms_accepted_at timestamptz`/`terms_version text` nullable sin default; SPEC-02 exige ambos al alumno, seed de profesora los deja nulos. |
| `EmailChangeRequest.failed_attempts` | `smallint`, obligatorio, default 0. Token/OTP/refresh guardados como hash. |
| `Attempt` | `attempt_number smallint` obligatorio desde 1; `score numeric(2,1)` nullable con `CHECK` 0–5; `graded_at` nullable. Respuestas `jsonb`; `flags text[]` default vacío; los cuatro campos de autorización/historial nullable. |
| Detalles / `Review` | `config jsonb`; `answer_key jsonb` solo en los tres detalles con clave y separado de configuración pública. Speaking mínimo 2 y máximo 120; Review solo feedback, `stickers text[]` vacío permitido; comentario nullable para no anticipar P-2. |
| Duración/historia | Duraciones de Activity `integer` nullable; `Group.archived_at`, `GroupMembership.left_at` y `Assignment.historical_student_count` nullable, sin cero que confunda «no congelado». |
| `MediaAsset` | `converted_key`, duración medida, retención, `deleted_at`, `transcode_failed_at` nullable; `transcode_attempts integer` default 0; tamaño `bigint`; FK de propietario/intento obligatorias. Metadatos se conservan tras retención. |
| Progreso/configuración | `ProgressEvent.value numeric(6,1)`, `attempt_id`, `payload jsonb`, `period_key text` nullable; `occurred_at` servidor. Reglas/configuración/detalles de auditoría `jsonb`; booleanos reales, no texto. |

Índices parciales en SQL versionado dentro de la migración cuando Prisma no los exprese: membresía vigente, evento con periodo no nulo, audio `ready`, cola de revisión y recuperación de conversiones, con los predicados exactos de architecture §6.5. No se reintroducen los índices de intentos sustituidos por `attempt_number`.

`AuditLog.target_student_id onDelete: SetNull`: conserva el evento técnico tras borrar al alumno (decisión 92)**. Grupo de aprobado, detalle correcto, calificación consistente y habilitación necesitan transacciones consumidoras, no solo FK. Fechas sintéticas del seed se generan en backend.

## 7. Interfaz

Web vacía: «Englove — Plataforma en preparación». Sin navegación de usuario ni conteo de clics aplicable; se materializan en sus specs. Los grupos vacíos no crean dos páginas `/inicio`.

Estados reutilizables simulados, sin login, subida ni actividad real:

| Condición | Kids | Teens / panel |
| --- | --- | --- |
| Red/servidor | «No pudimos conectar. Vamos a intentarlo otra vez» | «No pudimos conectar. Intenta de nuevo» |
| 401/403 | «No tienes acceso a esta sección» | Mismo texto decidido |
| 404 | «No encontramos lo que buscas» | «No encontramos este recurso» |
| `ATTEMPT_ALREADY_EXISTS` | «Ya hiciste esta actividad. Habla con tu maestra» | «Ya tienes un intento. Consulta con tu maestra si puedes repetirlo» |
| Subida fallida | «Tu audio no se pudo enviar. Intenta otra vez» | «No se pudo subir el audio. Intenta de nuevo» |
| Desconocido/render | «Algo no salió bien. Intenta otra vez» | «Ocurrió un problema. Intenta de nuevo» |

`ATTEMPT_CLOSED` conserva el texto exacto de architecture §3.6; los demás códigos futuros del catálogo usan un genérico hasta que su spec fije el mensaje. El mapa no convierte propuestas en comportamiento aprobado.

Vacío/cargando/éxito: textos «No hay contenido todavía», «Cargando…» y «Listo». Acciones simuladas «Reintentar»/«Volver», solo si existe callback; sin reenvío automático de mutaciones. Kids añade representación visual no exclusiva y controles ≥48×48 px; Teens/panel tono directo. Foco visible, teclado y anuncio accesible del error. Tokens finales/observación siguen en ENG-007/ENG-008; no se inventa un tema definitivo.

## 8. Seguridad y privacidad

Health/docs no leen tenant; flags/correo no tienen entrada pública. SPEC-02 implementa guards, tenant JWT y filtro doble Prisma/servicio (architecture §4.3). Configuración/seeds usan tenant confiable explícito; unicidad de correo es global.

Fixtures sintéticos, logs conforme a RF-5/RF-16, buckets privados, secretos fuera de Git/bundle y TLS fuera de local. Envío real comparte destinatario/contenido necesario con Resend; local no.

ENG-019 verifica DNS/credenciales, no basta validar variables. URLs sin credenciales embebidas/esquemas arbitrarios. Idempotencia de Resend no garantiza entrega durable exactamente una vez; jobs consumidores mantienen registro persistente.

## 9. Pruebas

Nombres trazables para implementar después de la aprobación; esta redacción no afirma que existan o pasen.

| RF | Nivel | Nombre y alcance |
| --- | --- | --- |
| RF-1 | Build/estático | `RF-1: instala y compila los workspaces sin imports prohibidos`; comprueba versiones y ausencia de `@dnd-kit/*` |
| RF-2 | Componente | `RF-2: boundary y ErrorState muestran fallback seguro en tres variantes`; verifica `next.config.ts` y ausencia de `middleware.ts` |
| RF-3 | Integración | `RF-3: arranque rechaza variables inválidas sin revelar secretos` |
| RF-4 | Integración HTTP | `RF-4: health verifica Postgres y docs genera OpenAPI`; incluye timeout/503 |
| RF-5 | Integración | `RF-5: filtro y pino eliminan PII y errores internos`; inyectar valores centinela |
| RF-6 | Smoke contenedor | `RF-6: imagen final arranca y contiene ffmpeg y ffprobe` |
| RF-7 | Integración PG16 | `RF-7: migración vacía contiene inventario, tipos y enums completos`; inspeccionar catálogo |
| RF-8 | Integración PG16 | `RF-8: onDelete explícito en Prisma y catálogo compatible`; duplicados, notas -0.1/5.1/0/5, cadena de intentos y Restrict |
| RF-9 | Integración Prisma | `RF-9: answer_key se omite en lecturas directas y anidadas de tres detalles` |
| RF-10 | Integración | `RF-10: seed mínimo crea solo organización, profesora y configuración` |
| RF-11 | Integración | `RF-11: seed operativo cumple cobertura y reglas de fixtures` |
| RF-12 | Integración | `RF-12: seed de volumen crea 100 alumnos y tres meses sin envíos`; comprobar protección de producción |
| RF-13 | Tipos/unitaria | `RF-13: enums coinciden y DTOs no aceptan timestamps ni score del alumno` |
| RF-14 | Integración | `RF-14: aislamiento y ConfigurationError ante organización/fila/parámetro ausentes o inválidos` |
| RF-15 | Unitarias | `RF-15: ocho plantillas cumplen contenido y privacidad`; HTML/texto, escape y URLs |
| RF-16 | Unitarias | `RF-16: log privado, error SDK y resumen skipped`; remitente, clave/payload estables |
| RF-17 | Prueba pipeline | `RF-17: gate fallido y comando prohibido bloquean despliegue` |
| RF-18 | Smoke staging | `RF-18: mismo commit carga web y health con instancia única y recursos aislados` |
| RF-19 | Validación manual | `RF-19: desarrollador nuevo arranca en menos de 30 minutos`; registrar pasos/tiempo |

RF-7/RF-8/RF-14 usan PostgreSQL 18 real de pruebas, no SQLite ni mocks del esquema. Los dos tenants son fixtures de aislamiento, no organizaciones piloto nuevas. Componentes y SDK se prueban sin servicios externos. Sin E2E pedagógicos aún: sdd-process §8 los incorpora al cerrar SPEC-04/SPEC-05/SPEC-07. Tablet real y Safari/audio se validan en sus etapas; no bloquean esta web vacía.

## 10. Fuera de alcance y decisiones diferidas

Exclusiones de §2 y CONTEXT §2.4 vinculantes. No se crean CRUDs de flags, visor de auditoría/correo, outbox, webhooks, marketing ni adjuntos. No se reintroducen `Subscription`, `Guardian`, `ConsentRecord`, Supabase Auth/Storage/Realtime/RLS, Redis, `Assignment.max_attempts`, `Student.name`, `Review.score`/`graded_at`, `rejected`, flags `stats`/`leaderboard` o eventos de intento separados.

SPEC-06 revisará la excepción de clave de microjuegos (architecture §5.3) frente a CONTEXT §16; aquí solo omisión global.

## 11. Preguntas abiertas

No hay P-n asignados a SPEC-01 (P-1 a P-4 quedaron ratificados y cerrados por la decisión 84). Todas las preguntas propias (Q-1, Q-2 y Q-4) han sido cerradas (decisiones 83 y 85). No quedan preguntas abiertas ni dependencias bloqueantes para SPEC-01.

| # | Pregunta / propuesta vigente | Responsable | Fecha límite | Bloquea |
| --- | --- | --- | --- | --- |
| Q-1 | Prefijo operacional y docs en producción. **Cerrada (Decidido, decisión 83):** excepción explícita para `/health` y `/docs`, negocio `/api/v1`; docs deshabilitado en producción (`404`). | Líder del proyecto | 2026-10-10 | No (cerrada) |
| Q-2 | Fuente canónica y activación inicial en `FeatureFlag`. **Cerrada (Decidido, decisión 83):** claves `games` y `extra_content` (ambas `enabled: false`), parámetros en `games.config`, `extra_content.config = {}`. | Líder del proyecto | 2026-10-10 | No (cerrada) |
| Q-4 | Adaptador de Cloudflare, `proxy.ts`, React Compiler y bundle de 3 MB (decisiones 81, 82 y 85). **Cerrada (Decidido, decisión 85):** PoC ENG-140 en verde (7/7 comprobaciones, informe en [`planning/poc-eng-140-informe.md`](../planning/poc-eng-140-informe.md)). Seleccionado `vinext`; Worker de 91.69 kB gzip verificado; `proxy.ts` con cookies `Domain=.englove.org` validado. Desbloquea RF-1, RF-2 y RF-18. | Líder del proyecto | 2026-10-10 | No (cerrada) |
| P-1 | Inicio antes de apertura. **Cerrada (Decidido, decisión 84):** `409 ATTEMPT_NOT_OPEN`, no crear intento y mostrar fecha de apertura (CONTEXT §14). El mapa funcional lo completa SPEC-05. | Líder del proyecto | 2026-10-10 | No |
| P-2 | Comentario autocalificados. **Cerrada (Decidido, decisión 84):** obligatorio solo en revisión manual, opcional en autocalificados. Comentario nullable permite ambos en el esquema; SPEC-07 adapta fixtures/validación. | Líder del proyecto | 2026-10-10 | No |
| P-3 | Transcodificación. **Cerrada (Decidido, decisión 84):** máximo 3 intentos totales persistidos; fallo definitivo y raw como fallback, sin reconversión manual. Scaffold crea campos; SPEC-05 completa rutina. | Líder del proyecto | 2026-10-10 | No |
| P-4 | Auditoría. **Cerrada (Decidido, decisión 84):** conservar mientras exista alumno, borrar en cascada (`onDelete: Cascade` en FK a `Student`), sin pantalla, consulta técnica a petición de profesora, nunca logs. | Líder del proyecto | 2026-10-10 | No |
| Q-3 | Valores de duración por tipo y catálogo `STICKERS` sin valores concretos en planeación. **Propuesto:** duraciones nullable y stickers vacíos en fixtures iniciales; fijar defaults/catálogo en SPEC-03/SPEC-07 antes de sus consumidores, no inventarlos aquí. | Líder del proyecto | Antes de aprobar specs consumidoras | No |

Incongruencias aplicadas por jerarquía, sin corregir decisiones en silencio: enlaces al log local (architecture §7.4/§11.1) frente a prohibición de tokens/PII (CONTEXT §9 y architecture §8.5): manda privacidad, RF-16; E2E de `main` (architecture §11.2) se incorporan al cerrar los flujos según sdd-process §8/pbp §1.4. ENG-016 depende de ENG-012 para empezar, pero verificar sus seeds requiere ENG-013. Grupos de rutas con `/inicio` duplicado se resuelven antes de crear páginas funcionales, no en scaffold.

## 12. Registro de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-10-08 | Creación del borrador con 19 RF, contratos, trazabilidad de pruebas y preguntas explícitas | Tarea SPEC-01; cubrir ENG-010 a ENG-019 conforme a decisiones vigentes sin aprobar propuestas ni escribir producción |
| 2026-10-08 | Revisión semántica: T&C nullable, onDelete explícito, configuración inválida, correo skipped y seeds independientes; eliminación de repeticiones | Revisión independiente y límite de lectura de SDD §3; skills de NestJS, Postgres/Prisma, Turborepo/CI, Render Docker, React/shadcn y Resend/correo como apoyo, sin sustituir la planeación |
| 2026-10-10 | Next.js 16/React 19 (RF-1, RF-2), Neon y Cloudflare (variables, RF-18) y Q-4 | Decisiones 81 y 82; sigue en Borrador |
| 2026-10-10 | Cierre de Q-1 (prefijo de API y Swagger 404 en producción), Q-2 (configuración canónica en games.config) y ratificación de P-1 a P-4 (decisiones 83 y 84); solo Q-4 (PoC ENG-140) queda bloqueante | Confirmación del líder del proyecto; sigue en Borrador a la espera de ENG-140 |
| 2026-10-10 | Cierre de Q-4 con PoC ENG-140 en verde (7/7 comprobaciones, informe planning/poc-eng-140-informe.md, decisión 85: vinext). Sin preguntas bloqueantes restantes; pasa a En revisión | PoC ENG-140 finalizado exitosamente (Decisión 85) |
| 2026-10-20 | Aprobación formal de la spec por el líder del proyecto tras verificar estructura, compuertas y PoC ENG-140 | Pasa a estado Aprobada; desbloquea la compuerta de inicio de la Etapa 1 (scaffold) |
| 2026-10-20 | Implementación completa de SPEC-01 Scaffold (ENG-010 a ENG-019, RF-1 a RF-19): monorepo, web, api, shared, Prisma, migraciones, seeds, docker-compose, render.yaml, CI y pruebas | Pasa a estado Implementada tras verificar suites de pruebas y guardrails |
