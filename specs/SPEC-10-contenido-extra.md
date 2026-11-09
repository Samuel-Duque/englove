# SPEC-10 — Contenido extra

| Campo                | Valor                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado               | Verificada                                                                                                                                                                                                     |
| Etapa                | 10 — Contenido extra                                                                                                                                                                                           |
| Tareas               | ENG-120, ENG-121                                                                                                                                                                                               |
| Referencias          | CONTEXT §2.4, §4, §5.1, §5.2, §12.10, §14 (decisiones 17, 20, 29, 34, 41, 50, 51, 59, 66, 67, 75, 79, 83, 89, 120, 122, 124–126), §16; architecture §3.1–§3.6, §4.1, §4.2, §6.1, §6.2, §8.3; pbp Etapa 10 |
| Aprobada por / fecha | Líder del proyecto / 2026-11-04                                                                                                                                                                                   |

## 1. Contexto y objetivo

La profesora complementa sus clases con recursos interactivos alojados en plataformas externas como Educaplay, videos educativos o diccionarios visuales. Para evitar la fragilidad técnica de políticas de terceros (`X-Frame-Options` / `Content-Security-Policy`) y los riesgos de seguridad y rastreo sobre menores al incrustar sitios externos, el piloto ofrece una sección de **Contenido extra** compuesta exclusivamente por enlaces externos verificados bajo `https://` que se abren en una pestaña nueva del navegador, fuera del flujo de calificación, intentos, rachas y estadísticas (CONTEXT §2.4, §5.1, decisión 17).

Esta especificación define el módulo `resources` en `apps/api`, la gestión docente en `(teacher)/contenido-extra/` (`ENG-120`) y la vista del alumno en `(student)/extra/` a un máximo de 3 clics desde `/inicio` (`ENG-121`), gobernados por el feature flag organizacional `extra_content` (decisiones 41 y 124).

## 2. Alcance

**Incluye:**

- Módulo `ResourcesModule` (`/api/v1/resources`) en `apps/api`: listado, creación, edición, reordenamiento transaccional de `position` y borrado de `ExternalResource` filtrados por `organization_id` (decisiones 79 y 126).
- Validación estricta de protocolo `https:` en cliente y servidor, rechazando esquemas inseguros (`http:`, `javascript:`, `data:`, `vbscript:`, `file:`) y credenciales en la URL.
- Gobernabilidad mediante el flag `extra_content` de `FeatureFlag` (decisiones 41 y 124): la profesora prepara y ordena los enlaces en `/contenido-extra` con la sección apagada y luego la habilita para los alumnos con `PATCH /api/v1/feature-flags/extra_content`, preservando `extra_content = false` en `seed.ts` (decisión 83) y datos activos en `seed-dev.ts` (`T-02`).
- Segmentación por nivel MCER (decisión 125): recursos generales para todos los niveles (`level = null`) y recursos exclusivos de un curso/nivel (`A1`, `A2`, `B1`, `B2`), filtrados en servidor para el alumno y filtrables en el panel docente.
- Pantalla docente `/contenido-extra` con TanStack Query (`T-04`), creación/edición, filtro por nivel MCER, reordenamiento accesible y confirmación de borrado (`ENG-120`).
- Pantalla del estudiante `/extra` adaptada por segmento (`kids` / `teens`), integrada en `StudentNav` respetando el tope de 5 entradas y el techo de 3 clics desde `/inicio`, abriendo cada recurso en pestaña nueva sin `iframe` (`ENG-121`).
- Ajuste de `proxy.ts` para `/contenido-extra` (`teacher`) y `/extra` (`student`) (`T-01`), síntesis de voz en `kids`, aviso sin conexión y cobertura en la puerta `axe` (WCAG 2.2 AA) (`T-05`).

**No incluye:**

- Integración embebida con `iframe` de Educaplay ni de otras plataformas (fuera del piloto — CONTEXT §2.4, decisión 17).
- Calificación, creación de `Attempt`, emisión de `ProgressEvent`, estrellas, insignias, rachas o métricas estadísticas (`pbp Etapa 10`).
- Telemetría o conteo de clics salientes por estudiante (fuera de alcance por privacidad y simplicidad del piloto).
- Subida de archivos propios (PDF, audio, imagen) a Cloudflare R2 en esta sección (diferido a Fase 2; R2 en el piloto es solo para `speaking` y `pg_dump`).
- Asignación de recursos externos por grupo o con fechas `opens_at` / `due_at` (exclusivo de `Activity` + `Assignment` en `SPEC-03` y `SPEC-04`).
- Previsualización OpenGraph o extracción de metadatos desde el backend hacia URLs externas (evita vectores SSRF).

## 3. Requisitos funcionales

