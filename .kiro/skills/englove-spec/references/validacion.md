# Validación de una spec de Englove

Úsala al terminar de redactar y en el modo Revisar. Cada punto remite a su fuente; si la fuente cambió, manda la fuente. El script `scripts/check-spec.mjs` cubre la parte A y avisa de las señales de alarma; el resto exige leer.

## A. Estructura (la comprueba el script)

- Las 12 secciones de sdd-process §5, en orden y con su título exacto, ninguna vacía y ningún "No aplica" sin motivo.
- Cabecera completa, con un estado válido de sdd-process §6 y "Aprobada por / fecha" coherente con ese estado.
- Sin texto de la plantilla sin reemplazar.
- Cada RF definido en su propia línea (`**RF-n …**` o `### RF-n …`) y con un criterio **Dado** / **Cuando** / **Entonces** con las palabras clave en negrita. Numeración sin duplicados; avisa si hay saltos o resultados vagos ("funciona correctamente", "como se espera").
- Cada RF citado por su número en la sección 9 (los rangos no cuentan); si falta, es error.
- Los P-n que CONTEXT §15 asigna a la spec aparecen en la sección 11 en una línea que también dice Propuesto; una spec Aprobada no tiene P-n asignados abiertos. Avisa si la spec menciona otro P-n fuera de la sección 11 sin listarlo allí.
- Las tareas `ENG` de la cabecera existen en el taskboard y cubren todas las que tienen esta spec en su columna Spec.
- Registro de cambios con al menos una fila; tamaño por debajo de unos 20 minutos de lectura (sin contar la sintaxis de las tablas); fila en el `README.md` de la carpeta de la spec.
- Si la spec tiene sufijo (`SPEC-05a`), comprueba sus tareas contra las que el taskboard asigna a ese identificador; si el taskboard todavía las asigna al identificador sin sufijo, avisa de que hay que actualizar la columna Spec.

## B. Jerarquía y decisiones

- [ ] Ningún RF, regla, endpoint o campo contradice CONTEXT, architecture ni una spec Aprobada de la que dependa.
- [ ] Cada decisión citada está vigente: revisa la columna Estado de CONTEXT §14 y sigue las Sustituidas, Retiradas o Modificadas hasta la última.
- [ ] Recorre las decisiones de §14 que tocan esta capacidad (búscalas por las entidades, endpoints y términos de la spec) y comprueba que cada una se refleja en un RF o una regla, o que no aplica.
- [ ] Lo **Propuesto** está marcado como tal y tiene su pregunta en la sección 11.
- [ ] La spec enlaza en lugar de copiar párrafos de CONTEXT o architecture.

## C. Convenciones que casi toda spec toca (CONTEXT §16)

- [ ] Toda consulta de tenant filtra por `organization_id`, y el tenant sale del JWT, no del cuerpo de la petición.
- [ ] Toda calificación se calcula en el servidor, en la escala 0,0–5,0 con un decimal; ningún DTO acepta `score` (decisiones 24 y 72).
- [ ] Toda marca de tiempo la asigna el servidor; ningún DTO acepta `started_at`, `finished_at`, `graded_at`, `occurred_at` ni equivalentes (decisión 37).
- [ ] `User.email` es globalmente único y ningún endpoint público revela si un correo existe (decisión 59).
- [ ] No aparecen `Guardian`, `ConsentRecord`, `ConsentStatus`, `ConsentMethod`, Supabase Storage, Auth, Realtime o RLS, ni los flags `stats` o `leaderboard` (decisiones 35, 36, 41 y 55; CONTEXT §6).
- [ ] Los archivos van a Cloudflare R2 con URLs firmadas por el backend (decisión 55).
- [ ] La autorización nunca depende de `middleware.ts` (decisión 58).
- [ ] Ningún estado de proceso asume varias instancias de la API; toda tarea asíncrona es idempotente y las periódicas usan `ScheduledJobRun` (decisiones 64 y 76).
- [ ] Modelo de datos según la decisión 67: nota solo en `Attempt`, `answer_key` nunca hacia el alumno, una sola membresía de grupo vigente, `onDelete` declarado en cada clave foránea, nombre en `User.name`.
- [ ] Terminología de la decisión 66: "tipo de actividad" y "mecánica de juego" en su sentido exacto; `fill_blank` y `exam` son tipos de actividad, no mecánicas.
- [ ] Textos de interfaz en español; identificadores en inglés.

