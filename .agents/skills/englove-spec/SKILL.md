---
name: englove-spec
description: "Redacta, revisa o actualiza las especificaciones SPEC-NN de Englove en specs/ siguiendo el proceso Spec-Driven Development del proyecto (planning/sdd-process.md): plantilla de 12 secciones, ciclo de vida, calendario de redacción, criterios Dado/Cuando/Entonces y validación contra las decisiones de CONTEXT §14, el fuera de alcance del piloto (§2.4) y los pendientes P-n de §15. Úsala siempre que haya que crear la carpeta specs/ (tarea SPEC-00), redactar o revisar cualquier spec de SPEC-01 a SPEC-10 (o con sufijo, como SPEC-05a), cambiar el estado de una spec, añadir o corregir requisitos RF, o comprobar si una tarea ENG puede empezar porque su spec está Aprobada, aunque el usuario no diga literalmente la palabra spec."
---

# englove-spec — Especificaciones SDD de Englove

Guía para redactar, revisar y mantener las specs de `specs/`. La skill **no sustituye** a los documentos del proyecto: indica qué leer, en qué orden y cómo comprobar el resultado. Si esta skill y un documento de planeación discrepan, manda el documento (y conviene corregir la skill).

## Reglas de oro

1. **Jerarquía de autoridad:** `.agents/CONTEXT.md` → `planning/architecture-overview.md` → `planning/sdd-process.md` → `planning/pbp-development.md` → `planning/taskboard.md` → `specs/` → código. Una spec nunca contradice un documento superior ni una spec Aprobada de la que depende. Si para escribirla haría falta contradecirlo, detente: primero se propone una decisión nueva en CONTEXT §14 (o en architecture §14) y la spec se escribe después. No retoques en silencio un documento superior para que encaje con la spec.
2. **Sin spec Aprobada no hay código de producción.** Si alguien pide implementar una tarea `ENG` cuya spec no está Aprobada, no empieces: dilo y ofrece redactar o completar la spec. La única excepción es un prototipo desechable, declarado como tal, para responder una pregunta abierta (sdd-process §6). En las Etapas 1 y 2 rigen además las compuertas de la decisión 65.
3. **El agente redacta; el líder del proyecto aprueba.** Puedes dejar una spec en `Borrador` o proponerla `En revisión`. Nunca la marques `Aprobada` ni rellenes "Aprobada por / fecha" sin una confirmación explícita del líder en la conversación. Tampoco des por cerrado un pendiente P-n: su propuesta vigente es **Propuesto** hasta que el líder la confirme.
4. **Enlazar, no copiar.** La spec cita `CONTEXT §x`, `architecture §y` y el número de decisión, y solo añade lo que falta para implementar: valores concretos, códigos de error, criterios verificables. Copiar párrafos crea dos fuentes que divergen (anti-patrón de sdd-process §10).
5. **Concretar sí, inventar no.** La spec debe fijar los detalles que la planeación deja implícitos para que dos implementaciones se comporten igual (sdd-process §3): textos de interfaz, `code` de error, nombres de campo, validaciones. Eso es su trabajo. Lo que no puede es añadir comportamiento o alcance que ningún documento pide (sdd-process §9): eso va a la sección 11 como pregunta abierta, con una propuesta. Las concreciones con impacto de producto (un `code` nuevo, un texto delicado) se listan en el informe final para que el líder las vea.
6. **Idioma y terminología:** la spec se escribe en español; identificadores técnicos, tablas, columnas y `code` de error en inglés (CONTEXT §16). "Tipo de actividad" solo para los cinco valores de `ActivityType`; "mecánica de juego" solo para los cinco de `GameMechanic` (decisión 66).

## Fuentes que debes leer

Léelas cada vez; no trabajes de memoria, porque los documentos cambian entre rondas.

