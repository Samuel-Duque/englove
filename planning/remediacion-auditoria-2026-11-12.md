# Correcciones de la auditoría general — 12 de noviembre de 2026

**Estado:** los once hallazgos tienen corrección de código, configuración o documentación y evidencia local. El pipeline cloud está implementado y probado con respuestas sintéticas; su primera ejecución real sigue pendiente del aprovisionamiento y configuración de staging. No se declara lanzamiento ni ausencia de bugs.

La solicitud del líder «corrige los hallazgos» autoriza estas correcciones respecto al [informe de auditoría](auditoria-general-2026-11-12.md), incluido alinear NEG-01 con las decisiones ya vigentes 83/132. No se añaden funcionalidades, tablas ni migraciones, ni se modifica una decisión de producto.

## Trazabilidad

| Hallazgo | Corrección | Evidencia de cierre local |
|---|---|---|
| SEG-01 | Express/body-parser corregidos; Zod 4.6.6 con adaptación de `issues` y tipos; versiones transitivas corregidas mediante overrides acotados. CI bloquea avisos moderados y altos. | `http-parser-security.spec.ts`: versión efectiva fuera del rango vulnerable y gzip inválido seguido de JSON válido, sin caída; contratos shared/API/web y navegador aprobados; auditoría sin avisos moderados/altos. |
| DEPLOY-01 | Esquema y configuración Prisma antes del lifecycle; instalación con lockfile congelado; exclusión recursiva de node_modules, artefactos y .env locales. `pnpm deploy --prod --legacy --offline --ignore-scripts` usa el store ya poblado para generar un runtime aislado, sin descargas nuevas; se copia el cliente Prisma generado. | Build Docker completo; ffmpeg/ffprobe, Prisma, argon2 y shared cargan dentro de Linux; API real contra base aislada devuelve `/health` 200. CI conserva gate de imagen final. |
| OFF-01 | `ApiError` conserva status/code. Rechazos terminales no detienen otros intentos; 401 pausa y errores transitorios conservan reintento. Borradores locales se distinguen del trabajo entregado para evitar subir simultáneamente desde grabador y cola. Identidad original y generación protegen escrituras tardías. Se persiste/restaura el mediaId confirmado. | Nuevas regresiones en audio-upload/offline-queue. Playwright speaking abre directamente, graba, recarga y entrega con una sola solicitud de subida y sin pageerror. |
| PWA-01 | Solo una actualización solicitada permite recargar; primera toma de control no recarga. Intentos activos impiden aplicar o aplazan una recarga ya solicitada. Fallback y controllerchange comparten una única recarga. | Cinco casos `audit-pwa.spec.ts`, más suite previa de PWA. |
| TEN-01 | Filtros explícitos en grupos, cambio de interfaz y mantenimiento; claves compuestas de jobs conservadas. | Regresión AST ampliada a groups/maintenance/me, suites existentes de grupos/mantenimiento y aislamiento PostgreSQL. No se afirmó IDOR donde la extensión ya protegía. |
| QA-01 | Pruebas autorreferenciales del portal sustituidas por renderizado de StudentNav productivo y funciones reales. Fixtures `/me` añadidas a los casos de actividad que solo simulaban sesión; sus errores de identidad dejaban sin probar la persistencia. | Cuatro combinaciones de flags sobre componente real, pruebas reales de estrellas, captura de pageerror y regresión de recarga de speaking. |
| CI-01 | Playwright propaga exit code; evidencia se sube aun si falla. La promoción depende de quality, Docker y E2E. | `scripts/ci-pipeline.test.mjs` y ejecución completa local de 50 casos. No se ejecutó GitHub Actions remoto. |
| CI-02 | PostgreSQL 18 efímero y migrado; integración obligatoria y casos DAT-01 opt-in en CI. El helper falla si falta conexión explícita en CI o la base obligatoria no responde. Tests sin caché; variables de conexión/flags pasan por Turbo strict. | `postgres-requirement.spec.ts`, tests del workflow y `pnpm test` con `CI=true`, base aislada y opt-ins: cero omitidas. |
| OPS-01 | Promoción serializada al mismo SHA, Render sin autodeploy, preflight remoto antes de migrar, espera de `live`, comprobación del commit y health antes de publicar Worker. Variables de staging forman parte del build/hash. | Ocho tests de scripts/workflow; build real de staging emite `englove-web-staging` con prefijo `englove_stg_`; empaquetado dry-run dentro de presupuesto. Procedimiento en [despliegue-staging.md](despliegue-staging.md). |
| NEG-01 | StatsService obtiene `games.config.passing_score` del tenant con FeatureFlagsService, incluso con juegos deshabilitados. Estrellas y puntos no cambian. SPEC-08 alineada con decisiones 83/132. | `stats-passing-score.postgres.spec.ts`: misma nota 3,5 con umbrales 3 y 4 produce clasificaciones distintas; acceso cruzado 404. Índice y cabecera indican Implementada, re-verificación CI pendiente. |
| DOC-01 | README deja de prometer 566 tests vigentes o infraestructura ya desplegada. AGENTS, CONTEXT, taskboard e índice distinguen evidencia histórica, enmienda actual y aceptación operativa. | Validadores de specs y revisión de enlaces/estados. Informes anteriores se preservan como evidencia fechada. |

