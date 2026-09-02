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

## Comandos

```bash
npm run ops:deploy:cursor
npm run ops:deploy:patch-static
npm run ops:deploy:preview    # :3001
npm run ops:deploy:promote
```

Confirmar solo con `DEPLOY OK` / `PATCH OK` / `PREVIEW OK` + health/smoke.