### RF-1 — Creación y edición de recursos externos con validación estricta de URL `https`

Tarea: `ENG-120`. Referencias: Decisiones 79, 125 y 126, `CONTEXT §5.1`, `§16`, `architecture §4.1`, `§4.2`.

La profesora crea (`POST /api/v1/resources`) y edita (`PATCH /api/v1/resources/:id`) filas de `ExternalResource` en su organización. El servidor aplica `trim`, exige `title` (1–160 caracteres) y `url` (1–2048 caracteres, `new URL(value)` válido con `protocol === 'https:'`, `hostname` no vacío y sin `username`/`password`), acepta `description` opcional (`<= 500` caracteres; vacío normalizado a `null`) y `level` opcional (`'A1' | 'A2' | 'B1' | 'B2' | null`, donde `null` es contenido general para todos los niveles). `organization_id`, `created_by`, `created_at` y `updated_at` los fija el servidor; al crear se asigna `position = COALESCE(MAX(position), -1) + 1` dentro del tenant.

**Criterios de aceptación:**

- **Dado** una sesión `teacher`, **Cuando** envía `POST /api/v1/resources` con `{ title: "Animals Memory - Educaplay", url: "https://es.educaplay.com/recursos-educativos/12345", description: "Repaso", level: "A1" }`, **Entonces** responde `201 Created` con el recurso persistido bajo `organization_id = user.organizationId`, `created_by = user.id`, `position` al final del catálogo y timestamps del servidor.
- **Dado** una petición `POST` o `PATCH` a `/api/v1/resources`, **Cuando** `url` usa `http:`, `javascript:`, `data:`, `file:`, carece de host, contiene credenciales (`https://u:p@sitio.com`) o excede 2048 caracteres, **Entonces** responde `400` con `code: 'VALIDATION_ERROR'` sin escribir en base de datos.
- **Dado** un cuerpo con `organization_id`, `created_by`, `created_at` o `score` inyectados por el cliente, **Cuando** actúa `ValidationPipe` (`whitelist: true`), **Entonces** descarta los campos ajenos y persiste solo los valores del contexto autenticado y del reloj del servidor.
- **Dado** una organización con 200 recursos activos (decisión 126), **Cuando** intenta crear el recurso 201, **Entonces** responde `409` con `code: 'RESOURCE_LIMIT_REACHED'`.

### RF-2 — Listado determinista, reordenamiento atómico y eliminación de recursos

Tarea: `ENG-120`. Referencias: Decisiones 50, 79, 89 y 126, `architecture §4.1`, `§6.1`.

El backend expone `GET /api/v1/resources` ordenado por `position ASC, created_at ASC, id ASC`, `PUT /api/v1/resources/reorder` para reasignar posiciones `0..N-1` en una transacción `$transaction` y `DELETE /api/v1/resources/:id` verificando pertenencia al tenant.

**Criterios de aceptación:**

- **Dado** tres recursos `[idA, idB, idC]` en posiciones `0, 1, 2`, **Cuando** la profesora envía `PUT /api/v1/resources/reorder` con `{ resourceIds: [idC, idA, idB] }`, **Entonces** actualiza sus `position` a `0, 1, 2` atómicamente y responde `200 OK` con la lista en orden `[idC, idA, idB]`.
- **Dado** una petición a `PUT /api/v1/resources/reorder`, **Cuando** `resourceIds` repite IDs, omite recursos del tenant o incluye un ID inexistente o de otra organización, **Entonces** responde `400 VALIDATION_ERROR` (o `404 RESOURCE_NOT_FOUND` ante ID ajeno/inexistente) sin alterar ninguna posición.
- **Dado** un recurso de la organización, **Cuando** la profesora ejecuta `DELETE /api/v1/resources/:id`, **Entonces** se elimina filtrando por `{ id, organization_id }` y responde `204 No Content`; si no existe o es de otro tenant, responde `404 RESOURCE_NOT_FOUND`.

### RF-3 — Preparación docente con sección apagada, conmutación de `extra_content` y semillas

Tareas: `ENG-120`, `ENG-121`. Referencias: Decisiones 41, 83 y 124, `pbp Etapa 10`, `SPEC-01 RF-14`.

La disponibilidad para alumnos depende de `FeatureFlagsService.isFeatureEnabled(organizationId, 'extra_content')`. Con la sección apagada (`extra_content.enabled = false`), la profesora accede a `/contenido-extra` para preparar, editar y ordenar los enlaces, y la habilita o deshabilita cuando lo decida mediante `PATCH /api/v1/feature-flags/extra_content` (decisión 124). `seed.ts` crea `extra_content.enabled = false` sin pisarlo en re-ejecuciones; `seed-dev.ts` lo activa con enlaces de ejemplo (`T-02`).

