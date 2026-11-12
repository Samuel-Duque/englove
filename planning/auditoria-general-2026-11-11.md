# Auditoría general de Englove — 11 de noviembre de 2026

> **Veredicto:** implementación extensa y con fundamentos sólidos, pero con defectos confirmados, contradicciones documentales y verificaciones incompletas. **No se acredita cumplimiento total de los guardrails ni funcionamiento integral del entorno local.** No corresponde equiparar las specs «Verificadas» con autorización de lanzamiento.

## 1. Resumen ejecutivo

| Dimensión | Resultado |
|---|---|
| Arquitectura y calidad base | Monorepo modular, tipado estricto, contratos compartidos, protección tenant y validación en dos niveles; lint, typecheck y los tres builds locales satisfactorios. |
| Backend | **426 pruebas aprobadas**, incluidas **55 con PostgreSQL real** en una base aislada. Sin embargo, la recuperación y los reintentos de transcodificación fallan al combinarse con la extensión tenant real. |
| Frontend | **234 pruebas aprobadas y un timeout** en la suite completa de 235; el archivo afectado pasa aislado. Logout fallido permite recuperar la cuenta anterior. Desbordamiento docente reproducido en móvil/tablet. |
| Navegador | Primera ejecución: **39/44 aprobadas**. Repetición de los cinco fallos: **4 aprobados y 1 fallido**. No existe una ejecución íntegramente verde de los 44 casos en esta auditoría. |
| Documentación y specs | Las 11 specs superan el validador estructural. Hay contradicciones activas en sesión, audio, mocks locales, preguntas abiertas y umbral de aprobación. |
| Guardrails | Escaneo: **342 archivos, 0 errores, 59 avisos y 70 supresiones**. Catálogo/script: **37 reglas sincronizadas**. El resultado sintáctico favorable no detecta varios incumplimientos semánticos confirmados. |
| Entorno local | PostgreSQL confirmado; API, MinIO y Mailpit disponibles al final. `.env` no apunta a MinIO mediante `R2_ENDPOINT`; `ffmpeg` y `ffprobe` no están disponibles en el PATH de esta sesión. No se acredita speaking real de extremo a extremo. |
| Estado del proyecto | Desarrollo técnico avanzado, con remediación residual necesaria. Etapa 11/lanzamiento y acreditaciones operativas siguen pendientes; Fases 2–3 no forman parte del piloto implementado. |

**Prioridad recomendada:** resolver logout y cola de audio; acreditar el flujo local real de audio; alinear contratos documentales; endurecer aislamiento offline y pruebas de integración; corregir navegación docente móvil. No ampliar funcionalidades antes de estabilizar estas fronteras.

## 2. Alcance, método y preservación

- Repositorio: `C:\Users\1\Desktop\Samuel\Englove`, rama `develop`, referencia inicial `181a8ddde6ab2e685fb3234ec1a293d99d414e04`.
- Fecha del informe: **2026-11-11, America/Bogota**. Las comprobaciones describen esta sesión, no una certificación permanente.
- Se revisaron, en orden de autoridad, `.agents/CONTEXT.md`, arquitectura, proceso SDD, plan por etapas, taskboard, specs y código. Se distinguieron documentos activos de auditorías/planes históricos.
- Revisión documental, backend/seguridad y frontend/calidad mediante auditores de solo lectura; contraste del auditor principal con fuentes, comprobaciones locales, navegador y artefactos de build.
- Se utilizaron `englove-guardrails`, `englove-spec`, `security-review`, `nestjs-best-practices`, `prisma-client-api`, `prisma-cli`, `supabase-postgres-best-practices` —solo PostgreSQL genérico—, `domain-modeling`, `vercel-react-best-practices`, `pwa-development`, `accessibility`, `web-design-guidelines`, `webapp-testing`, `playwright-best-practices`, `systematic-debugging`, `verification-before-completion` y `cognitive-doc-design`.
- Se consultó `code-review`; su flujo de diff contra un punto fijo no corresponde a esta auditoría del estado completo. No se inventó una rama base ni se inició una revisión de un candidato de implementación.
- **No se desplegó, publicó, instaló ni probó staging/producción.** No se probaron credenciales, dominios, planes ni conexiones cloud. Se consultó únicamente una guía pública de UI como referencia auxiliar, sin enviar código o configuración.
- Las 55 pruebas PostgreSQL usaron una base nueva, `englove_audit_20261111`, con las cuatro migraciones SQL y fixtures propios. Se eliminó después. `englove_dev` solo fue consultada en transacciones de lectura por el auditor.
- Se capturó un correo sintético exclusivamente en Mailpit local usando `MailService` real y se eliminó solo ese mensaje. No se enviaron correos a destinatarios reales.
- Este informe es el único documento creado por la auditoría. No se aplicaron correcciones manuales al código, configuración ni documentos existentes. Los builds generaron salidas ignoradas. Se restauró el delta generado por Next en `next-env.d.ts`.
- **Trabajo concurrente:** durante la sesión apareció un cambio ajeno en `docker-compose.yml` que sustituyó las imágenes de MinIO por `pgsty/minio` y `pgsty/mc`. También se iniciaron servicios locales. Ese cambio se preservó; no se auditó la procedencia de las imágenes ni se atribuye a esta auditoría. El entorno no fue una instantánea inmutable.
- Engram no estuvo expuesto como herramienta y no se pudo resolver su proyecto ni consultar/guardar memoria. Tampoco existía `.atl/skill-registry.md`; se cargaron directamente las skills instaladas del proyecto. Esto no sustituyó ni bloqueó la evidencia del repositorio.

