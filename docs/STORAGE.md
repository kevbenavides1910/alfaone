# Almacenamiento de archivos en el servidor

## Discos en este servidor (10.1.1.222)

| Disco | Tamaño | Montaje | Uso |
|-------|--------|---------|-----|
| **sda** (SSD) | ~334 GB | `/` | Sistema operativo, Docker, PostgreSQL, código |
| **sdb** (HDD) | ~11 TB | `/mnt/storage` | **Archivos de usuario** (PDF, imágenes, Word, Excel, videos, etc.) |

**Regla:** todo archivo subido o generado por la aplicación debe vivir bajo `/mnt/storage`, nunca en el SSD del sistema salvo desarrollo local temporal.

## Estructura estándar (Presupuestos-Alfa)

```
/mnt/storage/apps/presupuestos-alfa/
├── expense-uploads/    # Adjuntos de gastos
├── branding/           # Logo de login y firma PDF disciplinario
├── static-overrides/   # CSS hotfix (`alfa-overrides.css`) sin rebuild Next
├── exports/            # Exportaciones masivas / temporales (reservado)
└── backups/            # Respaldos de archivos (opcional)
```

En este VPS, `APP_DATA_HOST` puede ser `/mnt/data/projects/alfa-one/app` (ver `.env.production`); `static-overrides/` aplica igual.
## Configuración inicial (una vez por servidor)

```bash
cd /home/soporte-ti/presupuestos-alfa
bash scripts/setup-storage.sh
```

Añada en `.env` (junto a `docker-compose.yml`):

```env
# Disco grande — NO cambiar en producción salvo migración planificada
APP_DATA_HOST=/mnt/storage/apps/presupuestos-alfa
```

Reinicie la aplicación:

```bash
docker compose up -d --build
```

## Variables de entorno

| Variable | Host (`.env`) | Dentro del contenedor Docker |
|----------|----------------|------------------------------|
| `APP_DATA_HOST` | `/mnt/storage/apps/presupuestos-alfa` | Montado en `/data` |
| `EXPENSE_UPLOAD_DIR` | (automático) | `/data/expense-uploads` |
| `BRANDING_UPLOAD_DIR` | (automático) | `/data/branding` |

El código resuelve rutas en [`src/lib/storage/paths.ts`](../src/lib/storage/paths.ts). No hardcodear `/home/.../uploads` en features nuevas.

## Desarrollo futuro — checklist

Al añadir una función que **guarde archivos en disco**:

1. [ ] Usar subcarpeta bajo `APP_DATA_HOST` (o `appDataRoot()` / `STORAGE_DIRS` en `paths.ts`).
2. [ ] Si es un tipo nuevo, extender `scripts/setup-storage.sh` y esta tabla.
3. [ ] Montar la carpeta en `docker-compose.yml` y `docker-compose.prod.yml` (bind a `/data/...`).
4. [ ] Validar tamaño y MIME (ver `src/lib/security/`).
5. [ ] No guardar en `process.cwd()/uploads` en producción.

### Ejemplo para un nuevo módulo `reportes`

```typescript
import path from "path";
import { appDataRoot, STORAGE_DIRS } from "@/lib/storage/paths";

const REPORTS_ROOT = path.join(appDataRoot(), "reports"); // o ampliar STORAGE_DIRS
```

En Docker, añadir volumen si usa ruta distinta bajo `/data`.

## Migrar archivos existentes

Si había adjuntos en el volumen Docker del SSD o en `./uploads`:

```bash
# Desde el proyecto
sudo rsync -av uploads/ /mnt/storage/apps/presupuestos-alfa/ 2>/dev/null || true
sudo rsync -av "$(docker volume inspect presupuestos-alfa_expense_uploads -f '{{.Mountpoint}}' 2>/dev/null)/" \
  /mnt/storage/apps/presupuestos-alfa/expense-uploads/ 2>/dev/null || true
sudo chown -R 1001:1001 /mnt/storage/apps/presupuestos-alfa
```

## PostgreSQL

La base de datos **permanece en el SSD** (volumen Docker `postgres_data`) por rendimiento. Solo los binarios van al HDD.

## Verificación

```bash
df -h /mnt/storage
ls -la /mnt/storage/apps/presupuestos-alfa
docker exec security_contracts_app ls -la /data
```

## Expediente digital NAF

Los PDFs del expediente **no** viven en `/mnt/storage`: permanecen en el share de `10.1.1.6`. Ver [EXPEDIENTE-DIGITAL.md](./EXPEDIENTE-DIGITAL.md).

Réplica filesystem en este VPS: `/mnt/data/backups/expediente-digital/` (SSH desde Oracle, no CIFS).