**Criterios de aceptación:**

- **Dado** `extra_content.enabled = false`, **Cuando** un `student` llama `GET /api/v1/resources`, **Entonces** recibe `403` con `code: 'EXTRA_CONTENT_DISABLED'`; `StudentNav` oculta «Extra» y abrir `/extra` muestra «El contenido extra no está habilitado en este momento.» con enlace a `/inicio`, sin error `500`.
- **Dado** `extra_content.enabled = false`, **Cuando** la profesora abre `/contenido-extra`, **Entonces** visualiza el aviso «Sección oculta para los estudiantes», puede crear, editar, reordenar y borrar enlaces con normalidad y, al activar el interruptor (`PATCH /api/v1/feature-flags/extra_content` `{ enabled: true }`), recibe `200 OK` con `{ flags: { games, extra_content: true }, config }` sin modificar `games.enabled` ni `games.config`.
- **Dado** `extra_content.enabled = true` en base de datos, **Cuando** se re-ejecuta `apps/api/prisma/seeds/seed.ts`, **Entonces** `upsert` con `update: {}` conserva `enabled = true` (decisión 83(b)).

### RF-4 — Gestión docente de «Contenido extra» en `/contenido-extra`

Tarea: `ENG-120`. Referencias: `CONTEXT §5.1`, Decisiones 20, 124, 125 y 126, `architecture §3.1`, `§3.4`.

El panel incorpora `(teacher)/contenido-extra/page.tsx` y la entrada «Contenido extra» en `TeacherNav`, usando TanStack Query (`useQuery` / `useMutation`, `T-04`) para listar, filtrar por nivel (`Todos`, `General`, `A1`–`B2`), crear/editar en modal accesible, reordenar con botones «Subir» / «Bajar» y eliminar previa confirmación.

**Criterios de aceptación:**

- **Dado** `/contenido-extra` sin registros, **Cuando** concluye la carga, **Entonces** muestra «Aún no has publicado enlaces de contenido extra.» y el botón «Agregar primer enlace».
- **Dado** el formulario modal abierto, **Cuando** se introduce una URL sin prefijo `https://` válida y se intenta guardar, **Entonces** muestra «Ingresa un enlace válido que comience con https://» y bloquea el envío antes de llamar a la API.
- **Dado** al menos dos recursos con filtro `Todos`, **Cuando** la profesora pulsa «Subir» o confirma «Eliminar», **Entonces** la mutación persiste el cambio e invalida `['resources']` actualizando la lista en pantalla.

### RF-5 — Sección «Contenido extra» en `/extra` en máximo 3 clics y filtrado por nivel

Tarea: `ENG-121`. Referencias: Decisiones 29, 79 y 125, `CONTEXT §4`, `§5.2`, `architecture §3.1`.

Con `flags.extra_content === true`, `StudentNav` muestra «Extra» (`/extra`, `aria-label="Contenido extra"`), manteniendo un máximo de 5 entradas (`Inicio`, `Juegos`, `Progreso`, `Feedback`, `Extra`). El alumno abre cualquier enlace en **máximo 3 clics** desde `/inicio` y solo recibe recursos generales para todos los niveles (`level = null`) más los recursos específicos de su `Student.level` vigente (decisión 125).

**Criterios de aceptación:**

- **Dado** un alumno `A1` con `flags.games = true` y `flags.extra_content = true`, **Cuando** desde `/inicio` pulsa «Extra» (`clic 1`), filtra opcionalmente entre `Todos`, `Nivel A1` o `Generales` (`clic 2`) y pulsa «Abrir en pestaña nueva ↗» (`clic 2` o `clic 3`), **Entonces** abre el enlace en `<= 3` clics sin pantallas intermedias de un solo botón y `StudentNav` exhibe como máximo 5 entradas.
- **Dado** recursos con `level` en `'A1'`, `'B2'` y `null`, **Cuando** un alumno con `Student.level = 'A1'` consulta `GET /api/v1/resources`, **Entonces** recibe en servidor únicamente los de `'A1'` y `null` en orden `position ASC`, sin ver nunca los de `'B2'`.
- **Dado** ausencia de enlaces para el nivel del alumno y sin generales, **Cuando** entra a `/extra`, **Entonces** ve el estado vacío temático («Todavía no hay enlaces extra para explorar.» en `kids`; «Aún no hay contenido extra publicado para tu nivel.» en `teens`) con enlace a `/inicio`.

### RF-6 — Apertura exclusiva en pestaña nueva sin incrustación ni fuga de sesión

Tarea: `ENG-121`. Referencias: Decisión 17, `CONTEXT §2.4`, `§10`, `G-C13`.

