# Plan de Implementación — Profesora: Edición de Actividad (`/actividades/[id]`)

> **Alcance:** Rediseño de `/actividades/[id]` sobre la vista de detalle y edición de actividad existente, preservando estrictamente UUIDs de ítems/huecos/opciones (Decisión 140) y reflejando reglas de estado (`Publicada`, `Borrador`, `Archivada`). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/actividades/[id]` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/[id]/page.tsx), [actividad-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/[id]/actividad-detail-client.tsx), [activity-editor.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/activity-editor.tsx) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) y [03-page-actividades-nueva.md](./03-page-actividades-nueva.md) |
| **Orden de implementación** | **Página 4 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-03`, `SPEC-06`, Decisiones 95, 140 (preservación de UUIDs) |

---

## 1. Objetivo de la página y alcance

Alinear la pantalla de detalle/edición `/actividades/[id]` con el **Estudio Editorial Cálido**: migas de pan en la franja superior (`Actividades / [Título]`), badge de estado actual (`Publicada` / `Borrador` / `Archivada`), estados de carga/error editoriales en `actividad-detail-client.tsx` y reutilización directa del `ActivityEditorComponent` estilizado en el paso 3.

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - En `actividad-detail-client.tsx`: reemplazar el texto simple `Cargando actividad…` y la alerta `bg-rose-50` por esqueleto editorial `#F6EFE4` y alerta `#FDECE9` / `#B9251D` con botón `Volver al catálogo` (`/actividades`).
  - Cabecera contextual de edición dentro de `ActivityEditorComponent` cuando `initialActivity` existe: breadcrumb `Actividades / Editar`, badge oficial de estado (`#E6F5EA` / `#F6EFE4` / `#FFF1C2`), nota informativa en `#FFF6E3` si está `Publicada` recordando que los cambios aplican a nuevos inicios sin alterar entregas cerradas/calificadas, y bloqueo limpio del selector de `ActivityType` (no se muta el tipo de una actividad ya creada).
- **Permanece intacto:**
  - Query `['teacher', 'activity', id]` (`GET /api/v1/activities/${id}` con `ActivityEditorSchema`), actualización de caché `queryClient.setQueryData` y preservación exacta de UUIDs (`item.id`, `blank.id`, `option.id`) al editar `fill_blank` y `exam` (Decisión 140).

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

- Idéntica a [03-page-actividades-nueva.md](./03-page-actividades-nueva.md) más los badges de estado de [02-page-actividades.md](./02-page-actividades.md):
  - `Publicada`: `#E6F5EA` / `#166534` / borde `#B7DFC2` (**6,32:1 AA+**).
  - `Borrador`: `#F6EFE4` / `#5E3E2C` / borde `#E4D5C3` (**8,35:1 AAA**).
  - `Archivada`: `#FFF1C2` / `#543200` / borde `#E5C97B` (**10,15:1 AAA**).
  - Aviso contextual de edición / UUIDs: `#FFF6E3` / `#2B150A` / borde `#E4D5C3` (**16,09:1 AAA**).
  - Alerta error carga: `#FDECE9` / `#831712` / borde `#B9251D` (**8,75:1 AAA**).

---

## 3. Tipografía y reglas de texto

- **Breadcrumb:** `Plus Jakarta Sans 500`, `0.8125rem` (`13px`), `#5E3E2C` con enlace `#C6470B`.
- **`<h1>` título de edición:** `Bricolage Grotesque 700`, `1.625rem` (`26px`).
- **Inputs/labels/pesos:** `Plus Jakarta Sans 400–600`, `tabular-nums`, `lang="en"` en título y enunciados en inglés.

---

## 4. Anatomía y tamaño exacto de cada componente

| Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas clave |
| --- | --- | --- | --- |
| **Breadcrumb + cabecera estado** | Flex `space-between`, `min-height: 44px`, botón `← Volver a actividades` `min-height: 40px` (`48px` tablet). | `margin-bottom: 16px` | — |
| **Banner aviso de edición (`Publicada`)** | `width: 100%`, `padding: 12px 16px`, `border-radius: 10px`. | Fondo `#FFF6E3`, borde `1px solid #E4D5C3` | Explica claramente que cambios en `Publicada` mantienen consistencia de intentos ya cerrados. |
| **Cuerpo `ActivityEditorComponent`** | Hereda exactamente medidas del Paso 3 (`max-width: 1024px`, inputs `>= 42px` / `48px` tablet, pie sticky `44–48px`). | Tarjetas `#FFFFFF`, `1px solid #E4D5C3`, `12px` radio | Botón primario cambia a **`Guardar cambios`** (`#C6470B`) + opción **`Publicar actividad`** si estaba en `draft`. |

---

## 5. Estados obligatorios y casos límite

- **Carga (`isLoading`):** esqueleto editorial `#F6EFE4` de cabecera (`64px`) + 2 tarjetas (`220px`).
- **Error / `404` (`error || !activity`):** banner `#FDECE9` con borde `#B9251D`, `role="alert"` y enlace `Volver al catálogo` (`/actividades`, `min-height: 44px`).
- **Actividad archivada:** muestra banner `#FFF1C2` indicando que está archivada y enlace rápido para restaurar desde el catálogo o guardar cambios en modo archivado según soporte del backend.

---

## 6. Plan de implementación paso a paso

1. **Actualizar [actividad-detail-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/[id]/actividad-detail-client.tsx):**
   - Reemplazar estado de carga por esqueleto editorial `#F6EFE4` y estado de error por tarjeta `#FDECE9` con botón `Volver al catálogo` (`#C6470B`).
   - Añadir navegación de breadcrumb superior `Actividades / Detalle y edición`.
2. **Verificar en [activity-editor.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/actividades/activity-editor.tsx)** la vista cuando `initialActivity` está presente (badge de estado, tipo bloqueado en lectura y preservación intacta de UUIDs en `PATCH /api/v1/activities/:id`).

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`), `accessibility`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Estados de carga y error en `actividad-detail-client.tsx` alineados con paleta `#FCF9F2` / `#F6EFE4` / `#FDECE9`.
- [ ] Al editar ítems/huecos/opciones de `fill_blank` o `exam`, se conservan los UUIDs existentes (Decisión 140).
- [ ] Breadcrumb, badge de estado y pie de guardado visibles y accesibles en `1440×900`, `1280×800` y `820×1080`.
- [ ] Pasa `typecheck`, `lint`, `axe-core` y `check-guardrails.mjs`.
