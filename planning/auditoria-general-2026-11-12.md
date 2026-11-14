# Auditoría general previa al despliegue — 12 de noviembre de 2026

**Veredicto: base técnica avanzada y verificable; lanzamiento con usuarios reales todavía no recomendado.** Hay defectos reproducidos en Docker, cola offline y actualización PWA, una dependencia vulnerable en una ruta de entrada real y compuertas de CI que no garantizan lo que aparentan. Es viable continuar hacia staging una vez corregidos los bloqueantes. No se certifica ausencia de bugs.

## Alcance y método

- Snapshot: `7aed256` (`develop`), árbol inicialmente limpio. Auditoría del estado completo, no de un diff ni de un PR.
- Fuentes: CONTEXT, arquitectura, proceso SDD, etapas, taskboard, specs, código, pruebas, manifiestos y configuración de despliegue. Se contrastaron también los informes de auditoría y remediación del 11 de noviembre; sus pendientes no se asumieron resueltos por el cierre de SPEC-11.
- Skills: security-review, englove-guardrails, verification-before-completion, systematic-debugging y Context7. Se adaptaron los ejes Standards/Spec de code-review a este snapshot con dos revisores de solo lectura; el auditor principal contrastó los hallazgos y ejecutó las comprobaciones.
- Node `24.16.0`, pnpm `11.5.1`, PostgreSQL local en Docker. Se usó una base exclusiva `englove_audit_20261112`, sin migrar ni cargar fixtures en `englove_dev`. La regresión DAT-01 creó otra base con UUID.
- Sin cambios de producción, configuración de CI, contratos aprobados o estados de tareas. Sin publicación, despliegue, push, envío de correos reales ni carga contra servicios cloud. Wrangler se ejecutó con `--dry-run`.
- Se crearon diagnósticos desechables en `test-evidence/`, ignorado por Git. Los logs están en `test-evidence/audit-2026-11-12/`; el test de audio se ejecutó temporalmente dentro de API y se archivó como `audio-runtime-local.spec.ts.txt` en esa carpeta de evidencia. Se retiró del descubrimiento de Vitest para no afectar ejecuciones futuras. No son una suite de regresión permanente.

## Evidencia actual

| Comprobación | Resultado de esta auditoría | Límite |
|---|---|---|
| `pnpm exec turbo run lint typecheck --force` | 8 tareas satisfactorias, sin caché | Análisis estático; no prueba ejecución |
| Shared / Vitest | 69/69 | Incluye pruebas de contratos y funciones |
| API / Vitest, base aislada migrada | 444 aprobadas, 2 omitidas de opt-in | Los dos casos se ejecutaron después explícitamente |
| DAT-01 opt-in | 5/5, incluidos los 2 casos PostgreSQL omitidos | Tres comprobaciones ya estaban contadas en la suite API |
| Web / Vitest | 255/255 | Parte usa mocks o inspección de código; véase QA-01 |
| Playwright completo | 50/50, Chromium headless, 1,4 min | Servidor Next de desarrollo y API parcialmente interceptada; no E2E íntegro de producción |
| `pnpm exec turbo run build --force` | 4 tareas satisfactorias, sin caché | Build de paquetes; no equivale a imagen Docker |
| SW/Worker sobre build nuevo | 10/10 | Subconjunto de las pruebas web, no sumar otra vez |
| Wrangler dry-run | Exit 0; 1813,35 KiB, **469,75 KiB gzip** | Empaquetado real local; no arranque ni publicación en Cloudflare |
| Migraciones Prisma | Cuatro aplicadas en base vacía aislada | No demuestra actualización/restauración de una base con datos reales |
| Audio sintético real | Subida firmada a MinIO → ffprobe → ffmpeg → playback firmado: aprobado | Señal de 3 s, por servicios reales; no micrófono, navegador→API HTTP, entrega/revisión completa, retención ni recuperación tras caída |
| Prerrequisitos locales de audio | ffmpeg, ffprobe y HeadBucket autenticado disponibles | Mejora respecto de la evidencia anterior; no sustituye aceptación operativa |
| Guardrails `--all` | 357 archivos; **0 errores, 31 avisos, 73 supresiones** | Hay incumplimientos semánticos; véase TEN-01 |
| Guardrails `--self-check` | 37 reglas sincronizadas, decisiones hasta 145 | No acredita sincronía byte a byte de las tres copias de skills |
| Validación estructural SPEC-01…11 | 0 errores y 0 avisos | No resuelve contradicciones semánticas como NEG-01 |
| Prohibición de schema push | Aprobada | Compuerta de scripts versionados |
| `pnpm audit --prod --json` | **11 avisos: 3 altos, 5 moderados, 3 bajos** | Avisos de paquetes no equivalen a 11 exploits de la aplicación |
| Docker completo | Falló al descargar índices Alpine por DNS/TLS | Incidencia ambiental separada del defecto siguiente |
| Docker `--target dependencies` | **Falló por ausencia del esquema Prisma** | Defecto reproducido, independiente del fallo de Alpine |

