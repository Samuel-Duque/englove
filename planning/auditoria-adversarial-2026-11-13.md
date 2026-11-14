# Auditoría adversarial de Englove — 13 de noviembre de 2026

## Dictamen ejecutivo

**Estado: base técnica bien estructurada, madurez adversarial REGULAR y preparación operativa local INCOMPLETA.** No hay evidencia para calificar todo el desarrollo como mal ejecutado: hay separación de responsabilidades, aislamiento de tenant, validación, pruebas y controles de autorización efectivos. Sin embargo, las pruebas ordinarias no cubren varias fronteras de fallo reales.

Se documentan **12 hallazgos reproducidos** —incluidos problemas operativos y uno con dependencias simuladas— y **6 riesgos condicionados o pendientes de reproducción completa**. No se demostró RCE, SQL injection, toma de cuentas ni acceso cruzado entre organizaciones. Esto no certifica su ausencia.

**No recomendaría aceptar el piloto en dispositivos compartidos sin resolver la privacidad entre pestañas, la integridad de entregas y el procesamiento real de audio**, y sin completar la evidencia operativa indicada al final. Las recomendaciones NO se implementaron.

### Prioridades

1. Dispositivos compartidos y red local: RT-04 y RT-10.
2. Entregas, progreso y speaking: RT-01, RT-02, RT-03 y RT-11.
3. Validación de seguridad del despliegue: RT-05, RT-06, RT-08, RT-09 y riesgos condicionados.
4. Contratos de error: RT-07 y RT-12.

La prioridad no equivale a un exploit crítico. No se asigna CVSS sin acreditar sus supuestos.

## 1. Alcance, autorización y método

- **Repositorio:** Englove; rama `develop`; commit `116465e` (`chore(turbo): excluir .next/dev de outputs de build`). Árbol versionado limpio al comenzar.
- **Fecha:** 2026-11-13, America/Bogota.
- **Autorizado:** inspección del proyecto completo, pruebas adversariales locales y este informe nuevo, sin solucionar problemas.
- **No realizado:** cambios de código/configuración/specs, commits, push, PR, despliegues, acceso a cloud/staging/producción, ataques a otros equipos, correos a destinatarios reales ni destrucción de datos existentes.
- **Actores:** anónimo, alumno propietario, otro alumno del tenant, profesora, profesora de otra organización, siguiente usuario de dispositivo compartido, cliente que falsifica cabeceras y dependencias que fallan después de una escritura.
- **Skills:** `security-review` y referencias pertinentes; `englove-guardrails`; `systematic-debugging`; `pwa-development`; `playwright-best-practices`; `webapp-testing`; `verification-before-completion`; `supabase-postgres-best-practices` para bases efímeras; `cognitive-doc-design` para el informe.
- **Autoridad:** `.agents/CONTEXT.md`, arquitectura, specs pertinentes y fuentes dueñas de cada comportamiento. Resultados históricos no se atribuyen a esta ejecución.
- **Memoria:** Engram no expuso herramientas en esta sesión; no se leyó ni guardó memoria mediante ese servidor.

### Niveles de evidencia

| Evidencia | Qué acredita |
|---|---|
| HTTP + PostgreSQL/MinIO/Mailpit reales | Comportamiento a través de la API y el servicio local correspondiente. |
| Chromium + frontend real + API simulada | Interfaz y estado del navegador; no autorización del backend ni proveedor real. |
| Servicio fuente + dependencias simuladas | Transición determinista bajo fallo inyectado; no una interrupción real del proveedor. |
| Inspección de fuente | Causa/condiciones; no demuestra por sí sola explotación completa. |

**Ninguna prueba finita garantiza que «nada queda fuera» o que se encontraron todos los errores.** Se cubrieron las grandes superficies y se declaran los límites, sin presentar una revisión amplia como certificación exhaustiva. Swagger local inventarió **66 rutas y 77 operaciones**: inventariarlas no significa ejecutar cada combinación de todas ellas.

## 2. Entorno y aislamiento

| Componente | Observación actual |
|---|---|
| Frontend existente | `localhost:3000/login`: 200; Chromium real. |
| API existente | `localhost:3001/health`: 200; reconocimiento no destructivo. |
| PostgreSQL | `englove-postgres`, PostgreSQL 18, puerto host 5433. |
| MinIO | `englove-minio`, 9000/9001; health 200. |
| Mailpit | `englove-mailpit`, SMTP 1025, API/UI 8025 sin autenticación. |
| Audio en Windows | `ffmpeg` y `ffprobe` ausentes (`ENOENT`). |
| Puertos Docker | PostgreSQL, MinIO y Mailpit publicados en `0.0.0.0` y `[::]`, no solo loopback. |

Se crearon únicamente recursos nuevos y sintéticos:

- `englove_redteam_20261113`: cuatro migraciones existentes, seed de 11 alumnos ficticios y segunda organización de prueba. API separada en `localhost:3101`, cookies con prefijo exclusivo.
- `englove_redteam_suites_20261113`: cuatro migraciones existentes y suite API completa.
- `englove_audit_migration_49080d086f8443d39ed820262ae4df98`: base nueva creada por DAT-01.
- Bucket privado `englove-redteam-20261113`: audio sintético.
- Cuatro correos de prueba capturados solo por Mailpit; ninguno salió del equipo.

No se migró, sembró ni modificó deliberadamente `englove_dev`, ni se reescribió una migración histórica. RT-03 usó un trigger de fallo temporal exclusivamente en la base de auditoría, retirado tras la sonda. RT-02 simuló el paso del tiempo solo sobre una fixture.

La API de las sondas usó el build local. Una compilación adicional a un directorio temporal confirmó que los actuales `AuthService`, `AttemptsService`, `MediaService` y `AllExceptionsFilter` producen exactamente los archivos JavaScript utilizados por esa API.

## 3. Comprobaciones observadas

