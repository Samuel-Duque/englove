# Evidencia local de remediación — auditoría 2026-11-11

Este documento distingue corrección de código, prueba local y aceptación operativa. No declara el lanzamiento ni H1/H2/H3 aprobados. El seguimiento integral está en [el documento de trabajo](../odd/tasks/audit-2026-11-11.md).

## DAT-01: preservar el historial, no repetir el descarte

La migración `20261108000000_autonomous_microgames` ya aplicada **no se modifica ni se vuelve a ejecutar sobre bases existentes**. No se cambian checksums ni se fabrican conteos históricos. Sin logs o respaldo anterior no es posible reconstruir honestamente cuántas filas descartó aquella ejecución.

La regresión `apps/api/test/audit-migration-procedure.postgres.spec.ts` aplica las tres migraciones previas reales en una base nueva, crea fixtures de dos organizaciones y ejecuta el SQL original dentro de una transacción explícita. Comprueba:

- Ante un error posterior al SQL, `ROLLBACK` restaura huellas de todas las filas y revierte el DDL.
- Al confirmar, elimina exclusivamente los juegos asignados; conserva las actividades académicas de ambos tenants y los badges.
- Registra conteos anteriores y posteriores mediante `RAISE NOTICE`, sin datos personales.
- El archivo original conserva exactamente sus bytes/checksum durante la prueba.

**Límite:** esto acredita el envoltorio explícito probado, no demuestra que `prisma migrate deploy` envuelva automáticamente el archivo histórico en una transacción. No se altera CI ni su runner como consecuencia de esta prueba.

### Repetición segura de la evidencia

Ejecutar únicamente contra el PostgreSQL de desarrollo local. El runner no usa `DATABASE_URL` ni el helper que hace fallback a `englove_dev`:

```powershell
$env:RUN_AUDIT_MIGRATION_POSTGRES = '1'
# URL administrativa local a /postgres; obtener usuario/contraseña del compose local.
$env:AUDIT_MIGRATION_ADMIN_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/postgres'
pnpm --filter @englove/api exec vitest run test/audit-migration-procedure.postgres.spec.ts
```

El runner rechaza hosts no loopback, bases administrativas distintas de `/postgres` y parámetros de conexión. Genera una base `englove_audit_migration_<uuid>` y muestra su nombre para limpieza explícita posterior; nunca reutiliza ni borra una base existente. Sin opt-in omite los dos casos PostgreSQL y ejecuta solo las comprobaciones de seguridad del destino.

### Antes de una aplicación futura que aún no tenga esta migración

1. Comprobar estado de migraciones y backup/restauración en una copia aislada. Si ya está aplicada, detenerse: no repetir borrados ni editar el historial.
2. Poner la aplicación en mantenimiento para que no escriba durante el procedimiento. Capturar checksum del SQL original y conteos de candidatos por tabla/tipo/organización, sin contenido personal.
3. La ejecución debe mantener **una misma conexión**, `BEGIN`, límites de espera, bloqueo de las tablas afectadas, registro de conteos, SQL original intacto y `COMMIT`; ante cualquier error, `ROLLBACK`. El test anterior demuestra estas propiedades del envoltorio. Añadir `BEGIN` en otra conexión que invoque Prisma no envuelve las consultas de Prisma.
4. **Antes de operar fuera del test, el líder debe aprobar cómo integrar ese envoltorio con el historial de Prisma.** El flujo normal sigue siendo `prisma migrate deploy`; ejecutar SQL manualmente y marcar la migración como aplicada es una recuperación excepcional, no una autorización implícita ni una instrucción para modificar CI. No se proporciona un comando destructivo listo para ejecutar contra una base existente.
5. Conservar logs de conteos, checksum, resultado transaccional y restauración ensayada. El hueco de evidencia de la ejecución histórica continúa explícito; esta prueba no lo borra.

## ENV-01/02: diagnóstico del runtime de audio

```powershell
node scripts/check-local-audio.mjs --help
node scripts/check-local-audio.mjs
```

El script usa `apps/api/.env` por defecto y respeta overrides del proceso. Exige `APP_ENV=local` y `R2_ENDPOINT` loopback explícito; rechaza destinos cloud antes de conectar. Ejecuta `ffmpeg -version` y `ffprobe -version` con `shell:false`, timeout, y `HeadBucket` autenticado. No lista, sube ni elimina objetos, no muestra credenciales y no instala binarios. Exit 0 significa prerrequisitos disponibles; exit 1 significa configuración o runtime incompletos.

En esta remediación se alinearon únicamente `R2_ENDPOINT` y las dos credenciales MinIO de `apps/api/.env` con el compose local autorizado; el archivo no se versiona y se preservaron las demás claves. El `.env` raíz preexistente se preservó.

