# Plan de Implementación — Profesora: Inicio / Resumen Operativo (`/inicio`)

> **Alcance:** Rediseño de `/inicio` cuando `session.user.role === 'teacher'`, aplicando el estilo **Estudio Editorial Cálido** ([teacher-portal-diseno.md](../teacher-portal-diseno.md) §5.1). Este documento es un plan; no modifica código existente.

| Campo | Detalle |
| --- | --- |
| **Ruta real** | `/inicio` |
| **Archivos objetivo** | [page.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/page.tsx), [inicio-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/inicio-client.tsx) (rama `teacher`) |
| **Prerrequisitos** | [00-orden-y-base-compartida.md](./00-orden-y-base-compartida.md) (`TeacherShell`, `TeacherNav`) |
| **Orden de implementación** | **Página 1 de 17** del Panel Docente |
| **Contratos / Guardrails** | `SPEC-04`, `SPEC-08`, Decisiones 42, 110, `G-A06`, `G-C05` |

---

## 1. Objetivo de la página y alcance

Evolucionar el tablero docente actual (`bg-zinc-50` + tarjetas de colores genéricos azul/morado/esmeralda) hacia el **Resumen Operativo Editorial**: cabecera con saludo profesional y fecha en `America/Bogota`, CTA primario **`+ Nueva actividad`** (`/actividades/nueva`), franja de **2 recordatorios prioritarios** (`Solicitudes de registro` y `Entregas sin calificar > N días`), tabla compacta de **grupos activos** (si está disponible o conectada al listado de grupos) y accesos rápidos limpios con iconografía lineal sobria (`1.5–1.75px`).

### Qué cambia vs. qué permanece intacto

- **Cambia:**
  - Envolver la rama docente de `inicio-client.tsx` en `TeacherShell` (barra lateral izquierda + top utility bar con estado de actualización/botón `Refrescar`).
  - **Encabezado:** saludo (`Buen día, [session.user.name]`), fecha vigente en `America/Bogota` y botón primario **`+ Nueva actividad`** (`/actividades/nueva`, `#C6470B`).
  - **Franja de recordatorios prioritarios (2 columnas):**
    1. *Solicitudes de registro pendientes:* contador grande en `tabular-nums`, fondo `#FFF6E3` con borde `#C6470B` si `pendingCount > 0` (neutro `#FFFFFF` con check `#166534` si `0`) y enlace `Revisar solicitudes →` (`/alumnos/solicitudes`).
    2. *Entregas sin calificar (`> N días`):* contador en `tabular-nums`, acento `#FDECE9` / borde `#B9251D` cuando `overdueReviews > 0`, nota discreta sobre resumen automático por correo cada 3 días y enlace `Ir a revisión →` (`/revision`).
  - **Resumen operativo de grupos activos:** consulta ligera `/api/v1/groups?status=active` (opcional/recomendada para alinear con `teacher-portal-diseno.md` §5.1) con tabla editorial compacta (`Grupo`, `Nivel`, acción `Ver grupo →` a `/grupos/[id]`) sin inventar métricas que no devuelva el endpoint.
  - **Accesos rápidos secundarios:** tarjetas sobrias Nivel 1 (`#FFFFFF`, borde `#E4D5C3`) con ícono lineal `lucide-react` (`20px`) en contenedor `#F6EFE4` (sin fondos morados/azules ni emojis gigantes) hacia `/asignaciones`, `/actividades`, `/grupos`, `/alumnos`, `/revision`, `/estadisticas` y `/contenido-extra`.
- **Permanece intacto:**
  - `sessionQuery`, `remindersQuery` (`/api/v1/dashboard/reminders`, `RemindersResponseSchema`), manejo de `networkError` y redirección a `/login` sin sesión.

---

## 2. Paleta de colores exacta (Tokens + Hex + Contraste)

| Elemento | Token / Uso | Hex | Contraste verificado |
| --- | --- | --- | --- |
| **Lienzo principal** | `--bg-canvas` | `#FCF9F2` | Base cálida |
| **Tarjetas de acceso rápido y tabla grupos** | `--surface-card` / `--border-hairline` | `#FFFFFF`, borde `1px solid #E4D5C3` | `#2B150A`: **17,29:1 (AAA)** |
| **Recordatorio solicitudes (`> 0`)** | `--surface-callout` / `--accent-primary` | `#FFF6E3`, borde `1px solid #C6470B`, cifra `#872E06` | **>= 7,74:1 (AAA)** |
| **Recordatorio entregas atrasadas (`> 0`)** | `--accent-danger-soft` / `--accent-danger` | `#FDECE9`, borde `1px solid #B9251D`, cifra `#831712` | **8,75:1 (AAA)** |
| **Recordatorio sin pendientes (`0`)** | `--surface-card` / `--status-ok-ink` | `#FFFFFF`, borde `#E4D5C3`, check `#166534` sobre `#E6F5EA` | **6,32:1 (AA+)** |
| **CTA `+ Nueva actividad` y acciones recordatorio** | `--accent-primary` / `-hover` | `#C6470B` / `#A53906` (texto `#FFFFFF`) | **4,88:1 (AA)** |
| **Foco por teclado** | `--focus-ring` | `#1D4ED8` (`3px solid #1D4ED8; offset: 2px`) | **5,87–6,70:1** |

