---
name: deploy-alfa-one
description: Despliega Alfa One lo más rápido posible (patch-static / recreate / cursor). Usar cuando pidan deploy, subir a prod, publicar, ops:deploy, GHCR.
---

# Deploy Alfa One (camino más rápido)

## Path

```text
/mnt/data/projects/alfa-one/code/presupuestos-alfa
```

## Checklist → comando

| Cambio | Comando | Tiempo |
|--------|---------|--------|
| CSS/branding overlay | `npm run ops:deploy:patch-static` | ~10–30 s |
| Código (imagen SHA ya local/prod) | `npm run ops:deploy:cursor` | ~0–30 s |
| Código (sin imagen) | `ops:deploy:cursor` (push paralelo interno) | ~1.5–3 min |
| Schema | migración + cursor | build + migrate |
| WIP sin push | solo con «build local» → `ops:deploy` | lento |

**Default al oír «despliega»:** si hay cambios de app → commit solo si lo pidieron → **stash WIP ajeno** → **`npm run ops:deploy:cursor`** (el script hace `git push` en paralelo al build si HEAD va adelante). No hace falta `git push` secuencial antes. Si el cambio es solo overlay CSS → **patch-static**.

## Prebuild (imagen lista al commit)

Tras `npm run ops:prebuild:install-hook`, cada commit que toque `src/`/`prisma`/Dockerfile lanza **prebuild en background** (`ghcr.io/.../alfaone:<sha>`). Así el siguiente `ops:deploy:cursor` suele ser solo recreate (~15–30 s).

```bash
npm run ops:prebuild:install-hook   # una vez por clon
npm run ops:prebuild                # forzar HEAD ahora
npm run ops:prebuild -- --bg        # forzar en background
ALFAONE_PREBUILD=0 git commit …    # saltar hook
```

Logs: `.deploy-logs/prebuild-<shortsha>.log`

## Comandos

```bash
npm run ops:deploy:cursor
npm run ops:deploy:patch-static
npm run ops:deploy:preview    # :3001
npm run ops:deploy:promote
```

Confirmar solo con `DEPLOY OK` / `PATCH OK` / `PREVIEW OK` + health/smoke.