## D. Fuera de alcance del piloto (CONTEXT §2.4)

- [ ] Lee la tabla completa de §2.4 y comprueba que ningún RF construye un elemento de su columna izquierda, ni siquiera "porque la spec lo insinúa" (anti-patrón de sdd-process §10). Si la capacidad parece necesitarlo, se detiene y se propone en CONTEXT §14.
- [ ] Tampoco se construye nada de Fase 2 o Fase 3 (CONTEXT §2.2 y §2.3).
- [ ] Los elementos tentadores para esta capacidad figuran como excluidos en las secciones 2 o 10.

## E. Pendientes (CONTEXT §15)

- [ ] Los P-n asignados a esta spec están en la sección 11 con su propuesta vigente marcada **Propuesto**.
- [ ] Los P-n asignados a otra spec que esta materializa (por ejemplo, P-4 en el esquema de SPEC-01) están en la sección 11 como dependencia **no bloqueante**, con su propuesta marcada **Propuesto** y qué cambiaría si la propuesta cambia. No impiden aprobar esta spec: los cierra la spec a la que están asignados.
- [ ] Ningún RF da por Decidida una propuesta pendiente; los RF que dependen de un P-n asignado figuran como bloqueados en la sección 11.
- [ ] P-5 no se trata en ninguna spec del piloto (es compuerta de Fase 2).
- [ ] La spec no pasa a Aprobada mientras un P-n asignado a ella siga abierto en §15.

## F. Proceso

- [ ] Calendario de sdd-process §7 respetado, o desvío confirmado por el líder.
- [ ] Una spec por capacidad, no por tarea; sin diseño de clases ni listado de archivos (sdd-process §3).
- [ ] La fila `SPEC-NN` del taskboard queda cubierta completa y toda tarea `ENG` de la spec tiene al menos un RF.
- [ ] Ningún RF carece de origen en la planeación (alcance inventado).
- [ ] Ningún anti-patrón de sdd-process §10.
- [ ] `specs/README.md` y el taskboard se actualizan en el mismo cambio.

## Señales de alarma

El script busca en las secciones 1 y 3 a 9 términos que casi siempre indican un error: `Guardian`, consentimiento o `ConsentRecord`, Supabase Storage, Auth, Realtime o RLS, WebSockets o SSE, heartbeat, Phaser, iframe, Capacitor o tiendas de aplicaciones, pasarela de pagos, `localStorage`, `db push`, flags `stats` o `leaderboard`, `rejected`, `Student.name`, `Review.score` o `Review.graded_at`, `max_attempts`, `extendUntil`, "tipos de ítem" o "cuatro tipos". Un aviso no es un error automático: algunos son legítimos (por ejemplo, SPEC-01 describe el check que prohíbe `db push`). Decide caso por caso y justifica en el informe los que se mantengan. En las secciones 2, 10 y 11 estos términos pueden aparecer como exclusiones, por eso el script no las revisa.

## Formato del informe de revisión

```markdown
## Revisión de SPEC-NN — Título

**Veredicto:** requiere cambios | lista para proponerse En revisión | lista para que el líder decida su aprobación

### Bloqueantes
1. [§3 RF-4] Hallazgo. Fuente: CONTEXT §5.1, decisión 60. Propuesta: corrección concreta.

### Mejoras
1. [§7] Hallazgo. Fuente: architecture §3.1. Propuesta: …

### Incongruencias en la planeación (no se corrigen en la spec)
1. Documento A dice X; documento B dice Y. Manda A por jerarquía. Propuesta: …

### Resultado del script
N errores, M avisos. Avisos aceptados y por qué.

### Preguntas para el líder
1. P-n o pregunta propia, con la propuesta vigente.
```
