---
name: naf-dominio
description: Reglas de negocio NAF vs Alfa One (nómina, planilla, zonas, CK/cheque, contratos). Usar en nómina, empleados-naf, operaciones, ubicaciones, pagos, reportes Oracle, o cuando el usuario mencione NAF, quincena, CK, ARCOUB, AROPMR.
---

# NAF — dominio Alfa One

Oracle NAF (NAF5) es **fuente de verdad** para planilla y muchos catálogos operativos. Alfa One sincroniza y presenta; no reemplazar lógica NAF sin calzar reportes.

## Nómina / planilla

- Ingresos, deducciones y líquido deben **calzar con reportes NAF**.
- **CK = cheque** (forma de pago), no empresa ni contrato.
- Revisión de planilla: columnas CK/DAV/BN — priorizar `getRevisionPlanillaByDateRange` / tool `query_revision_planilla_formas_pago` en pantalla revisión-planilla.
- ARPLPPD (planillas abiertas): deducciones solo `ESTATUS='A'`; `'X'` = anulada, no sumar (como RPL3071).

## Zonas y ubicaciones (Operaciones)

| Concepto | Correcto | Incorrecto |
|----------|----------|------------|
| Zona operativa | `ARCOUB.NO_ZONA_OPERACIONES` → `AROPZO` | `VIOPUBICACION_ZONA` (zona geográfica) |
| Sync/reportes | Contratos **ACTIVE**, roles `AROPMR.ESTADO='A'` | Incluir inactivos |
| Excluir zonas | `00014` (desuso), `00000` (finalizado) | — |

- `ARCOUB.NO_UBICACION` → **Position** (`zoneId` = zona operativa del puesto).
- **ContractLocation** = ubicación manual que agrupa puestos (≠ zona NAF).

## Pagos / administraciones

- Cada administración por aparte: NAF, factura, recibido conforme, vencimiento, CxC **no se copian** entre compañías.
- Calendario pagos: sync anual `POST /api/pagos/sync?year=YYYY`; si Oracle falla, listar lo ya en Postgres.
- Vista «Todas las compañías» por defecto — no filtrar solo `session.user.company`.

## Syntra IA en nómina

En `/empleados-naf/revision-planilla` el agente debe usar tools de revisión de planilla antes de decir que no puede desglosar por forma de pago.

Más hechos: `.cursor/memory/MEMORY.md` (secciones Nómina, Contratos, Pagos).
