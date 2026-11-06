# ISSUE-03: Error al archivar grupo y Auditoría Integral del Módulo de Grupos

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** `/grupos` y `/grupos/[id]` (Módulo Docente - Gestión de Grupos)
- **Severidad:** Media-Alta (Bloqueo de flujo de archivo y experiencia de usuario confusa por encadenamiento con ISSUE-02)
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

---

> [!NOTE]
> **Aclaración importante:** Todas las soluciones y alternativas expuestas en este documento representan **posibles soluciones e hipótesis técnicas de abordaje**. Serán evaluadas, refinadas y decididas formalmente en la sesión de corrección.

---

## 1. Síntoma / Descripción del Usuario
1. Al intentar archivar un grupo desde el listado `/grupos` o desde su detalle `/grupos/[id]`, la operación arroja error:
   - En consola / red: `POST /api/v1/groups/:id/archive [409 Conflict]`
   - Mensaje devuelto: `"Este grupo tiene alumnos. Trasládalos a otro grupo antes de archivarlo"` (código `GROUP_HAS_ACTIVE_STUDENTS`).
   - O en la vista de lista `/grupos`: La interfaz bloquea con banner rojo antes de enviar la petición:
     `"No es posible archivar el grupo \"...\": tiene N alumno(s) activo(s). Traslada los alumnos antes de archivar (decisión 96)."`
2. El usuario percibe esto como un fallo de funcionamiento ("no me deja archivar"), agravado porque al entrar al detalle del grupo la lista de alumnos no carga o sale "Grupo no encontrado" (ISSUE-02).

---

## 2. Inspección Técnica

### 2.1 Regla de Negocio vs. Estado de la Base de Datos
- **Regla del sistema (Decisión 96 y arquitectura):**
  Un grupo sólo puede archivarse si **no tiene alumnos activos** (`left_at IS NULL`). Si tiene alumnos vigentes, la API debe rechazar la solicitud con `409 Conflict` (`GROUP_HAS_ACTIVE_STUDENTS`).
- **Estado actual en base de datos local:**
  Todos los grupos sembrados en dev (`Kids Explorers A1`, `Teens Leaders B1`, `Grupo Volumen A1..B2`) tienen entre 4 y 26 alumnos activos vinculados en la tabla `group_memberships`.
- **Efecto dominó de ISSUE-02 en la UI de `/grupos/[id]`:**
  1. La llamada `GET /api/v1/groups/:id/members?limit=100` fallaba con 500 (ISSUE-02).
  2. Al fallar, `members` quedaba en array vacío `[]`.
  3. La interfaz mostraba 0 miembros o "Grupo no encontrado".
  4. La condición del frontend `if (members.length > 0)` no se activaba, permitiendo al docente abrir la confirmación de archivar.
  5. Al confirmar, el backend recibía la petición, detectaba los 26 alumnos reales en la base de datos y devolvía `409 Conflict`.
  6. Para el docente la experiencia era desconcertante: la pantalla decía que no había alumnos, pero al archivar decía que sí los tenía.

---

## 3. Auditoría Integral de Funcionalidades del Módulo de Grupos

Revisión exhaustiva de cada endpoint y funcionalidad relacionada con grupos:

