# Módulo: Presupuestos y contratos

## Responsabilidad

Contratos, periodos, puestos, gastos, aprobaciones, distribución, rentabilidad, importación Excel.

## Rutas UI

- `/contracts`, `/contracts/[id]`, `/contracts/new`
- `/expenses`, `/expenses/pending-approvals`, `/expenses/approval-bitacora`, `/expenses/deferred`, `/expenses/admin`

## APIs

- `/api/contracts/**`
- `/api/expenses/**`
- `/api/import/contracts`, `/api/import/expenses`

## Código (Fase 2 — migrado)

| Capa | Ubicación |
|------|-----------|
| Reglas de negocio | `business/` — rentabilidad, equivalencia, distribución, auto-expire |
| Servicios | `services/` — listados, aprobaciones, uploads, distribución diferida |
| Validaciones Zod | `validations/` — `contract.schema`, `expense.schema` |
| Import Excel | `import/` — plantillas, filas contrato/gasto |
| Barrel | `index.ts` |
| Páginas | `src/app/(app)/contracts`, `expenses` |
| Componentes | `src/components/contracts`, `expenses` |

### Compartido (no movido)

- `src/lib/import/xlsx-read.ts` — lectura Excel (también lo usa disciplinario)
- `src/lib/validations/company-code.ts` — catálogo de empresas (núcleo)
- `src/lib/server/companies.ts` — validación empresa en APIs

## Imports

```ts
import { recalculateEquivalence } from "@/modules/presupuestos/business/equivalence";
import { expenseCreateSchema } from "@/modules/presupuestos/validations/expense.schema";
import { listExpensesForSession } from "@/modules/presupuestos/services/expenses-list";
```

## Reportes

El módulo `reportes` consume `business/annualProfitability.ts` y `profitability.ts` de este módulo.
