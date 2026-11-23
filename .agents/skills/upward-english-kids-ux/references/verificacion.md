# Verificación proporcional de UX

## Elegir evidencia

Una propuesta sin edición requiere lectura y trazabilidad, no ejecutar toda la suite. Una implementación requiere las pruebas aplicables al comportamiento cambiado y los guardrails del proyecto. No instales herramientas ni uses staging sin autorización.

| Cambio                | Evidencia mínima pertinente                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Tema/perfil           | Kids 7–10 sin selector; permiso desde 11; elección explícita y persistencia por API; ambos temas en componentes compartidos         |
| Controles/juego       | Resultado equivalente por arrastre, toque/clic en dos pasos y teclado; foco estable; ninguna acción/evento duplicado                |
| Visual/accesibilidad  | Medidas reales 48 × 48, viewports de RF-21, contraste y foco en ambos temas, nombres/estados accesibles, axe y recorrido de teclado |
| Movimiento/sonido/voz | Movimiento normal y reducido; sonido silenciado/no disponible; voz `en-US`/`es-CO`; ausencia de API o voces sin errores             |
| Estados/offline       | Error contextual; guardado local distinguido del enviado; reintento sin duplicación; ningún dato del usuario anterior               |

## Comandos existentes

Desde la raíz, selecciona solo los archivos afectados. Estos son puntos de entrada, no una certificación automática:

```sh
# Pruebas unitarias existentes de portal/juegos/voz.
pnpm --filter @upward-english/web test test/student-portal.spec.ts test/microgames-components.spec.ts src/lib/speech.test.ts

# Navegador real con la configuración y servicios locales de Playwright.
pnpm --filter @upward-english/web test:e2e e2e/spec-09-pwa-offline-a11y.spec.ts

# Guardrails: sustituye RUTA por los archivos de producción tocados.
node .agents/skills/upward-english-guardrails/scripts/check-guardrails.mjs RUTA
```

Consulta además `apps/web/test/` y `apps/web/e2e/` para localizar la regresión del flujo exacto, las pruebas de perfil, las cinco mecánicas y la higiene de sesión. Inspecciona `apps/web/playwright.config.ts` y sus fixtures antes de lanzar navegador: no apuntes a una base o servicio remoto ni supongas credenciales.

- Cuando exista un caso determinista y un resultado claro, observa RED antes del cambio y GREEN después. Para una revisión o documentación pasiva, declara la excepción; no inventes RED/GREEN.
- En código, completa los checks exigidos por el repositorio (`lint`, `typecheck`, pruebas y build cuando corresponda). Un test unitario que inspecciona texto fuente no demuestra interacción real ni contraste.
- Axe debe incluir `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (SPEC-09 RF-19). No desactives contraste para lograr verde; complementa con las comprobaciones manuales afectadas.
- Usa datos sintéticos y capturas sin PII. No borres colas/cachés del usuario para preparar pruebas; usa estado aislado.

## Evidencia que no puede sustituirse

- Emular toque no acredita Android/iPad: prueba en dispositivos reales según SPEC-09 RF-23/24. Para rendimiento, registra dispositivo/navegador/commit y LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1; son referencia de higiene, no una puerta de CI nueva.
- CONTEXT §8 exige observar un prototipo con 3 niños reales por segmento antes de cerrar el diseño visual. No simules participantes ni cierres ese hito con tests automáticos.
- Si no hay dispositivo, autorización o entorno, deja la comprobación **pendiente** y su condición concreta. Crear o validar esta skill no cierra Etapa 9, H1/H2/H3 ni el lanzamiento.

## Entrega y mantenimiento de la skill

- Reporta archivo/línea, fuente normativa, resultado observado y pendientes. No llames «WCAG completa» a una pasada de axe.
- Al modificar esta skill, comprueba frontmatter, enlaces, fuentes vigentes y casos de `../evals/evals.json`; estos últimos son escenarios de evaluación, no pruebas E2E de la aplicación.
- Conserva el archivo principal breve (objetivo ≤ 100 líneas y ≤ 900 palabras); mueve detalle condicional a referencias sin duplicar CONTEXT o las specs.
- Sincroniza la carpeta completa desde `.agents/skills/upward-english-kids-ux/` hacia `.claude/skills/` y `.kiro/skills/`; actualiza su hash local en `skills-lock.json` con el algoritmo del CLI de skills y refresca el índice de skills cuando esté disponible.