| Funcionalidad | Endpoint / Vista | Estado Técnico | Hallazgos / Observaciones |
|---|---|---|---|
| **1. Listado de grupos** | `GET /api/v1/groups` (`/grupos`) | ✅ Operativo | Soporta paginación y filtros `archived=false`, `true` y todos. Calcula `activeStudentCount` correctamente. |
| **2. Crear grupo** | `POST /api/v1/groups` | ✅ Operativo | Valida longitud (1 a 100 caracteres). *Nota:* No valida nombres duplicados dentro de la misma organización (permite nombres repetidos). |
| **3. Obtener detalle de grupo** | `GET /api/v1/groups/:id` | ⚠️ Operativo en API, Roto en UI | El endpoint individual responde 200, pero la página Next.js `/grupos/[id]` lo pide con `Promise.all` junto a miembros; al fallar miembros, se descarta el grupo y muestra "Grupo no encontrado". |
| **4. Listar miembros de grupo** | `GET /api/v1/groups/:id/members` | ❌ **ERROR 500 (ISSUE-02)** | Falta DTO formal con `@Type(() => Number)` en `groups.controller.ts:108`. `limit="100"` llega como string y Prisma falla. |
| **5. Renombrar grupo** | `PATCH /api/v1/groups/:id` | ✅ Operativo | Funciona tanto en el listado como en el detalle. Si el grupo está archivado, rechaza con 409 `GROUP_ARCHIVED` (comportamiento esperado). |
| **6. Archivar grupo** | `POST /api/v1/groups/:id/archive` | ⚠️ Operativo con fricción UX | El backend aplica la regla de negocio (409 si hay alumnos). La fricción ocurre por el desfasaje con la vista de detalle rota y la ausencia de traslado masivo. |
| **7. Eliminar grupo** | `DELETE /api/v1/groups/:id` | ✅ Operativo según spec | Rechaza con 409 `GROUP_HAS_HISTORY` si el grupo tuvo membresías o asignaciones. Solo grupos creados vacíos sin historial se pueden borrar físicamente. |
| **8. Traslado / Desasignación de alumnos** | `PUT /api/v1/students/:id/group` | ⚠️ Solo en `/alumnos/[id]` | No existe acción en `/grupos/[id]` para mover alumnos a otro grupo. El docente debe ir uno a uno a la ficha de cada alumno para trasladarlo antes de poder archivar. |

---

## 4. Archivos Involucrados

1. [`apps/api/src/groups/groups.service.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/groups.service.ts#L197-L253) — Lógica de `archiveGroup` y `deleteGroup`.
2. [`apps/web/src/app/(teacher)/grupos/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/page.tsx#L109-L140) — Manejador `handleArchive` y `handleDelete` en la lista.
3. [`apps/web/src/app/(teacher)/grupos/[id]/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx#L72-L94) — Manejador `handleArchive` en el detalle (desincronizado de la carga de miembros).
4. [`apps/web/src/app/(teacher)/alumnos/[id]/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/alumnos/[id]/page.tsx#L115) — Único lugar de la UI donde actualmente se puede trasladar un alumno de grupo.

---

## 5. Posibles Soluciones a Evaluar (para la sesión de fixes)

> *Estas opciones son propuestas preliminares para decisión futura:*

- **Posible Solución 1 (Resolver primero ISSUE-02):**
  Al corregir el tipado de `listMembers` en el backend, la vista `/grupos/[id]` cargará correctamente los 26 alumnos. Con esto, el botón "Archivar" mostrará coherentemente el aviso de que hay alumnos y la UI podrá desactivar o guiar al usuario.
- **Posible Solución 2 (Mejora de UX en `/grupos/[id]`):**
  En la tabla de miembros dentro de `/grupos/[id]`, agregar una acción rápida de "Trasladar a otro grupo" o un modal de traslado masivo, para que el docente pueda vaciar el aula sin tener que navegar alumno por alumno.
- **Posible Solución 3 (Manejo de errores explícito en Frontend):**
  Si el backend responde `409 GROUP_HAS_ACTIVE_STUDENTS`, asegurar que el mensaje en pantalla explique claramente: *"Para archivar este grupo, traslada sus X alumnos a otro grupo desde la lista de alumnos"*.

---

## 6. Solución Implementada y Verificación (2026-11-06)

1. **Resolución de la Carga de Miembros:**
   Al solucionar ISSUE-02, el endpoint `GET /api/v1/groups/:id/members?limit=100` responde exitosamente (200), permitiendo a la vista `/grupos/[id]` conocer el listado real de alumnos activos.
2. **Validación Preventiva en la Vista de Detalle (`grupos/[id]/page.tsx`):**
   En [`apps/web/src/app/(teacher)/grupos/[id]/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx), se unificó la comprobación antes de abrir el modal o ejecutar el archivo utilizando `group?.activeStudentCount ?? totalMembers ?? members.length`. Si el número es mayor a cero, la interfaz previene el intento, muestra el número exacto de alumnos activos y orienta al docente con el mensaje claro de la Decisión 96: traslada a los alumnos a otro grupo antes de archivar.
3. **Manejo Robusto del Conflicto 409:**
   Si la petición de archivo llegase a dispararse, el frontend decodifica el código `GROUP_HAS_ACTIVE_STUDENTS` y muestra la advertencia correspondiente sin romper el flujo de la aplicación ni dejar mensajes genéricos de error.
4. **Verificación:**
   - La suite de pruebas de grupos (`groups.spec.ts`) y flujos de profesor pasan satisfactoriamente.
