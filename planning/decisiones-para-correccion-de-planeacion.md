# Englove — Decisiones para corregir la planeación

> Documento preparatorio para actualizar posteriormente `CONTEXT.md`, `architecture-overview.md`, `pbp-development.md` y `taskboard.md`.
>
> Este documento no modifica ni sustituye los documentos originales. Sus decisiones deben incorporarse mediante una nueva ronda en el registro de decisiones.
>
> Fecha: 2026-09-25
>
> **Estado: aplicado el 2026-09-28** mediante la Ronda 4 del registro de decisiones (`CONTEXT.md` §14, decisiones 57–66), con reflejo en `architecture-overview.md` (§14.4), `sdd-process.md`, `pbp-development.md` y `taskboard.md`. Las decisiones menores de §10 no se decidieron: quedan como pendientes P-1 a P-5 en `CONTEXT.md` §15, cada una con una propuesta vigente y la spec que debe cerrarla.

## 1. Cookies de sesión entre frontend y API

### 1.1 Decisión adoptada

Las cookies de sesión se compartirán entre los subdominios del mismo entorno mediante `Domain=.dominio`, `Secure`, `HttpOnly` y `SameSite=Lax`. El mismo criterio se aplicará en staging a `app-staging.<dominio>` y `api-staging.<dominio>`.

### 1.2 Motivo

La arquitectura usa `middleware.ts` de Next.js para detectar la sesión y redirigir por rol, mientras que la API vive en otro subdominio. Una cookie host-only emitida por `api.<dominio>` no sería visible para `app.<dominio>`.

Compartir la cookie conserva el diseño actual sin introducir un BFF o un rewrite obligatorio. La autorización real seguirá perteneciendo exclusivamente a NestJS; el middleware solo hará redirecciones de experiencia y no será el control de seguridad definitivo.

### 1.3 Implicaciones

- El dominio raíz y todos sus subdominios deben estar bajo control del proyecto.
- No deben publicarse subdominios no controlados, porque una vulnerabilidad en otro subdominio aumentaría el riesgo sobre una cookie compartida.
- CORS con credenciales y validación de `Origin` permanecen obligatorios.
- Las vistas previas de Vercel seguirán sin sesión, salvo que se cree un entorno específico.
- La API debe validar JWT, rol, sesión y tenant en cada petición.

## 2. Unicidad del correo en multi-tenant

### 2.1 Decisión adoptada

El correo será globalmente único en toda la plataforma, no únicamente dentro de cada organización.

### 2.2 Motivo

Es la opción más recomendable para el piloto y su evolución inmediata. El login recibe correo y contraseña, pero no recibe un identificador de organización. Si el correo solo fuera único por organización, la API no sabría qué cuenta autenticar cuando existieran duplicados.

La unicidad global elimina esa ambigüedad y simplifica recuperación de contraseña, cambio de correo y soporte.

### 2.3 Implicaciones

- La restricción de base de datos debe ser única sobre `User.email`, sin incluir `organization_id`.
- `POST /auth/login` puede continuar recibiendo únicamente correo y contraseña.
- `POST /auth/signup` debe rechazar un correo utilizado en cualquier organización.
- En Fase 2, si una persona necesita pertenecer a varias organizaciones, deberá definirse un modelo de membresías o identidades compartidas; no se resolverá duplicando usuarios.
- Los endpoints públicos deben evitar enumerar cuentas mediante sus mensajes de error.

## 3. Tolerancia máxima para completar un intento

### 3.1 Decisión adoptada

Se confirma una tolerancia máxima de 24 horas después de `due_at` para completar un intento iniciado antes del cierre.

### 3.2 Regla definitiva

- Si `started_at` del servidor es anterior o igual a `due_at`, el intento es válido.
- El alumno puede completarlo hasta `due_at + 24 horas`.
- Después de esa tolerancia, el `attemptToken` deja de ser válido y el job nocturno puede marcar el intento como `abandoned`.
- Si el intento se inició después de `due_at`, nunca se crea.
- La tolerancia no aplica a intentos nuevos iniciados después del cierre.

