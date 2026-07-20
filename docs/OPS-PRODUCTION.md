# Operaciones en producción (VPS)

## Despliegue

Preferido (imagen preconstruida en GHCR, sin compilar en el VPS):

```bash
cd /mnt/data/projects/alfa-one/code/presupuestos-alfa
npm run ops:deploy:auto
# o explícito:
APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:latest npm run ops:deploy:pull
# por SHA (recomendado tras un push):
APP_IMAGE=ghcr.io/kevbenavides1910/alfaone:<git-sha> npm run ops:deploy:pull
```

La imagen la publica el workflow [`.github/workflows/publish-ghcr.yml`](../.github/workflows/publish-ghcr.yml) en cada push a `main` (y `workflow_dispatch`).

Build local en el VPS solo para WIP / árbol sucio:

```bash
npm run ops:deploy
```

Detalle: [`DEPLOYMENT.md`](./DEPLOYMENT.md).

- **App** (`security_contracts_app`): puerto 3000 (compose puede publicarlo; nginx delante).
- **Nginx** (`security_contracts_nginx`): publica `80` → proxy a la app.
- Secretos: solo en `.env.production` (permisos `600`).

## Alertas por correo

Destinatario por defecto en plantilla: **kevbenavides@gmail.com**.

```bash
# Opción A: reutilizar SMTP del módulo Disciplinario (ya en la BD)
sudo bash scripts/sync-health-alert-smtp-from-db.sh

# Opción B: plantilla vacía (p. ej. Gmail de kevbenavides@gmail.com)
sudo bash scripts/setup-health-alert-email.sh
sudo nano /etc/alfa-one/health-alert.env

# Prueba
HEALTH_ALERT_ENV=/etc/alfa-one/health-alert.env \
  python3 scripts/send-health-alert-email.py "[ALFA ONE] Prueba" "Correo de prueba OK."

sudo bash scripts/install-production-cron.sh
```

Si la prueba falla con `Authentication unsuccessful`, actualice la contraseña SMTP en **Disciplinario → Ajustes** y vuelva a ejecutar `sync-health-alert-smtp-from-db.sh`, o use una **contraseña de aplicación Gmail** en `health-alert.env` (`SMTP_HOST=smtp.gmail.com`, `SMTP_USER=kevbenavides@gmail.com`).

| Cuándo | Qué recibe |
|--------|------------|
| Cada **5 min** (solo si falla `/login` o sesión) | Alerta con snapshot (máx. 1 cada 30 min) |
| **07:00 CR** diario | Reporte: discos, RAM, Docker, backup, estado HTTP |

## Scripts

| Script | Uso |
|--------|-----|
| `scripts/postgres-backup.sh` | Respaldo manual → `/mnt/data/backups/postgres/` |
| `scripts/vps-health-monitor.sh` | Comprueba `/login` y sesión; envía alerta |
| `scripts/vps-health-daily-report.sh` | Reporte diario por correo |
| `scripts/setup-health-alert-email.sh` | Crea `/etc/alfa-one/health-alert.env` |
| `scripts/harden-production-env.sh` | `chmod 600` + rotar Postgres si sigue `postgres` |
| `scripts/install-production-cron.sh` | `sudo` — instala cron de salud, backup y prune |
| `scripts/docker-prune-cache.sh` | Limpia caché de build antigua |

Cron instalado en `/etc/cron.d/alfa-one`. Logs en `/var/log/alfa-one/`.

## Respaldo PostgreSQL en otro servidor

Flujo recomendado: **respaldo local** en `/mnt/data/backups/postgres/` y luego **rsync por SSH** a un segundo servidor (otro VPS, NAS, etc.).

```bash
# 1. Plantilla y clave SSH dedicada
sudo bash scripts/setup-backup-remote.sh
sudo nano /etc/alfa-one/backup-remote.env
#   BACKUP_REMOTE_HOST=IP_O_HOSTNAME_DEL_OTRO_SERVIDOR
#   BACKUP_REMOTE_USER=usuario_con_escritura
#   BACKUP_REMOTE_PATH=/backups/alfa-one/postgres
#   BACKUP_REMOTE_ENABLED=1

# 2. En el servidor remoto: pegar la clave pública en ~/.ssh/authorized_keys

# 3. Prueba
bash scripts/postgres-backup.sh
# o solo sync: BACKUP_REMOTE_ENV=/etc/alfa-one/backup-remote.env bash scripts/postgres-backup-remote-sync.sh

sudo bash scripts/install-production-cron.sh
```

| Paso | Dónde queda |
|------|-------------|
| `pg_dump` | Local: `/mnt/data/backups/postgres/` (30 días) |
| `rsync` | Remoto: ruta configurada en `BACKUP_REMOTE_PATH` |

Si el sync remoto falla, el respaldo **local sigue guardándose** (solo se registra advertencia en el log).

Otras opciones (no incluidas en scripts): S3/Wasabi con `rclone`, BorgBackup, o backup gestionado del proveedor del VPS.

## SSH

El endurecimiento **no** desactiva login por contraseña. Opcional: fail2ban y claves SSH adicionales.

## Tras rotar contraseña de Postgres

1. `bash scripts/rotate-postgres-password.sh`
2. Verificar que `.env` y `.env.production` tengan el mismo `DATABASE_URL`
3. `docker compose -f docker-compose.prod.yml up -d --force-recreate app`
