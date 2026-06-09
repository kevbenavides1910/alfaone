# Módulo: Núcleo (core)

## Responsabilidad

Cliente Prisma, autenticación NextAuth, permisos por rol, catálogo de empresas, utilidades Excel compartidas.

## Código (Fase 2 — migrado)

| Capa | Ubicación |
|------|-----------|
| Base de datos | `db/prisma.ts` |
| Auth | `auth/auth-options.ts` |
| Permisos | `permissions.ts` |
| Empresas | `services/companies.ts` |
| Validación empresa | `validations/company-code.ts` |
| Excel compartido | `import/xlsx-read.ts` (disciplinario + presupuestos) |
| Barrel | `index.ts` |

## APIs relacionadas

- `/api/auth/*`
- `/api/companies`

## Imports

```ts
import { prisma } from "@/modules/core/db/prisma";
import { authOptions } from "@/modules/core/auth/auth-options";
import { isAdmin } from "@/modules/core/permissions";
```

## Permanece en `src/lib/`

Infraestructura transversal (no dominio de negocio):

- `lib/api/` — middleware, respuestas HTTP
- `lib/modules/` — registry, navegación, acceso por módulo
- `lib/utils/`, `lib/hooks/`
