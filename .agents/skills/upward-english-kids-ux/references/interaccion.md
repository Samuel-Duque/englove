# Interacción: consultar solo el bloque afectado

## Tema y componentes

Fuentes: CONTEXT §3/§8, SPEC-05 (perfil), `apps/web/src/components/student-shell.tsx`, `apps/web/src/app/(student)/perfil/perfil-client.tsx`, `apps/web/src/lib/user-segment.ts`.

- El perfil compartido de la API determina `ageSegment` y `canSwitchInterface`; no crees otro cálculo de edad ni otra fuente de sesión. Conserva la validación del backend.
- Reutiliza el tema del shell y la sincronización de segmento existente para banners/offline. No confundas una preferencia visual con un rol o permiso.
- Tokens compartidos para color, tipografía, espaciado, radios, movimiento y sonido, con valores Kids/Teens. Inspecciona `apps/web/src/app/globals.css` y los componentes: algunas pantallas pueden usar clases condicionales en lugar de tokens. Trátalo como evidencia, no como autorización para migrar todo el diseño.
- Conserva fuentes y activos existentes. Evita duplicar componentes completos; una variante estructural se justifica solo por una diferencia de interacción real.

## Lectura, navegación y estados

Fuentes: CONTEXT §5.2/§8, arquitectura §3.1/§3.6, SPEC-05 y SPEC-09 §7.

- Kids: una instrucción breve, apoyo visual con texto y acción evidente. Teens: menor decoración, misma claridad y accesibilidad. No uses diminutivos constantes, culpa o mensajes de fracaso personal.
- Ejemplos de tono, no cadenas obligatorias: «Selecciona una palabra y luego su lugar»; «No pudimos enviar tu respuesta. Inténtalo de nuevo». Usa «Respuesta guardada» solo tras la confirmación correspondiente; diferencia guardado local y envío.
- Conserva los techos de navegación desde `/inicio`: actividad 2 clics; juego/progreso/extra 3; feedback 3–4 según el número de intentos (arquitectura §3.1). Conserva el acceso existente al perfil; no inventes un techo distinto ni introduzcas menús anidados.
- Distingue carga, vacío, error recuperable, actividad cerrada, sesión vencida, falta de permiso y recurso inexistente. La explicación no incluye stack traces, tokens ni información de otros alumnos.
- Sin red, respeta la cola y el ciclo de intento definidos por SPEC-09; la hora del dispositivo no decide vigencia. Un cambio visual no debe descartar respuestas, repetir entregas ni inventar un guardado.

## Tacto, foco y arrastre

Fuentes: SPEC-06 RF de cada mecánica; SPEC-09 RF-19–21; arquitectura §10.3.

- Mide la caja interactiva, no solo el icono: 48 × 48 px CSS en 390 × 844, 800 × 1280 y 1280 × 800. Es un requisito del proyecto, más exigente que el mínimo AA de WCAG 2.2; no lo rebajes a 24 o 44 px.
- Usa controles semánticos con nombre accesible, orden lógico de foco e indicador visible de al menos 2 px y contraste 3:1 (SPEC-09 RF-20). No pierdas el foco al responder, mover o reordenar una pieza.
- `@atlaskit/pragmatic-drag-and-drop` es el único motor aprobado. El arrastre nativo no basta para tablets: conserva **toque/clic origen → destino y operación con teclado**, con el mismo resultado y sin duplicar eventos.
- Reutiliza `apps/web/src/components/activities/games/` y sus estados/handlers; las tres entradas deben converger en la misma acción de dominio. En `match`, `order_words`, `drag_drop`, `memory` y `timed_choice`, consulta el contrato específico antes de cambiar selección, orden o tiempo.
- Comunica selección, acierto y error mediante texto/estado además de color/sonido. No requieras hover ni bloquees el scroll o el zoom de toda la página para implementar un gesto.

## Movimiento, celebraciones, sonido y voz

Fuentes: CONTEXT §6/§8, decisiones 105/107; SPEC-06 RF-9; SPEC-09 RF-22.

- CSS/Tailwind para transiciones ligeras, preferentemente `transform`/`opacity`; no añadas Framer Motion ni un bundle de animación mediante `next/dynamic` por copiar propuestas antiguas. No impongas un veto genérico al código dinámico de otros módulos.
- Reutiliza `apps/web/src/lib/confetti.ts`: `fireCelebrationConfetti({ theme })` ya contempla ambas paletas y movimiento reducido. Evita efectos repetitivos; la confirmación textual permanece cuando el efecto no se ejecuta.
- Respeta `prefers-reduced-motion` también en CSS; no basta proteger el confeti. Evita bucles decorativos, destellos y desplazamientos que dificulten leer o responder.
- Reutiliza `apps/web/src/lib/sound.ts` (Web Audio API), su preferencia y los controles existentes. La interacción funciona silenciada, sin autoplay permitido o sin `AudioContext`; no añadas Howler.js ni audio remoto para efectos.
- Kids ofrece «Escuchar» en cada consigna: `en-US` para inglés y `es-CO` para instrucciones en español. Reutiliza `apps/web/src/lib/speech.ts` y el renderer; comprueba capacidad/voces antes de invocarlo. Sin `speechSynthesis` o sin voces, oculta el botón sin error; el texto permanece. No añadas lectura automática ni servicios de voz externos.

## Refuerzo y privacidad

Fuentes: CONTEXT §2.4/§9/§16; SPEC-05, SPEC-06, SPEC-08 y SPEC-09 §8.

- Celebra el esfuerzo sin comparar públicamente a niños. Ranking de juegos privado de la profesora; estrellas de práctica no equivalen a una nota nueva ni justifican exponer posiciones de otros alumnos.
- La API calcula nota y timestamps; no envíes calificaciones ni claves de respuesta desde la UI. No conviertas microjuegos autónomos en asignaciones.
- Reutiliza `auth-session.ts`, `offline-queue.ts` y `auth-hygiene.ts` para sesiones y tablets compartidas. No añadas una caché persistente paralela ni modifiques logout/refresh para resolver un problema visual.
- No incorpores rastreadores, PII en logs/capturas de prueba, módulos parent/admin ni consentimiento de menores. Pruebas con niños y staging necesitan las autorizaciones correspondientes; la skill no las concede.

## Fuentes externas de accesibilidad

Consulta W3C al precisar criterios; la norma del proyecto sigue siendo la más estricta cuando corresponda:

- [WCAG 2.2, tamaño mínimo AA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24 px con excepciones; no es el umbral de 48 px del proyecto.
- [Alternativa al arrastre](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): el teclado por sí solo no sustituye una alternativa de puntero sin arrastre.
- [Contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): 4,5:1 normal; 3:1 grande (18 pt o 14 pt negrita, no 18/14 px). Verifica ambos temas y estados, no solo los colores base.