| Comprobación | Resultado actual | Límite |
|---|---|---|
| `pnpm --filter @englove/shared test` | **69/69**, exit 0 | No acredita integración desplegada. |
| `pnpm --filter @englove/web test` | **276/276**, exit 0 | No descarta escenarios nuevos entre pestañas. |
| API completa, PostgreSQL obligatorio y DAT-01 habilitado | **455/456**, 1 fallo, 0 omitidas; exit 1 | Audio real no operativo. |
| Playwright completo, headless | **50/50**, exit 0; 3,2 min | API interceptada; speaking no acredita proveedores reales. |
| Scripts CI/despliegue con servicios sintéticos | **8/8**, exit 0 | No ejecuta GitHub Actions/Render/Cloudflare reales. |
| Guardrails `--all` | **0 errores, 23 avisos, 73 supresiones**, exit 0 | No sustituye comprobaciones manuales. |
| `node scripts/check-no-db-push.mjs` | Aprobada | No certifica toda migración sobre datos reales. |
| Sondas adicionales | RT-01 a RT-12 | No se incorporaron regresiones permanentes ni arreglos. |

**Único fallo de API:** `test/media.spec.ts:190`, `ERR-04: mide un WebM válido sin metadato de duración mediante sus paquetes`. `spawnSync('ffmpeg', …).status` es `null`; ambos binarios devuelven `ENOENT`. DAT-01 pasó cinco comprobaciones, incluidas sus dos pruebas de migración real aislada.

Primeros lanzamientos de algunas herramientas fueron bloqueados por el sandbox (`esbuild`/`tsx`). Se repitieron con la escalación disponible o ejecución Node equivalente. Esos bloqueos no se contaron como defectos del producto. La ausencia de los binarios sí es una carencia del entorno.

## 4. Hallazgos reales y reproducidos

| ID | Hallazgo | Severidad contextual | Evidencia |
|---|---|---|---|
| RT-01 | Replay revierte respuestas tras 500 IDs | Media | HTTP + PostgreSQL |
| RT-02 | Juego autónomo se completa tras caducar | Media/baja: práctica | HTTP + PostgreSQL; reloj/token de prueba |
| RT-03 | Fallo poscommit pierde evento de progreso sin recuperación | Media | HTTP + PostgreSQL; fallo inyectado |
| RT-04 | Logout deja información visible en otra pestaña | Media | Chromium real; API simulada |
| RT-05 | IP falsificable evade límites en acceso directo | Media local; cloud condicionado | HTTP real |
| RT-06 | Rechazos de autenticación fuera del límite global | Media; sin caída demostrada | HTTP real |
| RT-07 | SID malformado en refresh provoca 500 | Baja | HTTP + PostgreSQL |
| RT-08 | Segundo cambio de correo notifica al anterior incorrecto | Media | HTTP + PostgreSQL + Mailpit |
| RT-09 | Borrado parcial pierde objetos conservando filas | Media | Fuente y storage simulado |
| RT-10 | Servicios administrativos locales en todas las interfaces | Media local; alta si red no confiable los alcanza | Docker + conexiones loopback |
| RT-11 | Speaking falla por ffprobe ausente y culpa al usuario | Media operativa | Chromium, HTTP, MinIO y logs |
| RT-12 | Cuerpo superior a 1 MiB devuelve 500, no 413 | Baja | HTTP real |

### RT-01 — La deduplicación olvida eventos y permite reaplicarlos

**Fuente:** `apps/api/src/attempts/attempts.service.ts:932–953`. `specs/SPEC-05-portal-e-intentos.md:54` exige que cada ID se aplique una vez y que uno antiguo no revierta respuestas posteriores.

**Actor:** alumno autenticado, dueño de un intento abierto y su token válido. No necesita modificar la base.

**Reproducción:** enviar `E0` con `itemId: "pairs"`, respuesta `{ "a": "OLD" }` y UUID v4; enviar diez lotes de 50 eventos nuevos para ese ítem con `{ "a": "LATEST" }`; reenviar exactamente `E0`.

**Esperado:** reconocer el duplicado y conservar `LATEST`. **Observado:** HTTP 200; PostgreSQL cambia `LATEST` por `OLD`; quedan exactamente 500 IDs procesados. Son doce peticiones de eventos, dentro de límites ordinarios.

**Causa:** el buffer FIFO olvida el ID y vuelve a tratarlo como nuevo. El bloqueo SQL no impide ese replay.

**Impacto:** una cola offline retrasada puede deshacer respuestas recientes; también lo puede provocar el alumno. No se demostró falsificar la nota, que sigue calculándose en servidor.

**Recomendación:** deduplicación duradera durante todo el intento o secuencia/versionado monotónico que impida aplicar eventos anteriores. Regresión que cruce 500 IDs.

### RT-02 — Completar un juego autónomo omite su ventana temporal

**Fuente:** `attempts.service.ts:1043–1058,1745–1750`; compensación parcial en `maintenance/maintenance.service.ts:173–198`.

**Reproducción:** iniciar un microjuego normalmente; situar `started_at` 48 horas antes en la fixture aislada; enviar `complete` con token auténtico expirado, emitido con la clave exclusiva del servidor de prueba.

**Esperado:** `409 ATTEMPT_CLOSED`, porque la propia API declara una ventana de 24 horas. **Observado:** HTTP 200, `graded`, nota persistida `0.0` con las respuestas de esa sonda y flags vacíos. Una sonda adicional de servicio con respuestas correctas y persistencia simulada obtuvo 5 y tres estrellas.

**No se afirma que el alumno pueda firmar tokens o modificar timestamps.** La instrumentación representa conservar un token originalmente válido tras su caducidad. El endpoint comprueba firma/claims, ignora `exp` y solo comprueba el cierre cuando hay `assignment_id`.

**Ventana real:** mientras permanezca `in_progress`, antes del mantenimiento que lo abandona. Un job puntual reduce la ventana; una interrupción la prolonga. No permite completar un intento ya abandonado. Afecta práctica, no se acreditó alterar notas académicas fuera de plazo.

**Recomendación:** comprobar el cierre autónomo en la transición transaccional; mantener separada la devolución idempotente de recibos ya finalizados.

### RT-03 — El commit y el progreso divergen sin recuperación

**Fuente:** `attempts.service.ts:1050–1053,1385–1410`; `gamification/gamification.service.ts:53–69`.

**Prueba:** trigger temporal que rechazó solo los inserts de `progress_events` de un intento sintético; completar por HTTP, retirar trigger y repetir la petición.

