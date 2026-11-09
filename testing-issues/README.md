> [!NOTE]
> **REGISTRO HISTÓRICO DE TESTING Y RFCs — 100% SUBSANADO Y VERIFICADO (2026-11-08).**  
> Este registro recopiló las fallas empíricas de testing manual (ISSUE-01 a ISSUE-10) y la solicitud de mejora de actividades multi-pregunta (RFC-01). Todos los ítems fueron corregidos en código, verificados y blindados con pruebas de regresión bajo la **Etapa 12 («Calidad y remediación»)** y la especificación [`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md) (en estado `Verificada`). No quedan incidencias abiertas de testing para el piloto.

# Registro de Errores y Mejoras — Sesión de Testing Dirigido y Auditoría

Este documento y directorio recopilan los errores, diagnósticos técnicos y solicitudes de mejora (RFC) identificados durante la sesión de testing manual y la exploración autónoma del sistema Englove.

**Reglas y Ciclo de Vida:**
1. **Fase de Detección:** Cada hallazgo se investigó a fondo, se identificó su causa raíz técnica y se documentó detalladamente.
2. **Fase de Corrección y Verificación (2026-11-06):** Los errores identificados fueron implementados en el código de producción con sus respectivas pruebas unitarias y de integración. Cada documento individual cuenta con su sección *Solución Implementada y Verificación*.

3. **Fase de blindaje (Etapa 12, decisiones 127 a 129 de CONTEXT §14, 2026-11-08):** la Etapa 12 «Calidad y remediación» ([`SPEC-11`](../specs/SPEC-11-calidad-y-correcciones.md), Verificada el 2026-11-08) tomó estos registros junto con `AUDITORIA.md` como insumo. Los ISSUE-01 a ISSUE-10 y el RFC-01 se encuentran formalmente resueltos y verificados; las tareas ENG-143 y ENG-150 a ENG-162 los verifican y los blindan con pruebas de regresión nombradas por su identificador (ISSUE-01 → ENG-154; ISSUE-02, ISSUE-03, ISSUE-06 y RFC-01 → ENG-156; ISSUE-04, ISSUE-08 e ISSUE-09 → ENG-155; ISSUE-05 e ISSUE-07 → ENG-150 y ENG-155; ISSUE-10 → ENG-151/ENG-152). La totalidad de los hallazgos cuenta con pruebas automatizadas en verde (566 tests en monorepo).

---

## 1. Índice de Errores y Diagnósticos (Issues)

| ID | Fecha | Módulo / Ruta | Resumen del Error | Severidad | Estado | Archivos Clave Involucrados |
|---|---|---|---|---|---|---|
| [ISSUE-01](ISSUE-01-revision-audio-corp-blocked.md) | 2026-11-06 | `/revision` | Bloqueo CORP (`net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`) al reproducir audio de speaking entre puerto 3000 y 3001 | Alta | ✅ Resuelto | `apps/api/src/main.ts`, `apps/api/src/media/media.controller.ts`, `apps/web/src/app/(teacher)/revision/page.tsx` |
| [ISSUE-02](ISSUE-02-group-detail-members-500.md) | 2026-11-06 | `/grupos/[id]` | Error 500 en `GET /api/v1/groups/:id/members?limit=100` por deserialización de `@Query()` como string hacia Prisma `take`, provocando pantalla de error | Alta | ✅ Resuelto | `apps/api/src/groups/groups.controller.ts`, `apps/api/src/groups/dto/groups.dto.ts`, `apps/web/src/app/(teacher)/grupos/[id]/page.tsx` |
| [ISSUE-03](ISSUE-03-archive-group-error-and-groups-audit.md) | 2026-11-06 | `/grupos` y `/grupos/[id]` | Error 409 al archivar grupos con miembros activos + Auditoría técnica completa de las 8 funcionalidades del módulo de grupos | Media | ✅ Resuelto | `apps/api/src/groups/groups.service.ts`, `apps/web/src/app/(teacher)/grupos/page.tsx`, `apps/web/src/app/(teacher)/grupos/[id]/page.tsx` |
| [ISSUE-04](ISSUE-04-indexeddb-missing-stores-error.md) | 2026-11-06 | `/actividad/[attemptId]` y `/juegos` | `Uncaught NotFoundError` en IndexedDB (`pendingEvents` no existe) provocado por apertura prematura sin versión en `auth-hygiene.ts` | Crítica | ✅ Resuelto | `apps/web/src/lib/auth-hygiene.ts`, `apps/web/src/lib/offline-queue.ts`, `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx` |
| [ISSUE-05](ISSUE-05-games-module-systemic-analysis.md) | 2026-11-06 | `/juegos` y `/actividad/[attemptId]` | Diagnóstico integral del módulo de microjuegos: fallo en cascada del transporte de eventos, condición de carrera en `/complete` y entrega en blanco con 0 estrellas | Crítica | ✅ Resuelto | `apps/web/src/lib/offline-queue.ts`, `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`, `apps/api/src/attempts/attempts.service.ts` |
| [ISSUE-06](ISSUE-06-ui-a11y-and-copy-polish.md) | 2026-11-06 | Varios formularios y `/progreso` | Advertencias de accesibilidad en formularios (campos sin `id`/`name`/`label`) y discordancia de número en racha semanal (`1 semana consecutivas`) | Baja | ✅ Resuelto | `apps/web/src/app/(teacher)/revision/page.tsx`, `apps/web/src/app/(student)/progreso/progreso-client.tsx`, `apps/web/src/app/(public)/registro/page.tsx` |
| [ISSUE-07](ISSUE-07-archived-activities-conflict-in-games.md) | 2026-11-06 | `/juegos` y `/assignments/:id/attempts` | Error 409 (`ACTIVITY_NOT_AVAILABLE`) al reintentar juegos archivados (Speed Quiz y Memory Cards) expuestos erróneamente en `scope=continuity` | Alta | ✅ Resuelto | `apps/api/src/attempts/attempts.service.ts`, `apps/api/prisma/seeds/seed-dev.ts`, `apps/web/src/app/(student)/juegos/juegos-client.tsx` |
| [ISSUE-08](ISSUE-08-duplicated-offline-sync-banner-on-interactions.md) | 2026-11-06 | `/actividad/[attemptId]` y `StudentShell` | Franja verde "¡Enviado!" duplicada y disparo invasivo en cada acierto/interacción por doble renderizado de `OfflineStatusBanner` y condición `justFlushed` | Media | ✅ Resuelto | `apps/web/src/components/student-shell.tsx`, `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`, `apps/web/src/lib/offline-queue.ts` |
| [ISSUE-09](ISSUE-09-rate-limiter-burst-lockout-in-activities.md) | 2026-11-06 | `/actividad/[attemptId]` y API Global | Bloqueo transitorio con error 429 (`RATE_LIMITED`) al entrar a una actividad tras jugar varias partidas por superar el umbral de 120 req/min debido a falta de micro-batching de eventos y duplicación de peticiones estáticas (`/me`, `/feature-flags`) | Alta | ✅ Resuelto | `apps/web/src/lib/offline-queue.ts`, `apps/web/src/lib/feature-flags-client.ts`, `apps/web/src/lib/auth-session.ts`, `apps/web/src/components/student-shell.tsx`, `apps/web/src/components/student-nav.tsx` |
| [ISSUE-10](ISSUE-10-auth-endpoints-500-tenant-extension-bypass.md) | 2026-11-08 | `/login`, `/registro`, `/recuperar` y API Auth | Error 500 en endpoints de autenticación (`login`, `refresh`, `signup`, `forgot-password`) por bloqueo de `findUnique` en modelo multi-tenant `User` sin bypass en `tenant-prisma.extension.ts` | Crítica | ✅ Resuelto | `apps/api/src/auth/auth.service.ts`, `apps/api/src/common/tenant/tenant.context.ts`, `apps/web/src/lib/auth-session.ts`, `apps/web/src/app/inicio/page.tsx` |

---

## 2. Solicitudes de Mejora y RFCs de Producto

| ID | Fecha | Título / Tema | Resumen de la Propuesta | Estado |
|---|---|---|---|---|
| [RFC-01](RFC-01-multi-item-activities.md) | 2026-11-06 | Actividades Multi-Pregunta (Preguntas Abiertas y más) | Soporte completo para múltiples preguntas abiertas en una sola actividad (`open_question`) con instrucciones generales, rúbricas individuales, contador de caracteres y revisión docente unificada. | ✅ Implementado |

---

## 3. Resumen del Estado de Rutas y Módulos Auditados

- **Autenticación y Cuentas:**
  - Login docente y estudiante (Kids y Teens): **Operativo**.
  - Registro de estudiantes y cálculo de fecha de nacimiento civil: **Operativo**.
  - Recuperación de contraseña y restablecimiento con token: **Operativo**.
  - Aprobación y asignación de grupo a nuevos estudiantes: **Operativo**.
- **Módulo de Docente:**
  - Creación y listado de actividades: **Operativo** (soporte para preguntas abiertas multi-ítem con RFC-01).
  - Asignaciones por grupo y fechas límite: **Operativo**.
  - Calificación docente y retroalimentación con stickers: **Operativo** (reproducción de audio desbloqueada y accesible tras resolver ISSUE-01).
  - Estadísticas por estudiante, grupo y tabla de líderes: **Operativo**.
  - Gestión de grupos: **Operativo** (resuelto error 500 y validación preventiva al archivar en ISSUE-02 e ISSUE-03).
- **Módulo de Estudiante:**
  - Portales Kids y Teens: **Operativo**.
  - Visualización de calificaciones y feedback de la docente: **Operativo**.
  - Progreso, racha semanal e insignias: **Operativo** (copy gramatical corregido en ISSUE-06).
  - Módulo de microjuegos interactivos: **Operativo** (cola offline reparada, sincronización defensiva en ISSUE-04/05/08, y micro-batching anti-429 en ISSUE-09).