| Fuente | Para qué |
|---|---|
| `planning/sdd-process.md` §3–§10 | Qué es una spec (§3), carpeta y nombres de archivo (§4), **plantilla obligatoria** (§5), ciclo de vida (§6), calendario y pendientes por spec (§7), relación con taskboard, pruebas y código (§8), **reglas para agentes** (§9), **anti-patrones** (§10) |
| `.agents/CONTEXT.md` §14 | Todas las decisiones, incluidas las rondas añadidas después de crear esta skill. Lee la columna Estado: una decisión Sustituida, Retirada o Modificada solo se aplica en su forma vigente; sigue la cadena hasta la última |
| `.agents/CONTEXT.md` §2.4 | Lo que no se construye en el piloto, aunque parezca fácil o rápido |
| `.agents/CONTEXT.md` §15 | Pendientes P-n, su propuesta vigente y la spec que debe cerrar cada uno |
| `.agents/CONTEXT.md` §16 y §17 | Convenciones obligatorias para agentes y glosario |
| `planning/taskboard.md` | La fila de la tarea `SPEC-NN` (alcance mínimo que la spec debe cubrir) y las tareas `ENG` cuya columna Spec es esa spec |
| `planning/pbp-development.md` §3 y §4 | Definición de Hecho y la etapa de la spec: objetivo, alcance, fuera de alcance, entregables, criterios de salida y riesgos |
| `planning/architecture-overview.md` | Las secciones de la capacidad: rutas y navegación (§3.1), estados de error (§3.6), guards (§4.3), scoring (§4.4), modelo de datos (§6), flujos (§7), seguridad (§8), convenciones y catálogo de `code` (§13) |
| `specs/README.md` y specs anteriores | Estado de las demás specs y contratos ya aprobados de los que depende la nueva |

Los documentos de cada ronda (`planning/incongruencias-y-decisiones-definitivas.md`, `planning/decisiones-para-correccion-de-planeacion.md`, `planning/decisiones-modelo-de-datos.md`) son vinculantes en lo decidido (decisiones 34, 57 y 67) y sirven para buscar detalle, pero ya están volcados en CONTEXT y architecture: la spec enlaza a estos dos.

## Elige el modo

| Situación | Modo |
|---|---|
| `specs/` no existe o le falta `README.md` o `_template.md` | **Arranque (SPEC-00)** |
| Hay que crear una `SPEC-NN` que no existe | **Redactar** |
| Hay que auditar una spec existente (antes de proponerla, antes de aprobarla o porque cambió un documento superior) | **Revisar** |
| Hay que cambiar el contenido o el estado de una spec existente | **Actualizar** |

Si el usuario pide "la spec de X" sin número, ubícala por capacidad en sdd-process §4 y §7 y en el taskboard.

### Arranque (SPEC-00)

1. Crea `specs/_template.md` con el contenido del bloque de plantilla de sdd-process §5, tal cual. Si la plantilla de §5 cambia en el futuro, `_template.md` se actualiza en el mismo cambio.
2. Crea `specs/README.md`, el **único índice** (sdd-process §4): una línea de propósito, enlaces a sdd-process §5 (plantilla), §6 (ciclo de vida) y §7 (calendario), y una tabla `| Spec | Título | Estado | Etapa | Tareas |` con una fila, enlazada, por cada spec que exista como archivo. No añadas filas para specs aún no redactadas: su calendario vive en sdd-process §7.
3. Actualiza el taskboard: SPEC-00 a Hecho, resumen y fecha del encabezado (reglas de "Cómo usar este tablero"). Si el bloque de §5 tiene algún defecto de formato (por ejemplo, la tabla del registro de cambios sin fila separadora `|---|---|---|`), corrígelo en `_template.md` y repórtalo para que se corrija también en sdd-process §5.

### Redactar una spec

**Paso 1 — Ubicar la spec.**

- ID, título y nombre de archivo según sdd-process §4: kebab-case en español, sin tildes (`SPEC-02-identidad-y-sesion.md`). Si una etapa necesita más de una spec, sufijo `SPEC-05a`, `SPEC-05b`.
- Etapa: la que **implementa** la spec, es decir, la de sus tareas `ENG` en el taskboard, que coincide con su número (SPEC-01 → Etapa 1 — Scaffold). No es la etapa en que se redacta (columna "Se redacta durante" de sdd-process §7).
- Calendario (sdd-process §7): las specs se redactan una etapa por delante de la implementación. Si piden una spec fuera de su momento, o todas de una vez, señala el anti-patrón y pide confirmación al líder antes de seguir. Redactar la spec de la etapa N+1 no autoriza a empezar su código.
- Si `specs/` no existe, haz antes el Arranque: SPEC-00 es dependencia de todas las specs en el taskboard.
- Si el archivo ya existe, pasa a Revisar o Actualizar.

