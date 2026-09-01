---
name: deploy-alfa-one
description: Despliega Alfa One a producción desde Cursor en alfaia (VPS). Usar cuando pidan deploy, subir a prod, publicar, ops:deploy, GHCR, o tras commit+push a main.
---

# Deploy Alfa One (agente Cursor)

## Path obligatorio

```text
/mnt/data/projects/alfa-one/code/presupuestos-alfa
```

Nunca deploy desde worktree, `/tmp` ni checkout incompleto.

## Comando (obligatorio para agentes)

```bash
cd /mnt/data/projects/alfa-one/code/presupuestos-alfa
npm run ops:deploy:cursor
```

**Qué hace:** build Docker local inmediato (cache webpack en disco) → recreate app ~16s → push GHCR en background. **No espera** GitHub Actions.

## Flujo del agente

1. Cambios commiteados y pusheados a `main` (commit solo si el usuario lo pidió).
2. Login GHCR si falla pull/push: `npm run ops:ghcr-login` (requiere `/etc/alfa-one/ghcr.env` o `GHCR_TOKEN` — pedir al usuario, no inventar).
3. `npm run ops:deploy:cursor` — bloquear hasta que termine; no poll manual con `sleep` + `gh run list`.
4. Confirmar solo si el script reporta `DEPLOY OK` + health/smoke.

## Salidas rápidas

| Situación | Tiempo |
|-----------|--------|
| App ya en el SHA y healthy | ~0s |
| Build con cache caliente | ~3 min + ~16s recreate |
| Build cold | ~4–5 min |

Cache persistente: `/mnt/data/projects/alfa-one/build-cache/next-cache`

## Prohibido

- `npm run ops:deploy` (build legacy compose) salvo que el usuario diga explícitamente «build local»
- `ops:deploy:auto` (puede caer a build local)
- `DEPLOY_ALLOW_MODULE_DROP=1` / `DEPLOY_ALLOW_FOREIGN_ROOT=1` sin confirmación explícita
- Afirmar deploy OK sin pasar smoke del script

## Fallback

```bash
npm run ops:deploy:ghcr   # espera Publish GHCR (más lento)
```

Detalle: `code/presupuestos-alfa/docs/DEPLOYMENT.md`, reglas `deploy-ghcr-obligatorio.mdc`, `deploy-anti-drop-rutas.mdc`.