Todo recurso en `/extra` y `/contenido-extra` se renderiza únicamente como `<a href={resource.url} target="_blank" rel="noopener noreferrer">` avisando que se abre fuera de Englove, sin incrustar contenido externo en el DOM ni adjuntar datos del usuario en la URL.

**Criterios de aceptación:**

- **Dado** una tarjeta renderizada en `/extra` o `/contenido-extra`, **Cuando** se inspecciona el DOM, **Entonces** el enlace usa `<a target="_blank" rel="noopener noreferrer">` con `href` exacto `https://...`, sin elementos de marco incrustado (`embed`, `object` ni contenedores de marco externo) ni `dangerouslySetInnerHTML`.
- **Dado** el clic del estudiante sobre el enlace externo, **Cuando** se abre la nueva pestaña, **Entonces** `rel="noopener noreferrer"` anula `window.opener` y la cabecera `Referer`, sin enviar `studentId`, correo, nombre ni tokens al sitio externo.

### RF-7 — Exclusión total del flujo de calificación, intentos, rachas y estadísticas

Tareas: `ENG-120`, `ENG-121`. Referencias: Decisión 17, `CONTEXT §5.1`, `pbp Etapa 10`.

`ExternalResource` es material complementario libre: ni el backend ni el frontend registran actividad evaluable ni seguimiento sobre él.

**Criterios de aceptación:**

- **Dado** un alumno que consulta `/extra` y abre enlaces externos, **Cuando** se consultan `attempts`, `reviews`, `progress_events`, `assignments`, `/progreso` y `/api/v1/stats/*`, **Entonces** no se crea ni modifica ninguna fila y todas las notas, estrellas, insignias, rachas y tasas de cumplimiento permanecen intactas.

### RF-8 — Autorización por rol, aislamiento multi-tenant, `proxy.ts` e higiene en logout

Tareas: `ENG-120`, `ENG-121`. Referencias: Decisiones 50, 51, 89, `CONTEXT §16`, `SPEC-02 RF-17`, `RF-18`, `SPEC-09 RF-4`.

`proxy.ts` redirige por rol (`/contenido-extra` solo `teacher`; `/extra` solo `student`, `T-01`); NestJS aplica toda la cadena de guards, doble filtro `organization_id` y `NoCacheInterceptor`; el logout limpia cachés locales (`T-04`).

**Criterios de aceptación:**

- **Dado** un `student` (o cuenta `pending_approval`), **Cuando** invoca `POST`, `PATCH`, `PUT /reorder` o `DELETE` en `/api/v1/resources` o `PATCH /api/v1/feature-flags/extra_content`, **Entonces** recibe `403 FORBIDDEN`; al navegar un `student` a `/contenido-extra` o una `teacher` a `/extra`, `proxy.ts` redirige a `/inicio`.
- **Dado** un recurso de `orgA`, **Cuando** un usuario de `orgB` intenta leerlo, editarlo, reordenarlo o borrarlo, **Entonces** no figura en `GET /api/v1/resources` y las rutas por `:id` devuelven `404 RESOURCE_NOT_FOUND` filtrando por `{ id, organization_id }`.
- **Dado** una tablet compartida, **Cuando** el usuario cierra sesión o queda sin red, **Entonces** `clearSharedDeviceSession` vacía TanStack Query, el Service Worker no guarda `/api/v1/resources` en `Cache Storage` y, sin conexión, `/extra` muestra «Necesitas conexión a internet para abrir enlaces externos.» sin escribir en IndexedDB (`T-05`).

### RF-9 — Adaptación temática (`kids` / `teens`), síntesis de voz y accesibilidad WCAG 2.2 AA

Tareas: `ENG-120`, `ENG-121`. Referencias: Decisiones 120 y 122, `CONTEXT §5.2`, `SPEC-05 RF-27`, `SPEC-09 RF-19`–`RF-22`.

`/extra` adapta su diseño a `data-theme="kids"` y `"teens"`, ofrece síntesis de voz (`speechSynthesis`, `es-CO`) en `kids` y cumple junto con `/contenido-extra` las reglas táctiles y la compuerta `axe` en CI (`T-05`).

**Criterios de aceptación:**

- **Dado** un alumno `kids` en `/extra` con soporte de Web Speech API, **Cuando** pulsa `🔊 Escuchar`, **Entonces** reproduce la consigna o descripción en español y detiene la locución al cancelar o salir de la ruta; sin soporte en el navegador, el control se omite sin error.
- **Dado** `/contenido-extra` y `/extra` (`kids` y `teens`) evaluados con `@axe-core/playwright` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), **Cuando** corre la suite, **Entonces** reporta `0` violaciones, cajas interactivas `>= 48 × 48 px` e indicador `:focus-visible` de `>= 2 px` con contraste `>= 3:1`.