### Cómo interpretar el informe

**Confirmado** significa evidencia de código/contrato o reproducción indicada expresamente. **Pendiente** significa que no hay prueba suficiente. Un test con mocks no acredita almacenamiento, correo ni autorización reales; un escaneo limpio no acredita cumplimiento semántico exhaustivo.

Las referencias `archivo:línea` son relativas a la raíz anterior y al contenido inspeccionado. Las recomendaciones no autorizan cambios ni añaden requisitos al piloto.

## 3. Estado por fases y especificaciones

El recuento del taskboard coincide con su resumen: **135 tareas únicas: 122 Hecho, 5 Por hacer y 8 Backlog**. Las 11 specs figuran **Verificadas**; no se cambiaron sus estados.

| Etapa / spec | Estado y límite de acreditación |
|---|---|
| Etapa 0 | ENG-001, ENG-003, ENG-004, ENG-007 y ENG-008 continúan Por hacer (`planning/taskboard.md:196-205`). La preparación operativa y la observación de usuarios no están completadas. |
| Etapa 1 / SPEC-01 | Scaffold implementado y spec Verificada. Lint, tipos y builds locales favorables; no equivale a infraestructura desplegada. |
| Etapa 2 / SPEC-02 | Identidad/sesión implementadas. Se confirma un defecto en logout ante fallo de la API y una contradicción en la documentación arquitectónica. |
| Etapa 3 / SPEC-03 / H1 | Cierre técnico declarado; onboarding docente sin ayuda y evidencia operativa en staging pendientes. |
| Etapa 4 / SPEC-04 | Gestión de asignaciones implementada; pruebas PostgreSQL de flujos y concurrencia satisfactorias. |
| Etapa 5 / SPEC-05 / H2 | Portal/intentos implementados; speaking real local no acreditado y cola de audio defectuosa. Validación con usuarios/dispositivos sigue pendiente. |
| Etapa 6 / SPEC-06 | Cinco mecánicas y juegos autónomos implementados; falta acreditación operativa en tablets reales. |
| Etapa 7 / SPEC-07 / H3 | Revisión/feedback implementados; pruebas API favorables. Evidencia operativa con usuarios/grabaciones reales pendiente. |
| Etapa 8 / SPEC-08 | Estadísticas implementadas; contradicción entre umbral configurable y constante 3,0. |
| Etapa 9 / SPEC-09 | PWA/accesibilidad implementadas; build Serwist real confirmado. Ciclo de instalación/actualización/offline real no acreditado aquí; hay incumplimientos del objetivo táctil interno. |
| Etapa 10 / SPEC-10 | Contenido extra implementado; flujos web con mocks revisados. No se evaluó calidad pedagógica ni disponibilidad de cada recurso externo. |
| Etapa 12 / SPEC-11 | Formalmente cerrada y Verificada. Los hallazgos de esta auditoría revelan deuda residual; no se reabrieron tareas automáticamente. |
| Etapa 11 / H4 | **Lanzamiento no cerrado:** ocho tareas Backlog relativas a validación en staging, observabilidad, backups/restauración, contenido, go/no-go, producción, altas reales y manual docente. No se ejecutaron esas tareas. |
| Fases 2–3 | Futuras y fuera del alcance implementado del piloto; no se contabilizan como funcionalidades faltantes. |

**Ambigüedad de gobernanza:** `planning/sdd-process.md:195` relaciona Verificada con CI y, si aplica, aceptación docente en staging; SPEC-03 mantiene pruebas manuales pendientes (`:263,268,291,293`) y el taskboard separa cierre técnico/operativo (`:221,229,237,253`). Hay trazabilidad y decisiones del líder, por lo que no procede invalidar estados automáticamente. Conviene formalizar dos acreditaciones distintas: **verificación técnica** y **aceptación operativa**.

## 4. Evidencia de ejecución

Runtime observado: **Node 24.14.0 y pnpm 11.5.1**.

| Comprobación | Resultado observado |
|---|---|
| `pnpm -r --if-present lint` | Exit 0; API, web y shared; 43,21 s. |
| `pnpm -r --if-present typecheck` | Exit 0; API, web y shared; 67,22 s. |
| Shared / Vitest | 4 archivos, **68/68 aprobados**. |
| API / Vitest sin PostgreSQL | 31 archivos, **371/371 aprobados**, 72,58 s. |
| API / PostgreSQL aislado | 8 archivos, **55/55 aprobados**, 0 omitidos, 263,97 s. |
| Web / Vitest completo | 23 archivos, **234 aprobados, 1 timeout**, exit 1. |
| Web / archivo `wp09-regressions.spec.ts` aislado | **3/3 aprobados**; el análisis AST tardó 4277 ms frente al límite de 5000 ms. No convierte retroactivamente la suite completa en verde. |
| Build shared | Exit 0, CJS/ESM/DTS; 63,96 s en repetición autorizada. |
| Build API | Exit 0; 130,56 s; observado `apps/api/dist/src/main.js`. |
| Build web local, Vite/vinext | Exit 0; 171,03 s; sin deploy. Serwist: 67 entradas de precaché, 1292,28 KiB. |
| Verificación SW después del build | `vitest run test/service-worker-build.spec.ts --maxWorkers=1 --no-file-parallelism`: **9/9 aprobados**, exit 0. |
| Playwright completo, Chromium headless | **39 aprobados, 5 fallidos**, 12,5 min, exit 1. API interceptada parcialmente mediante mocks. |
| Playwright, repetición de los cinco fallos con traza | **4 aprobados, 1 fallido**, 2,3 min, exit 1. |
| Validadores de las 11 specs | **0 errores, 0 avisos**. El auditor principal repitió SPEC-11: mismo resultado. |
| Guardrails `--all` | 342 archivos; **0 errores, 59 avisos, 70 supresiones**. |
| Guardrails `--self-check` | 37 reglas catálogo/script sincronizadas; decisiones hasta la 145. Repetido por el auditor principal. |
| Copias de skills propias | SHA-256 coincidente entre `.agents`, `.claude` y `.kiro`: cinco archivos de englove-spec y tres de englove-guardrails. |
| Enlaces Markdown locales | 0 destinos relativos inexistentes en 20 documentos activos; no se verificaron anclas ni enlaces externos. |
| Axe adicional | Sin violaciones de los tags AA seleccionados en login y `/alumnos` con sesión simulada. No es certificación WCAG. |