## Comprobaciones actuales

| Comprobación | Resultado |
|---|---|
| Lint y typecheck mediante Turbo, sin caché | 8/8 tareas satisfactorias |
| Build del monorepo | Shared, API y Worker satisfactorios |
| `pnpm test`, `CI=true`, PostgreSQL obligatorio y DAT-01 habilitado | **801/801**: 69 shared, 456 API, 276 web; cero omitidas |
| `node --test scripts/*.test.mjs` | **8/8**; simulación de Render y comprobaciones del workflow |
| Playwright completo con configuración CI | **50/50**, Chromium headless; API parcialmente interceptada; incluye recarga de speaking |
| Docker final | Build satisfactorio; cliente generado, binarios y dependencias cargan; arranque real con `/health` 200 en loopback |
| Worker de staging | Nombre y cookies correctos; dry-run **495165 bytes gzip**, menor que 3 MiB |
| SPEC-08 | Validador estructural: 0 errores, 0 avisos; estado Implementada |
| SPEC-01 a SPEC-11 | 11 specs, cero errores y avisos de estructura |
| Guardrails | 366 archivos: 0 errores, 23 avisos y 73 supresiones; comprobación de prohibición de schema push aprobada |

Guardrails del código revisado: cumplimiento con avisos justificados, sin atribuirlo a infraestructura no probada. Los avisos restantes corresponden a credenciales opacas/bypass documentado de auth, filtros construidos antes de la llamada y selecciones de answer_key del editor docente. Las mutaciones señaladas en TEN-01 ya tienen filtro explícito (G-A06, CONTEXT §16); hosting/operación cloud sigue pendiente de verificación manual. Las supresiones no se añadieron para esconder estos defectos.

Se mantuvo el presupuesto de estadísticas `<500 ms`. Una ejecución mientras compilaban simultáneamente Worker/Docker falló ese presupuesto; no se elevó el umbral. Se limitaron a dos los workers de pruebas API para evitar decenas de pools concurrentes y se construye antes de medir. La ejecución final completa pasó con el presupuesto original. Esto no sustituye k6 ni una medición de producción.

El build de Docker permitió descubrir y corregir dos problemas posteriores al inicial: node_modules locales contaminaban la copia Linux y la poda del monorepo dejaba enlaces sin destino. La evidencia relevante es la imagen final que arranca; no se presenta un `tsc` satisfactorio como sustituto.

## Límites y pendientes operativos

- **Un aviso bajo de deepmerge permanece:** GHSA-gcqx-w48m-w2h4, transitivo por renderizado de correo. El registro consultado aún publica 4.3.1 como última versión y no ofrece el parche 4.3.2 anunciado por el aviso. No se instaló una versión inexistente ni se ocultó el aviso. No se demostró entrada controlada por un atacante a sus opciones de merge en Englove. Repetir la evaluación al publicarse una versión corregida; las compuertas actuales bloquean severidad moderada o superior.
- Staging necesita las credenciales/variables y recursos indicados en el procedimiento. La promoción está deshabilitada hasta habilitar `STAGING_DEPLOY_ENABLED`; job omitido no equivale a despliegue aprobado. No se publicaron API ni Worker en esta sesión.
- La re-verificación CI de la enmienda SPEC-08 y la primera ejecución de GitHub Actions quedan pendientes de subir/revisar estos cambios. No se cambió a Verificada por pasar pruebas locales.
- H1/H2/H3, restauración de backups, observabilidad, contenido/onboarding y aceptación de tablets/micrófono real continúan según el taskboard. No se ejecutaron pruebas de carga/estrés ni la auditoría adversarial independiente prevista.
- Persisten advertencias de herramientas de build sobre sourcemaps/imports dinámicos. No se declaran corregidas por estos cambios.

## Preservación y evidencia

No se hicieron commits, push, PRs, despliegues, envíos a destinatarios reales ni cambios de infraestructura cloud. Las pruebas usaron PostgreSQL sintético; `englove_dev` no recibió migraciones ni fixtures de esta remediación. Se retiró el contenedor de humo y se eliminaron las bases `englove_remediation_20261112`, `englove_final_smoke_20261112` y las cuatro bases DAT-01 trazadas en los logs de esta remediación; las demás bases se preservaron. PostgreSQL quedó detenido como al inicio. Se conserva la imagen local `englove-api:remediation` para revisión.

Logs ignorados bajo `test-evidence/audit-2026-11-12/`: `final-static.log`, `final-typecheck.log`, `final-build.log`, `final-tests.log`, `final-e2e.log`, `final-ci-tests.log`, `final-dependencies.json`, `final-staging-build.log`, `final-docker-build.log`, `final-docker-offline.log`, `final-docker-runtime.log`, `final-docker-health.log`, `parser-security.log` y los diagnósticos iniciales. Las regresiones permanentes y scripts sí forman parte del cambio versionable.
