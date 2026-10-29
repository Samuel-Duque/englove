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

- **5 tipos de actividad base:** 1.`fill_blank`: Completar textos y oraciones con opciones dinámicas. 2. `multiple_choice`: Preguntas de selección múltiple con opciones contextuales. 3. `matching`: Emparejamiento conceptual mediante arrastrar y soltar (_drag & drop_). 4. `audio_recording`: Grabación de pronunciación oral con subida directa y segura a Cloudflare R2 mediante URLs prefirmadas. 5. `game`: Microjuegos formativos.
- **5 mecánicas de minijuegos educativos:**
  - `word_scramble`: Ordenamiento de letras para armar palabras en inglés.
  - `drag_letters`: Formación de vocabulario arrastrando letras sueltas.
  - `pair_matching`: Emparejamiento de conceptos, traducción e imágenes.
  - `flashcards`: Tarjetas nemotécnicas interactivas con autoevaluación.
  - `whack_a_mole`: Identificación rápida de términos correctos con límite de tiempo.
- Acceso a microjuegos en modo autónomo 24/7 en `/juegos` o como parte de asignaciones curriculares.

### 2. Asignaciones y gestión docente

- Creación de asignaciones grupales o individuales personalizadas.
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
|                           | Express                 | `^5.0.0`              | Servidor HTTP subyacente para el framework NestJS               |
|                           | Prisma ORM              | `^7.0.0`              | Mapeo objeto-relacional y migraciones tipadas                   |
|                           | `@prisma/adapter-pg`    | `^7.10.1`             | Adaptador nativo PostgreSQL para poolers y servidor             |
|                           | Argon2                  | `^0.41.1`             | Algoritmo resistente para hash seguro de contraseñas            |
|                           | Pino / nestjs-pino      | `^9.6.0` / `^4.3.1`   | Logger estructurado de alto rendimiento sin fugas de PII        |
|                           | fluent-ffmpeg           | `^2.1.3`              | Orquestador de transcodificación de audio en servidor           |
|                           | AWS SDK S3              | `^3.750.0`            | Cliente S3 para generación de URLs prefirmadas en Cloudflare R2 |
|                           | Resend SDK              | `^4.1.2`              | Envío de correos transaccionales institucionales                |
| **Tipado y Compartido**   | `@englove/shared`       | `0.0.1`               | Contratos de actividad, enums canónicos y DTOs comunes          |
|                           | TypeScript              | `~5.9.3`              | Tipado estricto sin comodines `any` en todo el repositorio      |
|                           | Zod                     | `^3.24.2`             | Validación de esquemas estructurales de actividades y DTOs      |
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
│ ├── CONTEXT.md # Fuente única de verdad técnica y de producto (Decisiones 1–115)
│ └── skills/ # Habilidades y scripts automáticos del proyecto (guardrails, spec)
├── apps/
│ ├── api/ # Backend NestJS 11
│ │ ├── prisma/ # Esquema schema.prisma, migraciones y scripts de seed
│ │ ├── src/
│ │ │ ├── activities/ # Gestión de actividades y esquemas pedagógicos
│ │ │ ├── assignments/ # Lógica de asignación grupal/individual y ventanas temporales
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
├── specs/ # Especificaciones formales por capacidad (SPEC-01 a SPEC-08)
├── tooling/ # Configuraciones transversales compartidas (tsconfig, eslint, prettier)
├── docker-compose.yml # Configuración de contenedores locales (PostgreSQL 18)
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
> Las variables en `.env.example` vienen listas para el entorno local. No se requiere configurar claves reales de Cloudflare R2 ni de Resend en local: el servicio de correo opera en modo log seguro y el servicio de almacenamiento simula URLs locales válidas.

### 4. Instalar dependencias

Instala todas las dependencias del monorepo de forma limpia mediante pnpm:

```bash
pnpm install
```

### 5. Iniciar base de datos local (PostgreSQL 18)

Levanta el contenedor de PostgreSQL 18 en segundo plano:

```bash
docker compose up -d postgres
```

Para verificar que el contenedor se encuentra activo y saludable:

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

La plataforma garantiza estabilidad, integridad de arquitectura y cumplimiento normativo mediante múltiples barreras de calidad automatizadas:

```bash
# Ejecutar suite de pruebas completa (407 tests en verde)
pnpm test
# Ejecutar auditoría automatizada de reglas invariantes
pnpm guardrails
```

- **Suite de pruebas:** Más de **407 pruebas automáticas** en verde en todo el monorepo (Vitest):
  - `packages/shared`: 58 tests (validación estricta de esquemas Zod, contratos y DTOs).
  - `apps/api`: 265 tests (controladores, guards, servicios de scoring, media, review y flujos E2E con PostgreSQL real).
  - `apps/web`: 84 tests (flujos docentes, portal de alumnos, componentes de microjuegos, protección de proxy y formularios).
- **Verificación de guardrails (`pnpm guardrails`):** Script auditor (`check-guardrails.mjs`) que analiza estáticamente el código para prevenir desviaciones críticas de arquitectura:
  - Cero consultas sin filtro explícito por `organization_id` (anti-IDOR).
  - Cero cálculo de notas en el frontend.
  - Cero creación de timestamps en el cliente.
  - Prohibición estricta de `prisma db push` en producción.
  - Prohibición de `@ts-ignore`, `any` y aserciones de tipo inseguras.

---

## Metodología y estado del proyecto

Englove sigue estrictamente la metodología **Spec-Driven Development (SDD)**: _ninguna línea de código de producción se escribe sin una especificación previa aprobada y verificada_.
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
| [SPEC-08](./specs/SPEC-08-estadisticas.md)         | Estadísticas de rendimiento, constancia y leaderboard | **Aprobada**   | Etapa 8 |

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

- **Frontend (`apps/web`):** Desplegado como **Cloudflare Worker** mediante `vinext`, logrando latencias perimetrales mínimas y renderizado Server Components (RSC) de alto rendimiento.
- **Backend API (`apps/api`):** Alojado en **Render** como contenedor Docker en instancia única dedicada, con gestión segura de memoria para la cola de `ffmpeg`.
- **Base de datos:** **PostgreSQL 18** gestionado en **Neon**, utilizando endpoint con PgBouncer para runtime y conexión directa para migraciones estructuradas de Prisma.
- **Almacenamiento multimedia:** **Cloudflare R2** para la retención y entrega privada de archivos de audio e imágenes sin costos de egreso de datos.
- **Correo transaccional:** **Resend** para notificaciones críticas, alertas de entrega y recuperación de accesos.

---

## Licencia y autoría

Proyecto desarrollado y mantenido para la plataforma educativa **Englove**.  
Todos los derechos reservados © 2026.