### Incidencias de ejecución y límites

- Algunas invocaciones de esbuild no arrancaron por restricciones de lectura de directorios superiores. Las repeticiones autorizadas sí ejecutaron tests/builds. Se distingue fallo ambiental de aserción fallida.
- Se usaron scripts directos por paquete: las tareas raíz de Turbo encadenan builds/generación Prisma. **No se afirma haber ejecutado `pnpm test` o `pnpm build` raíz en verde.**
- El build web advirtió de escritura EPERM del log de Wrangler, `SOURCEMAP_BROKEN` y clasificación estática `Unknown` de algunas rutas; terminó con exit 0. Se desactivó telemetría durante builds. No se midió el bundle comprimido final de despliegue.
- En la primera suite Playwright hubo tres fallos de navegación docente que pasaron al repetirlos. El caso `/extra` terminó con `ERR_CONNECTION_RESET` coincidiendo con reconstrucción de `shared/dist` y caída del servidor Next; también pasó al repetirlo. **No se consideran cuatro defectos funcionales estables.** La superposición de build y servidor limita esa primera medición.
- El caso de actividad archivada sigue fallando. Véase QA-02: no llegó a probar el comportamiento de negocio que nombra.
- No se ejecutaron pruebas físicas de micrófono, lectores de pantalla, tablets, Safari/iOS, carga sostenida, restauración de backups ni cron sobre datos existentes.

## 5. Hallazgos de código, negocio y seguridad

### SEG-01 — Logout fallido permite volver a la cuenta anterior

**Prioridad alta. Confirmado en navegador con fallo de red y con HTTP 500.**

- `apps/web/src/components/student-nav.tsx:60-74` y `teacher-nav.tsx:27-43` ignoran errores de red y no comprueban `response.ok`; siempre limpian estado cliente y navegan a `/login`.
- `apps/web/src/lib/auth-hygiene.ts:145-157` elimina indicadores JavaScript, pero no puede revocar ni borrar cookies HttpOnly.
- `apps/web/src/proxy.ts:122-125` redirige de `/login` a `/inicio` si sigue presente el access token; `apps/web/src/app/inicio/inicio-client.tsx:40-58` vuelve a consultar la sesión.
- Reproducción: sesión docente simulada, access/refresh cookies **HttpOnly**, GET de sesión disponible y `POST /auth/logout` devolviendo 500. Tras pulsar «Cerrar sesión», la URL vuelve a `/inicio`, aparece «Panel Docente — Inicio» y permanecen ambas cookies. También se reprodujo abortando la petición de logout.

**Impacto:** en un equipo compartido, una persona puede creer que salió y dejar una cuenta todavía utilizable. La limpieza local implementada no resuelve esta condición de fallo. No requiere comprometer JWT ni demostrar acceso entre tenants.

**Fuente:** G-C13, SPEC-02 RF-18, SPEC-11 RF-6 y decisiones 139/145.

**Recomendación:** distinguir cierre confirmado de cierre local no confirmado; impedir reentrada automática y reconciliar la revocación cuando vuelva la API. Debe preservarse el contrato de sesión continua: borrar cachés o intentar borrar HttpOnly desde JavaScript no es solución suficiente. Añadir regresiones para timeout, error de red y 500.

### AUD-01 — La recuperación de transcodificaciones al arrancar es inoperante

**Prioridad alta. Reproducido con código actual y extensión tenant real, sin DB/red.**

`apps/api/src/media/media.service.ts:96-117` ejecuta `mediaAsset.findMany` sin `organization_id`, contexto tenant ni `runBypass`. La extensión real lo rechaza (`apps/api/src/common/tenant/tenant-prisma.extension.ts:122-143`) y el catch silencia el error. El comentario `guardrails-ignore` no establece un bypass de ejecución.

El probe cargó TypeScript en memoria y usó un delegado de consulta falso detrás de la extensión real: **cero consultas llegaron al delegado**, aunque `onModuleInit()` terminó normalmente.

**Impacto:** un reinicio puede dejar pendientes de audio abandonados sin que el arranque avise. **Fuente:** G-B09/G-A06, decisiones 64/84, SPEC-05 RF-14.

**Recomendación:** contexto explícito o bypass interno autorizado y acotado para recuperar pendientes; error observable y regresión que combine cola y extensión real.