```text
Primera entrega: HTTP 500; attempts.status = graded
Dependencia recuperada; reintento: HTTP 200
Estado final: graded; progress_events del intento = 0
```

**Causa:** el evento se emite fuera de la transacción; la salida idempotente devuelve el recibo sin reparar el efecto ausente.

**Impacto:** rachas, contadores e insignias dependientes pueden omitir una entrega válida; el cliente ve error pese a guardar la nota. No requiere SQL malicioso en producción: la sonda representa un fallo transitorio.

**Recomendación:** evento dentro de la transacción o outbox transaccional con consumo idempotente y recuperación. Regresión de caída entre commit y evento, recuperación y reintento.

### RT-04 — Logout no limpia las demás pestañas abiertas

**Fuente:** `apps/web/src/lib/auth-session.ts:16,48–67,85–86`; `auth-hygiene.ts:20–23,223,238`; `components/teacher-nav.tsx:29–30` y flujo equivalente de alumno.

**Actor:** siguiente usuario del equipo compartido. Chromium con frontend real en `/inicio`, dos pestañas y API sintética. El logout revocó la autorización simulada y eliminó cookies del contexto.

```json
{
  "authorized": false,
  "sessionRequests": 2,
  "firstPath": "/login",
  "secondPath": "/inicio",
  "visibleAfterLogout": true,
  "logoutPending": null
}
```

La segunda recibió los eventos `storage`, pero conservó visible `AUDIT_PRIVATE_TEACHER_IDENTITY`, incluso al recibir foco. No reconsultó sesión ni produjo errores JavaScript. El auditor principal repitió la sonda e inspeccionó la captura.

**Impacto probado:** información autenticada visible después de logout. **No demuestra autorización de nuevas operaciones ni bypass del backend.** Se mostró identidad docente; listas completas de alumnos/notas requieren ampliar reproducción.

**Recomendación:** generación de sesión persistente entre pestañas y suscriptor que limpie QueryClient/memoria, suspenda colas y navegue a login; consultas aisladas por identidad. Regresiones de logout y cambio de cuenta multi-pestaña.

### RT-05 — X-Forwarded-For elude el límite por IP en acceso directo

**Fuente:** `apps/api/src/main.ts:31,95`; `common/utils/identity.utils.ts:40–55`; `auth/auth.service.ts:275`.

Mismo proceso/destino TCP, correos inexistentes y contraseña inválida, sin afectar cuentas reales:

```text
11 logins con X-Forwarded-For fijo: 401 × 10, después 429
12 logins rotando X-Forwarded-For: 401 × 12, ningún 429
```

**Causa:** `trust proxy = 1` también aplica al cliente directo y permite controlar `request.ip` mediante esa cabecera.

**Impacto:** evasión de límites por IP local/directa; no elimina bloqueo por cuenta ni demuestra fuerza bruta exitosa. Origin/CORS no detienen clientes no navegador que envían el origen permitido.

**Cloud condicionado:** falta comprobar si Render reescribe la cabecera y bloquea caminos directos. No se afirma explotación productiva.

**Recomendación:** confiar solo en proxies/topologías comprobados, no en acceso directo; límites de ingreso independientes.

### RT-06 — Rechazos previos no consumen el presupuesto global

**Fuente:** `apps/api/src/app.module.ts:98–113`; `common/guards/jwt-auth.guard.ts:63–69`; `common/rate-limiting/rate-limiter.guard.ts:25–30`.

**Prueba:** 35 GET anónimos a `/api/v1/me`, misma IP, menos de un minuto. **Observado:** 35 respuestas 401, ninguna 429, aunque se declara 30/minuto.

**Causa:** JWT/roles preceden al limitador y lanzan excepción antes de alcanzarlo. Los límites específicos de login sí funcionan en esa ruta pública: son controles distintos.

**Impacto:** parte del tráfico adversarial, incluida validación fallida de tokens en rutas protegidas, queda fuera del límite global. No se hizo saturación ni se demostró caída.

**Recomendación:** límite grueso por IP antes de autenticación costosa, además del límite por usuario validado. Probar solicitudes que terminan en 401/403.

### RT-07 — Refresh con SID malformado devuelve 500

**Fuente:** `apps/api/src/auth/auth.service.ts:495–513`.

```http
POST /api/v1/auth/refresh
Origin: http://localhost:3000
Cookie: englove_rt_refresh_token=not-a-uuid.secret
```

**Esperado:** 401 sin consultar un UUID inválido. **Observado:** HTTP 500, `INTERNAL_ERROR`. El SID llega a Prisma sin validación de formato. No se expusieron stack/SQL ni se burló autenticación.

**Recomendación:** validar sintaxis/tamaño antes de consultar y normalizar credenciales inválidas al contrato de autenticación.

### RT-08 — Segundo cambio de correo avisa al anterior incorrecto

**Fuente:** `auth/auth.service.ts:1243–1247`; `common/guards/jwt-auth.guard.ts:158–162`; contrato `specs/SPEC-02-identidad-y-sesion.md:86`.

**Prueba completa local:** alumno sintético, HTTP, PostgreSQL y SMTP/Mailpit; dos solicitudes y confirmaciones OTP válidas, sin refrescar access token entre ambas.

1. A → B: solicitud 202, confirmación 200; aviso anterior a A, correcto.
2. B → C: solicitud 202, confirmación 200; aviso anterior otra vez a A, incorrecto.

Mailpit registró dos avisos a A y ninguno de cambio completado a B. Los OTP llegaron a los nuevos correos esperados; no se imprimieron ni salieron del equipo.

**Causa:** `currentUser.email` conserva el claim anterior, en lugar del correo vigente que se sustituye en base.

**Impacto:** B no recibe aviso de sustitución y A sigue recibiendo notificaciones. No se demostró que permitan revertir el cambio o acceder a la cuenta.

**Recomendación:** capturar el correo previo real en la misma operación transaccional; regresión A→B→C antes de renovar access token.

### RT-09 — Borrado parcial entre storage y base de datos

