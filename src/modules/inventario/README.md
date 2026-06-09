# Módulo: Inventario

## Responsabilidad

Tipos de activo, stock, movimientos (entrada/salida/asignación), vínculo con contratos.

## Rutas UI

- `/inventory`

## APIs

- `/api/assets`, `/api/assets/[id]`, `/api/assets/[id]/movements`
- `/api/asset-movements`
- `/api/contracts/[id]/assets`
- `/api/admin/catalogs/asset-types` (catálogo de tipos)

## Código (Fase 2 — migrado)

| Capa | Ubicación |
|------|-----------|
| Validaciones Zod | `validations/asset.schema.ts`, `asset-type.schema.ts` |
| Servicios | `services/` — listado, alta, movimientos, árbol por contrato, tipos |
| Includes Prisma | `services/asset-includes.ts` |
| Barrel | `index.ts` |
| Páginas | `src/app/(app)/inventory` |
| Componentes | `src/components/contracts/AssetsTab.tsx`, `admin/AssetTypesTab.tsx` |

### Services

- `assets.ts` — listado y entrada (intake)
- `asset-detail.ts` — detalle, actualización, eliminación
- `asset-movements.ts` — asignar, devolver, dar de baja
- `asset-movements-feed.ts` — bitácora global
- `contract-assets.ts` — activos asignados por contrato/puesto
- `asset-types.ts` — CRUD tipos de activo

## Imports

```ts
import { listAssets } from "@/modules/inventario/services/assets";
import { assetIntakeCreateSchema } from "@/modules/inventario/validations/asset.schema";
```

## Cruce con presupuestos

Los activos se asignan a `Position` → `ContractLocation` → `Contract`. La FK a `Expense` es opcional en la entrada de stock.
