# Alfa One — Presupuestos (agente)

App Next.js 14 + Prisma + PostgreSQL. Código en este directorio (`code/presupuestos-alfa`).

## Comandos

```bash
npm run dev              # desarrollo local
npm run build            # build producción
npm run lint
npx prisma migrate deploy   # migraciones en prod (nunca db:reset)
```

Despliegue prod (VPS 10.1.1.222):

```bash
docker compose -f docker-compose.prod.yml up -d --build --no-deps --force-recreate app
```

## Reglas del proyecto (Cursor)

| Regla | Archivo |
|-------|---------|
| Protección BD producción | `.cursor/rules/produccion-proteger-bd.mdc` |
| Archivos en `/mnt/storage` | `.cursor/rules/storage-files.mdc` |
| **Tablas: filtros, Excel, sticky** | `.cursor/rules/data-tables.mdc` |
| Memoria Engram | `.cursor/rules/engram.mdc` |

## Tablas de datos

Todas las tablas nuevas deben seguir el patrón de **Facturación / Cuentas por cobrar**:

- Filtros al clic en el título de columna (ocultos por defecto).
- Export Excel con `exportRowsToExcel` (`src/lib/utils/excel-export.ts`).
- Encabezado sticky + scroll interno.

Referencia: `src/components/facturacion/FacturacionListFilters.tsx`.

## Engram (memoria entre sesiones)

MCP configurado en `.cursor/mcp.json`. Binario local: `.bin/engram`.

Instalar/actualizar:

```bash
bash scripts/install-engram.sh
```

Tras cambiar MCP, recargar ventana de Cursor. Project ID Engram: `presupuestos-alfa`.

## Módulos

Ver `src/modules/README.md` para mapa de dominios (facturación, inventario, disciplinario, etc.).