### 3.3 Implicaciones

La regla de `due_at`, la expiración del `attemptToken` y el job de abandono quedan alineados. La interfaz debe informar que comenzar antes del cierre permite terminar dentro de una ventana adicional limitada.

## 4. Representación del plazo de un nuevo intento

### 4.1 Decisión adoptada

Se agregará `retry_extend_until` a `Attempt`. Cuando la profesora habilite un nuevo intento después del cierre, ese campo guardará la fecha límite efectiva del intento hijo que todavía será creado.

### 4.2 Motivo

Para el piloto solo existe un nuevo intento adicional por autorización. Añadir un campo al intento que concede la autorización mantiene el modelo simple y evita crear una entidad adicional para un flujo que no necesita historial independiente de permisos.

La relación será:

```text
Attempt anterior
  retry_granted_at
  retry_granted_by
  retry_extend_until
        |
        v
Attempt nuevo
  previous_attempt_id = id del intento anterior
```

### 4.3 Reglas adoptadas

- `retry_extend_until` es opcional.
- Si es `null`, el nuevo intento usa el `due_at` original.
- Si tiene valor, el nuevo intento usa esa fecha como límite efectivo para iniciar.
- La fecha no puede ser anterior al momento de conceder el reintento.
- La autorización solo puede concederla la profesora.
- No se puede conceder otra autorización mientras exista una autorización sin consumir.
- La autorización se consume atómicamente al crear el nuevo intento.
- El nuevo intento conserva el historial mediante `previous_attempt_id`.

### 4.4 Implicaciones

`schema.prisma`, los tipos compartidos, DTOs, estadísticas y pruebas deberán reconocer `retry_extend_until`. La interfaz debe mostrar el límite efectivo y la API debe impedir condiciones de carrera que creen dos reintentos con una sola autorización.

## 5. Cambio de correo del alumno

### 5.1 Decisión adoptada

El OTP se enviará al correo nuevo. Una vez completado el cambio, se notificará al correo anterior.

### 5.2 Motivo e implicaciones

El OTP verifica que el alumno controla la dirección que desea usar. El correo anterior recibe una alerta, pero no autoriza el cambio. El flujo normal seguirá requiriendo la contraseña actual, OTP de un solo uso y revocación de sesiones según la política vigente.

## 6. Modificación del correo por la profesora

### 6.1 Decisión adoptada

La profesora podrá modificar el correo de un alumno desde el panel como operación administrativa excepcional.

### 6.2 Condiciones obligatorias

- Solo una profesora de la misma organización podrá hacerlo.
- El nuevo correo debe ser globalmente único.
- El cambio debe revocar todas las sesiones activas del alumno.
- Debe registrarse una auditoría con quién hizo el cambio, cuándo, alumno afectado y correo anterior y nuevo.
- La interfaz debe pedir confirmación explícita antes de guardar.
- Debe notificarse el cambio al correo nuevo y, cuando sea posible, al anterior.
- La profesora nunca verá ni establecerá la contraseña del alumno.

### 6.3 Motivo e implicaciones

Esto resuelve el caso en que el alumno pierde acceso al correo original y no puede usar el flujo normal de OTP. Se requiere un permiso administrativo específico, un endpoint definido o una ampliación explícita de `PATCH /students/:id`, además de auditoría y revocación de sesiones.

La verificación de identidad del alumno ocurre fuera de la aplicación y queda como responsabilidad operativa de la profesora.

## 7. Cola de transcodificación y una sola instancia

### 7.1 Decisión adoptada

Durante el piloto la API funcionará con una sola instancia activa. La cola de transcodificación y el rate limiting en memoria se aceptan únicamente bajo esta restricción.

### 7.2 Implicaciones para transcodificación

- Una cola en memoria no sobrevive a un reinicio, despliegue o caída del proceso.
- Una tarea interrumpida debe poder detectarse mediante `MediaAsset.status = ready` sin `converted_key`.
- Al iniciar la API debe existir una rutina de recuperación que reprograme esas conversiones.
- El raw se conserva hasta confirmar la conversión.
- La operación debe ser idempotente y registrar reintentos y fallos sin exponer detalles técnicos al alumno.
- La profesora puede continuar viendo el raw como fallback.

