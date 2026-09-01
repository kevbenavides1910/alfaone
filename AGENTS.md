# Alfa One — Presupuestos (agente)

App Next.js 15 + Prisma + PostgreSQL. Código en este directorio (`code/presupuestos-alfa`).

## Comandos

```bash
npm run dev              # desarrollo local
npm run build            # build producción
npm run lint
npx prisma migrate deploy   # migraciones en prod (nunca db:reset)
```

Despliegue prod (VPS 10.1.1.229 / alfaia):

```bash
# Obligatorio para agentes Cursor — build local inmediato + recreate (~3 min + 16s)
npm run ops:deploy:cursor

# Fallback: espera Publish GHCR (más lento para el agente)
npm run ops:deploy:ghcr

# Tag explícito
APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:<sha> npm run ops:deploy:cursor

# Login una vez (PAT con read:packages)
export GHCR_TOKEN=ghp_...
npm run ops:ghcr-login

# Build local SOLO si el usuario lo pide explícitamente (~4–5 min)
npm run ops:deploy
```

Flujo: commit → push `main` → **de inmediato** `npm run ops:deploy:cursor` (sin esperar Actions).

Detalle: `docs/DEPLOYMENT.md`. Regla: `.cursor/rules/deploy-ghcr-obligatorio.mdc`.

## Reglas del proyecto (Cursor)

| Regla | Archivo |
|-------|---------|
| Deploy solo GHCR | `.cursor/rules/deploy-ghcr-obligatorio.mdc` |
| Path canónico deploy | `.cursor/rules/deploy-solo-prod-path.mdc` |
| Anti-drop rutas | `.cursor/rules/deploy-anti-drop-rutas.mdc` |
| Protección BD producción | `.cursor/rules/produccion-proteger-bd.mdc` |
| Archivos en `/mnt/storage` | `.cursor/rules/storage-files.mdc` |
| Tablas de datos | `.cursor/rules/data-tables.mdc` |

## Tablas de datos

Todas las tablas nuevas deben seguir el patrón definido en `.cursor/rules/data-tables.mdc`:

- Filtros al clic en el título de columna (ocultos por defecto).
- Export Excel con `exportRowsToExcel` (`src/lib/utils/excel-export.ts`) — nunca `import * as XLSX`.
- Encabezado sticky + scroll interno con `TableColumnFilterHead`.
- Columnas **redimensionables** (asa en el borde del `<th>`; anchos en `localStorage`). Preferir `data-table-id` / `tableId`.

Referencia de implementación: `src/components/facturacion/FacturacionListFilters.tsx`.

## Módulos

Ver `src/modules/README.md` para el mapa completo de los 15 dominios de negocio.

## Estructura clave

```
src/
  app/           # Rutas Next.js (UI + API handlers)
  modules/       # Lógica de dominio por módulo (services, business, validations)
  components/    # UI por dominio
  lib/           # Infra compartida (permissions, api middleware, storage, hooks)
prisma/
  schema.prisma  # 155 modelos
  seed/          # Seeds de catálogos y permisos
  tools/         # Scripts one-off de importación y migración de datos
scripts/
  ops/           # Deploy, backup, health, install
  cron/          # Wrappers de cron (cron-*.sh, naf-*-cron.sh)
  db/            # One-offs de datos (debug, migrate, repair)
  ci/            # Herramientas de CI local
```

## Convención de rutas API

Cada `route.ts` debe: auth + validación de input → llamar servicio en `src/modules/<modulo>/services/` → devolver respuesta. No debe contener lógica de negocio ni queries Prisma directas.
