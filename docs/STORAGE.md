# Almacenamiento de archivos en el servidor

## Discos en este VPS (10.1.1.229)

| Disco | Tamaño | Montaje | Uso |
|-------|--------|---------|-----|
| **SSD (LVM)** | ~877 GB | `/` | Sistema, Docker (imágenes/caché), código en repo |
| **HDD datos** | ~5,2 TB | `/mnt/data` | **PostgreSQL, archivos de usuario, backups** |

En servidores con `/mnt/storage` (HDD ~11 TB), puede usarse la misma estructura bajo `/mnt/storage/apps/presupuestos-alfa/`; en **este VPS** la ruta canónica es `/mnt/data/projects/presupuestos-alfa/app`.

**Regla:** todo archivo subido o generado por la aplicación debe vivir bajo `APP_DATA_HOST` (montado en `/data` dentro del contenedor). No usar `process.cwd()/uploads` en producción.

## Estructura en este servidor

```
/mnt/data/
├── projects/presupuestos-alfa/
│   ├── code/presupuestos-alfa/     # Repositorio y Docker Compose
│   └── app/                        # APP_DATA_HOST → montado en /data
│       ├── expense-uploads/
│       ├── branding/
│       ├── sig-documents/
│       ├── facturacion-uploads/
│       └── exports/                # reservado
├── volumes/postgres/               # Datos PostgreSQL
└── backups/postgres/               # pg_dump diario (cron)
```

## Configuración inicial (una vez por servidor)

```bash
cd /mnt/data/projects/presupuestos-alfa/code/presupuestos-alfa
bash scripts/setup-storage.sh --root /mnt/data/projects/presupuestos-alfa/app
```

En `.env.production`:

```env
APP_DATA_HOST=/mnt/data/projects/presupuestos-alfa/app
```

Reinicie la aplicación:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Variables de entorno

| Variable | Host (`.env.production`) | Dentro del contenedor |
|----------|--------------------------|------------------------|
| `APP_DATA_HOST` | `/mnt/data/projects/presupuestos-alfa/app` | Montado en `/data` |
| `APP_DATA_ROOT` | (automático en compose) | `/data` |
| `EXPENSE_UPLOAD_DIR` | (automático) | `/data/expense-uploads` |
| `BRANDING_UPLOAD_DIR` | (automático) | `/data/branding` |

Rutas en código: [`src/lib/storage/paths.ts`](../src/lib/storage/paths.ts).

## Checklist — nuevo módulo con archivos

1. [ ] Subcarpeta bajo `appDataRoot()` o nueva clave en `STORAGE_DIRS`.
2. [ ] Extender `scripts/setup-storage.sh` si hace falta crear la carpeta.
3. [ ] Volumen en `docker-compose.prod.yml` ya monta todo `APP_DATA_HOST` → `/data`.
4. [ ] Validar tamaño y MIME (`src/lib/security/`).
5. [ ] Registrar el módulo en `src/lib/modules/registry.ts`.

## PostgreSQL y respaldos

- Datos: `/mnt/data/volumes/postgres/presupuestos-alfa_postgres_data/_data`
- Respaldo automático: `scripts/postgres-backup.sh` → `/mnt/data/backups/postgres/` (retención 30 días, cron vía `scripts/install-production-cron.sh`).

## Verificación

```bash
df -h /mnt/data
ls -la /mnt/data/projects/presupuestos-alfa/app
docker exec security_contracts_app ls -la /data
ls -la /mnt/data/backups/postgres/
```
