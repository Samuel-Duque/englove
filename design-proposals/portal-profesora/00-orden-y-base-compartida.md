# Panel Docente (`role === 'teacher'`) — Orden Paulatino y Base Compartida

> **Alcance:** Arquitectura visual **Estudio Editorial Cálido** ([teacher-portal-diseno.md](../teacher-portal-diseno.md)) y hoja de ruta ordenada de las 17 páginas del **Panel Docente** de **Upward English**. Este documento es un plan de implementación; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ámbito** | Rutas `(teacher)/*` y rama `teacher` de `/inicio` |
| **Archivos base objetivo** | [layout.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/layout.tsx), [globals.css](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/globals.css), [(teacher)/layout.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/(teacher)/layout.tsx), [teacher-nav.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/teacher-nav.tsx), [brand-emblem.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/landing/brand-emblem.tsx), [modal.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/ui/modal.tsx), [error-state.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/error-state.tsx), [offline-status-banner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/offline-status-banner.tsx), [pwa-update-banner.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/components/pwa-update-banner.tsx) |
| **Fuente de diseño** | [teacher-portal-diseno.md](../teacher-portal-diseno.md) §1–§4 y §6 |
| **Specs / Guardrails** | `CONTEXT.md` §2.4, §5.1, §14, §16 · `SPEC-01`–`SPEC-11` · `G-A05`..`G-C13` |

---

## 1. Orden paulatino recomendado de implementación (Page por Page)

| Paso | Plan | Ruta real | Por qué en este orden |
| --- | --- | --- | --- |
| **Paso 0** | **Este documento (`00-orden-y-base-compartida.md`)** | Shell + Tokens + Catálogo compartido | Añade peso `400` a `Plus_Jakarta_Sans`, instala `TeacherShell` (barra lateral + top utility bar), tokens editoriales, tablas, badges y diálogos críticos. |
| **Paso 1** | [01-page-inicio.md](./01-page-inicio.md) | `/inicio` (rama docente) | Tablero diario con recordatorios prioritarios, resumen de grupos activos y accesos rápidos. |
| **Paso 2** | [02-page-actividades.md](./02-page-actividades.md) | `/actividades` (+ alias `/contenidos`) | Catálogo MCER (A1–B2), filtros de estado/tipo/nivel y tabla editorial. |
| **Paso 3** | [03-page-actividades-nueva.md](./03-page-actividades-nueva.md) | `/actividades/nueva` (+ alias `/contenidos/onboarding`) | Creación guiada `< 10 min` sin JSON crudo para los 5 `ActivityType`. |
| **Paso 4** | [04-page-actividades-detalle.md](./04-page-actividades-detalle.md) | `/actividades/[id]` | Edición segura preservando UUIDs de ítems/blanks/opciones y preview de microjuegos. |
| **Paso 5** | [05-page-asignaciones.md](./05-page-asignaciones.md) | `/asignaciones` | Listado con callout de exclusión de `game`, filtros y cumplimiento `tabular-nums`. |
| **Paso 6** | [06-page-asignaciones-nueva.md](./06-page-asignaciones-nueva.md) | `/asignaciones/nueva` | Programación multigrupo con filtro exclusivo de 4 tipos asignables y error `ASSIGNMENT_ALREADY_ACTIVE`. |
| **Paso 7** | [07-page-asignaciones-detalle.md](./07-page-asignaciones-detalle.md) | `/asignaciones/[id]` | Seguimiento por estudiante y diálogo crítico de cancelación definitiva. |
| **Paso 8** | [08-page-revision.md](./08-page-revision.md) | `/revision` | **Vista insignia split-view (`42%/58%`)** con reproductor Speaking + retención 30 d, 3/6 stickers, nota `0,0–5,0` inmutable y reintento. |
| **Paso 9** | [09-page-alumnos.md](./09-page-alumnos.md) | `/alumnos` | Sub-pestañas unificadas, directorio activo sin botón «Crear alumno» y contadores de acción. |
| **Paso 10** | [10-page-alumnos-solicitudes.md](./10-page-alumnos-solicitudes.md) | `/alumnos/solicitudes` | Bandeja `pending_approval` con modal de aprobación (acudiente + nivel MCER + grupo único). |
| **Paso 11** | [11-page-alumnos-bloqueados.md](./11-page-alumnos-bloqueados.md) | `/alumnos/bloqueados` | Cuentas bloqueadas 10 min tras 10 fallos y desbloqueo directo de 1 clic. |
| **Paso 12** | [12-page-alumnos-detalle.md](./12-page-alumnos-detalle.md) | `/alumnos/[id]` | Ficha integral, traslado con `UNCONSUMED_RETRY_WARNING`, cambio administrativo de correo y baja `ELIMINAR`. |
| **Paso 13** | [13-page-grupos.md](./13-page-grupos.md) | `/grupos` | Creación/renombrado, archivo seguro (`GROUP_HAS_ACTIVE_STUDENTS`) y conteo vigente. |
| **Paso 14** | [14-page-grupos-detalle.md](./14-page-grupos-detalle.md) | `/grupos/[id]` | Miembros vigentes, asignaciones del grupo y acceso rápido a estadísticas. |
| **Paso 15** | [15-page-estadisticas.md](./15-page-estadisticas.md) | `/estadisticas` | Polling 30 s, Vista General, Por Grupo + gráfico SVG, Práctica en juegos y Rankings privados confidenciales. |
| **Paso 16** | [16-page-estadisticas-estudiante.md](./16-page-estadisticas-estudiante.md) | `/estadisticas/estudiantes/[id]` | Eje rendimiento, constancia 12 semanas ISO, `offline_sync` y práctica en juegos. |
| **Paso 17** | [17-page-contenido-extra.md](./17-page-contenido-extra.md) | `/contenido-extra` | Toggle `extra_content`, cupo `X / 200`, filtros MCER y reordenamiento atómico `Subir ↑ / Bajar ↓`. |

