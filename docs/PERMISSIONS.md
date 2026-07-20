# Permisos y roles — Syntra Dynamics

## Fuente de verdad

- **Registro de pantallas:** [`src/lib/permissions/registry.ts`](../src/lib/permissions/registry.ts)
- **Comprobación en runtime:** [`src/lib/permissions/check.ts`](../src/lib/permissions/check.ts)
- **API:** `withPermission(handler, "modulo.pantalla", "view" | "edit" | "admin")`
- **UI:** `usePermission("modulo.pantalla", "edit")` o `hasPermission(session, key, level)`

## Niveles

| Nivel | Uso |
|-------|-----|
| `none` | Sin acceso (no se guarda en BD; ausencia = none) |
| `view` | Listar, ver detalle, reportes |
| `edit` | Crear, modificar, importar, aprobar (según pantalla) |
| `admin` | Eliminar, configuración sensible, administración total de la pantalla |

## Checklist — nueva pantalla o sección

1. [ ] Añadir entrada en `PERMISSION_REGISTRY` (módulo, `screenId`, `uiRoutes`, `apiPrefixes`, `actions`).
2. [ ] Proteger rutas API con `withPermission` (o `hasPermission` en el handler).
3. [ ] Filtrar enlace en submenú del módulo (`ExpensesSectionNav`, `DisciplinarySectionNav`, etc.) si aplica.
4. [ ] Ocultar botones crear/editar con `usePermission(..., "edit")`.
5. [ ] Actualizar seed de roles sistema en `prisma/seed-roles.ts` si el rol por defecto debe incluir la pantalla.
6. [ ] Mencionar en el PR: clave de permiso y nivel mínimo.

## Roles

- Los roles viven en BD (`Role`, `RolePermission`).
- Roles `isSystem: true` (ADMIN, SUPERVISOR, …) no se eliminan.
- Cada usuario tiene un `roleId`.
- La matriz de permisos se edita en **Mantenimiento → Roles**.

## Mapeo legacy (enum → permisos)

| Rol sistema | Contratos | Gastos | Disciplinario | Inventario | Plataforma |
|-------------|-----------|--------|---------------|------------|------------|
| ADMIN | admin | admin | admin | admin | admin |
| SUPERVISOR | edit | edit | edit | view | — |
| COMPRAS | view | edit | view | view | — |
| COMMERCIAL | edit | view | view | view | — |
| CONSULTA | view | view | view | view | — |

## Claves actuales (referencia)

Ver `allPermissionKeys()` en el registro. Ejemplos:

- `presupuestos.contracts`
- `gastos.expenses`, `gastos.expenses_approvals`, `gastos.reports_monthly`
- `disciplinario.import`, `disciplinario.empleados`
- `solicitudesRrhh.ajustes` — configuración de constancias públicas (FCL / carta de servicio)
- `inventario.assets`
- `plataforma.users`, `plataforma.roles`, `plataforma.catalogs`
