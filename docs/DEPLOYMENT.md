# Despliegue — Syntra Dynamics

Guía operativa alineada con [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Modelo actual: una aplicación

| Componente | Archivo / comando |
|------------|-------------------|
| Build producción | `npm run build` (incluye todos los módulos) |
| Imagen Docker | `Dockerfile` (multi-stage + `output: "standalone"`) |
| Base de datos | `docker-compose.yml` → servicio `postgres` |
| App + migraciones | `prisma migrate deploy` en el `CMD` del contenedor |
| Variables | `.env` / `.env.local`: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` |

No existe hoy un despliegue “solo disciplinario”: cualquier cambio requiere **rebuild + redeploy de la misma imagen**.

---

## Path canónico y blindaje anti-deploy incompleto

**Solo desplegar desde este directorio en el VPS:**

```text
/mnt/data/projects/alfa-one/code/presupuestos-alfa
```

| Control | Qué hace |
|---------|----------|
| Path / worktree | `scripts/ops/deploy-context-preflight.sh` aborta si el cwd no es el canónico, está bajo `/tmp`, o es un git worktree |
| `COMPOSE_PROJECT_NAME` | Fijado a `presupuestos-alfa` (evita stacks Docker paralelos) |
| Anti-drop (build local) | Inventario **completo** de páginas UI + APIs: toda ruta en la imagen en ejecución debe existir en `src/app` (`inventory-next-routes.sh`). No basta con que exista la carpeta padre |
| Smoke post-deploy | Compara la imagen rollback (antes del recreate) vs el contenedor nuevo: **0 drops** de rutas + anclas (nómina, cargas, visualizador, FE) + deps XAdES; si falla → rollback automático |
| Lock exclusivo | `flock` en `/tmp/presupuestos-alfa-deploy.lock` — **un solo** deploy a la vez (evita que otro chat/agente pise la app a mitad de build) |
| Guard UI vs stash | Si `stash@{0}` tiene Topbar/Shells/páginas distintas al disco (mejoras de otros agentes), el deploy **aborta** — evita regresiones de interfaz con conteo de rutas “OK” |

Overrides peligrosos (solo emergencia explícita):

- `DEPLOY_ALLOW_FOREIGN_ROOT=1` — permitir otro path
- `DEPLOY_ALLOW_MODULE_DROP=1` — permitir perder módulos presentes en prod
- `DEPLOY_FULL_CHECKS=1` — fuerza `tsc` en host antes del build (por defecto se omite)
- `DEPLOY_SKIP_CHECKS=0` — compat: también fuerza typecheck en host
- `DEPLOY_SKIP_LOCK=1` — omite el flock (casi nunca)

```bash
cd /mnt/data/projects/alfa-one/code/presupuestos-alfa
npm run ops:deploy:auto     # preferido: pull si hay imagen del SHA; si no, build local
npm run ops:deploy:pull     # pull imagen GHCR + recreate app (~1–2 min)
npm run ops:deploy          # build local + recreate (WIP / dirty tree)
```

Overrides de velocidad en build local:

- Por defecto **no** corre `tsc` en el host (`DEPLOY_FULL_CHECKS=1` para forzar).
- Lint dentro de `next build` está desactivado (`eslint.ignoreDuringBuilds`); lint sigue en CI.

---

## Flujo recomendado

### Desarrollo local

```bash
docker compose up postgres -d
npm run db:generate
npm run db:migrate    # o db:push en entornos desechables
npm run dev
```

### Producción (Docker) — camino rápido

1. Commit + push a `main` → workflow **Publish GHCR** sube `ghcr.io/kevbenavides1910/alfaone:<sha>` y `:latest`.
2. En el VPS (path canónico):

```bash
cd /mnt/data/projects/alfa-one/code/presupuestos-alfa
npm run ops:ghcr-login   # una vez
npm run ops:deploy:auto
# o: APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:<sha> npm run ops:deploy:pull
```

### Producción — WIP local (sin push)

```bash
npm run ops:deploy
```

Pasos comunes (ambos caminos):

1. Preflight de contexto (+ anti-drop en build local) + backup BD.
2. Pull o build de imagen; recreate **solo** el servicio `app` (Postgres intacto).
3. Al iniciar: `prisma migrate deploy` → `node server.js`.
4. Healthcheck + HTTP (`/login`, session) + smoke de módulos en el contenedor.

### Cambio solo en un módulo (ej. disciplinario)

1. Desarrollar y probar rutas de ese módulo.
2. Si hay cambio de esquema: nueva carpeta en `prisma/migrations/`.
3. Commit y despliegue **igual que siempre** (misma imagen).
4. El riesgo se reduce porque el código del módulo está acotado en carpetas documentadas en el registry.

---

## Optimización sin separar apps

| Técnica | Beneficio |
|---------|-----------|
| Imagen GHCR vía Publish workflow | Deploy VPS sin `next build` (~1–2 min) |
| `ops:deploy:auto` | Elige pull vs build según SHA / dirty tree |
| Paralelismo Next + skip lint-in-build | Build local residual más corto |
| Cache mount npm + capas runner estables | Rebuilds Docker más baratos |
| Migraciones pequeñas y nombradas | `migrate deploy` predecible |
| No editar migraciones ya aplicadas en prod | Evita drift |
| Path filters en CI | Ver [`docs/CI.md`](./CI.md) — resumen por módulo en cada PR |
| Prune de rollbacks (`docker-prune-cache.sh`) | Retiene solo las últimas N imágenes rollback |

---

## Variables críticas

| Variable | Notas |
|----------|--------|
| `DATABASE_URL` | En Docker: host `postgres`, puerto `5432`, DB `security_contracts` |
| `NEXTAUTH_URL` | URL pública exacta (`http://IP:3000` o `https://...`) |
| `NEXTAUTH_SECRET` | Mín. 32 caracteres en producción |
| `SYNTRA_DEVICE_SECRET` | Mín. 32 caracteres, distinto al anterior |

Si la app va detrás de HTTPS, `NEXTAUTH_URL` debe ser `https://` para cookies de sesión (ver comentarios en `src/lib/auth-options.ts`).

---

## Evolución: despliegue por módulo

Cuando se necesite publicar apps por separado:

1. Fase 2 completada (`src/modules/*`).
2. Seguir [`docs/MONOREPO-ROADMAP.md`](./MONOREPO-ROADMAP.md) para extraer Turborepo.
3. Un pipeline por app; **migraciones Prisma** desde `packages/database` en orden fijo.

Hasta entonces, tratar cada release como **versión única de plataforma Syntra Dynamics**.
