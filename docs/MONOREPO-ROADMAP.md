# Roadmap monorepo (despliegues independientes)

Fase 2 del código **ya está lista** (`src/modules/*`). Este documento describe **cuándo** y **cómo** pasar a varias apps desplegables sin romper la BD compartida.

## ¿Cuándo migrar?

| Señal | Acción |
|-------|--------|
| Solo una app en producción | **Quedarse en monolito** + CI actual |
| Disciplinario y presupuestos con ciclos de release distintos | Planear monorepo |
| Equipos separados por módulo | Monorepo + paquetes compartidos |
| Necesidad de escalar solo un módulo en otro servidor | Monorepo o reverse proxy por rutas |

## Arquitectura objetivo (Turborepo)

```
grupo-alfa/
├── apps/
│   ├── web/                 # Shell actual (opcional: una app que agrupa rutas)
│   ├── presupuestos/        # o mantener web única al inicio
│   └── disciplinario/
├── packages/
│   ├── database/            # prisma/schema + migrate
│   ├── core-auth/           # auth-options, permissions
│   ├── core-db/             # prisma client
│   ├── ui/                  # components/ui, layout
│   └── config-typescript/   # tsconfig base
├── turbo.json
└── package.json
```

**Fase A (baja fricción):** un solo `apps/web` que importa `@grupo-alfa/presupuestos`, `@grupo-alfa/disciplinario` como **paquetes workspace**, sin segundo deploy.

**Fase B:** `apps/presupuestos` y `apps/disciplinario` con dominio o prefijos `/presupuestos`, `/disciplinario` detrás de un proxy.

## Base de datos

- **Un PostgreSQL**, un `packages/database`.
- Migraciones en orden lineal; nunca dos apps ejecutando `migrate dev` a la vez en prod.
- En deploy: un job `prisma migrate deploy` antes de levantar cualquier app.

## SSO entre apps

- Mismo `NEXTAUTH_SECRET`.
- Mismo dominio (cookies) o subdominios con configuración explícita.
- Tabla `User` / `Company` solo en `packages/database`.

## Pasos concretos (orden sugerido)

1. **Renombrar repo root** a workspace npm (`"workspaces": ["apps/*", "packages/*"]`).
2. Extraer `packages/database` (mover `prisma/`).
3. Extraer `packages/core-auth` + `packages/core-db` desde `src/modules/core`.
4. Extraer `packages/ui` desde `src/components/ui` y layout.
5. Mover `src/modules/presupuestos` → `packages/presupuestos` (o `apps/web` imports).
6. Configurar `turbo.json`: `build` depende de `^build`.
7. Docker: una imagen por app o una imagen multi-stage con ARG `APP=presupuestos`.

## Estimación de esfuerzo

| Fase | Esfuerzo | Riesgo |
|------|----------|--------|
| Paquetes workspace, 1 app | 2–4 días | Bajo |
| 2 apps desplegables | 1–2 semanas | Medio |
| Microservicios separados | No recomendado al inicio | Alto |

## Mientras tanto

- Usar **CI con path filters** ([`CI.md`](./CI.md)) para saber qué módulo tocó cada PR.
- Desplegar **una imagen Docker** ([`DEPLOYMENT.md`](./DEPLOYMENT.md)).
- Cambios acotados a `src/modules/<modulo>/` según [`ARCHITECTURE.md`](./ARCHITECTURE.md).
