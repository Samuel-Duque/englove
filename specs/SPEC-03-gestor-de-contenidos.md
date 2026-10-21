# SPEC-03 — Gestor de contenidos

| Campo | Valor |
| --- | --- |
| Estado | Borrador |
| Etapa | 3 — Gestor de contenidos |
| Tareas | ENG-030, ENG-031, ENG-032, ENG-033, ENG-034, ENG-035, ENG-036, ENG-037, ENG-038, ENG-040, ENG-041, ENG-043, ENG-044, ENG-045, ENG-046 |
| Referencias | CONTEXT §4.1, §5.1, §5.3, §14–§16 · architecture §3.1–§3.2, §4.1–§4.4, §5.1–§6.5, §7.2–§7.3, §8, §13 · pbp §3 y Etapa 3 · decisiones 20, 24, 33, 37, 42, 45–47, 59, 63, 66, 67, 70, 73, 75, 79–80, 83, 89–94 |
| Aprobada por / fecha | — |

## 1. Contexto y objetivo

La profesora necesita cargar contenido real antes de que entren los alumnos ([CONTEXT §5.1](../.agents/CONTEXT.md#51-panel-de-la-profesora-se-construye-primero)). Esta capacidad entrega el gestor de los cinco tipos de actividad y las cinco mecánicas de juego, junto con grupos y gestión visual de alumnos. Cierra **H1: la profesora puede crear contenido**, previa validación en staging y onboarding sin ayuda.

Reutiliza identidad, consultas de alumnos y correo de [SPEC-01](./SPEC-01-scaffold.md) y [SPEC-02](./SPEC-02-identidad-y-sesion.md). No entrega todavía la experiencia jugable ni el ciclo de calificación. Las propuestas de §11 no son decisiones aprobadas.

## 2. Alcance

- Incluye: esquemas completos, formularios, catálogo, publicación, duplicación/versionado, archivo/borrado permitido, grupos/membresías, solicitudes, bloqueados, recordatorios y cambio administrativo de correo.
- No incluye: asignaciones (SPEC-04), renderizador/vista previa interactiva, intentos, multimedia y baja general de alumnos (SPEC-05), ejecución/scorers de microjuegos (SPEC-06), revisión (SPEC-07), correo periódico de pendientes/estadísticas (SPEC-08), PWA/offline (SPEC-09) ni contenido extra (SPEC-10).
- Aplican las exclusiones de [CONTEXT §2.4](../.agents/CONTEXT.md#24-explícitamente-fuera-del-piloto--decidido). ENG-039 pertenece a SPEC-05; ENG-042 está eliminada. Redactar SPEC-04/05 no autoriza implementarlas.

## 3. Requisitos funcionales

**RF-1 — Catálogo y acceso al panel.** ENG-033; architecture §3.1.

- **Dado** una profesora **Cuando** abre actividades **Entonces** ve lista paginada, filtros combinables por nivel/tipo/estado y cinco opciones de creación; «Microjuego» despliega después sus cinco mecánicas. El detalle muestra resumen textual, no reproducción.

**RF-2 — Persistencia y contratos compartidos.** ENG-030/031/032; decisiones 66 y 75.

- **Dado** contenido válido de §5 **Cuando** guarda **Entonces** recibe `201` al crear o `200` al editar y se persisten base y exactamente un detalle del tipo correcto, atómicamente. Una entrada inválida devuelve `400 VALIDATION_ERROR` sin cambios parciales.

**RF-3 — Fill in the blanks.** ENG-034; CONTEXT §5.1.

- **Dado** oraciones con huecos y opciones **Cuando** guarda y vuelve a abrir **Entonces** conserva identificadores, texto, opciones y selección correcta por hueco. Referencias inexistentes, opciones duplicadas o claves incompletas se rechazan; la configuración pública no identifica la solución.

**RF-4 — Pregunta abierta.** ENG-035; CONTEXT §5.1.

- **Dado** una consigna y criterios/límite opcionales **Cuando** guarda **Entonces** conserva `open_question` sin clave ni nota automática; los criterios son texto pedagógico público, no una respuesta correcta oculta.

**RF-5 — Speaking.** ENG-036; decisión 47.

- **Dado** el formulario **Cuando** guarda **Entonces** exige consigna, mínimo fijo de 2 s y máximo entero 2–300 s, predeterminado 120. Rechaza 1/301 y mínimo distinto de 2; acepta 2/120/300. El ejemplo opcional exige HTTPS; no graba ni sube archivos aquí.

**RF-6 — Cinco mecánicas editables.** ENG-030/037; CONTEXT §5.3.

- **Dado** cada mecánica **Cuando** usa su plantilla editable y guarda **Entonces** recibe configuración y clave validadas por su esquema de §5, sin editar JSON. El registro define respuestas y fórmula de §4; aún no ejecuta el juego ni su scorer.

**RF-7 — Examen guardable antes de completarlo.** ENG-038; decisiones 45 y 70.

- **Dado** un examen con cero/un ítem válido **Cuando** guarda como borrador **Entonces** se guarda; **Cuando** intenta publicar **Entonces** recibe `409 EXAM_MIN_ITEMS`. Con dos ítems válidos puede publicarlo. Solo admite oraciones `fill_blank`, reutilizando el editor de RF-3.

**RF-8 — Pesos efectivos y omisiones.** ENG-030/032/038; decisiones 45–46.

- **Dado** pesos 30/30/30 **Cuando** guarda **Entonces** persiste/devuelve 33.3/33.3/33.4; el formulario muestra 33,3/33,3/33,4 y anuncia el ajuste. El contrato de corrección conserva todos los pesos: un ítem omitido aporta cero, no reduce el denominador. Casos extremos: Q-03.

**RF-9 — Publicación consistente.** ENG-032; architecture §4.4 y §6.4.

- **Dado** un borrador **Cuando** publica **Entonces** revalida contenido completo y cambia a `published` en una transacción; repetir no crea versión. Editar una publicada sin intentos exige conservar requisitos de publicación: no permite reducir un examen a un ítem.

**RF-10 — Historia inmutable y duplicación.** ENG-032; architecture §6.4.

- **Dado** actividad con algún intento **Cuando** intenta editarla **Entonces** recibe `409 ACTIVITY_HAS_ATTEMPTS`, sin alterar asignaciones. Duplicar crea nueva fila `draft`, `version = origen.version + 1`, `parent_id = origen.id`, detalle copiado e ID nuevo. La versión original permanece intacta.

**RF-11 — Archivo y borrado seguro.** ENG-032; architecture §6.2.

- **Dado** una actividad **Cuando** la archiva **Entonces** pasa a `archived` conservando relaciones; repetir es inocuo. Borrar un borrador sin asignaciones ni versiones hijas devuelve `204` y elimina su detalle; los demás casos devuelven `409 ACTIVITY_DELETE_NOT_ALLOWED`. Efecto sobre asignaciones existentes: Q-01.

**RF-12 — Grupos e historial.** ENG-040; decisiones 73 y 79–80.

- **Dado** una profesora **Cuando** crea/renombra/lista un grupo **Entonces** conserva nombre y estado, sin código de aula. Borrar sin membresías ni asignaciones devuelve `204`; con historia, `409 GROUP_HAS_HISTORY`. Archivar conserva historia; requisitos sobre miembros vigentes: Q-02.

**RF-13 — Cambio de grupo atómico.** ENG-040; decisiones 73 y 90.

- **Dado** alumno aprobado **Cuando** cambia a otro grupo propio activo **Entonces** cierra la membresía anterior y abre una nueva con el mismo instante del servidor, sin intervalo sin grupo. Repetir el destino vigente no añade historia. Destino archivado da `409 GROUP_ARCHIVED`; ajeno, `404 NOT_FOUND`; pendiente, `409 STUDENT_NOT_APPROVED`.
- **Dado** dos traslados concurrentes **Cuando** terminan **Entonces** quedan serializados, con exactamente una membresía vigente e historial íntegro. Los intentos anteriores no se borran ni cambian de asignación; su lectura/finalización dentro de plazo se verificará también en SPEC-05.

**RF-14 — Edición y recuperación de alumnos.** ENG-041; SPEC-02 RF-9/RF-11.

- **Dado** ficha propia **Cuando** edita nombre/nacimiento/nivel/contactos **Entonces** usa el contrato existente; corregir nacimiento aplica sus reglas de segmento, no una preferencia arbitraria. «Enviar enlace de recuperación» confirma la solicitud de envío al alumno, sin mostrar enlace, token ni contraseña.

**RF-15 — Solicitudes de registro.** ENG-044; SPEC-02 RF-10.

- **Dado** solicitud pendiente **Cuando** aprueba desde el panel **Entonces** exige nivel y un único grupo activo, permite correcciones autorizadas y actualiza listas/contador tras éxito; el alumno puede entrar y se solicita `approved`. Rechazar exige confirmación, borra solo pendientes y actualiza listas; un conflicto refresca sin repetir la operación.

**RF-16 — Bloqueados.** ENG-041; SPEC-02 RF-5.

- **Dado** bloqueo vigente según servidor **Cuando** abre «Bloqueados» **Entonces** lista solo alumnos propios bloqueados; «Desbloquear» actúa en un clic y retira la fila tras `204`. Un bloqueo vencido no se muestra aunque el cron no haya corrido.

**RF-17 — Recordatorios sin estadísticas.** ENG-045; decisión 42, architecture §4.5.

- **Dado** solicitudes pendientes **Cuando** carga inicio **Entonces** muestra cantidad/enlace reales y umbral de configuración, incluso con `games` apagado. Hasta ENG-090/SPEC-07, `overdueReviews = 0` y tarjeta «Revisión disponible próximamente», sin enlace activo, aunque existan intentos. PendingSummaryService reserva esa categoría; en SPEC-07 contará `pending_review` con `Assignment.due_at < now() − N días`. No añade flag ni envía correo.

**RF-18 — Confirmación de cambio administrativo.** ENG-046; decisión 63.

- **Dado** ficha del alumno **Cuando** abre «Cambiar correo de acceso» **Entonces** ve correo actual/nuevo y casilla desmarcada «Confirmo que verifiqué la identidad del alumno». Solo al confirmar envía `newEmail`; la lista no ofrece este atajo. Igual al correo actual da `400 VALIDATION_ERROR`.

**RF-19 — Cambio, auditoría y revocación.** ENG-046; architecture §7.3.

- **Dado** correo nuevo disponible **Cuando** confirma la profesora **Entonces** una transacción cambia correo normalizado, inserta un `AuditLog` con actor/alumno/correos, invalida recuperaciones y solicitudes OTP pendientes y revoca todas las sesiones del alumno. Con correo ocupado en cualquier tenant, incluso por carrera, devuelve `409 EMAIL_TAKEN` sin efectos parciales. Conserva contraseña.
- **Dado** recuperación, OTP, login o refresh concurrentes **Cuando** cambia el correo **Entonces** ninguna lectura previa puede emitir después credenciales válidas para el correo anterior ni eludir la revocación; coordina por usuario y revalida dentro de la operación.

**RF-20 — Notificaciones posteriores al cambio.** ENG-046; SPEC-01 §5.

- **Dado** cambio confirmado **Cuando** termina la transacción **Entonces** solicita `email-changed` a nuevo y anterior con claves opacas distintas; un fallo de entrega no revierte ni repite el cambio ni impide intentar el otro envío. Resultado sanitizado; no garantiza entrega durable. Una petición repetida con el correo ya actual no inserta auditoría ni reenvía avisos.

**RF-21 — Autorización, validación y privacidad.** Todas las tareas técnicas; CONTEXT §16.

- **Dado** cualquiera de las rutas de §5 **Cuando** falta sesión/rol/tenant válido **Entonces** recibe 401/403/404 según §8, sin efectos ni datos ajenos. Extras HTTP de tenant/autor/tiempo/nota se ignoran; contenido de actividad se valida con Zod. Exceso HTTP da 413/429; logs y reportes no contienen datos personales ni claves.

**RF-22 — Estados y teclado.** ENG-033/034/035/036/037/038/040/041/044/045/046.

- **Dado** cada pantalla de §7 **Cuando** carga, está vacía, falla o guarda **Entonces** presenta el estado previsto, mantiene datos editados ante error y no duplica envíos. Etiquetas, foco visible, navegación por teclado y errores anunciados permiten completar formularios y diálogos sin ratón.

**RF-23 — Onboarding verificable.** ENG-043; pbp Etapa 3.

- **Dado** la profesora real, sesión iniciada y formularios vacíos **Cuando** crea su primera actividad sin ayuda **Entonces** termina en menos de 10 minutos; además crea una de cada tipo sin ayuda. Si falla, se iteran formularios y se repite antes de cerrar H1, con evidencia sin datos de alumnos.

## 4. Reglas de negocio

Ciclo permitido: `draft → published → archived`, también `draft → archived`; sin restauración/despublicación. Duplicar cualquier estado produce borrador. Solo se edita en sitio sin intentos y fuera de `archived`; `type`/mecánica no cambian al editar. Archivo no equivale a borrado. Q-01/Q-02 bloquean sus efectos todavía no decididos.

**Normalización:** examen vacío conserva `[]`; no tiene denominador. Con ítems, pesos finitos ≥0 y suma >0. `peso × 100 / suma`, redondeo decimal a un decimal, residuo en el último ítem (architecture §4.4); devolver `weightsAdjusted` si cambió algún peso. Sin cambiar orden ni borrar ítems de peso cero. Q-03 resuelve el caso de residuo negativo, sin dar por aprobado otro algoritmo.

**Contrato de corrección para etapas posteriores:** fracción 0–1; servidor convierte con `round(fracción × 5, 1)` (decisión 24). Identificadores desconocidos, repeticiones imposibles y referencias inválidas no suman aciertos; son entradas inválidas. Omitidas/timeout aportan cero. Sin premio por rapidez ni nota declarada por cliente. Propuesta pedagógica concreta para revisión al aprobar esta spec:

| Tipo/mecánica | Unidad y fracción; respuestas de §5 |
| --- | --- |
| `fill_blank` | Huecos correctos / huecos totales; comparar IDs exactos de opción |
| `exam` | Suma de fracción de cada oración × su peso / 100, incluidas omitidas |
| `match` | Emparejamientos correctos / elementos izquierdos totales; una selección final por elemento |
| `order_words` | Tokens cuyo texto coincide con la posición esperada / total; IDs distintos identifican ocurrencias, pero intercambiar textos idénticos no penaliza |
| `drag_drop` | Objetos en destino correcto / objetos totales; una ubicación final por objeto |
| `memory` | Parejas encontradas / (parejas totales + selecciones fallidas); reconstruir secuencia, sin aceptar contadores del cliente; pareja resuelta no vuelve a seleccionarse |
| `timed_choice` | Preguntas correctas / preguntas totales; selección final o null por pregunta; temporizador por pregunta, sin multiplicador temporal |

La aplicación del temporizador y validación temporal de eventos se concreta en SPEC-06 sin confiar en tiempos enviados por cliente; aquí se fija contenido/fórmula, no la ejecución. `open_question`/`speaking` requieren revisión manual, sin clave.

Duraciones por defecto `expectedDurationSeconds / minPlausibleSeconds`: fill_blank 60/3, open_question 180/3, speaking máximo configurado/2, game 120/3, exam `60 × max(1, ítems)` / `3 × max(1, ítems)`. Overrides enteros 1–2147483647; null usa default. Validar mínimo ≤ duración esperada tras resolver defaults (decisión 79).

## 5. Contrato de API

Prefijo completo **`/api/v1`** en todas las rutas de esta sección; acceso exclusivamente `teacher`, guards JWT → roles → tenant. JSON camelCase; IDs UUID; `organization_id`, autor, versión y tiempos salen del servidor. DTO HTTP con whitelist/transform; contenido validado mediante esquemas compartidos de [activities](../packages/shared/src/activities/registry.ts), completados por ENG-030. No aceptar JSON arbitrario como configuración.

### Contenido canónico

Textos recortados, sin HTML; título/nombre de grupo 1–100 caracteres, consigna/oración 1–5000, instrucciones/criterios opcionales hasta 2000, etiquetas/opciones 1–200. Arrays de contenido hasta 100 elementos; opciones 2–20 por pregunta/hueco. Respuestas parciales/vacías permitidas; las secuencias de juego no heredan ese máximo, solo límites HTTP. IDs internos UUID estables, únicos dentro del documento y sin significado de solución. Opciones con textos distintos tras recorte. IDs/clave deben corresponder exactamente; no claves sobrantes. Listas vacías solo donde se permite expresamente.

| Tipo | `config` | `answerKey` / respuestas futuras |
| --- | --- | --- |
| `fill_blank` | `{ instructions?, items: [{ id, prompt, blanks: [{ id, options: [{ id, text }] }] }] }`; ≥1 oración/hueco; `prompt` usa `{{blankId}}` exactamente una vez por hueco, sin marcadores huérfanos | `{ items: { [itemId]: { [blankId]: optionId } } }`; respuestas con igual estructura parcial; ausencia = omitida |
| `open_question` | `{ prompt, rubric?, maxLength? }`; límite entero 1–10000, default 2000; rubric pública | Sin clave; respuestas `{ text }`, hasta límite |
| `speaking` | `{ prompt, exampleUrl?, minDurationSeconds: 2, maxDurationSeconds: 120 }`, rango RF-5; exampleUrl HTTPS o ausente | Sin clave; grabación/entrega en SPEC-05 |
| `exam` | `{ instructions?, items: [{ id, prompt, blanks, weight }] }`; reutiliza oración anterior, permite 0/1 en borrador; al publicar ≥2 | Mapa `items[itemId][blankId] = optionId`; respuestas parciales, misma estructura |
| `game` | `{ mechanic, instructions?, settings }`; unión discriminada siguiente | `{ solution }` según mecánica; nunca un diccionario sin validar |

| Mecánica | `settings` | `solution` y respuestas futuras |
| --- | --- | --- |
| `match` | `{ left: [{ id, text }], right: [{ id, text }] }`; tamaños iguales ≥2 | `{ pairs: { [leftId]: rightId } }`, biyectiva; respuestas `{ pairs }` parcial |
| `order_words` | `{ tokens: [{ id, text }] }`; ≥2 | `{ tokenIds: string[] }`, permutación completa; respuestas `{ tokenIds }`, sin duplicados, parcial permitida |
| `drag_drop` | `{ objects: [{ id, text }], targets: [{ id, text }] }`; ambos ≥2 | `{ placements: { [objectId]: targetId } }`; cada objeto tiene destino, se permite compartirlo; respuestas `{ placements }` parcial |
| `memory` | `{ cards: [{ id, text }] }`; cantidad par ≥4 | `{ pairs: [[cardId, cardId]] }`, partición completa en pares distintos; respuestas `{ selections: [[cardId, cardId]] }`, secuencia de selecciones |
| `timed_choice` | `{ timeLimitSeconds, questions: [{ id, prompt, options: [{ id, text }] }] }`; ≥1 pregunta; tiempo entero 5–120 s/default 20 por pregunta | `{ choices: { [questionId]: optionId } }`; respuestas `{ choices }`, parcial/null para timeout |

Clave obligatoria en fill_blank/exam/game y prohibida en los demás. `config` no guarda `answerKey`, `correct` ni posiciones que codifiquen soluciones; orden/IDs de opciones y tokens no delatan la clave. `toPublicConfig()` construye proyección validada sin solución en fill_blank/exam; no modifica entrada ni usa aserciones ciegas. Solo editor docente selecciona explícitamente `answer_key`; game permite incorporarla expresamente al runtime futuro (architecture §5.3).

### Recursos y operaciones

`ActivitySummary = { id, title, type, level, status, version, parentId, createdAt, updatedAt }`. `ActivityEditor = Summary + { expectedDurationSeconds, minPlausibleSeconds, config, answerKey?, weightsAdjusted }`; duraciones nullable; weightsAdjusted es booleano de respuesta, false al consultar. `GroupView = { id, name, archivedAt, activeStudentCount }`. Listas `{ items, total, offset, limit }`: offset ≥0/default 0; limit 1–100/default 20; actividades `updated_at DESC, id ASC`; grupos `name ASC, id ASC`.

| Método/ruta relativa | Entrada | Éxito / error propio |
| --- | --- | --- |
| `GET /activities` | offset/limit, `level?`, `type?`, `status?`; sin filtro incluye todos los estados | `200` lista de Summary, sin claves |
| `GET /activities/:id` | Sin cuerpo | `200 ActivityEditor` |
| `POST /activities` | `{ title, type, level, config, answerKey?, expectedDurationSeconds?, minPlausibleSeconds? }` | `201 ActivityEditor`, draft/versión 1/parent null |
| `PATCH /activities/:id` | ≥1 campo editable, sin type; config/clave juntas cuando aplica, reemplazo completo validado | `200 ActivityEditor`; `409 ACTIVITY_HAS_ATTEMPTS` o `ACTIVITY_NOT_EDITABLE` |
| `POST /activities/:id/publish` | Sin cuerpo | `200 ActivityEditor`; `409 EXAM_MIN_ITEMS` o `ACTIVITY_NOT_EDITABLE` |
| `POST /activities/:id/duplicate` | Sin cuerpo; título inicial `Copia de …`, truncado a 100 | `201 ActivityEditor` |
| `POST /activities/:id/archive` | Sin cuerpo | `200 ActivityEditor`; Q-01 |
| `DELETE /activities/:id` | Sin cuerpo | `204`; `409 ACTIVITY_DELETE_NOT_ALLOWED` |
| `GET /groups`, `GET /groups/:id` | Lista offset/limit, `archived?` boolean; ausente incluye ambos | `200` lista / GroupView |
| `POST /groups`, `PATCH /groups/:id` | `{ name }` | `201` / `200 GroupView`; renombrar archivado: `409 GROUP_ARCHIVED` |
| `POST /groups/:id/archive` | Sin cuerpo; repetición inocua | `200 GroupView`; Q-02 |
| `DELETE /groups/:id` | Sin cuerpo | `204`; `409 GROUP_HAS_HISTORY` |
| `GET /groups/:id/members` | offset/limit; vigentes; orden de SPEC-02 | `200` lista StudentView de SPEC-02 |
| `GET /students/:id/memberships` | offset/limit; orden joined_at DESC, id ASC | `200` lista `{ id, groupId, groupName, joinedAt, leftAt }` |
| `PUT /students/:id/group` | `{ groupId }` | `200 StudentView`; `409 GROUP_ARCHIVED` / `STUDENT_NOT_APPROVED` |
| `GET /dashboard/reminders` | Sin cuerpo | `200 { pendingRegistrations, overdueReviews, ungradedReminderDays }`, enteros ≥0, umbral positivo |
| `POST /students/:id/change-email` | `{ newEmail }`, normalización/límite de SPEC-02 | `200 { message: "Correo actualizado. El alumno debe iniciar sesión de nuevo." }`; `409 EMAIL_TAKEN` |

Alumnos/solicitudes/bloqueados/recuperación mantienen exactamente [SPEC-02 §5](./SPEC-02-identidad-y-sesion.md#5-contrato-de-api), sin nueva alta ni baja. Fechas UTC ISO-8601; visualización Bogotá. Error `{ statusCode, code, message }`; comunes: 400 VALIDATION_ERROR, 401 AUTH_UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 413 PAYLOAD_TOO_LARGE, 429 RATE_LIMITED con Retry-After, 500 INTERNAL_ERROR. Límite autenticado 120/min/usuario, JSON 1 MB y no-store (SPEC-02 RF-16).

## 6. Modelo de datos

Se reutiliza [schema.prisma](../apps/api/prisma/schema.prisma): las cinco tablas de detalle, Group/Membership y AuditLog **ya existen** por SPEC-01. ENG-031 verifica correspondencia y migra solo diferencias necesarias; no recrea tablas ni altera la migración inicial. Persistir speaking en sus columnas tipadas; resto en config/answer_key separados; mechanic de GameDetail coincide con config.mechanic.

Sin tablas/columnas/enums nuevos previstos. Conservar tenant directo, UUID, tiempos servidor, índice de catálogo, único de detalle y único parcial de membresía vigente. Relaciones/onDelete: [architecture §6.2](../planning/architecture-overview.md#62-convenciones--decidido-a7-decisiones-20-y-67). Restrict protege historia; Cascade elimina detalle al borrar borrador; AuditLog conserva SetNull y redacción para SPEC-05 (decisión 92).

Base/detalle, edición frente al primer intento, publicación/archivo, traslado/aprobación frente a archivo de grupo y cambio de correo requieren transacciones/serialización, no comprobaciones separadas vulnerables a carreras. Fallos revierten todo. La extensión de tenant debe conservarse también dentro de transacciones.

## 7. Interfaz

Tema neutro docente, RSC por defecto y hojas cliente; TanStack Query para API, react-hook-form y validación compartida (architecture §3.2). No crear dos páginas físicas `/inicio` colisionantes: conservar composición por rol de SPEC-02.

| Ruta | Contenido / vacío |
| --- | --- |
| `/inicio` | Solicitudes: contador/enlace; cero «No tienes solicitudes pendientes». Revisión: estado reservado de RF-17; enlace `/revision` y conteo real se activan en SPEC-07. |
| `/actividades` | Filtros, cinco tipos, «Crear actividad»; vacío «Aún no tienes actividades»; filtrado vacío «No encontramos actividades con estos filtros» |
| `/actividades/nueva`, `/actividades/:id` | Formulario por tipo/mecánica; guardar/publicar/duplicar/archivar y borrado permitido; resumen textual; duración mínima de speaking solo lectura |
| `/grupos`, `/grupos/:id` | Nombre, estado, miembros, archivo/borrado; vacío «Crea tu primer grupo para aprobar solicitudes» |
| `/alumnos`, `/alumnos/:id` | Pestañas Alumnos/Solicitudes/Bloqueados; ficha, contactos, recuperación, grupo e historial; no botón de alta/baja general |
| `/alumnos/solicitudes`, `/alumnos/bloqueados` | Vacíos «No tienes solicitudes pendientes» / «No hay alumnos bloqueados»; aprobación con selector de grupo activo y acceso a crear grupo si no hay |

Desde inicio: catálogo/solicitudes a un clic; editor/ficha a dos. Objetivos del panel, no techos del portal. Navegación solo a destinos entregados; revisión futura no es un enlace activo.

Cargando: «Cargando…»; envío: «Guardando…»; éxito: «Cambios guardados». Error de red mantiene formulario y «No pudimos guardar los cambios. Intenta de nuevo», sin reintento automático de mutaciones. Éxito invalida listas/fichas/contadores afectados; no anuncia éxito antes del servidor.

Textos: pesos «Ajustamos los pesos para que sumen 100 %»; examen «Agrega al menos dos ítems para publicar»; historial protegido «Esta actividad ya tiene intentos. Duplícala para hacer cambios»; archivo «Esta actividad está archivada. Duplícala para editarla»; grupo archivado «Este grupo está archivado. Elige uno activo»; grupo con historia «Este grupo tiene historial. Archívalo en lugar de borrarlo»; correo ocupado «Ese correo no está disponible». Otros códigos: mensajes comunes SPEC-02 o genérico SPEC-01, nunca códigos técnicos en pantalla.

Editor de huecos inicia con sintaxis simple `[correcta|distractor|distractor]`; convierte a IDs/config/clave separados, sin exponer esta notación en config pública. Formulario de juego trae un ejemplo editable por mecánica y ayudas. Diálogos con foco contenido/restaurado y confirmaciones accesibles; contraste AA y errores asociados a campos. Sin variantes Kids/Teens en este panel.

## 8. Seguridad y privacidad

JWT/sesión actual → RolesGuard teacher → TenantContext; `organization_id` explícito y extensión Prisma en toda lectura/mutación/referencia. Sin sesión 401; otro rol 403; UUID inexistente/ajeno 404 idéntico. Incluye padres, autores, grupos, membresías y detalles; conteos tampoco cruzan tenants. Solo comprobar unicidad global de correo queda exceptuado del filtro, nunca la mutación del alumno.

Conservar Origin/CORS, cookies e higiene de logout de SPEC-02; no-store, sin caché compartida ni `use cache` autenticado. No persistir fichas/contactos en almacenamiento durable del navegador. Logs/Sentry: sin nombres, correos, nacimiento, contactos, consignas/respuestas, claves, tokens, cuerpos ni enlaces sensibles; solo IDs operativos/rol/resultado.

AuditLog guarda correos únicamente en base de datos con acceso técnico restringido; no hay API/pantalla de consulta. Borrado futuro conserva evento técnico desvinculado/redactado (decisión 92), no caducidad inventada. Enlaces de ejemplo HTTPS, sin descarga del lado del servidor ni HTML libre. Correo usa MailService existente, tras commit y sin exponer secretos; el proveedor recibe solo los datos necesarios.

## 9. Pruebas

Matriz **por implementar**, no evidencia ejecutada. Integración con PostgreSQL 18, dos tenants sintéticos, reloj controlado y MailService simulado. Pruebas de esquema/serialización además de componentes; un mock no acredita índices ni transacciones.

| RF | Nivel | Nombre / casos mínimos |
| --- | --- | --- |
| RF-1 | Componente/integración | `RF-1: filtra catálogo y distingue tipo de mecánica`; paginación, resumen |
| RF-2 | Integración | `RF-2: guarda base y detalle atómicamente`; cinco tipos, rollback, referencias inválidas |
| RF-3 | Unitaria/componente | `RF-3: edita huecos sin filtrar solución`; roundtrip, claves/IDs, opciones |
| RF-4 | Unitaria/componente | `RF-4: guarda consigna y criterios públicos`; límite, ausencia de clave |
| RF-5 | Unitaria/componente | `RF-5: valida speaking 2/120/300`; límites, mínimo fijo y HTTPS |
| RF-6 | Unitaria/componente | `RF-6: valida cinco esquemas y sus respuestas`; fórmulas, tokens repetidos equivalentes, memory vacío y >100 selecciones |
| RF-7 | Integración/componente | `RF-7: guarda examen de cero o un ítem sin publicarlo`; mínimo, tipo y claves |
| RF-8 | Unitaria/integración/componente | `RF-8: normaliza pesos y conserva omitidas`; 30/30/30, ceros, suma cero, ajuste y Q-03 |
| RF-9 | Integración | `RF-9: publica sin permitir contenido inválido por PATCH`; repetición y carreras |
| RF-10 | Integración | `RF-10: duplica versión sin modificar historia`; todos los estados, primer intento concurrente |
| RF-11 | Integración | `RF-11: archiva sin borrar historia y protege borrado`; asignación/hijo concurrente, Q-01 |
| RF-12 | Integración/componente | `RF-12: gestiona grupos sin borrar historia`; FK y Q-02 |
| RF-13 | Integración PostgreSQL | `RF-13: traslados serializados mantienen una membresía`; mismo destino, rollback, índice único, historia, intentos intactos; continuidad ejecutable en SPEC-05 |
| RF-14 | Componente/integración | `RF-14: ficha edita solo campos permitidos y solicita recuperación`; segmento y 403 |
| RF-15 | Componente/integración | `RF-15: aprueba o rechaza desde solicitudes`; login aprobado, correo, sin huérfanos, conflicto y grupo archivado concurrente |
| RF-16 | Componente/integración | `RF-16: desbloquea alumnos vigentes en un clic`; expiración sin cron, doble clic y errores |
| RF-17 | Integración/componente | `RF-17: cuenta solicitudes y reserva revisión hasta ENG-090`; con/sin intentos, N configurable, games apagado, sin enlace roto |
| RF-18 | Componente | `RF-18: exige confirmación explícita de correo`; casilla inicial, cancelar, mismo correo |
| RF-19 | Integración PostgreSQL | `RF-19: correo nuevo deja una auditoría y revoca todo`; tokens/access/refresh inválidos, rollback y carreras con recuperación/login/refresh/OTP |
| RF-20 | Integración | `RF-20: avisa a ambos correos después del commit`; fallo de cada destino, repetición sin reenvío ni doble auditoría, logs sanitizados |
| RF-21 | Integración HTTP | `RF-21: aísla cada ruta y no filtra PII`; 401/403/404, relaciones ajenas, extras, 1 MB, 120/min, Origin y no-store |
| RF-22 | Componente | `RF-22: estados y diálogos permiten teclado`; validación, foco, formularios conservados, mapas de errores |
| RF-23 | Manual staging | `RF-23: profesora crea sin ayuda en menos de diez minutos`; primera actividad y una de cada tipo |

Fixtures de corrección: total/parcial/cero/omitidas; memory dos parejas/un fallo = 2/3; intercambiar ambos `had` en «I had had enough» conserva 4/4. Se verifican contratos/ejemplos, no scorers ejecutables (SPEC-05/06). E2E crear→asignar: SPEC-04.

H1: commit/CI, contenido real, aprobación/desbloqueo en staging y acta de onboarding; escritorio/teclado y formularios en tablet/teléfono. Grabación/arrastre real: SPEC-05/06. Cierre de etapa: SPEC-04 Aprobada y SPEC-05 al menos En revisión (pbp Etapa 3).

## 10. Fuera de alcance y decisiones diferidas

Destinos en §2. Sin duplicar APIs de SPEC-02 ni adelantar scoring/multimedia para probar continuidad. Redacción de auditoría al borrar: SPEC-05/ENG-070. Excluidos: correo periódico, outbox/entrega durable, visor de auditoría, exportaciones, edición de notas, nuevos tipos/subtipos, restauración y editor visual avanzado.

Sin alta directa, contraseñas temporales, pantallas de acudientes, consentimiento legal ni CONTEXT §2.4/Fase 2–3. Flag games controla el portal, no la preparación de contenido docente.

## 11. Preguntas abiertas

Sin P-n abiertos; auditoría resuelta por decisiones 84/92. Estas preguntas requieren confirmación del líder y actualización de fuentes superiores **antes de cerrar el contrato**:

| # | Pregunta | Propuesta vigente | Responsable / fecha límite | Bloquea |
| --- | --- | --- | --- | --- |
| Q-01 | ¿Archivar actividad cancela asignaciones existentes? architecture §6.4 permite archivo, pero no define sus efectos | **Propuesto:** retira del catálogo asignable sin cancelar asignaciones ni ventanas/continuidad ya existentes; sin restauración | Líder / antes de aprobar SPEC-03 | RF-11; frontera SPEC-04/05 |
| Q-02 | ¿Puede archivarse un grupo con miembros vigentes? architecture §6.4 prohíbe recibir alumnos nuevos, no resuelve los actuales | **Propuesto:** exigir traslado previo de todos los miembros; `409 GROUP_HAS_ACTIVE_STUDENTS`. No trasladar automáticamente ni dejar aprobados sin grupo | Líder / antes de aprobar SPEC-03 | RF-12/RF-13 |
| Q-03 | ¿Cómo corregir residuos que darían un peso negativo? El redondeo y corrección solo en el último ítem de architecture §4.4 no cubre todos los casos | **Propuesto:** mayor resto en décimas, desempate desde el último ítem; conserva 33.3/33.3/33.4 para 30/30/30 y garantiza pesos no negativos con suma 100. Requiere precisar architecture antes de adoptarlo | Líder / antes de aprobar SPEC-03 | RF-8 |

Ejemplo Q-03: pesos 33.36/33.36/33.26/0.01 suman 99.99; redondear los tres primeros normalizados da 33.4/33.4/33.3 y dejar el residuo al cuarto daría −0.1. No implementar silenciosamente una política alternativa.

Concreciones para revisar al aprobar: fórmulas de juego, crédito por posición en order_words y penalización de memory, límites/defaults de contenido/duraciones, sintaxis simple de huecos y códigos nuevos `ACTIVITY_NOT_EDITABLE`, `ACTIVITY_DELETE_NOT_ALLOWED`, `GROUP_HAS_HISTORY`, `STUDENT_NOT_APPROVED`; `GROUP_HAS_ACTIVE_STUDENTS` solo propuesto. Los códigos se incorporarán al catálogo architecture §13 al confirmar el contrato.

Pendientes operativos: SPEC-02 §11, acceso/correo real en staging y profesora para ENG-043. Desajustes documentales no bloqueantes: ENG-031 dice crear tablas ya existentes; solo verificar/completar. ENG-043 enumera tres dependencias, pero la salida superior exige los cinco tipos.

## 12. Registro de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-10-21 | Creación del borrador: 23 RF, contratos, seguridad y pruebas; Q-01/Q-02/Q-03 pendientes | Redacción de SPEC-03 sin implementación ni cambios de decisiones |
| 2026-10-21 | Revisión: concurrencia de identidad, revisión reservada hasta ENG-090, tokens repetidos y límites/defaults | Corregir casos límite sin adelantar etapas |
