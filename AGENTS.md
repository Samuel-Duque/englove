# Englove — Guía para agentes

Plataforma web gamificada para enseñar inglés a niños de 7 a 14 años. El proyecto está en **Etapa 0 (planeación)** y sigue Spec-Driven Development: no se escribe código de producción sin una spec aprobada en `specs/`.

## Dónde está cada cosa

Lee estos documentos antes de trabajar (en este orden de autoridad si hay conflicto):

1. `.agents/CONTEXT.md` — fuente única de verdad.
   - §2.4: lo que queda **fuera del piloto**.
   - §14: registro de decisiones (1–80).
   - §15: pendientes abiertos (P-1 a P-5).
   - §16: **convenciones obligatorias para agentes**.
   - §17: **glosario** del dominio.
2. `planning/architecture-overview.md` — arquitectura.
3. `planning/sdd-process.md` — proceso SDD y plantilla de spec (§5).
4. `planning/pbp-development.md` — etapas e hitos.
5. `planning/taskboard.md` — tareas.
6. `specs/` — especificaciones (`SPEC-00` a `SPEC-10`).

Otros documentos: `planning/incongruencias-y-decisiones-definitivas.md`, `planning/decisiones-modelo-de-datos.md`, `planning/skills-propias-pendientes.md` (skills propias aún sin crear).

## Para las skills que buscan `GLOSSARY.md` y `docs/adr/`

Este repo no tiene esos archivos. Sus equivalentes son:

- Glosario → `.agents/CONTEXT.md` §17.
- Decisiones (ADR) → `.agents/CONTEXT.md` §14.

Si una skill pide crear un ADR o un término de glosario, añádelo en esas secciones; no crees `GLOSSARY.md` ni `docs/adr/` sin preguntar.

## Reglas clave (resumen de CONTEXT.md §16)

- Identificadores de código en inglés; documentación y textos de UI en español.
- Toda consulta filtra por `organization_id`.
- La nota se calcula siempre en el servidor, en escala 0.0–5.0.
- Los timestamps los pone el servidor, nunca el cliente.
- No reintroducir `Guardian`, `ConsentRecord` ni Supabase Storage (los archivos van a Cloudflare R2).
- No construir nada de la lista fuera de alcance del piloto (§2.4).

## Skills

Las skills del proyecto están en `.agents/skills/` (enlazadas desde `.claude/skills/` y `.kiro/skills/`) y registradas en `skills-lock.json`. Para restaurarlas en otro equipo: `npx skills experimental_install`.