### AUD-02 — El reintento de audio queda fuera del contexto autorizado

**Prioridad alta. Reproducido en memoria con extensión real.**

En `media.service.ts:720-738`, `transcodeAsset` está dentro de `TenantContext.runBypass`, pero la consulta `findUnique` para decidir el reencolado (`:729`) está fuera. La extensión la rechaza y otro catch la silencia.

Probe observado: `attemptedTranscodes=1`, `retryLookupsReachingDelegate=0`, `remainingQueue=0`. No se produce el reintento esperado antes del máximo de tres. `apps/api/test/media.spec.ts:499-511` usa un Prisma mock permisivo que omite esta interacción.

**Fuente:** G-B09, decisión 84. **Recomendación:** mantener la identidad/autorización interna durante la recuperación y probar primer fallo transitorio, reencolado y fallback definitivo usando la extensión real.

### DAT-01 — La migración de juegos no incorpora toda la trazabilidad exigida

**Prioridad media; integridad del procedimiento, sin daño observado.**

`apps/api/prisma/migrations/20261108000000_autonomous_microgames/migration.sql:5-28` elimina eventos, intentos y asignaciones históricas. El archivo no incluye `BEGIN`/`COMMIT`, registro de conteos ni `RAISE NOTICE`, pese a lo exigido en `.agents/CONTEXT.md:657` —decisión 136— y `specs/SPEC-11-calidad-y-correcciones.md:156`.

La eliminación de esos datos de prueba está autorizada; **no se considera un borrado de negocio no solicitado**. Falta el registro explícito exigido y acreditar la atomicidad efectiva del procedimiento. No se demostró una ejecución parcial ni pérdida de datos reales. Las migraciones de la base local constan finalizadas.

**Recomendación:** revisar el runner y la evidencia de transacción/conteos antes de futuras aplicaciones; no editar irreflexivamente una migración ya aplicada por sus checksums e historial.

### AUD-03 — El borrado S3 local puede informar éxito sin borrar el audio

**Prioridad media. Defecto confirmado por trazado del código; no se provocó sobre audios existentes.**

`media.service.ts:688-702` convierte cualquier error S3 en éxito si `APP_ENV=local`, con mensaje «deleteFile simulado en local». `maintenance/maintenance.service.ts:566-589` marca entonces el activo como `deleted`, en vez de conservar `pending_delete` para reintentar.

**Impacto:** MinIO caído o permisos incorrectos pueden dejar objetos residuales mientras DB informa borrado. No demuestra lectura pública. Contradice el objetivo de flujo local real de la decisión 134 y limita la acreditación G-B10/G-C13 de retención.

**Recomendación:** conservar errores reales de almacenamiento y probar recuperación de retención después de una caída de MinIO.

### NEG-01 — El umbral académico configurable contradice la constante de estadísticas

**Prioridad media. Contradicción contractual y de implementación confirmada.**

`.agents/CONTEXT.md:194` y `planning/architecture-overview.md:339` requieren umbral por organización/configuración. `specs/SPEC-08-estadisticas.md:118` fija 3,0; `apps/api/src/stats/stats.service.ts:53,1179,1534` usa esa constante y no consume `passing_score`, que sí existe en `feature-flags.service.ts:73-98`.

Con configuración igual a 3,0 la diferencia queda oculta; con otro valor las clasificaciones no seguirían la fuente superior. No se cambió configuración para provocar el caso.

**Recomendación:** alinear la spec y la implementación con la decisión vigente antes de cambiar comportamiento. No confundir este umbral con los tramos fijos de estrellas de práctica.

### TEN-01 — El doble filtro tenant no se cumple literalmente en todas las mutaciones

**Prioridad media; defensa en profundidad, no IDOR demostrado.**

Mutaciones por ID sin `organization_id` explícito, entre otros ejemplos: `activities.service.ts:563-564,926-927`, `attempts.service.ts:955-956,1215-1216,1791-1792`, `reviews.service.ts:536-537` y `students.service.ts:1129-1134`, en sus respectivos módulos de `apps/api/src`.

G-A06 exige extensión **más** filtro del servicio. Una lectura previa autorizada no satisface esa convención. La extensión activa añade tenant y varias rutas verifican previamente la pertenencia: **no se encontró aquí un IDOR explotable de alta confianza**.

**Recomendación:** completar los filtros y probar mutaciones/transacciones entre tenants. No contabilizar automáticamente cada aviso del scanner como vulnerabilidad: algunos filtros se construyen en variables y hay bypasses legítimos.

### OFF-01 — La sincronización offline admite omitir la identidad activa

**Prioridad media. Incumplimiento estático confirmado; fuga o carrera efectiva no demostradas.**

- SPEC-11 RF-6 (`:52`) exige identidad activa obligatoria.
- `apps/web/src/lib/offline-queue.ts:188,504,541-542` acepta identificador opcional; sin él selecciona todas las entradas.
- Callers sin ID en `offline-queue.ts:424,434,838`, `offline-status-banner.tsx:51,104` y `student-nav.tsx:80,90,96`.
- `student-shell.tsx:21-25` purga cuentas ajenas después de cargar perfil; el refresco silencioso de `login-client.tsx:51-82` no espera esa purga.

**Riesgo:** reenviar registros huérfanos durante reconexión/refresco antes de completar higiene. El backend debe rechazar el intento ajeno, pero eso no sustituye el aislamiento obligatorio del cliente. G-C13.

