# Registro de Errores — Pruebas en Entorno Local

**Fecha de inicio:** 2026-11-12  
**Fecha de cierre:** 2026-11-12  
**Estado:** Cerrado (7 hallazgos documentados)  
**Entorno:** Local (`http://localhost:3000` / `http://localhost:3001`)  
**Alcance:** Portales Docente y Estudiante  
**Regla cumplida:** Documentación exclusiva de hallazgos y errores observados sin propuestas de solución ni modificaciones de código.

---

## Índice de Errores Reportados

| ID | Portal | Ruta | Descripción resumida |
|---|---|---|---|
| **ERR-01** | Estudiante | `/actividad/[attemptId]` (Juegos) | Retroalimentación de respuestas marca todo como incorrecto a pesar de puntaje perfecto en microjuegos |
| **ERR-02** | Común (Auth) | `/login` (`POST /api/v1/auth/login`) | Bloqueo por rate limiting (HTTP 429) en inicio de sesión exitoso sin credenciales erróneas |
| **ERR-03** | Docente / Estudiante | `/asignaciones` vs `/inicio` | Asignaciones abiertas en portal docente no aparecen en portal de estudiantes (total 0) |
| **ERR-04** | Estudiante | `/actividad/[attemptId]` (Speaking) | Falla en envío de grabación de audio con reintento inoperante y bloqueo de entrega |
| **ERR-05** | Estudiante | `/actividad/[attemptId]`, `/juegos` | Motor TTS reproduce términos en inglés con fonética y acento en español |
| **ERR-06** | Docente | `/actividades/nueva` (Speaking) | Mensaje de validación técnico en inglés al exceder duración máxima y permite duración esperada mayor a la máxima |
| **ERR-07** | Docente | `/estadisticas` (`GET /api/v1/stats/overview`) | Alumnos activos y con intentos recientes aparecen erróneamente en alerta de deserción ("Nunca" activos) |

---

## Detalle de Hallazgos

### ERR-01: Retroalimentación de respuestas marca todo como incorrecto a pesar de puntaje de 3 estrellas en microjuegos