**Fuente:** `apps/api/src/students/students.service.ts:1049–1059`. La decisión 103 ordena borrar objetos antes que filas: es una brecha de resiliencia de esa estrategia, no incumplimiento de ese orden.

**Prueba:** servicio fuente actual con storage/persistencia simulados. Borrar `raw-a` tuvo éxito; borrar el convertido lanzó timeout.

```text
Objetos borrados: [raw-a]
Transacción SQL iniciada: false
Alumno y metadatos conservados: true
```

**Impacto:** una operación fallida deja filas que apuntan a archivos perdidos. Un fallo SQL después del borrado de objetos tiene el mismo límite entre sistemas. No se borraron archivos/alumnos reales. La regresión existente prueba fallo del primer objeto, no éxito parcial seguido de fallo.

**Recomendación:** estado durable de borrado/saga, reanudación idempotente y visibilidad de operaciones incompletas; no prometer atomicidad entre sistemas sin recuperación.

### RT-10 — Servicios administrativos publicados fuera de loopback

**Fuente:** `docker-compose.yml:11–15,32–37,62–64`.

Docker publica 5433, 9000, 9001, 1025 y 8025 en `0.0.0.0` y `[::]`. Con credenciales conocidas del compose se accedió al PostgreSQL administrativo para crear bases efímeras y a `ListBuckets` de MinIO. Mailpit respondió 200 a `/api/v1/messages` sin autenticación.

**Impacto:** quien alcance esos puertos puede intentar acceder a base, storage o correos con OTP/recuperaciones. El bucket sí negó GET anónimo con 403; eso no protege de credenciales administrativas conocidas.

**Límite:** no se probó desde otro equipo ni se inspeccionó firewall. Publicación en todas las interfaces NO demuestra exposición a Internet/LAN. La gravedad sube a alta si red no confiable puede alcanzarlos y hay datos útiles.

**Recomendación:** loopback por defecto, credenciales no compartidas cuando haya varios usuarios, protección de Mailpit y firewall. Para tablets, exponer frontend HTTPS de forma controlada, no interfaces administrativas.

### RT-11 — Speaking no confirma audio y el error culpa al alumno

**Fuente:** `apps/api/src/media/media.service.ts:1000–1100`; `test/media.spec.ts:190`.

Chromium generó WebM sintético durante aproximadamente 3,1 segundos, 45.698 bytes. Un speaking real obtuvo URL y MinIO aceptó PUT 200. Confirmar devolvió:

```json
{ "statusCode": 422, "code": "AUDIO_IMPLAUSIBLE_DURATION", "message": "Graba al menos 2 segundos" }
```

El log señala `spawn ffprobe ENOENT`. La suite falla al generar WebM con `ffmpeg` ausente. No se midió duración independientemente con ffprobe porque falta ese binario: los 3,1 segundos corresponden al temporizador del navegador.

**Impacto:** no se puede confirmar/transcodificar esa grabación local y se atribuye al alumno una carencia del servidor. Regrabar no instala binarios. No acredita audio malicioso aceptado ni fallo del Docker Linux, cuyo Dockerfile sí instala ffmpeg.

**Recomendación:** comprobar dependencias al preparar/arrancar entorno; probar speaking con binarios reales; diferenciar indisponibilidad del procesador de audio inválido. No se instalaron binarios para ocultar el estado encontrado.

### RT-12 — La barrera de tamaño devuelve un contrato erróneo

**Fuente:** `apps/api/src/main.ts:44–45`; `common/all-exceptions.filter.ts:31–37`.

**Prueba:** POST login JSON con contraseña de `1024 * 1024` caracteres más envoltura: supera 1 MiB. **Esperado:** 413, `PAYLOAD_TOO_LARGE`. **Observado:** 500, `INTERNAL_ERROR`.

El límite sí rechaza el cuerpo: no se demostró procesamiento ni caída. Como control, JSON truncado devolvió 400 correctamente.

**Causa:** el filtro traduce instancias de `HttpException`, pero no ese error del parser; termina como error interno genérico.

**Impacto:** métricas/clientes confunden abuso de tamaño con avería y pueden reintentar incorrectamente. Sin fuga interna observada.

**Recomendación:** normalizar tipos/estados conocidos del parser sin revelar detalles internos.

## 5. Riesgos difíciles, condicionados o sin reproducción completa

**No se suman a los 12 anteriores ni se presentan como explotaciones logradas.** Algunas condiciones son realistas, pero falta demostrar la cadena completa. «Difícil» no significa «imposible» ni acredita presencia en producción.

| ID | Riesgo y evidencia | Condición o prueba pendiente | Recomendación |
|---|---|---|---|
| C-01 | SID conocido permite revocar sesión con refresh incorrecto. `auth.service.ts:510–538`. API/DB reales: sesión 200 → refresh incorrecto 401 → sesión 401. | El SID vino de la fixture propia del auditor. **No se encontró una filtración de SID ajeno**; cookies HttpOnly y UUID no adivinable. No es toma de cuenta. | Distinguir replay acreditado de un secreto anteriormente emitido frente a secreto arbitrario inválido; no revocar solo por conocer identificador. |
| C-02 | Validación/conversión usan una clave S3 mutable. URL PUT 600 s; rama `ready` no relee S3; descarga posterior sin checksum/versión vinculante. `media.service.ts:309–313,459–484,778–792`. | MinIO aceptó **dos PUT 200** con misma URL y cuerpos distintos de igual longitud. Firma: `content-length;host`; **no se probó saltar 10 MiB**. RT-11 impidió confirmación real: falta sustitución después de validar y antes de convertir. | Vincular validación/procesamiento a bytes inmutables, checksum o versión; clave final no reescribible por el alumno. |
| C-03 | MP4 con audio/vídeo amplía coste de conversión: ffprobe selecciona `a:0`, ffmpeg sin mapa exclusivo de audio ni `-vn/-sn/-dn`. `media.service.ts:1007–1009,803–815`. | No se procesó vídeo adversarial ni se reprodujo OOM de 512 MB, SSRF o RCE. | Rechazar streams ajenos al contrato y convertir solo audio con límites de recursos. |
| C-04 | Edición de actividad frente al primer inicio. `activities.service.ts:546–563` comprueba conteo sin coordinación común acreditada con inicio. | Falta intercalado determinista con dos conexiones PostgreSQL que pruebe entrega de una versión y calificación con otra. Leer dos funciones no basta. | Prueba concurrente con barreras; bloqueo/versionado coherente del contenido. |
| C-05 | Mantenimiento podría abandonar un intento cuyo estado cambió después de la lectura. `maintenance.service.ts:173–198`, escritura sin condicionar el estado leído. | Falta reproducir intercalado con finalización concurrente en PostgreSQL. | Actualización condicional con invariantes transaccionales y regresión concurrente. |
| C-06 | Getters firman URL de `pending_delete`; solo rechazan `deleted`. `media.service.ts:618–620,660`; confirmado en servicio fuente con persistencia simulada. | Exige profesora del tenant y UUID conocido; no se acreditó acceso ajeno ni obligación de inaccesibilidad inmediata durante limpieza. | Definir estados reproducibles y alinear getters, confirmación y retención. |