## 4. Reglas de negocio

1. **No evaluable (`CONTEXT §2.4`, decisión 17, `pbp Etapa 10`):** `ExternalResource` no es un `ActivityType` (decisión 66). No se asigna a grupos, no tiene fechas límite y jamás genera `Attempt`, `Review` ni `ProgressEvent`.
2. **Solo `https:` estricto (decisión 79, `G-C13`):** Únicamente se aceptan URLs absolutas `https://` con `hostname` válido, sin usuario/contraseña embebidos y longitud `<= 2048`.
3. **Orden determinista y tope (decisión 126):** Orden canónico `position ASC, created_at ASC, id ASC`. Las altas entran en `MAX(position) + 1`, con límite de 200 recursos por organización sin paginación.
4. **Visibilidad por nivel MCER y generales (decisión 125):** Los recursos con `level = null` son generales para todos los niveles; los recursos con `level` (`A1`, `A2`, `B1`, `B2`) solo son visibles en el portal para alumnos cuyo `Student.level` coincida con ese curso/nivel. En `/contenido-extra` la profesora agrega, edita y filtra recursos tanto generales como por nivel.
5. **Techo de clics y navegación (decisión 29, `architecture §3.1`):** Máximo 5 entradas en `StudentNav` y máximo 3 clics desde `/inicio` hasta abrir el enlace externo.
6. **Preparación con sección apagada y habilitación posterior (decisiones 41, 83 y 124):** `seed.ts` mantiene `extra_content = false` sin sobrescribirlo. Mientras `extra_content = false`, el portal y la API bloquean el acceso del alumno (`403 EXTRA_CONTENT_DISABLED`), pero `/contenido-extra` permanece activo para que la profesora prepare los enlaces y luego habilite la sección desde el interruptor del panel.

## 5. Contrato de API

Se incorpora `ResourcesModule` (`/api/v1/resources`) y se añade `PATCH /api/v1/feature-flags/extra_content`. Cadena activa: `OriginGuard` (mutaciones) → `JwtAuthGuard` → `RolesGuard` → `RateLimiterGuard` (120 req/min) → `TenantInterceptor` → `ValidationPipe` (`whitelist: true`, `transform: true`) → `NoCacheInterceptor`.

| Método y ruta | Rol | Entrada (Query / Body) | Respuesta exitosa | Errores |
| --- | --- | --- | --- | --- |
| `GET /api/v1/resources` | `teacher`, `student` | `teacher`: `level?: 'A1' \| 'A2' \| 'B1' \| 'B2' \| 'general'`. `student`: filtro fijo en servidor `level IN (student.level, null)` (decisión 125). | `200 OK` — `ExternalResourceListResponse` | `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 EXTRA_CONTENT_DISABLED` |
| `POST /api/v1/resources` | `teacher` | `{ title: string, url: string, description?: string \| null, level?: Level \| null }` | `201 Created` — `ExternalResourceItem` | `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 FORBIDDEN`, `409 RESOURCE_LIMIT_REACHED` |
| `PATCH /api/v1/resources/:id` | `teacher` | `id` (UUID v4) + `{ title?: string, url?: string, description?: string \| null, level?: Level \| null }` | `200 OK` — `ExternalResourceItem` | `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 FORBIDDEN`, `404 RESOURCE_NOT_FOUND` |
| `PUT /api/v1/resources/reorder` | `teacher` | `{ resourceIds: string[] }` (1..200 UUID v4 únicos del tenant, decisión 126) | `200 OK` — `ExternalResourceListResponse` | `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 FORBIDDEN`, `404 RESOURCE_NOT_FOUND` |
| `DELETE /api/v1/resources/:id` | `teacher` | `id` (UUID v4) | `204 No Content` | `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 FORBIDDEN`, `404 RESOURCE_NOT_FOUND` |
| `GET /api/v1/feature-flags` | `teacher`, `student` | *(existente en `SPEC-01`)* | `200 OK` — `{ flags: { games, extra_content }, config }` | `401 AUTH_UNAUTHORIZED` |
| `PATCH /api/v1/feature-flags/extra_content` | `teacher` | `{ enabled: boolean }` (decisión 124) | `200 OK` — `{ flags: { games, extra_content }, config }` | `400 VALIDATION_ERROR`, `401 AUTH_UNAUTHORIZED`, `403 FORBIDDEN` |

**Tipos y validador compartido en `packages/shared/src/api/resources.ts`:**