**Paso 2 — Reunir el insumo, en este orden.**

1. Fila `SPEC-NN` del taskboard: cada elemento que enumera acabará en al menos un RF o una regla de negocio.
2. Tareas `ENG` cuya columna Spec es `SPEC-NN`: forman el campo Tareas de la cabecera y cada una queda cubierta por al menos un RF.
3. Etapa en pbp §4: objetivo, alcance, fuera de alcance, criterios de salida (suelen convertirse en RF verificables) y riesgos.
4. Secciones de CONTEXT y architecture que tratan la capacidad, y las decisiones de §14 que la tocan (búscalas por las entidades, endpoints y términos de la capacidad).
5. Pendientes de CONTEXT §15 que afectan a la spec. Los **asignados** a ella (columna "Se cierra antes de aprobar"; también sdd-process §7) bloquean su aprobación hasta que el líder los cierre. Los asignados a otra spec pero que esta materializa (por ejemplo, el `onDelete` de `AuditLog` que fija SPEC-01 depende de P-4, que cierra SPEC-03) se aplican con su propuesta vigente marcada **Propuesto** y se anotan en la sección 11 como dependencia no bloqueante, indicando qué cambiaría en la spec si la propuesta cambia.
6. Specs anteriores de las que depende.

**Paso 3 — Mapa de trazabilidad.** Antes de escribir, relaciona cada origen (elemento de la fila del taskboard, tarea `ENG`, criterio de salida de pbp, decisión de §14) con el RF o la regla que lo cubrirá. Todo origen necesita un RF y todo RF necesita un origen: un RF sin origen es alcance inventado (quítalo o llévalo a preguntas abiertas) y un origen sin RF es un hueco. El mapa es material de trabajo; no hace falta incluirlo en la spec.

Si falta una decisión de comportamiento o de alcance que ningún documento toma, no la inventes: va a la sección 11 con una propuesta (los detalles de concreción se resuelven en la spec, regla de oro 5). Si los huecos son muchos o son decisiones de producto de fondo, sugiere una entrevista previa con la skill `grill-with-docs` antes de redactar; sus ADR se registran en CONTEXT §14 y sus términos de glosario en §17 (AGENTS.md).

**Paso 4 — Escribir el archivo.** Parte de `specs/_template.md` (o del bloque de sdd-process §5 si aún no existe; si difieren, manda sdd-process §5). Las 12 secciones son obligatorias, en su orden y con su título exacto; si una no aplica, escribe "No aplica" y por qué, sin eliminarla. Antes de escribir, lee completa la guía por sección: [references/guia-de-secciones.md](references/guia-de-secciones.md). Al crear: Estado `Borrador`, "Aprobada por / fecha" `—` y la primera fila del registro de cambios.

**Paso 5 — Validar (obligatorio antes de entregar).**

1. Ejecuta, desde la raíz del repositorio:

   ```bash
   node .agents/skills/englove-spec/scripts/check-spec.mjs specs/SPEC-NN-nombre.md
   ```

   Comprueba la estructura contra la plantilla viva de sdd-process §5, el texto de plantilla sin reemplazar, los RF con **Dado** / **Cuando** / **Entonces** en negrita, que cada RF tenga prueba citada por su número, los P-n (asignados y mencionados), las tareas `ENG` cubiertas, el tamaño, el índice y una lista de señales de alarma. Corrige todos los `ERROR`; revisa cada `AVISO` y justifica en el informe los que se queden.
2. Recorre la lista semántica de [references/validacion.md](references/validacion.md): decisiones de §14, fuera de alcance de §2.4, convenciones de §16, terminología y pendientes. El script no sustituye esta lectura.
3. Si encuentras incongruencias entre documentos de planeación (no en la spec), no las resuelvas por tu cuenta: repórtalas. Mientras tanto manda el documento superior.

**Paso 6 — Cerrar el cambio** (en el mismo cambio, sdd-process §9 regla 4 y reglas del taskboard):

