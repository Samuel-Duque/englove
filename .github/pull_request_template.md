## Trazabilidad SDD (obligatoria)

- Tarea `ENG-___` o hallazgo
- Enlace a `SPEC-__` y requisitos `RF-__` cubiertos. Para cambios de infraestructura sin RF propio, enlaza la decisión o tarea que autoriza el cambio.
- Pruebas y evidencia de CI o staging, con enlace a la ejecución cuando corresponda

## Definición de Hecho

- [ ] El cambio sigue la spec aprobada y respeta el alcance del piloto (`CONTEXT` §2.4).
- [ ] Las pruebas identifican los RF. Si es una corrección, hay una regresión nombrada por el hallazgo y comprobada en el entorno donde se manifiesta.
- [ ] Pasan lint, tipos, pruebas, build y guardrails. Se adjunta evidencia E2E si afecta un flujo de usuario.
- [ ] Si cambia el esquema, la migración está versionada y verificada en CI y staging mediante conexión directa de Prisma.
- [ ] Se revisaron las convenciones de código y UI de `CONTEXT` §16.
- [ ] Se actualizaron el taskboard, la spec y las decisiones si el cambio lo requiere. El estado `Verificada` tiene evidencia de CI.
- [ ] Otra persona revisó el PR o, en un equipo unipersonal, se documentó la autorrevisión.

## Guardrails aplicables

- [ ] Las consultas aíslan `organization_id` y, cuando corresponde, `student_id`. La API calcula notas y timestamps.
- [ ] La configuración preserva el aislamiento de entornos, el bucket privado y los dominios, cookies y CORS exigidos por cada entorno.
- [ ] El cambio conserva la autorización en la API y protege los datos autenticados, los secretos y la información personal.

Indica qué puntos quedan pendientes o no aplican y por qué.
