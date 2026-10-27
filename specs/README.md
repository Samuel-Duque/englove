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
| [SPEC-03](./SPEC-03-gestor-de-contenidos.md) | Gestor de contenidos | Verificada | 3 — Gestor de contenidos | ENG-030 a ENG-038, ENG-040, ENG-041, ENG-043 a ENG-046 |
| [SPEC-04](./SPEC-04-asignacion.md) | Asignación | Verificada | 4 — Asignación | ENG-050 a ENG-053 |
| [SPEC-05](./SPEC-05-portal-e-intentos.md) | Portal e intentos | Verificada | 5 — Portal del estudiante | ENG-039, ENG-060 a ENG-073 |
| [SPEC-06](./SPEC-06-microjuegos.md) | Microjuegos | Verificada | 6 — Microjuegos | ENG-080 a ENG-087 |
| [SPEC-07](./SPEC-07-revision-y-feedback.md) | Revisión, feedback, nuevo intento y retención de audios | Verificada | 7 — Calificación, feedback y nuevo intento | ENG-090 a ENG-096 |

El calendario de las specs pendientes vive en sdd-process §7; este índice solo lista archivos ya redactados. SPEC-05 se encuentra **Verificada**, tras la aceptación de Q-01 a Q-04 de su §11 (Decisiones 100 a 103 de CONTEXT §14) y la implementación de las tareas ENG-039 y ENG-060 a ENG-073 con 326/326 pruebas en monorepo. SPEC-06 se encuentra **Verificada**, aprobada por el líder del proyecto el 2026-10-25 tras el cierre de las preguntas abiertas Q-01 a Q-04 mediante las Decisiones 104 a 107 de CONTEXT §14, e implementada en su totalidad con las tareas ENG-080 a ENG-087 y 370/370 pruebas en verde en monorepo (58 en shared, 236 en api, 76 en web). SPEC-07 se encuentra **Verificada**, aprobada el 2026-10-26 por el líder del proyecto tras cerrar Q-01 a Q-04 con las Decisiones 108 a 111 de CONTEXT §14, e implementada integralmente con las tareas ENG-090 a ENG-096 y 407/407 pruebas en verde en monorepo (58 en shared, 265 en api, 84 en web).

SPEC-00 es la tarea de arranque que crea este índice y la plantilla; no es una spec de capacidad ni tiene un archivo `SPEC-00`. A 2026-10-20, SPEC-01 figura Verificada por solicitud del líder (trazabilidad en su §9 y §12). A 2026-10-21, SPEC-02 pasa a Verificada tras la implementación completa y verificación de las tareas técnicas cubiertas (ENG-020, ENG-021, ENG-023 a ENG-029). A 2026-10-22, SPEC-03 pasa a Verificada tras la aprobación y verificación por el líder del proyecto de todas sus tareas (ENG-030 a ENG-038, ENG-040, ENG-041, ENG-043 a ENG-046), con cobertura de pruebas unitarias e integración en verde (188/188 en monorepo: 44 en shared, 110 en api, 34 en web; guardrails en verde). A 2026-10-22, SPEC-04 pasa a Verificada tras la implementación completa y verificación de la Etapa 4 (ENG-050 a ENG-053) con 254/254 tests en monorepo (54 en shared, 151 en api, 49 en web), suite concurrente en PostgreSQL real con Docker, guardrails sin errores y builds exitosos. A 2026-10-22, SPEC-05 pasa a Verificada tras la resolución de Q-01 a Q-04 e implementación integral de la Etapa 5 (ENG-039, ENG-060 a ENG-073), consolidada a 2026-10-23 con 326/326 tests en monorepo (54 en shared, 213 en api, 59 en web). A 2026-10-25, SPEC-06 pasa de En revisión a Verificada tras su aprobación e implementación de ENG-080 a ENG-087 con 370/370 tests en monorepo (58 en shared, 236 en api, 76 en web). A 2026-10-26, SPEC-07 pasa a Verificada tras la implementación completa de ENG-090 a ENG-096 y verificación automatizada de 407/407 tests en monorepo y suite E2E en PostgreSQL real.
