# Módulo: Plataforma

## Responsabilidad

Branding de la app (colores, logo), administración de usuarios, catálogos en `/admin`.

## Código (Fase 2 — migrado)

| Capa | Ubicación |
|------|-----------|
| Branding UI | `branding-constants.ts` |
| Archivos logo/firma | `services/app-branding.ts` |
| Listado usuarios admin | `services/list-users.ts` |
| Barrel | `index.ts` |

## Rutas UI

- `/admin/users`, `/admin/catalogs`

## APIs

- `/api/admin/**`, `/api/users`, `/api/branding`

## Imports

```ts
import { APP_BRANDING_QUERY_KEY } from "@/modules/plataforma/branding-constants";
import { ensureBrandingRow } from "@/modules/plataforma/services/app-branding";
import { listUsersForAdmin } from "@/modules/plataforma/services/list-users";
```
