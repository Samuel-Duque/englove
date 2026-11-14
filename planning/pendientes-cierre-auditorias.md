# Pendientes de Cierre de Auditorías — Englove

**Fecha de consolidación:** 2026-11-13 (actualizado tras cierre de `C-01`–`C-06`, endurecimiento §2 y `DAT-01` local)  
**Estado:** Cierre técnico local completado; pendientes exclusivamente operativos en CI remoto, staging y Etapa 11  
**Fuentes consolidadas:**
- [`planning/auditoria-adversarial-2026-11-13.md`](auditoria-adversarial-2026-11-13.md) (§5 «Riesgos difíciles, condicionados o sin reproducción completa» y §11 «Estado de remediación, pendientes y preguntas abiertas»)
- [`planning/remediacion-auditoria-2026-11-12.md`](remediacion-auditoria-2026-11-12.md) («Límites y pendientes operativos»)

> [!NOTE]
> Los 12 hallazgos reproducidos (`RT-01` a `RT-12`) y los 6 riesgos `C-01` a `C-06` de la auditoría del 2026-11-13, los 11 hallazgos de la auditoría del 2026-11-12 (`SEG-01`, `DEPLOY-01`, `OFF-01`, `PWA-01`, `TEN-01`, `QA-01`, `CI-01`, `CI-02`, `OPS-01`, `NEG-01`, `DOC-01`), el endurecimiento local de §2 y la verificación local aislada de `DAT-01` ya están implementados y verificados. Permanecen pendientes únicamente las compuertas que requieren push a GitHub Actions, aprovisionamiento en la nube de staging o dispositivos físicos.

---

## 1. Riesgos técnicos y de concurrencia (`C-01` a `C-06`) — Cerrados y verificados

