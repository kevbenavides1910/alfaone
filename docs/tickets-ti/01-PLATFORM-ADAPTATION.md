# Adaptación de especificación — Laravel → Alfa One

Este documento traduce la especificación original al stack real de la plataforma.

---

## Mapa de conceptos

| Especificación (Laravel) | Alfa One (Next.js) |
|--------------------------|---------------------|
| `App\Models\User` | `User` en `prisma/schema.prisma` |
| Blade views | `src/app/(app)/tickets-ti/**/*.tsx` |
| `routes/tickets.php` | `src/app/api/tickets-ti/**/route.ts` |
| Eloquent models | Prisma models + `src/modules/tickets-ti/services/` |
| Form Requests | Zod en `src/modules/tickets-ti/validations/` |
| Policies | `hasPermission(session, key, level)` en API y UI |
| Middleware auth | `(app)/layout.tsx` + `getSession()` en API |
| Layout `@extends` | `TicketsTiShell` + `AppShell` existente |
| Sidebar menú | `SIDEBAR_NAV_GROUPS` en `navigation.ts` |
| Bootstrap 5 | Tailwind + componentes `src/components/ui/` |
| Storage `storage/app` | `APP_DATA_ROOT` + `tickets-ti-uploads` |
| Events/Listeners | Servicios + funciones explícitas (sin paquetes nuevos) |
| Permisos `tickets.*` | `ticketsTi.centro`, `ticketsTi.tickets`, `ticketsTi.admin` |

---

## Permisos (mapeo propuesto)

| Spec | Clave Alfa One | Nivel mínimo |
|------|----------------|--------------|
| tickets.view | ticketsTi.centro | view |
| tickets.view (detalle) | ticketsTi.tickets | view |
| tickets.create | ticketsTi.tickets | edit |
| tickets.update | ticketsTi.tickets | edit |
| tickets.assign | ticketsTi.tickets | edit |
| tickets.comment | ticketsTi.tickets | edit |
| tickets.resolve / close / reopen | ticketsTi.tickets | edit |
| tickets.admin | ticketsTi.admin | admin |

La granularidad fina (assign vs comment) puede ampliarse en fases posteriores sin romper claves existentes.

---

## Pantallas (UI/UX spec)

| Pantalla spec | Ruta Alfa One |
|---------------|---------------|
| Centro de Operaciones | `/tickets-ti` |
| Detalle ticket + panel lateral | `/tickets-ti/[id]` |
| Nuevo ticket | `/tickets-ti/nuevo` |
| Administración catálogos | `/tickets-ti/admin` |
| Notificaciones | Topbar + `/tickets-ti/notificaciones` (fase 3) |
| Búsqueda global | Topbar (fase 4) |

---

## Colores de estado y prioridad

Definidos en `src/modules/tickets-ti/business/status-colors.ts` (tokens Tailwind, no colores fijos en componentes).
