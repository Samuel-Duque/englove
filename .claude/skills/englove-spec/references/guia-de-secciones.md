# Guía por sección — specs de Englove

Complementa la plantilla de `planning/sdd-process.md` §5 con lo que cada sección necesita en este proyecto. La plantilla manda en estructura y títulos; esta guía solo dice cómo rellenarla. Nada de lo que aquí se nombra se copia a la spec: se enlaza la sección de CONTEXT o architecture correspondiente y se añade solo lo que falta para implementar.

## Índice

- Cabecera y tamaño
- 1. Contexto y objetivo
- 2. Alcance
- 3. Requisitos funcionales
- 4. Reglas de negocio
- 5. Contrato de API
- 6. Modelo de datos
- 7. Interfaz
- 8. Seguridad y privacidad
- 9. Pruebas
- 10. Fuera de alcance y decisiones diferidas
- 11. Preguntas abiertas
- 12. Registro de cambios

## Cabecera y tamaño

Título: `# SPEC-NN — Título de la capacidad`, con raya (—) y el nombre de la capacidad de sdd-process §4 y §7.

| Campo | Cómo rellenarlo |
|---|---|
| Estado | `Borrador` al crear. Valores y transiciones: sdd-process §6 |
| Etapa | La etapa que **implementa** la spec (la de sus tareas `ENG`), no la etapa en que se redacta. Formato `N — nombre`, con el nombre del encabezado de la etapa en pbp §4 sin la referencia entre paréntesis: `1 — Scaffold`, `2 — Identidad y roles` |
| Tareas | Las tareas `ENG` cuya columna Spec en el taskboard es esta spec. Se admite un rango (`ENG-010 a ENG-019`) si las incluye todas |
| Referencias | Secciones concretas, no documentos enteros: `CONTEXT §4, §4.1, §10 · architecture §7.1, §8.2, §8.3 · decisiones 58, 59, 62` |
| Aprobada por / fecha | `—` hasta que el líder apruebe |

Tamaño: la spec se lee en menos de 20 minutos (sdd-process §3; el script avisa por encima de unas 4.000 palabras, sin contar la sintaxis de las tablas). Si se pasa, primero se recortan las repeticiones de CONTEXT o architecture. Si aun así no cabe, se **propone** al líder dividirla con sufijo (`SPEC-05a`, `SPEC-05b`, sdd-process §4) por subcapacidad, no por capa técnica. La división cambia el taskboard (la tarea `SPEC-NN` y la columna Spec de sus `ENG`) y el índice, así que no se hace sin su visto bueno.

## 1. Contexto y objetivo

- Dos o tres párrafos: qué problema resuelve, para quién (la profesora; el alumno Kids de 7 a 10 años o Teens de 11 en adelante) y por qué en esta etapa. Si la etapa cierra un hito (H1–H4, pbp §2.3), dilo.
- Enlaza las secciones de CONTEXT que lo motivan; no las resumas en extenso.

## 2. Alcance

- **Incluye:** lista breve de capacidades; sale del mapa de trazabilidad.
- **No incluye (y dónde se cubre):** cada exclusión con su destino: otra `SPEC-NN`, Fase 2 o 3 (CONTEXT §2.2 y §2.3) o CONTEXT §2.4. Incluye sobre todo lo tentador para esta capacidad (por ejemplo, tiempo real → polling cada 30 s).

## 3. Requisitos funcionales

- Cada RF empieza en su propia línea, fuera de una viñeta, con el identificador en negrita (`**RF-n — Título.**`) o como encabezado (`### RF-n — Título`). Así el script lo distingue de una simple mención a otro RF.
- Numeración `RF-1`, `RF-2`… sin saltos. Las pruebas y los PR citan el número (sdd-process §8), así que en una spec ya Aprobada no se renumera: los RF nuevos se añaden al final y los retirados se marcan como tales y se anotan en el registro de cambios.
- Cada RF lleva al menos un criterio con las palabras clave en negrita, como en la plantilla (`**Dado** … **Cuando** … **Entonces** …`), y resultado observable: código HTTP y `code`, estado persistido, correo enviado (plantillas de ENG-019), texto visible. Nunca "funciona correctamente".
- Valores concretos con su fuente: "10 intentos fallidos → bloqueo de 10 minutos (decisión 23)".
- Un RF por comportamiento. Si el criterio necesita "y además", probablemente son dos RF.
- Casos negativos que casi toda capacidad necesita: rol no autorizado (`403`), recurso de otra organización o fuera del grupo vigente (`404`, architecture §4.3 y §7), entrada inválida (validación de DTO), límite de peticiones (`429 RATE_LIMITED`) si el endpoint figura en architecture §8.3.