**Recomendación:** ID obligatorio en conteo/flush y sincronización suspendida hasta resolver identidad; regresión con entradas A/B, refresco silencioso y reconexión. No afirmar acceso a datos ajenos sin esa reproducción.

## 6. Documentación: incongruencias y ambigüedades

| ID / prioridad | Evidencia y consecuencia | Recomendación |
|---|---|---|
| DOC-01 / Media — sesión | `architecture-overview.md:615` describe dos cookies y refresh Path `/api/v1/auth/refresh`; CONTEXT:665, decisión 139, y SPEC-02:122-123 requieren `/api/v1/auth`, `session_hint` y GET `/auth/session`. Architecture:824 no refleja la excepción Secure local de decisión 145. | Consolidar contrato actual de sesión, logout y excepción consciente de `session_hint` no HttpOnly. G-B11. |
| DOC-02 / Media — audio | Architecture:743-746,1092 y pbp:369 sitúan confirmación en `complete`; CONTEXT:668, decisión 142, y SPEC-05:189,196 exigen `/media/:id/confirm` previo. | Separar subir → confirmar → entregar → transcodificar. G-B10/G-B13. |
| DOC-03 / Media — mocks locales | `pbp-development.md:618` exige `mock-upload` y `mock-stream`; CONTEXT:655/decisión134 y SPEC-11:48,141 los eliminan. Architecture:1218 ya refleja lo correcto. | Retirar la instrucción activa de conservar mocks y referenciar MinIO firmado. |
| DOC-04 / Media — multipregunta | SPEC-05:196 solo describe `itemId=activity.id`; SPEC-03:156 y SPEC-11:139 admiten también `question.id` para `items[]`. | Enlazar el contrato ampliado y su compatibilidad. No asumir fallo actual del renderer por esta omisión documental. G-C12. |
| DOC-05 / Baja — resúmenes activos | sdd-process:7,231 y pbp:9 conservan 566 tests; CONTEXT:11, taskboard:5 y SPEC-11:249 registran 729 y 44 E2E. sdd-process:93 aún muestra SPEC-11 Aprobada; pbp:348 mantiene una dependencia de SPEC-05 ya Verificada. | Mantener cifras históricas fechadas y una referencia única para el estado actual. Un conteo histórico distinto no es por sí solo un error. |
| DOC-06 / Baja — audio de juegos | `pbp-development.md:442` conserva Howler.js; decisión107, SPEC-06 y el propio pbp:627 exigen retirar la referencia activa. | Alinear la sección con el mecanismo adoptado. |
| GOV-01 / Media — significado de Verificada | Proceso y estados mezclan cierre técnico con acreditaciones externas aún pendientes; véase sección 3. | Formalizar ambas acreditaciones sin cambiar estados ni decisiones por iniciativa de la auditoría. |

### Documentos históricos y evidencias que no deben confundirse con tareas vigentes

- `HU/Epicas_HU.md:1-5` delimita expresamente Etapas 0–8 y 451 pruebas; no es descripción completa actual.
- `planning/plan-remediacion-etapa-12.md:1-3` y los planes de implementación de auditoría están archivados/cerrados: no se reabrieron sus hallazgos antiguos como si fueran nuevos.
- `planning/poc-eng-140-informe.md:6` reconoce enlaces `file:///` de otro equipo y evidencia de prototipo no versionada. Su GO condicionado no acredita despliegue final.
- `planning/informe-etapa-9.md:14-16` tiene una fila con modelos alternativos de dispositivo y métricas sin artefactos crudos vinculados. El commit citado `12f6e6bd` existe, pero aquí no se reprodujeron sus mediciones físicas. Conviene registrar equipo exacto, muestras, fecha y trazas al repetirlas.

## 7. Entorno local y variables de entorno

**No se publican valores de secretos ni cadenas de conexión.** Se inspeccionaron `.env`, `apps/api/.env` y `apps/web/.env`, sin abrir `.env.staging`.

Los tres archivos observados tenían el mismo conjunto de 16 claves y `APP_ENV=local`. Frente a `.env.example` faltaban `R2_ENDPOINT`, `NEXT_PUBLIC_COOKIE_PREFIX`, `SMTP_HOST`, `SMTP_PORT`, `MAILPIT_API_URL` y `JWT_SECRET`.

Esto **no significa que todas sean obligatorias en local**: el validador real aceptó la configuración. SMTP usa localhost:1025 por defecto y JWT adopta el secreto de desarrollo. La falta de `NEXT_PUBLIC_COOKIE_PREFIX` no demuestra un fallo de cookies: `proxy.ts` también lee `COOKIE_PREFIX`. No se confunde ausencia en archivos con ausencia de posibles overrides del proceso que inició servicios concurrentemente.