- `ExternalResourceItem`: `{ id, title, url, description: string | null, level: Level | null, position, createdBy, createdAt, updatedAt }`.
- `ExternalResourceListResponse`: `{ items: ExternalResourceItem[], total: number }`.
- `CreateExternalResourceRequest`, `UpdateExternalResourceRequest`, `ReorderExternalResourcesRequest`.
- `isValidHttpsResourceUrl(raw: string): boolean`: función pura compartida entre formulario web y decorador `@IsHttpsResourceUrl()` en NestJS (`1..2048` chars, `new URL(trimmed)` válido, `protocol === 'https:'`, `hostname` no vacío, sin espacios ni credenciales).

## 6. Modelo de datos

Se reutilizan **sin cambios de esquema ni migraciones DDL adicionales** (`T-03`) las tablas `ExternalResource` (`external_resources`) y `FeatureFlag` (`feature_flags`) ya definidas en `apps/api/prisma/schema.prisma` (`SPEC-01`, decisiones 67, 75 y 79):

- `ExternalResource`: `id` (`Uuid`), `organization_id` (`Uuid`, FK → `Organization`, `onDelete: Restrict`), `title`, `url`, `description?`, `level?` (`Level`), `position` (`Int @default(0)`), `created_by` (`Uuid`, FK → `User`, `onDelete: Restrict`), `created_at` y `updated_at` (`Timestamptz`).
- Con una única organización en el piloto (decisión 59) y un tope cerrado de 200 recursos por organización (decisión 126), el escaneo y ordenamiento se resuelve en `< 0,2 ms` sin añadir índices nuevos ni alterar la suite de esquema de `ENG-017` (`T-03`).
- `ExternalResource` forma parte de las 24 tablas con `organization_id` directo (decisión 89). El borrado en cascada de un alumno no afecta `external_resources` porque `created_by` referencia solo a docentes.

## 7. Interfaz

| Superficie / Ruta | Comportamiento y controles | Estados y textos clave en español |
| --- | --- | --- |
| `TeacherNav` + `(teacher)/contenido-extra/page.tsx` | Entrada «Contenido extra» en `TeacherNav`. Cabecera con interruptor «Visible para estudiantes», filtro (`Todos`, `General`, `A1`–`B2`) y botón «Nuevo enlace». Lista con posición, título, dominio, insignia de nivel (`General` o `Nivel A1`–`B2`), descripción y acciones «Subir», «Bajar» (deshabilitados en extremos o con filtro de nivel activo), «Abrir ↗», «Editar» y «Eliminar». | **Vacío:** «Aún no has publicado enlaces de contenido extra.» + «Agregar primer enlace». **Flag apagado:** «Sección oculta para los estudiantes. Puedes preparar los enlaces y activarla cuando estés lista.». **Modal borrado:** «¿Eliminar el enlace "{title}"? Dejará de aparecer en el portal inmediatamente.». **Error:** `ErrorState` de panel. |
| `StudentNav` + `(student)/extra/page.tsx` | Entrada «🔗 Extra» (`aria-label="Contenido extra"`) solo con `flags.extra_content === true` (máx. 5 ítems). Píldoras (`Todos`, `Nivel {level}`, `Generales`), tarjetas con título, nivel, dominio, descripción, botón `🔊 Escuchar` (`kids`) y `<a target="_blank" rel="noopener noreferrer">` de `>= 48 × 48 px` con «Abrir en pestaña nueva ↗». | **Vacío `kids`:** «Todavía no hay enlaces extra para explorar.». **Vacío `teens`:** «Aún no hay contenido extra publicado para tu nivel.». **Flag apagado:** «El contenido extra no está habilitado en este momento.» + «Volver al inicio». **Sin red:** «Necesitas conexión a internet para abrir enlaces externos.». |
| `apps/web/src/proxy.ts` | `/contenido-extra` clasificada como ruta `teacher` (sustituyendo `/contenidos`) y `/extra` como ruta `student`, redirigiendo roles cruzados a `/inicio` con `307` sin lógica de negocio (`G-B04`, `T-01`). | Redirección inmediata en el borde. |

- **Ergonomía y caché:** temas `kids` (cálido, con TTS `es-CO`) y `teens` (sobrio, alto contraste), objetivos táctiles `>= 48 × 48 px`, foco `:focus-visible >= 2 px` (contraste `>= 3:1`), modales con foco atrapado y cierre con `Escape`, y prohibición absoluta de `'use cache'` en rutas autenticadas (`G-B05`).

## 8. Seguridad y privacidad

