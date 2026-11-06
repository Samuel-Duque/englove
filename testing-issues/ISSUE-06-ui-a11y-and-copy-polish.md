# ISSUE-06: Hallazgos de Accesibilidad en Formularios y Ajustes de Copy en UI

## Estado: ✅ Resuelto y Verificado (2026-11-06)
- **Fecha de hallazgo:** 2026-11-06
- **Entorno:** Localhost (`http://localhost:3000`), Chrome DevTools MCP.
- **Vistas afectadas:**
  - `apps/web/src/app/(teacher)/revision/page.tsx`
  - `apps/web/src/app/(teacher)/alumnos/[id]/page.tsx`
  - `apps/web/src/app/(teacher)/estadisticas/page.tsx`
  - `apps/web/src/app/(public)/registro/page.tsx`
  - `apps/web/src/app/(student)/progreso/progreso-client.tsx`

---

## 1. Descripción de los Hallazgos

Durante la navegación automatizada y manual de las distintas rutas docentes, públicas y estudiantiles mediante Chrome DevTools, se identificaron advertencias de accesibilidad en controles de formularios y un error menor de concordancia gramatical en la interfaz estudiantil:

### A. Campos de formulario sin atributo `id`, `name` o etiqueta `<label htmlFor="...">` asociada
DevTools emite de forma recurrente las advertencias:
- `[issue] A form field element should have an id or name attribute`
- `[issue] No label associated with a form field`

**Ubicaciones exactas:**
1. **Vista de Revisión (`apps/web/src/app/(teacher)/revision/page.tsx:713`):**
   - El checkbox para habilitar nuevo intento (`allowRetry`) carece de `id`, `name` y `htmlFor`.
2. **Vista de Ficha de Alumno (`apps/web/src/app/(teacher)/alumnos/[id]/page.tsx:477`):**
   - El `<select>` para cambiar de grupo carece de `id` y de un `<label htmlFor="...">` visiblemente enlazado.
3. **Vista de Estadísticas (`apps/web/src/app/(teacher)/estadisticas/page.tsx:555, 810`):**
   - Los controles `<select>` de filtro de grupo y periodo no cuentan con enlace `id`/`htmlFor`.
4. **Vista de Registro Público (`apps/web/src/app/(public)/registro/page.tsx:215-221`):**
   - El checkbox de aceptación de términos `input[type="checkbox"]` está envuelto en un `<label>` pero carece de atributos `id` y `name`.

### B. Error de concordancia gramatical en la racha semanal (Singular vs Plural)
En `apps/web/src/app/(student)/progreso/progreso-client.tsx:82`:
```tsx
<h2 className="text-2xl sm:text-3xl font-black text-amber-950">
  {streak.weeks} {streak.weeks === 1 ? 'semana' : 'semanas'} consecutivas
</h2>
```
Cuando el alumno tiene una racha de 1 semana, la pantalla renderiza:
> **"1 semana consecutivas"** (en lugar de *"1 semana consecutiva"*).

---

## 2. Impacto
- **Accesibilidad (a11y):** Los lectores de pantalla (screen readers como NVDA, VoiceOver o TalkBack) pueden no anunciar correctamente el propósito del campo o la relación entre el texto y la casilla/selector interactivo.
- **Experiencia de Usuario (UX / Copy):** El error gramatical en la racha afecta el pulido visual y pedagógico del portal de estudiantes.

---

## 3. Posibles Soluciones (Hipótesis para la Sesión de Corrección)

> [!NOTE]
> Las siguientes alternativas son propuestas preliminares que deberán validarse y aprobarse en la sesión dedicada a correcciones.

1. **Posible Solución para Controles de Formulario:**
   - Asignar atributos `id` y `name` semánticos y únicos a todos los checkboxes y selects:
     - Checkbox de nuevo intento: `id="allow-retry-checkbox"`, `name="allowRetry"`, `<label htmlFor="allow-retry-checkbox">`.
     - Checkbox de términos: `id="accept-terms-checkbox"`, `name="acceptTerms"`, `<label htmlFor="accept-terms-checkbox">`.
     - Selects de estadísticas y grupos: `id="group-filter-select"`, `name="groupId"`, etc.
2. **Posible Solución para la Racha Semanal:**
   - Ajustar la interpolación en `progreso-client.tsx`:
     ```tsx
     {streak.weeks} {streak.weeks === 1 ? 'semana consecutiva' : 'semanas consecutivas'}
     ```

---

## 4. Solución Implementada y Verificación (2026-11-06)

1. **Atributos de Accesibilidad y Etiquetas en Formularios:**
   - En [`apps/web/src/app/(teacher)/revision/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/revision/page.tsx), se asignaron `id="allow-retry-toggle"` y `name="allowRetry"` enlazados con `<label htmlFor="allow-retry-toggle">`.
   - En [`apps/web/src/app/(teacher)/alumnos/[id]/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/alumnos/[id]/page.tsx), se asignaron `id="group-select"` y `name="groupId"` junto a su etiqueta accesible.
   - En [`apps/web/src/app/(teacher)/estadisticas/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(teacher)/estadisticas/page.tsx), se asignaron identificadores semánticos y etiquetas a los selectores de filtro de grupo y periodo.
   - En [`apps/web/src/app/(public)/registro/page.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(public)/registro/page.tsx), se dotó al checkbox de aceptación de términos de `id="accept-terms-checkbox"` y `name="acceptTerms"`.
2. **Concordancia Gramatical en Racha:**
   - En [`apps/web/src/app/(student)/progreso/progreso-client.tsx`](file:///c:/Users/sebas/OneDrive/Desktop/englove/apps/web/src/app/(student)/progreso/progreso-client.tsx), se corrigió la interpolación para renderizar:
     ```tsx
     {streak.weeks} {streak.weeks === 1 ? 'semana consecutiva' : 'semanas consecutivas'}
     ```
3. **Verificación:**
   - Suite de componentes web, linter y chequeo de tipos TypeScript sin advertencias ni errores.