---

## 2. Sistema de tokens del Panel Docente (`[data-theme="teacher"]` / scope docente)

| Token CSS | Nombre visual | Hex | Contraste verificado |
| --- | --- | --- | --- |
| `--bg-canvas` | Marfil Pergamino | `#FCF9F2` | Lienzo limpio (cero puntos ni costuras) |
| `--surface-card` | Papel Blanco | `#FFFFFF` | Base de tarjetas, tablas, inspector y modales |
| `--surface-subtle` | Lino Cálido | `#F6EFE4` | Barra lateral, `thead`, barra filtros (`#2B150A`: **15,14:1 AAA**) |
| `--surface-callout` | Pergamino Nota | `#FFF6E3` | Callouts informativos y confidencialidad (**16,09:1 AAA**) |
| `--ink-primary` | Tinta Corteza | `#2B150A` | Títulos, KPIs, datos principales (**17,29:1** blanco · **16,45:1** lienzo) |
| `--ink-secondary` | Tinta Nogal | `#5E3E2C` | Subtítulos, labels, metadatos (**9,54:1** blanco · **8,35:1** `#F6EFE4`) |
| `--ink-muted` | Tinta Canela | `#61361F` | Pies de nota, timestamps (**10,22:1** blanco) |
| `--border-hairline` | Borde Pergamino | `#E4D5C3` | Divisores `1px` de tarjetas, filas y secciones |
| `--border-strong` | Borde Arena | `#CBB499` | Contenedores Nivel 2 y hover secundario |
| `--border-control` | Borde Control AA | `#9A7B5C` | Inputs, `<select>`, `<textarea>`, checkboxes (**3,92:1 AA UI**) |
| `--border-brand` | Borde Corteza | `#4A2511` | Borde del emblema `1.5px` (**12,77:1 AAA**) |
| `--accent-primary` / `-hover` | Naranja Zorro | `#C6470B` / `#A53906` | CTA primario, navegación activa (**4,88:1 AA** / **6,59:1 AA+**) |
| `--accent-primary-soft` | Terracota Suave | `#FFF0DE` (texto `#872E06`) | Fondo de ítem activo / selección (**7,74:1 AAA**) |
| `--accent-danger` / `-hover` | Rojo Brújula | `#B9251D` / `#991D16` | Pendientes urgentes, alertas, acciones destructivas (**6,28:1 AA+**) |
| `--accent-danger-soft` | Carmín Suave | `#FDECE9` (texto `#831712`) | Errores, entregas atrasadas, bloqueos (**8,75:1 AAA**) |
| `--accent-warm` / `-soft` | Amarillo Campamento | `#FFCA3A` / `#FFF1C2` (texto `#543200`) | Emblema, etiquetas recordatorio (**11,33:1** / **10,15:1 AAA**) |
| `--status-ok-ink` / `-bg` | Verde Académico | `#166534` / `#E6F5EA` | Aprobados, publicadas, calificadas (**6,32:1 AA+**) |
| `--focus-ring` | Azul Foco Seguro | `#1D4ED8` | `outline: 3px solid #1D4ED8; outline-offset: 2px` (**5,87–6,70:1**) |