| Conexión / componente | Prueba y resultado | Conclusión |
|---|---|---|
| `DATABASE_URL` | Conexión autenticada, transacción READ ONLY; PostgreSQL **18.6**, base `englove_dev`, zona **UTC**. | Confirmada. |
| `MIGRATION_DATABASE_URL` | Conexión autenticada READ ONLY; mismo destino local; **4 migraciones finalizadas, 0 inconclusas**. | Confirmada como conexión; no se reaplicaron migraciones a esa base. |
| Integridad DB local | CHECK `attempts_score_check` 0–5 y XOR assignment/activity presentes; 0 tablas públicas con RLS habilitado. | Evidencia dinámica favorable G-A02/G-A10. |
| API localhost:3001 | Al inicio no escuchaba. Al final `/health` **200** con `status:ok`, `/docs` **200**, sesión sin cookie **401**. | Disponible al final; health no demuestra acceso real a todos sus proveedores. No se inició la API con configuración cloud implícita desde esta auditoría. |
| Web localhost:3000 | Iniciada para pruebas; login 200 y flujos Chromium con mocks. | Frontend disponible; no equivale a integración completa con API real. |
| MinIO localhost:9000 | Al inicio no escuchaba; disponible después de cambios concurrentes. HeadBucket con parámetros locales de `.env.example`: **200**. | Servicio/bucket local autenticados, usando parámetros diagnósticos explícitos, no la configuración R2 efectiva de `.env`. |
| Privacidad/CORS MinIO | Listado anónimo del bucket **403**; sin bucket policy ni bucket CORS explícitos. Preflight real desde localhost:3000 para PUT/content-type: **204**, origen/método/header autorizados. | Listado privado y preflight local favorables; ausencia de bucket CORS no implica fallo si la configuración efectiva lo permite. No se verificó cada objeto ni se hizo upload/download real. |
| `R2_ENDPOINT` actual | Ausente; `media.service.ts:81-83` deriva un dominio Cloudflare a partir de la cuenta si no existe override. | **ENV-01: configuración de archivo no alineada con MinIO local.** No se contactó ese destino para verificarlo. |
| SMTP/Mailpit | Al inicio no escuchaban; al final HTTP Mailpit **200**, envío con `MailService` real aceptado y mensaje sintético capturado. | Transporte local confirmado mediante defaults SMTP; mensaje de prueba eliminado. No acredita Resend, que quedó fuera de alcance. |
| `JWT_SECRET` | Ausente en archivo; validador acepta fallback de desarrollo local. | Permitido localmente; no se evaluó ni utilizó ningún secreto de staging/producción. |
| `ffmpeg` / `ffprobe` | Ninguno resoluble en PATH durante las comprobaciones. | **ENV-02: speaking real no acreditable en este proceso.** El Dockerfile instala ffmpeg, pero eso no demuestra disponibilidad del binario en la ejecución local observada. |
| Inventario Docker | CLI bloqueada por acceso al pipe/configuración en el sandbox. | No se atribuye fallo al proyecto. Se verificaron endpoints directamente, no el inventario completo de contenedores. |

**Recomendación local:** alinear deliberadamente los archivos/overrides con MinIO y Mailpit, garantizar binarios en el runtime que ejecute la API y repetir subir → confirmar con ffprobe → entregar → transcodificar → recuperar tras reinicio → retener/borrar. No copiar ciegamente `.env.example` sobre credenciales existentes ni reutilizar staging para suplir pruebas locales.

## 8. UX/UI, accesibilidad y cobertura de pruebas

### UX-01 — Desbordamiento de navegación docente reproducido

`apps/web/src/components/teacher-nav.tsx:62,104-141` coloca ocho etiquetas en una sola fila sin adaptación suficiente.

Mediciones reales en `/alumnos`, sesión y lista simuladas:

| Viewport | Ancho desplazable del documento | Observación |
|---:|---:|---|
| 390 px | **551 px** | La barra móvil desborda; los accesos finales quedan fuera del ancho visible. |
| 768 px | **932 px** | El borde derecho de logout llega a ~931,6 px, fuera del viewport. |
| 1280 px | 1280 px | No se observó desbordamiento horizontal. |

**Prioridad media.** Recomendar navegación adaptativa con grupos/menú o distribución responsive, evitando ocultar accesos sin alternativa. Verificar 320–390 px y tablet vertical, teclado y zoom; no limitar la revisión al escritorio.

### UX-02 — El objetivo interno de 48 px no está garantizado

Logout docente midió **30 px de alto** a 390 y 1280 px, y 46 px a 768 px. `teacher-nav.tsx:73,97,115` no asegura mínimos. `components/activities/GameRenderer.tsx:151-158` tampoco los fija para «Escuchar»; ese botón requiere medición específica antes de afirmar su altura exacta.

SPEC-09 RF-21 (`:146`) y SPEC-11 RF-14 (`:84`) exigen **48×48 px**, incluyendo «Escuchar». No se equipara automáticamente una altura de 30 px con infracción WCAG 2.5.8: el mínimo AA y sus excepciones son distintos; la decisión133 conserva un objetivo interno más estricto.

La prueba `apps/web/e2e/spec-09-pwa-offline-a11y.spec.ts:620-631` comprueba ese requisito solo en «Reintentar» de `/offline`. **No demuestra que todos los controles lo cumplan.** Conviene extenderla a navegación, juegos, formularios y controles de audio.

### QA-01 — Un test de análisis estático es sensible a la carga

`apps/web/test/wp09-regressions.spec.ts:61` recorre todo `src` con TypeScript AST; superó 5000 ms en suite completa y pasó aislado en 4277 ms. **Prioridad baja/media:** estabilizar presupuesto/ejecución sin eliminar exigencias. No hay una aserción funcional incorrecta demostrada en ese test.

### QA-02 — El caso de actividad archivada no llega a acreditar la decisión 95

**Prueba pendiente de validación fiable; no se afirma defecto de negocio.**

`apps/web/e2e/spec-00-cross-cutting-and-conflicts.spec.ts:404-519` falló dos veces en `:510`, esperando `/actividad/att-dec95-1` mientras la URL seguía `/inicio`.