- **Esquema `https:` y pestaña aislada (`G-C13`):** Validación doble (API + cliente `url.startsWith('https://')`), renderizado exclusivo en `<a target="_blank" rel="noopener noreferrer">`, sin `dangerouslySetInnerHTML` ni marcos externos incrustados (mitiga XSS por esquema y Reverse Tabnabbing).
- **Anti-IDOR multi-tenant (`G-A06`, `G-A11`):** Doble filtro `organization_id` (extensión Prisma + `where` explícito). Prohibido `findUnique` solo por `id`; se emplea `findFirst({ where: { id, organization_id } })` y `deleteMany({ where: { id, organization_id } })`.
- **CSRF y autorización (`architecture §8.2`, `§8.3`):** `OriginGuard` en toda mutación, sesión válida en `JwtAuthGuard` (bloquea revocadas y `pending_approval`) y `RolesGuard(Role.teacher)` en escritura.
- **Privacidad hacia terceros (`CONTEXT §10`, `G-C10`):** `rel="noreferrer"` suprime `Referer`; ningún enlace añade identificadores ni tokens en la URL; logs de `nestjs-pino` sin PII.
- **Tablets compartidas (`G-B05`, `G-C13`, `SPEC-09 RF-4`):** `NoCacheInterceptor` (`Cache-Control: private, no-store`), exclusión de `/api/v1/resources` en `Cache Storage` del Service Worker y limpieza de TanStack Query en `clearSharedDeviceSession()`.

## 9. Pruebas

| RF | Tipo de prueba | Verificación |
| --- | --- | --- |
| RF-1 | Unitaria (`shared` + `api`) e integración | `RF-1`: crea/edita con `https://`; rechaza `http:`, `javascript:`, `data:`, credenciales y `title` vacío con `400 VALIDATION_ERROR`; descarta `organization_id`/`created_at` del cliente; aplica tope 200 (`409 RESOURCE_LIMIT_REACHED`). |
| RF-2 | Integración PostgreSQL | `RF-2`: ordena `position ASC, created_at ASC, id ASC`; `PUT /resources/reorder` reasigna `0..N-1` en `$transaction` y rechaza listas incompletas, duplicadas o ajenas sin mutar datos; `DELETE` devuelve `204` o `404 RESOURCE_NOT_FOUND`. |
| RF-3 | Integración API + semilla + UI | `RF-3`: con `extra_content = false`, `student` recibe `403 EXTRA_CONTENT_DISABLED`, `StudentNav` oculta «Extra» y `/extra` muestra estado inactivo, mientras `teacher` prepara enlaces en `/contenido-extra` y activa el flag con `PATCH /feature-flags/extra_content` conservando `games`; `seed.ts` no pisa `enabled = true`. |
| RF-4 | Unitaria web (`Vitest`) + Playwright | `RF-4`: `/contenido-extra` muestra estado vacío, valida `https://` en línea, crea, edita, filtra, reordena con «Subir» / «Bajar» y borra tras confirmación invalidando TanStack Query. |
| RF-5 | Unitaria web + Playwright E2E | `RF-5`: `StudentNav` muestra `<= 5` ítems con `games` y `extra_content` activos; apertura en `<= 3` clics desde `/inicio`; alumno `A1` solo recibe recursos `A1` y `null` (`General`). |
| RF-6 | Unitaria DOM + Playwright E2E | `RF-6`: tarjetas usan `<a href="https://..." target="_blank" rel="noopener noreferrer">`, cero marcos incrustados (`embed`, `object`), cero `dangerouslySetInnerHTML` y sin PII en la URL. |
| RF-7 | Integración API + Playwright E2E | `RF-7`: listar y abrir recursos deja en `0` las nuevas filas de `Attempt`, `Review` y `ProgressEvent`, sin cambios en `/progreso` ni `/api/v1/stats/overview`. |
| RF-8 | Seguridad API + unitaria `proxy.ts` y logout | `RF-8`: `student` recibe `403 FORBIDDEN` en mutaciones; `orgB` recibe `404 RESOURCE_NOT_FOUND` sobre `orgA`; `proxy.ts` redirige roles cruzados en `/contenido-extra` y `/extra`; `no-store` activo y logout vacía `queryClient`. |
| RF-9 | Unitaria temas + `@axe-core/playwright` | `RF-9`: `🔊 Escuchar` operativo en `kids`; `0` violaciones `axe` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), controles `>= 48 × 48 px` y `:focus-visible >= 2 px` en `/contenido-extra` y `/extra` (`kids` y `teens`). |

## 10. Fuera de alcance y decisiones diferidas

- **Educaplay u otros sitios embebidos con `iframe`:** Fuera del piloto (`CONTEXT §2.4`, decisión 17); reevaluar en Fase 2 exigiría decisión en `CONTEXT §14`.
- **Analítica o tracking de clics externos:** Excluido (`pbp Etapa 10`) para no registrar navegación externa de menores.
- **Subida de PDFs o archivos propios a R2 en Contenido extra:** Diferido a Fase 2 (`architecture §5`).
- **Asignación por grupo o fechas de vigencia:** Diferido fuera del piloto; solo aplica segmentación por `level` o general (decisión 125).
- **Scraping OpenGraph / miniaturas remotas desde backend:** Excluido para evitar SSRF y rastreadores de terceros.

