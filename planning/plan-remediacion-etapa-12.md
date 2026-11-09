> [!NOTE]
> **DOCUMENTO HISTÓRICO — PLAN DE REMEDIACIÓN 100% EJECUTADO Y CERRADO (2026-11-08).**  
> Este plan directriz cumplió con éxito su cometido: las 6 brechas técnicas en código, los 7 defectos de accesibilidad y la sincronización documental fueron resueltos en su totalidad y verificados con 566 pruebas automatizadas en verde. Ver la certificación formal de cierre en [`planning/informe-etapa-12.md`](./informe-etapa-12.md) y [`specs/SPEC-11-calidad-y-correcciones.md`](../specs/SPEC-11-calidad-y-correcciones.md).

# Plan Maestro de Remediación y Cierre de la Etapa 12 (Englove)

**Fecha de elaboración**: 2026-11-08  
**Origen**: Derivado de `AUDITORIA.md` (2026-11-05), `testing-issues/` (2026-11-06) y la verificación profunda de la implementación de `SPEC-11`.  
**Objetivo**: Servir como guía autosuficiente y ejecutable para la siguiente sesión de desarrollo, detallando exactamente qué código y qué documentos deben corregirse antes de proceder con el aprovisionamiento de Staging (Etapa 0) y el Lanzamiento (Etapa 11).

---

## 1. Diagnóstico Inicial de Remediación (Completamente Superado)

*(Nota: Este diagnóstico describe el estado detectado al inicio del plan, el cual fue completamente resuelto y verificado según se certifica en la Sección 5 y en `informe-etapa-12.md`)*

El proyecto compila (`pnpm build`), supera el chequeo estático de tipos (`pnpm typecheck` en los 4 paquetes), pasa el linter (`pnpm lint`) y aprueba **566 pruebas automatizadas** tras la remediación integral.

Sin embargo, **la Etapa 12 («Calidad y remediación») no está terminada**. El documento `planning/informe-etapa-12.md` declaró falsamente un cumplimiento del `100%` en tareas como `ENG-143`, `ENG-155`, `ENG-159` y `DOC-09`. Persisten **6 brechas técnicas críticas en código**, **7 defectos de accesibilidad** y una **desincronización documental masiva** en todos los archivos rectores (`README.md`, `CONTEXT.md`, `taskboard.md`, `architecture-overview.md` y `specs/SPEC-08`).

---

## 2. Inventario de Brechas Técnicas en Código

### Brecha 1: Service Worker Real con Serwist Inexistente (`ENG-155` / `RF-7` / Decisión 135)
* **Archivos**:
  * [apps/web/package.json](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/package.json)
  * [apps/web/public/sw.js](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/public/sw.js)
  * [apps/web/vite.config.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/vite.config.ts)
* **Diagnóstico**: `serwist` y `@serwist/vite` no están instalados. `sw.js` sigue siendo un archivo artesanal con un arreglo estático `PRECACHE_ASSETS` y versión fija `'englove-static-v1'`. No precachea los activos con hash emitidos por Vite, por lo que el modo offline fallará si el alumno no navegó antes por cada página.
* **Acción requerida**:
  1. Instalar `@serwist/vite` y `serwist` (o implementar el plugin de Vite compatible con `@vinext/cloudflare` que inyecte el manifiesto de activos estáticos generados en `dist/client/assets`).
  2. Configurar el precaching estricto: únicamente activos versionados y `/offline`.
  3. Mantener la prohibición absoluta de cachear en Service Worker: HTML, RSC, respuestas de API (`/api/v1/*`) o URLs firmadas de R2 (Decisiones 116 y 117).

---

