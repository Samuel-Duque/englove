# Promoción a staging

Este procedimiento implementa SPEC-01 RF-18. Es preparación versionada; no acredita aprovisionamiento, un workflow remoto aprobado ni lanzamiento. Requisitos operativos en ENG-003/004/130/131/132/138 y en el taskboard.

## Configuración previa

Crear el environment `staging` en GitHub y aplicar sus restricciones de acceso. Configurar:

| Clase | Nombre | Uso |
|---|---|---|
| Secret | `MIGRATION_DATABASE_URL` | Conexión directa a Neon **staging**, con privilegios para migrar; nunca runtime API |
| Secret | `RENDER_API_KEY` | Promover el servicio de staging |
| Secret | `CLOUDFLARE_API_TOKEN` | Editar únicamente el Worker de staging y sus assets |
| Variable del environment | `RENDER_SERVICE_ID` | Servicio Render de staging, no producción |
| Variable del environment | `CLOUDFLARE_ACCOUNT_ID` | Cuenta que aloja el Worker |
| Variable del environment | `STAGING_API_URL` | Origen HTTPS real de la API, sin ruta ni credenciales |
| Variable del environment | `STAGING_WEB_URL` | Origen HTTPS real del frontend |
| Variable del repositorio | `STAGING_DEPLOY_ENABLED` | `true` únicamente tras aprovisionar y revisar los destinos anteriores |

El flag de habilitación es del repositorio: el `if` del job se evalúa antes de cargar el environment. Sin él, CI comprueba código e imagen, pero no migra ni publica. No interpretar un job omitido como despliegue aprobado.

Aplicar el blueprint `render.yaml` con `autoDeployTrigger: 'off'` al servicio correcto. La API de Render debe informar `autoDeploy: 'no'`; el preflight lo comprueba antes de migrar. El servicio debe usar este repositorio, el Dockerfile de API y una instancia. Configurar fuera del repositorio sus credenciales runtime, dominio, cookies, CORS, R2 privado, correo y conexión pooler. Mantener inventario de subdominios bajo control del proyecto.

## Ejecución y evidencia

1. Un push a `develop` o `master`, o una ejecución manual sobre esas ramas, verifica lint, tipos, guardrails, pruebas con PostgreSQL 18 efímero, build, tamaño gzip y Docker Linux. Playwright debe pasar y conserva evidencia ante fallos. No hay promoción desde PR.
2. Solo después de todas las compuertas se adquiere el bloqueo de staging. `cancel-in-progress: false` evita interrumpir una migración con otro commit; migración y ambas publicaciones están en el mismo job serializado.
3. El job hace checkout del SHA del evento, verifica configuración y autodeploy, construye con `CLOUDFLARE_ENV=staging` y prefijos `englove_stg_`, y empaqueta sin publicar. Turbo recibe esas variables explícitamente; no se reutiliza un build de otro entorno.
4. Aplica migraciones con la conexión directa. Publica ese mismo SHA en Render mediante `commitId`; espera `live`, comprueba `commit.id` y `/health`. Después publica el Worker construido y comprueba `/login`.
5. Conservar los logs del SHA, los resultados de los gates y la evidencia de aceptación en staging. La consulta Render y los thresholds de Worker son comprobaciones, no sustituyen cookies/audio/PWA/dispositivos reales.

El código de promoción se prueba con respuestas sintéticas en `scripts/deploy-render.test.mjs`; los invariantes del workflow están en `scripts/ci-pipeline.test.mjs`. La documentación oficial de [Render para un commit concreto](https://render.com/docs/deploys#deploying-a-specific-commit) y [Blueprints](https://render.com/docs/blueprint-spec) define `commitId` y la desactivación de autodeploy.

## Fallos y recuperación

- Un error de configuración, gate, build o empaquetado impide migrar.
- Si falla la migración, el job no despliega. Conservar diagnóstico y estado de Prisma; no reescribir migraciones aplicadas ni repetir procedimientos destructivos por ensayo/error.
- Si la API o el Worker fallan después de migrar, el job falla y no revierte automáticamente el esquema. No hay publicación atómica entre proveedores. Revisar compatibilidad con la versión anterior y corregir hacia adelante; una restauración requiere el procedimiento y respaldo ensayados de ENG-132.
- Si Render llega a otro SHA, no se publica el Worker. Si se supera el tiempo de espera, comprobar el despliegue existente antes de lanzar otro.
- Nunca asumir que volver al commit anterior revierte datos o migraciones. La migración histórica de descarte de juegos mantiene el tratamiento de DAT-01 descrito en la [remediación anterior](remediacion-auditoria-2026-11-11.md); los tests del envoltorio no autorizan SQL manual sobre una base existente.

No se dispara esta promoción como parte de corregir código local. La primera ejecución real queda pendiente de infraestructura, configuración y decisión de despliegue del equipo.
