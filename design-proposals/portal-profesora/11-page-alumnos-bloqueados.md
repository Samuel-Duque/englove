# Plan de Implementación — Profesora: Cuentas Bloqueadas (`/alumnos/bloqueados`)

> **Alcance:** Rediseño de la bandeja de cuentas bloqueadas accesible vía `/alumnos/bloqueados` (redirección a `/alumnos?tab=locked` en `alumnos-client.tsx`) bajo **Estudio Editorial Cálido** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.5). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/alumnos/bloqueados` *(redirige a `/alumnos?tab=locked`)* |
| **Archivos objetivo** | [bloqueados/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/bloqueados/page.tsx), [alumnos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/alumnos-client.tsx) (pestaña `locked`) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [09-page-alumnos.md](./09-page-alumnos.md) |
| **Orden de implementación** | **Página 11 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-01`, `SPEC-02` (bloqueo automático 10 min tras 10 intentos fallidos consecutivos), `G-A06` |

---

## 1. Objetivo de la página y alcance

Dar visibilidad inmediata a las cuentas bloqueadas temporalmente tras 10 intentos fallidos de inicio de sesión, mostrando tiempo restante en `America/Bogota` con `tabular-nums` y un botón directo de 1 clic **`Desbloquear cuenta`** en estilo editorial limpio.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Tabla editorial `#FFFFFF` con `thead` `#F6EFE4`, badge rojo **`Bloqueada (10 min)`** (`#FDECE9` / `#831712`), tiempo restante/expiración en `tabular-nums` y botón directo **`Desbloquear cuenta`** (`#C6470B`, `min-height: 40px` escritorio / `48px` tablet).
  - Banner informativo discreto en `#FFF6E3` recordando la regla de bloqueo automático (`10 intentos fallidos → 10 minutos`) y que el desbloqueo restablece el acceso de inmediato.
- **Permanece intacto:**
  - `lockedQuery` (`/api/v1/students/locked?limit=100`), mutación de desbloqueo (`POST /api/v1/students/:id/unlock`) e invalidación de caché.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

- Badge `Bloqueada (10 min)`: `#FDECE9` / `#831712` / borde `#EABCB5` (**8,75:1 AAA**).
- Botón `Desbloquear cuenta`: `#C6470B` (hover `#A53906`), texto `#FFFFFF` (**4,88:1 AA**).
- Tabla y callout: `#FFFFFF`, `#F6EFE4`, `#FFF6E3`, borde `#E4D5C3`.
- Foco: `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`).

---

## 3. Tipografía y reglas de texto

- Encabezados `Plus Jakarta Sans 700` (`0.75rem`), celdas `0.875rem`, expiración/tiempo restante en `tabular-nums` (`America/Bogota`).

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Tabla de bloqueados** | `overflow-x: auto`; filas `min-height: 52px`, `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px` | — |
| **Botón `Desbloquear cuenta`** | **`min-height: 40px`** (`48px` tablet), `min-width: 156px`. | `padding: 8px 14px`, `border-radius: 8px` | Muestra estado `Desbloqueando…` mientras muta. |

---

## 5. Estados obligatorios y casos límite

- **Sin cuentas bloqueadas:** tarjeta `#FFFFFF` con check `#166534` (*«No hay cuentas bloqueadas en este momento.»*).
- **Error al desbloquear:** alerta `role="alert"` en `#FDECE9`.

---

## 6. Plan de implementación paso a paso

1. **Conservar [bloqueados/page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/bloqueados/page.tsx)** redirigiendo a `/alumnos?tab=locked`.
2. **Estilizar la vista `activeTab === 'locked'` en [alumnos-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/alumnos/alumnos-client.tsx)** con badge `#FDECE9`, `tabular-nums` en expiración y botón `Desbloquear cuenta` `#C6470B`.

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] `/alumnos/bloqueados` redirige a `/alumnos?tab=locked` y muestra cuentas bloqueadas con badge `#FDECE9`.
- [ ] Desbloqueo de 1 clic actualiza la lista sin recargar página.
- [ ] `0` desborde horizontal en los 3 viewports, `0` violaciones `axe-core`, `typecheck` y `lint` en verde.