### Endurecimiento observado, no contado como exploit

- `seedMinimal` incluye contraseña docente de desarrollo por defecto (`prisma/seeds/seed.ts:9–10`) sin barrera propia de entorno acreditada. No se comprobó cuenta desplegada con ella. Exigir credencial explícita fuera de local; no confundir fixtures con secretos productivos filtrados.
- HTML del frontend de **desarrollo** sin CSP, `X-Frame-Options`, `Referrer-Policy` ni `X-Content-Type-Options`. La API sí devolvió Helmet. No se probó clickjacking ni se inspeccionó el Worker desplegado; comprobar la capa que sirve HTML sin extrapolar desarrollo a producción.
- Imágenes locales `latest` y acciones CI por tag requieren gestión de supply chain. No se demostró compromiso. No se consultó feed de advisories actualizado ni se transfirió el lockfile a un servicio externo; no se emite un «sin CVE» actual.

## 6. Controles que resistieron y falsos positivos descartados

- **Tenant real:** profesora de organización B recibió 404 al leer alumno, grupo, actividad, asignación y estadísticas del tenant A. También 404 al archivar grupo/actividad o cancelar asignación ajenos. Las tres filas conservaron sus estados originales.
- **Alumnos:** otro alumno recibió 404 al leer/enviar eventos al intento ajeno. Token de intento alterado: 401. Sondas de servicio rechazaron tres combinaciones de token alterado/actor/tipo.
- **RBAC:** alumno sin acceso a listas administrativas de alumnos, grupos, actividades o asignaciones: 403. Una ruta inexistente que responde 404 no se contó como fallo.
- **Entrada:** UUID inválido, paginación excesiva y recurso `javascript:alert(1)` rechazados con 400; origen no permitido con 403; JSON truncado con 400.
- **Scoring:** respuestas vacías dieron 0; reutilizar destino de matching no produjo máximo. Campos cliente de nota/tiempo no determinaron la nota ni el reloj de la prueba.
- **Storage:** GET anónimo del objeto sintético: 403. No se publican URLs firmadas.
- **Logs muestreados:** sin contraseñas sintéticas ni cookies access de las sondas; errores inesperados sin stack/SQL. No equivale a revisar todo el historial/Sentry.
- **Fuente y suites:** revisión de aprobación, revocación, recuperación/OTP, filtros de tenant, escape React y SW `NetworkOnly` para datos sensibles. No se encontró un sink XSS de alta confianza en lo inspeccionado.
- **No es fuga accidental:** soluciones públicas/feedback de microjuegos son diseño de SPEC-06; no se confundieron con `answer_key` académico. Reinicio del reloj de `timed_choice` al recargar: decisión 106, no bug nuevo.
- Pasar lint, compilar o cumplir un patrón estático **no desmiente** las reproducciones adversariales.

## 7. Cobertura del proyecto y límites materiales

| Superficie | Cobertura efectuada | Pendiente o límite |
|---|---|---|
| Autenticación, registro, sesión, bloqueo, recuperación, OTP | Guards/servicios, suites API/UI, login/refresh/Origin/rate reales, dos cambios de correo reales. | No spam masivo, robo de sesión ni proxy cloud. |
| Alumnos/grupos | RBAC y tenant reales; suites completas; fallo de borrado en servicio. | No borrado de datos existentes ni interrupción de storage real. |
| Actividades, asignaciones y cinco tipos | Shared/API/Playwright, aislamiento y mutaciones cruzadas, juego real y speaking parcial. | No todas las configuraciones mediante UI con API real. |
| Intentos, reintentos, eventos, cierres y cinco mecánicas | Replay, caducidad, evento perdido, token; suites y concurrencia PostgreSQL existentes. | C-04/C-05; no fuzzing exhaustivo ni todas las intercalaciones. |
| Revisión, feedback, estrellas, insignias/progreso | Suites, consultas reales, pérdida de evento demostrada. | No ciclo integral profesora-alumno real de cada revisión/reintento. |
| Estadísticas, rankings privados, flags | Consultas, API/PostgreSQL y navegador, acceso cruzado denegado. | No carga productiva ni aceptación de enmienda SPEC-08 en CI remoto. |
| Contenido extra y enlaces | URL maliciosa rechazada, suites y navegador/axe. | No reputación/seguridad de todos los destinos; no fueron atacados. |
| PWA, offline, cachés y logout | Cola/higiene/SW y Playwright; multi-pestaña adicional. | Desarrollo no acredita SW publicado; sin tablets ni cierres abruptos del SO. |
| Media/storage | Fuente/suites de token/tenant; audio real sintético, PUT/lectura privada MinIO, binarios. | RT-11 impidió confirmar/transcodificar; sin Safari/iOS, vídeo hostil ni caída de R2. |
| PostgreSQL/Prisma/migraciones/mantenimiento | Bases aisladas, API completa, DAT-01 real, constraints/filtros por fuente y suites. | Sin restauración real, caída del contenedor existente ni certeza de conteos históricos. |
| Logs, errores y privacidad | Filtro/redacciones; muestreo de respuestas/logs de sondas. | Sin Sentry/datos productivos, inventario histórico de PII ni auditoría legal. |
| CI, Docker, Render, Worker, dependencias | Configuración, lockfile, scripts y ocho pruebas; guardrails/puertos. | Sin construir imagen nueva con descargas, cloud/rollback, feed completo CVE o GitHub Actions real. |
| Disponibilidad/recursos | Peticiones acotadas e inyección recuperable de fallo. | Sin DDoS, k6 prolongado, OOM intencional, corte general de red o apagado de servicios existentes. |

