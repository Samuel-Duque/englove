# ISSUE-10: Error 500 en endpoints de autenticación pública (`login`, `refresh`, `signup`, `forgot-password`) por bloqueo de `findUnique` en extensión multi-tenant

- **Fecha:** 2026-11-08
- **Módulo / Ruta:** `/login`, `/registro`, `/recuperar-contrasena`, `/inicio` y API de autenticación (`/api/v1/auth/*`)
- **Severidad:** Crítica (bloquea completamente el inicio de sesión, creación de cuentas y renovación de tokens de sesión)
- **Estado:** 🟢 Resuelto y Verificado (2026-11-08)

> [!NOTE]
> **HALLAZGO HISTÓRICO — 100% SUBSANADO Y VERIFICADO (2026-11-08).**  
> Subsanado e integrado en la **Etapa 12 («Calidad y remediación»)** bajo [`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md) y blindado con pruebas de regresión automáticas en el monorepo (tarea ENG-151).

---

## 1. Síntoma / Descripción del Usuario

Al interactuar con los formularios de autenticación en la aplicación web (`http://localhost:3000`):

1. **En `/login`:** Al hacer clic en los botones de credenciales de prueba (o ingresar correo y contraseña válidos como `profesora@englove.org` / `Englove2026!`) y presionar "Entrar":
   - La pantalla muestra una alerta en rojo:
     ```text
     Ocurrió un error inesperado. Intenta de nuevo más tarde
     ```
   - En la consola del navegador y pestaña Network de Chrome DevTools aparece:
     ```text
     POST http://localhost:3001/api/v1/auth/login [500 Internal Server Error]
     ```
2. **En `/registro`:** Al diligenciar datos válidos de un nuevo estudiante y pulsar "Enviar solicitud":
   - Aparece el mismo mensaje de error inesperado con HTTP 500 en `POST http://localhost:3001/api/v1/auth/signup`.
3. **En `/recuperar-contrasena`:** Al enviar el correo registrado:
   - Se repite el fallo HTTP 500 en `POST http://localhost:3001/api/v1/auth/forgot-password`.
4. **En `/inicio`:** Si el navegador ya cuenta con una cookie de sesión previa (`access_token`), al cargar `/inicio`:
   - Se invoca en segundo plano `POST http://localhost:3001/api/v1/auth/refresh` que falla con 500.
   - La página entra en un bucle de redirección o queda permanentemente en el estado de carga:
     ```text
     Cargando tu espacio…
     ```

En los logs del backend NestJS aparece:
```text
{"level":50,"context":"AllExceptionsFilter","msg":"Error no controlado procesando POST /api/v1/auth/login"}
{"level":50,"context":"AllExceptionsFilter","msg":"Error no controlado procesando POST /api/v1/auth/refresh"}
{"level":50,"context":"AllExceptionsFilter","msg":"Error no controlado procesando POST /api/v1/auth/signup"}
```

---

## 2. Inspección Técnica y Causa Raíz

### 2.1 Causa Raíz Técnica
Al ejecutar la consulta directa contra la instancia configurada de `PrismaService`, se obtiene la traza interna del fallo:

```text
Prisma query error: Error: Consulta findUnique prohibida en modelo multi-tenant User.
Usa findFirst con organization_id para prevenir IDOR (G-A01, decisión 32).
    at Array.findUnique (apps/api/src/common/tenant/tenant-prisma.extension.ts:67:21)
```

En [`apps/api/src/common/tenant/tenant-prisma.extension.ts:65-71`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/common/tenant/tenant-prisma.extension.ts#L65-L71), la extensión de Prisma intercepta las operaciones `findUnique` para prevenir fallos IDOR:

```ts
async findUnique({ model, args, query }) {
  if (model !== 'Organization' && !TenantContext.isBypassed()) {
    throw new Error(
      `Consulta findUnique prohibida en modelo multi-tenant ${model}. Usa findFirst con organization_id para prevenir IDOR (G-A01, decisión 32).`,
    );
  }
  return query(args);
}
```

En las rutas de autenticación pública (`login`, `signup`, `forgotPassword`, `refresh`), el usuario aún no está autenticado ni se conoce su `organization_id` (o la credencial es opaca). 

Sin embargo, en [`apps/api/src/auth/auth.service.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/auth/auth.service.ts):
- **Línea 240 (`login`):**
  ```ts
  const user = await this.prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  ```
- **Línea 469 (`refresh` - búsqueda de sesión):**
  ```ts
  const session = await this.prisma.authSession.findFirst({
    where: { id: sid },
  });
  ```
  Al ser `AuthSession` un modelo de tenant y recibir `sid` opaco sin contexto previo de organización, la extensión rechaza la operación `findFirst` sin bypass con `Operación multi-tenant rechazada: organization_id ausente en TenantContext para modelo AuthSession`.
- **Línea 496 (`refresh` - búsqueda de usuario):**
  ```ts
  const user = await this.prisma.user.findUnique({
    where: { id: session.user_id },
  });
  ```
- **Línea 661 (`signup`):**
  ```ts
  const existingUser = await this.prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  ```
- **Línea 740 (`forgotPassword`):**
  ```ts
  const user = await this.prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  ```

Estas consultas (tanto en `User` como en `AuthSession` para la resolución inicial de sesión) no estaban envueltas en `TenantContext.runBypass(...)` (a diferencia de lo que se hace en `logout`, líneas 595 y 617), por lo que la extensión de tenant lanza inmediatamente una excepción no controlada que `AllExceptionsFilter` convierte en `500 INTERNAL_ERROR`.

### 2.2 Por qué no fue detectado en pruebas automatizadas unitarias
En [`apps/api/test/auth.spec.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/test/auth.spec.ts), los tests unitarios utilizan un mock `vi.fn()` para `PrismaService`:
```ts
this.prisma.user.findUnique.mockResolvedValue(...)
```
Al tratarse de un mock que no ejecuta la extensión real de Prisma (`createTenantPrismaExtension`), los 562 tests pasaron en verde en CI a pesar de que el código fallaba en el entorno integrado real.

---

## 3. Hallazgos Secundarios Detectados en la Misma Sesión

Durante la misma auditoría dinámica con Chrome DevTools MCP, se identificaron los siguientes hallazgos complementarios:

| ID Interno | Ruta | Descripción | Severidad |
|---|---|---|---|
| **BUG-10.1** | `/inicio` | **Bucle de redirección/carga infinita:** Si `access_token` existe en cookies pero `/api/v1/auth/refresh` retorna 500, `InicioPage` intenta `router.replace('/login')`, pero `proxy.ts` lo regresa con 307 a `/inicio` generando un bucle o pantalla congelada en `"Cargando tu espacio…"`. | Alta |
| **BUG-10.2** | `/registro` | **Espaciado en consentimiento:** Falta espacio alrededor del enlace en el texto del checkbox de términos: `"Acepto lostérminos y condicionesde la plataforma..."` en [`registro/page.tsx:225-234`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(public)/registro/page.tsx#L225-L234). | Baja |
| **BUG-10.3** | `/terminos`, `/restablecer` | **Sufijo duplicado en metadata:** En el tab del navegador el título se mostraba con doble sufijo por concatenación con el template del layout (`| Englove | Englove`). Corregido en ambas rutas. | Baja |
| **BUG-10.4** | `/progreso` | **UUID crudo en intentos:** En el historial de actividades entregadas, los encabezados muestran `Intento #40000000` (primeros 8 caracteres de UUID) en vez del título didáctico o número de intento real. | Media |
| **A11Y-10.5**| `/actividades`, `/estadisticas` | **Accesibilidad en filtros:** Los selectores e inputs de fecha de los filtros docentes en el catálogo (`/actividades`), estadísticas globales (`/estadisticas`) y ficha de alumno (`/estadisticas/estudiantes/[id]`) carecían de atributos `id`/`name` asociados a su etiqueta. | Baja |

---

## 4. Plan de Remediación y Estado de Resolución

1. **Remediación en `AuthService` (`apps/api/src/auth/auth.service.ts`):**
   - Se envolvieron las consultas pre-autenticación (`login`, `refresh`, `signup`, `forgotPassword` y chequeo de cambio de email) con `TenantContext.runBypass` para permitir la consulta segura de `User` sin lanzar la excepción de la extensión de tenant.
2. **Endurecimiento de pruebas en `apps/api/test/tenant-extension.spec.ts`:**
   - Se añadió prueba explícita que verifica que `findUnique` y `findUniqueOrThrow` están permitidos bajo `TenantContext.runBypass(...)` y continúan bloqueados de forma estricta sin bypass.
3. **Manejo defensivo en sesión y cliente web:**
   - En `apps/web/src/lib/auth-session.ts`, se propaga `{ cause: err }` evitando redirecciones ciegas y bucles ante errores de red o 500.
4. **Corrección de hallazgos secundarios (BUG-10.1 a A11Y-10.5):**
   - **BUG-10.1:** Resuelto mediante control defensivo de errores en `auth-session.ts` e `inicio-client.tsx`.
   - **BUG-10.2:** Espaciado añadido antes y después de `términos y condiciones` en `registro/registro-client.tsx`.
   - **BUG-10.3:** `title` corregido en `terminos/page.tsx` y `restablecer/[token]/page.tsx` sin sufijo redundante.
   - **BUG-10.4:** En `progreso-client.tsx` se muestra el título didáctico (`activityTitle`) y el número de intento en lugar de los primeros 8 caracteres de UUID.
   - **A11Y-10.5:** Se asociaron `id`, `name` y `htmlFor` en los selectores de filtros de `actividades-client.tsx`, `estadisticas-client.tsx`, `estudiante-stats-client.tsx`, `nueva-asignacion-client.tsx` y renombrado en `grupos-client.tsx`.

Todas las pruebas automatizadas (353 pruebas en backend, 146 en frontend y 65 en shared) pasan limpiamente. Estado: Resuelto.

