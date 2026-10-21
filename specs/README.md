# Englove — Índice de especificaciones

Índice único de las especificaciones de capacidades de Englove y su estado en el proceso SDD.

## Referencias del proceso

- [Plantilla obligatoria — sdd-process §5](../planning/sdd-process.md#5-plantilla-de-especificación), disponible en [`_template.md`](./_template.md).
- [Ciclo de vida y aprobación — sdd-process §6](../planning/sdd-process.md#6-ciclo-de-vida-de-una-spec).
- [Calendario de redacción — sdd-process §7](../planning/sdd-process.md#7-calendario-de-redacción).

## Especificaciones redactadas

| Spec | Título | Estado | Etapa | Tareas |
| --- | --- | --- | --- | --- |
| [SPEC-01](./SPEC-01-scaffold.md) | Scaffold | Verificada | 1 — Scaffold | ENG-010 a ENG-019 |
| [SPEC-02](./SPEC-02-identidad-y-sesion.md) | Identidad y sesión | Verificada | 2 — Identidad y roles | ENG-020, ENG-021, ENG-023 a ENG-029 |
| [SPEC-03](./SPEC-03-gestor-de-contenidos.md) | Gestor de contenidos | Borrador | 3 — Gestor de contenidos | ENG-030 a ENG-038, ENG-040, ENG-041, ENG-043 a ENG-046 |

El calendario de las specs pendientes vive en sdd-process §7; este índice solo lista archivos ya redactados.

SPEC-00 es la tarea de arranque que crea este índice y la plantilla; no es una spec de capacidad ni tiene un archivo `SPEC-00`. A 2026-10-20, SPEC-01 figura Verificada por solicitud del líder (trazabilidad en su §9 y §12). A 2026-10-21, SPEC-02 pasa a Verificada tras la implementación completa y verificación de las tareas técnicas cubiertas (ENG-020, ENG-021, ENG-023 a ENG-029) con cobertura de pruebas unitarias e integración en verde (108/108 en monorepo, 69/69 en API, 26/26 en web; guardrails en verde). SPEC-03 figura en Borrador (redactada, no revisada ni aprobada, con preguntas abiertas Q-01 a Q-03 en su §11 pendientes de resolución por el líder del proyecto).


