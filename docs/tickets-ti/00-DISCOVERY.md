# Informe de descubrimiento — Módulo Tickets TI

Versión: 1.0 · Estado: Completado · Fecha: 2026-06-23

---

## 1. Resumen ejecutivo

La especificación del cliente asume **Laravel + Blade + Bootstrap 5**. La plataforma real **Alfa One** es:

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 (App Router) + React 18 + TypeScript |
| UI | Tailwind CSS + Radix UI + Lucide |
| ORM / BD | Prisma 5 → PostgreSQL |
| Auth | NextAuth 4 (JWT + credenciales) |
| Permisos | `Role` + `RolePermission` + registro en `src/lib/permissions/registry.ts` |
| Validación | Zod |

**No existe Laravel ni PHP** en el monorepo. El módulo se implementará **dentro de Alfa One**, siguiendo los principios aditivos de la especificación.

---

## 2. Arquitectura actual relevante

- **Registro de módulos:** `src/lib/modules/registry.ts`, `src/lib/modules/types.ts`
- **Permisos:** `src/lib/permissions/registry.ts`, `prisma/seed-roles.ts`, `docs/PERMISSIONS.md`
- **Navegación:** `src/lib/modules/navigation.ts`, `AppShell`, `ModuleSubnav`
- **Patrón de módulo:** `src/modules/<dominio>/` + `src/app/(app)/<ruta>/` + `src/app/api/<ruta>/`
- **Referencias recomendadas:** `ventas` (API/servicios), `disciplinario` (adjuntos/email), `sig` (auditoría)

---

## 3. Componentes reutilizables

| Recurso | Uso en Tickets TI |
|---------|-------------------|
| `User` (Prisma) | Solicitante, técnico asignado, autor comentarios |
| `hasPermission()` / `PermissionGuard` | Control de acceso por pantalla |
| `ModuleSubnav` | Subnavegación del módulo |
| `CalendarDateInput` | Fechas en formularios |
| `src/lib/storage/paths.ts` | Adjuntos (`tickets-ti-uploads`) |
| Email (nodemailer) | Notificaciones por correo (fase posterior) |
| Topbar campana | Hook futuro para centro de notificaciones |

---

## 4. Brechas identificadas

| Brecha | Estrategia |
|--------|------------|
| Spec Laravel → Next.js | Traducir Blade a App Router; Eloquent a Prisma |
| Sin centro de notificaciones | Nueva tabla `ticket_notifications` + UI en Topbar (fase 3) |
| Sin auditoría global única | Tabla `ticket_audits` propia del módulo |
| UI spec Bootstrap → Tailwind | Mismos componentes visuales con tokens existentes |
| Búsqueda global | Nueva API + barra en Topbar (fase 4) |

---

## 5. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Desalineación registro permisos | Actualizar registry + seed-roles en el mismo cambio |
| Schema Prisma monolítico | Migración dedicada, sección comentada en schema |
| Rutas no en PermissionGuard | Registrar todas las `uiRoutes` |
| Adjuntos en disco efímero (Render) | Usar `APP_DATA_ROOT` / volumen persistente |

---

## 6. Estrategia de integración (aditiva)

1. Nuevas tablas Prisma (prefijo `ticket_*`, tabla `tickets`)
2. Nuevo módulo `ticketsTi` en registry y permisos
3. Rutas UI `/tickets-ti/*` y API `/api/tickets-ti/*`
4. Sin modificar login, roles globales, layouts base ni middleware existentes
5. Relaciones solo hacia `User`; sin FK cruzadas a otros dominios

---

## 7. Autorización

Cambios clasificados como **Seguros** y **Controlados** únicamente. No hay cambios **Críticos** planificados (no se modifica `User` más allá de relaciones Prisma opcionales).

Ver `01-PLATFORM-ADAPTATION.md` para el mapa detallado spec → implementación.