No se atacaron recursos compartidos preexistentes para aparentar cobertura absoluta. Lo no acreditado permanece pendiente, no «aprobado» ni fallo inventado.

### Informe de guardrails

- **Alcance:** repositorio, fuentes pertinentes y entorno local observado.
- **Compuerta SDD:** auditoría sin implementación; estados de specs sin cambios.
- **Script:** 0 errores, 23 avisos, 73 supresiones. No se afirma revalidación manual de cada supresión.
- **Veredicto del conjunto:** **INCUMPLE la preparación operativa y privacidad necesarias**, aunque el detector estático no marque errores.

| Bloque | Resultado contextual |
|---|---|
| A. Persistencia/tenant | Controles probados resistieron; RT-01/RT-03/RT-09 muestran límites de integridad/recuperación. |
| B. Despliegue/storage/audio | RT-10/RT-11; C-02/C-03 pendientes; sin veredicto favorable cloud no probado. |
| C. Negocio/privacidad/seguridad | RT-02/RT-04/RT-05/RT-06/RT-07/RT-08/RT-12; el script no sustituye estas pruebas. |

## 8. Reproducción y evidencia incorporada

Las sondas se ejecutaron fuera del repositorio. No se incluyen cookies, OTP, claves ni URLs firmadas utilizables. Los fragmentos permiten reconstruir pruebas sin conservar credenciales temporales.

### HTTP mínimo: validación y límites

Solo contra una API de pruebas aislada:

```javascript
const base = "http://localhost:3101";
const headers = { Origin: "http://localhost:3000", "Content-Type": "application/json" };

await fetch(`${base}/api/v1/auth/refresh`, {
  method: "POST",
  headers: { ...headers, Cookie: "englove_rt_refresh_token=not-a-uuid.secret" },
}); // RT-07: 500. Adaptar el prefijo al servidor de pruebas.

await fetch(`${base}/api/v1/auth/login`, {
  method: "POST", headers,
  body: JSON.stringify({ email: "absent@example.invalid", password: "A".repeat(1024 * 1024) }),
}); // RT-12: 500, no 413.

for (let i = 0; i < 35; i++) {
  await fetch(`${base}/api/v1/me`, { headers: { "X-Forwarded-For": "198.51.100.90" } });
} // RT-06: 35 respuestas 401; ejecutar en menos de un minuto con IP de prueba limpia.
```

### RT-01: replay por interfaz pública

Sesión y token legítimos de una fixture propia:

```javascript
const first = { itemId: "pairs", answer: { a: "OLD" }, clientEventId: crypto.randomUUID() };
const send = events => fetch(`${base}/api/v1/attempts/${attemptId}/events`, {
  method: "POST",
  headers: { ...headers, Cookie: sessionCookie, "X-Attempt-Token": attemptToken },
  body: JSON.stringify({ events }),
});
await send([first]);
for (let batch = 0; batch < 10; batch++) {
  await send(Array.from({ length: 50 }, () => ({
    itemId: "pairs", answer: { a: "LATEST" }, clientEventId: crypto.randomUUID(),
  })));
}
await send([first]); // PostgreSQL: OLD reemplaza LATEST.
```

### RT-03: fallo controlado

En base efímera, trigger `BEFORE INSERT ON progress_events` que lanza excepción solo para el `NEW.attempt_id` de la fixture. Completar por HTTP, comprobar `graded` pese al 500, retirar trigger/función, repetir y contar eventos. Resultado: 500 → 200 y contador 0. Nunca instalarlo en base compartida/productiva.

### RT-04: multi-pestaña

Chromium, un contexto, dos páginas `/inicio`, API interceptada con identidad sintética visible. Logout retira autorización/cookies. Cerrar desde la primera, esperar `storage` en la segunda y darle foco. Comprobar primera `/login`, segunda `/inicio`, identidad todavía visible y sin nueva petición de sesión. Revisar solo cookies o la primera pestaña no cubre el fallo.