- `specs/README.md`: fila de la spec con su estado.
- `planning/taskboard.md`: la tarea `SPEC-NN` pasa a En curso mientras se redacta (límite de 3 tareas en curso) y a Hecho solo cuando el líder la apruebe; actualiza el resumen y la fecha del encabezado.
- CONTEXT §14 y §15 solo si el líder cerró un pendiente o cambió una decisión en esta conversación.
- Si es la primera spec del repositorio, actualiza las frases que dicen que aún no hay specs redactadas: CONTEXT §11.1, sdd-process §7 y la Etapa 0 de pbp §4 (búscalas por "aún no", "no se ha redactado" o "ninguna spec").
- Estado final de la spec: `En revisión` solo si está completa según la plantilla, el script no deja errores y ninguna pregunta abierta exige cambiar un documento superior (decisión nueva en CONTEXT §14 o en architecture §14). En cualquier otro caso queda en `Borrador` y el informe dice qué falta.
- Si el script avisa de que la spec supera los 20 minutos de lectura, recorta primero las repeticiones de CONTEXT o architecture. Si aun así no cabe, **propón** al líder la división (`SPEC-NNa`, `SPEC-NNb`) en lugar de hacerla: cambia el taskboard (la tarea `SPEC-NN` y la columna Spec de sus `ENG`) y el índice.

**Paso 7 — Informe final** (formato más abajo).

### Revisar una spec

1. Lee la spec completa y sus fuentes, en el orden del Paso 2.
2. Ejecuta el script de validación.
3. Recorre [references/validacion.md](references/validacion.md) y la [guía por sección](references/guia-de-secciones.md).
4. Entrega el informe de revisión con el formato de `references/validacion.md`: bloqueantes, mejoras e incongruencias con documentos superiores, cada hallazgo con su sección o RF, la fuente que lo respalda y una propuesta de corrección. Si el usuario pidió además corregir, aplica los cambios y añade la fila correspondiente al registro de cambios.
5. Da un veredicto. Para pasar a Aprobada hacen falta: cero preguntas abiertas que bloqueen un RF, los P-n asignados confirmados por el líder y la decisión explícita del líder.

### Actualizar una spec

- **Estados y quién los cambia:** sdd-process §6. Transiciones: Borrador → En revisión; En revisión → Borrador (cambios) o → Aprobada (solo el líder); Aprobada → Implementada (todas sus `ENG` en Hecho); Implementada → Verificada (pruebas de la sección 9 en CI y, si aplica, validación de la profesora en staging); Aprobada → En revisión (cambio de alcance); Verificada → Obsoleta (reemplazada; enlaza a la sustituta).
- **Cambiar una spec Aprobada** exige volver a En revisión con una fila en el registro de cambios. Si el cambio es menor (redacción, un código de error), basta la fila y se mantiene Aprobada.
- Si el cambio nace de una decisión nueva, primero se registra en CONTEXT §14 (o architecture §14) y después se toca la spec.
- **Al aprobar**, con confirmación del líder: estado, "Aprobada por / fecha" y fila en el registro de cambios; fila en `specs/README.md`; tarea `SPEC-NN` a Hecho en el taskboard (las `ENG` de la etapa siguen sujetas a sus dependencias y a la decisión 65). Si el líder confirmó un P-n: registra la decisión en CONTEXT §14, quítala de §15 y de las listas que la repiten (architecture §15 y "Decisiones que desbloquean tareas" del taskboard), y convierte la pregunta de la sección 11 en regla o RF.

## Informe final al usuario

Termina siempre con:

1. Archivos creados o modificados y estado de la spec.
2. Resultado del script: errores y avisos restantes, y por qué se aceptan los avisos.
3. Preguntas abiertas que necesitan decisión del líder, con su propuesta vigente, destacando los P-n.
4. Concreciones nuevas que conviene que el líder revise (`code` de error que no están en architecture §13, textos delicados).
5. Incongruencias encontradas en la planeación, si las hay.
6. Recordatorio: no se escribe código de producción de esta capacidad hasta que el líder apruebe la spec (y, en las Etapas 1 y 2, se cumplan las compuertas de la decisión 65).

## Relación con otras skills

- `grill-with-docs`: entrevista previa para cerrar huecos de producto antes de redactar.
- `domain-modeling`: términos nuevos para el glosario (CONTEXT §17).
- `code-review`: su eje Spec verifica el código contra los RF; busca la spec en `specs/`.
- `tdd`: los criterios Dado/Cuando/Entonces son la lista de pruebas; se nombran `RF-n: …` (sdd-process §8).