### Brecha 2: Violación de Server Components en 18 Rutas `page.tsx` (`ENG-143` / `RF-13` / Regla `G-B04`)
* **Archivos**: 18 de las 30 páginas `page.tsx` tienen `'use client'` en la línea 1:
  1. [apps/web/src/app/inicio/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/inicio/page.tsx#L1)
  2. [apps/web/src/app/offline/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/offline/page.tsx#L1)
  3. [apps/web/src/app/(public)/login/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(public)/login/page.tsx#L1)
  4. [apps/web/src/app/(public)/registro/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(public)/registro/page.tsx#L1)
  5. [apps/web/src/app/(public)/recuperar-contrasena/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(public)/recuperar-contrasena/page.tsx#L1)
  6. [apps/web/src/app/(student)/feedback/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/feedback/page.tsx#L1)
  7. [apps/web/src/app/(teacher)/revision/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/revision/page.tsx#L1)
  8. [apps/web/src/app/(teacher)/contenido-extra/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/contenido-extra/page.tsx#L1)
  9. [apps/web/src/app/(teacher)/asignaciones/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/asignaciones/page.tsx#L1)
  10. [apps/web/src/app/(teacher)/asignaciones/nueva/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/asignaciones/nueva/page.tsx#L1)
  11. [apps/web/src/app/(teacher)/asignaciones/[id]/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/asignaciones/[id]/page.tsx#L1)
  12. [apps/web/src/app/(teacher)/grupos/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/page.tsx#L1)
  13. [apps/web/src/app/(teacher)/grupos/[id]/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/grupos/[id]/page.tsx#L1)
  14. [apps/web/src/app/(teacher)/alumnos/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/alumnos/page.tsx#L1)
  15. [apps/web/src/app/(teacher)/alumnos/[id]/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/alumnos/[id]/page.tsx#L1)
  16. [apps/web/src/app/(teacher)/actividades/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/actividades/page.tsx#L1)
  17. [apps/web/src/app/(teacher)/actividades/[id]/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/actividades/[id]/page.tsx#L1)
  18. [apps/web/src/app/(teacher)/actividades/nueva/page.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/actividades/nueva/page.tsx#L1)
* **Diagnóstico**: Viola la arquitectura RSC exigida por Cloudflare Workers (`vinext`) y la regla de guardrails `G-B04`. Sobrecarga el bundle de cliente e impide que `page.tsx` exponga metadatos SEO/OpenGraph desde el servidor.
* **Acción requerida**:
  * Para cada una de las 18 rutas: mover la lógica interactiva a un componente cliente adyacente (ej. `inicio-client.tsx`, `alumnos-client.tsx`), y dejar `page.tsx` como Server Component puro que exporta `metadata` y renderiza el cliente.

---

### Brecha 3: Persistencia de 11 `alert()` y 7 `confirm()` Bloqueantes (`ENG-159` / `RF-14`)
* **Llamadas a `alert()`**:
  1. `apps/web/src/app/inicio/page.tsx:101` (fallo al iniciar intento)
  2. `apps/web/src/app/inicio/page.tsx:108` (fallo al iniciar intento)
  3. `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx:319` (micrófono requiere HTTPS)
  4. `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx:360` (permiso denegado micrófono)
  5. `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx:378` (grabación menor a 2s)
  6. `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx:410` (token de intento ausente)
  7. `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx:442` (audio requerido antes de entregar)
  8. `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx:543` (fallo al completar entrega)
  9. `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx:564` (fallo al iniciar intento de microjuego)
  10. `apps/web/src/app/(student)/feedback/page.tsx:63` (fallo al reiniciar intento)
  11. `apps/web/src/app/(student)/perfil/perfil-client.tsx:80` (fallo al cambiar segmento)
* **Llamadas a `window.confirm()`**:
  1. `apps/web/src/app/(teacher)/actividades/page.tsx:118` (eliminar borrador)
  2. `apps/web/src/app/(teacher)/alumnos/page.tsx:144` (desbloquear cuenta)
  3. `apps/web/src/app/(teacher)/alumnos/[id]/page.tsx:185` (enviar reset contraseña)
  4. `apps/web/src/app/(teacher)/grupos/page.tsx:117` (archivar grupo)
  5. `apps/web/src/app/(teacher)/grupos/page.tsx:145` (eliminar grupo sin historial)
  6. `apps/web/src/app/(teacher)/grupos/[id]/page.tsx:84` (archivar grupo)
  7. `apps/web/src/app/(teacher)/grupos/[id]/page.tsx:110` (eliminar grupo)
* **Diagnóstico**: Congelan el hilo principal de renderizado en Chromium/WebKit en tablets compartidas y violan WCAG 2.2 AA.
* **Acción requerida**:
  * Sustituir los `alert()` informativos por banners de error accesibles (`role="alert"`) o toasts.
  * Sustituir los `confirm()` por un diálogo modal accesible con botones «Cancelar» y «Confirmar».

---

### Brecha 4: Accesibilidad WCAG 2.2 AA, Controles Inválidos y Modales (`ENG-159` / `RF-14`)
1. **Controles anidados inválidos (`WCAG 4.1.2`)**:
   * [apps/web/src/components/activities/games/MatchGame.tsx:259-305](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/components/activities/games/MatchGame.tsx#L259): `<div role="button">` anida un `<button>` de desvinculación.
   * [apps/web/src/components/activities/games/DragDropGame.tsx:320-375](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/components/activities/games/DragDropGame.tsx#L320): `<div role="button">` anida `<button>` para retirar objetos.
   * *Acción*: Separar los botones de desvincular fuera del botón de la tarjeta o convertir el contenedor en un contenedor no interactivo (`div` sin `role="button"`).
2. **Contraste Roto en Tema Teens**:
   * [apps/web/src/components/activities/games/MatchGame.tsx:263, 284](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/components/activities/games/MatchGame.tsx#L263): Al seleccionar tarjeta, se aplica `bg-amber-100/90` con texto `text-zinc-100` (`#f4f4f5`), dando una relación de contraste de **1.08:1** (mínimo AA es 4.5:1).
   * *Acción*: Forzar texto oscuro (`text-zinc-900`) cuando la tarjeta está seleccionada con fondo claro.
3. **7 Modales artesanales no accesibles**:
   * En `student-nav.tsx:218`, `alumnos/[id]/page.tsx:595`, `alumnos/[id]/page.tsx:683`, `alumnos/page.tsx:470`, `contenido-extra/page.tsx:510`, `activity-editor.tsx:2236`, `asignaciones/[id]/page.tsx:409`.
   * Carecen de trampa de foco (`focus-trap`), `aria-modal="true"`, y cierre con tecla `Escape`. En el modal de baja definitiva de alumno, el `<input placeholder="ELIMINAR">` carece de `<label>`.
   * *Acción*: Emplear una primitiva accesible (`@radix-ui/react-dialog` o wrapper reusable accesible).
4. **Botón TTS («Escuchar»)**:
   * Ausente en [GameRenderer.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/components/activities/GameRenderer.tsx) para niños de 7 a 10 años (perfil Kids).
   * *Acción*: Integrar botón TTS con `SpeechSynthesisUtterance` para enunciados de microjuegos.
5. **Skip Link**:
   * Ausente en [apps/web/src/app/layout.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/layout.tsx).
   * *Acción*: Añadir `<a href="#main-content" className="sr-only focus:not-sr-only ...">Saltar al contenido principal</a>`.

---

### Brecha 5: Plantillas de Correo y Job de Mantenimiento (`ENG-156` / `RF-8`)
* **Archivos**:
  * [apps/api/src/mail/templates.ts:141](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/mail/templates.ts#L141)
  * [apps/api/src/maintenance/maintenance.service.ts:710-717](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/maintenance/maintenance.service.ts#L710-L717)
* **Diagnóstico**:
  * En el correo de recordatorio a la profesora, el botón tiene `<a href="/inicio">` relativo; falla en clientes de correo externos.
  * Si `pendingApprovals === 0 && overdueReviews === 0`, el servicio marca el job como `JobRunStatus.done`. Esto bloquea por 3 días (`diffDays < 3`) el envío de alertas aunque ingresen entregas minutos después.
* **Acción requerida**:
  * Inyectar `${variables.webBaseUrl}/inicio` en el enlace.
  * Modificar `maintenance.service.ts` para que solo marque `done` si efectivamente se despachó un correo; si `pendingCount === 0`, registrar como omitido o no actualizar el timestamp de último envío exitoso.

---

### Brecha 6: Descarga por Streaming a Disco en Transcodificación de Audio (`ENG-154` / `RF-5`)
* **Archivo**: [apps/api/src/media/media.service.ts:503-509, 614-615](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/media/media.service.ts#L503-L509)
* **Diagnóstico**: Usa `transformToByteArray()` sobre `getRes.Body` cargando todo el audio en RAM (`Buffer.from(bytes)`) antes de `fs.writeFileSync()`. En el tier de Render Starter (512 MB de RAM) esto puede causar picos innecesarios de memoria.
* **Acción requerida**: Conectar el stream de S3 directamente a un `fs.createWriteStream()` usando `stream/promises` `pipeline()`.

---

## 3. Inventario de Desincronización Documental (`DOC-09`)

| Archivo | Problema Detectado | Corrección Requerida |
|---|---|---|
| [README.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/README.md) | Tipos y mecánicas inventadas (`multiple_choice`, etc.), asignaciones a estudiantes individuales, `fluent-ffmpeg`, falta de MinIO/Mailpit en Docker. | Alinear con `CONTEXT.md §6.1` (5 tipos, 5 mecánicas), eliminar asignaciones individuales, actualizar stack y Docker. |
| [.agents/CONTEXT.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/.agents/CONTEXT.md) | Línea 11 dice `SPEC-11 queda Aprobada`; tabla §11.1 congelada en Ronda 12 (`SPEC-06`); Decisión 128 figura como `Propuesto`. | Asentar SPEC-11 como Verificada, actualizar §11.1 hasta la Ronda 17, pasar Decisión 128 a `Decidido`. |
| [planning/taskboard.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/planning/taskboard.md) | Etapas 2 a 10 anidadas erróneamente bajo `## Backlog`; citas a `Howler.js` y `NetworkFirst` para API. | Mover Etapas 2–10 a su lugar correcto en el cuerpo del documento; limpiar menciones obsoletas de dependencias. |
| [planning/architecture-overview.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/planning/architecture-overview.md) | Nota de encabezado pendiente; cita `fluent-ffmpeg`; Catálogo de Errores (§13) incompleto (se detiene en SPEC-05); Decisión A87 como `Propuesto`. | Quitar nota, corregir a `spawn` de ffmpeg, añadir códigos de SPEC-06 a SPEC-11, marcar A87 como `Decidido`. |
| [specs/README.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/specs/README.md) | Contradicción interna: tabla dice `SPEC-11 Verificada`, pero texto dice `pendiente de implementación`. | Sincronizar texto y tabla reflejando el estado verificado de SPEC-11. |
| [specs/SPEC-08-estadisticas.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/specs/SPEC-08-estadisticas.md) | 9 RFs sin actualizar respecto a la exclusión de microjuegos de notas y la creación del ranking privado docente. | Parchar RF-1, 2, 4, 5, 6, 8, 9, 10, 12 bajo Decisión 137; registrar paso por `En revisión` y `Verificada`. |
| [specs/SPEC-06-microjuegos.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/specs/SPEC-06-microjuegos.md) | Conserva referencias a endpoints con `Assignment` (`POST /assignments/:id/attempts`). | Retirar `Assignment` de las secciones 5, 6 y 7 conforme a Decisión 130. |
| [planning/informe-etapa-12.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/planning/informe-etapa-12.md) | Declara falsamente 100% de cumplimiento en ENG-143, ENG-155, ENG-159 y DOC-09. | Actualizar el informe reflejando las brechas reales y los resultados de remediación. |
| [.agents/skills/englove-spec/scripts/check-spec.mjs](file:///c:/Users/sebas/OneDrive/Desktop/englove/.agents/skills/englove-spec/scripts/check-spec.mjs) | Cita `Supabase solo como Postgres`. | Actualizar a `Neon` (Decisión 121). |

---

## 4. Hoja de Ruta de Ejecución (Paso a Paso)

Para la siguiente sesión de desarrollo, ejecute las siguientes tareas en orden estricto:

### Paso 1: Remediación de Código Backend y Mantenimiento
1. Corregir enlace en [templates.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/mail/templates.ts#L141): `${variables.webBaseUrl}/inicio`.
2. Modificar [maintenance.service.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/maintenance/maintenance.service.ts) para que solo marque `status: JobRunStatus.done` si `pendingApprovals > 0 || overdueReviews > 0`.
3. Ajustar [media.service.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/media/media.service.ts) para descargar el stream S3 a disco con `stream/promises` `pipeline()`.
4. Ejecutar pruebas unitarias de API: `pnpm --filter @englove/api test`.

### Paso 2: Remediación de Código Frontend y Accesibilidad
1. Resolver Serwist / Service Worker: Integrar generación de manifiesto de activos de Vite en `sw.js`.
2. Migrar las 18 rutas `page.tsx` a Server Components:
   * Crear `*-client.tsx` para cada una con su lógica de estado y consultas TanStack.
   * En `page.tsx`, exportar `metadata` del servidor y renderizar el componente cliente.
3. Eliminar todas las 11 llamadas a `alert()` y 7 a `confirm()` reemplazándolas con componentes modales accesibles y toasts.
4. Saneamiento de Accesibilidad (WCAG 2.2 AA):
   * Desanidar botones en `MatchGame.tsx` y `DragDropGame.tsx`.
   * Corregir contraste de selección en tema Teens a `text-zinc-900`.
   * Integrar trampa de foco y listener `Escape` en los 7 modales artesanales.
   * Añadir botón TTS «Escuchar» en `GameRenderer.tsx`.
   * Añadir `SkipLink` en `apps/web/src/app/layout.tsx`.
5. Ejecutar pruebas unitarias de Web y chequeo de tipos: `pnpm --filter @englove/web test && pnpm --filter @englove/web typecheck`.

### Paso 3: Sincronización Documental Formal (`DOC-09`)
1. Actualizar [README.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/README.md) eliminando tipos/mecánicas inventadas y asignaciones individuales.
2. Actualizar [.agents/CONTEXT.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/.agents/CONTEXT.md) (Ronda 17, Decisión 128 Decidida, bitácora §11.1).
3. Actualizar [planning/taskboard.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/planning/taskboard.md) (desanidar Etapas 2–10 de Backlog y limpiar dependencias revocadas).
4. Actualizar [planning/architecture-overview.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/planning/architecture-overview.md) (catálogo de errores, ffmpeg spawn, decisión A87).
5. Parchar [specs/SPEC-08-estadisticas.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/specs/SPEC-08-estadisticas.md) y [specs/SPEC-06-microjuegos.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/specs/SPEC-06-microjuegos.md).
6. Actualizar [planning/informe-etapa-12.md](file:///c:/Users/sebas/OneDrive/Desktop/englove/planning/informe-etapa-12.md) con la evidencia real de cierre.

### Paso 4: Verificación Integral de Compuerta de Calidad
Ejecutar la suite completa de comandos obligatorios:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --all
```

Solo tras superar el Paso 4 con `0` errores se podrá proceder con la **Fase 3: Aprovisionamiento de Infraestructura Staging (Etapa 0)** y la **Fase 4: Lanzamiento del Piloto (Etapa 11)**.

---

## 5. Estado de Ejecución (2026-11-08) — Completado

Todos los pasos del plan fueron implementados y verificados:
- **Paso 1 (Backend):** Corregido `templates.ts`, `maintenance.service.ts`, `media.service.ts` (streaming S3), e `ISSUE-10` con `TenantContext.runBypass` en `auth.service.ts`.
- **Paso 2 (Frontend y A11y):** Serwist precache configurado, 18 rutas `page.tsx` migradas a Server Components con separación `*-client.tsx`, `alert()` y `confirm()` eliminados por completo, accesibilidad WCAG 2.2 AA (SkipLink, TTS en juegos Kids, modales accesibles con focus trap, contraste en Teens).
- **Paso 3 (Documentación):** Sincronización completa de `README.md`, `CONTEXT.md`, `taskboard.md`, `architecture-overview.md`, `specs/SPEC-06-microjuegos.md`, `specs/SPEC-08-estadisticas.md`, `specs/README.md`, `testing-issues/` e `informe-etapa-12.md`.
- **Paso 4 (Compuerta de calidad):** `pnpm lint` (0 errores), `pnpm typecheck` (0 errores), `pnpm test` (566/566 tests pasando), `pnpm build` (exitoso), `check-guardrails.mjs --all` (0 errores).

