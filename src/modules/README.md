# Módulos de negocio (`src/modules`)

Carpetas para **lógica de dominio** (servicios, reglas, validaciones). Las rutas Next.js siguen en `src/app` hasta una posible extracción a monorepo.

## Estado

| Módulo | Carpeta | Migración de código |
|--------|---------|---------------------|
| Núcleo | [`core/`](./core/) | **Migrado** (prisma, auth, permisos, empresas) |
| Plataforma | [`plataforma/`](./plataforma/) | **Migrado** (branding, usuarios admin) |
| Presupuestos | [`presupuestos/`](./presupuestos/) | **Migrado** (`business/`, `services/`, `validations/`, `import/`) |
| Disciplinario | [`disciplinario/`](./disciplinario/) | **Migrado** (`business/` + `services/`) |
| Inventario | [`inventario/`](./inventario/) | **Migrado** (`validations/`, `services/`) |

## Cómo migrar un archivo

1. Mover `src/lib/server/foo.ts` → `src/modules/<modulo>/services/foo.ts`
2. Actualizar imports: `@/lib/server/foo` → `@/modules/<modulo>/services/foo`
3. PR pequeño; sin cambiar rutas HTTP ni URLs UI
4. Actualizar `codePaths` en `src/lib/modules/registry.ts` si aplica

Documentación: [`docs/LOCAL-DEV.md`](../../docs/LOCAL-DEV.md) · [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) · CI: [`docs/CI.md`](../../docs/CI.md).

Patrones CI por módulo: [`scripts/ci/module-paths.json`](../../scripts/ci/module-paths.json).
