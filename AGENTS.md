# Englove — Guía para agentes

Plataforma web gamificada para enseñar inglés a niños de 7 a 14 años. El proyecto avanza por etapas bajo Spec-Driven Development (Etapas 0–8 implementadas; SPEC-01 a SPEC-08 Verificadas; cierre global de Etapa 3/H1, Etapa 5/H2, Etapa 6 y Etapa 7/H3 pendiente de evidencia operativa en staging/onboarding de usuarios y tablets reales): no se escribe código de producción sin una spec aprobada en `specs/`.

## Dónde está cada cosa

Lee estos documentos antes de trabajar (en este orden de autoridad si hay conflicto):

1. `.agents/CONTEXT.md` — fuente única de verdad.
   - §2.4: lo que queda **fuera del piloto**.
   - §14: registro de decisiones (1–115).
   - §15: pendientes abiertos (cerrados para el piloto).
   - §16: **convenciones obligatorias para agentes**.
   - §17: **glosario** del dominio.
2. `planning/architecture-overview.md` — arquitectura.
3. `planning/sdd-process.md` — proceso SDD y plantilla de spec (§5).
4. `planning/pbp-development.md` — etapas e hitos.
5. `planning/taskboard.md` — tareas.
6. `specs/` — especificaciones (`SPEC-00` a `SPEC-10`).

Otros documentos: `planning/incongruencias-y-decisiones-definitivas.md`, `planning/decisiones-modelo-de-datos.md`, `planning/skills-propias-pendientes.md` (skills propias: `englove-spec` y `englove-guardrails` creadas; las demás, pendientes).

## Para las skills que buscan `GLOSSARY.md` y `docs/adr/`

Este repo no tiene esos archivos. Sus equivalentes son:

- Glosario → `.agents/CONTEXT.md` §17.
- Decisiones (ADR) → `.agents/CONTEXT.md` §14.

Si una skill pide crear un ADR o un término de glosario, añádelo en esas secciones; no crees `GLOSSARY.md` ni `docs/adr/` sin preguntar.

## Reglas clave (resumen de CONTEXT.md §16)

- Identificadores de código en inglés; documentación y textos de UI en español.
- Tipado estricto sin `any`, `@ts-ignore`, `@ts-nocheck` ni aserciones ciegas (`as Type`). Contratos únicos en `packages/shared`.
- Validación en dos niveles: `class-validator` para envoltura HTTP con `whitelist: true` (sin `forbidNonWhitelisted`); `Zod` en `packages/shared` para actividades.
- Toda consulta filtra por `organization_id`. Prohibido `findUnique` por id en tablas de tenant sin validar `organization_id` (anti-IDOR); aislar `student_id` en peticiones de alumnos.
- La nota se calcula siempre en el servidor, en escala 0.0–5.0.
- Los timestamps los pone el servidor, nunca el cliente.
- Frontend en Cloudflare Workers: Server Components (RSC) por defecto; TanStack Query para la API; jamás `'use cache'` en datos autenticados.
- `proxy.ts` (nunca `middleware.ts`) solo redirige por rol; la autorización de negocio es exclusiva de NestJS.
- Archivos en Cloudflare R2 con URLs prefirmadas validadas; transcodificación `ffmpeg` estructurada (`shell: false`) y cola serial (1 tarea en 512 MB).
- Privacidad y seguridad: cero PII en logs y Sentry; sin `dangerouslySetInnerHTML`; limpiar IndexedDB y caché al hacer logout en tablets compartidas.
- No reintroducir `Guardian`, `ConsentRecord` ni Supabase Storage (los archivos van a Cloudflare R2).
- No construir nada de la lista fuera de alcance del piloto (§2.4).

## Skills

Las skills del proyecto están en `.agents/skills/` (con copias versionadas en `.claude/skills/` y `.kiro/skills/`) y registradas en `skills-lock.json`. Para restaurarlas en otro equipo: `npx skills experimental_install`.

Skills propias del proyecto (fuente en `.agents/skills/`; al modificarlas, actualiza también sus copias en `.claude/skills/` y `.kiro/skills/`):

- `englove-spec`: redactar, revisar o actualizar specs `SPEC-NN` y crear `specs/` (SPEC-00). Úsala antes de tocar cualquier archivo de `specs/` y antes de empezar una tarea `ENG`, para comprobar que su spec está Aprobada. Incluye `scripts/check-spec.mjs` para verificar la estructura de una spec.
- `englove-guardrails`: verificar de forma automatizada e interactiva las invariantes de persistencia (Neon y Prisma), despliegue (Cloudflare Workers con `vinext`, Render en instancia única y Cloudflare R2) y negocio (`CONTEXT.md` §16 y `architecture-overview.md`). Úsala antes de escribir o cerrar código de producción y junto con `code-review` y `security-review`. Incluye `scripts/check-guardrails.mjs` y el catálogo `references/reglas.md`.