Todos provienen de [`auditoria-adversarial-2026-11-13.md`](auditoria-adversarial-2026-11-13.md#L291-L303).

| ID | Riesgo y fuente | Remediación aplicada | Verificación ejecutada |
|---|---|---|---|
| **C-01** | **Revocación de sesión con `SID` conocido y `refresh` incorrecto** (`apps/api/src/auth/auth.service.ts`) | **Cerrado:** secretos de `refresh` generados con HMAC vinculado al `sid` y seguimiento LRU acotado de hashes rotados; solo se revoca la familia `AuthSession` ante replay acreditado, rechazando secretos arbitrarios con `401` sin revocar ni requerir `runBypass`. | `apps/api/test/auth.spec.ts` (38/38) y regresión en PostgreSQL real `apps/api/test/wp02-security-regression.postgres.spec.ts` (20/20). |
| **C-02** | **Clave S3 mutable entre validación y transcodificación de audio** (`apps/api/src/media/media.service.ts`) | **Cerrado:** `probeDuration` calcula SHA-256 en descarga, promueve el archivo válido a clave inmutable `_confirmed_<hash16>`, elimina mejor-esfuerzo la clave staging, verifica tamaño en rama `ready` y valida coincidencia de SHA-256 antes de `ffmpeg` (cierre seguro de streams en Windows/Node vía `closeReadStreamSafely`). | `apps/api/test/media.spec.ts` (29/29) y prueba E2E con PostgreSQL + MinIO + `ffprobe`/`ffmpeg` reales en `apps/api/test/attempts-adversarial-regressions.postgres.spec.ts`. |
| **C-03** | **`ffmpeg` sin mapa exclusivo de audio al recibir MP4 con vídeo** (`apps/api/src/media/media.service.ts`) | **Cerrado:** `probeDuration` rechaza cualquier contenedor con streams no-audio o distinto de 1 stream de audio; `transcodeAsset` ejecuta `ffmpeg` con `-threads 1 -map 0:a:0 -vn -sn -dn -fs 10485760`. | `apps/api/test/media.spec.ts` y `apps/api/test/attempts-adversarial-regressions.postgres.spec.ts` (vídeo MP4 `lavfi testsrc` rechazado y transcodificación audio WebM válida). |
| **C-04** | **Edición de actividad concurrente frente al primer inicio de intento** (`apps/api/src/activities/activities.service.ts`, `apps/api/src/attempts/attempts.service.ts`) | **Cerrado:** `updateActivity`, `deleteActivity`, `startAttempt` y `startGameAttempt` adquieren `SELECT ... FOR UPDATE` sobre `activities` y re-leen el estado bloqueado dentro de `$transaction`. | Regresión de bloqueo determinista (`FOR UPDATE`) y carrera `Promise.allSettled` en PostgreSQL real en `apps/api/test/attempts-adversarial-regressions.postgres.spec.ts`. |
| **C-05** | **Mantenimiento abandona intento sin condicionar el estado leído** (`apps/api/src/maintenance/maintenance.service.ts`) | **Cerrado:** abandono condicional mediante `updateMany` con `status: AttemptStatus.in_progress` en el `where` dentro de `runIdentityMaintenance`. | `apps/api/test/maintenance.spec.ts` (8/8) y prueba PostgreSQL intercalando `completeAttempt` y `runIdentityMaintenance` en `apps/api/test/attempts-adversarial-regressions.postgres.spec.ts`. |
| **C-06** | **Getters de media firman URL para assets en `pending_delete`** (`apps/api/src/media/media.service.ts`) | **Cerrado:** `getPlaybackUrl` y `getDownloadUrl` exigen `status === MediaAssetStatus.ready`, devolviendo `404 MEDIA_NOT_FOUND` para `pending_delete`, `pending_upload` y `deleted`; `transcodeAsset` usa `updateMany` condicional con `status: ready`. | `apps/api/test/media.spec.ts` y `apps/api/test/attempts-adversarial-regressions.postgres.spec.ts`. |

---

## 2. Endurecimiento de seguridad y supply chain

| Ítem | Fuente | Estado y verificación |
|---|---|---|
| **Contraseña por defecto en `seedMinimal`** | `apps/api/prisma/seeds/seed.ts` | **Cerrado:** `seedMinimal` exige `PILOT_TEACHER_PASSWORD` explícita (mín. 8 caracteres) cuando `APP_ENV !== 'local'`; probado en `apps/api/test/config.spec.ts` (`SEED-01`, 7/7). |
| **Cabeceras de seguridad HTML en Worker** | `apps/web/src/proxy.ts`, `apps/web/test/proxy-routing.spec.ts` | **Implementado y verificado en código/build:** `proxy.ts` aplica `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin` en todas las respuestas y redirecciones (propagadas por Vinext vía `mergeMiddlewareResponseHeaders`); orígenes `localhost`/`127.0.0.1`/`'unsafe-eval'` restringidos a `local`. Verificado en `proxy-routing.spec.ts` (24/24), `pnpm --filter @englove/web build` y Chromium E2E (`audit-session-regressions.spec.ts` 4/4). **Pendiente solo confirmar cabeceras servidas en Worker real al desplegar staging.** |
| **Pinning de imágenes Docker y acciones CI** | `docker-compose.yml`, `.github/workflows/ci.yml` | **Cerrado:** `pgsty/minio`, `pgsty/mc` y `axllent/mailpit` fijados con digest `@sha256:` (sin `:latest`); todas las acciones en `.github/workflows/ci.yml` fijadas por commit SHA de 40 caracteres (conservando `postgres:18-alpine` exigido por `ci-pipeline.test.mjs`). Verificado con `scripts/ci-pipeline.test.mjs` (`SUPPLY-01`, 5/5) y `apps/api/test/config.spec.ts`. |
| **Dependencia `deepmerge` (`GHSA-gcqx-w48m-w2h4`)** | `remediacion-auditoria-2026-11-12.md` | **Sin parche publicado aún (`4.3.1` es la última versión en npm):** re-evaluar y actualizar cuando el registro npm publique `4.3.2`. |

---

## 3. Decisiones tomadas (2026-11-13)

1. **`TRUST_PROXY` detrás de Cloudflare + Render — Decisión: mantener `'loopback, linklocal, uniquelocal'` en código y ajustar por variable de entorno en staging si hace falta.**
   - No se modifica `resolveTrustProxySetting` (`apps/api/src/common/utils/identity.utils.ts`): en `local` permanece `false` y en `staging`/`production` permanece `'loopback, linklocal, uniquelocal'`.
   - En el primer smoke en staging sobre Render, verificar qué devuelve `request.ip` en una petición real. Si refleja la IP del proxy en lugar de la del cliente final, fijar el número exacto de saltos mediante la variable de entorno `TRUST_PROXY` en Render (p. ej. `1` o `2`), sin cambios de código.
2. **Autenticación HTTP de Mailpit local (`MP_UI_AUTH`) — Decisión: mantener sin contraseña en `127.0.0.1:8025`.**
   - Dado que cada desarrollador trabaja en su propio equipo local y el puerto ya está restringido a loopback (`127.0.0.1:8025` en `docker-compose.yml`), no se activa `MP_UI_AUTH` para evitar fricción innecesaria en desarrollo y pruebas locales. Si en el futuro se comparte un mismo host multiusuario, se reevaluará añadir `MP_UI_AUTH` opcional.

---

## 4. Pendientes operativos de CI, Staging y Cierre del Piloto (Etapa 11)

- [x] **Prueba destructiva aislada de migraciones (`DAT-01`):** actualizada (`apps/api/test/audit-migration-procedure.postgres.spec.ts`) para aislarse en esquema efímero con `SAVEPOINT` y `ROLLBACK` final sin dejar bases ni esquemas huérfanos; ejecutada y aprobada (5/5) con `RUN_AUDIT_MIGRATION_POSTGRES=1` junto al resto de `@englove/api` (48/48 archivos, 482/482 tests), `@englove/shared` (5/5 archivos, 69/69), `@englove/web` build + Vitest (29/29 archivos, 285/285), `check-guardrails.mjs` (0 errores, 0 avisos), `pnpm lint` y `pnpm typecheck`. Pendiente re-ejecución en la corrida de CI remoto al hacer push.
- [ ] **GitHub Actions y enmienda `SPEC-08` (`NEG-01`):** subir cambios al remoto, verificar la primera ejecución completa del pipeline CI (incluyendo `DAT-01` en runner) y re-verificar `SPEC-08` tras la pasada en CI.
- [ ] **Aprovisionamiento y smoke en staging ([`planning/despliegue-staging.md`](despliegue-staging.md)):** configurar credenciales/variables, habilitar `STAGING_DEPLOY_ENABLED`, confirmar las cabeceras CSP/seguridad devueltas por el Worker desplegado, verificar `TRUST_PROXY` / `req.ip` real entre Cloudflare y Render, probar subida/transcodificación real en **Cloudflare R2** y envío real en **Resend**.
- [ ] **Cierre operativo de Etapa 11 (H1/H2/H3):** pruebas de carga (`k6`), prueba de restauración de backups en Neon, validación de observabilidad/Sentry sin PII, onboarding/contenido real y aceptación con **tablets y micrófono reales** (incluyendo Safari/iOS si aplica).