Son **770 pruebas Vitest únicas aprobadas** entre los tres paquetes y los dos casos opt-in ejecutados aparte; 50 casos Playwright adicionales. El smoke de audio desechable no se incluye en ese total. No se afirma haber ejecutado `pnpm test` raíz: se ejecutaron las suites por paquete y las tareas raíz de build/análisis indicadas.

Los builds avisan de sourcemaps, imports dinámicos ineficaces y clasificación `Unknown` de rutas. No son fallos de build, pero conviene resolver o justificar los relevantes antes de depender de esas trazas en operación. Playwright también registró `OFFLINE_IDENTITY_REQUIRED` y un aviso de grabación sin identidad válida en fixtures que terminaron aprobadas: limita la cobertura real de esos flujos.

## Seguridad

### SEG-01 — Prioridad alta: body-parser vulnerable en la entrada HTTP

**Confirmado:** el lockfile contiene `body-parser@2.3.0` (`pnpm-lock.yaml:2694`) y la API instala `express.json` y `express.urlencoded` sin desactivar descompresión (`apps/api/src/main.ts:44`). Estos parsers procesan entrada antes de los guards; autenticación, OriginGuard y throttling del controlador no protegen esa fase.

El [aviso del mantenedor/GitHub GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) identifica un DoS por cuerpos comprimidos con bytes adicionales, corregido en 2.4.0. El límite de 1 MB no elimina el patrón descrito. La combinación de versión afectada y middleware activo hace este aviso prioritario. **No se ejecutó un exploit para tumbar la API**, ni se comprobó una mitigación perimetral en Render/Cloudflare.

**Cierre exigido:** actualizar la cadena a una versión corregida o desactivar explícitamente la descompresión si el contrato lo permite; comprobar peticiones normales y rechazadas y repetir auditoría/build/regresión. No usar `audit fix --force` indiscriminadamente.

Los otros dos avisos altos requieren tratamiento distinto:

- **Zod 3.25.76:** usado realmente en API/shared; [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) reporta agotamiento de memoria durante validación de colecciones. Falta demostrar un payload explotable bajo los límites HTTP y esquemas de Englove. Migrar a una versión mayor requiere revisar contratos; no es una actualización automática inocua.
- **Multer 2.4.0:** dependencia transitiva de Nest. El [aviso GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) exige un `fileFilter` asíncrono en uso. No se encontró esa configuración en las rutas revisadas; los audios suben directamente a S3. **No se reporta un exploit alcanzable de Multer en Englove.**

Las comprobaciones revisadas muestran defensas útiles: cookies HttpOnly, validación de Origin, JWT con tipo de token y sesión vigente, controles de aprobación, extensión tenant, secretos por entorno, nota en servidor, R2 privado, límites de audio, invocación estructurada de procesos y saneamiento de logs. Las regresiones PostgreSQL de seguridad pasaron. Esto no constituye una certificación exhaustiva de seguridad ni reemplaza el ejercicio adversarial posterior.

## Standards: implementación y calidad

### OFF-01 — Prioridad alta: un rechazo de audio bloquea la cola offline

`apps/web/src/lib/audio-upload.ts:82` convierte cualquier rechazo de la URL de subida en `Error("UPLOAD_URL_REJECTED")`, perdiendo status y código. `apps/web/src/lib/offline-queue.ts:891` busca `400`, `409`, `413`, `422` y `ATTEMPT_CLOSED` dentro de ese error para decidir descarte. Ninguno aparece; programa backoff y retorna antes de los siguientes intentos.

**Reproducción:** el helper real, transpilado en memoria, recibió respuestas 400/404/409/413/422: todas produjeron el mismo error genérico. El trazado de la cola confirma que cae en reintentar/retornar. Un audio de una actividad ya cerrada puede impedir que se sincronicen las posteriores. Incumple SPEC-09 RF-15.

**Cierre:** conservar status/code en un error estructurado, descartar solamente lo previsto por el contrato y demostrar que una entrada terminal no bloquea otra válida. Cubrir también 401 recuperable, 429, 5xx y errores de red sin perder audio recuperable.