---

## 3. Tipografía, elevación laminar y precisión numérica

- **Cambio obligatorio en [layout.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/layout.tsx):** agregar peso `'400'` a `Plus_Jakarta_Sans` (`weight: ['400', '500', '600', '700', '800']`) para cuerpos, tablas densas y formularios del Panel Docente.
- **Títulos (`--font-upward-display`, `Bricolage Grotesque` `600`/`700`):** `H1`: `1.625rem` (`26px`) · `H2`: `1.1875rem` (`19px`) · `H3`: `1rem` (`16px`) · Marca: `1.125rem` (`18px`), `letter-spacing: -0.015em`, `line-height: 1.2`.
- **Cuerpo / UI (`--font-upward-ui`, `Plus Jakarta Sans` `400–700`):** cuerpo `0.9375rem` (`15px`), tablas/inputs `0.875rem` (`14px`, `16px` en tablet táctil si aplica), badges `0.75–0.8125rem` (`12–13px`).
- **`tabular-nums` obligatorio** en notas `0,0–5,0` (coma decimal), conteos, duraciones (`mm:ss`), porcentajes, fechas (`America/Bogota`) y puestos privados.
- **Elevación laminar (sin sombras cómic):**
  - Nivel 0: `#F6EFE4`, `1px solid #E4D5C3`, `box-shadow: none`.
  - Nivel 1: `#FFFFFF`, `1px solid #E4D5C3`, `border-radius: 12px`, `box-shadow: 0 1px 3px rgba(43, 21, 10, 0.06)`.
  - Nivel 2: `#FFFFFF`, `1px solid #CBB499`, `border-radius: 14px`, `box-shadow: 0 6px 20px rgba(43, 21, 10, 0.08)`.

---

## 4. Shell Docente (`TeacherShell` + `TeacherNav`) y catálogo compartido