### API completa aislada

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5433/englove_redteam_suites_20261113'
$env:MIGRATION_DATABASE_URL=$env:DATABASE_URL
$env:REQUIRE_POSTGRES_TESTS='1'
$env:RUN_AUDIT_MIGRATION_POSTGRES='1'
$env:AUDIT_MIGRATION_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:5433/postgres'
pnpm --filter @englove/api test
```

Credenciales del compose local de pruebas, no extraídas de remoto. DAT-01 crea una base aleatoria nueva; quien repita debe gestionar sus recursos efímeros.

## 9. Valoración técnica y de desarrollo

| Dimensión | Evaluación |
|---|---|
| Arquitectura/organización | **Buena:** frontend/API/shared y tenant verificables. No hay evidencia para condenar globalmente el diseño. |
| Seguridad básica de acceso | **Razonable en lo probado:** RBAC/aislamiento resistieron; no es certificación del despliegue. |
| Integridad bajo reintentos/fallos | **Regular:** deduplicación finita, evento poscommit y borrado entre sistemas con garantías incompletas. |
| Privacidad en equipos compartidos | **Insuficiente para aceptarla:** logout visual no se propaga entre pestañas. |
| Pruebas | **Buenas en flujos modelados, insuficientes en adversariales:** suites mayoritariamente verdes dejan escapar fallos; E2E interceptado no es integración completa. |
| Entorno local | **Incompleto:** audio bloqueado y servicios administrativos en todas las interfaces. |
| Producción | **No acreditada aquí:** proxy, cloud, backups, observabilidad, carga y dispositivos requieren evidencia propia. |

**Conclusión:** no está «mal ejecutado» globalmente; tiene una base de ingeniería defendible. La resistencia adversarial sigue siendo **REGULAR**, con defectos de privacidad, coherencia y operación que impiden cerrar seguridad porque compila o pasa pruebas habituales.

**Siguiente paso recomendado:** priorizar hallazgos reales, convertir cada reproducción en regresión y revalidar con servicios reales; después aceptación operativa específica de staging/tablets. No se autorizaron ni ejecutaron correcciones.

## 10. Cierre y preservación

Único artefacto versionable creado: este informe. Sin cambios de código, specs o configuración, commits ni publicaciones. Resultados y límites quedan incorporados aquí; sondas y credenciales temporales no forman parte del repositorio.

Retirada comprobada al cierre:

- API de auditoría detenida: 3101 cerrado; frontend/API preexistentes 3000/3001 y servicios locales seguían disponibles.
- Eliminadas únicamente las tres bases nuevas enumeradas en §2; inventario final de bases no plantilla: `postgres` y `englove_dev`.
- Eliminado el bucket de auditoría con su único objeto sintético.
- Retirados los cuatro mensajes identificados de RT-08; preservados dos mensajes ajenos a esa sonda. Se usó borrado con lista explícita de IDs, nunca vaciado global, conforme al [contrato oficial de Mailpit](https://raw.githubusercontent.com/axllent/mailpit/master/server/ui/api/v1/swagger.json).
- Retirados los cuatro destinos temporales de sondas/logs/compilación/capturas tras validar sus rutas absolutas; retirado el metadato de ejecución Playwright.
- El estado Git final contiene únicamente `planning/auditoria-adversarial-2026-11-13.md` como archivo nuevo; ningún archivo versionado modificado.

Las evidencias resumidas y las instrucciones de reconstrucción están en este documento. No quedan scripts temporales utilizables, tokens ni bases de auditoría para reutilizar; repetir exige preparar fixtures aisladas nuevas.

## 11. Estado de remediación, pendientes y preguntas abiertas

### Lo implementado

Se remediaron los hallazgos `RT-01` a `RT-12` siguiendo las recomendaciones de esta auditoría, `.agents/CONTEXT.md` §16 y los guardrails del proyecto (`check-guardrails.mjs` con 0 errores):

- **RT-01 (deduplicación duradera en intentos):** eliminado el recorte FIFO `.slice(-500)` sobre `processed_events` en `apps/api/src/attempts/attempts.service.ts` para conservar todos los `clientEventId` procesados hasta el techo de seguridad de 10.000 eventos. Verificado con regresión en PostgreSQL real (`apps/api/test/attempts-adversarial-regressions.postgres.spec.ts`).
- **RT-02 (ventana `completeUntil` en juegos autónomos):** eliminada la condición `assignment_id !== null` en `completeAttempt` (`apps/api/src/attempts/attempts.service.ts`) y añadida la verificación `now > completeUntil` tras el bloqueo `FOR UPDATE`, manteniendo la respuesta idempotente únicamente para intentos ya en `graded` o `pending_review`. Verificado en PostgreSQL real (`apps/api/test/attempts-adversarial-regressions.postgres.spec.ts`).
- **RT-03 (atomicidad `Attempt` + `ProgressEvent`):** incorporado `TransactionContext` (`apps/api/src/common/tenant/transaction.context.ts`) para ejecutar `GamificationService.recordAttemptCompleted` y `recordAudioSubmitted` (`apps/api/src/gamification/gamification.service.ts`) dentro de la misma transacción SQL de `AttemptsService` (`apps/api/src/attempts/attempts.service.ts`), difiriendo la evaluación de medallas tras el commit. Verificado con trigger `BEFORE INSERT ON progress_events` en PostgreSQL real (`apps/api/test/attempts-adversarial-regressions.postgres.spec.ts`).
- **RT-04 (sincronización de logout y cambio de cuenta multi-pestaña):** añadida generación/época de sesión persistente (`SESSION_EPOCH_KEY`), canal `BroadcastChannel('englove_auth_sync')` y suscriptores a `storage`, `focus`, `pageshow` y `visibilitychange` en `apps/web/src/lib/auth-session.ts`, `apps/web/src/lib/auth-hygiene.ts`, `apps/web/src/components/session-sync-listener.tsx` y `apps/web/src/app/providers.tsx`, junto con aislamiento por identidad de `queryKey` en `apps/web/src/app/inicio/inicio-client.tsx`, respaldo de `baselineUid` en rutas protegidas sin `tabBoundEpoch` hidratado (p. ej. `/alumnos`) y limpieza inmediata de caché en memoria/`QueryClient` ante cambio de cuenta. Verificado con Vitest (`apps/web/test/logout-regressions.spec.ts`) y Playwright multi-pestaña en Chromium real (`apps/web/e2e/audit-session-regressions.spec.ts` y `apps/web/e2e/spec-00-cross-cutting-and-conflicts.spec.ts`).
- **RT-05 (anti-spoofing de `X-Forwarded-For` y `trust proxy`):** añadida la variable opcional `TRUST_PROXY` en `apps/api/src/config/env.validation.ts`, `resolveTrustProxySetting` en `apps/api/src/common/utils/identity.utils.ts` (`false` en `local`; `'loopback, linklocal, uniquelocal'` por defecto en `staging`/`production`), aplicación en `apps/api/src/main.ts` y eliminación del parseo manual de `x-forwarded-for` en `extractClientIp`. Verificado con pruebas HTTP reales en `apps/api/test/security-rate-limit-proxy.spec.ts`.
- **RT-06 (rate limiting pre-autenticación en rutas rechazadas con 401/403):** registrado `PreAuthRateLimiterGuard` como primer `APP_GUARD` en `apps/api/src/app.module.ts`, consumo deduplicado por petición (`consumeAnonymousIpBudgetOnce`) en `apps/api/src/common/rate-limiting/rate-limiter.guard.ts`, `OriginGuard`, `JwtAuthGuard` y `RolesGuard`, y exención de salud restringida exactamente a `/health` y `/api/v1/health` (sin sufijos `.../health`). Verificado en `apps/api/test/security-rate-limit-proxy.spec.ts`.
- **RT-07 (validación UUID temprana en `refresh`):** validado el formato UUID de `sid` en `AuthService.refresh` (`apps/api/src/auth/auth.service.ts`) limpiando cookies y devolviendo `401 AUTH_UNAUTHORIZED` antes de consultar PostgreSQL. Verificado en `apps/api/test/wp02-security-regression.postgres.spec.ts`.
- **RT-08 (correo real vigente desde DB en `confirmEmailChange` y `JwtAuthGuard`):** en `AuthService.confirmEmailChange` (`apps/api/src/auth/auth.service.ts`) se consulta el `email` vigente en DB dentro de la transacción antes de actualizarlo y se envía `email-changed` a ese correo real previo; además, `JwtAuthGuard` (`apps/api/src/common/guards/jwt-auth.guard.ts`) hidrata `req.user.email` desde `session.user.email` en DB sobre el claim potencialmente obsoleto del JWT. Verificado en PostgreSQL real (`apps/api/test/wp02-security-regression.postgres.spec.ts`) y con el pipeline real de guards (`apps/api/test/security-rate-limit-proxy.spec.ts`).
- **RT-09 (orden seguro e idempotente en baja en cascada de alumno):** en `StudentsService.deleteStudentCascade` (`apps/api/src/students/students.service.ts`) se marcan en `pending_delete` únicamente los `MediaAsset` cuyo estado no sea `deleted` antes de operar sobre R2, se elimina cada objeto de R2 de forma idempotente (tratando `NoSuchKey`/`NotFound`/404 como éxito en `apps/api/src/media/media.service.ts`), se marca cada asset como `deleted` y solo se ejecuta la cascada SQL si todo R2 completó; ante fallo parcial se registra progreso operativo sin PII y el reintento omite assets ya marcados `deleted`. Verificado en `apps/api/test/student-delete-cascade.spec.ts`.
- **RT-10 (servicios locales en loopback):** puertos de `docker-compose.yml` (`5433`, `9000`, `9001`, `1025`, `8025`) restringidos a `127.0.0.1` y credenciales parametrizables vía variables de entorno; contenedores locales recreados y validados con `docker compose ps`. Regresión automática añadida en `apps/api/test/config.spec.ts`.
- **RT-11 (dependencias de audio y error 503 por procesador indisponible):** instalado `Gyan.FFmpeg` 9.0.2 (`ffmpeg.exe` y `ffprobe.exe` en PATH) con diagnóstico verde en `scripts/check-local-audio.mjs`; actualizado `MediaService.probeDuration` y `confirmUpload` (`apps/api/src/media/media.service.ts`) para devolver `503 AUDIO_PROCESSOR_UNAVAILABLE` ante `ENOENT`/`EACCES` sin culpar al alumno (`422 AUDIO_IMPLAUSIBLE_DURATION`) ni marcar el asset para borrado. Verificado con prueba real de `ENOENT` en `apps/api/test/media.spec.ts`.
- **RT-12 (normalización de errores del parser JSON y límite de payload):** actualizado `AllExceptionsFilter` (`apps/api/src/common/all-exceptions.filter.ts`) para mapear únicamente errores tipados del parser `body-parser` (`entity.too.large` → `413 PAYLOAD_TOO_LARGE`, `entity.parse.failed` → `400 VALIDATION_ERROR`, `encoding.unsupported`/`charset.unsupported` → `415 UNSUPPORTED_MEDIA_TYPE`), sin reclasificar excepciones internas ajenas que expongan `status` 4xx. Verificado con petición HTTP real >1 MiB, JSON inválido y error ajeno con `status: 403` en `apps/api/test/all-exceptions.filter.spec.ts`.

### Verificación ejecutada tras las correcciones

- `node .agents/skills/englove-guardrails/scripts/check-guardrails.mjs --all`: 0 errores.
- `node scripts/check-no-db-push.mjs`: OK.
- `node scripts/check-local-audio.mjs`: `ffmpeg` y `ffprobe` disponibles; bucket S3 local autenticado disponible.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: exit 0 en todo el monorepo.
- `pnpm --filter @englove/shared test`: 5 archivos / 69 tests aprobados.
- `REQUIRE_POSTGRES_TESTS=1 pnpm --filter @englove/api test`: 48 archivos aprobados, 469 tests aprobados, 2 omitidos (`audit-migration-procedure.postgres.spec.ts`, reservados a `RUN_AUDIT_MIGRATION_POSTGRES=1`).
- `pnpm --filter @englove/web test`: 28 archivos / 279 tests aprobados (incluyendo `wp09-regressions.spec.ts` con cero aserciones `as Type`).
- `HEADLESS=true pnpm --filter @englove/web test:e2e`: 52/52 tests Playwright aprobados en Chromium real (con API interceptada en los flujos de frontend).

### Qué queda pendiente

- **Sección 5 (`C-01` a `C-06` y «Endurecimiento observado»):** excluida intencionalmente del alcance por instrucción explícita; no se efectuaron cambios sobre ninguno de sus ítems.
- **Evidencia operativa en staging/producción cloud:** comprobar en el entorno real detrás de Cloudflare/Render la resolución efectiva de `req.ip` con `TRUST_PROXY`, así como pruebas con R2 y Resend reales y ejecución destructiva aislada de `audit-migration-procedure.postgres.spec.ts` (`RUN_AUDIT_MIGRATION_POSTGRES=1`).
- **Entorno local previo y host multiusuario:** si existe un proceso API iniciado antes de instalar `ffmpeg`/`ffprobe`, debe reiniciarse desde una consola con el `PATH` actualizado; en equipos compartidos entre múltiples cuentas del sistema operativo local, Mailpit continúa sin autenticación HTTP propia aunque ahora solo escucha en `127.0.0.1:8025`.

### Preguntas abiertas

1. En despliegue sobre Render detrás de Cloudflare, ¿conviene fijar un número explícito de saltos en `TRUST_PROXY` (por ejemplo `1` o `2` tras verificar la cabecera que reenvía la IP del cliente en staging) o mantener `'loopback, linklocal, uniquelocal'`?
2. Si varios desarrolladores comparten un mismo host de trabajo local, ¿se desea exigir autenticación básica opcional en Mailpit (`MP_UI_AUTH`) desde `docker-compose.yml` además de la restricción a `127.0.0.1` y las credenciales configurables por `.env`?