Observación relacionada: `actividad-runner.tsx:157` guarda un borrador sin attemptToken; el éxito online de `:519` no persiste el mediaId en ese borrador. La cola puede intentar resubirlo sin token antes de la entrega explícita. Investigar junto a OFF-01; no se contabiliza como un segundo hallazgo independiente.

### PWA-01 — Prioridad media: recarga sin consentimiento durante un intento

`apps/web/src/lib/pwa-manager.ts:181` recarga incondicionalmente ante `controllerchange`; no comprueba actividad en curso ni una solicitud de actualización. `apps/web/src/sw.ts:28` configura `clientsClaim: true`, por lo que la primera activación puede tomar control de una pestaña existente.

**Reproducción:** módulo real con ServiceWorker simulado; registrar, marcar intento activo y emitir `controllerchange` produjo una recarga sin llamar `applyUpdate`. Es evidencia del listener; no una prueba de instalación real en tablet. Contradice el aplazamiento durante intentos de SPEC-09 RF-9 y arquitectura §3.7/§10.2.

**Cierre:** distinguir primera toma de control de una actualización solicitada y proteger el intento activo. Regresión de instalación inicial, dos pestañas, actualización aceptada y actualización pospuesta.

### TEN-01 — Prioridad media: falta la segunda barrera tenant explícita

Ejemplos confirmados: `apps/api/src/groups/groups.service.ts:180` y `:250`, `apps/api/src/auth/me.controller.ts:117`, y mutaciones en `maintenance.service.ts:196`, `:223`, `:437`, `:575`, `:587` usan `where: { id }` sin `organization_id` explícito.

La búsqueda previa o la extensión tenant aportan aislamiento, por lo que **no se demuestra un IDOR explotable en estas llamadas**. Sin embargo, se incumple la doble barrera obligatoria de CONTEXT §16 / G-A06. No convertir este aviso en «seguro por tener extensión» ni inflarlo como fuga demostrada.

Los avisos de revisiones con `where` construido previamente sí tienen el filtro; los de selección de answer_key en el editor docente son legítimos. Las búsquedas públicas de credenciales opacas tienen bypass y motivo específicos. Los 31 avisos no representan 31 vulnerabilidades.

**Cierre:** filtros explícitos en los puntos indicados, conservando las excepciones justificadas y pruebas cruzadas entre organizaciones.

### QA-01 — Prioridad media: pruebas verdes que no ejecutan la lógica productiva

`apps/web/test/student-portal.spec.ts:10` verifica estructuras definidas dentro del propio test y `:62` crea una función `getActionText` local. Pueden seguir pasando aunque el componente real cambie o se rompa.

La suite sí tiene pruebas útiles de helpers, contratos, seguridad, PostgreSQL y Playwright; no se invalida todo el conjunto. **El conteo de tests no debe presentarse como porcentaje de cobertura funcional.** Falta una medición de cobertura con ramas relevantes y relación requisito→flujo real.

**Cierre:** sustituir los casos autorreferenciales de rutas críticas por pruebas del componente/helper real; hacer fallar el test al introducir una regresión controlada. Añadir captura/aserciones de errores de página y evitar que fixtures omitan la identidad necesaria para offline.

## Spec y operación: preparación para desplegar

### DEPLOY-01 — Prioridad alta: el Dockerfile no construye sus dependencias

`apps/api/Dockerfile:11` copia solo el package.json de API; `:13` instala dependencias. `package.json:22` tiene un postinstall que ejecuta Prisma generate. El esquema y prisma.config.ts llegan recién en `Dockerfile:18`.

**Reproducción:** `docker build --target dependencies -f apps/api/Dockerfile ...` termina con `Could not find Prisma Schema` y `ELIFECYCLE`. El fallback `|| pnpm install` vuelve a fallar y además permite instalación no congelada.

**Cierre:** ordenar correctamente copias/lifecycles, exigir lockfile y verificar build completo y arranque de la imagen en Linux con health, Prisma, ffmpeg/ffprobe. No basta `tsc` en Windows. No se alcanzaron las etapas posteriores: pueden existir otros problemas todavía no observados.

### CI-01 — Prioridad alta: CI ignora cualquier fallo de Playwright

`.github/workflows/ci.yml:117` contiene `pnpm test:e2e || echo "...placeholder..."`. Una aserción fallida o un navegador que ni arranca dejan el job satisfactorio. La suite ya tiene 50 casos reales; el placeholder es operativo, no solo un nombre viejo.

**Cierre:** propagar el exit code, conservar trazas/reportes y demostrar una ejecución roja al introducir un fallo controlado antes de confiar en la compuerta. `staging-migration` depende solo de quality-gates (`:121`), por lo que tampoco espera E2E.

