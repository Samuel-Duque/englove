# ISSUE-07: Error 409 (ACTIVITY_NOT_AVAILABLE) al Iniciar Microjuegos Archivados ("Speed Quiz: Colors" y "Memory Cards")

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** `/juegos` y `POST /api/v1/assignments/:id/attempts` (Zona de Juegos y Servicio de Intentos)
- **Severidad:** Alta (Impide iniciar actividades que aparecen como disponibles o reintentables en la interfaz del estudiante)
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

---

## 1. Síntoma / Descripción del Usuario

*"intentanto entrar al juego speed quiz colors sale error lo mismo con memory cards animals y nature"*

- Al ingresar a la **Zona de Juegos** (`/juegos`) con el perfil de estudiante (ej. Sofía Gómez, segmento Kids, Nivel A1), las tarjetas de:
  - **Memory Cards: Animals & Nature**
  - **Speed Quiz: Colors**
  aparecían en la lista con sus estrellas de intentos previos y el botón activo **"🔄 Jugar de nuevo"**.
- Al hacer clic en el botón de cualquiera de estos dos juegos:
  - La interfaz mostraba error o no iniciaba la actividad.
  - En la consola de Chrome DevTools se registraban fallos HTTP con código `409 (Conflict)`.

---

## 2. Evidencia Recopilada mediante Chrome DevTools MCP

Al inspeccionar la sesión activa en el navegador mediante el MCP de Chrome DevTools (`list_console_messages` y `get_network_request`):

### 2.1 Mensajes de Consola
```text
msgid=205 [error] Failed to load resource: the server responded with a status of 409 (Conflict) (0 args) [5 times]
```

### 2.2 Peticiones de Red con Error 409

1. **Intento en "Speed Quiz: Colors":**
   - **URL:** `POST http://localhost:3001/api/v1/assignments/30000000-0000-4000-8000-000000000015/attempts`
   - **Status:** `409 Conflict`
   - **Response Body:**
     ```json
     {
       "statusCode": 409,
       "code": "ACTIVITY_NOT_AVAILABLE",
       "message": "La actividad no está disponible"
     }
     ```

2. **Intento en "Memory Cards: Animals & Nature":**
   - **URL:** `POST http://localhost:3001/api/v1/assignments/30000000-0000-4000-8000-000000000014/attempts`
   - **Status:** `409 Conflict`
   - **Response Body:**
     ```json
     {
       "statusCode": 409,
       "code": "ACTIVITY_NOT_AVAILABLE",
       "message": "La actividad no está disponible"
     }
     ```

---

## 3. Diagnóstico Técnico y Causa Raíz

Se realizó una inspección a la base de datos PostgreSQL (`englove_dev`) y al flujo de inicio y listado de asignaciones:

### 3.1 Estado de las Actividades en la Base de Datos
Al consultar la tabla `activities`:
```sql
SELECT id, title, status, type FROM activities 
WHERE id IN (
  '20000000-0000-4000-8000-000000000011',
  '20000000-0000-4000-8000-000000000014',
  '20000000-0000-4000-8000-000000000015'
);
```
**Resultado:**
- `20000000-0000-4000-8000-000000000011` (*Vocabulary Match*): `status: 'published'` ✅
- `20000000-0000-4000-8000-000000000014` (*Memory Cards*): `status: 'archived'` ❌
- `20000000-0000-4000-8000-000000000015` (*Speed Quiz*): `status: 'archived'` ❌

Ambas actividades se encontraban en estado `archived` en la base de datos.

### 3.2 Rechazo en el Endpoint de Inicio (`startAttempt`)
En `apps/api/src/attempts/attempts.service.ts`:
```typescript
if (assignment.activity.status !== ActivityStatus.published) {
  throw new ConflictException({
    statusCode: 409,
    code: 'ACTIVITY_NOT_AVAILABLE',
    message: 'La actividad no está disponible',
  });
}
```
Dado que `assignment.activity.status === 'archived'`, el servidor rechazaba correctamente la creación del intento con HTTP 409 `ACTIVITY_NOT_AVAILABLE`.

### 3.3 ¿Por qué aparecían entonces en la pantalla de Juegos del estudiante?
Existe una discrepancia lógica entre el listado `scope=available` y `scope=continuity` en `attempts.service.ts`:

1. **En `scope=available`:** Filtra explícitamente `activity.status: ActivityStatus.published`.
2. **En `scope=continuity`:** Consultaba los intentos del estudiante sin filtrar ni validar el estado de publicación de la actividad, marcando `canStart: true`.
3. **En el frontend (`juegos-client.tsx`):** Al fusionar `continuity` y `available`, las tarjetas con `canStart: true` desplegaban el botón activo *"🔄 Jugar de nuevo"*.

---

## 4. Solución Implementada y Verificación

1. **Backend (`apps/api/src/attempts/attempts.service.ts`):**
   - En `listStudentAssignments` bajo `scope=continuity`, se agregó la verificación de publicación:
     ```typescript
     const isActivityPublished = a.activity.status !== ActivityStatus.archived && a.activity.status !== ActivityStatus.draft;

     const canContinue = isActivityPublished &&
       latestAttempt.status === AttemptStatus.in_progress && now <= completeUntil;
     const retryAvailable =
       latestAttempt.retry_granted_at !== null && !latestAttempt.next_attempt;

     const canStart =
       isActivityPublished &&
       (a.activity.type === ActivityType.game && gamesEnabled
         ? latestAttempt.status !== AttemptStatus.in_progress &&
           now >= a.opens_at &&
           now <= effectiveDueAt &&
           a.cancelled_at === null
         : retryAvailable && now <= effectiveDueAt && a.cancelled_at === null);
     ```
   - Si la actividad está archivada o en borrador, `canStart` y `canContinue` se desactivan categóricamente (`false`).

2. **Seeder (`apps/api/prisma/seeds/seed-dev.ts`):**
   - En el `upsert` de las actividades en `seedDev()`, se incluyó `status: ActivityStatus.published` dentro del bloque `update` para que cualquier actividad archivada en pruebas locales se restaure adecuadamente al resembrar.

3. **Base de Datos y Verificación:**
   - Se actualizaron las actividades `...14` y `...15` a `published` en PostgreSQL.
   - En la sesión activa de Chrome, el usuario inició y completó ambos juegos exitosamente (`POST .../attempts` respondió `201 Created`).
   - Se añadió prueba unitaria automatizada en `apps/api/test/games-scoring-and-attempts.spec.ts` que valida que `canStart` es `false` en `scope=continuity` para actividades archivadas.
