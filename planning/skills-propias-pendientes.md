# Englove — Skills propias pendientes de crear

> Estado: **ideas aprobadas, todavía NO creadas** (decisión del equipo: se crearán más adelante).
> Origen: análisis de skills del proyecto (octubre 2026). No se encontró ninguna skill pública confiable para este dominio, por eso se proponen propias.
> Herramienta recomendada para crearlas: la skill `skill-creator` (ya instalada en `.agents/skills/`).

## Cuándo crearlas

| Skill propia | Prioridad | Momento recomendado |
|---|---|---|
| `englove-spec` | alta | Antes de redactar las specs `SPEC-00` a `SPEC-10` (Etapa 0 / inicio de Etapa 1) |
| `englove-guardrails` | alta | Antes de escribir el primer código de producción |
| `englove-activity-type` | media | Cuando exista `packages/shared` y la primera actividad implementada |
| `englove-kids-ux` | media | Cuando empiece el frontend (tokens de tema Kids/Teens) |
| `englove-cefr-content` | baja | Cuando se necesiten seeds de contenido (incongruencia #16: seeds de datos operativos) |

## Convenciones al crearlas

- Carpeta: `.agents/skills/<nombre>/SKILL.md` (los enlaces de `.claude/skills` y `.kiro/skills` los crea el CLI de skills).
- Instrucciones de las skills en español (igual que la documentación del proyecto); identificadores de código en inglés.
- Las skills deben **referenciar** `.agents/CONTEXT.md` y `planning/` en vez de copiar su contenido, para que no se desactualicen.
- Mantener el `description` del frontmatter muy concreto (cuándo usarla), para que el agente la active en el momento correcto.

---

## 1. `englove-spec`

**Qué haría:** redactar o revisar una especificación `SPEC-NN` siguiendo el proceso SDD del proyecto.

**Fuentes que debe leer:**
- `planning/sdd-process.md` §5 (plantilla de 12 secciones), §6 (ciclo de vida), §9 (reglas para agentes) y §10 (anti-patrones).
- `.agents/CONTEXT.md` §14 (decisiones 1–80) y §2.4 (fuera de alcance del piloto).

**Comportamiento esperado:**
1. Crear el archivo con las 12 secciones de la plantilla: contexto y objetivo, alcance, requisitos funcionales, reglas de negocio, contrato de API, modelo de datos, interfaz, seguridad y privacidad, pruebas, fuera de alcance, preguntas abiertas, registro de cambios.
2. Validar que no contradiga ninguna decisión de §14 ni incluya algo del fuera de alcance del piloto.
3. Señalar preguntas abiertas (P-1 a P-5 de §15) que afecten a la spec.
4. Mantener la jerarquía de autoridad: CONTEXT → architecture-overview → sdd-process → pbp-development → taskboard → specs → código.
5. Recordar que no se escribe código de producción sin spec aprobada.

**Relación con otras skills:** complementa a `grill-with-docs` (entrevista previa) y a `code-review` (verificar contra la spec).

---

## 2. `englove-guardrails`

**Qué haría:** lista de verificación de las reglas invariantes del proyecto (CONTEXT.md §16). Se usaría junto con `code-review` y `security-review` antes de cerrar cambios.

**Reglas que debe comprobar:**
- Toda consulta filtra por `organization_id`.
- La calificación se calcula **siempre en el servidor**, en escala 0.0–5.0.
- Los timestamps los pone el servidor; nunca se aceptan del cliente.
- No reintroducir `Guardian`, `ConsentRecord` ni Supabase Storage (los archivos van a Cloudflare R2).
- Supabase solo como Postgres: sin Auth, Realtime, RLS ni Storage.
- `prisma db push` prohibido fuera de local; migraciones con Prisma Migrate.
- Identificadores de código en inglés; documentos y textos de UI en español.
- No construir nada de la lista fuera de alcance del piloto (§2.4).
- Zona horaria America/Bogota y escala colombiana en el piloto.

**Salida esperada:** informe breve de cumplimiento/incumplimiento con archivo y línea.

---

## 3. `englove-activity-type`

**Qué haría:** guiar el recorrido completo para añadir o modificar un tipo de actividad o una mecánica de juego.

**Contexto del dominio:**
- Tipos: `fill_blank`, `open_question`, `speaking`, `game`, `exam`.
- Mecánicas de `game`: `match`, `order_words`, `drag_drop`, `memory`, `timed_choice`.
- Modelo: `Activity` (plantilla) → `Assignment` (a un grupo) → `Attempt` (intento del alumno).
- Cada tipo tiene tabla de detalle 1:1, con `config` y `answer_key` en columnas separadas.

**Pasos que debe cubrir:**
1. Esquema Zod en `packages/shared` (el `answer_key` nunca llega al cliente del alumno).
2. Tabla de detalle en Prisma + migración.
3. DTO, servicio y cálculo de nota en NestJS (nota 0.0–5.0, en servidor).
4. Componente de actividad para los temas Kids y Teens.
5. Revisión del profesor (cola de revisión, comentarios, stickers) si aplica.
6. Seeds de prueba y tests (unitarios, integración y, si aplica, E2E).
7. Actualizar el contrato de API en la spec correspondiente.

---

## 4. `englove-kids-ux`

**Qué haría:** reglas de diseño y UX para los dos temas del producto.

**Cubre:**
- Tokens de diseño por tema (`data-theme="kids"` / `"teens"`) y cómo se cargan los bundles de animación por separado.
- Reglas por edad: Kids (7–10) bloqueado en su interfaz; Teens (11+) puede alternar.
- Zonas táctiles grandes, nivel de lectura, mensajes breves, retroalimentación positiva.
- Celebraciones (`canvas-confetti`), sonido (Howler.js), animación (Framer Motion) y respeto de `prefers-reduced-motion`.
- Contraste AA (se verifica con axe en la CI).
- Voz sintética con Web Speech API (`en-US` y `es-CO`).
- Textos de UI en español de Colombia, tono cercano.

**Se apoya en:** `frontend-design`, `accessibility`, `animate`, y `web-design-guidelines` (ya instaladas).

---

## 5. `englove-cefr-content`

**Qué haría:** generar contenido de actividades alineado a los niveles A1, A2, B1 y B2 del MCER, apropiado para niños de 7 a 14 años.

**Detalles:**
- La salida debe ser JSON válido según los esquemas Zod de `packages/shared`.
- Vocabulario y estructuras acordes al nivel y a la edad; temas cotidianos.
- Útil para los seeds de testing (incongruencia #16 de `planning/incongruencias-y-decisiones-definitivas.md`).
- No sustituye a la profesora: el contenido real del piloto lo carga ella.
- Dejar claro que el proyecto no usa APIs de IA en el producto; esto es solo una ayuda de desarrollo para datos de prueba.

---

## Ideas descartadas por ahora

- **Skill para el pipeline de audio (MediaRecorder → R2 → ffmpeg):** no se encontró nada público; la spec correspondiente cubre el flujo. Reconsiderar si el pipeline causa errores repetidos.
- **Skills de fase 2:** Phaser (juegos) y Capacitor (apps móviles). Existen skills públicas (`phaserjs/phaser`, `capawesome-team/skills`) que habría que evaluar cuando esa fase empiece.
