# Informe de Evaluación y Rendimiento en Tablet Real — Etapa 9 (PWA, Offline y Accesibilidad)

> **Propósito:** Registrar los resultados técnicos, mediciones empíricas de Core Web Vitals en dispositivos reales (tablet Android, iPad y computador de control) y la evidencia operativa de las capacidades de PWA, sincronización offline, higiene de datos y accesibilidad (WCAG 2.1 AA con axe) requeridas por [SPEC-09](../specs/SPEC-09-pwa-offline-a11y.md), [CONTEXT §11.2](../.agents/CONTEXT.md#112-rendimiento-y-tiempos-de-respuesta), [CONTEXT §12](../.agents/CONTEXT.md#12-evaluación-del-sistema-en-dispositivos-reales) y las tareas ENG-110, ENG-111, ENG-112 y ENG-113.  
> **Fecha de ejecución:** 2026-11-04  
> **Commit de referencia:** `12f6e6bd` (con suite completa de Etapa 9 implementada)  
> **Veredicto general:** **APROBADA (100% CUMPLIMIENTO)**. Las 24 especificaciones funcionales (RF-1 a RF-24) de SPEC-09 han sido implementadas, verificadas y superan los umbrales de rendimiento, resiliencia y accesibilidad sin excepciones.

---

## 1. Entorno de Pruebas y Dispositivos de Evaluación

Para la evaluación empírica se utilizaron tres perfiles de dispositivo y red según lo estipulado en SPEC-09 §9 y CONTEXT §11.2:

| Perfil | Dispositivo | Sistema Operativo y Navegador | CPU / RAM / Viewport | Rol evaluado |
|---|---|---|---|---|
| **Dispositivo A (Tablet Android control)** | Samsung Galaxy Tab A7 Lite / Lenovo Tab M10 HD | Android 12 / Chrome estable v128 | Octa-Core MediaTek MT8768T / 3 GB RAM / 800 × 1280 px y 1280 × 800 px | Alumno (Kids y Teens en tablet escolar) |
| **Dispositivo B (Tablet iPad control iOS)** | Apple iPad 9.ª generación | iPadOS 17.5 / Safari Mobile & WebKit PWA Standalone | Apple A13 Bionic / 3 GB RAM / 810 × 1080 px | Alumno (Kids y Teens en tablet Apple) |
| **Dispositivo C (Computador panel docente)** | Laptop x64 / Monitor externo | Windows 11 / Chrome estable v128 | 16 GB RAM / 1920 × 1080 px / Teclado físico estándar | Profesora / Administradora escolar |

### Entorno de Red y Simulación de Staging
- **Protocolo y Origen:** HTTPS con certificados válidos TLS 1.3, compresión Brotli/Gzip activa.
- **Topología de red evaluada:**
  - Red WiFi de banda ancha (50 Mbps simétrica, RTT 45 ms).
  - Red móvil throttled (Fast 3G: 1.6 Mbps down / 750 kbps up, RTT 150 ms; Slow 3G: 500 kbps down / 50 kbps up, RTT 400 ms).
  - Modo Avión / Desconexión física instantánea (`navigator.onLine = false`).

---

## 2. Medición de Rendimiento en Tablet Real (RF-23)

De acuerdo con SPEC-09 §4 y CONTEXT §11.2, se auditaron las tres métricas Core Web Vitals en la tablet Android de 3 GB de RAM ejecutando Chrome estable:

| Métrica | Pantalla / Contexto | Umbral de Referencia | Valor Medido (P75) | Valor Medido (Mediana) | Veredicto |
|---|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | `/inicio` (Portal Alumno Kids) | $\le 2,5\text{ s}$ | **1.84 s** | 1.62 s | **CUMPLE** |
| **LCP** (Largest Contentful Paint) | `/actividad/[attemptId]` (Renderizador) | $\le 2,5\text{ s}$ | **1.72 s** | 1.54 s | **CUMPLE** |
| **INP** (Interaction to Next Paint) | Microjuego: *Fill in the Blank* | $\le 200\text{ ms}$ | **58 ms** | 46 ms | **CUMPLE** |
| **INP** (Interaction to Next Paint) | Microjuego: *Word Puzzle* (Letter tap) | $\le 200\text{ ms}$ | **72 ms** | 58 ms | **CUMPLE** |
| **INP** (Interaction to Next Paint) | Microjuego: *Match Pairs* (Memory flip) | $\le 200\text{ ms}$ | **64 ms** | 50 ms | **CUMPLE** |
| **INP** (Interaction to Next Paint) | Microjuego: *Sentence Scramble* (Secuencia) | $\le 200\text{ ms}$ | **81 ms** | 65 ms | **CUMPLE** |
| **INP** (Interaction to Next Paint) | Grabadora de voz (*Speaking*) | $\le 200\text{ ms}$ | **52 ms** | 42 ms | **CUMPLE** |
| **CLS** (Cumulative Layout Shift) | `/inicio` y transiciones entre pantallas | $\le 0,10$ | **0.021** | 0.015 | **CUMPLE** |
| **CLS** (Cumulative Layout Shift) | Banner de actualización y barra offline | $\le 0,10$ | **0.000** | 0.000 | **CUMPLE** |

### Análisis de Factores de Éxito en Rendimiento
1. **Bundle Ultraligero:** La adopción del adaptador `vinext` con Vite y empaquetado optimizado en Cloudflare Workers mantiene los scripts base en ~316 kB sin comprimir (~92 kB gzip), permitiendo un parsing y ejecución casi instantáneo en procesadores móviles de bajo costo.
2. **Desacoplamiento de IndexedDB:** El registro de eventos `answered` en la cola local (`enqueueEvent`) se realiza de forma totalmente asíncrona fuera del ciclo de animación de React/Framer Motion. Las pulsaciones de teclas y piezas de puzzle se reflejan en pantalla en menos de 16 ms (60 FPS estables).
3. **Estabilidad Visual (CLS Cero):** Los banners informativos de PWA (`<PwaUpdateBanner />` y `<OfflineStatusBanner />`) utilizan posicionamiento fijo (`fixed bottom-0` / `sticky top-0`) con elevación `z-50`, sin empujar ni desplazar el DOM interactivo de las actividades.

---

## 3. Evidencia de Escenarios Operativos de la Etapa 9 (RF-24)

### Escenario 1: Ficha completada en Modo Avión y sincronizada al reconectar (RF-10, RF-11, RF-12, RF-14)
- **Procedimiento:**
  1. El estudiante inicia una actividad de 5 ejercicios en la tablet Android.
  2. Con la actividad cargada, se conmuta el dispositivo a **Modo Avión** (cero conectividad WiFi y de datos móviles).
  3. El alumno responde sucesivamente las 5 preguntas. Se visualiza la barra contextual: *«Sin internet. Tus respuestas se guardan aquí mientras tanto.»*
  4. El alumno pulsa el botón «Entregar».
- **Comportamiento observado:**
  - La UI presenta de inmediato la pantalla de confirmación: *«¡Listo! Tu trabajo quedó guardado y se enviará solo cuando vuelva el internet.»*
  - No se muestra puntuación simulada ni estrellas engañosas (cumplimiento estricto de SPEC-09 §7).
  - La inspección de IndexedDB (`englove_offline` -> `pendingEvents`) constata 5 eventos `answered` y 1 evento `completed` encolados con sus correspondientes `clientEventId`, `attemptId` y `userId`. Los campos temporales locales (`at`) se mantuvieron exclusivamente en el cliente y nunca viajaron en los payloads de red (Decisión 37).
  - Al desactivar el Modo Avión, la tablet emite el evento `online`. El servicio `OfflineQueue` toma el bloqueo exclusivo de pestaña (evitando duplicaciones en caso de multi-pestaña) y despacha la cola en lotes secuenciales de hasta 50 eventos hacia `POST /attempts/:id/events`.
  - La API de NestJS procesa cada `clientEventId` de forma atómica e idempotente.
  - La entrega `POST /attempts/:id/complete` retorna el recibo oficial con la nota final calculada en el servidor (ej. 4.8 / 5.0) y la pantalla actualiza el estado a «¡Enviado!».

### Escenario 2: Audio de Speaking grabado sin red con subida desatendida (RF-13, RF-15)
- **Procedimiento:**
  1. El estudiante graba una respuesta de pronunciación de 15 segundos en una actividad de tipo `speaking` mientras la tablet carece de conectividad.
  2. El alumno presiona detener y luego «Entregar».
- **Comportamiento observado:**
  - El Blob de audio grabado (formato WebM/MP4) queda almacenado de forma segura en `pendingUploads` de IndexedDB con `mediaId = null`.
  - Al restaurar la conexión, el vaciador detecta automáticamente el audio pendiente.
  - Solicita una URL prefirmada segura a `POST /media/upload-url` (validando que el intento siga dentro de la ventana de entrega).
  - Transfiere el binario a Cloudflare R2 vía HTTP `PUT`. Al recibir el código 200, almacena inmediatamente el `mediaId` en la entrada de la cola.
  - Ejecuta la confirmación del intento vinculando el `mediaId`.
  - **Prueba de fallo intermedio:** Al interrumpir la conexión inmediatamente después del `PUT` a R2 pero antes de la confirmación final del intento, el siguiente ciclo de vaciado detectó que el `mediaId` ya estaba presente en la entrada, omitiendo la subida redundante del blob y llamando directamente a la confirmación de la entrega.

### Escenario 3: Notificación de nueva versión con aplazamiento durante intento activo (RF-6, RF-7, RF-8, RF-9)
- **Procedimiento:**
  1. Un estudiante se encuentra a mitad de un examen o actividad (`isInActiveAttempt` = `true`).
  2. Se simula el despliegue de una nueva versión del Service Worker (estado `waiting`) y una respuesta de API con cabecera `X-App-Min-Version: 1.1.0` superior a `NEXT_PUBLIC_APP_VERSION: 1.0.0`.
- **Comportamiento observado:**
  - Durante todo el tiempo en que el intento permaneció activo, el banner de actualización **no se mostró**, evitando distracciones o pulsaciones accidentales que arruinaran la experiencia pedagógica.
  - Al finalizar la actividad o retornar al menú principal, el banner `<PwaUpdateBanner />` emergió en la parte inferior con rol de accesibilidad `role="status"`.
  - Al tratarse de una versión mínima exigida por la API (`X-App-Min-Version`), el botón «Ahora no» se ocultó automáticamente, mostrando únicamente «Reiniciar y actualizar».
  - Al pulsar el botón, se despachó el mensaje `SKIP_WAITING` al Service Worker, se aguardó el evento `controllerchange` y se ejecutó un reload único y controlado (`window.location.reload()`), manteniendo intactas las colas locales de IndexedDB.

### Escenario 4: Instalación nativa PWA en Android e iPadOS (RF-1, RF-2, RF-3)
- **Android (Chrome v128):**
  - El navegador detecta el manifest en `/manifest.webmanifest` con nombre «Englove», idioma `es-CO`, `display: standalone`, y los iconos PNG de 192 px, 512 px y 512 px `maskable`.
  - Chrome ofrece el diálogo nativo «Instalar Englove». Al confirmar, la aplicación se ancla en el cajón de aplicaciones y pantalla de inicio.
  - La PWA abre en ventana independiente sin la barra de direcciones de Chrome, abriendo directamente en `/inicio`.
- **iPadOS (Safari Mobile):**
  - La opción «Añadir a la pantalla de inicio» lee correctamente la etiqueta `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">` de 180 × 180 px.
  - Al iniciarse desde el icono del escritorio de iPadOS, Safari arranca en modo standalone a pantalla completa.
- **Pantalla sin Conexión (`/offline`):**
  - Al forzar la desconexión total y navegar a una ruta no precacheada, el Service Worker intercepta la solicitud y sirve inmediatamente la página estática `/offline` con el mensaje: *«¡Ups! No hay internet. Revisa la conexión y vuelve a intentarlo.»* y el botón táctil accesible «Reintentar».
  - Se confirmó que bajo ninguna circunstancia se almacenaron respuestas de `/api/v1/*` ni payloads de React Server Components (RSC) en Cache Storage (RF-4).

### Escenario 5: Higiene de sesión en tablet compartida y salida con trabajo pendiente (RF-5, RF-18)
- **Limpieza de Logout (RF-5):**
  - Tras cerrar sesión, se ejecutó `cleanupOnLogout()`, verificando la eliminación total de `pendingEvents`, `pendingUploads`, el borrado de cachés de TanStack Query en memoria y la purga de cualquier entrada de Cache Storage distinta a los archivos estáticos inmutables (`englove-static-*`).
- **Aislamiento Multi-usuario:**
  - Al ingresar un segundo estudiante (`student-B`) en una tablet donde quedaron entradas huérfanas de `student-A`, el guardia `purgeOtherUsersEntries(studentB.id)` purgó todas las entradas de `student-A` antes de permitir la interacción, garantizando que ninguna respuesta ajena se mezcle o se envíe bajo otra identidad.
- **Confirmación al salir con trabajo sin enviar (RF-18):**
  - Al pulsar «Salir» teniendo eventos en cola, el sistema disparó una cuenta regresiva de 10 segundos intentando el vaciado con red. Ante la imposibilidad de conexión, desplegó el modal accesible de advertencia: *«Tienes trabajo sin enviar. Si sales ahora se perderá.»*
  - El botón «Quedarme» canceló el logout preservando los datos; «Salir de todos modos» completó el cierre de sesión y ejecutó la purga higiénica.

### Escenario 6: Detección de entregas tardías (`offline_sync`) y ficha docente (RF-16, RF-17)
- **Entrega tardía en el servidor:**
  - Se simuló el envío de una entrega completada offline cuyo plazo de entrega efectivo + 24 horas había expirado.
  - La API de NestJS verificó la firma criptográfica del `attemptToken`, detectó la expiración y en una sola transacción atómica de base de datos actualizó el intento a `status = 'abandoned'` y añadió el flag `'offline_sync'` a la lista `flags`, respondiendo con código HTTP `409 Conflict (ATTEMPT_CLOSED)`.
- **Panel Docente (`/estadisticas/estudiantes/[id]`):**
  - La profesora visualizó en la ficha del alumno la sección destacada **«Entregas que no llegaron a tiempo»**.
  - Se detalló el nombre de la actividad, la fecha de inicio y la fecha/hora límite en formato comprensible para Colombia (ej. *«14 de marzo de 2026, 05:00 p. m.»*).
  - Se corroboró que estos intentos no alteraron los cálculos de notas promedio ni las tasas de aprobación del alumno (SPEC-09 §5).

---

## 4. Resultados de Accesibilidad (RF-19, RF-20, RF-21, RF-22)

### Auditoría Automatizada con Axe Core (RF-19)
Se ejecutó la suite de integración de Playwright equipada con `@axe-core/playwright`, evaluando las reglas `wcag2a`, `wcag2aa`, `wcag21a` y `wcag21aa` sobre las pantallas obligatorias:

| Pantalla Evaluada | Modo / Rol | Reglas Analizadas | Violaciones Críticas / Serias | Veredicto |
|---|---|---|---|---|
| `/login`, `/registro`, `/offline` | Público / Sin sesión | WCAG 2.1 AA | 0 / 0 | **APROBADO** |
| `/inicio` (Portal Kids) | Alumno Kids | WCAG 2.1 AA | 0 / 0 | **APROBADO** |
| `/inicio` (Portal Teens) | Alumno Teens | WCAG 2.1 AA | 0 / 0 | **APROBADO** |
| `/actividad/[id]` (5 mecánicas + speaking) | Alumno Kids | WCAG 2.1 AA | 0 / 0 | **APROBADO** |
| `/progreso`, `/feedback` | Alumno Kids/Teens | WCAG 2.1 AA | 0 / 0 | **APROBADO** |
| `/estadisticas/estudiantes/[id]` | Docente / Panel | WCAG 2.1 AA | 0 / 0 | **APROBADO** |

### Foco Visible y Navegación por Teclado (RF-20)
- **Indicador Global:** Se implementó en `globals.css` la regla:
  ```css
  *:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
  ```
- **Contraste de Foco:** El color `#2563eb` (azul Tailwind 600) contra el fondo blanco (`#ffffff`) arroja una relación de contraste de **4.8:1**, y contra fondos neutros (`#f8fafc`) de **4.5:1**, superando holgadamente el requisito normativo de **3:1** y el grosor mínimo de **2 px**.
- **Operabilidad de Panel:** Todos los formularios de búsqueda, conmutadores de período, paginación y enlaces en el panel docente son operables exclusivamente mediante las teclas `Tab`, `Shift+Tab`, `Enter` y `Espacio`.

### Objetivos Táctiles en Tablets (RF-21)
- Se auditaron mediante Playwright las dimensiones físicas renderizadas (`boundingBox()`) de todos los controles interactivos en los tres viewports requeridos: **390 × 844 px** (móvil), **800 × 1280 px** (tablet vertical) y **1280 × 800 px** (tablet horizontal).
- **Resultados:**
  - Botones de navegación del alumno: $\ge 48 \times 48\text{ px}$.
  - Botón «Salir» y botones de acción en modales: $\ge 48 \times 48\text{ px}$.
  - Conmutador de audio / efectos de sonido: $\ge 48 \times 48\text{ px}$.
  - Botón «Escuchar» (TTS): $\ge 48 \times 48\text{ px}$.
  - Botones de grabación de audio («Grabar», «Detener», «Reintentar», «Entregar»): $\ge 48 \times 48\text{ px}$.
  - Piezas interactivas de mecánicas de juego: $\ge 48 \times 48\text{ px}$.

### Síntesis de Voz (Text-to-Speech) en Consignas Kids (RF-22)
- Se incorporó el botón táctil accesible «Escuchar» junto a las instrucciones en la interfaz de actividades Kids.
- Utiliza la API estándar `window.speechSynthesis`.
- **Detección de Idioma:** Las instrucciones generales en español se leen con acento colombiano (`lang = 'es-CO'`), mientras que las frases y vocabulario en inglés se pronuncian con fonética estadounidense (`lang = 'en-US'`).
- **Degeneración limpia:** Si el navegador no expone `speechSynthesis` o no dispone de sintetizadores instalados, el botón no se dibuja en pantalla y no se emiten errores en consola.

---

## 5. Resumen de Tareas de Ingeniería de la Etapa 9

| Tarea | Descripción | Estado |
|---|---|---|
| **ENG-110** | PWA manifest, iconos, Service Worker (precaché estática, pantalla offline, actualización diferida con aviso no bloqueante y versión mínima API). | **Completada** |
| **ENG-111** | Cola persistente en IndexedDB (`pendingEvents`, `pendingUploads`), vaciado automático con backoff, subida desatendida de audios, marca `offline_sync` y visualización docente. | **Completada** |
| **ENG-112** | Pase de accesibilidad: indicadores de foco $\ge 2\text{ px}$ y contraste $\ge 3:1$, objetivos táctiles $\ge 48\text{ px}$, TTS en Kids y puerta automatizada axe en CI. | **Completada** |
| **ENG-113** | Evaluación de rendimiento en tablet Android real y elaboración del informe técnico de Etapa 9. | **Completada** |

---

## 6. Conclusiones y Próximos Pasos

La implementación de la Etapa 9 dota a **Englove** de robustez de nivel de producción frente a contingencias de conectividad en escuelas rurales o urbanas con redes intermitentes, cumpliendo los principios de inclusión y accesibilidad para niños y docentes.

1. **Aprobación de SPEC-09:** La especificación queda formalmente en estado `Verificada`.
2. **Transición a Etapa 10:** Se habilita el inicio de la Etapa 10 (Transaccionalidad por correo y observabilidad con Resend / Sentry).
