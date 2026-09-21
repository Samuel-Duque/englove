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
| Frontend | Next.js 14+ / React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | NestJS, Prisma ORM, JWT + Guards RBAC |
| Base de datos | PostgreSQL 16 en Supabase Cloud (solo Postgres + Storage) |
| Monorepo | pnpm workspaces + Turborepo (`apps/web`, `apps/api`, `packages/shared`) |
| Hosting | Frontend → Vercel · Backend → Render |
| Correo | Resend |

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
