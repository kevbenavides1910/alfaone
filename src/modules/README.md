# Módulos de negocio (`src/modules`)

Carpetas para **lógica de dominio** (servicios, reglas, validaciones). Las rutas Next.js siguen en `src/app` hasta una posible extracción a monorepo.

## Mapa de módulos (15 dominios)

| ID en registry | Carpeta | Descripción | Estado |
|----------------|---------|-------------|--------|
| `core` | [`core/`](./core/) | Auth, empresas, permisos, utilidades compartidas | Migrado |
| `plataforma` | [`plataforma/`](./plataforma/) | Branding, gestión de usuarios admin | Migrado |
| `presupuestos` | [`presupuestos/`](./presupuestos/) | Contratos, gastos, cuentas por cobrar, facturación cobro | Migrado |
| `ventas` | [`ventas/`](./ventas/) | Presupuestos de ventas | Migrado |
| `facturacion` | [`facturacion/`](./facturacion/) | Facturación manual, cuentas por cobrar | Migrado |
| `facturacionElectronica` | [`facturacion-electronica/`](./facturacion-electronica/) | FE Costa Rica (XML/XAdES), IMAP, emisión, notas de crédito | Migrado |
| `cuentasPorPagar` | [`cuentas-por-pagar/`](./cuentas-por-pagar/) | Consulta CXP Codisa (NAF5.ARCP*) por proveedor y amarres | Migrado |
| `reportes` | — | Reportes consolidados (código en `src/app/api/reports/`) | Inline en rutas |
| `inventario` | [`inventario/`](./inventario/) | Activos, movimientos, tipos de activo | Migrado |
| `disciplinario` | [`disciplinario/`](./disciplinario/) | Marcas, apercibimientos, omisiones, importación XLSX | Migrado |
| `empleados` | [`empleados/`](./empleados/) | Catálogo de empleados | Migrado |
| `empleadosNaf` | [`empleados-naf/`](./empleados-naf/) | Nómina NAF (Oracle Instant Client), sincronización, cargas sociales | Migrado |
| `expedienteDigital` | [`expediente-digital/`](./expediente-digital/) | Expediente digital NAF por cédula (SMB + Oracle) | Migrado |
| `sig` | [`sig/`](./sig/) | Documentos SIG, formularios de seguridad | Migrado |
| `recorridos` | — | Recorridos de patrulla, mapas (código en `src/app/api/recorridos/`) | Parcial |
| `ticketsTi` | [`tickets-ti/`](./tickets-ti/) | Sistema de tickets internos de TI | Migrado |
| `fingerSystem` | [`finger-system/`](./finger-system/) | Asistencia biométrica, ATT2016, dispositivos | Fase 1 |
| `formularios` | [`formularios/`](./formularios/) | Formularios dinámicos | Parcial |
| `monitoreo` | [`monitoreo/`](./monitoreo/) | Alarmas, pilas, aperturas/cierres, eventos | Migrado |
| `syntra` | [`syntra/`](./syntra/) | API móvil de patrulla Syntra (JWT device auth) | Migrado |
| `naf-documentos` | [`naf-documentos/`](./naf-documentos/) | Documentos y archivos NAF | Migrado |
| `solicitudesRrhh` | [`solicitudes-rrhh/`](./solicitudes-rrhh/) | Constancias públicas FCL / carta de servicio (OTP) | Migrado |

> El módulo `syntra` y `naf-documentos` no están en el registry principal pero sí en `src/modules/`. Ver `src/lib/modules/registry.ts` para el registry oficial.

## Cómo agregar lógica a un módulo

1. Crear/editar en `src/modules/<modulo>/services/<nombre>.ts` (servidor) o `business/<nombre>.ts` (reglas puras).
2. La ruta API en `src/app/api/` solo hace: auth → validar input (Zod) → llamar servicio → devolver respuesta.
3. Actualizar `codePaths` en `src/lib/modules/registry.ts` si aplica.
4. Máximo ~500 líneas por archivo; extraer sub-servicios o hooks si crece.

## Documentación relacionada

- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — diagrama de capas
- [`docs/PERMISSIONS.md`](../../docs/PERMISSIONS.md) — RBAC y registry de permisos
- [`docs/CI.md`](../../docs/CI.md) — path filters por módulo en CI
- [`scripts/ci/module-paths.json`](../../scripts/ci/module-paths.json) — patrones CI