Ejemplo de forma (los valores salen de architecture §7.5 y de las decisiones 44 y 60):

```markdown
**RF-4 — No se inicia un intento después del cierre efectivo.**
El servidor decide con su propio reloj si una petición de inicio llega a tiempo (decisiones 44 y 60; architecture §7.5).

- **Dado** un alumno con membresía vigente en el grupo de una asignación cuyo cierre efectivo ya pasó y sin un nuevo intento habilitado
  **Cuando** envía `POST /api/v1/assignments/:id/attempts`
  **Entonces** recibe `409` con `code` `ATTEMPT_CLOSED`, no se crea ningún `Attempt` y el portal muestra el mensaje de cierre de architecture §3.6.
```

## 4. Reglas de negocio

- Lo que cruza varios RF: cálculos (escala 0,0–5,0 con un decimal y su conversión, architecture §4.4), estados y transiciones (con un diagrama `stateDiagram` de mermaid si hay más de tres estados), límites, umbrales y plazos (cierre efectivo, tolerancia de 24 h).
- Cada regla cita su decisión. Si algo es **Propuesto** (un P-n o un detalle Propuesto de architecture §14), márcalo así y enlaza su pregunta en la sección 11.

## 5. Contrato de API

Por cada endpoint:

- **Método y ruta** con el prefijo `/api/v1` (architecture §13), **roles** autorizados (`teacher`, `student`; `parent` y `admin` no tienen pantallas en el piloto) y guards (architecture §4.3).
- **Entrada:** campos con tipo y validación. El tenant sale del JWT (`org`, architecture §4.3); no se pide en el cuerpo. Ningún DTO acepta `score` (decisiones 24 y 72) ni marcas de tiempo (`started_at`, `finished_at`, `graded_at`, `occurred_at` o equivalentes, decisión 37); las únicas fechas de entrada son los plazos de negocio que elige la profesora (architecture §6.2).
- **Respuesta:** forma del JSON; calificaciones con un decimal (`4.5`); fechas ISO-8601 en UTC (architecture §13). La respuesta al alumno nunca incluye `answer_key` (decisión 75, architecture §5.3).
- **Errores:** `{ statusCode, code, message }` con `code` del catálogo de architecture §13 y sin datos técnicos internos. Si hace falta un `code` nuevo, defínelo con el mismo estilo (`MAYUSCULAS_CON_GUION_BAJO`) y señálalo en el informe final para que se añada al catálogo.
- **Endpoints públicos:** respuesta uniforme que no revele si un correo existe (decisión 59).
- **Rate limiting:** el límite de architecture §8.3 si aplica.
- **Esquema Zod:** enlaza el de `packages/shared` cuando exista. Antes, describe los campos en la spec: el esquema se deriva de esta sección (sdd-process §8).
- Paginación por `offset` y `limit` (architecture §13).

## 6. Modelo de datos

- Solo tablas y columnas nuevas o modificadas respecto de architecture §6 (o de `schema.prisma` cuando exista, que es la referencia del detalle, sdd-process §8). Si la spec usa entidades sin cambiarlas, dilo y enlaza su definición.
- Por cada cambio: tipo, nulabilidad, enum (architecture §6.3), índices (§6.5), `onDelete` de cada clave foránea (§6.2, decisión 80), `organization_id` en toda tabla de tenant, marcas de tiempo con valor del servidor.
- Migración con Prisma Migrate, nunca `db push` (CONTEXT §6). Los índices únicos parciales que Prisma no expresa van en SQL dentro de la migración.
- Reglas de la decisión 67 que se olvidan con facilidad: la nota vive solo en `Attempt.score` y `Attempt.graded_at`; `answer_key` va en columna propia y omitida por defecto; un alumno tiene una sola membresía de grupo vigente; el nombre vive en `User.name`; toda tarea periódica registra su ejecución en `ScheduledJobRun`.
- Si el cambio contradice architecture §6, para: primero una decisión nueva.

## 7. Interfaz

