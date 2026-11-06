# ISSUE-02: Error 500 al entrar al detalle de un grupo (`/grupos/[id]`)

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** `/grupos/[id]` (Módulo Docente - Detalle y Miembros del Grupo)
- **Severidad:** Alta (rompe completamente la vista del grupo mostrando "Grupo no encontrado")
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

---

## 1. Síntoma / Descripción del Usuario
Al navegar al detalle de un grupo desde `/grupos` (por ejemplo: `http://localhost:3000/grupos/00000000-0000-4000-9000-000000000001`):
1. La pantalla muestra un banner de alerta con el texto:
   ```text
   Grupo no encontrado
   ```
2. En la consola del navegador y en la pestaña Network de DevTools aparece:
   ```text
   GET http://localhost:3001/api/v1/groups/00000000-0000-4000-9000-000000000001/members?limit=100 [500 Internal Server Error]
   ```
3. En el log del backend NestJS aparece:
   ```text
   AllExceptionsFilter: Error no controlado procesando GET /api/v1/groups/00000000-0000-4000-9000-000000000001/members?limit=100
   ```

---

## 2. Inspección Técnica

### 2.1 Backend (NestJS)
- **Endpoint llamado:** `GET /api/v1/groups/:id/members?limit=100`
- **Controlador:** [`apps/api/src/groups/groups.controller.ts:108`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/groups.controller.ts#L108)
  ```ts
  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidPipe) id: string,
    @Query() query: { offset?: number; limit?: number }, // <-- PROBLEMA: tipo literal anónimo
  ): Promise<StudentListResponse> {
    return this.groupsService.listMembers(user.organizationId, id, query);
  }
  ```
- **Servicio:** [`apps/api/src/groups/groups.service.ts:314-348`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/groups.service.ts#L314-L348)
  ```ts
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;

  this.prisma.student.findMany({
    ...
    skip: offset,
    take: limit, // <-- Prisma recibe "100" (string) en lugar de 100 (number)
  });
  ```

### 2.2 Frontend (Next.js)
- **Componente:** [`apps/web/src/app/(teacher)/grupos/[id]/page.tsx:32-45`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx#L32-L45)
  ```ts
  const [groupData, membersData] = await Promise.all([
    apiFetch<GroupView>(`/api/v1/groups/${id}`),
    apiFetch<StudentListResponse>(`/api/v1/groups/${id}/members?limit=100`),
  ]);
  ```
- **Renderizado de error:** En las líneas 122-127 de [`page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx#L122-L127):
  ```tsx
  if (!group) {
    return (
      <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-6 text-center text-rose-800">
        Grupo no encontrado
      </div>
    );
  }
  ```
  Al fallar la segunda petición del `Promise.all`, `group` queda en `null` y la UI asume erróneamente que el grupo no existe, enmascarando el error 500 del servidor.

---

## 3. Causa Raíz

1. **Falta de DTO de consulta con `@Type(() => Number)`:**
   A diferencia del resto de controladores del backend donde se usa un DTO formal con `class-transformer` (ej. `GroupQueryDto`, `StudentQueryDto`), en `groups.controller.ts:108` el decorador `@Query()` utiliza un tipo anónimo en línea `{ offset?: number; limit?: number }`.
2. **`ValidationPipe` no transforma tipos literales:**
   El `ValidationPipe` global de NestJS sólo puede instanciar y transformar clases (`target: metatype`). Con un tipo anónimo, `query.limit` llega como un `string` (`"100"`).
3. **Validación estricta de Prisma Client:**
   Prisma Client exige que los argumentos `take` y `skip` sean de tipo `number`. Al recibir el string `"100"`, Prisma lanza una excepción de validación interna. Al no ser un `HttpException`, `AllExceptionsFilter` responde con `500 Internal Server Error`.
4. **Manejo de error en Frontend:**
   El frontend asume que si `group` es nulo tras el fetch, el recurso no existe ("Grupo no encontrado"), en lugar de mostrar el mensaje de error de la API cuando la petición falla.

---

## 4. Archivos Involucrados

1. [`apps/api/src/groups/groups.controller.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/groups.controller.ts#L108) — Método `listMembers` con `@Query() query: { offset?: number; limit?: number }`.
2. [`apps/api/src/groups/dto/groups.dto.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/dto/groups.dto.ts) — Necesita un `GroupMembersQueryDto` o reutilizar `PaginationQueryDto`/`GroupQueryDto` con `@Type(() => Number)` y `@IsInt()`.
3. [`apps/api/src/groups/groups.service.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/groups.service.ts#L294-L348) — Parámetro de tipo `listMembers` y parseo de `Number(query.offset)`.
4. [`apps/web/src/app/(teacher)/grupos/[id]/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx#L32-L45) — Gestión de errores desacoplada para mostrar el error real de la API si la carga falla.

---

## 5. Propuesta de Solución (para la siguiente sesión)

1. **En API:**
   - Crear o usar un DTO de paginación para miembros de grupo (ej. `GroupMembersQueryDto` con `@Type(() => Number)` e `@IsInt()`).
   - O en `groups.service.ts`, asegurar la conversión defensiva:
     ```ts
     const offset = query.offset !== undefined ? Number(query.offset) : 0;
     const limit = query.limit !== undefined ? Number(query.limit) : 20;
     ```
2. **En Web:**
   - En `grupos/[id]/page.tsx`, si `error` existe, mostrar el mensaje de error en vez de asumir estáticamente "Grupo no encontrado".

---

## 6. Solución Implementada y Verificación (2026-11-06)

1. **Creación del DTO Tipado con Transformación Numérica:**
   En [`apps/api/src/groups/dto/groups.dto.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/dto/groups.dto.ts) se creó la clase:
   ```ts
   export class GroupMembersQueryDto {
     @IsOptional()
     @Type(() => Number)
     @IsInt()
     @Min(0)
     offset?: number = 0;

     @IsOptional()
     @Type(() => Number)
     @IsInt()
     @Min(1)
     @Max(100)
     limit?: number = 20;
   }
   ```
2. **Uso en el Controlador de Grupos:**
   En [`apps/api/src/groups/groups.controller.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/groups.controller.ts#L108) se reemplazó el tipo literal anónimo por `GroupMembersQueryDto`.
3. **Parseo Defensivo en el Servicio:**
   En [`apps/api/src/groups/groups.service.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/groups/groups.service.ts) se reforzó la asignación con validaciones `Number.isFinite()`, blindando ante cualquier entrada no numérica o `NaN`.
4. **Desacoplamiento de Errores en Frontend:**
   En [`apps/web/src/app/(teacher)/grupos/[id]/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx), se captura el error explícito de red y se presenta un banner descriptivo que diferencia entre un fallo de conexión / 500 y un grupo realmente no encontrado.
5. **Verificación:**
   - Se añadió una prueba unitaria específica en [`apps/api/test/groups.spec.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/test/groups.spec.ts) validando que `listMembers` maneja correctamente límites y offsets string, `NaN` y valores por defecto.
   - Las 14 pruebas de `groups.spec.ts` pasan al 100%.
