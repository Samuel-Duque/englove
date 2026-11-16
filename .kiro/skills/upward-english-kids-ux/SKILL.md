---
name: upward-english-kids-ux
description: "Diseña, implementa o revisa la UX del alumno Kids/Teens de Upward English: temas, ergonomía táctil, consignas, feedback, sonido, movimiento y accesibilidad. Úsala al tocar el portal o los microjuegos, incluso bajo el nombre anterior englove-kids-ux. No sustituye la creación de contenido MCER ni una revisión exclusiva del panel docente o del backend."
---

# UX Kids y Teens de Upward English

Una experiencia táctil comprensible y motivadora para alumnos de 7–14 años, sin mantener dos aplicaciones ni ampliar el piloto.

## Alcance y autoridad

- Una auditoría o propuesta es de solo lectura; implementa únicamente cambios autorizados. Esta skill no autoriza instalaciones, despliegues ni pruebas remotas.
- Consulta los fragmentos pertinentes de `.agents/CONTEXT.md` (§2.4, §3, §8, §14 y §16); prevalecen sobre arquitectura, specs y ejemplos de skills públicas, en ese orden.
- Antes de código de producción, carga `../upward-english-guardrails/SKILL.md`. Comprueba con `../upward-english-spec/SKILL.md` la aprobación de la spec afectada; no cambies sus requisitos para justificar una solución.
- Distingue requisito, implementación observada y propuesta. Un `data-theme` no demuestra tokens completos ni accesibilidad; si falta una pieza, informa la brecha sin inventar que existe.

## Camino corto

1. Identifica pantalla, tema activo, tarea del alumno y modo (diseñar, implementar o revisar). Inspecciona la implementación y la spec correspondiente; pregunta solo si falta una decisión de producto.
2. Conserva los componentes y helpers existentes. Lee únicamente la referencia de la tabla que necesites, no todas las fuentes del proyecto.
3. Aplica las reglas esenciales y verifica el flujo con ambos temas cuando comparta código. Entrega evidencia y pendientes, no una afirmación genérica de cumplimiento.

| Necesidad                                                  | Lectura bajo demanda                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Tema, controles, errores, juegos, movimiento, sonido o voz | [Guía de interacción](references/interaccion.md), solo su sección pertinente |
| Pruebas, comandos o cierre de una revisión                 | [Verificación](references/verificacion.md)                                   |

## Reglas esenciales

- **Segmento:** 7–10 solo Kids; desde 11 puede elegir Kids o Teens si la API habilita `can_switch_interface` (`canSwitchInterface` en el cliente). Cumplir años no cambia el tema automáticamente. No derives permisos de la edad o del almacenamiento local.
- **Sistema visual:** conserva `data-theme="kids"` / `"teens"`, componentes compartidos y un sistema de tokens con dos juegos de valores (CONTEXT §8). Inspecciona los estilos reales antes de extenderlos; no introduzcas otra paleta o fuente por seguir una skill genérica.
- **Comprensión:** Kids más visual y cálido; Teens directo y motivador sin infantilizar. UI en español de Colombia, neutral y breve; contenido pedagógico en el idioma de la actividad. Una consigna debe indicar qué hacer; un error, cómo continuar.
- **Tacto y teclado:** controles del alumno de **48 × 48 px CSS**, salvo enlaces dentro de párrafos (SPEC-09 RF-21). Nada depende solo de hover, color o arrastre. Conserva foco visible y alternativas de toque/clic y teclado.
- **Movimiento y audio:** CSS/Tailwind; reutiliza `confetti.ts`, `sound.ts` y `speech.ts`. Respeta `prefers-reduced-motion`, el control de sonido y la ausencia de APIs. No añadas Framer Motion, Howler.js ni paquetes de gestos.
- **Feedback honesto:** respuesta visual inmediata no equivale a respuesta guardada o nota definitiva. No reveles `answer_key`, calcules notas en el cliente ni muestres rankings a alumnos; conserva estrellas de práctica y feedback según las specs.
- **Continuidad y privacidad:** contempla carga, vacío, error, sin red y sincronización pendiente sin fingir éxito. Reutiliza sesión/cola/higiene existentes; no añadas PII a logs, analítica al portal ni persistencia que sobreviva indebidamente al logout compartido.

## Fuentes por cambio

| Cambio                                    | Contrato que consultar                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| Perfil/tema                               | SPEC-02 y SPEC-05; CONTEXT §3 y §8                       |
| Navegación, consignas e intentos          | SPEC-05; `planning/architecture-overview.md` §3.1 y §3.6 |
| Mecánica y celebraciones                  | SPEC-06; decisiones 105 y 107                            |
| Estrellas, nota y visibilidad del ranking | SPEC-05, SPEC-06 y SPEC-08; decisiones 130 y 137         |
| Accesibilidad, voz, offline y tablets     | SPEC-09 RF-19–24 y §8; arquitectura §10.3                |

Resuelve los nombres completos en `specs/README.md`; consulta solo los RF afectados. Si fuentes o código discrepan, señala la discrepancia y aplica la jerarquía, sin corregir funcionalidades fuera del encargo.

## Apoyo selectivo

Carga otra skill solo si el cambio lo requiere: `frontend-design` para composición visual dentro del tema existente; `accessibility` para semántica/foco; `animate` para movimiento CSS; `web-design-guidelines` para revisión general de UI; `playwright-best-practices` para pruebas de navegador. Sus recomendaciones no pueden alterar el stack, las reglas de edad ni el alcance del piloto.

## Salida mínima

Indica **alcance y tema → hallazgo/solución con archivo y regla → comprobación observada → pendiente**. En implementación, añade la línea de riesgo exigida por el repositorio. No equipares axe, emulación táctil o lectura de código con una prueba en tablet real ni con conformidad WCAG completa.
