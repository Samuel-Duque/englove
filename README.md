# Englove

Plataforma web educativa, interactiva y gamificada para enseñar inglés a niños y adolescentes (7–14 años). Diseñada para apoyar la labor de una profesora particular y construida para escalar a un SaaS multi-tenant para academias de idiomas.

## Descripción general

- Currículo organizado según el **MCER** (A1, A2, B1, B2).
- Dos segmentos de experiencia: **Kids/Junior (7–10)** y **Teens (11–14+)**, con temas visuales distintos.
- La profesora crea y asigna actividades; los alumnos las completan; la profesora califica y entrega feedback personal.
- Calificación en escala colombiana **0,0–5,0**. El puntaje siempre se calcula en servidor.
- Gamificación: estrellas, insignias, rachas semanales perdonables y misiones.
- PWA instalable. Sin publicación en tiendas de aplicaciones durante el piloto.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | **Next.js 16.4** (App Router, Turbopack, React Compiler) / **React 19.3**, TypeScript 5.9, Tailwind CSS 4, shadcn/ui, Framer Motion, `@atlaskit/pragmatic-drag-and-drop` (microjuegos) |
| Backend | NestJS 11, Prisma ORM 7, JWT + Guards RBAC |
| Base de datos | PostgreSQL 18 en Neon (solo Postgres; pooler para el runtime, conexión directa para migraciones) |
| Archivos | Cloudflare R2 (audios raw y MP4 transcodificados con ffmpeg) |
| Monorepo | pnpm workspaces + Turborepo (`apps/web`, `apps/api`, `packages/shared`) |
| Hosting | Frontend → Cloudflare Workers (`vinext`) · Backend → Render |
| Correo | Resend |

### Requisitos previos

- **Node.js 24 LTS** y **pnpm 11**.
- Docker (PostgreSQL 18 local) y `ffmpeg` / `ffprobe` instalados para la transcodificación de audios en local.

### Entornos y costes (decisión 82)

| Entorno | Web | API | Postgres | Coste |
|---|---|---|---|---|
| `local` | `next dev` | `nest start` | Docker | $0 |
| `staging` y demo | Cloudflare Free | Render Free | Neon Free | **$0** |
| `production` (piloto inicial ~10 alumnos; preparado para ~30 activos) | Cloudflare Workers Paid | Render Starter | Neon Launch | **~$16–19/mes** |

La demo gratuita (~11 personas, 1–2 semanas, sesiones guiadas) **no es apta para clases reales**: Render Free duerme a los 15 minutos y Neon Free suspende el cómputo a los 5. El bundle de Workers Free tiene un límite de 3 MB comprimido. Detalle y protocolo en [`CONTEXT.md`](./.agents/CONTEXT.md) §6 y §14 (decisiones 81 y 82).

## Estructura del repositorio

```
.agents/          # Contexto raíz del proyecto (CONTEXT.md)
planning/         # Documentos de planificación
  architecture-overview.md
  pbp-development.md
  sdd-process.md
  taskboard.md
specs/            # Especificaciones por capacidad (se crean en Etapa 0)
apps/
  web/            # Frontend Next.js
  api/            # Backend NestJS
packages/
  shared/         # Tipos y esquemas Zod compartidos
```

## Metodología

Englove usa **Spec-Driven Development (SDD)**: cada capacidad tiene una especificación escrita, revisada y aprobada antes de escribir código. Ver [`planning/sdd-process.md`](./planning/sdd-process.md).

## Documentación de planificación

- [`CONTEXT.md`](./.agents/CONTEXT.md) — Visión, decisiones de producto y arquitectura.
- [`architecture-overview.md`](./planning/architecture-overview.md) — Arquitectura técnica detallada.
- [`pbp-development.md`](./planning/pbp-development.md) — Etapas e hitos de desarrollo.
- [`taskboard.md`](./planning/taskboard.md) — Estado actual de tareas.
- [`sdd-process.md`](./planning/sdd-process.md) — Proceso de desarrollo guiado por specs.

## Estado actual

> Etapa 0 — Planificación. El código aún no ha comenzado.