## 11. Preguntas abiertas

Sin pendientes `P-n` en `CONTEXT §15`. Las tres preguntas de diseño (`Q-01` a `Q-03`) fueron resueltas por el líder del proyecto el `2026-11-04` y formalizadas en `CONTEXT §14` (decisiones 124 a 126):

| # | Pregunta | Resolución adoptada | Decisión | Bloquea |
| --- | --- | --- | --- | --- |
| `Q-01` | Conmutación del flag `extra_content` y preparación previa | **Resuelta:** `/contenido-extra` permanece accesible con el flag apagado para que la profesora prepare y ordene los enlaces y luego habilite la sección mediante `PATCH /api/v1/feature-flags/extra_content`. | Decisión 124 | No |
| `Q-02` | Filtrado y creación de contenido extra por nivel | **Resuelta:** la profesora crea y filtra recursos generales (`level = null`) o por curso/nivel (`A1`–`B2`); el alumno solo recibe recursos generales más los de su `Student.level` (`RF-5`). | Decisión 125 | No |
| `Q-03` | Ordenamiento, reordenamiento y tope | **Resuelta:** orden `position ASC, created_at ASC, id ASC`, tope de 200 recursos por organización y reordenamiento atómico con `PUT /api/v1/resources/reorder` y botones «Subir» / «Bajar». | Decisión 126 | No |

**Tareas técnicas resueltas a ejecutar durante la implementación (`ENG-120` y `ENG-121`):**

| ID | Tarea del taskboard | Resolución técnica obligatoria al implementar |
| --- | --- | --- |
| `T-01` | `ENG-120`, `ENG-121` | **Corregir `apps/web/src/proxy.ts` y `proxy.spec.ts`:** sustituir en `isTeacherRoute` (línea 102) el prefijo obsoleto `/contenidos` por `/contenido-extra` (`pathname === '/contenido-extra' \|\| pathname.startsWith('/contenido-extra/')`), añadir `/extra` (`pathname === '/extra' \|\| pathname.startsWith('/extra/')`) en las rutas exclusivas de `student` (líneas 109–119) y cubrir ambos casos en `proxy.spec.ts`. |
| `T-02` | `ENG-120` | **Configurar `seed-dev.ts` sin tocar `seed.ts`:** mantener intacto `apps/api/prisma/seeds/seed.ts` (`extra_content: false`, `update: {}`, decisión 83(b)). En `apps/api/prisma/seeds/seed-dev.ts`, activar `extra_content: true` y sembrar de forma idempotente 5 recursos `https://` (`1` general con `level = null` y `1` por cada nivel `A1`, `A2`, `B1`, `B2`, posiciones `0..4`) creados por la profesora semilla. |
| `T-03` | `ENG-120` | **Reutilizar `schema.prisma` sin migración DDL:** usar la tabla `external_resources` ya existente sin añadir migración para `@@index([organization_id, position])`, dado que el tope de 200 filas por organización en 1 tenant se resuelve en `< 0,2 ms` y mantiene intacta la suite `ENG-017`. |
| `T-04` | `ENG-120`, `ENG-121` | **Adoptar TanStack Query v5 de serie (`ENG-142`):** implementar `/contenido-extra` y `/extra` directamente con `useQuery` (`['resources']`, `['feature-flags']`) y `useMutation` sobre el `queryClient` global (sin `useEffect + apiFetch`), garantizando invalidación reactiva y limpieza automática en `clearSharedDeviceSession()`. |
| `T-05` | `ENG-121` | **Integrar puerta `axe` y estado sin red (`SPEC-09`):** añadir `/contenido-extra` y `/extra` (`kids` y `teens`) a la suite `@axe-core/playwright` (`apps/web/e2e/`) y detectar `navigator.onLine === false` en `/extra` mostrando el aviso sin conexión sin usar `offline-queue.ts`. |

## 12. Registro de cambios

| Fecha      | Cambio                                                                                                                               | Motivo                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| 2026-11-04 | Creación del borrador                                                                                                                | Tarea `SPEC-10` del taskboard   |
| 2026-11-04 | Resolución de `Q-01` a `Q-03` (decisiones 124–126), definición de tareas técnicas `T-01` a `T-05` y paso de la spec a estado `Aprobada` | Aprobación del líder del proyecto |
| 2026-11-04 | Implementación integral de `ENG-120` y `ENG-121`, suite Playwright E2E y axe (8/8), 537/537 tests y paso de la spec a `Verificada`   | Verificación completa de Etapa 10 |