| Componente | Dimensiones (`>= 1280px` / `1024–1279px` / `768–1023px`) | Detalles y correcciones sobre código actual |
| --- | --- | --- |
| **`TeacherShell` compartida** (`(teacher)/layout.tsx` y `/inicio` docente) | Contenedor flex con barra lateral izquierda + `<main id="main-content">` (`max-width: 1200px`, `padding: 24px 32px` escritorio, `20px 20px` tablet). | Extraer `TeacherShell` reutilizado tanto por `(teacher)/layout.tsx` como por `inicio-client.tsx` (rama docente) para que `/inicio` y `(teacher)/*` tengan exactamente el mismo layout y barra lateral. |
| **Barra lateral izquierda (`TeacherNav`)** | Escritorio (`>= 1280px`): **`width: 248px`** fija (`sticky top: 0; height: 100dvh`). Portátil (`1024–1279px`): **`width: 224px`**. Tablet (`768–1023px`): cabecera superior `64px` + botón menú **`>= 48 × 48 px`** o rejilla limpia accesible sin desbordar. | Reemplaza el header horizontal actual (`bg-white` + cuadro azul `E`). Fondo `#F6EFE4`, `border-right: 1px solid #E4D5C3`. |
| **Cabecera de marca en sidebar** | `UpwardCompassEmblem` en sello **`38 × 38 px`** (`#FFCA3A`, `border: 1.5px solid #4A2511`, `border-radius: 10px`, `0 1px 2px rgba(43,21,10,0.12)`) + `Upward English` + píldora `Panel Docente` (`#FFFFFF`/`#F6EFE4`, borde `#E4D5C3`). | — |
| **Ítems de navegación (8 rutas reales)** | 2 grupos semánticos: **Docencia** (`Inicio`, `Actividades`, `Asignaciones`, `Revisión`) y **Gestión y seguimiento** (`Alumnos`, `Grupos`, `Estadísticas`, `Contenido extra`). Cada enlace **`min-height: 44px`** (`>= 48px` en tablet), `padding: 10px 12px`, `border-radius: 10px`. | Activo: fondo `#FFF0DE`, texto `#872E06` (`700`), indicador izquierdo `3px solid #C6470B`, `aria-current="page"`. Contadores opcionales en `Revisión` (`#B9251D`/`#FDECE9`) y `Alumnos` (`#543200`/`#FFF1C2`). |
| **Pie de barra lateral** | Perfil profesora + botón `Cerrar sesión` (`min-height: 44px` escritorio / `>= 48px` tablet, `border: 1px solid #9A7B5C`). | Ejecuta `logoutSharedDevice()` limpiando IndexedDB y caché. |
| **Top utility bar** | `min-height: 52px`, `border-bottom: 1px solid #E4D5C3`, fondo `#FCF9F2`; aloja breadcrumbs de detalle e indicador **polling cada 30 s** (`Actualizado HH:mm:ss · cada 30 s` + botón **`Refrescar`** `min-height: 38–44px`). | Nunca afirmar tiempo real ni WebSockets (`CONTEXT.md` §2.4). |
| **Tablas de datos editoriales (`EditorialTable`)** | Wrapper `#FFFFFF`, `border: 1px solid #E4D5C3`, `border-radius: 12px`, interno `overflow-x: auto`; `thead` `#F6EFE4`, filas **`min-height: 48px`**, `padding: 12px 16px`, hover `#FCF9F2`. | Columnas ordenables usan `<button>` nativo dentro de `<th>` con `aria-sort`. |
| **Modales críticos (`AccessibleModal` / `ConfirmDialog`)** | `max-width: 520px`, `padding: 24px`, `border: 1px solid #CBB499`, `border-radius: 14px`, `0 6px 20px rgba(43,21,10,0.08)`; botones **`min-height: 44px`** (`48px` en tablet). | Botón destructivo `#B9251D` (hover `#991D16`), foco `#1D4ED8`, `Escape` bloqueado solo si `isPending`. |
| **Banners `PwaUpdateBanner` y `OfflineStatusBanner`** | No bloqueantes; docente `PwaUpdateBanner` en `#FFF6E3` con borde `#CBB499`, botón primario `#C6470B` y `Ahora no`; `OfflineStatusBanner` en `#FFF0DE` con borde `#C6470B`. | Protege la edición/calificación en curso. |

---

## 5. Criterios de aceptación de la Base Compartida Docente

- [ ] `Plus_Jakarta_Sans` incluye peso `'400'` en `apps/web/src/app/layout.tsx`.
- [ ] `TeacherShell` + `TeacherNav` unificados para `/inicio` docente y `(teacher)/*` con sidebar `248px` / `224px` (`#F6EFE4`), `UpwardCompassEmblem` (`38–40px` + `Panel Docente`) y colapso accesible en tablet (`768–1023px`).
- [ ] Catálogo de badges (Actividades, Asignaciones, Revisión, Estudiantes, Constancia), tablas editoriales y modales críticos con tokens exactos WCAG 2.2 AA (`#9A7B5C` en inputs, `#1D4ED8` en foco).
- [ ] Cero mascota caricaturesca, cero sombras cómic, cero WebSockets, cero `Guardian`/`ConsentRecord`.
- [ ] Pasa `pnpm --filter web typecheck`, `pnpm --filter web lint` y `node .agents/skills/upward-english-guardrails/scripts/check-guardrails.mjs`.
