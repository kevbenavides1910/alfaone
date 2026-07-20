# CI — GitHub Actions

Pipelines:

| Workflow | Archivo | Rol |
|----------|---------|-----|
| **CI** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Lint + build de validación en PR/push |
| **Publish GHCR** | [`.github/workflows/publish-ghcr.yml`](../.github/workflows/publish-ghcr.yml) | Build Docker + push a `ghcr.io/kevbenavides1910/alfaone` |

## Qué hace CI

1. **Detectar módulos** (`dorny/paths-filter`) según carpetas tocadas en el PR o push.
2. **Lint + build** si hay cambios en `src/`, `prisma/`, dependencias o workflows.
3. **Omitir build** si solo cambian docs u otros archivos fuera del alcance (job `docs-only`).

El **build siempre compila el monolito completo** cuando corre: es lo correcto mientras haya una sola app Next.js.

## Qué hace Publish GHCR

En push a `main`/`master` (paths de app) o `workflow_dispatch`:

1. Build multi-stage del [`Dockerfile`](../Dockerfile) con BuildKit + cache GHA.
2. Push de tags: `<sha>` corto, `<sha>` completo y `latest` (en default branch).

En el VPS: `npm run ops:deploy:pull` o `ops:deploy:auto` (sin recompilar).

## Módulos vigilados

| ID | Carpetas (resumen) |
|----|-------------------|
| `core` | `src/modules/core`, auth, companies, branding API |
| `presupuestos` | contratos, gastos, `src/modules/presupuestos` |
| `reportes` | `/reports`, `/api/reports` |
| `inventario` | `src/modules/inventario`, assets, inventory |
| `disciplinario` | `src/modules/disciplinario`, `/api/disciplinary` |
| `plataforma` | admin, users, `src/modules/plataforma` |
| `shared` | `prisma/`, `src/lib/`, layout, UI compartida |

Fuente de verdad de patrones: [`scripts/ci/module-paths.json`](../scripts/ci/module-paths.json) (alinear con `src/lib/modules/registry.ts`).

## Local: ver módulos afectados

```bash
npm run ci:modules
```

Compara contra `HEAD~1` (o `GITHUB_BASE_REF` en Actions).

## Variables en CI

| Variable | Valor en CI |
|----------|-------------|
| `DATABASE_URL` | Postgres service en el workflow |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Secret fijo de CI (no producción) |

## Extender el pipeline

Cuando agreguen tests E2E por módulo:

```yaml
test-disciplinario:
  needs: detect
  if: needs.detect.outputs.disciplinario == 'true'
  run: npm run test:disciplinary
```

Mientras no existan esos scripts, lint + build bastan.

## Activar en GitHub

1. Subir el repo a GitHub.
2. Pestaña **Actions** → el workflow `CI` corre en cada PR a `main` / `master`.
3. Opcional: marcar el check como requerido en **Settings → Branches → branch protection**.
