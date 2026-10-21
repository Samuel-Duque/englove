# Englove

Plataforma web educativa, interactiva y gamificada para enseñar inglés a niños y adolescentes (7–14 años). Diseñada para apoyar la labor de una profesora particular y construida para escalar a un SaaS multi-tenant para academias de idiomas.

## Descripción general

- Currículo organizado según el **MCER** (A1, A2, B1, B2).
- Dos segmentos de experiencia: **Kids/Junior (7–10)** y **Teens (11–14+)**, con temas visuales distintos.
- La profesora crea y asigna actividades; los alumnos las completan; la profesora califica y entrega feedback personal.
- Calificación en escala colombiana **0,0–5,0**. El puntaje siempre se calcula en servidor.
- Gamificación: estrellas, insignias, rachas semanales perdonables y misiones.
- PWA instalable. Sin publicación en tiendas de aplicaciones durante el piloto.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend (`apps/web`) | **Next.js 16.4** (App Router, Turbopack, React Compiler) / **React 19.3**, TypeScript 5.9, Tailwind CSS 4, shadcn/ui, `@atlaskit/pragmatic-drag-and-drop`, adaptador Cloudflare Workers con `vinext` |
| Backend (`apps/api`) | **NestJS 11**, Prisma ORM 7, Node.js 24 LTS, `ffmpeg` / `ffprobe` (medición y transcodificación de audio) |
| Base de datos | **PostgreSQL 18** en Neon (pooler PgBouncer para runtime, conexión directa para migraciones) |
| Archivos | **Cloudflare R2** (buckets privados vía S3 API con URLs prefirmadas de corta duración) |
| Paquete compartido (`packages/shared`) | Contrato de actividad, enums canónicos, DTOs y validaciones compartidas |
| Monorepo | **pnpm 11** workspaces + **Turborepo 2** |
| Hosting | Web → Cloudflare Workers (`vinext`) · API → Render (instancia única Docker, sin autoescalado) |
| Correo | **Resend** (8 plantillas transaccionales; modo log seguro en local) |

---

## Guía de arranque local (< 30 minutos)

Sigue estos pasos para poner en marcha el proyecto en tu máquina de desarrollo.

### 1. Requisitos previos

- **Node.js 24 LTS** (se recomienda usar `.nvmrc`: `nvm use`).
- **pnpm 11** (`corepack enable` o `npm i -g pnpm@11.5.1`).
- **Docker** y **Docker Compose** (para PostgreSQL 18 local).
- **ffmpeg** y **ffprobe** instalados en el sistema operativo:
  - Windows: `winget install Gyan.FFmpeg` o `choco install ffmpeg`
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install ffmpeg`

### 2. Configurar variables de entorno

Copia el archivo de plantilla a `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Las variables vienen preconfiguradas con valores funcionales para desarrollo local con Docker.

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Iniciar PostgreSQL 18 con Docker Compose

Levanta el contenedor de base de datos local:

```bash
docker compose up -d postgres
```

*(Opcional: Si deseas emular el almacenamiento S3 de R2 en local, ejecuta `docker compose --profile storage up -d`)*.

### 5. Aplicar migraciones del esquema de base de datos

Aplica las migraciones con Prisma:

```bash
pnpm db:migrate
```

### 6. Cargar datos de prueba (Seeds)

Elige y ejecuta el seed correspondiente:

- **Seed de desarrollo (recomendado para desarrollo y pruebas):**
  ```bash
  pnpm seed:dev
  ```
  Crea la organización piloto, profesora, 11 alumnos (Kids y Teens, niveles A1–B2, aprobados y pendientes), actividades de los 5 tipos, las 5 mecánicas de juego, asignaciones abiertas/cerradas/próximas, intentos calificados y pendientes, y rachas.

- **Seed mínimo (organización y profesora únicamente):**
  ```bash
  pnpm seed
  ```

- **Seed de volumen (100 alumnos y 3 meses de intentos para pruebas de carga):**
  ```bash
  pnpm seed:volume
  ```

*Nota:* Cada seed está diseñado para ejecutarse sobre una base migrada limpia.

### 7. Iniciar servidores de desarrollo

Inicia todas las aplicaciones y paquetes en modo watch:

```bash
pnpm dev
```

### 8. Verificar la instalación

Una vez iniciados los servicios, comprueba en tu navegador:

- **Web Frontend:** [http://localhost:3000](http://localhost:3000) — Muestra *"Englove — Plataforma en preparación"*.
- **API Health Check:** [http://localhost:3001/health](http://localhost:3001/health) — Retorna `{"status":"ok"}` comprobando la conexión a PostgreSQL.
- **Documentación Swagger / OpenAPI:** [http://localhost:3001/docs](http://localhost:3001/docs) — Interfaz Swagger de la API (habilitada en local y staging).

---

## Scripts y comandos disponibles

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia el frontend Next.js y el backend NestJS en modo desarrollo |
| `pnpm build` | Compila todos los workspaces (`shared`, `web`, `api`) |
| `pnpm lint` | Ejecuta ESLint en todos los workspaces |
| `pnpm typecheck` | Ejecuta TypeScript typecheck en todos los workspaces |
| `pnpm test` | Ejecuta la suite de pruebas unitarias e integración con Vitest |
| `pnpm guardrails` | Verifica de forma automatizada las reglas invariantes de arquitectura y persistencia |
| `pnpm db:migrate` | Aplica las migraciones de Prisma en la base de datos |
| `pnpm db:generate` | Regenera el Prisma Client a partir de `schema.prisma` |
| `pnpm seed` | Ejecuta el seed mínimo de arranque |
| `pnpm seed:dev` | Ejecuta el seed completo para desarrollo |
| `pnpm seed:volume` | Ejecuta el seed de volumen (100 alumnos) |

---

## Estructura del repositorio

```
.agents/              # Contexto de negocio y especificaciones de agentes (CONTEXT.md)
planning/             # Documentos de arquitectura y proceso SDD
specs/                # Specs SDD: SPEC-01 Verificada; SPEC-02 Aprobada (sin implementar)
apps/
  web/                # Frontend Next.js 16.4 (React 19, Tailwind, Cloudflare Workers con vinext)
  api/                # Backend NestJS 11 (Prisma, PostgreSQL 18, ffmpeg)
packages/
  shared/             # Enums canónicos, contrato de actividad, DTOs y tipos compartidos
tooling/              # Configuraciones compartidas de ESLint, Prettier y TypeScript
```

## Metodología

Englove sigue **Spec-Driven Development (SDD)**: ninguna línea de código de producción se escribe sin una especificación aprobada previamente en `specs/`.

- [`CONTEXT.md`](./.agents/CONTEXT.md) — Visión, reglas normativas y registro de decisiones.
- [`planning/architecture-overview.md`](./planning/architecture-overview.md) — Arquitectura técnica integral.
- [`planning/taskboard.md`](./planning/taskboard.md) — Tablero operativo de tareas del proyecto.
- [`planning/sdd-process.md`](./planning/sdd-process.md) — Proceso SDD y ciclo de vida de especificaciones.