---

## 3. Tipografía y reglas de texto

- **`<h1>` Panel Docente — Inicio:** `Bricolage Grotesque 700`, `1.625rem` (`26px`), `letter-spacing: -0.015em`.
- **`<h2>` Recordatorios / Grupos / Accesos:** `Bricolage Grotesque 600`, `1.1875rem` (`19px`).
- **Contadores de recordatorios:** `Plus Jakarta Sans 700`, `1.75rem` (`28px`), `tabular-nums`.
- **Descripciones y celdas:** `Plus Jakarta Sans 400–600`, `0.875rem–0.9375rem` (`14–15px`).

---

## 4. Anatomía y tamaño exacto de cada componente

| Bloque / Componente | Dimensiones (`1440×900` / `1280×800` / `820×1080`) | Padding / Radio / Borde | Reglas de layout |
| --- | --- | --- | --- |
| **Encabezado superior de página** | Flex `space-between`; botón `+ Nueva actividad` **`min-height: 44px`** (`48px` tablet). | `margin-bottom: 24px` | En `820px` el CTA pasa a fila cómoda sin truncar texto. |
| **Franja Recordatorios (2 tarjetas)** | `>= 1024px`: `grid-template-columns: 1fr 1fr`, `gap: 16px`. Tablet (`820px`): `1` o `2 columnas`. | `padding: 20px`, `border-radius: 12px` | Enlace acción `min-height: 42px` (`48px` tablet), `border-radius: 8px`. |
| **Tabla compacta de Grupos Activos** | `width: 100%`, `overflow-x: auto`; filas `min-height: 48px`, `padding: 12px 16px`. | `border: 1px solid #E4D5C3`, `border-radius: 12px`, `thead` `#F6EFE4` | Enlace `Ver grupo →` en `#C6470B` con `min-height: 40px` (`48px` tablet). |
| **Rejilla Accesos Rápidos** | `>= 1280px`: `4 columnas` (`gap: 16px`). `1024–1279px`: `3 columnas`. `768–1023px`: `2 columnas`. | `padding: 18px`, `border-radius: 12px`, ícono `36 × 36 px` en `#F6EFE4` | — |

---

## 5. Estados obligatorios y casos límite

- **Carga:** esqueletos `#F6EFE4` respetando altura de recordatorios (`120px`) y tarjetas (`130px`).
- **Error de red:** `ErrorState` `variant="teacher"` con tokens cálidos (`#FDECE9` / `#B9251D`), botón `Reintentar` (`min-h-11`).
- **Sin grupos activos:** fila/nota limpia invitando a crear el primer grupo en `/grupos`.

---

## 6. Plan de implementación paso a paso

1. **Integrar `TeacherShell` en [inicio-client.tsx](file:///c:/Users/1/Desktop/Samuel/Englove/apps/web/src/app/inicio/inicio-client.tsx)** para la rama `session?.user.role === 'teacher'`, retirando `bg-zinc-50`.
2. **Reemplazar el saludo y la franja de recordatorios** por tarjetas editoriales cálidas (`#FFF6E3` / `#FDECE9` / `#FFFFFF`), contador `tabular-nums`, fecha `America/Bogota` y botón `+ Nueva actividad`.
3. **Añadir tabla compacta de grupos activos** (usando `GET /api/v1/groups?status=active&limit=20`) y **rediseñar las tarjetas de accesos rápidos** con íconos lineales `lucide-react` y bordes `#E4D5C3` (sin azul/morado/esmeralda ni emojis decorativos).

---

## 7. Skills, herramientas y guardrails recomendados

- `upward-english-guardrails` (`check-guardrails.mjs`, cero `'use cache'`), `accessibility`, `frontend-design`, `playwright-best-practices`, `verification-before-completion`.

---

## 8. Criterios de aceptación (Checklist)

- [ ] Usa `TeacherShell` con barra lateral `#F6EFE4` y lienzo `#FCF9F2`.
- [ ] Recordatorios muestran `pendingRegistrations` y `overdueReviews` con `tabular-nums`, enlace directo y colores semánticos AA/AAA.
- [ ] Accesos rápidos y tabla de grupos usan iconografía lineal sobria (`1.5–1.75px`) sin emojis ni paleta azul/morado heredada.
- [ ] `0` desborde horizontal en `1440×900`, `1280×800` y `820×1080`; `0` violaciones `axe-core`; `typecheck` y `lint` en verde.