### CI-02 — Prioridad alta: CI omite pruebas PostgreSQL importantes

Quality-gates no provisiona PostgreSQL ni migra una base de pruebas. `apps/api/test/postgres-test-helper.ts:34` usa por defecto localhost:5433 y `:91` exporta disponibilidad. Ocho suites usan `describe.skipIf(!isPostgresAvailable)`, incluida `wp02-security-regression.postgres.spec.ts:47`.

Un resultado verde puede omitir concurrencia, aislamiento y flujos persistidos. Que hayan pasado localmente en esta auditoría no corrige CI.

**Cierre:** servicio PostgreSQL aislado, migraciones, URL de test explícita y fallo obligatorio si la base esperada no existe. Los casos opt-in de DAT-01 necesitan además una decisión explícita sobre cuándo ejecutarse; no habilitarlos contra una base de aplicación existente.

### OPS-01 — Prioridad media: ENG-015 no materializa todo RF-18

SPEC-01 RF-18 (`specs/SPEC-01-scaffold.md:101`) pide migrar y desplegar API/web del mismo commit y evitar carreras. ENG-015 figura Hecho (`planning/taskboard.md:77`), pero el workflow termina en migración de staging, no contiene despliegue de Workers/Render ni serialización con `concurrency`.

No se consultó una configuración externa de Render que pudiera automatizar parte del despliegue; **el contrato no queda acreditado por el repositorio**. Los prerrequisitos ENG-003/004 sí constan pendientes. No marcar automáticamente todo el pipeline como entregado.

**Cierre:** definir y probar promoción del mismo artefacto/commit, gates efectivos, orden de migración, serialización, health posterior y procedimiento de recuperación. Resolver antes del lanzamiento, sin confundirlo con UI/UX.

### NEG-01 — Prioridad media: umbral de aprobación aún contradictorio

`apps/api/src/stats/stats.service.ts:53`, `:1179` y `:1534` usan 3,0 fijo. SPEC-08 RF-9/§4.2 coincide con esa constante, pero CONTEXT decisiones 83/132 define la fuente organizacional `games.config.passing_score` para actividades asignadas. La [remediación anterior](remediacion-auditoria-2026-11-11.md) reconoce expresamente la aprobación contractual pendiente.

**Cierre:** decisión del líder, modificación del RF según SDD y regresión con dos organizaciones y umbrales diferentes. No cambiar código ni reabrir/aprobar la spec silenciosamente durante una auditoría.

### DOC-01 — Prioridad baja: README presenta evidencia antigua como estado actual

`README.md:307` y `:313` anuncian 566 pruebas como suite vigente; `:373` y `:374` describen infraestructura «Desplegada/Alojada» pese a los prerrequisitos pendientes. Los números históricos fechados en otros documentos no son por sí solos defectos; el problema es presentarlos como estado actual.

El proceso SDD ya distingue verificación técnica de aceptación operativa. No corresponde invalidar todas las specs Verificadas. Sí conviene un único resumen vigente enlazado desde README/AGENTS con fecha, commit, evidencia y límites, manteniendo los informes históricos intactos.

## Informe de Guardrails

- **Alcance:** snapshot completo, 357 archivos del escáner.
- **Compuerta SDD:** SPEC-01 a SPEC-11 registradas Verificadas; no se escribió código productivo ni se alteraron contratos. NEG-01 requiere resolución contractual.
- **Script:** 0 errores, 31 avisos, 73 supresiones; self-check 37 reglas sincronizadas.
- **Veredicto:** **INCUMPLE semánticamente**; el cero sintáctico no autoriza cierre ni lanzamiento.
- **A. Persistencia:** PostgreSQL y migraciones de base nueva aprobadas; doble filtro explícito pendiente (G-A06, TEN-01). No se acredita recuperación de datos reales.
- **B. Hosting:** Worker empaquetado dentro del presupuesto G-B06; Docker bloqueado (G-B07); CI/promoción incompletos. R2/Render/Neon cloud no verificados.
- **C. Negocio/seguridad:** regresiones API aprobadas y defensas inspeccionadas; dependencia HTTP prioritaria, cola offline defectuosa y umbral contradictorio. No se acredita cumplimiento integral de G-C13/SPEC-09 por el test verde.

## Rendimiento y pruebas que faltan

Hay presupuestos y pruebas de estadísticas, algunas con fixtures mock y otras con PostgreSQL real; pasaron en esta máquina. El tamaño gzip del Worker es favorable. **No se midieron latencia p95/p99 bajo concurrencia, consumo sostenido, capacidad de Render/Neon ni LCP/INP/CLS en dispositivos reales.** Un test local con umbral temporal no predice esos resultados.

