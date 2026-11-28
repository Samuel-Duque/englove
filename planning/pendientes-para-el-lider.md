# Pendientes para el líder de Upward English

Tu tarea inmediata es proteger `master` y `develop`, revisar el [PR #2](https://github.com/Samuel-Duque/englove/pull/2) y decidir si el hallazgo de paginación debe corregirse antes de fusionarlo. Después, coordina los accesos y las pruebas de staging para preparar el piloto.

## Cerrar el PR y proteger las ramas

- [x] **Proteger `master` y `develop` (`ENG-001`).** Desde una cuenta administradora, entra a **Settings → Rules → Rulesets** y crea un ruleset activo para ambas ramas. Exige PR con una aprobación, rama al día y los tres checks de la tabla. Bloquea el borrado y los *force pushes*. Puedes aplicar la regla directamente o delegar esa configuración a `Sebastian-Tunjuelo`, que tiene permiso de escritura.
- [x] **Revisar el PR #2.** La revisión automática señaló que el detalle de asignaciones calcula entregas con una página de hasta 100 revisiones, lo que puede mostrar un conteo incompleto para asignaciones antiguas. Si afecta la aceptación de `UI-2`, pide una corrección antes de aprobar. Si puede esperar, registra el hallazgo con responsable y criterio de aceptación. [Conversación del PR](https://github.com/Samuel-Duque/englove/pull/2)
- [x] **Confirmar la aprobación y la integración.** Con revisión y checks en verde para el último commit, el equipo puede fusionar `UI-2` en `develop`. Revisa por separado los cambios locales que aún no están en el PR antes de elegir el commit que irá a staging.

| Job | Nombre que muestra GitHub |
| --- | --- |
| `quality-gates` | Lint, tipos, PostgreSQL, pruebas y build |
| `docker-build` | Imagen Linux de la API |
| `e2e-tests` | Playwright y accesibilidad |

La corrida del PR sobre `b756390` pasó los tres jobs. Playwright `mocked-ci` pasó 174/174, los scripts de CI 14/14 y las regresiones en PostgreSQL `NEG-01` 2/2 y `DAT-01` 5/5. Tras fusionar, el equipo debe seguir la corrida del SHA de `develop`. Con los tres jobs y `NEG-01` en verde, registra la evidencia y cambia `SPEC-08` a **Verificada** en la ficha y el índice. [Corrida aprobada](https://github.com/Samuel-Duque/englove/actions/runs/45906747730) · [SPEC-08](../specs/SPEC-08-estadisticas.md) · [Índice](../specs/README.md)

## Preparar staging

Confirma qué recursos existen y designa un responsable por servicio. El entorno usa datos de prueba y credenciales propias.

- [ ] **Dominio y hosting (`ENG-003`).** Confirma el control de `upwardenglish.app`. Configura `app-staging.upwardenglish.app` para el Worker de Cloudflare y `api-staging.upwardenglish.app` para Render. Crea o verifica el servicio Docker de la API en Render, con una instancia y despliegue automático desactivado.
- [ ] **Base de datos y archivos (`ENG-004`).** Prepara un proyecto Neon de staging con conexión *pooler* para la API y conexión directa para migraciones. Crea el bucket privado `upward-english-staging` en R2 con credenciales de alcance limitado y CORS para el origen web de staging.
- [ ] **Correo.** Verifica el dominio remitente en Resend y configura las credenciales en la API de staging. Prueba el envío a cuentas de prueba.
- [ ] **Despliegue en GitHub.** Crea el environment `staging` y restringe quién puede publicar. Carga los secretos en la configuración de cada servicio y comparte con el equipo qué quedó listo. [Guía de despliegue](despliegue-staging.md)

| Ubicación en GitHub | Valores |
| --- | --- |
| Secretos del environment `staging` | `MIGRATION_DATABASE_URL`, `RENDER_API_KEY`, `CLOUDFLARE_API_TOKEN` |
| Variables del environment `staging` | `RENDER_SERVICE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `STAGING_API_URL`, `STAGING_WEB_URL` |
| Variable del repositorio | `STAGING_DEPLOY_ENABLED=true` cuando los destinos estén comprobados y el equipo apruebe el primer despliegue |

Guarda el enlace de la primera corrida que migre Neon staging, publique el SHA esperado en Render, confirme `/health` y publique el Worker del mismo commit con `/login` accesible. [Secuencia de despliegue](despliegue-staging.md#ejecución-y-evidencia)

## Validar staging y preparar el piloto

- [ ] **Aceptar los tres flujos en staging (`ENG-130`).** La profesora crea y asigna contenido, el alumno completa una actividad y envía un audio, y la profesora reproduce el audio, califica y devuelve feedback. El alumno consulta el resultado y realiza un nuevo intento si está habilitado. Registra los resultados del login, las cookies, el audio en R2, los correos y el reintento.
- [ ] **Probar en dispositivos reales (`H2`, `H3`).** Coordina una sesión con una tablet Android y un iPad con micrófono. Registra grabación, reproducción, modo offline y reconexión, controles táctiles y cierre de sesión en un dispositivo compartido.
- [ ] **Completar la preparación docente (`H1`, `DOC-06`, `ENG-135`).** Validar el Manual de la Profesora, realizar el onboarding sin asistencia y acordar el contenido inicial A1–B2. Documenta si la profesora crea su primera actividad en menos de diez minutos.
- [ ] **Validar la operación y decidir el lanzamiento (`ENG-131`, `ENG-132`, `ENG-137`–`ENG-139`).** Asignar responsables para alertas sin datos personales, pruebas de carga con k6 y un ensayo de restauración en Neon staging. Con esa evidencia y los hitos de aceptación cerrados, revisar la preparación de producción y registrar el Go/No-Go antes de incorporar al primer grupo.

Confirma al equipo quién protegerá las ramas, la decisión sobre el PR y su hallazgo de paginación, y quién tiene acceso a cada servicio de staging. [Taskboard e hitos](taskboard.md) · [Secuencia de la auditoría](auditoria-integral-estado-actual.md)