### 7.3 Implicaciones para rate limiting

- Los contadores se reinician si la instancia se reinicia.
- Con una sola instancia todos los usuarios comparten el mismo proceso de rate limiting.
- Si se despliegan varias instancias, el rate limiting en memoria dejará de ser global y deberá migrarse a un almacén compartido, como Redis o Postgres.

### 7.4 Implicaciones para escalabilidad

El piloto no garantiza escalado horizontal transparente. Antes de habilitar varias instancias será necesario externalizar la cola de trabajos y el rate limiting. Render debe configurarse con una instancia siempre activa en producción.

## 8. Corrección del calendario de la Etapa 0

### 8.1 Decisión adoptada

La Etapa 0 se mantiene como etapa de arranque, pero no se considerará paralela al desarrollo efectivo de las Etapas 1 y 2 en lo relativo a sus dependencias obligatorias.

### 8.2 Corrección operativa

- Cuentas, dominio, repositorio, tokens y observación pueden prepararse en paralelo.
- La Etapa 1 comienza después de aprobar `SPEC-01`.
- La Etapa 2 comienza después de aprobar `SPEC-02` y entregar las dependencias técnicas de la Etapa 1.
- El taskboard debe reflejar estas dependencias como una secuencia, no como tres etapas completamente simultáneas.

### 8.3 Motivo

La aprobación previa de las specs es una dependencia real según SDD. Presentar las tres etapas como completamente paralelas contradice el proceso definido.

## 9. Terminología: tipos de actividad y mecánicas

### 9.1 Situación actual

La estructura vigente define cinco valores de `ActivityType`:

1. `fill_blank`
2. `open_question`
3. `speaking`
4. `game`
5. `exam`

Dentro de `game` existen cinco mecánicas:

1. `match`
2. `order_words`
3. `drag_drop`
4. `memory`
5. `timed_choice`

### 9.2 Qué implica corregir esta terminología

La corrección no cambia el alcance funcional, el modelo `Activity → Assignment → Attempt` ni el número de tablas de detalle. Sí evita que una spec o tarea omita `exam` o confunda `fill_blank` con una mecánica de juego.

- La profesora verá cinco opciones principales de actividad.
- El backend conservará cinco valores de `ActivityType`.
- Las estadísticas agruparán por tipo de actividad y, cuando corresponda, por mecánica de juego.
- La documentación usará “tipo de actividad” para los cinco valores principales.
- La documentación usará “mecánica de juego” para los cinco valores de `GameMechanic`.
- “Cinco tipos de actividad” reemplazará a “cuatro tipos”.

### 9.3 Decisión recomendada

Adoptar oficialmente “cinco tipos de actividad” y “cinco mecánicas de juego”. Es una corrección editorial y de trazabilidad, no una ampliación del producto.

## 10. Decisiones menores pendientes

Estas decisiones se dejan abiertas para una ronda posterior y no bloquean las decisiones anteriores.

### 10.1 Inicio antes de `opens_at`

Definir si el endpoint de inicio debe rechazar expresamente los intentos antes de `opens_at`, junto con su código y mensaje para el alumno.

### 10.2 Comentario en actividades autocalificadas

Definir si el comentario de la profesora también es obligatorio para actividades autocalificadas o solo para respuestas abiertas y speaking.

### 10.3 Recuperación de transcodificación

Definir el número máximo de reintentos, el tratamiento definitivo de una conversión fallida y si la profesora podrá solicitar manualmente una nueva conversión.

### 10.4 Auditoría administrativa

Definir la retención, consulta y acceso de los registros generados cuando la profesora modifica datos sensibles, especialmente el correo.

### 10.5 Identidad multi-organización futura

Aunque el correo globalmente único resuelve el piloto, en Fase 2 deberá decidirse si una persona puede pertenecer a varias organizaciones mediante membresías sin duplicar su identidad.