La carga relevante debe reproducir navegación del alumno, apertura de asignaciones, lotes de eventos, entrega/calificación, refresh y polling docente; también ráfagas de confirmación de audio y cola serial de ffmpeg. El binario sube a S3, pero confirmación, consultas y transcodificación consumen recursos API. Una sola instancia y pool pequeño deben medirse, no cambiarse para que pase el test sin una decisión arquitectónica.

La documentación oficial de [Grafana k6 sobre automatización](https://grafana.com/docs/k6/latest/testing-guides/automated-performance-testing/) recomienda comenzar con smoke y carga habitual; estrés y resistencia responden preguntas diferentes. Los [thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) permiten fallar automáticamente por errores/latencia. Se consultó mediante Context7.

Para Englove, diseñar datos sintéticos y usuarios distintos, pausas realistas, métricas de DB/memoria/CPU/cola, y separar rechazo esperado por rate limit de fallo inesperado. Acordar concurrencia de clase: 10 alumnos iniciales, 30 activos y objetivo 100 registrados no significan 100 peticiones simultáneas. El presupuesto de estadísticas <500 ms es un punto de partida contractual, no un SLO p95 ya aprobado para todos los endpoints. No se ejecutaron cargas o pruebas de estrés en esta auditoría.

## Secuencia recomendada y criterios de salida

1. **Remediar y verificar esta auditoría:** Docker, dependencia HTTP, gates CI/PostgreSQL, cola offline y SW; resolver NEG-01 y filtros explícitos. Regresiones nombradas, sin añadir funcionalidades ni saltar SDD. Conservar una ejecución roja/verde para cada corrección.
2. **Auditoría adversarial independiente:** después de las correcciones, explorar tenants/alumnos cruzados, tokens vencidos o de otro tipo, carreras de refresh/OTP/entrega/revisión, cambio de cuenta durante red lenta, audio inválido/oversize, desconexión, reinicios y presión de colas. Un hallazgo necesita reproducción e impacto; una respuesta «no encontré más» no certifica seguridad.
3. **UI/UX con el compañero y usuarios representativos:** acordar cambios dentro del piloto; repetir flujos y accesibilidad después. No posponer defects funcionales de offline o sesión como si fueran solo diseño.
4. **Staging con la topología real:** cookies entre subdominios, CORS/origin, R2 privado, correo controlado, sesión prolongada, PWA instalada, micrófono y reproducción en tablets/navegadores reales. El despliegue a staging sirve para obtener evidencia; no equivale a lanzamiento.
5. **Smoke de capacidad temprano y carga representativa:** después de tener un build estable en staging. Luego estrés progresivo y resistencia en un entorno con recursos equivalentes al piloto. Repetir la base de carga tras cambios importantes de UI/API; no hace falta esperar a terminar todo el pulido visual para detectar un cuello de botella del backend.
6. **Go/no-go operativo:** cerrar ENG-130/131/132 y demás tareas de lanzamiento: monitorización/alertas, backup y restauración ensayada, contenido, manual docente, aceptación H1/H2/H3, configuración/planes de producción y onboarding controlado.

Tu orden general es razonable; añadiría remediación explícita entre auditoría y adversarial, y staging/recuperación como compuertas antes de aceptar usuarios reales. El resultado actual respalda seguir preparando el piloto, pero no declarar «sin bugs» ni «listo para producción».

## Evidencias locales

En `test-evidence/audit-2026-11-12/`: `static-verified.log`, `shared.log`, `api.log`, `migration-regression.log`, `web.log`, `e2e.log`, `build.log`, `worker-tests.log`, `worker-dry-run.log`, `docker-build.log`, `docker-deps.log`, `migrations.log`, `guardrails.log`, `specs.log`, `audio-prerequisites.log`, `audio-real.log`, `dependencies.json` y `reproductions.log`. `reproduce.cjs` permite repetir los diagnósticos focalizados de audio/PWA sin modificar producción.

Las evidencias ignoradas existen en esta máquina y no viajarán con un clon del repositorio. Este informe es el entregable versionable. Los dos fallos iniciales por restricciones del sandbox/pnpm no se contabilizaron como bugs: se repitieron las comprobaciones autorizadas fuera del sandbox y se registraron sus resultados reales.

Al terminar se eliminaron exclusivamente las dos bases sintéticas creadas por esta auditoría, se comprobó que `englove_dev` seguía existiendo y se detuvieron PostgreSQL, MinIO y Mailpit, que estaban detenidos al inicio. El árbol de trabajo conserva únicamente este informe como archivo versionable nuevo; los artefactos de diagnóstico/build quedan ignorados.