La traza confirma clic sobre el enlace correcto y petición RSC a esa ruta sin respuesta final registrada dentro de la ventana. No contiene GET del intento ni POST complete. Además, `/me` y `/feature-flags` no están mockeados: devolvieron 401 reales, mientras session/refresh devolvían 200 simulados con tokens ficticios.

**Conclusión:** fixture parcialmente aislado y navegación pendiente, sin causa raíz única establecida. No demuestra que el servidor impida entregar una actividad archivada. Recomendar fixture completo o una verdadera sesión local integrada, y trazabilidad de navegación antes de atribuir una infracción de la decisión95.

### QA-03 — El tamaño del SW no prueba el límite del Worker servidor

`apps/web/test/service-worker-build.spec.ts:6-18` mide `dist/client/sw.js`: **41 608 bytes**, gzip informado 12,95 kB. Su aprobación no acredita G-B06, que limita el **bundle servidor comprimido** de Cloudflare. Se confirmó build local y se repitieron sus nueve tests sobre el artefacto recién generado; no se certificó tamaño final de despliegue.

### Recomendaciones generales de producto y experiencia

1. **Estabilizar antes de ampliar:** priorizar límites entre componentes reales —Prisma extendido/jobs, S3/retención, sesión/higiene, configuración/estadísticas— sobre más tests con mocks permisivos.
2. **Validar pedagogía con usuarios reales:** observar onboarding de la profesora y resolución de una actividad por cada segmento, sin ayuda; medir comprensión de instrucciones, recuperación de errores y autonomía, aprovechando las tareas ya previstas.
3. **Unificar componentes interactivos:** contratos compartidos para targets, foco, estados loading/error/empty y confirmaciones, sin rediseño indiscriminado. Corregir primero navegación docente responsive.
4. **Seguridad comprensible:** comunicar claramente «no se pudo confirmar el cierre» y estado de sincronización; no mostrar éxito aparente ante fallos. Evitar pérdida de respuestas y reentrada de la cuenta anterior.
5. **PWA real, no solo presencia de archivos:** probar en preview local compatible instalación, espera de actualización, recarga única, `/offline`, no-cache de API/RSC y limpieza al cambiar de cuenta. Next dev usa un fallback de SW y no demuestra ese ciclo.
6. **Accesibilidad manual y por tarea:** lector de pantalla, teclado, reducción de movimiento, zoom y touch con los dispositivos objetivo. Axe favorable es una señal útil, no conformidad completa.
7. **Documentación verificable:** una referencia vigente para contratos, estado y pruebas fechadas; conservar historia sin convertir encabezados antiguos en instrucciones activas.
8. **Mantener alcance:** no añadir rankings al alumno, padres, pagos, analítica de terceros ni otras exclusiones para resolver estas deficiencias. Son recomendaciones de estabilización del piloto, no una nueva fase funcional.

Guía auxiliar consultada: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), subordinada a las decisiones del proyecto.

## 9. Matriz de los 37 guardrails

**F:** evidencia favorable dentro de lo inspeccionado; no garantía exhaustiva. **I:** incumplimiento confirmado. **P:** evidencia parcial o prueba pendiente. **EX:** ejecución remota excluida por solicitud.