**Evidencia observada:** `HeadBucket` autenticado local aprobado. `ffmpeg` y `ffprobe` no resolvieron en el PATH de este runtime; no se instalaron herramientas. El diagnóstico devuelve exit 1 por esos binarios ausentes. Ni `HeadBucket` ni las regresiones con mocks acreditan speaking real completo: siguen pendientes grabación/subida → confirmación con ffprobe → entrega → transcodificación → recuperación y retención sobre S3 local real.

## Pendiente operativo

- Proveer un runtime local ya equipado con ffmpeg/ffprobe y repetir el flujo real; no usar cloud como sustituto.
- Aprobar el procedimiento excepcional de futura aplicación de DAT-01 si existe una instalación que aún necesite esa migración.
- No certificar tablets, micrófono físico, staging, backup/restauración ni aceptación docente a partir de estas pruebas.

## NEG-01: aprobación contractual pendiente

CONTEXT §5.1 exige un umbral por organización y las decisiones 83/132 establecen `games.config.passing_score` como fuente canónica para actividades asignadas, independiente de las estrellas de práctica. SPEC-08 RF-9 y §4.2 todavía fijan 3,0 como constante. Cambiar ese RF requiere volver a `En revisión` y aprobación explícita del líder antes de implementar (decisión 128 y sdd-process §6).

**Propuesta para aprobación:** RF-9 clasifica `score >= passing_score` según la configuración de la organización consultada con `FeatureFlagsService.getConfiguration(organizationId)`; la configuración inicial conserva 3,0. La respuesta `performance.passingScore` refleja el umbral efectivo. Las estrellas y puntos de los juegos no cambian, aunque el flag `games` esté apagado. Regresión prevista: dos organizaciones con umbrales distintos y la misma nota, sin mezcla tenant ni cambios de tramos de estrellas.

Esta propuesta no constituye aprobación, implementación ni prueba superada. No se cambió el estado histórico de SPEC-08 ni se fabricó una nueva decisión del líder.

## Evidencia de las correcciones implementadas

| Hallazgos | Corrección / prueba observada |
|---|---|
| SEG-01 / OFF-01 | Bloqueo local de cierre pendiente, revocación reconciliada, rechazo de respuestas tardías, identidad offline obligatoria y cancelación al cambiar cuenta. La cola de audio también confirma el objeto antes de entregar. Regresiones Vitest y navegador con cookies HttpOnly retenidas. |
| AUD-01/02/03 | Bypass interno ejecutable en recuperación/retry y propagación del fallo S3 local. 34/34 pruebas de audio/retención con hooks tenant reales; tres regresiones fallan contra baseline y pasan contra candidato. No acredita ffmpeg/S3 completos. |
| TEN-01 | Filtros explícitos en actividades, intentos, revisiones, alumnos y media. Verificación independiente: operación cruzada 404 sin mutación y hash de datos intacto; comportamiento autorizado previo conservado. |
| UX-01/02 | Navegación docente adaptativa y targets mínimos 48×48; botón Escuchar con mínimos explícitos. Navegación/logout medidos en 320/390/768/1280 sin overflow. |
| QA-01/02/03 | Presupuesto propio para análisis AST; fixture archivada con perfil/flags coherentes; medición local separada de módulos servidor gzip, no confundir con SW cliente ni con despliegue. |
| DOC-01–06 / GOV-01 | Contratos de cookies/sesión/audio, retirada de mocks/Howler y distinción de registros históricos frente a evidencia operativa. SPEC-05 sin nuevo RF ni cambio de estado; validador 0 errores/avisos. |

Suite completa Chromium: **50/50**, exit 0, con API parcialmente interceptada por fixtures. No equivale a integración íntegra con la API ni aceptación de usuarios reales. Guardrails: **0 errores, 31 avisos, 73 supresiones**; self-check: 37 reglas sincronizadas. Los avisos pendientes no se reinterpretan como cumplimiento semántico total.

## Verificación final local

- Lint y typecheck recursivos: exit 0.
- Vitest: shared 68/68, API 444/444 con PostgreSQL aislado y cero omitidas, web 249/249.
- Builds de shared/API/web: exit 0. Sobre artefactos recién construidos: SW/Worker servidor 10/10. Advertencias de sourcemaps, import dinámico y rutas Unknown conservadas; no se certifica despliegue.
- Todos los validadores SPEC-01 a SPEC-11: 0 errores/avisos.
- Comprobación independiente T1/T2/T3 sin bloqueantes nuevos reproducidos; no sustituye revisión nativa pendiente del candidato final.
- Bases sintéticas de esta remediación eliminadas; englove_dev no se usó para migraciones ni fixtures. Sin commits, push, PR ni despliegue.

**Estado global: parcial, no 100% corregido.** NEG-01 requiere aprobar el cambio de RF descrito arriba; audio real sigue pendiente del runtime y DAT-01 no puede fabricar evidencia histórica. El detalle de continuidad permanece en el documento de trabajo.
