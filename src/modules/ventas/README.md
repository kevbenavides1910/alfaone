# Módulo Ventas

Pipeline comercial de licitaciones antes de convertirse en contratos (`presupuestos`).

## Pantallas

- **Oportunidades** (`/ventas/oportunidades`): licitaciones detectadas automáticamente o registradas manualmente.
- **Presupuestos** (`/ventas/presupuestos`): elaboración de ofertas con 10 módulos de datos (salarios, MO, cargas, insumos, GA, estructura, detalle, tolerancia).

## Catálogo maestro (presupuestos)

Siembra inicial de salarios, jornadas MO1–MO5, cargas sociales, pagos extras, insumos y GA:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-ventas-presupuesto-catalog.ts
```

## Integración n8n

Automatización diaria que revisa nuevas licitaciones:

```
POST /api/ventas/oportunidades/ingest
Authorization: Bearer <SYNTRA_CRON_SECRET>
```

Cuerpo (una licitación):

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

Comportamiento idempotente: si `licitacionNo` ya existe, se omite (no duplica).

## Estados

| Estado | Descripción |
|--------|-------------|
| `PENDIENTE_DECIDIR` | Registro nuevo (por defecto desde n8n) |
| `PARTICIPAR` | Se participará en la licitación |
| `NO_PARTICIPAR` | Se descarta la oportunidad |