- Pantallas por ruta (architecture §3.1) con sus estados vacío, cargando, error y éxito.
- Navegación y número de clics desde `inicio`, sin contar el login, dentro del techo de cada zona (architecture §3.1; las actividades asignadas quedan a 2 clics).
- Diferencias Kids, Teens y panel de la profesora: tono, densidad, celebración y mensajes de error (architecture §3.6). Los alumnos de 7 a 10 años solo ven Kids; los de 11 en adelante pueden alternar.
- Textos clave ya redactados en español de Colombia, incluido el mensaje de cada `code` de error que pueda ver el usuario, sin detalles técnicos.
- Prioridad de dispositivo: el alumno usa sobre todo tablet y smartphone táctiles; la profesora, computador.
- Accesibilidad que toca a la pantalla (architecture §10.3).
- Sin mockups de alta fidelidad: estados y flujos (sdd-process §3). El diseño visual vive en los tokens y el prototipo (ENG-007, ENG-008).
- Si la capacidad no tiene interfaz, "No aplica" y por qué.

## 8. Seguridad y privacidad

- Guards por endpoint (`JwtAuthGuard` → `RolesGuard` → `TenantContext`, architecture §4.3) y cómo se filtra por `organization_id`.
- Datos de menores que se tocan (fecha de nacimiento, datos de contacto del acudiente, respuestas, audios) y quién puede verlos.
- Qué no se registra en logs ni en reportes de error (architecture §8.5): nombre, correo, respuestas, audio, contraseñas y tokens; solo identificadores.
- Archivos: bucket privado de R2 y URLs firmadas de corta duración emitidas tras verificar el derecho de acceso (architecture §7.6).
- Operaciones administrativas sobre datos sensibles del alumno: `AuditLog` y revocación de sesiones (decisión 63).
- Ningún módulo, campo ni pantalla de consentimiento legal de menores (CONTEXT §9, decisión 36). Si la capacidad parece pedirlo, va a la sección 10 como excluido.
- Enlaza las filas que apliquen del mapa de controles de architecture §8.1.

## 9. Pruebas

- Tabla `RF → nivel → nombre de la prueba`, con nombres trazables `RF-n: …` (sdd-process §8). Cada RF tiene al menos una prueba y se cita por su número: no se aceptan rangos como "RF-1 a RF-25" (el script los ignora a propósito).
- Unitarias para lógica pura (scorers, conversión a 0,0–5,0, rachas, cierre efectivo); integración para guards, tenant, cascada y consultas; E2E solo si la spec cierra uno de los tres flujos de CONTEXT §11.2 (SPEC-04, SPEC-05 y SPEC-07, sdd-process §8).
- Pruebas en dispositivo real cuando aplique (`MediaRecorder` en iOS Safari, tablet Android de gama media o baja; architecture §12).
- Una prueba que no corresponde a ningún RF indica un RF que falta o una prueba que sobra.

## 10. Fuera de alcance y decisiones diferidas

- Lo que se dejó fuera a propósito y dónde se retoma: otra `SPEC-NN`, Fase 2 o 3, o "no se construye" por CONTEXT §2.4.
- Las exclusiones por decisión citan su número (por ejemplo, consentimiento legal: decisión 36).

## 11. Preguntas abiertas

Tabla recomendada:

```markdown
| # | Pregunta | Propuesta vigente | Responsable | Fecha límite | Bloquea |
|---|---|---|---|---|---|
| P-4 | Retención, consulta y acceso de `AuditLog` | (Propuesto) La propuesta vigente de CONTEXT §15, enlazada | Líder del proyecto | Antes de aprobar SPEC-03 | RF-n |
```

- Los P-n asignados a esta spec (CONTEXT §15) figuran siempre en una fila propia con su propuesta vigente marcada **Propuesto** en esa misma fila, responsable "líder del proyecto", fecha "antes de aprobar SPEC-NN" (o una fecha concreta) y los RF que bloquean.
- Los P-n asignados a otra spec que esta materializa también figuran, con su propuesta marcada **Propuesto**, "No" en Bloquea y una nota de qué cambiaría aquí si la propuesta cambia. Por ejemplo, P-4 en SPEC-01 por el `onDelete` de `AuditLog` (architecture §6.2).
- Las preguntas propias de la spec siguen el mismo formato.
- Sin preguntas: "Ninguna a la fecha de esta versión". Una spec no pasa a Aprobada con preguntas que bloqueen un RF.

## 12. Registro de cambios

```markdown
| Fecha | Cambio | Motivo |
|---|---|---|
| AAAA-MM-DD | Creación del borrador | Tarea SPEC-NN del taskboard |
```

Toda modificación posterior, incluido cada cambio de estado, añade una fila.
