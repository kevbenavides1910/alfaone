# M?dulo Ventas

Pipeline comercial de licitaciones antes de convertirse en contratos (`presupuestos`).

## Pantallas

- **Oportunidades** (`/ventas/oportunidades`): licitaciones detectadas autom?ticamente o registradas manualmente.
- **Presupuestos** (`/ventas/presupuestos`): elaboraci?n de ofertas con 10 m?dulos de datos (salarios, MO, cargas, insumos, GA, estructura, detalle, tolerancia).

## Cat?logo maestro (presupuestos)

Siembra inicial de salarios, jornadas MO1?MO5, cargas sociales, pagos extras, insumos y GA:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-ventas-presupuesto-catalog.ts
```

## Integraci?n SICOP (cron + n8n Telegram)

Pipeline diario lun?vie:

1. **9:40 CR** ? cron VPS: `scripts/cron-sicop-oportunidades.sh` ? `scripts/sicop/run-sync.sh` (SICOP + ingest + `last-run.json`).
2. **9:42 CR** ? n8n lee `/scripts/last-run.json` y env?a resumen por Telegram.

Scripts en repo: `scripts/sicop/` (instalar en host: `scripts/sicop/install-on-host.sh`).

Ingest API (manual o batch):

```
POST /api/ventas/oportunidades/ingest
Authorization: Bearer <SYNTRA_CRON_SECRET>
```

Cuerpo (una licitaci?n):

```json
{
  "licitacionNo": "2024-001",
  "cliente": "Ministerio de Salud",
  "descripcion": "Servicio de vigilancia...",
  "fechaPresentacion": "2026-07-15",
  "enlace": "https://..."
}
```

Cuerpo (lote):

```json
{
  "licitaciones": [ { ... }, { ... } ]
}
```

Comportamiento idempotente por `licitacionNo`: crea registros nuevos o actualiza cliente, descripci?n, fechas y campos SICOP en re-ingestas.

## Estados

| Estado | Descripci?n |
|--------|-------------|
| `PENDIENTE_DECIDIR` | Registro nuevo (por defecto desde n8n) |
| `PARTICIPAR` | Se participar? en la licitaci?n |
| `NO_PARTICIPAR` | Se descarta la oportunidad |
