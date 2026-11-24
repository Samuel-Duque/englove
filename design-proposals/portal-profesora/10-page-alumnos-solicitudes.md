# Plan de Implementación — Profesora: Solicitudes de Registro (`/alumnos/solicitudes`)

> **Alcance:** Rediseño del flujo de aprobación y rechazo de cuentas `pending_approval` accesible vía `/alumnos/solicitudes` (redirección a `/alumnos?tab=requests` en `alumnos-client.tsx`) bajo **Estudio Editorial Cálido** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/alumnos/solicitudes` *(redirige a `/alumnos?tab=requests`)* |
| **Archivos objetivo** | [solicitudes/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/solicitudes/page.tsx), [alumnos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/alumnos-client.tsx) (pestaña `requests` + modal aprobación) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [09-page-alumnos.md](./09-page-alumnos.md) |
| **Orden de implementación** | **Página 10 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-01`, `SPEC-02`, Decisiones 33, 35 (`guardian_name`/`guardian_contact` en `Student`), 73 (único grupo activo obligatorio) |

---

## 1. Objetivo de la página y alcance

Facilitar a la profesora revisar cada solicitud `pending_approval` (nombre, correo, fecha de nacimiento/segmento y contacto del acudiente), aprobarla asignando **Nivel MCER (`A1–B2`)** y **un único grupo activo obligatorio**, o rechazarla con confirmación clara, todo dentro del estilo editorial cálido.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - **Tabla de solicitudes:** filas `#FFFFFF`, `thead` `#F6EFE4`, badge `Pendiente de aprobación` en `#FFF1C2` / `#543200`, botones de fila **`Aprobar`** (`#C6470B`) y **`Rechazar`** (`#FFFFFF` borde `#B9251D` texto `#831712`).
  - **Modal de aprobación (`AccessibleModal` Nivel 2):** inputs/selects con borde `#9A7B5C` para confirmar/corregir `guardianName` y `guardianContact` (datos de `Student`), seleccionar **Nivel MCER (`A1–B2`)**, **Segmento (`Kids`/`Teens`)** y **Grupo inicial único obligatorio**, más nota informativa en `#FFF6E3` indicando que al aprobar se enviará el correo de bienvenida al alumno.
  - **Diálogo de rechazo (`ConfirmDialog`):** botón destructivo `#B9251D` explicando que elimina la solicitud pendiente sin dejar usuario activo.
- **Permanece intacto:**
  - `requestsQuery` (`/api/v1/students/requests?limit=100`), mutaciones de aprobar (`POST /api/v1/students/:id/approve`) y rechazar (`POST /api/v1/students/:id/reject`), invalidación de `['teacher', 'students']` y `['teacher', 'reminders']`.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

- Badge `Pendiente de aprobación`: `#FFF1C2` / `#543200` / borde `#E5C97B` (**10,15:1 AAA**).
- Botón `Aprobar` / `Confirmar aprobación`: `#C6470B` (hover `#A53906`), texto `#FFFFFF` (**4,88:1 AA**).
- Botón `Rechazar` / confirmar rechazo: borde `#B9251D`, texto `#831712` (primario diálogo `#B9251D` texto `#FFFFFF`, **6,28:1 AA+**).
- Inputs y selects del modal: borde `1px solid #9A7B5C` (**3,92:1 AA UI**), foco `#1D4ED8`.

---

## 3. Tipografía y reglas de texto

- Títulos y columnas con `Plus Jakarta Sans 500–700`; fechas de nacimiento/solicitud en `America/Bogota` con `tabular-nums`.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Tabla de solicitudes** | `overflow-x: auto`; filas `min-height: 54px`; botones `Aprobar` y `Rechazar` **`min-height: 40px`** (`48px` tablet). | `border: 1px solid #E4D5C3`, `border-radius: 12px` | — |
| **Modal de aprobación** | `max-width: 540px`, `padding: 24px`; selects/inputs **`min-height: 44px`** (`48px` tablet). | `border: 1px solid #CBB499`, `border-radius: 14px` | Botón confirmar deshabilitado hasta elegir un grupo activo. |

---

## 5. Estados obligatorios y casos límite

- **Sin solicitudes pendientes:** tarjeta `#FFFFFF` con check `#166534` (*«No hay solicitudes pendientes de aprobación.»*).
- **Sin grupos activos creados:** aviso `#FFF1C2` dentro del modal enlazando a `/grupos` para crear primero el grupo obligatorio.
- **Error de red o validación:** alerta `role="alert"` en `#FDECE9`.

---

## 6. Plan de implementación paso a paso

1. **Conservar [solicitudes/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/solicitudes/page.tsx)** redirigiendo a `/alumnos?tab=requests`.
2. **Estilizar la vista `activeTab === 'requests'` y los modales de aprobación/rechazo en [alumnos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/alumnos-client.tsx)** usando la paleta editorial cálida, controles `#9A7B5C`, botones `>= 44–48px` y sin menciones a entidad `Guardian`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`G-C05`, `check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] `/alumnos/solicitudes` redirige a `/alumnos?tab=requests` y abre directamente la bandeja estilizada.
- [ ] Modal exige nivel MCER y un único grupo activo antes de aprobar.
- [ ] Cero referencias a entidad `Guardian` o consentimientos legales.
- [ ] `0` desborde horizontal en los 3 viewports, `0` violaciones `axe-core`, `typecheck` y `lint` en verde.
