# Módulo Tickets TI

Mesa de ayuda / ITSM integrada en Alfa One.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/tickets-ti` | Centro de Operaciones |
| `/tickets-ti/nuevo` | Crear ticket (fase 2) |
| `/tickets-ti/[id]` | Detalle (fase 2) |
| `/tickets-ti/admin` | Catálogos (fase 5) |

## API (fase 2+)

Prefijo: `/api/tickets-ti`

## Permisos

| Clave | Uso |
|-------|-----|
| `ticketsTi.centro` | Ver Centro de Operaciones |
| `ticketsTi.tickets` | Ver/crear/gestionar tickets |
| `ticketsTi.admin` | Administración de catálogos |

## Documentación

- `docs/tickets-ti/00-DISCOVERY.md`
- `docs/tickets-ti/01-PLATFORM-ADAPTATION.md`
- `docs/tickets-ti/02-ROADMAP.md`

## Catálogos iniciales

```bash
node prisma/seed-tickets-ti-catalogs.mjs
```

## Principios

- Integración **aditiva** (no modifica auth, login ni layouts base).
- Usuarios existentes (`User` de Prisma).
- Máquina de estados en `business/status-transitions.ts`.
