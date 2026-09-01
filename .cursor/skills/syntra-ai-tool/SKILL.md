---
name: syntra-ai-tool
description: Integra consultas de negocio con Syntra IA (herramientas del agente). Usar al agregar módulo, pantalla, API de listado, o cuando pregunten cómo exponer datos al chat Syntra.
---

# Syntra IA — nueva herramienta (tool)

Todo módulo o pantalla con **datos consultables** debe exponer tools al agente.

## Checklist (orden)

1. **Servicio reutilizable** en `src/modules/<modulo>/services/` — la ruta API y la tool llaman el mismo servicio.
2. **Tool** en `src/modules/syntra-ai/tools/<modulo>.tools.ts`:
   - `permission`: clave de `PERMISSION_REGISTRY`, nivel `view` mínimo
   - `definition`: snake_case, descripción clara para el LLM, JSON Schema de params
   - `handler`: servicio → resumen + lista acotada (`MAX_LIST`) + campo `fuente`
   - `describeCall`: progreso en español para el chat
3. **Registro** en `src/modules/syntra-ai/services/syntra-tool-registry.ts` → `ALL_TOOL_REGISTRARS`
4. **Page context** en `src/modules/syntra-ai/business/page-context.ts` si hay ruta UI nueva (`toolHint`)
5. **Permiso** en `src/lib/permissions/registry.ts` si el módulo es nuevo

## Convenciones LLM

| Prefijo | Uso |
|---------|-----|
| `list_*` | Catálogos, empresas, periodos |
| `search_*` | Búsqueda con filtros |
| `query_*` | Agregados, totales, desgloses |

- Gate doble: ocultar tool sin permiso + validar en handler.
- Errores: `{ error: "..." }` — nunca inventar cifras.
- Tenant: pasar `session` a servicios con `dbForSession` / `resolveTenantCompany`.
- NAF/planilla: indicar en descripción que **NAF es fuente de verdad**.

## Referencias

- Ejemplo completo: `src/modules/syntra-ai/tools/empleados-naf.tools.ts`
- Tipos/helpers: `src/modules/syntra-ai/tools/types.ts`, `shared.ts`
- Regla always-on: `code/presupuestos-alfa/.cursor/rules/syntra-ai-integration.mdc`