| Regla | Estado | Evidencia / límite |
|---|---|---|
| G-A01 — Sin Supabase | F | Scanner y revisión sin integración ejecutable prohibida. La skill PostgreSQL no se usó para introducir Supabase/RLS. |
| G-A02 — Autorización NestJS | F | Guards globales y extensión tenant; 0 tablas locales con RLS habilitado. |
| G-A03 — Doble conexión | F/EX | Ambas URLs locales autenticadas; runtime usa pool max5 y config Prisma selecciona conexión de migración. Neon excluido. |
| G-A04 — Sin db push remoto | F | Sin uso prohibido detectado; no se ejecutó db push. |
| G-A05 — Tenant directo | F | Scanner contrastó matriz de 24 modelos tenant con esquema. |
| G-A06 — Filtro en toda consulta | I | AUD-01/02 y TEN-01. La extensión fail-closed no sustituye el filtro explícito exigido al servicio. |
| G-A07 — SQL seguro/tenant | F/P | SQL parametrizado observado; pruebas PostgreSQL favorables. No revisión formal exhaustiva de todas las consultas y entradas. |
| G-A08 — onDelete explícito | F | Relaciones del esquema y excepción AuditLog/SetNull contrastadas. |
| G-A09 — Modelo vigente | F | Sin campos retirados detectados; juegos autónomos y origen de intentos reflejados en esquema. |
| G-A10 — Nota 0–5 en DB | F | Decimal del esquema y CHECK real confirmado en `englove_dev`. |
| G-A11 — Anti-IDOR | F/P | Guards, separación alumno/tenant y regresiones PostgreSQL favorables; TEN-01 limita conformidad literal. No se demostró IDOR explotable. |
| G-B01 — Sin hosting prohibido | F/EX | Configuración vinext/Workers; sin prueba de hosting desplegado. |
| G-B02 — proxy.ts | F | Convención proxy presente, sin middleware de negocio alternativo detectado. |
| G-B03 — Proxy solo redirige | F | Decodifica rol sin verificación criptográfica; autorización de negocio en API. SEG-01 afecta la coherencia del cierre, no convierte al proxy en guard de datos. |
| G-B04 — RSC/Query/caché | F/P | Hojas cliente y TanStack Query observadas; scanner sin errores. SW declara API/RSC NetworkOnly. Ciclo PWA real no probado. |
| G-B05 — Drag and drop | F/P | Pragmatic DnD y alternativas observadas; falta validación física completa. |
| G-B06 — Worker y tamaño | P/EX | Build local satisfactorio; falta tamaño comprimido final servidor. QA-03 impide usar el tamaño del SW como sustituto. |
| G-B07 — Docker y ffmpeg | F/P | Dockerfile instala ffmpeg; binarios ausentes del PATH observado. ENV-02, imagen runtime no ejecutada aquí. |
| G-B08 — Instancia única | F/EX | `render.yaml` declara `numInstances:1`, sin verificación remota. |
| G-B09 — Cola serial recuperable | I | Serialización presente, recuperación y reintentos fallan: AUD-01/02. |
| G-B10 — R2 privado/firmado | P/I | Código firmado y bucket local sin listado anónimo; ENV-01 y AUD-03. No flujo completo real de audio ni permisos por objeto acreditados. |
| G-B11 — Cookies/CORS/Origin | F/P | Código de cookies por entorno, OriginGuard y CORS; smoke local favorable. SEG-01 deja el cierre inseguro ante fallos. Sin comprobación de secretos remotos. |
| G-B12 — Entornos/planes | F/EX | Documentos/configuración inspeccionados, pero planes, aislamiento y recursos cloud no probados. |
| G-B13 — Audio seguro | F/P | HEAD, límite10MiB, magic bytes, ffprobe, spawn estructurado/shell:false y finally observados. Audio real no ejecutado por ENV-01/02. |
| G-C01 — Idioma | F/P | Identificadores ingleses y documentación/UI españolas observados; no revisión lingüística exhaustiva de todo contenido pedagógico. |
| G-C02 — Nota servidor | F/I | Scoring servidor y Review cualitativo favorables; contradicción de passing_score NEG-01. |
| G-C03 — Tiempos servidor | F | DTOs sin timestamps de ejecución, whitelist/transform y pruebas favorables. |
| G-C04 — answer_key protegida | F/P | Omit global y configuración pública observados; selecciones explícitas del editor docente protegidas. Soluciones de juegos son excepción deliberada, no fuga de examen. |
| G-C05 — Entidades retiradas | F | Scanner sin capacidades prohibidas; roles reservados y datos de acudiente no se confunden con módulos retirados. |
| G-C06 — Exclusiones piloto | F/P | Sin ampliaciones prohibidas detectadas en la revisión; Fases2–3 no se exigen como faltantes. |
| G-C07 — Rutas API | F/EX | Prefijo de negocio, health/docs y smoke local favorables; 404 de docs en producción no probado remotamente. |
| G-C08 — America/Bogota | F/P | Cron/formateadores observados usan zona del negocio; DB UTC confirmada. Sin ejecutar calendario completo de jobs. |
| G-C09 — Jobs idempotentes | F/P | ScheduledJobRun y unicidad presentes; pruebas favorables. No se dispararon cron sobre datos existentes. |
| G-C10 — Sin PII en logs | F/P | Pino redacta cuerpo, cookies, tokens/query y filtro de errores; correo sintético no registró destinatario. No auditoría dinámica integral de todas las emisiones. |
| G-C11 — Secretos por entorno | F/P | Scanner sin secretos versionados detectados; no se publicaron valores locales. No certifica secretos reales ni historial git completo. |
| G-C12 — Tipos/validación | F | Lint/typecheck, scanner y contratos compartidos favorables; supresiones documentadas no equivalen a prueba de ausencia de todo riesgo. |
| G-C13 — Higiene/PWA/URLs | I/P | SEG-01 y OFF-01; limpieza implementada y URLs https seguras observadas, pero no cumplimiento íntegro. Ciclo PWA real pendiente. |

**Conclusión de guardrails:** no es correcto emitir «cumplimiento en su totalidad». Hay incumplimientos semánticos concretos y reglas parcialmente acreditadas o deliberadamente no ejecutadas. Los 59 avisos no son 59 vulnerabilidades; las 70 supresiones tampoco demuestran automáticamente excepciones correctas en ejecución.

## 10. Ruta recomendada y decisión abierta

Esta es una propuesta de orden, no un cambio del taskboard ni autorización para implementar:

1. **Antes de usar tablets compartidas:** corregir SEG-01 y probar cierre confirmado/fallido; hacer obligatorio el aislamiento de la cola OFF-01.
2. **Antes de validar speaking:** resolver AUD-01/02, alinear ENV-01/02, comprobar S3/ffprobe/ffmpeg reales y recuperación; eliminar éxito ficticio de borrado local AUD-03.
3. **Antes de una nueva aplicación de migraciones o ampliación académica:** acreditar DAT-01 y resolver NEG-01 siguiendo la jerarquía vigente; completar doble filtro TEN-01.
4. **Antes de declarar calidad técnica cerrada:** corregir contradicciones activas, estabilizar QA-01/02 y obtener una suite reproducible sin superponer builds destructivos de `dist` con el servidor en prueba.
5. **Antes del go/no-go:** corregir UX-01/02, observar usuarios/dispositivos reales y recoger aceptación operativa; después ejecutar la Etapa11 en su momento. La omisión de staging aquí es deliberada, no un test aprobado ni un nuevo defecto.

### Única pregunta abierta prioritaria para el líder

**¿Qué evidencia concreta y quién dará la aceptación operativa de H1/H2/H3 antes del go/no-go del piloto?**
