# Plan de Implementación — Profesora: Ficha del Estudiante (`/alumnos/[id]`)

> **Alcance:** Rediseño de `/alumnos/[id]` en **Estudio Editorial Cálido**, cubriendo edición de datos personales/acudiente (`Student`), traslado de grupo con advertencia crítica `UNCONSUMED_RETRY_WARNING`, soporte de recuperación/cambio administrativo de correo y zona de peligro de baja definitiva (`ELIMINAR`) ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §4.7 y §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/alumnos/[id]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/[id]/page.tsx), [alumno-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/[id]/alumno-detail-client.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [09-page-alumnos.md](./09-page-alumnos.md) |
| **Orden de implementación** | **Página 12 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-01`, `SPEC-02`, Decisiones 35, 63, 73, 92 (`AuditLog`), 103 (baja definitiva), 131 y 144 (pérdida de reintentos al trasladar) |

---

## 1. Objetivo de la página y alcance

Estructurar la ficha integral del alumno en 4 bloques limpios y bien diferenciados visualmente, protegiendo las acciones irreversibles con **diálogos críticos claros** (`Nivel 2`, borde `#CBB499`) y garantizando cero menciones a entidad `Guardian` o contraseñas temporales.

### Qué cambia vs. qué permanece intacto

- **Cambia (jerarquía visual, tarjetas editoriales y diálogos críticos):**
  - **Cabecera con breadcrumb:** `Alumnos / [Nombre del estudiante]`, badges `Nivel MCER` y `Segmento` (`Kids`/`Teens`), más acceso directo **`Ver estadísticas →`** (`/estadisticas/estudiantes/[id]`).
  - **Bloque 1 — Datos personales, nivel y acudiente (solo editables por profesora):** tarjeta `#FFFFFF` (`border: 1px solid #E4D5C3`); campos `Nombre`, `Fecha de nacimiento`, `Nivel MCER` y `guardianName` / `guardianContact` con bordes `#9A7B5C` en modo edición.
  - **Bloque 2 — Membresía de grupo y traslado:** selector del único grupo activo + historial de membresías (`joined_at` / `left_at` en `America/Bogota`, `tabular-nums`). Si `PUT /api/v1/students/:id/group` dispara `UNCONSUMED_RETRY_WARNING`, abre el diálogo crítico mostrando `affectedActivities` y advirtiendo la revocación irreversible de reintentos incluso si vuelve luego al grupo anterior (`confirmLostRetries: true`).
  - **Bloque 3 — Seguridad y soporte de acceso:** botón **`Enviar enlace de recuperación de contraseña`** (con `ConfirmDialog`, nunca contraseñas temporales) y botón **`Cambiar correo de acceso`** abriendo modal con correo actual (solo lectura), input de nuevo correo (`EMAIL_TAKEN` validado) y **casilla obligatoria desmarcada por defecto**: *«Confirmo que verifiqué la identidad del alumno fuera de la plataforma.»* + nota explícita de revocación de sesiones, correos de aviso y registro en `AuditLog`.
  - **Bloque 4 — Zona de peligro separada:** tarjeta con borde **`1px solid #EABCB5`** y fondo **`#FDECE9`**, botón **`Dar de baja al estudiante`** (`#B9251D`) que abre el modal enumerando los 4 efectos atómicos (congelación de `historical_student_count`, redacción en `AuditLog`, borrado en R2 y cascada completa) y exige escribir exactamente **`ELIMINAR`**.
- **Permanece intacto:**
  - `studentQuery`, `membershipsQuery`, `groupsQuery`, todas las mutaciones de perfil, traslado (`retryWarningSchema`), reset password, cambio de correo y baja definitiva (`deleteConfirmText === 'ELIMINAR'`).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Tarjetas Bloques 1, 2 y 3** | `--surface-card` / `--border-hairline` | `#FFFFFF`, borde `1px solid #E4D5C3` | `#2B150A`: **17,29:1 (AAA)** |
| **Zona de peligro (Bloque 4) y alertas** | `--accent-danger-soft` / `--accent-danger` | `#FDECE9`, borde `#EABCB5`, texto `#831712` | **8,75:1 (AAA)** |
| **Botones destructivos (`Confirmar baja` / `Traslado definitivo`)** | `--accent-danger` / `-hover` | `#B9251D` / `#991D16` (texto `#FFFFFF`) | **6,28:1 (AA+)** |
| **Botón primario editar/guardar/trasladar** | `--accent-primary` / `-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,88:1 (AA)** |
| **Inputs / Selects / Checkboxes** | `--border-control` | `#FFFFFF`, borde `1px solid #9A7B5C` | **3,92:1 (AA UI)** |
| **Aviso de traslado sin pérdida** | `--surface-callout` | `#FFF6E3`, borde `#E4D5C3`, texto `#2B150A` | **16,09:1 (AAA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` nombre del estudiante:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **`<h2>` de los 4 bloques:** `Bricolage Grotesque 600`, `1.125rem` (`18px`).
- **Fechas de membresías (`joined_at` / `left_at`):** `Plus Jakarta Sans 500–600`, `tabular-nums`, zona `America/Bogota`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Grid principal ficha** | `>= 1280px`: `grid-template-columns: 1.2fr 0.8fr` (`gap: 20px`) o bloques apilados con `max-width: 1040px`. Tablet (`820px`): `1 columna`. | — | — |
| **Tarjetas de bloque** | `padding: 20px 24px`, `border-radius: 12px`, `box-shadow: 0 1px 3px rgba(43,21,10,0.06)`. | — | — |
| **Inputs / selects / botones acción** | **`min-height: 42px`** (`48px` en tablet y en acciones críticas de modales); ancho completo en tablet/móvil. | `border-radius: 8–10px` | — |
| **Modales críticos (`UNCONSUMED_RETRY_WARNING`, cambio correo, baja `ELIMINAR`)** | `max-width: 540px`, `padding: 24px`, `border: 1px solid #CBB499`, `border-radius: 14px`. | Botones **`min-height: 44px`** (`48px` tablet) | Botón confirmar deshabilitado hasta cumplir casilla de identidad o palabra `ELIMINAR`. |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F6EFE4` para 4 tarjetas.
- **Error / `404`:** banner `#FDECE9` con enlace `Volver a alumnos` (`/alumnos`).
- **Conflicto `EMAIL_TAKEN` o `UNCONSUMED_RETRY_WARNING`:** mensajes claros en `#FDECE9` / modal crítico con listado exacto de `affectedActivities`.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [alumno-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/[id]/alumno-detail-client.tsx):**
   - Añadir breadcrumb `Alumnos / [Nombre]` y enlace rápido a `/estadisticas/estudiantes/${id}`.
   - Estilizar los 4 bloques con `Nivel 1` (`#FFFFFF`, `#E4D5C3`) y la **Zona de peligro** en `#FDECE9` / `#EABCB5`.
   - Homologar controles con borde `#9A7B5C`, tabla de historial de membresías en `#F6EFE4`/`#FFFFFF` (`tabular-nums`), y los 3 diálogos críticos (`UNCONSUMED_RETRY_WARNING`, `Cambiar correo`, `ELIMINAR`) según §4.7 de `teacher-portal-diseno.md`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C05` sin entidad `Guardian`, Decisiones 63, 92, 103, 131, 144, `check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Diálogo de traslado con `UNCONSUMED_RETRY_WARNING` lista `affectedActivities` y advierte revocación definitiva.
- [ ] Diálogo de cambio de correo exige casilla de verificación desmarcada por defecto y muestra efectos de seguridad.
- [ ] Zona de peligro separada en `#FDECE9` exige escribir exactamente `ELIMINAR` antes de habilitar baja definitiva.
- [ ] Cero referencias a entidad `Guardian`; `0` desborde horizontal en los 3 viewports; `typecheck`, `lint` y `axe-core` en verde.
