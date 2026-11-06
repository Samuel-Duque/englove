# RFC-01: Soporte de Múltiples Preguntas / Ítems por Actividad (Mejora de Producto)

- **Fecha:** 2026-11-06
- **Módulo:** `/actividades/nueva`, `/actividades/[id]`, `/actividad/[attemptId]`, `/revision`, `packages/shared/src/activities`
- **Tipo:** Solicitud de Mejora de Producto / Evolución de Diseño
- **Estado:** ✅ Implementado y Verificado (2026-11-06)

---

## 1. Descripción de la Solicitud
El usuario planteó:
> *"Me gustaría que varias actividades puedan tener más de una adentro de ellas como en pregunta abierta hacer varias preguntas abiertas, diría que para todas menos para expresión oral; en algunas esta opción ya está puesta."*

### Análisis del estado previo por tipo de actividad:
1. **Completar espacios (`fill_blank`):** Ya soportaba múltiples oraciones e ítems en un array (`items: [{ id, prompt, blanks }]`).
2. **Examen (`exam`):** Ya soportaba múltiples preguntas ponderadas (`items: [...]`).
3. **Microjuegos (`game`):** Todas las mecánicas ya operaban sobre colecciones de palabras, pares, categorías o preguntas.
4. **Pregunta Abierta (`open_question`):** Era la **única actividad textual monorigurosa (1 sola pregunta)**, obligando a los docentes a crear múltiples actividades independientes para cuestionarios breves.
5. **Expresión Oral (`speaking`):** Se mantiene de **1 sola grabación por actividad** según lo solicitado por el usuario y la arquitectura de Cloudflare R2 / transcodificación ffmpeg (1 asset por intento).

---

## 2. Solución Arquitectónica Implementada

Se implementó el soporte completo de **Preguntas Abiertas Multi-Ítem** manteniendo **100% de retrocompatibilidad** con las actividades clásicas existentes:

### 2.1 Contratos en `@englove/shared` (`packages/shared/src/activities/open-question.ts`)
- **`OpenQuestionItemSchema`:** Esquema Zod para cada pregunta individual: `{ id: UUID, prompt: string, rubric?: string, maxLength: number }`.
- **`OpenQuestionConfigSchema`:** Admite tanto el formato monoriguroso clásico `{ prompt, rubric?, maxLength? }` como el nuevo formato multi-pregunta:
  ```typescript
  {
    instructions?: string,
    items: Array<OpenQuestionItem>, // 1 a 50 preguntas
  }
  ```
- **`OpenQuestionAnswersSchema`:** Admite respuestas `{ text: string }` y mapas `{ [itemId]: string }` o `{ items: Record<string, string> }`.
- **`getOpenQuestionItems(config, fallbackId)`:** Helper exportado que normaliza de forma transparente cualquier configuración a un array homogéneo `OpenQuestionItem[]`.
- **Duraciones automáticas (`durations.ts`):** `expectedDurationSeconds = 180 * items.length` y `minPlausibleSeconds = 3 * items.length`.

### 2.2 Backend (`apps/api/src/reviews/reviews.service.ts`)
- En `getReviewDetail`:
  - Detecta si `open_question` incluye `config.items`.
  - Agrega cada pregunta como un ítem individual con su `id`, `prompt` y `rubricText`.
  - Desenrolla las respuestas de cada ítem desde `attempt.payload.answers` para que la docente visualice todas las respuestas del estudiante en una única pantalla de revisión.

### 2.3 Frontend Docente — Editor de Actividades (`apps/web/src/app/(teacher)/actividades/activity-editor.tsx`)
- Se rediseñó el panel de edición de `Pregunta abierta`:
  - Campo opcional de **Instrucciones generales** (ej. *"Responde en inglés con oraciones completas"*).
  - Lista interactiva de preguntas con botón **"+ Agregar otra pregunta"**.
  - Cada pregunta cuenta con su consigna, rúbrica de evaluación, límite de caracteres y botón para eliminar (preservando al menos una).
  - Previsualización interactiva en tiempo real con todas las preguntas y áreas de texto simuladas.

### 2.4 Frontend Alumno — Runner de Actividades (`apps/web/src/app/(student)/actividad/[attemptId]/actividad-runner.tsx`)
- Renderizado adaptativo:
  - Si la actividad tiene instrucciones generales, se muestran en una tarjeta destacada superior.
  - Itera sobre las preguntas abiertas renderizando una sección por cada una con:
    - Encabezado numerado (`Pregunta 1`, `Pregunta 2`, etc.).
    - Consigna clara con botón de lectura en voz alta (**TTS**).
    - Área de texto independiente (`textarea`) conectada reactivamente a `answers[item.id]`.
    - Contador de caracteres en tiempo real respecto al límite configurado.
  - Guarda automáticamente los cambios por ítem y puentea `answers['text']` para compatibilidad con vistas previas.

---

## 3. Verificación Automatizada

- **Pruebas en `@englove/shared` (`packages/shared/test/activities.spec.ts`):**
  - Validación de configuración multi-ítem con 2 preguntas UUID.
  - Verificación de normalización idéntica entre formatos monoriguroso y multi-ítem vía `getOpenQuestionItems`.
- **Pruebas en `@englove/api` (`apps/api/test/reviews.spec.ts`):**
  - Verificación de extracción de múltiples preguntas y mapeo de respuestas individuales en el detalle de revisión docente.
- **Pruebas en `@englove/web` (`apps/web/test/reviews-ui.spec.ts`):**
  - Verificación de resolución de respuestas mapeadas por `item.id`.
- **Guardrails y SDD:**
  - `check-guardrails.mjs`: 0 errores, 0 avisos.
  - `check-spec.mjs specs/SPEC-03-gestor-de-contenidos.md`: 0 errores.
  - `pnpm test` monorepo completo: 100% pasando (65 shared, 337 api, 142 web).
