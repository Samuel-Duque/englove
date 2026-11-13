# Englove

Plataforma web educativa, interactiva y gamificada para la enseñanza de inglés a niños y adolescentes de **7 a 14 años**. Diseñada para potenciar la labor pedagógica de una profesora particular y concebida con arquitectura SaaS multi-tenant escalable para academias de idiomas.

---

## Tabla de contenidos

1. [Descripción general](#descripción-general)
2. [Principales características](#principales-características)
3. [Stack tecnológico y versiones](#stack-tecnológico-y-versiones)
4. [Estructura del repositorio (Monorepo)](#estructura-del-repositorio-monorepo)
5. [Guía de instalación y ejecución local](#guía-de-instalación-y-ejecución-local)
   - [1. Requisitos previos](#1-requisitos-previos)
   - [2. Clonar el repositorio](#2-clonar-el-repositorio)
   - [3. Configurar variables de entorno](#3-configurar-variables-de-entorno)
   - [4. Instalar dependencias](#4-instalar-dependencias)
   - [5. Iniciar base de datos local (PostgreSQL 18)](#5-iniciar-base-de-datos-local-postgresql-18)
   - [6. Aplicar migraciones del esquema](#6-aplicar-migraciones-del-esquema)
   - [7. Cargar datos de prueba (Seeds)](#7-cargar-datos-de-prueba-seeds)
   - [8. Iniciar servidores de desarrollo](#8-iniciar-servidores-de-desarrollo)
   - [9. Verificación de la instalación](#9-verificación-de-la-instalación)
6. [Usuarios y credenciales de prueba](#usuarios-y-credenciales-de-prueba)
7. [Pruebas, calidad y guardrails](#pruebas-calidad-y-guardrails)
8. [Metodología y estado del proyecto](#metodología-y-estado-del-proyecto)
9. [Reglas invariantes de diseño](#reglas-invariantes-de-diseño)
10. [Despliegue e infraestructura](#despliegue-e-infraestructura)

---

## Descripción general

Englove une la enseñanza rigurosa del idioma con mecánicas de motivación y juego, adaptándose a las necesidades de aprendizaje de cada edad:

- **Alineación curricular con el MCER:** Niveles **A1, A2, B1 y B2**.
- **Dos segmentos de experiencia adaptativa:**
  - **Kids / Junior (7–10 años):** Interfaz lúdica, visualmente estimulante, tipografía amigable y acompañamiento visual reforzado.
  - **Teens (11–14+ años):** Interfaz sobria, dinámica, orientada a autonomía y enfoque preadolescente.
- **Eje pedagógico central:** `Actividad` → `Asignación` → `Intento` → `Calificación y Retroalimentación`.
- **Sistema de calificación confiable:** Escala colombiana **0,0 a 5,0**, calculada estrictamente en el backend con inmutabilidad de nota una vez publicada.
- **Gamificación formativa:** Estrellas acumulables, insignias coleccionables, misiones y rachas semanales perdonables.
- **PWA instalable:** Acceso ágil desde tabletas y ordenadores sin necesidad de tiendas de aplicaciones comerciales durante la fase piloto.

---

## Principales características

### 1. Gestor de contenidos y actividades interactivas

- **5 tipos de actividad base:**
  1. `fill_blank`: Completar textos y oraciones con opciones dinámicas y distractores.
  2. `open_question`: Preguntas abiertas con rúbricas de evaluación cualitativa y cuantitativa (soporte multi-pregunta bajo RFC-01).
  3. `speaking`: Grabación oral de pronunciación con subida directa y segura a Cloudflare R2 mediante URLs prefirmadas.
  4. `game`: Microjuegos formativos interactivos autónomos (Decisión 130).
  5. `exam`: Evaluaciones integradoras que combinan ejercicios estructurados.
- **5 mecánicas de microjuegos formativos:**
  - `match`: Emparejamiento de conceptos, traducciones o pares de vocabulario.
  - `order_words`: Ordenamiento sintáctico de palabras para formar oraciones.
  - `drag_drop`: Arrastrar y soltar elementos en categorías correspondientes.
  - `memory`: Juego de memoria visual para asociar pares conceptuales.
  - `timed_choice`: Selección rápida de respuestas correctas bajo tiempo límite.
- Acceso a microjuegos en modo autónomo 24/7 en `/juegos` sin requerir `Assignment` previa (Decisión 130), con estrellas de práctica y ranking privado docente (Decisión 137).

### 2. Asignaciones y gestión docente

- Creación de asignaciones curriculares dirigidas a grupos completos (`group_id`), manteniendo el alcance pedagógico del piloto (Decisión 48).
- Fechas de entrega con ventana de tolerancia de 24 horas (`effectiveDueAt`).
- Habilitación controlada y atómica de nuevos intentos por decisión del docente.
- Dashboard docente con métricas operativas y tarjetas de recordatorio automático (alumnos pendientes de aprobación, entregas sin calificar por más de 3 días).

### 3. Calificación y retroalimentación humanizada

- Autocalificación instantánea en actividades de respuesta cerrada.
- Bandeja de revisión manual para grabaciones de audio y respuestas abiertas.
- Transcodificación de audio automatizada (conversión a AAC/MP4 mediante cola serial segura en `ffmpeg` de 1 tarea a la vez).
- Retroalimentación formativa personalizada con rúbricas de evaluación, comentarios y paquete de stickers pedagógicos oficiales.
- Descarga segura de grabaciones de voz mediante enlaces temporales con caducidad estricta.

### 4. Portal del estudiante y motivación

- Navegación simplificada de **2 a 4 clics** entre la pantalla de inicio y cualquier actividad o juego.
- Selector de temas visuales que respeta el segmento de edad (`data-theme="kids"` o `"teens"`).
- Sistema de rachas semanales perdonables: corte dominical (23:59 UTC-5) con 1 semana de inactividad perdonada por ciclo.
- Registro de hitos, medallas e historial de feedback recibido.

### 5. Seguridad y privacidad orientada a menores

- **Aislamiento multi-tenant nativo:** Todas las tablas de tenant y consultas filtran por `organization_id` con protección estricta contra IDOR.
- **Protección de identidad y sesiones:** Tokens JWT distribuidos en cookies `httpOnly` con flags `SameSite` y `Secure`.
- **Cero PII en logs:** Registro estructurado (Pino) libre de datos de menores y sin capturas de información personal en herramientas de observabilidad.
- **Higiene en dispositivos compartidos:** Limpieza automática de sesión, IndexedDB y cachés locales al desconectarse.

---

## Stack tecnológico y versiones

| Capa / Módulo             | Tecnología              | Versión               | Propósito clave                                                 |
| ------------------------- | ----------------------- | --------------------- | --------------------------------------------------------------- |
| **Runtime & Gestor**      | Node.js                 | `>=24.0.0` (LTS)      | Entorno de ejecución estándar del backend y tooling             |
|                           | pnpm                    | `11.5.1`              | Gestor de paquetes eficiente y estructuración de monorepo       |
|                           | Turborepo               | `^2.4.4`              | Orquestación de compilación, caché remota y tareas cruzadas     |
| **Frontend (`apps/web`)** | Next.js                 | `16.4.2`              | Framework fullstack (App Router, Turbopack, React Compiler)     |
|                           | React                   | `19.3.1`              | Biblioteca de interfaz de usuario reactiva                      |
|                           | Tailwind CSS            | `^4.0.9`              | Sistema de estilos CSS atómico moderno                          |
|                           | Pragmatic Drag and Drop | `^1.5.0`              | Motor accesible de arrastrar y soltar para ejercicios           |
|                           | vinext / Wrangler       | `^1.2.1` / `^4.149.0` | Adaptador y CLI para despliegue en Cloudflare Workers           |
| **Backend (`apps/api`)**  | NestJS                  | `^11.0.11`            | Arquitectura modular orientada a servicios, guards y DI         |
|                           | Express                 | `^5.3.0`              | Servidor HTTP subyacente para el framework NestJS               |
|                           | Prisma ORM              | `^7.0.0`              | Mapeo objeto-relacional y migraciones tipadas                   |
|                           | `@prisma/adapter-pg`    | `^7.10.1`             | Adaptador nativo PostgreSQL para poolers y servidor             |
|                           | Argon2                  | `^0.41.1`             | Algoritmo resistente para hash seguro de contraseñas            |
|                           | Pino / nestjs-pino      | `^9.6.0` / `^4.3.1`   | Logger estructurado de alto rendimiento sin fugas de PII        |
|                           | ffmpeg (CLI)            | Binario / spawn       | Transcodificación de audio en servidor con child_process.spawn |
|                           | AWS SDK S3              | `^3.750.0`            | Cliente S3 para generación de URLs prefirmadas en Cloudflare R2 |
|                           | Resend SDK              | `^4.1.2`              | Envío de correos transaccionales institucionales                |
| **Tipado y Compartido**   | `@englove/shared`       | `0.0.1`               | Contratos de actividad, enums canónicos y DTOs comunes          |
|                           | TypeScript              | `~5.9.3`              | Tipado estricto sin comodines `any` en todo el repositorio      |
|                           | Zod                     | `^4.6.6`              | Validación de esquemas estructurales de actividades y DTOs      |
| **Base de Datos & Infra** | PostgreSQL              | `18`                  | Base de datos relacional (Neon en la nube / Docker en local)    |
|                           | Cloudflare R2           | S3 Compatible         | Almacenamiento seguro de objetos multimedia privados            |
|                           | ffmpeg / ffprobe        | Binario del SO        | Validación técnica, métricas de decibelios y transcodificación  |
| **Testing & Calidad**     | Vitest                  | `^3.0.7`              | Ejecutor ultrarrápido de pruebas unitarias e integración        |
|                           | ESLint / Prettier       | `^9.21.0` / `^3.5.3`  | Análisis estático y formateo estricto del código fuente         |

---

## Estructura del repositorio (Monorepo)

```
englove/
├── .agents/
│ ├── CONTEXT.md # Fuente única de verdad técnica y de producto (Decisiones 1–137)
│ └── skills/ # Habilidades y scripts automáticos del proyecto (guardrails, spec)
├── apps/
│ ├── api/ # Backend NestJS 11
│ │ ├── prisma/ # Esquema schema.prisma, migraciones y scripts de seed
│ │ ├── src/
│ │ │ ├── activities/ # Gestión de actividades y esquemas pedagógicos
│ │ │ ├── assignments/ # Lógica de asignación grupal y ventanas temporales
│ │ │ ├── attempts/ # Registro y resolución de intentos del estudiante
│ │ │ ├── auth/ # Autenticación, sesiones JWT, registro y control de acceso
│ │ │ ├── common/ # Filtros globales, decoradores, pipes e interceptores
│ │ │ ├── dashboard/ # Métricas resumidas y recordatorios operativos para el docente
│ │ │ ├── health/ # Endpoint de monitoreo de disponibilidad operacional (/health)
│ │ │ ├── media/ # Generación de URLs prefirmadas R2 y cola serial de ffmpeg
│ │ │ ├── reviews/ # Calificación docente, asignación de stickers y feedback
│ │ │ ├── scoring/ # Motor centralizado de cálculo de puntajes en escala 0.0–5.0
│ │ │ └── students/ # Gestión de estudiantes, grupos y desbloqueos administrativos
│ │ └── test/ # Suites de pruebas de integración y flujos E2E con base de datos real
│ └── web/ # Frontend Next.js 16 (App Router) adaptado a Cloudflare Workers
│ ├── public/ # Manifiesto PWA, iconos y recursos estáticos
│ └── src/
│ ├── app/
│ │ ├── (public)/ # Rutas abiertas: login, registro, recuperación de contraseña
│ │ ├── (teacher)/ # Panel de la profesora: actividades, asignaciones, revisión, métricas
│ │ └── (student)/ # Portal del alumno: asignaciones, renderizador, microjuegos, progreso
│ ├── components/ # Componentes visuales UI (shadcn, drag & drop, feedback, stickers)
│ ├── hooks/ # Hooks reutilizables para consumo de datos y estado
│ └── proxy.ts # Redirección perimetral por rol basada en cookies de sesión
├── packages/
│ └── shared/ # Paquete agnóstico compartido (cero dependencias de Prisma o Next.js)
│ ├── src/
│ │ ├── activities/ # Esquemas de validación Zod por tipo de actividad y mecánicas
│ │ ├── api/ # Tipos de petición/respuesta para todos los endpoints REST
│ │ ├── contract.ts # Contrato canónico de configuración y ejecución de actividades
│ │ └── enums.ts # Enums de dominio (Role, Level, AgeSegment, ActivityType, etc.)
│ └── test/ # Pruebas unitarias de validación de esquemas y tipos compartidos
├── planning/ # Documentación de diseño, arquitectura, hitos y tablero operativo
│ ├── architecture-overview.md# Especificación técnica exhaustiva de la arquitectura del sistema
│ ├── sdd-process.md # Manual del proceso Spec-Driven Development
│ └── taskboard.md # Tablero de tareas del proyecto
├── specs/ # Especificaciones formales por capacidad (SPEC-01 a SPEC-11 Verificadas)
├── tooling/ # Configuraciones transversales compartidas (tsconfig, eslint, prettier)
├── docker-compose.yml # Configuración de contenedores locales (PostgreSQL 18, MinIO S3 y Mailpit SMTP)
├── package.json # Scripts globales y dependencias de la raíz del monorepo
├── pnpm-workspace.yaml # Definición de paquetes y aplicaciones del monorepo
└── turbo.json # Definición de pipelines de compilación y ejecución de Turborepo
```

---

## Guía de instalación y ejecución local

Sigue estos pasos para clonar, configurar y ejecutar el proyecto completo en tu entorno local en menos de 20 minutos.

### 1. Requisitos previos

Asegúrate de tener instalados los siguientes componentes en tu sistema operativo:

- **Node.js 24 LTS:** (Verifica con `node -v`). Se recomienda el uso de `nvm`:
  ```bash
  nvm use
  ```
- **pnpm 11:** (Versión recomendada `11.5.1`). Puedes activarlo mediante Corepack o npm:
  ```bash
  corepack enable
  # o alternativamente:
  npm install -g pnpm@11.5.1
  ```
- **Docker y Docker Compose:** Para ejecutar PostgreSQL 18 localmente de forma reproducible.
- **ffmpeg y ffprobe:** Requerido para la validación y transcodificación de audios en el backend:
  - **Windows:** `winget install Gyan.FFmpeg` o `choco install ffmpeg`
  - **macOS:** `brew install ffmpeg`
  - **Linux (Ubuntu/Debian):** `sudo apt-get update && sudo apt-get install -y ffmpeg`

### 2. Clonar el repositorio

```bash
git clone https://github.com/Samuel-Duque/englove.git
cd englove
```

### 3. Configurar variables de entorno

Copia la plantilla `.env.example` para generar el archivo `.env` de desarrollo local:

```bash
cp .env.example .env
```

> [!NOTE]
> Las variables en `.env.example` vienen listas para el entorno local con MinIO (emulación local de Cloudflare R2 con el bucket `englove-dev`) y Mailpit (servidor SMTP local e interfaz web de inspección de correos en `http://localhost:8025`).

Al iniciar la API desde `apps/api`, revisa también `apps/api/.env`: sus variables de R2 deben apuntar a MinIO local (`R2_ENDPOINT=http://localhost:9000`) y coincidir con las credenciales y el bucket del `.env` raíz. Un archivo antiguo con valores de ejemplo para R2 puede generar URLs inaccesibles. Con los servicios iniciados, `node scripts/check-local-audio.mjs` comprueba la configuración local, el bucket y las herramientas de audio sin subir archivos.

### 4. Instalar dependencias

Instala todas las dependencias del monorepo de forma limpia mediante pnpm:

```bash
pnpm install
```

### 5. Iniciar servicios locales (PostgreSQL 18, MinIO y Mailpit)

Levanta los contenedores de desarrollo en segundo plano (PostgreSQL 18 se expone en el puerto local **`5433`** (`localhost:5433`) para evitar colisiones con instancias nativas de Postgres en el puerto estándar 5432):

```bash
docker compose up -d
```

Para verificar que los contenedores se encuentran activos y saludables:

```bash
docker compose ps
```

### 6. Aplicar migraciones del esquema

Aplica las migraciones pendientes con Prisma sobre la base de datos de desarrollo y regenera el cliente tipado:

```bash
pnpm db:migrate
pnpm db:generate
```

### 7. Cargar datos de prueba (Seeds)

Carga los datos iniciales de desarrollo para disponer de una organización activa, profesora, grupos, alumnos en distintos segmentos, actividades preconfiguradas, intentos y asignaciones:

```bash
pnpm seed:dev
```

_(Opcional: Si requieres una base limpia únicamente con la profesora y la organización, ejecuta `pnpm seed`)._

### 8. Iniciar servidores de desarrollo

Inicia simultáneamente el frontend Next.js y el backend NestJS en modo desarrollo con recarga en caliente (_watch mode_):

```bash
pnpm dev
```

### 9. Verificación de la instalación

Una vez iniciados los servicios, abre tu navegador web y comprueba los siguientes puntos:

| Aplicación / Servicio | URL Local                                                    | Descripción                                                              |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Frontend Web**      | [http://localhost:3000](http://localhost:3000)               | Aplicación Next.js (pantallas de inicio, login y portales)               |
| **API Health Check**  | [http://localhost:3001/health](http://localhost:3001/health) | Comprobación de estado y conexión a la base de datos (`{"status":"ok"}`) |
| **Swagger / OpenAPI** | [http://localhost:3001/docs](http://localhost:3001/docs)     | Documentación interactiva de todos los endpoints de la API               |

---

## Usuarios y credenciales de prueba

El script `pnpm seed:dev` provee las siguientes cuentas listas para probar los distintos roles y flujos de la plataforma:

| Rol / Tipo             | Correo electrónico             | Contraseña        | Segmento / Nivel    | Propósito de prueba                                             |
| ---------------------- | ------------------------------ | ----------------- | ------------------- | --------------------------------------------------------------- |
| **Profesora**          | `profesora@englove.org`        | `Englove2026!`    | Docente / Admin     | Creación de actividades, asignaciones, revisión y panel docente |
| **Alumno (Kids)**      | `lucas.kids@englove.org`       | `Estudiante2026!` | Kids (7–10) · A1    | Experiencia visual lúdica, intentos resueltos y pendientes      |
| **Alumno (Kids)**      | `sofia.kids@englove.org`       | `Estudiante2026!` | Kids (7–10) · A1    | Pruebas de asignaciones y actividades de completar              |
| **Alumno (Teens)**     | `camila.teens@englove.org`     | `Estudiante2026!` | Teens (11–14+) · B1 | Interfaz sobria, microjuegos y actividades avanzadas            |
| **Alumno (Teens)**     | `daniel.teens@englove.org`     | `Estudiante2026!` | Teens (11–14+) · A2 | Ejercicios de audio, feedback recibido y rachas                 |
| **Registro Pendiente** | `emiliano.pending@englove.org` | `Estudiante2026!` | Kids · Pendiente    | Verificación del flujo de aprobación docente de nuevos alumnos  |

---

## Pruebas, calidad y guardrails

La plataforma dispone de comprobaciones automatizadas de código, contratos, persistencia y accesibilidad. Sus resultados acreditan el alcance ejecutado y no garantizan ausencia de bugs ni aceptación operativa:

```bash
# Ejecutar las pruebas; para integrar PostgreSQL se necesita una base aislada migrada
pnpm test
# Ejecutar auditoría automatizada de reglas invariantes
pnpm guardrails
```

- **Evidencia fechada:** [auditoría del 12 de noviembre](./planning/auditoria-general-2026-11-12.md) y [estado de su remediación](./planning/remediacion-auditoria-2026-11-12.md). Los conteos pertenecen al snapshot y las ejecuciones de cada informe.
- `packages/shared` verifica esquemas y contratos; `apps/api`, controladores, guards, servicios y flujos PostgreSQL; `apps/web`, helpers y componentes reales. Playwright cubre navegador con parte de la API simulada; no sustituye pruebas integrales contra staging.
- CI exige PostgreSQL disponible y falla ante errores E2E. Para exigir PostgreSQL también en local: `REQUIRE_POSTGRES_TESTS=1`; nunca apuntar fixtures o migraciones de test a una base con datos reales.
- **Verificación de guardrails (`pnpm guardrails`):** Script auditor (`check-guardrails.mjs`) que analiza estáticamente el código para prevenir desviaciones críticas de arquitectura:
  - Señales de consultas sin filtro explícito por `organization_id` (requieren revisión semántica anti-IDOR).
  - Cero cálculo de notas en el frontend.
  - Cero creación de timestamps en el cliente.
  - Prohibición estricta de `prisma db push` en producción.
  - Prohibición de `@ts-ignore`, `any` y aserciones de tipo inseguras.

---

## Metodología y estado del proyecto

Englove sigue **Spec-Driven Development (SDD)**: el código de producción requiere una especificación previa aprobada. La implementación se verifica después conforme al proceso y sus criterios de aceptación.
Para conocer en detalle el proceso y las especificaciones activas:

- [Proceso SDD y ciclo de vida](./planning/sdd-process.md)
- [Índice formal de especificaciones](./specs/README.md)
- [Tablero de control de tareas](./planning/taskboard.md)

### Estado actual de las especificaciones

| Especificación                                     | Título                                                | Estado         | Etapa   |
| -------------------------------------------------- | ----------------------------------------------------- | -------------- | ------- |
| [SPEC-01](./specs/SPEC-01-scaffold.md)             | Scaffold del monorepo y entorno base                  | **Verificada** | Etapa 1 |
| [SPEC-02](./specs/SPEC-02-identidad-y-sesion.md)   | Identidad, autenticación y roles                      | **Verificada** | Etapa 2 |
| [SPEC-03](./specs/SPEC-03-gestor-de-contenidos.md) | Gestor de contenidos y actividades                    | **Verificada** | Etapa 3 |
| [SPEC-04](./specs/SPEC-04-asignacion.md)           | Asignación y ventanas de entrega                      | **Verificada** | Etapa 4 |
| [SPEC-05](./specs/SPEC-05-portal-e-intentos.md)    | Portal del alumno y resolución de intentos            | **Verificada** | Etapa 5 |
| [SPEC-06](./specs/SPEC-06-microjuegos.md)          | Microjuegos formativos autónomos                      | **Verificada** | Etapa 6 |
| [SPEC-07](./specs/SPEC-07-revision-y-feedback.md)  | Revisión docente, retroalimentación y nuevo intento   | **Verificada** | Etapa 7 |
| [SPEC-08](./specs/SPEC-08-estadisticas.md)         | Estadísticas de rendimiento, constancia y leaderboard | **Implementada** (enmienda NEG-01; re-verificación CI pendiente) | Etapa 8 |
| [SPEC-09](./specs/SPEC-09-pwa-offline-a11y.md)     | PWA, offline y accesibilidad                          | **Verificada** | Etapa 9 |
| [SPEC-10](./specs/SPEC-10-contenido-extra.md)      | Contenido extra                                       | **Verificada** | Etapa 10 |
| [SPEC-11](./specs/SPEC-11-calidad-y-correcciones.md) | Calidad, correcciones y verificación                  | **Verificada** | Etapa 12 |

El cierre histórico de Etapa 12 consta en SPEC-11. Las correcciones de la auditoría posterior del 2026-11-12 se registran por separado en su informe de remediación; no constituyen aceptación operativa ni cierre de Etapa 11.

---

## Reglas invariantes de diseño

Todo colaborador y agente de desarrollo en Englove debe respetar las siguientes reglas canónicas (detalladas en [`.agents/CONTEXT.md`](./.agents/CONTEXT.md) §16):

1. **Separación estricta de responsabilidades:** NestJS (`apps/api`) es el único backend de negocio y la única fuente de autorización. El frontend jamás consulta directamente la base de datos.
2. **Aislamiento Multi-Tenant (Anti-IDOR):** Toda consulta a tablas de tenant incluye explícitamente `organization_id`. Prohibido utilizar `findUnique` por ID simple sin validar pertenencia de organización y alumno.
3. **Puntajes en el servidor:** La nota de cualquier actividad se calcula de forma centralizada en el backend en escala de **0,0 a 5,0**. Las notas calificadas son inmutables.
4. **Timestamps soberanos:** Las marcas de tiempo de inicio, entrega y calificación las genera exclusivamente el servidor de base de datos.
5. **Tipado absoluto y dos niveles de validación:** Prohibido el uso de `any`, `@ts-ignore` o `@ts-nocheck`. Validación HTTP de envoltura mediante `class-validator` con `whitelist: true`, y validación profunda de dominio mediante esquemas `Zod` en `packages/shared`.
6. **Privacidad de menores:** Cero PII en logs y sistemas externos de monitoreo. Limpieza de caché local e IndexedDB al cerrar sesión.
7. **Procesamiento de audio seguro:** Ejecución de `ffmpeg` sin shell (`shell: false`) y bajo cola serial de 1 tarea a la vez para no exceder los límites de memoria (512 MB).

---

## Despliegue e infraestructura

La plataforma está optimizada para operar con alta disponibilidad y costos contenidos:

- **Frontend (`apps/web`):** Destino previsto: **Cloudflare Workers** mediante `vinext`. El build y el empaquetado local no acreditan un despliegue cloud.
- **Backend API (`apps/api`):** Destino previsto: **Render**, contenedor Docker en instancia única, con cola serial de `ffmpeg`.

El aprovisionamiento y la aceptación operativa siguen el [taskboard](./planning/taskboard.md). La promoción a staging queda documentada en [despliegue-staging.md](./planning/despliegue-staging.md); no se declara infraestructura creada ni producción operativa por existir el workflow.
- **Base de datos:** **PostgreSQL 18** gestionado en **Neon**, utilizando endpoint con PgBouncer para runtime y conexión directa para migraciones estructuradas de Prisma.
- **Almacenamiento multimedia:** **Cloudflare R2** para la retención y entrega privada de archivos de audio e imágenes sin costos de egreso de datos.
- **Correo transaccional:** **Resend** para notificaciones críticas, alertas de entrega y recuperación de accesos.

---

## Licencia y autoría

Proyecto desarrollado y mantenido para la plataforma educativa **Englove**.  
Todos los derechos reservados © 2026.
