# SPEC-NN — <Título de la capacidad>

| Campo                | Valor                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| Estado               | Borrador / En revisión / Aprobada / Implementada / Verificada / Obsoleta |
| Etapa                | N — <nombre>                                                             |
| Tareas               | ENG-xxx, ENG-yyy                                                         |
| Referencias          | CONTEXT §a, §b · architecture §c, §d                                     |
| Aprobada por / fecha | —                                                                        |

## 1. Contexto y objetivo

Qué problema resuelve esta capacidad y para quién. Dos o tres párrafos.

## 2. Alcance

- Incluye: …
- No incluye (y dónde se cubre): …

## 3. Requisitos funcionales

Lista numerada RF-1, RF-2… Cada requisito lleva al menos un criterio de aceptación en formato
**Dado** <estado inicial> **Cuando** <acción> **Entonces** <resultado observable>.
Los criterios son la fuente directa de las pruebas.

## 4. Reglas de negocio

Reglas que cruzan varios requisitos: límites, cálculos, estados y transiciones, umbrales.
Aquí viven, por ejemplo, la escala 0,0–5,0, el bloqueo por intentos fallidos o la racha perdonable.

## 5. Contrato de API

Por endpoint: método, ruta, roles autorizados, cuerpo de entrada, respuesta, códigos de error
(`code` estable según architecture §13). Se enlaza al esquema Zod de `packages/shared` cuando exista.

## 6. Modelo de datos

Tablas y columnas nuevas o modificadas, enums, índices, migración. Alineado con architecture §6.

## 7. Interfaz

Pantallas, estados (vacío, cargando, error, éxito), navegación y número de clics desde la home,
diferencias Kids / Teens si las hay, textos clave en español.

## 8. Seguridad y privacidad

Qué guard aplica, qué filtra por `organization_id`, qué datos de menores se tocan, qué no se registra en logs.

## 9. Pruebas

Qué pruebas unitarias, de integración y E2E verifican esta spec, mapeadas a los RF.
Qué se prueba en dispositivo real, si aplica.

## 10. Fuera de alcance y decisiones diferidas

Qué se dejó fuera a propósito y en qué spec o fase se retomará.

## 11. Preguntas abiertas

Lista con responsable y fecha. Una spec no pasa a Aprobada con preguntas abiertas que bloqueen un RF.

## 12. Registro de cambios

| Fecha | Cambio | Motivo |
| ----- | ------ | ------ |
