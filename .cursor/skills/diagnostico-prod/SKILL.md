---
name: diagnostico-prod
description: Diagnostica problemas en Alfa One producción (logs, health, contenedor, deploy). Usar cuando algo no funciona en prod, 500, módulo caído, rollback, o verificar estado post-deploy.
---

# Diagnóstico producción Alfa One

Path: `/mnt/data/projects/alfa-one/code/presupuestos-alfa`

## Estado rápido

```bash
docker ps --filter name=security_contracts
docker inspect security_contracts_app --format '{{.Config.Image}} {{.State.Health.Status}}'
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/auth/session
```

## Logs

```bash
docker logs --tail 120 security_contracts_app
ls -lt .deploy-logs/deploy-pull-*.log | head -3
```

## Imagen vs git

```bash
git rev-parse HEAD
docker inspect security_contracts_app --format '{{.Config.Image}}'
docker images ghcr.io/kevbenavides1910/alfaone --format '{{.Tag}} {{.CreatedSince}}' | head -5
```

## Módulo faltante post-deploy

```bash
docker exec security_contracts_app ls -1 '.next/server/app/(app)' | sort
bash scripts/ops/deploy-module-smoke.sh security_contracts_app
```

Si smoke falla → rollback automático ya debió activarse; revisar tag `alfa-one-app-rollback:*`.

## BD viva

```bash
docker exec security_contracts_db pg_isready -U postgres
# NO db:reset. Solo migrate deploy vía contenedor app al arrancar.
```

## Re-deploy controlado

Solo tras fix commiteado:

```bash
npm run ops:deploy:cursor
```

No rebuild local legacy (`ops:deploy`) salvo petición explícita.

Docs: `docs/OPS-PRODUCTION.md`, `docs/DEPLOYMENT.md`