* **Portal:** Estudiante
* **Ruta de acceso:** `/actividad/[attemptId]` (accedido tras ejecutar un microjuego desde `/juegos`)
* **Archivo / Componente involucrado:** [actividad-runner.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx#L888-L914)
* **Comportamiento observado:**
  * Al completar satisfactoriamente un microjuego (por ejemplo, emparejamiento / matching), la pantalla final indica "¡Partida completada!", despliega las 3 estrellas correctas y el mensaje motivacional ("¡Increíble! Acertaste todo en esta partida.").
  * Sin embargo, en el recuadro inferior titulado **"RETROALIMENTACIÓN DE RESPUESTAS:"**, se listan múltiples entradas con ícono de cruz roja `❌` indicando "Espacio 1: Incorrecto", "Espacio 2: Incorrecto", "Espacio 3: Incorrecto", etc.

* **Evidencia técnica capturada (Chrome DevTools MCP):**
  * **Petición de red (`POST /api/v1/attempts/:id/complete` - status 200):**
    El servidor responde exitosamente indicando acierto en las respuestas enviadas:
    ```json
    {
      "attempt": {
        "id": "718e7168-1b62-4339-8e5b-c4dc70be30cd",
        "stars": 3,
        "motivationMessage": "¡Increíble! Acertaste todo en esta partida."
      },
      "correction": {
        "11111111-1111-4111-8111-111111111301": {
          "correct": true,
          "expected": "22222222-2222-4222-8222-222222222301",
          "submitted": "22222222-2222-4222-8222-222222222301"
        },
        "11111111-1111-4111-8111-111111111302": {
          "correct": true,
          "expected": "22222222-2222-4222-8222-222222222302",
          "submitted": "22222222-2222-4222-8222-222222222302"
        }
      },
      "newBadges": []
    }
    ```
  * **Snapshot del árbol de accesibilidad (DOM renderizado):**
    ```text
    uid=2_27 heading "¡Partida completada!" level="2"
    uid=2_28 "★"
    uid=2_29 "★"
    uid=2_30 "★"
    uid=2_31 "¡Increíble! Acertaste todo en esta partida."
    uid=2_32 heading "RETROALIMENTACIÓN DE RESPUESTAS:" level="4"
    uid=2_33 "❌"
    uid=2_34 "Espacio "
    uid=2_35 "1"
    uid=2_36 ": "
    uid=2_37 "Incorrecto"
    uid=2_38 "❌"
    uid=2_39 "Espacio "
    uid=2_40 "2"
    uid=2_41 ": "
    uid=2_42 "Incorrecto"
    uid=2_43 "❌"
    uid=2_44 "Espacio "
    uid=2_45 "3"
    uid=2_46 ": "
    uid=2_47 "Incorrecto"
    ...
    ```
  * **Mapeo en el código fuente del cliente:**
    En `apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx` (líneas 888–914), el render asume un mapa anidado de dos niveles `[itemId, blanks] -> [blankId, res]` (propio del formato fill-in-the-blank). Para el formato de microjuegos, el objeto devuelto es plano (`itemId -> { correct, expected, submitted }`). El código itera sobre las claves internas del objeto (`correct`, `expected`, `submitted`), tratándolas como sub-elementos (`blanks`), lo que causa que la evaluación de cada una resulte fallida y se muestren como espacios incorrectos.

---

### ERR-02: Bloqueo por rate limiting (HTTP 429) en inicio de sesión exitoso sin credenciales erróneas

* **Portal:** Común (Autenticación / Login)
* **Ruta de acceso:** `/login` (endpoint consumido: `POST http://localhost:3001/api/v1/auth/login`)
* **Archivos involucrados:**
  * [auth.service.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/auth/auth.service.ts#L273-L276)
  * [rate-limiter.service.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/common/rate-limiting/rate-limiter.service.ts#L25-L40)
  * [login-form.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(auth)/login/login-form.tsx)
* **Comportamiento observado:**
  * Al iniciar y cerrar sesión de forma recurrente (por ejemplo, durante sesiones de prueba donde se alternan cuentas docentes y estudiantiles en el mismo equipo), la aplicación bloquea el formulario mostrando la alerta: *"Has hecho varios intentos. Espera un momento y vuelve a intentar"*.
  * El bloqueo se activa a pesar de que el usuario nunca ingresó credenciales incorrectas.

* **Evidencia técnica capturada (Chrome DevTools MCP):**
  * **Petición de red (`POST http://localhost:3001/api/v1/auth/login` - Status 429 Too Many Requests):**
    * Request Body enviado:
      ```json
      {
        "email": "profesora@englove.org",
        "password": "Englove2026!"
      }
      ```
    * Response Headers:
      ```text
      status: 429
      retry-after: 226
      content-type: application/json; charset=utf-8
      ```
    * Response Body:
      ```json
      {
        "statusCode": 429,
        "code": "RATE_LIMITED",
        "message": "Has hecho varios intentos. Espera un momento y vuelve a intentar"
      }
      ```
  * **Snapshot del árbol de accesibilidad (DOM en `/login`):**
    ```text
    uid=3_6 alert atomic live="assertive" relevant="additions text"
      uid=3_7 "Has hecho varios intentos. Espera un momento y vuelve a intentar"
    uid=3_8 form
      uid=3_9 "Correo electrónico"
      uid=3_10 textbox "Correo electrónico" autocomplete="list" haspopup="menu" required value="profesora@englove.org"
      uid=3_11 "Contraseña"
      uid=3_14 textbox "Contraseña" required value="••••••••••••"
      uid=3_15 button "Entrar"
    ```
  * **Mapeo en el código fuente del servidor:**
    En `apps/api/src/auth/auth.service.ts` (línea 275):
    ```ts
    async login(dto: LoginDto, ip: string, res: Response): Promise<SessionView> {
      // Rate limit: 10 / 15 min per IP (Architecture §8.3, SPEC-02 §4)
      this.rateLimiterService.check(`login:ip:${ip}`, 10, 15 * 60 * 1000);
      ...
    ```
    La invocación a `this.rateLimiterService.check(...)` se realiza de manera incondicional al inicio del controlador antes de verificar la validez de las credenciales, consumiendo un token por cada petición entrante asociada a la IP (`login:ip:${ip}`). Como los inicios de sesión exitosos también consumen tokens y no reinician el conteo por IP, alcanzar 10 peticiones dentro de la ventana de 15 minutos (típico en pruebas en `localhost` o dispositivos en una misma red LAN) activa el límite de tasa y rechaza las autenticaciones legítimas con código HTTP 429.

---

### ERR-03: Asignaciones abiertas en portal docente no aparecen en portal de estudiantes (total 0)

* **Portal:** Docente / Estudiante (Módulo de Asignaciones y Misiones)
* **Ruta de acceso:**
  * Docente: `/asignaciones` (`GET http://localhost:3001/api/v1/assignments`)
  * Estudiante: `/inicio` (`GET http://localhost:3001/api/v1/me/assignments`)
* **Archivos involucrados:**
  * [asignaciones-client.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/asignaciones/asignaciones-client.tsx)
  * [nueva-asignacion-client.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/asignaciones/nueva/nueva-asignacion-client.tsx#L90-L108)
  * [inicio-client.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/inicio/inicio-client.tsx#L61-L68)
  * [attempts.service.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/attempts/attempts.service.ts#L1432-L1545) (`listStudentAssignments`)
* **Comportamiento observado:**
  * En el portal docente (`/asignaciones`), las tareas asignadas figuran en estado "Abierta" (distintivo verde).
  * Sin embargo, al ingresar al portal de un estudiante (vista `/inicio`), las pestañas de actividades ("Todas", "Por hacer", "Entregadas") marcan `0` y se despliega el mensaje de pantalla vacía: *"No hay actividades disponibles en este momento. Tu profesora asignará nuevas actividades y ejercicios para tu grupo próximamente."*

* **Evidencia técnica capturada (Chrome DevTools MCP):**
  * **Snapshot del árbol de accesibilidad en `/inicio` (Estudiante):**
    ```text
    uid=4_27 heading "¡Hola, Samuel D! 🌟" level="1"
    uid=4_28 "Aquí tienes tus misiones y actividades de inglés asignadas por tu profesora."
    uid=4_35 button "Todas (0)"
    uid=4_36 button "Por hacer (0)"
    uid=4_37 button "Entregadas (0)"
    uid=4_38 "🎉"
    uid=4_39 heading "No hay actividades disponibles en este momento." level="3"
    uid=4_40 "Tu profesora asignará nuevas actividades y ejercicios para tu grupo próximamente."
    ```
  * **Petición de red en `/inicio` (`GET http://localhost:3001/api/v1/me/assignments` - Status 200):**
    ```json
    {
      "items": [],
      "total": 0,
      "offset": 0,
      "limit": 20
    }
    ```
  * **Mapeo técnico en backend y base de datos:**
    1. **Aislamiento por grupo:** En `attempts.service.ts` (`listStudentAssignments`), la consulta filtra exclusivamente por el grupo activo al que pertenece el estudiante autenticado (`group_id: student.memberships[0]?.group_id`). En la sesión probada, el estudiante (`Samuel D`) pertenece a `Grupo Volumen A1`, mientras que las asignaciones abiertas en la vista docente pertenecen a otros grupos (`Kids Explorers A1` y `Teens Leaders B1`).
    2. **Valores por defecto en fecha de apertura:** En `nueva-asignacion-client.tsx` (líneas 91–108), el formulario de creación predetermina la fecha de apertura (`opensAtInput`) para el día siguiente (`tomorrow.setDate(tomorrow.getDate() + 1)`). Si la docente no adelanta manualmente la fecha al crear la asignación para el grupo del estudiante, la asignación queda en estado futuro/programado (`now < opens_at`), provocando que `attempts.service.ts` la filtre y no la entregue en `scope=available` (`canStart = now >= a.opens_at && now <= a.due_at`).
    3. **Ausencia de estado programado en la vista del alumno:** La vista del estudiante solo consulta tareas disponibles (`scope=available`), por lo que no recibe ni informa al alumno si existen asignaciones programadas para abrirse próximamente, mostrando la bandeja en cero absoluto.

---

### ERR-04: Falla en envío de grabación de audio con reintento inoperante y bloqueo de entrega

* **Portal:** Estudiante
* **Ruta de acceso:** `/actividad/[attemptId]` (Actividad de tipo Speaking / Expresión oral)
* **Archivos involucrados:**
  * [actividad-runner.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx#L480-L528)
  * [media.service.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/media/media.service.ts#L73-L94)
  * `apps/api/.env`
* **Comportamiento observado:**
  * Tras grabar el audio de voz en una actividad de Speaking y presionar para enviarlo, aparece el mensaje de error: *"No pudimos enviar tu grabación. Sigue guardada en este dispositivo."*
  * Se muestra el botón "Reintentar envío", pero al hacer clic sobre él, el proceso de reintento vuelve a fallar sistemáticamente.
  * Como consecuencia, el botón principal *"Entregar actividad ✨"* permanece deshabilitado (`disabled`), imposibilitando que el alumno complete la actividad.

* **Evidencia técnica capturada (Chrome DevTools MCP):**
  * **Snapshot del árbol de accesibilidad en `/actividad/[attemptId]`:**
    ```text
    uid=5_43 button "🎙️ Volver a grabar"
    uid=5_44 "✅"
    uid=5_45 "Grabación lista para enviar (8s)"
    uid=5_48 "No pudimos enviar tu grabación. Sigue guardada en este dispositivo."
    uid=5_49 button "Reintentar envío"
    uid=5_50 button "Entregar actividad ✨" disableable disabled
    ```
  * **Consola del navegador:**
    ```text
    [error] Failed to load resource: net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH
    ```
  * **Llamadas de red capturadas:**
    1. `POST http://localhost:3001/api/v1/media/upload-url` (Status 201):
       * Cuerpo devuelto por el backend:
         ```json
         {
           "mediaId": "317045c8-8a92-4d2b-ab22-1f2a689223db",
           "uploadUrl": "https://englove-dev.placeholder_account_id.r2.cloudflarestorage.com/9db4ea02-dc30-4df1-8d82-465829ac2fe8/10000000-0000-4000-8000-000000000004/124261b6-a0bc-439f-bf74-41649e45465c/317045c8-8a92-4d2b-ab22-1f2a689223db.webm?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
           "expiresAt": "2026-11-12T19:13:28.333Z"
         }
         ```
    2. `PUT https://englove-dev.placeholder_account_id.r2.cloudflarestorage.com/...` (Fallo de red: `net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH`).
  * **Mapeo técnico en el servidor y configuración:**
    * En `apps/api/src/media/media.service.ts` (líneas 73–94), el cliente S3 construye su endpoint utilizando la variable `R2_ENDPOINT` o bien concatenando `https://${accountId}.r2.cloudflarestorage.com`.
    * En el archivo de configuración `apps/api/.env`, se encuentran definidas las variables:
      ```env
      R2_ACCOUNT_ID=placeholder_account_id
      R2_ACCESS_KEY_ID=placeholder_access_key
      R2_SECRET_ACCESS_KEY=placeholder_secret_key
      ```
      mientras que la variable `R2_ENDPOINT` no está configurada (a diferencia del `.env` raíz que apunta a MinIO local en `http://localhost:9000`).
    * Debido a esto, la URL prefirmada devuelta apunta a un subdominio inexistente en Cloudflare R2 (`placeholder_account_id.r2.cloudflarestorage.com`), fallando la conexión SSL y arrojando una excepción en el cliente.
    * En el cliente (`actividad-runner.tsx`), al fallar la subida, `mediaId` permanece en `null`, manteniendo el botón *"Entregar actividad ✨"* deshabilitado indefinidamente.

---

### ERR-05: Motor TTS reproduce términos en inglés con fonética y acento en español

* **Portal:** Estudiante (Accesibilidad / Asistente de Voz TTS)
* **Ruta de acceso:** `/actividad/[attemptId]`, `/juegos`
* **Archivos involucrados:**
  * [actividad-runner.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx#L348-L359)
  * [GameRenderer.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/components/activities/GameRenderer.tsx#L135-L144)
* **Comportamiento observado:**
  * Al pulsar los botones de asistencia auditiva (ej. "Escuchar título", "Escuchar consigna", "Escuchar modelo"), el sintetizador de voz (TTS) lee los enunciados utilizando una voz en español.
  * Cuando las instrucciones contienen oraciones o vocabulario en inglés (o en actividades de Speaking donde se lee la frase objetivo en inglés junto con la instrucción en español), la voz en español pronuncia las palabras en inglés mediante fonética literal española, afectando la inteligibilidad y precisión de la pronunciación requerida para el aprendizaje.

* **Evidencia técnica y análisis de código:**
  * En `actividad-runner.tsx` (función `speakText`, líneas 348–359):
    ```ts
    const speakText = (text: string) => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        // Spanish vs English detection (RF-22)
        const isSpanish = /[áéíóúñ¿¡]|(\b(selecciona|completa|escucha|arrastra|responde|elige|traduce|escribe|une|haz|marca|graba|instrucción|pregunta|oración)\b)/i.test(text);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = isSpanish ? 'es-CO' : 'en-US';
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      }
    };
    ```
  * La detección de idioma evalúa la presencia de palabras clave en español (`graba`, `instrucción`, `oración`, tildes, etc.) sobre la totalidad de la cadena `text`.
  * Si la instrucción incluye frases mixtas (por ejemplo: *"Graba tu voz leyendo la oración en voz alta: Introduce Yourself in English"* o oraciones objetivo en inglés), la regex clasifica todo el bloque como español (`isSpanish = true`), asignando `utterance.lang = 'es-CO'`.
  * El navegador activa el sintetizador en español del sistema operativo para leer toda la frase, provocando que los términos y oraciones en inglés se reproduzcan con fonemas en español.

---

### ERR-06: Mensaje de validación técnico en inglés al exceder duración máxima y permite duración esperada mayor a la máxima

* **Portal:** Docente (Creación y edición de actividades / Speaking)
* **Ruta de acceso:** `/actividades/nueva` (endpoint invocado: `POST http://localhost:3001/api/v1/activities`)
* **Archivos involucrados:**
  * [speaking.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/packages/shared/src/activities/speaking.ts#L16) (`SpeakingConfigSchema`)
  * [activity-editor.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/actividades/activity-editor.tsx#L1093-L1154)
* **Comportamiento observado:**
  1. Al intentar crear una actividad de Speaking e ingresar una duración máxima superior al límite permitido de 300 segundos (por ejemplo, 500 segundos), se produce un error 400 y la interfaz muestra una alerta en inglés con un mensaje puramente técnico: *"Number must be less than or equal to 300"*, en lugar de un mensaje en español comprensible y guiado para el usuario/docente.
  2. Adicionalmente, el formulario permite registrar una "Duración esperada" (ej. 900 segundos) mayor a la "Duración máxima de grabación" (tope de 300 segundos), sin que exista una validación cruzada que bloquee o alerte sobre esta inconsistencia temporal.

* **Evidencia técnica capturada (Chrome DevTools MCP):**
  * **Petición de red (`POST http://localhost:3001/api/v1/activities` - Status 400 Bad Request):**
    * Request Body enviado:
      ```json
      {
        "title": "My First Activity A1",
        "type": "speaking",
        "level": "A1",
        "config": {
          "prompt": "Introduce yourself in 30 seconds: say your name, age, and favorite hobby.",
          "minDurationSeconds": 2,
          "maxDurationSeconds": 500
        },
        "answerKey": null,
        "expectedDurationSeconds": 900,
        "minPlausibleSeconds": null
      }
      ```
    * Response Body devuelto por el servidor:
      ```json
      {
        "statusCode": 400,
        "code": "VALIDATION_ERROR",
        "message": "Number must be less than or equal to 300"
      }
      ```
  * **Mapeo técnico en código:**
    1. **Falta de mensaje en español en esquema Zod:** En `packages/shared/src/activities/speaking.ts` (línea 16):
       ```ts
       maxDurationSeconds: z.number().int().min(2).max(300).default(120),
       ```
       La regla `.max(300)` carece de mensaje personalizado `{ message: '...' }`. Ante el exceso de valor, Zod utiliza el mensaje por defecto en inglés (`"Number must be less than or equal to 300"`), el cual es retornado directamente por el backend con código `VALIDATION_ERROR` y presentado en la UI sin traducción ni contexto de campo.
    2. **Ausencia de validación en cliente antes del envío:** En `activity-editor.tsx` (`buildPayload`), no se valida que `spMaxDuration <= 300` antes de invocar la mutación, dependiendo exclusivamente del rechazo HTTP 400 del servidor.
    3. **Inexistencia de validación cruzada de duraciones:** No existe regla en el cliente ni en el backend que compare `expectedDurationSeconds` contra `config.maxDurationSeconds`, permitiendo persistir actividades de Speaking donde la duración esperada supera el límite máximo de grabación admisible.

---

### ERR-07: Alumnos activos y con intentos recientes aparecen erróneamente en alerta de deserción ("Nunca" activos)

* **Portal:** Docente (Estadísticas y Desempeño)
* **Ruta de acceso:** `/estadisticas` (endpoint invocado: `GET http://localhost:3001/api/v1/stats/overview`)
* **Archivos involucrados:**
  * [stats.service.ts](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/api/src/stats/stats.service.ts#L351-L407)
  * [estadisticas-client.tsx](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/estadisticas/estadisticas-client.tsx#L410-L450)
* **Comportamiento observado:**
  1. En el panel de estadísticas del portal docente (`/estadisticas`), en la sección **"Alumnos en riesgo de deserción o abandono (≥ 14 días inactivos)"**, aparecen listados prácticamente la totalidad de los alumnos registrados (110 de 111 alumnos aprobados).
  2. Todos los alumnos listados muestran como estado temporal: **"Días sin actividad: Nunca"**, a pesar de haber realizado intentos de actividades calificados en los últimos días o semanas.
  3. Se presenta una contradicción directa y visible en la misma pantalla:
     * La tarjeta superior de métricas indica **"Activos en periodo: 26"**.
     * La tarjeta y tabla contigua indican **"Alumnos en riesgo: 110"**, e incluye a estudiantes que culminaron actividades recientemente (por ejemplo, *Sofia Gomez*, quien tiene un intento calificado en la base de datos con fecha reciente del día anterior `2026-11-11`, pero aparece de primera en la lista de abandono con indicador "Nunca").

* **Evidencia técnica capturada (Chrome DevTools MCP y base de datos):**
  * **Snapshot del árbol de accesibilidad (DOM renderizado en `/estadisticas`):**
    ```text
    uid=8_44 "Activos en periodo"
    uid=8_45 "26"
    ...
    uid=8_52 "Alumnos en riesgo"
    uid=8_53 "110"
    uid=8_54 "⚠️"
    uid=8_55 heading "Alumnos en riesgo de deserción o abandono (≥ 14 días inactivos)" level="3"
    uid=8_56 link "Sofia Gomez" url="http://localhost:3000/estadisticas/estudiantes/10000000-0000-4000-8000-000000000002"
    uid=8_58 "Kids Explorers A1"
    uid=8_59 "•"
    uid=8_60 "Nivel "
    uid=8_61 "A1"
    uid=8_62 "Días sin actividad:"
    uid=8_63 "Nunca"
    ...
    ```
  * **Respuesta de la API (`GET /api/v1/stats/overview` - fragmento `inactiveAlerts`):**
    ```json
    {
      "activeStudentsCount": 26,
      "inactiveAlerts": [
        {
          "studentId": "10000000-0000-4000-8000-000000000002",
          "studentName": "Sofia Gomez",
          "level": "A1",
          "ageSegment": "kids",
          "groupId": "30000000-0000-4000-8000-000000000001",
          "groupName": "Kids Explorers A1",
          "lastActivityAt": null,
          "daysSinceLastActivity": null
        }
      ]
    }
    ```
  * **Estado real en Base de Datos (PostgreSQL):**
    * La alumna *Sofia Gomez* (`10000000-0000-4000-8000-000000000002`) cuenta con registros en la tabla `Attempt` con estado `graded` y fecha de finalización reciente:
      ```json
      {
        "id": "40000000-0000-4000-8000-000000000002",
        "student_id": "10000000-0000-4000-8000-000000000002",
        "status": "graded",
        "started_at": "2026-11-11T18:27:33.444Z",
        "finished_at": "2026-11-11T18:28:33.444Z"
      }
      ```
    * Sin embargo, la tabla `ProgressEvent` contiene únicamente 6 registros en total en toda la base de datos, ninguno de los cuales corresponde a eventos `attempt_completed` o `audio_submitted` para dicha estudiante.

* **Análisis de causa raíz y mapeo en código:**
  1. **Discrepancia en la definición de "actividad" entre módulos del mismo servicio:**
     * En `apps/api/src/stats/stats.service.ts` (líneas 269–272), para calcular **"Activos en periodo"**, el servicio unifica tanto eventos de progreso (`progressEvents`) como intentos finalizados (`finishedAttempts` en la tabla `Attempt`):
       ```ts
       for (const ev of progressEvents) activeStudentIds.add(ev.student_id);
       for (const att of finishedAttempts) activeStudentIds.add(att.student_id);
       ```
       Esto produce correctamente un conteo de 26 alumnos activos.
     * En contraste, en las líneas 351–383, el bloque **"8. Inactive Student Alerts"** ignora por completo la tabla `Attempt` y depende de forma exclusiva de la tabla `ProgressEvent` con tipos `attempt_completed` o `audio_submitted`:
       ```ts
       const recentActivityEvents = await this.prisma.progressEvent.findMany({
         where: {
           organization_id: organizationId,
           type: { in: [ProgressEventType.attempt_completed, ProgressEventType.audio_submitted] },
           occurred_at: { gte: fourteenDaysAgo },
         },
         select: { student_id: true },
       });
       const studentsWithRecentActivity = new Set(recentActivityEvents.map((e) => e.student_id));
       ```
     * Igualmente, la consulta de la última fecha de actividad (`lastActivityByStudent`) se realiza únicamente sobre `ProgressEvent.groupBy`.
  2. **Tratamiento de `lastActivityAt = null` como abandono máximo:**
     * Si un estudiante no tiene eventos `attempt_completed` o `audio_submitted` en `ProgressEvent` (ya sea por haber realizado actividades históricas, intentos no reflejados en eventos de gamificación, o datos iniciales de seed donde no se poblaron dichos eventos específicos), `studentsWithRecentActivity.has(student.id)` retorna `false`.
     * `lastAt` resulta `null`, `daysSince` resulta `null`.
     * En la línea 406 se ordenan las alertas con fallback de 999 días:
       ```ts
       inactiveAlerts.sort((a, b) => (b.daysSinceLastActivity ?? 999) - (a.daysSinceLastActivity ?? 999));
       ```
       Esto ubica a todos los alumnos con `null` en la parte superior de la tabla.
     * En el frontend (`estadisticas-client.tsx`, línea 431), un valor `daysSinceLastActivity === null` se renderiza textualmente como `"Nunca"`.
  3. **Resultado:** Alumnos con historial de actividad e intentos calificados en la tabla `Attempt` son categorizados como inactivos de por vida ("Nunca") y colocados en alerta de deserción debido al desacoplamiento entre el registro de intentos (`Attempt`) y la tabla de eventos de gamificación (`ProgressEvent`).

---

## Cierre y Consolidado de la Sesión de Pruebas

* **Estado del documento:** Cerrado y finalizado.
* **Fecha de cierre:** 2026-11-12
* **Total de hallazgos registrados:** 7 errores / anomalías (ERR-01 a ERR-07).
* **Distribución de hallazgos:**
  * **Portal Estudiante (3):**
    * `ERR-01`: Retroalimentación de microjuegos marca todo como incorrecto a pesar de puntaje de 3 estrellas.
    * `ERR-04`: Falla en subida de audio grabado en actividades de Speaking con reintento inoperante y bloqueo de entrega.
    * `ERR-05`: Motor TTS pronuncia vocabulario y oraciones en inglés con fonética y acento en español.
  * **Portal Docente (2):**
    * `ERR-06`: Mensaje de error técnico en inglés al exceder duración máxima y permite registrar duración esperada mayor a la máxima en actividades de Speaking.
    * `ERR-07`: Alumnos activos y con intentos recientes calificados aparecen erróneamente en alerta de deserción ("Días sin actividad: Nunca").
  * **Flujos Transversales / Autenticación y Asignaciones (2):**
    * `ERR-02`: Bloqueo por rate limiting (HTTP 429) tras inicios de sesión repetidos con credenciales válidas.
    * `ERR-03`: Discrepancia entre asignaciones abiertas en portal docente y total 0 en portal estudiantil debido a aislamiento de grupo y fecha de apertura por defecto.
* **Cumplimiento de directrices:** En concordancia con la instrucción explícita del usuario, el presente documento contiene únicamente la descripción del comportamiento observado, la evidencia técnica recolectada vía Chrome DevTools MCP / base de datos y el análisis de causa raíz a nivel de código, sin haber implementado correcciones ni formulado propuestas de solución.
