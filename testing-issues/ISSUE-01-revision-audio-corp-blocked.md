# ISSUE-01: Bloqueo CORS/CORP al cargar audio de speaking en `/revision`

- **Fecha:** 2026-11-06
- **Módulo / Ruta:** `/revision` (Módulo Docente - Evaluaciones de Speaking)
- **Severidad:** Media (impide reproducción directa del audio en local / entornos cross-origin sin CDN directo)
- **Estado:** ✅ Resuelto y Verificado (2026-11-06)

> [!NOTE]
> **HALLAZGO HISTÓRICO — 100% SUBSANADO Y VERIFICADO (2026-11-08).**  
> Subsanado e integrado en la **Etapa 12 («Calidad y remediación»)** bajo [`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md) y blindado con pruebas de regresión automáticas en el monorepo (tarea ENG-154).

---

## 1. Síntoma / Descripción del Usuario
Al ingresar a la vista de `/revision` en el portal del profesor, aparece un error en la consola del navegador:
```text
Failed to load resource: net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
http://localhost:3001/api/v1/media/mock-stream/50000000-0000-4000-8000-000000000001
```
Y en la pestaña Issues de DevTools:
```text
Specify a more permissive Cross-Origin Resource Policy to stop a resource from being blocked (count: 2)
```

---

## 2. Inspección Técnica

### 2.1 Petición de Red Afectada
- **URL:** `GET http://localhost:3001/api/v1/media/mock-stream/50000000-0000-4000-8000-000000000001`
- **Iniciador:** Componente `<audio src={audioUrl}>` en `apps/web/src/app/(teacher)/revision/page.tsx`
- **Origen de la web:** `http://localhost:3000`
- **Origen del backend API:** `http://localhost:3001`
- **Tipo de petición:** `sec-fetch-dest: audio`, `sec-fetch-mode: no-cors`, `sec-fetch-site: same-site`
- **Resultado:** Falló con `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`.

### 2.2 Mensajes de Consola adicionales en la misma vista
1. **Falta de accesibilidad/atributos en checkbox de reintento:**
   - `[issue] A form field element should have an id or name attribute`
   - `[issue] No label associated with a form field`
   - Ocurre en el input `checkbox` de `allowRetry` (línea 713 de `apps/web/src/app/(teacher)/revision/page.tsx`).

---

## 3. Causa Raíz

1. **Política Helmet por defecto en NestJS:**
   En `apps/api/src/main.ts` se aplica Helmet globalmente:
   ```ts
   app.use(helmet());
   ```
   Helmet por defecto inyecta la cabecera HTTP:
   ```http
   Cross-Origin-Resource-Policy: same-origin
   ```
2. **Entorno local y mock-stream:**
   En local (`APP_ENV=local` con credenciales placeholder de R2), `MediaService` genera URLs locales de streaming:
   `http://localhost:3001/api/v1/media/mock-stream/:id`
3. **Conflicto de Origen (puerto 3000 vs 3001):**
   Al cargarse un elemento `<audio src="...">` desde `http://localhost:3000` hacia `http://localhost:3001`, el navegador evalúa las reglas CORP. Como la cabecera del backend dice `same-origin` y los puertos son distintos (`3000` vs `3001`), el navegador bloquea la respuesta inmediatamente antes de reproducir el audio.
4. Además, en el endpoint `mock-stream/:id` (`apps/api/src/media/media.controller.ts`) no se establece explícitamente `Cross-Origin-Resource-Policy: cross-origin` ni en la configuración de Helmet para recursos multimedia/estáticos.

---

## 4. Archivos Involucrados

1. [`apps/api/src/main.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/main.ts#L25) — Configuración global de `helmet()`.
2. [`apps/api/src/media/media.controller.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/media/media.controller.ts#L93-L98) — Método `handleMockStream` que responde el stream de audio sin la cabecera CORP permisiva.
3. [`apps/web/src/app/(teacher)/revision/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/revision/page.tsx#L526-L530) y [#L713-L720](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/revision/page.tsx#L713-L720) — Inserción del `<audio src={audioUrl}>` y checkbox sin accesibilidad (`id`/`name`/`aria-label`).

---

## 5. Propuesta de Solución (para la siguiente sesión)

- **Opción A (Recomendada en API):** En `apps/api/src/media/media.controller.ts`, añadir cabecera `Cross-Origin-Resource-Policy: cross-origin` en `handleMockStream`:
  ```ts
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  ```
  O configurar en Helmet (`apps/api/src/main.ts`):
  ```ts
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  ```
- **Opción B (Accesibilidad en Frontend):** Asignar `id="allow-retry-toggle"`, `name="allowRetry"` y `aria-label="Permitir nuevo intento"` al checkbox de la línea 713 en `apps/web/src/app/(teacher)/revision/page.tsx`.

---

## 6. Solución Implementada y Verificación (2026-11-06)

1. **Configuración Global de Helmet en API:**
   En [`apps/api/src/main.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/main.ts#L25) se configuró Helmet para permitir recursos cross-origin entre el frontend (`:3000`) y la API (`:3001`):
   ```ts
   app.use(
     helmet({
       crossOriginResourcePolicy: { policy: 'cross-origin' },
     }),
   );
   ```
2. **Cabecera Explícita en Streaming Multimedia Mock:**
   En [`apps/api/src/media/media.controller.ts`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/media/media.controller.ts#L93) se agregó la cabecera explícita `Cross-Origin-Resource-Policy: cross-origin` en `handleMockStream`.
3. **Accesibilidad en Controles de Revisión:**
   En [`apps/web/src/app/(teacher)/revision/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/revision/page.tsx) se asociaron los atributos `id="allow-retry-toggle"`, `name="allowRetry"` y `<label htmlFor="allow-retry-toggle">` al checkbox de reintento.
4. **Verificación:**
   - La suite completa de pruebas pasa con 54 archivos y 543 tests sin fallos.
   - `pnpm turbo run typecheck` y `pnpm lint` verificados sin errores.
